"use client";

// The leaderboard: three windows over one metric (XP / level).
//
// Reads go through the kinetype.leaderboard() RPC, which is SECURITY DEFINER — so
// this works signed OUT too (is_me is simply null then). The board ranks by XP
// earned IN THE WINDOW: today, this ISO week, or all time.
//
// Data-loading note: state is written ONLY inside promise callbacks, never
// synchronously in the effect body, so React 19's set-state-in-effect rule stays
// satisfied. "Loading" is DERIVED (rows === null) rather than stored, which is why
// switching tabs resets by clearing rows in the click handler.

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/AuthProvider";
import { getLeaderboard, type LeaderRow, type LeaderWindow } from "@/lib/kinetype-db";

const TABS: { id: LeaderWindow; label: string; sub: string }[] = [
  { id: "daily", label: "Today", sub: "since 00:00 UTC" },
  { id: "weekly", label: "This week", sub: "since Monday" },
  { id: "overall", label: "All time", sub: "lifetime XP" },
];

export default function LeaderboardBoard() {
  const { configured, ready, userId, signInWithGoogle } = useAuth();
  const [window, setWindow] = useState<LeaderWindow>("overall");
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    getLeaderboard(window, 50)
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Could not load the leaderboard.");
      });
    return () => {
      active = false;
    };
  }, [window, configured]);

  const loading = rows === null && error === null;

  const selectWindow = (w: LeaderWindow) => {
    if (w === window) return;
    setRows(null);
    setError(null);
    setWindow(w);
  };

  if (!configured) {
    return (
      <p className="border-2 border-line bg-card/50 px-4 py-6 text-center text-sm text-ink-faint">
        Leaderboards are unavailable right now.
      </p>
    );
  }

  const myRank = rows?.find((r) => r.is_me)?.rank;

  return (
    <div>
      {/* tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard period">
        {TABS.map((t) => {
          const active = t.id === window;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => selectWindow(t.id)}
              className={`border-2 px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-brand bg-card text-brand"
                  : "border-line bg-transparent text-ink-faint hover:border-brand/40 hover:text-ink-soft"
              }`}
            >
              {t.label}
              <span className="ml-2 font-mono text-[10px] font-normal text-ink-faint">{t.sub}</span>
            </button>
          );
        })}
      </div>

      {/* own standing */}
      {userId && rows && (
        <p className="mt-3 font-mono text-xs text-ink-faint">
          {myRank
            ? `You are rank ${myRank} in this window.`
            : "No XP banked in this window yet — play a match to get on the board."}
        </p>
      )}
      {!userId && ready && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          You are playing as a guest.
          <button
            type="button"
            onClick={() => void signInWithGoogle("/leaderboard")}
            className="border border-line-strong px-2 py-1 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Sign in
          </button>
          to bank XP and appear here.
        </p>
      )}

      {/* board */}
      <div className="mt-5 overflow-x-auto border-2 border-line">
        {loading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-card/30" />
            ))}
          </div>
        ) : error ? (
          <p className="px-4 py-8 text-center text-sm text-heat">{error}</p>
        ) : !rows || rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-faint">
            Nobody has scored in this window yet. Be the first.
          </p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-card/60 text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Player</th>
                <th className="px-3 py-2 text-right font-semibold">Level</th>
                <th className="px-3 py-2 text-right font-semibold">XP</th>
                <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Best WPM</th>
                <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Bosses</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.handle} className={`border-t border-line ${r.is_me ? "bg-brand/10" : ""}`}>
                  <td className="px-3 py-2 font-mono text-sm text-ink-faint">
                    {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
                  </td>
                  <td className="px-3 py-2">
                    {/* The row's name is the way in to a player's profile page. */}
                    <Link
                      href={`/u/${r.handle}`}
                      className="group flex items-center gap-2"
                      title={`${r.display_name ?? "Player"} — profile`}
                    >
                      {r.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-6 w-6 rounded-full border border-line"
                        />
                      ) : (
                        <span className="grid h-6 w-6 place-items-center rounded-full border border-line bg-page font-pixel text-[8px] text-ink">
                          {(r.display_name ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="font-semibold text-ink transition group-hover:text-brand">
                        {r.display_name ?? "Player"}
                        {r.is_me && <span className="ml-2 font-mono text-[10px] text-brand">you</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-ink-soft">{r.level}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-bold text-coin">
                    {r.xp.toLocaleString("en-US")}
                  </td>
                  <td className="hidden px-3 py-2 text-right font-mono text-sm text-ink-soft sm:table-cell">
                    {Math.round(r.best_wpm)}
                  </td>
                  <td className="hidden px-3 py-2 text-right font-mono text-sm text-ink-soft sm:table-cell">
                    {r.bosses_cleared}/9
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-[11px] text-ink-faint">
        Ranked by XP earned in the selected window. XP is awarded per match and scales with your
        WPM, accuracy and win streak; beating a boss the first time pays a one-time bounty.
      </p>
    </div>
  );
}
