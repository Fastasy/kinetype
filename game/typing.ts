// The typing layer. Pure logic, no rendering, no timers of its own.
//
// Three rules from the design research are enforced here, not in the UI:
//   1. COMMIT POINT IS THE WHOLE WORD. A prompt only fires on its final correct
//      character. There is no sub-word timing window anywhere in this file, so
//      the documented "hold the last letter until the right moment" exploit has
//      nothing to exploit.
//   2. MISTYPE LOSES THE BONUS, NOT THE TURN. By default a wrong character marks
//      the word flawed and restarts it. No stun. Strict mode is opt-in and lives
//      in the match layer, not here.
//   3. CHOICE IS A REAL INPUT. Three prompts are live at once. Locking is either
//      explicit (1/2/3) or implicit (the first letter you type picks the word).

import { COUNTER_WINDOW, PROMPTS_PER_FIGHTER, WPM_WINDOW } from "./constants";
import type { Rng } from "./rng";
import type { Prompt, PromptKind, WordTier } from "./types";
import { GUARD_WORDS, POOLS, RECOVERY_WORDS } from "./words";

let nextPromptId = 1;

export interface CommitResult {
  prompt: Prompt;
  /** Damage bonus earned by a flawless word. */
  precision: boolean;
}

export interface CharOutcome {
  kind: "none" | "correct" | "wrong" | "locked" | "commit";
  commit?: CommitResult;
  /** Strict mode only: the caller applies the stagger. */
  penalise?: boolean;
}

export interface TypingOptions {
  guardEnabled: boolean;
  strictMode: boolean;
}

export class TypingRun {
  readonly prompts: Prompt[] = [];
  private rng: Rng;
  private opts: TypingOptions;
  private activeId: number | null = null;
  private recent: { t: number; correct: boolean }[] = [];
  private clock = 0;
  /** When set, every slot is replaced by a single recovery prompt. */
  private recovery: Prompt | null = null;

  chars = 0;
  correct = 0;
  errors = 0;
  words = 0;
  bestWpm = 0;
  parries = 0;
  parryAttempts = 0;

  constructor(rng: Rng, opts: TypingOptions) {
    this.rng = rng;
    this.opts = opts;
    this.refill();
  }

  // ------------------------------------------------------------- prompt pool

  private spawn(kind: PromptKind, tier?: WordTier): Prompt {
    const resolvedTier: WordTier = kind === "attack" ? (tier ?? this.rollTier()) : "light";
    const pool: readonly string[] =
      kind === "guard" ? GUARD_WORDS : kind === "recovery" ? RECOVERY_WORDS : POOLS[resolvedTier];
    const inUse = new Set(this.prompts.map((p) => p.text));
    let text = this.rng.pick(pool);
    for (let i = 0; i < 24 && inUse.has(text); i++) text = this.rng.pick(pool);
    return {
      id: nextPromptId++,
      text,
      tier: resolvedTier,
      kind,
      typed: 0,
      flawed: false,
      age: 0,
    };
  }

  private rollTier(): WordTier {
    const r = this.rng.next();
    if (r < 0.42) return "light";
    if (r < 0.82) return "mid";
    return "heavy";
  }

  refill(): void {
    if (this.recovery) {
      this.prompts.length = 0;
      this.prompts.push(this.recovery);
      return;
    }
    while (this.prompts.length < PROMPTS_PER_FIGHTER) {
      this.prompts.push(this.spawn("attack"));
    }
  }

  // ------------------------------------------------------------- guard/recovery

  /**
   * The telegraph fired: swap the middle slot for a guard word. Returns false if
   * a guard is already live, so the caller cannot stack parries.
   */
  offerGuard(): boolean {
    if (this.recovery) return false;
    if (this.prompts.some((p) => p.kind === "guard")) return false;
    const slot = Math.min(1, this.prompts.length - 1);
    this.prompts[slot] = this.spawn("guard");
    if (this.activeId !== null) this.activeId = null;
    return true;
  }

  hasGuard(): boolean {
    return this.prompts.some((p) => p.kind === "guard");
  }

  clearGuard(): void {
    for (let i = 0; i < this.prompts.length; i++) {
      if (this.prompts[i].kind === "guard") this.prompts[i] = this.spawn("attack");
    }
    this.activeId = null;
  }

