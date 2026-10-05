"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/AuthProvider";
import { getClearedBossSet, submitMatch } from "@/lib/kinetype-db";
import { track } from "@/lib/analytics";
import type { Boss } from "@/game/progression";
import PromptCard from "./PromptCard";
import { BOT_WPM_LADDER, COMBO_FIRE_CHAIN, COMBO_MAX_STEPS, COMBO_STEP } from "@/game/constants";
import { comboSteps } from "@/game/combo";
import { GameEngine, type Snapshot } from "@/game/engine";
import { botConfigForTier } from "@/game/bot";
import { freshSeed } from "@/game/rng";
import { OPPONENT_SKIN_ID, RARITY_LABEL, skinById } from "@/game/skins";
import { themeById } from "@/game/themes";
import { DEFAULT_MAP_ID } from "@/game/maps";
import { applyOutcome } from "@/game/storage";
import { saveStore } from "@/game/store";
import type { MatchResult, Side } from "@/game/types";

type PlayerSide = Side;
/**
 * idle = intro over a live arena preview
 * fighting = the match is running
 * over = result panel, arena still visible
 *
 * This replaced a single `running` boolean, which could not express "finished":
 * the result panel was gated behind `!running`, so it never appeared and a
 * completed match looked like a frozen game waiting for input.
 */
type Stage = "idle" | "fighting" | "over";

/**
 * The opponent always wears a different skin from the player. Without this,
 * equipping Ember (the default opponent skin) puts two identical fighters in the
 * arena and you can no longer tell which one is yours.
 */
const SKIN_CLASH_FALLBACK = "voidwing";
function opponentSkinFor(playerSkin: string): string {
 return playerSkin === OPPONENT_SKIN_ID ? SKIN_CLASH_FALLBACK : OPPONENT_SKIN_ID;
}

/**
 * The "on fire" colour for a maxed chain. FIXED, like the move chips in PromptCard: it means
 * one specific thing and must not be restyled by a theme, or a player who switches theme has
 * to relearn what the hottest state looks like. Gold, because the coin chips already taught
 * the eye that gold means "this is worth something".
 */
const COMBO_FIRE = "#facc15";

/**
 * `wide` is used on the dedicated /play page, where the arena IS the page and can
 * claim more vertical space. The landing page no longer embeds this at all.
 */
