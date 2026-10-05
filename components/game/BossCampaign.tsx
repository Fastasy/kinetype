"use client";

// The boss campaign.
//
// The campaign NEEDS an account: a locked/unlocked ladder is meaningless if the
// unlock state vanishes on refresh. So a signed-out visitor gets a sign-in wall
// here, while /play stays fully open to guests.
//
// Lock state is computed from two server facts — the player's level and the set of
// boss ids they have cleared — so it cannot be spoofed from the browser.

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/AuthProvider";
import { BOSSES, bossUnlocked, levelProgress, type Boss } from "@/game/progression";
import { getClearedBossSet } from "@/lib/kinetype-db";

type BossState = "cleared" | "open" | "locked-sequence" | "locked-level";

function stateFor(boss: Boss, level: number, cleared: Set<string>): BossState {
  if (cleared.has(boss.id)) return "cleared";
  if (bossUnlocked(boss, level, cleared)) return "open";
  const idx = BOSSES.findIndex((b) => b.id === boss.id);
  if (level < boss.unlockLevel) return "locked-level";
  void idx;
  return "locked-sequence";
}

export default function BossCampaign() {
  const { configured, ready, userId, profile, profileLoading, signInWithGoogle } = useAuth();
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [authErr, setAuthErr] = useState<string | null>(null);

  /**
   * Start Google sign-in. Anything thrown here is surfaced: a sign-in button that
   * does nothing when it fails is indistinguishable from a dead page.
   */
  const startSignIn = async (next: string) => {
    setAuthErr(null);
    try {
      await signInWithGoogle(next);
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : "Could not start sign-in. Please try again.");
    }
  };

  // Load the cleared set when the player signs in. State is written ONLY in the
  // promise callbacks, never synchronously in the effect body — see the note in
  // LeaderboardBoard for why (React 19's set-state-in-effect rule).
  useEffect(() => {
    if (!userId) return;
    let active = true;
    getClearedBossSet()
      .then((s) => {
        if (!active) return;
        setCleared(s);
        setLoadErr(null);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setLoadErr(e instanceof Error ? e.message : "Could not load your campaign.");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!configured) {
    return (
      <p className="border-2 border-line bg-card/50 px-4 py-6 text-center text-sm text-ink-faint">
        The boss campaign is unavailable right now.
      </p>
    );
  }

  // Wait for the session read before deciding which view to show. Without this the
  // ladder renders for a beat with Level 1 / 0 XP before flipping to the sign-in wall.
  if (!ready) {
    return (
      <p className="border-2 border-line bg-card/40 px-4 py-10 text-center font-mono text-sm text-ink-faint">
        Checking your account…
      </p>
    );
  }

  if (!userId) {
    return (
      <div className="border-2 border-line bg-card/50 px-6 py-12 text-center">
        <h2 className="font-pixel text-sm text-ink">Sign in to fight the bosses</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-faint">
          The campaign tracks which bosses you have beaten and levels you up as you go, so it
          needs an account. Free play stays open to guests — nothing else changes.
        </p>
        <button
          type="button"
          onClick={() => void startSignIn("/bosses")}
          className="mt-6 bg-brand px-6 py-2.5 text-sm font-bold text-page transition hover:bg-brand-bright"
        >
          Sign in with Google
        </button>
        {authErr && <p className="mt-3 font-mono text-xs text-heat">{authErr}</p>}
      </div>
    );
  }

  const xp = profile?.xp ?? 0;
  const level = levelProgress(xp);
  const clearedCount = cleared.size;

  return (
    <div>
      {/* standing */}
      <div className="border-2 border-line bg-card/40 px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className="font-pixel text-sm text-ink">Level {level.level}</span>
            <span className="font-mono text-xs text-coin">{xp.toLocaleString("en-US")} XP</span>
          </div>
          <span className="font-mono text-xs text-ink-faint">
            {clearedCount}/{BOSSES.length} bosses beaten
          </span>
        </div>
        <div className="mt-3 h-3 w-full border border-line bg-page">
          <div
            className="h-full bg-brand transition-[width] duration-500"
            style={{ width: `${Math.round(level.pct * 100)}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[11px] text-ink-faint">
          {profileLoading ? "Loading your progress…" : `${level.remaining} XP to level ${level.level + 1}`}
        </p>
      </div>

      {loadErr && <p className="mt-3 text-sm text-heat">{loadErr}</p>}

      {/* ladder */}
      <ol className="mt-5 space-y-3">
        {BOSSES.map((boss, i) => {
          const st = stateFor(boss, level.level, cleared);
          const isBoss = i === BOSSES.length - 1;
          const locked = st === "locked-sequence" || st === "locked-level";
          return (
            <li
              key={boss.id}
              data-boss={boss.id}
              data-state={st}
              className={`relative border-2 px-4 py-3 transition ${
                st === "cleared"
                  ? "border-coin/50 bg-coin-deep/30"
                  : st === "open"
                    ? "border-brand/60 bg-card/60"
                    : "border-line bg-card/20"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-ink-faint">#{i + 1}</span>
                    <h3 className="font-pixel text-[13px] text-ink">{boss.name}</h3>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-secondary">
                      {boss.title}
                    </span>
                    {isBoss && (
                      <span className="border border-heat/50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-heat">
                        FINAL
                      </span>
                    )}
                    {st === "cleared" && (
                      <span className="border border-coin/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-coin">
                        BEATEN
                      </span>
                    )}
                  </div>
                  <p className={`mt-1.5 max-w-2xl text-sm ${locked ? "text-ink-faint/70" : "text-ink-faint"}`}>
                    {boss.blurb}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-faint">
                    <span>{boss.botWpm} WPM</span>
                    <span>best of {boss.bestOf}</span>
                    <span className="text-coin">+{boss.rewardCoins} coins first clear</span>
                  </p>
                </div>

                <div className="shrink-0">
                  {st === "open" || st === "cleared" ? (
                    <Link
                      href={`/play?boss=${boss.id}`}
                      className={`inline-block px-4 py-2 text-sm font-bold transition ${
                        st === "cleared"
                          ? "border-2 border-line-strong text-ink-soft hover:border-brand hover:text-brand"
                          : "bg-brand text-page hover:bg-brand-bright"
                      }`}
                    >
                      {st === "cleared" ? "Rematch" : "Fight"}
                    </Link>
                  ) : (
                    <span
                      className="inline-block border-2 border-line px-4 py-2 font-mono text-xs text-ink-faint"
                      title={
                        st === "locked-level"
                          ? `Reach level ${boss.unlockLevel} to unlock`
                          : "Beat the previous boss first"
                      }
                    >
                      {st === "locked-level" ? `🔒 Lv ${boss.unlockLevel}` : "🔒 Locked"}
                    </span>
                  )}
                </div>
              </div>
              {st === "locked-sequence" && (
                <p className="mt-1 font-mono text-[10px] text-ink-faint">
                  Beat {BOSSES[i - 1]?.name} to open this fight.
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
