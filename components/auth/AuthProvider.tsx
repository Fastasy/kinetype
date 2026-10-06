"use client";

// Auth + profile, as one context.
//
// Guest play is unaffected: nothing here forces anybody to sign in. The context is
// how the UI KNOWS whether someone is signed in, so features that need an account
// (the boss campaign, the leaderboard submission) can gate themselves instead of
// failing silently.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Session } from "@supabase/supabase-js";

import { supabase, supabaseConfigured } from "@/lib/supabase";
import { ensureProfile, getProfile, type Profile } from "@/lib/kinetype-db";
import { saveStore } from "@/game/store";
import { stashGuestSave, takeGuestSave, clearGuestSave } from "@/game/storage";

export interface AuthValue {
  /** False when Supabase env vars are missing — the UI then hides sign-in. */
  configured: boolean;
  /** False until the first session read resolves, so we never flash "signed out". */
  ready: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  profileLoading: boolean;
  signInWithGoogle: (next?: string) => Promise<void>;
  /**
   * Create an account from an email and a password.
   *
   * Instant by design: this project runs with `mailer_autoconfirm` ON, so the account can be used
   * the moment this resolves and nothing is emailed. If confirmation is ever switched back on, the
   * same call returns no session and the caller shows "check your inbox" instead — which is why the
   * OUTCOME is returned rather than assumed.
   */
  signUpWithEmail: (email: string, password: string, next?: string) => Promise<EmailAuthOutcome>;
  /** Sign in an existing email account. Throws the server's own message on a wrong password. */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /**
   * Email a password-reset link.
   *
   * Worth knowing: this project has no custom SMTP, so the built-in mailer caps auth email at 2 an
   * hour PROJECT-WIDE. That is why the signed-in password change in AccountSettings exists — it
   * needs no email at all, and it is the recovery path that always works.
   */
  sendPasswordReset: (email: string) => Promise<void>;
  /** Set a new password for the signed-in account. Needs no email. */
  setPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  /** Adopt a profile the server just handed back, without a second round trip. */
  adoptProfile: (next: Profile) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Order-insensitive membership compare, so a server reorder is not read as a change. */
function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const have = new Set(a);
  return b.every((x) => have.has(x));
}

/** Where sign-in stashes its destination. Deliberately NOT in the redirect URL. */
export const AUTH_NEXT_KEY = "kinetype:auth-next";

/** What an email sign-up produced: a live session, or a standing request to go and confirm. */
export type EmailAuthOutcome = "signed-in" | "confirm-email";

/**
 * The one place every "sign in" control should point.
 *
 * Each gate (the header, the campaign, the leaderboard) sends the player to the SAME form and
 * states where to come back to in `?next=`. One screen holding the email fields beats a second
 * sign-in UI inlined into four panels — and it is the only way an email account is reachable from
 * the campaign gate at all.
 */
