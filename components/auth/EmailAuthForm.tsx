"use client";

// Sign in / create account — one form, three modes (create, sign in, reset).
//
// Email and password sit BESIDE Google rather than in front of it: the Google button stays one
// click for anybody who has a Google account. What the form has to sell is the ACCOUNT itself —
// the boss campaign, the level and the leaderboard all hang off it, and none of them work for a
// guest — because an account is the only reason to type anything at all.
//
// Every gate links here with `?next=`, so after an in-app sign-in the player is handed straight
// back to where they were. Google leaves the page entirely, so ITS destination rides the
// sessionStorage stash that /auth/callback already reads (see AuthProvider).

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "./AuthProvider";

/** Mirrors the project's `password_min_length`. The server is the authority; this is the hint. */
const PASSWORD_MIN = 6;

type Mode = "signup" | "signin" | "reset";
type Notice = { kind: "ok" | "err"; text: string };

/** Surface the server's own message (Supabase auth errors are readable) rather than a generic banner. */
function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  if (err instanceof Error && err.message) return err.message;
  return "That did not work. Try again in a moment.";
}

const FIELD =
  "w-full border-2 border-line bg-page px-3 py-2 text-sm text-ink outline-none transition focus:border-brand";
const LABEL = "block font-mono text-[11px] uppercase tracking-wide text-ink-faint";
const PRIMARY =
  "w-full border-2 border-brand bg-brand px-4 py-3 text-sm font-bold text-brand-deep transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-line-strong disabled:text-ink-faint";

