// The engine: fixed-timestep loop, input, canvas sizing, audio wiring, and the
// snapshot that feeds the DOM HUD.
//
// Fixed timestep with an accumulator, so simulation is frame-rate independent and
// a slow frame cannot change the outcome of a match. Rendering reads the result.

import { STEP } from "./constants";
import { AudioBus } from "./audio";
import { comboIntensity, comboMultiplier } from "./combo";
import { Match } from "./match";
import { computeViewport, drawScene } from "./render";
import { themeById, type Theme } from "./themes";
import type { GameEvent, MatchOptions, MatchResult, MoveKind, Prompt, Side } from "./types";

/** One word of a sentence prompt, flattened for the DOM. */
export interface WordView {
  text: string;
  move: MoveKind;
  typed: number;
  flawed: boolean;
}

export interface PromptView {
  id: number;
  text: string;
  typed: number;
  words: WordView[];
  /** Index of the live word; equals words.length once the sentence is done. */
  index: number;
  kind: Prompt["kind"];
  /** True when the separator after the previous word is the next required keypress. */
  pendingSpace: boolean;
  /** The exact key the player must press next. " " when the separator is due. */
  nextKey: string | null;
  flawed: boolean;
}

export interface SideView {
  damage: number;
  wpm: number;
  accuracy: number;
  state: string;
  counter: number;
  guard: number;
  invuln: number;
  /** Seconds until this side can be hit again. */
  hitCooldown: number;
  /** Keystrokes held because this side cannot act yet. Shown so a wait is not silent. */
  queued: number;
  /** Consecutive flawlessly typed words. */
  combo: number;
  /** Damage multiplier the chain has earned. 1 while the chain is short. */
  comboMultiplier: number;
  /** 0..1 escalation, for driving the HUD's intensity. */
  comboIntensity: number;
  recovering: boolean;
  prompts: PromptView[];
}

export interface Snapshot {
  phase: string;
  round: number;
  wins: { left: number; right: number };
  roundTimer: number;
  countdown: number;
  left: SideView;
  right: SideView;
  /** True when the opposing side has committed to a kick. */
  telegraph: { left: boolean; right: boolean };
  sparkSide: Side | null;
  humanSide: Side;
  result: MatchResult | null;
}

export interface EngineConfig {
  botWpm: number;
  strictMode: boolean;
  skins: { left: string; right: string };
  /** The website theme — used only for the letterbox colour outside the stage. */
  themeId: string;
  /** The arena to fight in (game/maps.ts): sky, hills, ground, blast lines. */
  mapId: string;
  muted: boolean;
  streakBefore: number;
  humanSide: Side;
  seed: number;
  /**
   * Rounds needed to win. Optional, defaulting to 3, so every existing caller is
   * unchanged. The boss campaign uses this: its final fight is a best-of-five.
   */
  bestOf?: number;
}

export interface EngineCallbacks {
  onSnapshot?: (s: Snapshot) => void;
  onEnd?: (r: MatchResult) => void;
  onEvent?: (e: GameEvent) => void;
}

const MOVE_SOUND = {
  block: "block",
  punch: "commitMid",
  kick: "commitHeavy",
} as const;

export class GameEngine {
  readonly match: Match;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cfg: EngineConfig;
  private cb: EngineCallbacks;
  private audio = new AudioBus();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private elapsed = 0;
  private lastPush = 0;
  private dirty = true;
  private keyCounter = 0;
  private ended = false;
  paused = false;

  constructor(canvas: HTMLCanvasElement, cfg: EngineConfig, cb: EngineCallbacks = {}) {
    this.canvas = canvas;
    this.cfg = cfg;
    this.cb = cb;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;

    const opts: MatchOptions = {
      botWpm: cfg.botWpm,
      playerWpmHint: cfg.botWpm,
      strictMode: cfg.strictMode,
      bestOf: cfg.bestOf ?? 3,
      skins: cfg.skins,
    };
    this.match = new Match(opts, cfg.seed, { onEvent: (e) => this.onEvent(e) }, cfg.humanSide);
    this.match.streakBefore = cfg.streakBefore;
    this.audio.setMuted(cfg.muted);
    this.resize();
  }

  // ------------------------------------------------------------- lifecycle

  async start(): Promise<void> {
    await this.audio.unlock();
    this.last = 0;
    this.raf = window.requestAnimationFrame(this.loop);
  }

  /**
   * Start the render loop with the simulation frozen, for the idle arena preview
   * behind the intro. Deliberately does NOT unlock audio: creating an AudioContext
   * without a user gesture gets a console warning, and a paused match makes no sound
   * anyway.
   */
  startPreview(): void {
    this.paused = true;
    this.last = 0;
    this.raf = window.requestAnimationFrame(this.loop);
  }

  destroy(): void {
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.audio.dispose();
  }

  setMuted(muted: boolean): void {
    this.cfg.muted = muted;
    this.audio.setMuted(muted);
  }

  get theme(): Theme {
    return themeById(this.cfg.themeId);
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.vpDpr = dpr;
    this.dirty = true;
  }

  private vpDpr = 1;

  // ------------------------------------------------------------- input

