// The typing layer. Pure logic, no rendering, no timers of its own.
//
// THREE RULES FROM THE DESIGN RESEARCH ARE ENFORCED HERE, NOT IN THE UI:
//   1. COMMIT POINT IS THE WHOLE WORD. A prompt only fires on its final correct
//      character. There is no sub-word timing window anywhere in this file, so the
//      documented "hold the last letter until the right moment" exploit has nothing to
//      exploit.
//   2. THE PLAYER IS GIVEN A WORD, NOT A MENU. Exactly one prompt is live at any moment.
//      The game rolls the word and the player types it. See the note on PROMPT_COUNT.
//   3. A MISTAKE COSTS THE BONUS, NOT THE WORD. A wrong character marks the word flawed
//      and does NOT reset progress: the player must press the correct key to continue.
//
// Why rule 2 replaced the three-slot design: with three words live, the first keystroke
// was consumed to pick a word rather than counting toward it, so a player had to type the
// same letter twice, and a letter matching no word's first character counted as an error.
// With one word every keystroke counts, which is the whole point of a typing game.

import { COUNTER_WINDOW, PROMPT_COUNT, WPM_WINDOW } from "./constants";
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
  kind: "none" | "correct" | "wrong" | "commit";
  commit?: CommitResult;
  /** Strict mode only: the caller applies the stagger. */
  penalise?: boolean;
}

export interface TypingOptions {
  guardEnabled: boolean;
  strictMode: boolean;
}

export class TypingRun {
  /**
   * Always exactly one prompt. Kept as an array because the match layer, the renderer and
   * the bot all read it positionally, and because a future "two words" mode would be a
   * one-line change rather than a refactor.
   */
  readonly prompts: Prompt[] = [];
  private rng: Rng;
  private opts: TypingOptions;
  private recent: { t: number; correct: boolean }[] = [];
  private clock = 0;
  /** When set, the single slot holds a recovery prompt. */
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
    const current = this.prompts[0]?.text;
    let text = this.rng.pick(pool);
    // Avoid handing the player the word they just finished. The pools are thousands of
    // words deep, so one retry is plenty and this cannot loop.
    for (let i = 0; i < 8 && text === current; i++) text = this.rng.pick(pool);
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

  /** Guarantees exactly one live prompt. */
  refill(): void {
    if (this.recovery) {
      this.prompts.length = 0;
      this.prompts.push(this.recovery);
      return;
    }
    while (this.prompts.length < PROMPT_COUNT) this.prompts.push(this.spawn("attack"));
    this.prompts.length = PROMPT_COUNT;
  }

  // ------------------------------------------------------------- guard/recovery

  /**
   * The telegraph fired: the live word becomes a guard word. Returns false if a guard or
   * recovery is already up, so parries cannot stack.
   *
   * This REPLACES the attack word rather than sitting beside it. That is the cost of a
   * one-word design, and it is what makes a telegraphed heavy hit a real reaction test:
   * you drop what you were typing and block, or you eat the hit.
   */
  offerGuard(): boolean {
    if (this.recovery) return false;
    if (this.prompts[0]?.kind === "guard") return false;
    this.prompts[0] = this.spawn("guard");
    return true;
  }

  hasGuard(): boolean {
    return this.prompts[0]?.kind === "guard";
  }

  clearGuard(): void {
    if (this.prompts[0]?.kind === "guard") this.prompts[0] = this.spawn("attack");
  }

  /** A fighter past the blast line gets one word to save themselves. */
  enterRecovery(): Prompt {
    this.recovery = this.spawn("recovery");
    this.prompts.length = 0;
    this.prompts.push(this.recovery);
    return this.recovery;
  }

  exitRecovery(): void {
    this.recovery = null;
    this.prompts.length = 0;
    this.refill();
  }

  get inRecovery(): boolean {
    return this.recovery !== null;
  }

  // ------------------------------------------------------------- input

  /**
   * The live prompt. It is always the first one, because there is only ever one, but this
   * stays a method so callers do not reach into the array.
   */
  activePrompt(): Prompt | undefined {
    return this.prompts[0];
  }

  handleChar(ch: string): CharOutcome {
    if (!/^[a-z]$/.test(ch)) return { kind: "none" };
    this.clock += 0.016;

    const prompt = this.prompts[0];
    if (!prompt) return { kind: "none" };

    const expected = prompt.text[prompt.typed];
    if (ch !== expected) {
      // Rule 3: mark it flawed, but do NOT wipe the player's progress. A typo costs the
      // precision bonus and an accuracy point; it does not send them back to the start.
      prompt.flawed = true;
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

    // Immediately hand the player the next word. There is no gap and no menu.
    this.prompts[0] = this.spawn("attack");
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
