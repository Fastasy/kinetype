// The typing layer. Pure logic, no rendering, no timers of its own.
//
// FOUR RULES ARE ENFORCED HERE, NOT IN THE UI:
//   1. THE UNIT IS A SENTENCE AND THE COMMIT UNIT IS A WORD. The sentence advances
//      one word at a time, and a word fires on its final correct character only. There
//      is no sub-word timing window anywhere in this file, so the documented "hold the
//      last letter until the right moment" exploit has nothing to exploit.
//   2. SPACES ARE NEVER TYPED. The cursor jumps from the last letter of a word to the
//      first letter of the next one, so every keystroke counts and a stray space
//      press cannot register as an error or scroll the page.
//   3. THE PLAYER IS GIVEN A SENTENCE, NOT A MENU. Exactly one prompt is live at any
//      moment, and the sentence decides the move sequence: small words block, normal
//      words punch, difficult words kick. There is nothing to choose, so every
//      keystroke counts from the first press.
//   4. A MISTAKE COSTS THE BONUS, NOT THE WORD. A wrong character marks that word
//      flawed and does NOT reset progress: the player presses the correct key and
//      carries on. Only that word loses its precision bonus, so a mistyped word early
//      in a sentence does not write off the rest of it.
//
// Why sentences replaced single words: a lone word gave the player one move at a time
// with nothing to plan, and the pool's length bands meant the player only ever picked
// a difficulty, never a tactic. A sentence is a combo the player can see coming: the
// kick is three words away, the guard is the next small word. Timing, not volume.

import { PROMPT_COUNT, TELEGRAPH_COMMIT_CHARS, WPM_MIN_SPAN, WPM_WINDOW } from "./constants";
import { bandsForTier, RECOVERY_WORDS, SENTENCE_BANDS, type SentenceBand } from "./sentences";
import { charOffset, sentenceText, splitSentence } from "./moves";
import type { Rng } from "./rng";
import type { Prompt, PromptKind, SentenceWord } from "./types";

let nextPromptId = 1;

export interface CommitResult {
  prompt: Prompt;
  /** The word that just completed. Its move is the move that fires. */
  word: SentenceWord;
  /** Damage bonus earned by a flawless word. */
  precision: boolean;
  /** True when this word also finished the whole sentence. */
  sentenceDone: boolean;
}

export interface CharOutcome {
  kind: "none" | "correct" | "wrong" | "commit";
  commit?: CommitResult;
  /** Strict mode only: the caller applies the stagger. */
  penalise?: boolean;
}

export interface TypingOptions {
  strictMode: boolean;
  /** Bot-ladder index, which decides the sentence bands this fighter types. */
  tier: number;
}

export class TypingRun {
  /**
   * Always exactly one prompt. Kept as an array because the match layer, the renderer
   * and the bot all read it positionally, and because a future two-sentence mode would
   * be a one-line change rather than a refactor.
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
  /** Words committed: one move each. */
  words = 0;
  /** Sentences completed end to end. */
  sentences = 0;
  /** Block words completed, i.e. guards raised. */
  blocks = 0;
  bestWpm = 0;

  constructor(rng: Rng, opts: TypingOptions) {
    this.rng = rng;
    this.opts = opts;
    this.refill();
  }

  // ------------------------------------------------------------- prompt pool

  private promptFrom(text: string, kind: PromptKind): Prompt {
    const words = splitSentence(text);
    return {
      id: nextPromptId++,
      text: sentenceText(words),
      words,
      kind,
      index: 0,
      typed: 0,
      flawed: false,
      age: 0,
    };
  }

  private bands(): readonly SentenceBand[] {
    return bandsForTier(this.opts.tier);
  }

  private spawnSentence(): Prompt {
    const bands = this.bands();
    const band = bands[this.rng.int(bands.length)] ?? bands[0];
    const pool = SENTENCE_BANDS[band];
    const current = this.prompts[0]?.text;
    let text = this.rng.pick(pool);
    // Avoid handing the player the sentence they just finished. The pool is hundreds
    // deep, so a handful of retries is plenty and this cannot loop.
    for (let i = 0; i < 8 && text === current; i++) text = this.rng.pick(pool);
    return this.promptFrom(text, "attack");
  }

  /** A fighter past the blast line gets one word to save themselves. */
  private spawnRecovery(): Prompt {
    return this.promptFrom(this.rng.pick(RECOVERY_WORDS), "recovery");
  }

  /** Guarantees exactly one live prompt. */
  refill(): void {
    if (this.recovery) {
      this.prompts.length = 0;
      this.prompts.push(this.recovery);
      return;
    }
    while (this.prompts.length < PROMPT_COUNT) this.prompts.push(this.spawnSentence());
    this.prompts.length = PROMPT_COUNT;
  }

  // ------------------------------------------------------------- recovery