export default function EmailAuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const {
    configured,
    ready,
    userId,
    session,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    signInWithGoogle,
    signOut,
  } = useAuth();

  // Only a same-site path is accepted: `//evil.com` is a protocol-relative URL, not a path, so it
  // must not be followed after a successful sign-in.
  const raw = params.get("next");
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/bosses";

  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setNotice(null);
    setPassword("");
    setConfirm("");
  }

  async function startGoogle() {
    setGoogleBusy(true);
    setNotice(null);
    try {
      await signInWithGoogle(next);
    } catch (err) {
      setNotice({ kind: "err", text: errorMessage(err) });
      setGoogleBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNotice(null);

    const addr = email.trim();
    if (!addr.includes("@") || addr.length < 5) {
      setNotice({ kind: "err", text: "Enter your email address." });
      return;
    }

    // Reset sends only ever leave the site (Supabase emails the link), so they are handled first.
    if (mode === "reset") {
      setBusy(true);
      try {
        await sendPasswordReset(addr);
        setNotice({
          kind: "ok",
          text: "If that address has an account, a reset link is on its way. Your current password keeps working until you use it.",
        });
      } catch (err) {
        setNotice({ kind: "err", text: errorMessage(err) });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < PASSWORD_MIN) {
      setNotice({
        kind: "err",
        text: `Use at least ${PASSWORD_MIN} characters for your password.`,
      });
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setNotice({ kind: "err", text: "Those two passwords do not match." });
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const outcome = await signUpWithEmail(addr, password, next);
        // Only reachable with email confirmation switched on (it is off on this project): there is
        // no session yet, so there is nowhere to redirect to and the player has to click the link.
        if (outcome === "confirm-email") {
          setAwaitingConfirm(true);
          setBusy(false);
          return;
        }
      } else {
        await signInWithEmail(addr, password);
      }
      // A session exists now — the provider's auth listener is already loading the profile — so
      // hand the player back to whatever sent them here.
      router.replace(next);
    } catch (err) {
      setNotice({ kind: "err", text: errorMessage(err) });
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------- not configured / booting
  if (!configured) {
    return (
      <p className="border-2 border-line bg-card/50 px-4 py-8 text-center text-sm text-ink-faint">
        Accounts are not configured on this deployment yet.
      </p>
    );
  }

  if (!ready) {
    return (
      <p className="border-2 border-line bg-card/50 px-4 py-8 text-center text-sm text-ink-faint">
        Checking your account…
      </p>
    );
  }

  // ------------------------------------------------------------------------ already signed in
  // Without this, a signed-in player who follows a link here gets a form that silently does
  // nothing useful — the session is already live and signing in again is not what they want.
  if (userId) {
    return (
      <div
        className="border-2 border-line bg-card/50 px-4 py-8 text-center"
        data-testid="auth-signed-in"
      >
        <p className="font-pixel text-sm text-ink">You are already signed in</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-faint">
          {session?.user.email ? `Signed in as ${session.user.email}.` : "Your account is live."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href={next}
            data-testid="auth-continue"
            className="border-2 border-brand bg-brand px-4 py-2 text-sm font-bold text-brand-deep transition hover:bg-brand-bright"
          >
            Continue
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="border-2 border-line-strong bg-card px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-heat hover:text-heat"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------- confirmation required
  if (awaitingConfirm) {
    return (
      <div
        className="border-2 border-brand bg-card px-4 py-8 text-center"
        data-testid="auth-confirm-sent"
      >
        <p className="font-pixel text-sm text-ink">Check your inbox</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-faint">
          We sent a confirmation link to {email.trim()}. Open it to activate your account, then come
          back and sign in.
        </p>
      </div>
    );
  }

  const isReset = mode === "reset";

  return (
    <div className="border-2 border-line bg-card/50 p-4 sm:p-6" data-testid="auth-form">
      <div role="tablist" aria-label="Sign in or create an account" className="flex border-2 border-line">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          data-testid="auth-tab-signup"
          onClick={() => switchMode("signup")}
          className={`flex-1 px-3 py-2.5 text-sm font-bold transition ${
            mode === "signup" ? "bg-brand text-brand-deep" : "bg-page text-ink-soft hover:text-brand"
          }`}
        >
          Create account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          data-testid="auth-tab-signin"
          onClick={() => switchMode("signin")}
          className={`flex-1 border-l-2 border-line px-3 py-2.5 text-sm font-bold transition ${
            mode === "signin" ? "bg-brand text-brand-deep" : "bg-page text-ink-soft hover:text-brand"
          }`}
        >
          Sign in
        </button>
      </div>

      {isReset && (
        <div className="mt-4 border-2 border-line bg-page px-3 py-2">
          <p className="font-pixel text-[11px] text-ink">Reset your password</p>
          <p className="mt-1 text-xs text-ink-faint">
            We will email you a link. Open it, then set a new password here.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="space-y-1">
          <label className={LABEL} htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="auth-email"
            className={FIELD}
          />
        </div>

        {!isReset && (
          <div className="space-y-1">
            <label className={LABEL} htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              name="password"
              type="password"
              required
              minLength={PASSWORD_MIN}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="auth-password"
              className={FIELD}
            />
            {mode === "signup" && (
              <p className="pt-0.5 text-[11px] text-ink-faint">
                At least {PASSWORD_MIN} characters.
              </p>
            )}
          </div>
        )}

        {mode === "signup" && (
          <div className="space-y-1">
            <label className={LABEL} htmlFor="auth-confirm">
              Confirm password
            </label>
            <input
              id="auth-confirm"
              name="confirm"
              type="password"
              required
              minLength={PASSWORD_MIN}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              data-testid="auth-confirm"
              className={FIELD}
            />
          </div>
        )}

        <button type="submit" disabled={busy} data-testid="auth-submit" className={PRIMARY}>
          {isReset
            ? busy
              ? "Sending…"
              : "Send reset link"
            : mode === "signup"
              ? busy
                ? "Creating your account…"
                : "Create account"
              : busy
                ? "Signing in…"
                : "Sign in"}
        </button>
      </form>

      {notice && (
        <p
          role="status"
          data-testid="auth-status"
          className={`mt-4 border-2 px-3 py-2 text-sm ${
            notice.kind === "err" ? "border-heat bg-heat-deep text-heat" : "border-brand bg-brand-deep text-ink"
          }`}
        >
          {notice.text}
        </p>
      )}

      {!isReset && mode === "signin" && (
        <p className="mt-4 text-center text-xs">
          <button
            type="button"
            data-testid="auth-forgot"
            onClick={() => switchMode("reset")}
            className="text-ink-faint underline transition hover:text-brand"
          >
            Forgot your password?
          </button>
        </p>
      )}

      {isReset && (
        <p className="mt-4 text-center text-xs">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="text-ink-faint underline transition hover:text-brand"
          >
            Back to sign in
          </button>
        </p>
      )}

      {!isReset && (
        <>
          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[11px] uppercase text-ink-faint">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            disabled={googleBusy}
            onClick={() => void startGoogle()}
            data-testid="auth-google"
            className="mt-4 flex w-full items-center justify-center gap-2 border-2 border-line-strong bg-card px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-60"
          >
            <GoogleGlyph />
            {googleBusy ? "Opening Google…" : "Continue with Google"}
          </button>
        </>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.3z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7l-7.8-6.1C1.1 16.4 0 20.1 0 24s1.1 7.6 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.7-3.8-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