export default function FightClient({ wide = false, boss }: { wide?: boolean; boss?: Boss }) {
 const canvasRef = useRef<HTMLCanvasElement | null>(null);
 const engineRef = useRef<GameEngine | null>(null);
 const previewRef = useRef<GameEngine | null>(null);
 const sectionRef = useRef<HTMLElement | null>(null);
 const [isFullscreen, setIsFullscreen] = useState(false);

 /** Fullscreens the whole fight section, panels included, so the prompts stay visible. */
 const toggleFullscreen = useCallback(() => {
   if (typeof document === "undefined") return;
   if (document.fullscreenElement) {
     void document.exitFullscreen();
     return;
   }
   const el = sectionRef.current;
   if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
 }, []);

 useEffect(() => {
   const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
   document.addEventListener("fullscreenchange", onChange);
   return () => document.removeEventListener("fullscreenchange", onChange);
 }, []);
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
 /**
 * The keydown listener lives on `window`, so it only fires when the game's document has
 * focus. Embedded in an iframe, or after clicking anything outside the arena, that focus is
 * not guaranteed and typing silently does nothing — the first version of this shipped with
 * no focus handling at all and looked completely broken for exactly that reason.
 */
 // Whether the WINDOW holds focus. This — not "has a keystroke landed" — is what gates
// the "click here to start typing" guard. Gating on the first keystroke left the scrim sitting
// over the arena for the whole round countdown, so the timer drew underneath the message and the
// two overlaid on top of each other. Ruan: "make the message dissapear once the box is focused."
// Focus is also the honest signal: it is precisely the condition under which keystrokes reach
// the game, whereas a player who is focused but silent needs no warning at all.
const [focused, setFocused] = useState(false);
 const muted = save.muted;

 // ---- accounts / boss campaign -------------------------------------------------
 const { configured: authConfigured, ready: authReady, userId, profile, signInWithGoogle, adoptProfile } = useAuth();
 /** Set when a match has been banked server-side, for the earned-this-match line. */
 const [banked, setBanked] = useState<{
   gained: number;
   level: number;
   xp: number;
   coins: number;
   streakDays: number;
   firstWin: boolean;
 } | null>(null);
 const [bankErr, setBankErr] = useState<string | null>(null);
 /** Bosses already beaten, so a first clear can pay its coin reward exactly once. */
 const [clearedBosses, setClearedBosses] = useState<Set<string>>(new Set());
 const clearedRef = useRef<Set<string>>(new Set());
 /** XP at the last server sync, so a payout can be shown as a delta. */
 const lastXpRef = useRef(0);
 useEffect(() => {
   clearedRef.current = clearedBosses;
 }, [clearedBosses]);
 useEffect(() => {
   if (profile) lastXpRef.current = profile.xp;
 }, [profile]);

 // Boss mode needs the cleared set loaded up front so that the FIRST clear is
 // recognised (and its coin bounty paid) rather than a second one.
 useEffect(() => {
   if (!boss || !userId) return;
   let active = true;
   void getClearedBossSet()
     .then((s) => { if (active) setClearedBosses(s); })
     .catch(() => {});
   return () => { active = false; };
 }, [boss, userId]);

 /** Surfaced sign-in failure, so the gate's button never silently does nothing. */
 const [authErr, setAuthErr] = useState<string | null>(null);
 const startSignIn = async (next: string) => {
   setAuthErr(null);
   try {
     await signInWithGoogle(next);
   } catch (e) {
     setAuthErr(e instanceof Error ? e.message : "Could not start sign-in. Please try again.");
   }
 };

 // Boss mode is account-only: the unlock ladder must persist. Guests can still play
 // free play, and /bosses sends them here only after they sign in.
 const bossBlocked = Boolean(boss) && authConfigured && authReady && !userId;

 // In boss mode the bot's speed IS the boss's; the free-play picker is ignored.
 const botWpmInPlay = boss ? boss.botWpm : save.botWpm;

 const theme = useMemo(() => themeById(save.equippedTheme), [save.equippedTheme]);
 // The arena belongs to the BOSS, not to a cosmetic: each boss fights in its own place and free
 // play keeps the training ground. Nothing about it is unlockable, so it needs no stored state.
 const arenaMapId = boss ? boss.mapId : DEFAULT_MAP_ID;
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
 botWpm: botWpmInPlay,
 strictMode: save.strictMode,
 skins: { left: save.equippedSkin, right: opponentSkinFor(save.equippedSkin) },
 themeId: save.equippedTheme,
 mapId: arenaMapId,
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
 }, [stage, botWpmInPlay, save.strictMode, save.equippedTheme, save.equippedSkin, arenaMapId]);

 /**
  * Bank a finished match server-side. A no-op for guests, so free play is untouched.
  *
  * The server recomputes XP from clamped inputs and refuses to pay a boss first-clear
  * bounty twice, so the coin reward below is paid off the SAME clear the server
  * recorded — replaying the client cannot farm it.
  */
 const bankMatch = useCallback(async (r: MatchResult) => {
   if (!authConfigured || !userId) return;
   const wasFirstClear = Boolean(boss) && !clearedRef.current.has(boss!.id);
   try {
     setBankErr(null);
     const updated = await submitMatch({
       mode: boss ? "boss" : "free",
       bossId: boss?.id ?? null,
       botWpm: botWpmInPlay,
       won: r.humanWon,
       wpm: r.wpm,
       accuracy: r.accuracy,
       bestCombo: r.bestCombo,
       roundsWon: r.roundsWon,
       roundsLost: r.roundsLost,
       streak: r.streak,
     });
     if (updated) {
       // Earned THIS match, from server truth: the balance after, minus the one the header was
       // already showing. Read live from the store rather than a captured render value — the daily
       // bonuses are inside this number, which is why the first win of the day reads visibly bigger
       // than the next one.
       const coinsEarned = Math.max(0, updated.coins - saveStore.getSnapshot().coins);
       const today = new Date().toISOString().slice(0, 10);
       setBanked({
         gained: Math.max(0, updated.xp - lastXpRef.current),
         level: updated.level,
         xp: updated.xp,
         coins: coinsEarned,
         streakDays: updated.streak_days,
         firstWin: r.humanWon && updated.first_win_on === today,
       });
       lastXpRef.current = updated.xp;
       // ONE path from server truth to the UI: adopting this row updates the header's level and XP
       // AND pushes the server's coin balance into the local store mirror, so the shop and the coin
       // chip agree with the account without a second request.
       adoptProfile(updated);
     }
     if (wasFirstClear && r.humanWon && boss) {
       // The bounty is paid SERVER-side inside submit_match(). Adding rewardCoins here as well
       // would pay it twice.
       setClearedBosses((prev) => new Set(prev).add(boss.id));
     }
   } catch (e) {
     setBankErr(e instanceof Error ? e.message : "Could not save your match.");
   }
 }, [authConfigured, userId, boss, botWpmInPlay, adoptProfile]);

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

 // Funnel top: someone actually chose to fight, rather than just landing on /play.
 track("game_start", {
   mode: boss ? "boss" : "free",
   boss_id: boss?.id ?? null,
   bot_wpm: botWpmInPlay,
   signed_in: Boolean(userId),
 });

 const botSkinId = opponentSkinFor(save.equippedSkin);
 const engine = new GameEngine(
 canvas,
 {
 botWpm: botWpmInPlay,
 strictMode: save.strictMode,
 skins: {
 left: playerSide === "left" ? save.equippedSkin : botSkinId,
 right: playerSide === "right" ? save.equippedSkin : botSkinId,
 },
 themeId: save.equippedTheme,
 mapId: arenaMapId,
 muted: save.muted,
 streakBefore: save.streak,
 humanSide: playerSide,
 seed: freshSeed(),
 bestOf: boss?.bestOf ?? 3,
 },
 {
 onSnapshot: setSnap,
 onEnd: (r) => {
   setResult(r);
   setStage("over");
   saveStore.update((prev) => {
     const next = applyOutcome(prev, r);
     // Signed in? The ACCOUNT owns the coin balance, so the local formula must not add to it —
     // bankMatch adopts the server's authoritative total. Everything else applyOutcome touches
     // (bests, streak, the local match count) still updates, because it drives play on THIS device.
     return userId ? { ...next, coins: prev.coins } : next;
   });
   // Funnel bottom: a full match. `bot_wpm` next to `won` is what shows
   // whether the difficulty ladder is actually calibrated to real players.
   track("match_end", {
     mode: boss ? "boss" : "free",
     boss_id: boss?.id ?? null,
     bot_wpm: botWpmInPlay,
     won: r.humanWon,
     wpm: r.wpm,
     accuracy: r.accuracy,
     best_combo: r.bestCombo,
     rounds_won: r.roundsWon,
     rounds_lost: r.roundsLost,
     signed_in: Boolean(userId),
   });
   void bankMatch(r);
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
 // Take keyboard focus explicitly. Clicking the start button does not leave focus
 // anywhere useful once that button unmounts.
 window.requestAnimationFrame(() => canvas.focus());
 }, [playerSide, botWpmInPlay, boss, bankMatch, save.equippedTheme, save.equippedSkin, save.muted, save.streak, save.strictMode, userId, arenaMapId]);

 // Keyboard is the whole game. Space and arrows are swallowed so the page cannot
 // scroll mid-match.
 useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
  const engine = engineRef.current;
  if (!engine) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  // Escape quits the match, which is what /play and the strategy page promise. It is
  // ignored while the fight section is fullscreen: there Escape belongs to the browser,
  // and a player leaving fullscreen should not also lose their match.
  if (e.key === "Escape") {
    if (!document.fullscreenElement) stop();
    return;
  }
  if (e.key === "Tab" || e.key.startsWith("Arrow")) {
  e.preventDefault();
  return;
  }
  // SPACE IS A GAME KEY, not a page-scroll key. It used to be swallowed here with the
  // arrows, back when the typing layer skipped separators entirely. It is now the key
  // between every pair of words, so it must reach the engine — preventDefault still
  // fires, because a stray space must never scroll the page mid-fight.
  if (engine.handleKey(e.key)) e.preventDefault();
};
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
 }, [stop]);

 // The "has a keystroke landed?" listener that used to live here is gone. It existed only to
 // feed the focus guard; that guard is now driven by WINDOW focus instead. A listener with no reader is dead
 // code, and leaving it would have kept the misleading idea that input, not focus, is the gate.
 //
 // WINDOW focus drives the guard — NOT canvas focus. Keystrokes still arrive while a button holds
 // focus inside the page, so gating on the canvas made the guard reappear the moment the player
 // clicked Fullscreen, re-scrimming the arena mid-round. See the effect below.

 // Window focus, sampled on mount and on every focus/blur. `setTimeout(…, 0)` keeps the first
 // setState out of the effect body (React 19's set-state-in-effect rule).
 useEffect(() => {
 let cancelled = false;
 const sync = () => {
 if (!cancelled) setFocused(document.hasFocus());
 };
 const onFocus = () => {
 if (!cancelled) setFocused(true);
 };
 const onBlur = () => {
 if (!cancelled) setFocused(false);
 };
 const t = window.setTimeout(sync, 0);
 window.addEventListener("focus", onFocus);
 window.addEventListener("blur", onBlur);
 return () => {
 cancelled = true;
 window.clearTimeout(t);
 window.removeEventListener("focus", onFocus);
 window.removeEventListener("blur", onBlur);
 };
 }, []);

 // Lock page scrolling while fullscreen. The document behind is ~100px taller than the
 // viewport, so the page CAN scroll; in fullscreen that drags the section up and exposes the
 // browser's black backdrop — the "black spaces" after a match, when space or a button steals
 // focus. Nothing in here needs to scroll.
 useEffect(() => {
 if (!isFullscreen) return;
 const root = document.documentElement;
 const body = document.body;
 const prevRoot = root.style.overflow;
 const prevBody = body.style.overflow;
 root.style.overflow = "hidden";
 body.style.overflow = "hidden";
 return () => {
 root.style.overflow = prevRoot;
 body.style.overflow = prevBody;
 };
 }, [isFullscreen]);

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

 const bot = botConfigForTier(BOT_WPM_LADDER.indexOf(botWpmInPlay as (typeof BOT_WPM_LADDER)[number]));

 const opponent: Side = playerSide === "left" ? "right" : "left";
 const me = snap ? snap[playerSide] : null;
 const them = snap ? snap[opponent] : null;
 /** Colour of the chain: the theme accent while it climbs, gold once it is maxed. */
 const comboColour = me && me.combo >= COMBO_FIRE_CHAIN ? COMBO_FIRE : theme.accent;
 const onFire = !!me && me.combo >= COMBO_FIRE_CHAIN;

 // Boss mode without an account: the unlock ladder cannot persist, so gate here
 // rather than pretend the fight means anything.
 if (bossBlocked && boss) {
   return (
     <section className="mx-auto max-w-md px-4 py-16 text-center" data-testid="boss-gate">
       <h1 className="font-pixel text-base text-ink">{boss.name}</h1>
       <p className="mt-2 font-mono text-xs uppercase tracking-wider text-secondary">{boss.title}</p>
       <p className="mt-4 text-sm text-ink-faint">{boss.blurb}</p>
       <p className="mt-6 text-sm text-ink-faint">
         The boss campaign keeps your progress and level on your account, so it needs you to
         sign in. Free play stays open to everyone.
       </p>
       <button
         type="button"
         onClick={() => void startSignIn(`/play?boss=${boss.id}`)}
         className="mt-6 bg-brand px-6 py-2.5 text-sm font-bold text-page transition hover:bg-brand-bright"
       >
         Sign in with Google
       </button>
       {authErr && <p className="mt-3 font-mono text-xs text-heat">{authErr}</p>}
       <p className="mt-4">
         <Link href="/play" className="text-xs text-ink-faint underline hover:text-ink-soft">
           Play free play instead
         </Link>
       </p>
     </section>
   );
 }

 return (
 <section
   ref={sectionRef}
   data-testid="fight-section"
   // No per-section theme override any more. The equipped theme is written onto <html> by
   // components/ThemeProvider.tsx, so the fight inherits it like every other page — that is the
   // whole point of a WEBSITE theme. The semantic signals (--color-heat, --color-coin,
   // --color-aqua) are still deliberately outside every theme, so a price still reads as a price.
   className={
     isFullscreen
       ? // FULLSCREEN IS A HUD, NOT A PAGE. The arena fills the entire screen and the panels
         // float over it, so the fight scales to the monitor instead of being boxed in by the
         // chrome. `relative` anchors the arena layer; the section carries no padding of its
         // own so the stage can reach every edge.
         "relative mx-auto flex h-screen max-h-screen w-full max-w-none flex-col overflow-hidden bg-page"
       : wide
         ? "mx-auto max-w-6xl px-3 sm:px-4"
         : "mx-auto max-w-5xl px-4 sm:px-6"
   }
 >
 {/* ---------------------------------------------------------- controls */}
 <div
   className={
     isFullscreen
       ? // ORDER MATTERS IN FULLSCREEN. The DOM order is controls · bot · arena · player · footer,
         // but `mt-auto` pushed the player panel and the footer to the bottom, leaving a 1000px hole.
         "relative z-20 order-2 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-card/85 px-4 py-2 backdrop-blur"
       : "flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card/40 px-4 py-3"
   }
 >
 <div className="flex flex-wrap items-center gap-3 text-xs">
 {boss ? (
   <span className="flex items-center gap-2" data-testid="boss-badge" data-boss={boss.id}>
     <span className="text-ink-faint">Boss</span>
     <span className="border border-heat/60 px-2 py-1 font-mono text-ink">
       {boss.name} · {boss.botWpm} WPM · best of {boss.bestOf}
     </span>
   </span>
 ) : (
   <label className="flex items-center gap-2">
     <span className="text-ink-faint">Bot speed</span>
     <select
       value={save.botWpm}
       onChange={(e) => setDifficulty(Number(e.target.value))}
       className="rounded-lg border border-line-strong bg-page px-2 py-1 font-mono text-ink"
       aria-label="Bot typing speed in words per minute"
     >
       {BOT_WPM_LADDER.map((w) => (
         <option key={w} value={w}>
           {w} WPM
         </option>
       ))}
     </select>
   </label>
 )}
 <label className="flex items-center gap-2">
 <span className="text-ink-faint">Your side</span>
 <select
 value={playerSide}
 onChange={(e) => setPlayerSide(e.target.value as PlayerSide)}
 className="rounded-lg border border-line-strong bg-page px-2 py-1 font-mono text-ink"
 aria-label="Which side you fight from"
 >
 <option value="left">Left</option>
 <option value="right">Right</option>
 </select>
 </label>
 <label className="flex items-center gap-2 text-ink-faint">
 <input
 type="checkbox"
 checked={save.strictMode}
 onChange={(e) => setStrict(e.target.checked)}
 className="h-3.5 w-3.5 accent-brand"
 />
 Strict mistakes
 </label>
 <button
 type="button"
 onClick={toggleMute}
 className="rounded-lg border border-line-strong px-2 py-1 text-ink-soft transition hover:border-brand/50 hover:text-brand-bright"
 aria-pressed={muted}
 >
 {muted ? "Sound off" : "Sound on"}
 </button>
 </div>

 <div className="flex items-center gap-3">
 <span className="font-mono text-xs text-ink-faint">
   <span className="text-coin">{save.coins.toLocaleString("en-US")}</span> coins
 </span>
 <button
   type="button"
   data-testid="fullscreen-button"
   onClick={toggleFullscreen}
   className="border-2 border-line-strong px-2 py-1 text-ink-soft transition hover:border-brand hover:text-brand"
   aria-label={isFullscreen ? "Leave fullscreen" : "Play in fullscreen"}
 >
   {isFullscreen ? "Exit" : "Fullscreen"}
 </button>
 {stage === "fighting" ? (
 <button
 type="button"
 onClick={stop}
 className="rounded-xl border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-heat/60 hover:text-heat"
 >
 Quit
 </button>
 ) : (
 <button
 type="button"
 data-testid="fight-button"
 onClick={start}
 className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-page transition hover:bg-brand-bright"
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
 className={
   isFullscreen
     ? "relative z-20 order-3 shrink-0 border-b border-line/80 px-4 py-2 backdrop-blur"
       : "mt-3 shrink-0 rounded-2xl border border-line/80 px-3 py-2"
   }
   style={{ background: isFullscreen ? translucent(theme.surface, "e6") : theme.surface }}
 >
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-2">
 <span className="font-mono text-xs font-bold text-ink-soft">BOT</span>
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
 className="font-mono text-[10px] text-ink-faint"
 >
 {them.wpm} WPM
 </span>
 {snap?.telegraph[opponent] && (
   <span className="rounded border border-heat/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-heat">
     KICK INCOMING
   </span>
 )}
 {them.guard > 0 && (
   <span className="rounded border border-aqua/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-aqua">
     BOT BLOCKING
   </span>
 )}
 {them.hitCooldown > 0 && (
 <span
 data-testid="bot-cooldown"
 title="You cannot land another hit for a moment. Use it to line up a heavy word."
 className="rounded border border-ink-faint/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint"
 >
 NOT HITTABLE YET
 </span>
 )}
 </div>
 <span className="font-mono text-[10px] text-ink-faint">
 round {snap?.round} · {snap?.wins[playerSide]}-{snap?.wins[opponent]}
 </span>
 </div>
 <div className="mt-1.5">
   {them.prompts.map((p) => (
     <PromptCard
       key={p.id}
       prompt={p}
       theme={theme}
       compact
       isRecovery={p.kind === "recovery"}
     />
   ))}
 </div>
 </div>
 )}

 {/* ---------------------------------------------------------- the fight */}
 <div
   className={
     isFullscreen
       ? // ABSOLUTE, so the fight leaves the flow entirely and the panels can pin themselves to
         // the top and bottom of the screen over it. This is what lets the arena take the FULL
         // viewport instead of only the leftovers the chrome did not use.
         "absolute inset-0 z-0 overflow-hidden bg-page"
       : "relative mt-3 overflow-hidden border-2 border-line bg-page"
   }
 >
 {/* The vh cap keeps the bot panel, the arena and the player's prompts all inside one
     screenful. Without it the prompts fell below the fold and the game could not be
     played. Wide layouts get more room, because there the arena is the point of the page.
     The cap is measured, not guessed: scripts/probe-layout.mjs measures it.

     FULLSCREEN DOES NOT USE A VH NUMBER, and that is deliberate. It used to ask for 76vh of
     arena on top of roughly 200px of panels; on a 768px-tall screen that is over 100vh, and a
     fullscreen element does not scroll, so the sentence was pushed off the bottom of the screen
     and the game became unplayable. Ruan hit exactly that: "fullscreen mode does not work
     properly as I cannot see the words I need to type."

     FULLSCREEN USES NO VH ARITHMETIC EITHER, for the same reason: a fullscreen element does not
     scroll, so any sum that exceeds 100vh pushes the player's sentence off the bottom.

     The approach is now to take the fight OUT of the flow. The arena is absolutely positioned over
     the whole screen and the panels float on top of it as a HUD, so the stage scales to the monitor
     rather than being boxed in by the chrome. Ruan: "make the background of the fight scale to a
     users monitor size in full screen. currently it is just a small box in fullscreen." Measured
     before this change: on a 1920x1080 monitor the arena covered 33.8% of the screen, because
     ~450px of panels left it only 628px tall and the 16:9 stage could not grow past that. */}
 <div
   data-testid="arena"
   className={
     isFullscreen
       ? // FILL THE SCREEN. Deliberately NOT aspect-locked any more: the canvas takes the whole
         // viewport and the renderer scales the 16:9 stage to fit inside it, painting the
         // leftover with the theme's background. So the fight always sits inside its own
         // background edge to edge, and an ultrawide or 16:10 monitor gets themed bars instead
         // of a letterboxed box floating in the page.
         "relative h-full w-full"
       : "relative mx-auto aspect-[16/9] w-full"
   }
   style={
     isFullscreen
       ? undefined
       : { maxWidth: `min(100%, calc(${wide ? 66 : 58}vh * 16 / 9))` }
   }
 >
 <canvas
 ref={canvasRef}
 tabIndex={0}
 // Deliberately no onFocus/onBlur here: the guard follows WINDOW focus, so focusing a control
 // inside the page (Fullscreen, Sound, Quit) must not read as the game losing focus.
 className="block h-full w-full outline-none"
 aria-label="Typing fight arena. Click here, then type to attack."
 />

 {/* Focus guard. Shown while the CANVAS does not hold keyboard focus, so a player who
 cannot type gets told why instead of assuming the game is broken — and it clears the
 moment the arena is focused, rather than waiting for a keystroke. Waiting for input left
 this scrim sitting over the arena through the whole round countdown, so the timer and
 this message drew on top of each other. Ruan: "make the message dissapear once the box
 is focused." */}
 {stage === "fighting" && !focused && (
 <button
 type="button"
 data-testid="focus-hint"
 onClick={() => canvasRef.current?.focus()}
 className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-page/85 text-center"
 >
 <span className="font-mono text-lg font-bold text-ink">
 Click here to start typing
 </span>
 <span className="max-w-sm text-xs text-ink-faint">
 The game reads your keyboard directly, so it needs you to click the arena once. Your
 prompts are under the arena.
 </span>
 </button>
 )}

 {stage === "idle" && (
 <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-page/92 px-6 text-center">
 <h2 className="font-mono text-2xl font-bold text-ink sm:text-3xl">
 Type to knock them off
 </h2>
 <p className="max-w-md text-sm text-ink-faint">
     One sentence at a time, and every word in it is a move. Short words raise a
     block, ordinary words punch, and the long words kick. Push the bot past the red
     line to win.
 </p>
 <ul className="max-w-md space-y-1 text-left text-xs text-ink-faint">
   <li>
     Every keystroke counts, starting with the first letter — and the space between two
     words is a real key you have to press
   </li>
   <li>
     Type without a mistake and your <span className="font-mono text-coin">CHAIN</span>{" "}
     builds: every three clean words and your hits land harder, until one slip takes it all
   </li>
   <li>
     Small words <span className="font-mono text-aqua">BLOCK</span>, ordinary words{" "}
     <span className="font-mono text-brand-bright">PUNCH</span>, long words{" "}
     <span className="font-mono text-heat">KICK</span>
   </li>
   <li>
     <span className="font-mono text-heat">KICK INCOMING</span> means a big hit is on
     the way: finish a <span className="font-mono text-aqua">BLOCK</span> word before
     it lands to parry it and open a counter
   </li>
   <li>
     pushed off the edge? You get one <span className="font-mono text-coin">SAVE</span>{" "}
     word to climb back
   </li>
 </ul>
 <button
 type="button"
 data-testid="start-overlay"
 onClick={start}
 className="mt-1 rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-page transition hover:bg-brand-bright"
 >
 Start the fight
 </button>
 <p className="text-[11px] text-ink-faint">
 Needs a physical keyboard. Best on a laptop or desktop.
 </p>
 </div>
 )}

 {stage === "fighting" && snap?.phase === "countdown" && (
 <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
 <span className="font-mono text-6xl font-black text-ink ">
 {Math.ceil(snap.countdown)}
 </span>
 </div>
 )}

 {stage === "fighting" && snap?.phase === "finish" && (
 <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
 <span className="animate-pulse rounded-lg border border-heat/60 bg-heat-deep/70 px-3 py-1 font-mono text-sm font-black tracking-widest text-heat">
 FINISH
 </span>
 </div>
 )}

 {stage === "fighting" && me?.recovering && (
 <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-coin/70 bg-coin-deep/80 px-4 py-2 text-center">
 <div className="font-mono text-sm font-bold text-coin">TYPE THE SAVE WORD</div>
 </div>
 )}
 </div>
 </div>

 {/* ---------------------------------------------------------- player */}
 {stage === "fighting" && me && (
 <div
 data-testid="player-panel"
 className={
   isFullscreen
     ? // order-4 + mt-auto: last in the column, pinned to the bottom, now that the arena no
       // longer occupies flow space. The footer used to ride below it; it now sits at the TOP.
       "relative z-20 order-4 mt-auto shrink-0 border-t border-brand-deep/40 px-4 py-2 backdrop-blur"
     : "mt-3 shrink-0 rounded-2xl border border-brand-deep/40 px-3 py-3"
 }
 style={{ background: isFullscreen ? translucent(theme.surface, "e6") : theme.surface }}
 >
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <span className="font-mono text-sm font-bold text-brand-bright">YOU</span>
 {/*
   THE COMBO METER. Sits first in the row because it is the thing the player is actually
   chasing: the damage number only tells them how it is going, the chain tells them what to
   do next. Pips rather than a number for the progress, because "two more clean words" is
   something you can feel at a glance and "combo 7 of 9" is something you have to read.
   Deliberately invisible until the first rung pays, so it never occupies space with a
   multiplier of x1 — the meter appearing IS the reward.
 */}
 {me.combo >= COMBO_STEP && (
   <div
     data-testid="combo-meter"
     data-value={me.combo}
     data-multiplier={me.comboMultiplier.toFixed(2)}
     data-intensity={me.comboIntensity.toFixed(2)}
     data-on-fire={me.combo >= COMBO_FIRE_CHAIN ? "1" : "0"}
     title={`${me.combo} flawless words in a row. Every mistake breaks the chain. Damage is multiplied by ${me.comboMultiplier.toFixed(2)}x.`}
     className={`flex items-center gap-1.5 rounded-lg border-2 px-2 py-0.5 ${onFire ? "animate-pulse" : ""}`}
     style={{
       borderColor: comboColour,
       background: `${comboColour}22`,
       boxShadow: `0 0 ${Math.round(4 + me.comboIntensity * 14)}px ${comboColour}66`,
     }}
   >
     <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: comboColour }}>
       {onFire ? "on fire" : "chain"}
     </span>
     <span className="font-mono text-base font-black leading-none" style={{ color: comboColour }}>
       {me.combo}
     </span>
     {/* One pip per rung of the ladder: filled to where the chain has climbed. */}
     <span className="flex items-center gap-[3px]">
       {Array.from({ length: COMBO_MAX_STEPS }, (_, i) => (
         <span
           key={i}
           className="block h-2.5 w-1.5 rounded-sm"
           style={{
             background: i < comboSteps(me.combo) ? comboColour : "rgba(120,120,130,0.3)",
           }}
         />
       ))}
     </span>
     <span className="font-mono text-xs font-black" style={{ color: comboColour }}>
       ×{me.comboMultiplier.toFixed(2)}
     </span>
   </div>
 )}
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
 <span data-testid="player-wpm" data-value={me.wpm} className="font-mono text-xs text-ink-faint">
 {me.wpm} WPM
 </span>
 <span className="font-mono text-xs text-ink-faint">{me.accuracy.toFixed(1)}% acc</span>
 {me.guard > 0 && (
   <span
     data-testid="player-guard"
     className="rounded border border-aqua/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-aqua"
   >
     BLOCKING
   </span>
 )}
 {me.counter > 0 && (
   <span className="rounded border border-brand-bright/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-soft">
     COUNTER READY
   </span>
 )}
 {me.invuln > 0 && (
 <span className="rounded border border-ink-faint/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
 INVULNERABLE
 </span>
 )}
 {me.hitCooldown > 0 && (
 <span
 data-testid="player-cooldown"
 title="You cannot be hit for a moment. Type while it lasts."
 className="rounded border border-ink-faint/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint"
 >
 BRIEFLY SAFE
 </span>
 )}
 {/*
   The input buffer made visible. Without this chip a player who taps a key while
   stunned sees the sentence not move and concludes the game ate their keystroke —
   which is what the buffer was built to fix, so it must not be hidden. It reports
   the real count, so the player learns that being hit costs them TIME, not letters.
 */}
 {me.queued > 0 && (
 <span
 data-testid="player-queued"
 data-value={me.queued}
 title="You cannot act right now, so these keystrokes are being held. They land the moment you can move again."
 className="rounded border border-coin/70 bg-coin/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-coin"
 >
 {me.queued} KEY{me.queued > 1 ? "S" : ""} HELD
 </span>
 )}
 </div>
 <span className="font-mono text-xs text-ink-faint">
 {Math.ceil(snap?.roundTimer ?? 0)}s left in round
 </span>
 </div>

 <div className="mt-2.5">
  {me.prompts.map((p) => (
    <PromptCard
      key={p.id}
      prompt={p}
      theme={theme}
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
 className={
   isFullscreen
     ? // order-4: the SAME bottom slot the player panel occupied, so the outcome lands where
       // the player's sentence just was. Unordered it defaults to 0 and sorts ABOVE the
       // order-1..4 HUD strips — the card rendered tangled into the top bar instead.
       "relative z-20 order-4 mt-auto shrink-0 border-t border-line px-5 py-3 backdrop-blur"
     : "mt-3 rounded-2xl border border-line bg-card/50 px-5 py-4"
 }
 style={isFullscreen ? { background: translucent(theme.surface, "e6") } : undefined}
>
 <div className="flex flex-wrap items-baseline gap-3">
 <span
 className={`font-mono text-xl font-black ${
 result.humanWon ? "text-brand-bright" : "text-heat"
 }`}
 >
 {result.humanWon ? "WIN" : "LOSS"}
 </span>
 <span className="font-mono text-sm text-ink-faint">
 rounds {result.roundsWon}-{result.roundsLost}
 </span>
 </div>
 <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
 {[
 { k: "Coins", v: `+${result.coins}` },
 { k: "WPM", v: `${result.wpm}` },
 { k: "Accuracy", v: `${result.accuracy.toFixed(1)}%` },
 { k: "Best chain", v: `${result.bestCombo}` },
 { k: streakLabel(result.streak), v: `${save.bestWpm}` },
 ].map((s) => (
 <div key={s.k} className="rounded-xl border border-line bg-page/60 px-3 py-2">
 <div className="text-[10px] uppercase tracking-wider text-ink-faint">{s.k}</div>
 <div className="font-mono text-lg font-bold text-ink">{s.v}</div>
 </div>
 ))}
 </div>
 {banked && (
   <p data-testid="banked" className="mt-3 font-mono text-xs text-coin">
     +{banked.gained} XP · level {banked.level} · {banked.xp.toLocaleString("en-US")} XP total
     {" · "}
     <span data-testid="banked-coins">+{banked.coins.toLocaleString("en-US")} coins</span>
     {banked.firstWin && <span data-testid="banked-first-win"> · first win today</span>}
     {banked.streakDays >= 2 && (
       <span data-testid="banked-streak"> · {banked.streakDays}-day streak</span>
     )}
   </p>
 )}
 {bankErr && <p className="mt-3 font-mono text-xs text-heat">Save failed: {bankErr}</p>}
 {!userId && authConfigured && authReady && (
   <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
     Guest match — not counted on the leaderboard.
     <button
       type="button"
       onClick={() => void startSignIn("/leaderboard")}
       className="border border-line-strong px-2 py-1 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
     >
       Sign in to bank your XP
     </button>
   </p>
 )}
 {boss && result.humanWon && (
   <p className="mt-3 font-mono text-xs text-brand" data-testid="boss-beaten">
     Boss beaten — {boss.name} down.
   </p>
 )}
 <div className="mt-3 flex flex-wrap gap-2 text-xs">
 {boss && (
   <Link
     href="/bosses"
     className="rounded-lg border border-line-strong px-3 py-1.5 font-semibold text-ink-soft transition hover:border-brand/60 hover:text-brand-bright"
   >
     Back to the campaign
   </Link>
 )}
 <Link
 href="/shop"
 className="rounded-lg border border-line-strong px-3 py-1.5 font-semibold text-ink-soft transition hover:border-brand/60 hover:text-brand-bright"
 >
 Spend coins in the shop
 </Link>
 <Link
 href="/how-to-play"
 className="rounded-lg border border-line-strong px-3 py-1.5 font-semibold text-ink-soft transition hover:border-brand/60 hover:text-brand-bright"
 >
 Strategy guide
 </Link>
 {result.humanWon && save.streak > 1 && (
 <span className="rounded-lg bg-coin/10 px-3 py-1.5 font-mono text-coin">
 {save.streak} win streak
 </span>
 )}
 </div>
 </div>
 )}

 {/* ---------------------------------------------------------- footer strip */}
 <div
   className={
     isFullscreen
       ? "relative z-20 order-1 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line/60 bg-card/70 px-4 py-1 text-[11px] text-ink-faint backdrop-blur"
       : "mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-faint"
   }
 >
 <span>
 Wearing <span className="font-mono text-ink-soft">{playerSkin.name}</span> (
 {RARITY_LABEL[playerSkin.rarity]}) · bot at{" "}
 <span className="font-mono text-ink-soft">{botWpmInPlay} WPM</span> (
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

/**
 * A theme surface colour with an alpha byte appended, for the panels that float ON TOP of the
 * arena in fullscreen. Themes store plain 6-digit hex; anything unexpected passes through
 * unchanged, so a future theme cannot be broken by this.
 */
function translucent(hex: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex;
}