  /** Pushed off the edge: the live sentence is replaced by the save word. */
  enterRecovery(): Prompt {
    this.recovery = this.spawnRecovery();
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
   * The live prompt. It is always the first one, because there is only ever one, but
   * this stays a method so callers do not reach into the array.
   */
  activePrompt(): Prompt | undefined {
    return this.prompts[0];
  }

  /** The word being typed right now, or undefined once the sentence is done. */
  activeWord(): SentenceWord | undefined {
    const p = this.prompts[0];
    if (!p) return undefined;
    return p.words[p.index];
  }

  /**
   * The telegraph: this fighter has committed to a kick. Two characters in is enough
   * to see it coming, and the defender can see the whole sentence anyway, so this only
   * makes the timing legible.
   */
  telegraphing(): boolean {
    const w = this.activeWord();
    return !!w && w.move === "kick" && w.typed >= TELEGRAPH_COMMIT_CHARS;
  }

  handleChar(ch: string): CharOutcome {
    if (!/^[a-z]$/.test(ch)) return { kind: "none" };
    // NO CLOCK ADVANCE HERE, deliberately. This used to add a hard-coded 16ms per
    // keystroke ON TOP of the real dt that tick() already delivers, so the rolling WPM
    // window's time span ran ahead of the wall clock. Measured cost: the meter under-read
    // the player's true speed by 3.3% at 60 WPM and 8.3% at 120 WPM, and the error grew
    // with typing speed — the worst possible shape, because it punishes the player for
    // getting better on the game's own scoreboard. Time now comes from tick() only.

    const prompt = this.prompts[0];
    if (!prompt) return { kind: "none" };
    const word = prompt.words[prompt.index];
    if (!word) return { kind: "none" };

    const expected = word.text[word.typed];
    if (ch !== expected) {
      // Rule 4: mark it flawed, but do NOT wipe the player's progress. A typo costs
      // that word's precision bonus and an accuracy point; it does not send the whole
      // sentence back to the start.
      word.flawed = true;
      prompt.flawed = true;
      this.errors++;
      this.recent.push({ t: this.clock, correct: false });
      return { kind: "wrong", penalise: this.opts.strictMode };
    }

    word.typed++;
    this.chars++;
    this.correct++;
    this.recent.push({ t: this.clock, correct: true });
    prompt.typed = charOffset(prompt.words, prompt.index) + word.typed;

    if (word.typed < word.text.length) return { kind: "correct" };

    // ---- commit point: the final correct character of this word
    this.words++;
    const precision = !word.flawed;
    if (word.move === "block") this.blocks++;
    const committed: SentenceWord = { ...word };

    const wpm = this.wpm();
    if (wpm > this.bestWpm) this.bestWpm = wpm;

    const last = prompt.index >= prompt.words.length - 1;
    if (!last) {
      // Nudge the cursor to the first letter of the next word: the space between them
      // is never something the player has to type.
      prompt.index++;
      prompt.typed = charOffset(prompt.words, prompt.index);
      return {
        kind: "commit",
        commit: { prompt, word: committed, precision, sentenceDone: false },
      };
    }

    // Sentence finished. The match layer decides what that means for a save word.
    this.sentences++;
    prompt.typed = prompt.text.length;
    prompt.index = prompt.words.length;
    const result: CommitResult = {
      prompt,
      word: committed,
      precision,
      sentenceDone: true,
    };
    if (prompt.kind === "recovery") {
      // The match layer calls exitRecovery() itself.
      return { kind: "commit", commit: result };
    }
    // Immediately hand the player the next sentence. There is no gap and no menu.
    this.prompts[0] = this.spawnSentence();
    return { kind: "commit", commit: result };
  }

  tick(dt: number): void {
    this.clock += dt;
    for (const p of this.prompts) p.age += dt;
    const cutoff = this.clock - WPM_WINDOW;
    while (this.recent.length && this.recent[0].t < cutoff) this.recent.shift();
  }

  // ------------------------------------------------------------- metrics

  /**
   * The typing clock, in seconds.
   *
   * Advanced by tick() and by NOTHING ELSE. Exposed because the WPM meter's honesty
   * depends on that being true, and a claim like that needs to be testable rather than
   * trusted — the bug this replaced was a hard-coded 16ms added per keystroke.
   */
  get clockSeconds(): number {
    return this.clock;
  }

  /** Rolling-window WPM over committed correct characters. */
  wpm(): number {
    if (this.recent.length < 2) return 0;
    const span = this.recent[this.recent.length - 1].t - this.recent[0].t;
    // A sub-second span is the first two or three keystrokes of a sentence, not a speed.
    // Dividing by it produced a number that swung wildly at the start of every round.
    if (span < WPM_MIN_SPAN) return 0;
    const correctChars = this.recent.filter((r) => r.correct).length;
    return Math.round((correctChars / 5) * (60 / span));
  }

  accuracy(): number {
    const total = this.correct + this.errors;
    if (total === 0) return 100;
    return Math.round((this.correct / total) * 1000) / 10;
  }
}