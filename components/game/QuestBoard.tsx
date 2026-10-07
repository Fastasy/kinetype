"use client";

// The quest board: today's three dailies and this week's two weeklies, with progress.
//
// TWO SOURCES, ON PURPOSE.
//
//   * WHICH quests are on the board comes from game/quests.ts, computed locally from the date. The
//     rotation is a pure function of the day, so this needs no request, works signed out, and
//     cannot disagree with the server — scripts/verify-quests.ts walks both over 400+ days and
//     fails on one quest of drift.
//   * HOW FAR ALONG the player is comes from the server (`my_quests`), because progress is the half
//     that PAYS, and nothing that pays can be decided in a browser.
//
// So a guest sees the real board and the real rewards, with no progress — which is honest, because
// a guest genuinely has none: quest rewards land on an account.
//
// THE DATE IS READ IN AN EFFECT, NEVER DURING RENDER. `new Date()` on the server and in the browser
// can straddle a UTC midnight, and a rotating board is exactly the kind of value that would render
// differently and trip a hydration mismatch — a bug that already bit this site once. One frame of
// skeleton is the price, and it is cheaper than the bug.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { signInHref, useAuth } from "@/components/auth/AuthProvider";
import { getMyQuests, type QuestStatus } from "@/lib/kinetype-db";
import { supabaseConfigured } from "@/lib/supabase";
import {
  activeQuests,
  periodEnd,
  type QuestDef,
  type QuestScope,
  type QuestTier,
} from "@/game/quests";

const TIER_STYLE: Record<QuestTier, { label: string; chip: string; bar: string }> = {
  easy:   { label: "EASY",   chip: "border-aqua/60 text-aqua",                 bar: "bg-aqua" },
  medium: { label: "MEDIUM", chip: "border-brand-bright/60 text-brand-soft",   bar: "bg-brand-bright" },
  hard:   { label: "HARD",   chip: "border-heat/60 text-heat",                 bar: "bg-heat" },
};

const WEEKLY_STYLE = { label: "WEEKLY", chip: "border-coin/60 text-coin", bar: "bg-coin" };

/**
 * A ticking clock, read one frame late so the server and client never disagree about the date.
 * Re-ticks on an interval so the countdown stays honest and the board turns over on its own at
 * midnight UTC without a reload.
 */
function useUtcNow(periodMs: number): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) setNow(new Date());
    };
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, periodMs);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [periodMs]);
  return now;
}

