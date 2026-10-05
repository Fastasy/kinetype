"use client";

// The sign-in / account control in the header.
//
// Three states, in priority order:
//   1. auth not configured  -> nothing at all (a broken button is worse than none)
//   2. signed out           -> "Sign in with Google"
//   3. signed in            -> level + XP chip, an avatar, and sign out
//
// Level and XP come from the server profile, so this doubles as the player's
// standing-at-a-glance and is deliberately the same number that ranks the board.

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "./AuthProvider";
import { levelProgress } from "@/game/progression";

export default function AuthMenu({ compact = false }: { compact?: boolean }) {
  const { configured, ready, userId, profile, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return null;

  if (!ready) {
    return <span className="h-8 w-20 animate-pulse rounded-lg border border-line bg-card/40" aria-hidden />;
  }

  if (!userId) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await signInWithGoogle();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Sign-in unavailable");
              setBusy(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg border-2 border-line-strong bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-60"
          title={error ?? "Save your progress and climb the leaderboard"}
        >
          <GoogleGlyph />
          {compact ? "Sign in" : "Sign in with Google"}
        </button>
      </div>
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

function GoogleGlyph() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.3z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7l-7.8-6.1C1.1 16.4 0 20.1 0 24s1.1 7.6 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.7-3.8-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