export function signInHref(next: string): string {
  const safe = next.startsWith("/") ? next : "/bosses";
  return `/signin?next=${encodeURIComponent(safe)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Guard against a stale profile write after a fast sign-out.
  const loadSeq = useRef(0);

  // True once the browser's own wallet has been parked for this signed-in session, so a later
  // profile refresh cannot stash the ACCOUNT's values over the parked guest ones.
  const guestStashed = useRef(false);

  // ------------------------------------------------------------------ the account's economy
  // While signed in, coins / owned cosmetics / the equipped set come from the PROFILE, and this is
  // the ONE place the local store learns them. The direction is only ever server -> store: a
  // client that could push its own ownership could mint a 900-coin skin for free, which is why the
  // outbound loadout sync that used to live here is gone. Equipping goes through set_equipped(),
  // and buying through purchase_cosmetic().
  //
  // Keyed on `profile` identity, and it compares before writing, so a refresh that changes nothing
  // is a no-op rather than a loop.
  useEffect(() => {
    if (!profile) return;

    const current = saveStore.getSnapshot();
    const inSync =
      current.coins === profile.coins &&
      current.equippedSkin === profile.equipped_skin &&
      current.equippedTheme === profile.equipped_theme &&
      sameMembers(current.ownedSkins, profile.owned_skins) &&
      sameMembers(current.ownedThemes, profile.owned_themes);
    if (inSync) return;

    // Everything else in the save — bot speed, mute, strict mode, the local bests — is a device
    // preference and is deliberately left alone.
    saveStore.set({
      ...current,
      coins: profile.coins,
      equippedSkin: profile.equipped_skin,
      equippedTheme: profile.equipped_theme,
      ownedSkins: [...profile.owned_skins],
      ownedThemes: [...profile.owned_themes],
    });
  }, [profile]);

  const loadProfile = useCallback(async (s: Session | null): Promise<Profile | null> => {
    const seq = ++loadSeq.current;
    if (!s) {
      setProfile(null);
      return null;
    }

    // First load of a signed-in session: PARK the browser's own wallet so signing out hands the
    // player back the coins and cosmetics they had while playing locally.
    //
    // Only if nothing is parked already. A RELOAD while signed in re-runs this, and by then the
    // local save holds the ACCOUNT's mirrored values — parking those would overwrite the real guest
    // wallet, and signing out would quietly carry the account's coins into local play. The parked
    // key is the source of truth for "a guest wallet is already being held"; it is cleared when it
    // is handed back.
    if (!guestStashed.current) {
      guestStashed.current = true;
      if (takeGuestSave() === null) stashGuestSave(saveStore.getSnapshot());
    }

    setProfileLoading(true);
    try {
      // ensure_profile() creates the row on first sign-in and refreshes OAuth
      // name/avatar afterwards. It is idempotent, so calling it every load is fine.
      await ensureProfile();
      const p = await getProfile(s.user.id);
      if (seq === loadSeq.current) setProfile(p);
      return p;
    } catch (err) {
      // A backend hiccup must not lock the player out of the game.
      console.error("[kinetype] profile load failed:", err);
      return null;
    } finally {
      if (seq === loadSeq.current) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;

    void (async () => {
      // 1. Adopt a session carried in the URL HASH.
      //
      // Supabase on this project ignores `redirect_to` and returns every sign-in to
      // `site_url`, so the payload can arrive at the site root. A PKCE return is
      // `?code=` and detectSessionInUrl exchanges it; an implicit-style return is
      // `#access_token=...`, which the PKCE-configured SDK will NOT pick up. Handling
      // both means sign-in completes wherever Supabase sends the browser.
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : "";
        if (hash.includes("access_token=")) {
          const p = new URLSearchParams(hash);
          const access_token = p.get("access_token");
          const refresh_token = p.get("refresh_token");
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
            // strip the credentials out of the address bar / history
            window.history.replaceState({}, "", window.location.pathname + window.location.search);
          }
        }
      } catch {
        // A malformed hash must never stop the app booting.
      }
      if (!active) return;

      // 2. Normal bootstrap.
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setReady(true);
      void loadProfile(data.session);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // A password-recovery link lands the player here ALREADY SIGNED IN, mid-flow: the reset is
      // only half done until they choose a new password. Point the callback page at the password
      // panel by stashing that destination where it already looks for one.
      if (event === "PASSWORD_RECOVERY") {
        try {
          window.sessionStorage.setItem(AUTH_NEXT_KEY, "/settings");
        } catch {
          // storage disabled: the callback falls back to its own default destination
        }
      }
      setSession(next);
      void loadProfile(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async (next = "/bosses") => {
    const safeNext = next.startsWith("/") ? next : "/bosses";
    // The destination rides in sessionStorage, NOT the redirect URL. Supabase matches
    // the redirect against the project's allow-list, and every extra part of the URL —
    // path, query string — is another thing that has to match. A bare callback path is
    // the least ambiguous thing we can send.
    try {
      window.sessionStorage.setItem(AUTH_NEXT_KEY, safeNext);
    } catch {
      // private mode / storage disabled: fall back to the default destination
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    loadSeq.current++; // invalidate any in-flight load
    await supabase.auth.signOut();
    setProfile(null);
    // Hand the browser's own wallet back, so local play resumes where it left off rather than
    // inheriting the account's balance. Clearing the park is what lets the NEXT sign-in park anew.
    if (guestStashed.current) {
      guestStashed.current = false;
      const guest = takeGuestSave();
      if (guest) saveStore.set(guest);
      clearGuestSave();
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, next = "/bosses"): Promise<EmailAuthOutcome> => {
      const safeNext = next.startsWith("/") ? next : "/bosses";
      // If confirmation is ever switched back on, the emailed link returns the player through
      // /auth/callback, which reads this stash to know where they were headed. With confirmation
      // off (as this project is configured) it simply goes unused.
      try {
        window.sessionStorage.setItem(AUTH_NEXT_KEY, safeNext);
      } catch {
        // private mode / storage disabled: fall back to the default destination
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // Supabase ignores this on the current project and returns to `site_url` instead — which is
        // exactly what /auth/callback exists to absorb. Sent anyway, so the flow is correct the day
        // that behaviour changes.
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;

      // Confirmation off (this project): a session comes back, the auth listener above loads the
      // profile, and the caller can send the player straight on. Confirmation on: a user but no
      // session, and they must click the link before they can play.
      return data.session ? "signed-in" : "confirm-email";
    },
    [],
  );

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    // Nothing else to do: the listener above picks the session up, and profile loading with it.
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) throw error;
  }, []);

  const setPassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  /**
   * Adopt a profile the server just returned.
   *
   * Callers that already hold a fresh row (submit_match, purchase_cosmetic) use this instead of a
   * second round trip; the economy mirror above then pushes coins/ownership into the local store,
   * so there is exactly one path from server truth to what the UI shows.
   */
  const adoptProfile = useCallback((next: Profile) => {
    setProfile(next);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return loadProfile(data.session);
  }, [loadProfile]);

  const value: AuthValue = {
    configured: supabaseConfigured,
    ready,
    session,
    userId: session?.user.id ?? null,
    profile,
    profileLoading,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    setPassword,
    signOut,
    refreshProfile,
    adoptProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
