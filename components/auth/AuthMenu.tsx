"use client";

// The sign-in / account control in the header.
//
// Three states, in priority order:
//   1. auth not configured  -> nothing at all (a broken button is worse than none)
//   2. signed out           -> a link to /signin, carrying where they are
//   3. signed in            -> level + XP chip, an avatar, and sign out
//
// Signed out this is a LINK, not a button that fires Google. Now that an account can be made with
// an email, the header offers the choice instead of committing the player to one provider — and it
// passes the current page along, so signing in returns them to it.
//
// Level and XP come from the server profile, so this doubles as the player's
// standing-at-a-glance and is deliberately the same number that ranks the board.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signInHref, useAuth } from "./AuthProvider";
import { levelProgress } from "@/game/progression";

export default function AuthMenu({ compact = false }: { compact?: boolean }) {
  const { configured, ready, userId, profile, signOut } = useAuth();
  const pathname = usePathname();

  if (!configured) return null;

  if (!ready) {
    return <span className="h-8 w-20 animate-pulse rounded-lg border border-line bg-card/40" aria-hidden />;
  }

  if (!userId) {
    // Already on the form: pointing it at itself would only strand the player.
    const href = pathname === "/signin" ? "/signin" : signInHref(pathname);
    return (
      <Link
        href={href}
        data-testid="header-signin"
        title="Save your progress and climb the leaderboard"
        className="flex items-center gap-2 rounded-lg border-2 border-line-strong bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
      >
        {compact ? "Sign in" : "Sign in or create an account"}
      </Link>
    );
  }

  const progress = levelProgress(profile?.xp ?? 0);
  // Always visible, everywhere: the streak is the daily hook, and a chain you can see is a chain
  // you do not want to break.
  const streakDays = profile?.streak_days ?? 0;

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/settings"
        className="flex items-center gap-2 rounded-lg border border-line bg-card/50 px-2.5 py-1.5 transition hover:border-brand/60"
        title={`Your account — change your name and picture. ${progress.intoLevel} / ${progress.levelSpan} XP into level ${progress.level}`}
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-5 w-5 rounded-full border border-line"
          />
        ) : (
          <span className="grid h-5 w-5 place-items-center rounded-full border border-line bg-page font-pixel text-[8px] text-ink">
            {progress.level}
          </span>
        )}
        <span className="hidden font-mono text-[11px] leading-none text-ink-soft sm:inline">
          <span className="text-coin">Lv {progress.level}</span>
          <span className="text-ink-faint"> · {profile?.xp ?? 0} XP</span>
          {streakDays >= 2 && (
            <span data-testid="header-streak" className="text-brand">
              {" · "}
              {streakDays}d streak
            </span>
          )}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg px-2 py-1.5 text-xs font-medium text-ink-faint transition hover:bg-card hover:text-heat"
        title="Sign out"
      >
        Sign out
      </button>
    </div>
  );
}