/** "6h 23m", "2d 4h", "48m". Coarse on purpose: nobody needs the seconds on a quest reset. */
function tillReset(from: Date, to: Date): string {
  const ms = Math.max(0, to.getTime() - from.getTime());
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

function QuestCard({
  def,
  status,
  signedIn,
}: {
  def: QuestDef;
  status: QuestStatus | null;
  signedIn: boolean;
}) {
  const style = def.tier ? TIER_STYLE[def.tier] : WEEKLY_STYLE;
  // A claimed quest is done whatever the progress says; a completed-but-unclaimed one can only
  // exist for the instant between the match landing and the next fetch.
  const claimed = Boolean(status?.claimed);
  const complete = claimed || Boolean(status?.completed);
  // RAW is what the server derived and may overshoot the target (five clean wins against a target
  // of one). SHOWN is clamped, so the number and the bar never disagree — "5/1" next to a full bar
  // reads as a bug. The raw value stays on `data-progress` for the probes, and CLAIMED already says
  // the quest is done, so nothing is hidden by the clamp.
  const raw = status ? status.progress : 0;
  const shown = Math.min(raw, def.target);
  const pct = Math.max(0, Math.min(100, Math.round((shown / def.target) * 100)));

  return (
    <li
      data-testid="quest-card"
      data-quest-id={def.id}
      data-tier={def.tier ?? "weekly"}
      data-progress={status ? status.progress : ""}
      data-target={def.target}
      data-complete={complete ? "1" : "0"}
      data-claimed={claimed ? "1" : "0"}
      className={`border-2 bg-card/50 p-3 transition ${
        complete ? "border-coin/50" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-block border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider ${style.chip}`}
          >
            {style.label}
          </span>
          <h3 className="mt-1.5 font-pixel text-xs text-ink sm:text-sm">{def.title}</h3>
          <p className="mt-1 text-[11px] leading-snug text-ink-faint">{def.detail}</p>
        </div>
        <span className="shrink-0 whitespace-nowrap text-right font-mono text-[10px] leading-tight text-coin">
          +{def.rewardXp} XP
          <br />
          +{def.rewardCoins}c
        </span>
      </div>

      <div className="mt-2.5">
        <div
          role="progressbar"
          aria-label={`${def.title} progress`}
          aria-valuemin={0}
          aria-valuemax={def.target}
          aria-valuenow={signedIn ? shown : 0}
          className="h-2 w-full overflow-hidden border border-line bg-page"
        >
          <span
            data-testid="quest-bar"
            className={`block h-full ${complete ? "bg-coin" : style.bar}`}
            style={{ width: `${signedIn ? pct : 0}%` }}
          />
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[10px]">
          <span className="text-ink-faint">
            {signedIn ? (
              <>
                <span className="text-ink-soft" data-testid="quest-progress">
                  {shown}
                </span>
                /{def.target}
              </>
            ) : (
              <>—/{def.target}</>
            )}
          </span>
          {claimed ? (
            <span data-testid="quest-claimed" className="font-bold tracking-wider text-coin">
              CLAIMED
            </span>
          ) : complete ? (
            <span className="font-bold tracking-wider text-coin">DONE</span>
          ) : (
            <span className="text-ink-faint">in progress</span>
          )}
        </div>
      </div>
    </li>
  );
}

function Section({
  title,
  blurb,
  reset,
  quests,
  statusFor,
  signedIn,
}: {
  title: string;
  blurb: string;
  reset: string;
  quests: QuestDef[];
  statusFor: (id: string) => QuestStatus | null;
  signedIn: boolean;
}) {
  return (
    <section aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-pixel text-sm text-ink">{title}</h2>
        <p className="font-mono text-[11px] text-ink-faint">
          {blurb} · resets in <span className="text-ink-soft">{reset}</span>
        </p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {quests.map((q) => (
          <QuestCard key={q.id} def={q} status={statusFor(q.id)} signedIn={signedIn} />
        ))}
      </ul>
    </section>
  );
}

export default function QuestBoard() {
  const now = useUtcNow(30_000);
  const { configured: authConfigured, ready: authReady, userId, profile } = useAuth();
  const [status, setStatus] = useState<QuestStatus[] | null>(null);
  const [failed, setFailed] = useState(false);

  // Profile XP and coins are the change signal, not a timer: every banked match (and every quest
  // that paid) moves one of them, so this refetches exactly when the answer could have changed —
  // and never in between.
  const xpSignal = profile?.xp ?? null;
  const coinsSignal = profile?.coins ?? null;

  useEffect(() => {
    let cancelled = false;
    const done = (rows: QuestStatus[] | null, error: boolean) => {
      if (cancelled) return;
      setStatus(rows);
      setFailed(error);
    };

    if (!supabaseConfigured || !userId) {
      // Deferred so nothing is written to state synchronously inside the effect body (React 19's
      // set-state-in-effect rule) — the same pattern ProfileView uses.
      void Promise.resolve().then(() => done(null, false));
      return () => {
        cancelled = true;
      };
    }

    void getMyQuests()
      .then((rows) => done(rows, false))
      .catch((err) => {
        console.error("[kinetype] quest load failed:", err);
        done(null, true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, xpSignal, coinsSignal]);

  const board = useMemo(() => (now ? activeQuests(now) : null), [now]);

  const signedIn = Boolean(userId);
  const statusFor = useMemo(() => {
    const byId = new Map((status ?? []).map((s) => [s.quest_id, s]));
    return (id: string) => byId.get(id) ?? null;
  }, [status]);

  if (!board || !now) {
    return (
      <section id="quests" aria-label="Quests" data-testid="quests" data-state="loading">
        <h2 className="font-pixel text-sm text-ink">Quests</h2>
        <p className="mt-3 border-2 border-line bg-card/50 px-4 py-6 text-center font-mono text-xs text-ink-faint">
          Loading today&apos;s quests…
        </p>
      </section>
    );
  }

  const scopeOf = (scope: QuestScope) => board.filter((q) => q.scope === scope);
  const showSignIn = authConfigured && authReady && !userId;

  return (
    <section id="quests" aria-labelledby="quests-heading" data-testid="quests" data-state="ready">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="quests-heading" className="font-pixel text-sm text-ink sm:text-base">
          Quests
        </h2>
        <p className="font-mono text-[11px] text-ink-faint">
          New set every day. Three dailies, two weeklies, paid the moment you finish them.
        </p>
      </div>

      <div className="mt-4 space-y-6">
        <Section
          title="Today"
          blurb="One easy, one medium, one hard"
          reset={tillReset(now, periodEnd(now, "daily"))}
          quests={scopeOf("daily")}
          statusFor={statusFor}
          signedIn={signedIn}
        />
        <Section
          title="This week"
          blurb="Two at a time"
          reset={tillReset(now, periodEnd(now, "weekly"))}
          quests={scopeOf("weekly")}
          statusFor={statusFor}
          signedIn={signedIn}
        />
      </div>

      {showSignIn && (
        <p className="mt-4 flex flex-wrap items-center gap-2 border-2 border-line bg-card/50 px-3 py-2.5 text-xs text-ink-faint">
          <span>
            Quest rewards pay into an account — bonus XP and coins for every one you clear. You can
            keep playing as a guest either way.
          </span>
          <Link
            href={signInHref("/play")}
            className="border border-line-strong px-2 py-1 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Sign in to bank them
          </Link>
        </p>
      )}

      {failed && (
        <p className="mt-4 font-mono text-xs text-heat">
          Could not load your quest progress. Play a match and it will try again.
        </p>
      )}
    </section>
  );
}