  /** Returns true if the key was consumed by the fight. */
  handleKey(key: string): boolean {
    if (this.paused) return false;
    const k = key.toLowerCase();
    // Space is a real key: it is the separator between words. Everything else the game
    // reads is a letter.
    if (k !== " " && !/^[a-z]$/.test(k)) return false;
    const used = this.match.type(this.cfg.humanSide, k);
    this.dirty = true;
    return used;
  }

  // ------------------------------------------------------------- loop

  private loop = (ts: number): void => {
    this.raf = window.requestAnimationFrame(this.loop);
    if (!this.last) this.last = ts;
    const delta = Math.min(0.1, (ts - this.last) / 1000);
    this.last = ts;

    if (!this.paused) {
      this.elapsed += delta;
      this.acc += delta;
      let guard = 0;
      while (this.acc >= STEP && guard++ < 8) {
        this.match.step(STEP);
        this.acc -= STEP;
      }
    }

    this.render();

    if (this.dirty || ts - this.lastPush > 90) {
      this.lastPush = ts;
      this.dirty = false;
      this.cb.onSnapshot?.(this.snapshot());
    }
    if (this.match.result && !this.ended) {
      this.ended = true;
      // The end-of-match flourish plays from the engine, next to the `onEnd` handoff, so the sound
      // and the result card are triggered by the same event rather than by a component that might
      // be re-rendering at the time.
      this.audio.fanfare(this.match.result.humanWon);
      this.cb.onEnd?.(this.match.result);
    }
  };

  private render(): void {
    const dpr = this.vpDpr;
    const vp = computeViewport(this.canvas.width / dpr, this.canvas.height / dpr);
    vp.scale *= dpr;
    vp.offsetX *= dpr;
    vp.offsetY *= dpr;
    drawScene(
      this.ctx,
      this.match,
      vp,
      { humanSide: this.cfg.humanSide, themeId: this.cfg.themeId, mapId: this.cfg.mapId },
      this.elapsed,
    );
  }

  // ------------------------------------------------------------- events

  private onEvent(e: GameEvent): void {
    this.dirty = true;
    switch (e.type) {
      case "key":
        // Only the player's own keystrokes are voiced. The opponent's prompts are
        // fully visible on screen, so their typing needs no audio channel, and
        // double-speed key noise at high WPM would be unreadable clutter.
        if (e.side === this.cfg.humanSide) {
          this.keyCounter = (this.keyCounter + 1) % 4;
          this.audio.play(e.correct ? "correct" : "wrong", this.keyCounter * 0.004);
        }
        break;
      case "commit":
        this.audio.play(MOVE_SOUND[e.move], e.precision ? 0.01 : 0);
        break;
      case "hit":
        // The pitch climbs with the attacker's chain, so a player on a run HEARS the
        // escalation. Capped so a long chain cannot push the hit into a squeal.
        this.audio.play("hit", Math.min(0.08, e.power / 3000) + Math.min(0.2, e.combo * 0.015));
        // A smothered hit needs its own sound: "it landed" and "it was blocked" are
        // very different pieces of information for the player who is not looking.
        if (e.guarded) this.audio.play("block", 0.02);
        break;
      case "block":
        this.audio.play("block");
        break;
      case "parry":
        this.audio.play("parry");
        break;
      case "spark":
        this.audio.play("spark");
        break;
      case "kill":
        this.audio.play("ko");
        break;
      case "recover":
        this.audio.play(e.ok ? "ui" : "wrong");
        break;
      default:
        break;
    }
    this.cb.onEvent?.(e);
  }

  // ------------------------------------------------------------- snapshot

  private sideView(side: Side): SideView {
    const f = this.match.fighter(side);
    const t = this.match.typing[side];
    return {
      damage: f.damage,
      wpm: t.wpm(),
      accuracy: t.accuracy(),
      state: f.state,
      counter: Math.max(0, f.counter),
      guard: Math.max(0, f.guard),
      invuln: Math.max(0, f.invuln),
      hitCooldown: Math.max(0, f.hitCooldown),
      queued: this.match.queuedFor(side),
      combo: t.combo,
      comboMultiplier: comboMultiplier(t.combo),
      comboIntensity: comboIntensity(t.combo),
      recovering: t.inRecovery,
      prompts: t.prompts.map<PromptView>((p) => ({
        id: p.id,
        text: p.text,
        typed: p.typed,
        words: p.words.map((w) => ({
          text: w.text,
          move: w.move,
          typed: w.typed,
          flawed: w.flawed,
        })),
        index: p.index,
        kind: p.kind,
        pendingSpace: p.pendingSpace,
        // Read from the same source the input handler uses, so the cursor the player sees and
        // the key the game will accept can never disagree.
        nextKey: t.nextKey(),
        flawed: p.flawed,
      })),
    };
  }

  snapshot(): Snapshot {
    const telegraphOf = (side: Side): boolean => this.match.typing[side].telegraphing();
    return {
      phase: this.match.phase,
      round: this.match.round,
      wins: { ...this.match.wins },
      roundTimer: Math.max(0, this.match.roundTimer),
      countdown: Math.max(0, this.match.phaseTimer),
      left: this.sideView("left"),
      right: this.sideView("right"),
      telegraph: { left: telegraphOf("left"), right: telegraphOf("right") },
      sparkSide: this.match.finishSide,
      humanSide: this.cfg.humanSide,
      result: this.match.result,
    };
  }
}