  /** A fighter past the blast line gets one word to save themselves. */
  enterRecovery(): Prompt {
    this.recovery = this.spawn("recovery");
    this.prompts.length = 0;
    this.prompts.push(this.recovery);
    this.activeId = this.recovery.id;
    return this.recovery;
  }

  exitRecovery(): void {
    this.recovery = null;
    this.prompts.length = 0;
    this.activeId = null;
    this.refill();
  }

  get inRecovery(): boolean {
    return this.recovery !== null;
  }

  // ------------------------------------------------------------- input

  private active(): Prompt | undefined {
    return this.prompts.find((p) => p.id === this.activeId);
  }

  /** The prompt currently being typed, if any. The telegraph logic reads this. */
  activePrompt(): Prompt | undefined {
    return this.active();
  }

  /** Explicit slot selection with 1/2/3. Returns true if it did anything. */
  selectSlot(index: number): boolean {
    const p = this.prompts[index];
    if (!p) return false;
    if (this.activeId === p.id && p.typed === 0) return false;
    this.activeId = p.id;
    for (const q of this.prompts) if (q.id !== p.id) q.typed = 0;
    return true;
  }

  /**
   * Implicit selection: the first letter typed locks the prompt that starts with
   * it. This keeps word choice to a single keystroke instead of a select step.
   */
  private implicitLock(ch: string): Prompt | undefined {
    const candidates = this.prompts.filter((p) => p.text[0] === ch);
    if (candidates.length === 0) return undefined;
    const chosen = candidates[0];
    this.activeId = chosen.id;
    return chosen;
  }

  handleChar(ch: string): CharOutcome {
    if (!/^[a-z]$/.test(ch)) return { kind: "none" };
    this.clock += 0.016;

    let prompt = this.active();
    if (!prompt) {
      const locked = this.implicitLock(ch);
      if (!locked) {
        this.errors++;
        this.recent.push({ t: this.clock, correct: false });
        return { kind: "wrong", penalise: this.opts.strictMode };
      }
      prompt = locked;
      return { kind: "locked" };
    }

    const expected = prompt.text[prompt.typed];
    if (ch !== expected) {
      prompt.flawed = true;
      prompt.typed = 0;
      this.errors++;
      this.recent.push({ t: this.clock, correct: false });
      if (prompt.kind === "guard") this.parryAttempts++;
      return { kind: "wrong", penalise: this.opts.strictMode };
    }

    prompt.typed++;
    this.chars++;
    this.correct++;
    this.recent.push({ t: this.clock, correct: true });

    if (prompt.typed < prompt.text.length) return { kind: "correct" };

    // ---- commit point: the final correct character of the whole word
    this.words++;
    const precision = !prompt.flawed;
    const committed: Prompt = { ...prompt };
    if (prompt.kind === "guard") this.parries++;

    const wpm = this.wpm();
    if (wpm > this.bestWpm) this.bestWpm = wpm;

    if (prompt.kind === "recovery") {
      // The match layer calls exitRecovery() itself.
      return { kind: "commit", commit: { prompt: committed, precision } };
    }

    const slot = this.prompts.findIndex((p) => p.id === prompt!.id);
    if (slot >= 0) this.prompts[slot] = this.spawn("attack");
    this.activeId = null;
    return { kind: "commit", commit: { prompt: committed, precision } };
  }

  tick(dt: number): void {
    this.clock += dt;
    for (const p of this.prompts) p.age += dt;
    const cutoff = this.clock - WPM_WINDOW;
    while (this.recent.length && this.recent[0].t < cutoff) this.recent.shift();
  }

  // ------------------------------------------------------------- metrics

  /** Rolling-window WPM over committed correct characters. */
  wpm(): number {
    if (this.recent.length < 2) return 0;
    const span = Math.max(
      1,
      this.recent[this.recent.length - 1].t - this.recent[0].t,
    );
    const correctChars = this.recent.filter((r) => r.correct).length;
    return Math.round((correctChars / 5) * (60 / span));
  }

  accuracy(): number {
    const total = this.correct + this.errors;
    if (total === 0) return 100;
    return Math.round((this.correct / total) * 1000) / 10;
  }

  hasCounter(remaining: number): boolean {
    return remaining > 0 && remaining <= COUNTER_WINDOW;
  }
}
