// The engine: fixed-timestep loop, input, canvas sizing, audio wiring, and the
// snapshot that feeds the DOM HUD.
//
// Fixed timestep with an accumulator, so simulation is frame-rate independent and
// a slow frame cannot change the outcome of a match. Rendering reads the result.

import { STEP, TELEGRAPH_COMMIT_CHARS } from "./constants";
import { AudioBus } from "./audio";
import { Match } from "./match";
import { computeViewport, drawScene } from "./render";
import { overlayById } from "./skins";
import type { GameEvent, MatchOptions, MatchResult, Prompt, Side } from "./types";

export interface PromptView {
  id: number;
  text: string;
  typed: number;
  tier: Prompt["tier"];
  kind: Prompt["kind"];
  flawed: boolean;
}

export interface SideView {
  damage: number;
  wpm: number;
  accuracy: number;
  state: string;
  counter: number;
  invuln: number;
  /** Seconds until this side can be hit again. */
  hitCooldown: number;
  recovering: boolean;
  prompts: PromptView[];
  /** True when this side has been handed a guard word to parry with. */
  guardOffered: boolean;
}

export interface Snapshot {
  phase: string;
  round: number;
  wins: { left: number; right: number };
  roundTimer: number;
  countdown: number;
  left: SideView;
  right: SideView;
  /** True when the opposing side has committed to a heavy word. */
  telegraph: { left: boolean; right: boolean };
  sparkSide: Side | null;
  humanSide: Side;
  result: MatchResult | null;
}

export interface EngineConfig {
  botWpm: number;
  strictMode: boolean;
  skins: { left: string; right: string };
  overlayId: string;
  muted: boolean;
  streakBefore: number;
  humanSide: Side;
  seed: number;
}

export interface EngineCallbacks {
  onSnapshot?: (s: Snapshot) => void;
  onEnd?: (r: MatchResult) => void;
  onEvent?: (e: GameEvent) => void;
}

const TIER_SOUND = {
  light: "commitLight",
  mid: "commitMid",
  heavy: "commitHeavy",
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
      bestOf: 3,
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

  get overlay() {
    return overlayById(this.cfg.overlayId);
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
    if (k === "1" || k === "2" || k === "3") {
      const changed = this.match.selectSlot(this.cfg.humanSide, Number(k) - 1);
      if (changed) this.dirty = true;
      return changed;
    }
    if (!/^[a-z]$/.test(k)) return false;
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
      { humanSide: this.cfg.humanSide, overlayId: this.cfg.overlayId },
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
        this.audio.play(TIER_SOUND[e.tier], e.precision ? 0.01 : 0);
        break;
      case "hit":
        this.audio.play("hit", Math.min(0.08, e.power / 3000));
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
      invuln: Math.max(0, f.invuln),
      hitCooldown: Math.max(0, f.hitCooldown),
      recovering: t.inRecovery,
      guardOffered: t.hasGuard(),
      prompts: t.prompts.map<PromptView>((p) => ({
        id: p.id,
        text: p.text,
        typed: p.typed,
        tier: p.tier,
        kind: p.kind,
        flawed: p.flawed,
      })),
    };
  }

  snapshot(): Snapshot {
    const telegraphOf = (side: Side): boolean => {
      const active = this.match.typing[side].activePrompt();
      if (!active) return false;
      return active.tier === "heavy" && active.typed >= TELEGRAPH_COMMIT_CHARS;
    };
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
