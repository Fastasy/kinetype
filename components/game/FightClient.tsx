"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import PromptCard from "./PromptCard";
import { BOT_WPM_LADDER } from "@/game/constants";
import { GameEngine, type Snapshot } from "@/game/engine";
import { botConfigForTier } from "@/game/bot";
import { freshSeed } from "@/game/rng";
import { overlayById, RARITY_LABEL, skinById } from "@/game/skins";
import { applyOutcome } from "@/game/storage";
import { saveStore } from "@/game/store";
import type { MatchResult, Side } from "@/game/types";

type PlayerSide = Side;
/**
 * idle     = intro over a live arena preview
 * fighting = the match is running
 * over     = result panel, arena still visible
 *
 * This replaced a single `running` boolean, which could not express "finished":
 * the result panel was gated behind `!running`, so it never appeared and a
 * completed match looked like a frozen game waiting for input.
 */
type Stage = "idle" | "fighting" | "over";

export default function FightClient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const previewRef = useRef<GameEngine | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  // External store rather than an effect: it is hydration safe and does not trip
  // React 19's set-state-in-effect rule. See game/store.ts.
  const save = useSyncExternalStore(
    saveStore.subscribe,
    saveStore.getSnapshot,
    saveStore.getServerSnapshot,
  );
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [playerSide, setPlayerSide] = useState<PlayerSide>("left");
  const muted = save.muted;

  const overlay = useMemo(() => overlayById(save.equippedOverlay), [save.equippedOverlay]);
  const playerSkin = useMemo(() => skinById(save.equippedSkin), [save.equippedSkin]);

  // Draw the arena behind the intro rather than opening on an empty black box.
  // The engine is created paused and never stepped, so nothing moves until the
  // player presses start.
  useEffect(() => {
    if (stage !== "idle") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(
      canvas,
      {
        botWpm: save.botWpm,
        strictMode: save.strictMode,
        skins: { left: save.equippedSkin, right: "ember" },
        overlayId: save.equippedOverlay,
        muted: true,
        streakBefore: 0,
        humanSide: "left",
        seed: 20260928,
      },
      {},
    );
    engine.resize();
    engine.startPreview();
    previewRef.current = engine;

    return () => {
      engine.destroy();
      if (previewRef.current === engine) previewRef.current = null;
    };
  }, [stage, save.botWpm, save.strictMode, save.equippedOverlay, save.equippedSkin]);

  const stop = useCallback(() => {
    engineRef.current?.destroy();
    engineRef.current = null;
    setStage("idle");
    setSnap(null);
  }, []);

  const start = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current?.destroy();
    setResult(null);
    setSnap(null);

    const botSkinId = playerSide === "left" ? "ember" : "spark";
    const engine = new GameEngine(
      canvas,
      {
        botWpm: save.botWpm,
        strictMode: save.strictMode,
        skins: {
          left: playerSide === "left" ? save.equippedSkin : botSkinId,
          right: playerSide === "right" ? save.equippedSkin : botSkinId,
        },
        overlayId: save.equippedOverlay,
        muted: save.muted,
        streakBefore: save.streak,
        humanSide: playerSide,
        seed: freshSeed(),
      },
      {
        onSnapshot: setSnap,
        onEnd: (r) => {
          setResult(r);
          setStage("over");
          saveStore.update((prev) => applyOutcome(prev, r));
        },
      },
    );
    engineRef.current = engine;
    engine.resize();
    void engine.start();
    setStage("fighting");
    // Bring the arena to the top of the viewport. The prompts sit below the canvas
    // and a typing game is unplayable if you have to scroll to read your own words.
    sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [playerSide, save.botWpm, save.equippedOverlay, save.equippedSkin, save.muted, save.streak, save.strictMode]);

  // Keyboard is the whole game. Space and arrows are swallowed so the page cannot
  // scroll mid-match.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " || e.key === "Tab" || e.key.startsWith("Arrow")) {
        e.preventDefault();
        return;
      }
      if (engine.handleKey(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the canvas matched to its box.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const ro = new ResizeObserver(() => engineRef.current?.resize());
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => engineRef.current?.destroy(), []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    engineRef.current?.setMuted(next);
    saveStore.update((prev) => ({ ...prev, muted: next }));
  }, [muted]);

  const setDifficulty = useCallback((wpm: number) => {
    saveStore.update((prev) => ({ ...prev, botWpm: wpm }));
  }, []);

  const setStrict = useCallback((strict: boolean) => {
    saveStore.update((prev) => ({ ...prev, strictMode: strict }));
  }, []);

  const bot = botConfigForTier(BOT_WPM_LADDER.indexOf(save.botWpm as (typeof BOT_WPM_LADDER)[number]));

  const opponent: Side = playerSide === "left" ? "right" : "left";
  const me = snap ? snap[playerSide] : null;
  const them = snap ? snap[opponent] : null;

  return (
    <section ref={sectionRef} className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* ---------------------------------------------------------- controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-zinc-400">Bot speed</span>
            <select
              value={save.botWpm}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-100"
              aria-label="Bot typing speed in words per minute"
            >
              {BOT_WPM_LADDER.map((w) => (
                <option key={w} value={w}>
                  {w} WPM
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-zinc-400">Your side</span>
            <select
              value={playerSide}
              onChange={(e) => setPlayerSide(e.target.value as PlayerSide)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-100"
              aria-label="Which side you fight from"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-zinc-400">
            <input
              type="checkbox"
              checked={save.strictMode}
              onChange={(e) => setStrict(e.target.checked)}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            Strict mistakes
          </label>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 transition hover:border-emerald-500/50 hover:text-emerald-400"
            aria-pressed={muted}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-400">
            <span className="text-amber-400">{save.coins.toLocaleString("en-US")}</span> coins
          </span>
          {stage === "fighting" ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-xl border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-200 transition hover:border-rose-500/60 hover:text-rose-300"
            >
              Quit
            </button>
          ) : (
            <button
              type="button"
              data-testid="fight-button"
              onClick={start}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
            >
              {stage === "over" ? "Fight again" : "Fight"}
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- opponent */}
      {stage === "fighting" && them && (
        <div
          data-testid="bot-panel"
          className="mt-3 rounded-2xl border border-zinc-800/80 px-3 py-2"
          style={{ background: overlay.panel }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-zinc-300">BOT</span>
              <span
                data-testid="bot-damage"
                data-value={them.damage}
                className="font-mono text-xs"
                style={{ color: them.damage >= 30 ? "#facc15" : "#a1a1aa" }}
              >
                {Math.round(them.damage)}%
              </span>
              <span
                data-testid="bot-wpm"
                data-value={them.wpm}
                className="font-mono text-[10px] text-zinc-500"
              >
                {them.wpm} WPM
              </span>
              {snap?.telegraph[opponent] && (
                <span className="rounded border border-rose-500/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-400">
                  HEAVY INCOMING
                </span>
              )}
              {them.guardOffered && (
                <span className="rounded border border-sky-500/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-400">
                  BOT PARRYING
                </span>
              )}
              {them.hitCooldown > 0 && (
                <span
                  data-testid="bot-cooldown"
                  title="You cannot land another hit for a moment. Use it to line up a heavy word."
                  className="rounded border border-zinc-600/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                >
                  NOT HITTABLE YET
                </span>
              )}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              round {snap?.round} · {snap?.wins[playerSide]}-{snap?.wins[opponent]}
            </span>
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {them.prompts.map((p, i) => (
              <PromptCard
                key={p.id}
                prompt={p}
                overlay={overlay}
                compact
                slot={i}
                isGuard={p.kind === "guard"}
                isRecovery={p.kind === "recovery"}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- the fight */}
      <div className="relative mt-3 overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        {/* The 58vh cap keeps the bot panel, the arena and the player's prompts all
            inside one screenful on a laptop. Without it the prompts fell below the
            fold and the game could not be played. */}
        <div
          className="relative mx-auto aspect-[16/9] w-full"
          style={{ maxWidth: "min(100%, calc(58vh * 16 / 9))" }}
        >
          <canvas ref={canvasRef} className="block h-full w-full" aria-label="Typing fight arena" />

          {stage === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/92 px-6 text-center">
              <h2 className="font-mono text-2xl font-bold text-zinc-100 sm:text-3xl">
                Type to knock them off
              </h2>
              <p className="max-w-md text-sm text-zinc-400">
                Three words are live. Type one to hit. Long words hit harder, but they take
                longer to land. Push the bot past the red line to win.
              </p>
              <ul className="max-w-md space-y-1 text-left text-xs text-zinc-400">
                <li>
                  <span className="font-mono text-emerald-400">1 2 3</span> pick a word, or just
                  start typing one
                </li>
                <li>
                  <span className="font-mono text-rose-400">HEAVY INCOMING</span> means a big hit is
                  coming: complete the <span className="font-mono text-sky-400">GUARD</span> word to
                  parry it
                </li>
                <li>
                  pushed off the edge? You get one <span className="font-mono text-amber-400">SAVE</span>{" "}
                  word to climb back
                </li>
              </ul>
              <button
                type="button"
                data-testid="start-overlay"
                onClick={start}
                className="mt-1 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
              >
                Start the fight
              </button>
              <p className="text-[11px] text-zinc-600">
                Needs a physical keyboard. Best on a laptop or desktop.
              </p>
            </div>
          )}

          {stage === "fighting" && snap?.phase === "countdown" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-6xl font-black text-zinc-100 drop-shadow-lg">
                {Math.ceil(snap.countdown)}
              </span>
            </div>
          )}

          {stage === "fighting" && snap?.phase === "finish" && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
              <span className="animate-pulse rounded-lg border border-rose-500/60 bg-rose-950/70 px-3 py-1 font-mono text-sm font-black tracking-widest text-rose-300">
                FINISH
              </span>
            </div>
          )}

          {stage === "fighting" && me?.recovering && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-400/70 bg-amber-950/80 px-4 py-2 text-center">
              <div className="font-mono text-sm font-bold text-amber-300">TYPE THE SAVE WORD</div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- player */}
      {stage === "fighting" && me && (
        <div
          data-testid="player-panel"
          className="mt-3 rounded-2xl border border-emerald-800/40 px-3 py-3"
          style={{ background: overlay.panel }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-emerald-400">YOU</span>
              <span
                data-testid="player-damage"
                data-value={me.damage}
                className="font-mono text-lg font-bold"
                style={{
                  color:
                    me.damage >= 150 ? "#3f0d0d" : me.damage >= 100 ? "#ef4444" : me.damage >= 60 ? "#fb923c" : me.damage >= 30 ? "#facc15" : "#f4f4f5",
                }}
              >
                {Math.round(me.damage)}%
              </span>
              <span data-testid="player-wpm" data-value={me.wpm} className="font-mono text-xs text-zinc-400">
                {me.wpm} WPM
              </span>
              <span className="font-mono text-xs text-zinc-500">{me.accuracy.toFixed(1)}% acc</span>
              {me.counter > 0 && (
                <span className="rounded border border-emerald-400/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  COUNTER READY
                </span>
              )}
              {me.invuln > 0 && (
                <span className="rounded border border-zinc-500/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                  INVULNERABLE
                </span>
              )}
              {me.hitCooldown > 0 && (
                <span
                  data-testid="player-cooldown"
                  title="You cannot be hit for a moment. Type while it lasts."
                  className="rounded border border-zinc-600/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                >
                  BRIEFLY SAFE
                </span>
              )}
            </div>
            <span className="font-mono text-xs text-zinc-500">
              {Math.ceil(snap?.roundTimer ?? 0)}s left in round
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {me.prompts.map((p, i) => (
              <PromptCard
                key={p.id}
                prompt={p}
                overlay={overlay}
                slot={i}
                isGuard={p.kind === "guard"}
                isRecovery={p.kind === "recovery"}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- result */}
      {stage === "over" && result && (
        <div
          data-testid="result"
          data-won={result.humanWon ? "1" : "0"}
          data-coins={result.coins}
          data-wpm={result.wpm}
          className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4"
        >
          <div className="flex flex-wrap items-baseline gap-3">
            <span
              className={`font-mono text-xl font-black ${
                result.humanWon ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {result.humanWon ? "WIN" : "LOSS"}
            </span>
            <span className="font-mono text-sm text-zinc-400">
              rounds {result.roundsWon}-{result.roundsLost}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "Coins", v: `+${result.coins}` },
              { k: "WPM", v: `${result.wpm}` },
              { k: "Accuracy", v: `${result.accuracy.toFixed(1)}%` },
              { k: streakLabel(result.streak), v: `${save.bestWpm}` },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">{s.k}</div>
                <div className="font-mono text-lg font-bold text-zinc-100">{s.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link
              href="/shop"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 font-semibold text-zinc-200 transition hover:border-emerald-500/60 hover:text-emerald-400"
            >
              Spend coins in the shop
            </Link>
            <Link
              href="/how-to-play"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 font-semibold text-zinc-200 transition hover:border-emerald-500/60 hover:text-emerald-400"
            >
              Strategy guide
            </Link>
            {result.humanWon && save.streak > 1 && (
              <span className="rounded-lg bg-amber-500/10 px-3 py-1.5 font-mono text-amber-300">
                {save.streak} win streak
              </span>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- footer strip */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>
          Wearing <span className="font-mono text-zinc-300">{playerSkin.name}</span> (
          {RARITY_LABEL[playerSkin.rarity]}) · bot at{" "}
          <span className="font-mono text-zinc-300">{save.botWpm} WPM</span> (
          {Math.round(bot.accuracy * 100)}% accuracy)
        </span>
        {save.matches > 0 && (
          <span className="font-mono">
            {save.wins}W-{save.losses}L · best {save.bestWpm} WPM · best streak {save.bestStreak}
          </span>
        )}
      </div>
    </section>
  );
}

function streakLabel(streak: number): string {
  return streak > 0 ? `Streak ${streak}` : "Best WPM";
}
