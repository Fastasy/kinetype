// The typing layer. Pure logic, no rendering, no timers of its own.
//
// FOUR RULES ARE ENFORCED HERE, NOT IN THE UI:
//   1. THE UNIT IS A SENTENCE AND THE COMMIT UNIT IS A WORD. The sentence advances
//      one word at a time, and a word fires on its final correct character only. There
//      is no sub-word timing window anywhere in this file, so the documented "hold the
//      last letter until the right moment" exploit has nothing to exploit.
//   2. THE SEPARATOR IS A REAL KEY. The word fires its move on its final letter, and then
//      the space between it and the next word is the next required keypress. Nothing
//      advances until it lands. The separator cannot be optional: if the last letter also
//      moved the cursor, pressing space would be strictly worse than typing straight
//      through and the key would be decoration. Because space is a real key it can also be
//      WRONG — a stray space mid-word registers as a mistake rather than being ignored.
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
  /**
   * Consecutive flawlessly typed words. Broken by ANY mistake, reset never otherwise.
   * Read by the match layer for the damage multiplier, by the renderer for screen
   * intensity and by the HUD for the meter.
   */
  combo = 0;
  /** Longest chain reached this match, for the result screen. */
  bestCombo = 0;
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
      pendingSpace: false,
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
   * Consecutive flawlessly typed words. Broken by ANY mistake, and cleared at the start of
   * every round so each one is a fresh climb: carrying a full chain across a round boundary
   * would open round two already at maximum multiplier, which is the escalation handing
   * itself to the player instead of making them earn it again.
   */
  resetCombo(): void {
    this.combo = 0;
  }

  /**
   * The single key the player must press next, or null once the sentence is done.
   *
   * THE ONE SOURCE OF TRUTH for "what am I supposed to type". The input handler, the bot
   * and the HUD all read it, so they can never disagree about whether a space is due — which
   * is exactly the bug that would ship if the separator rule lived in three places.
   */
  nextKey(): string | null {
    const p = this.prompts[0];
    if (!p) return null;
    if (p.pendingSpace) return " ";
    const w = p.words[p.index];
    if (!w) return null;
    return w.text[w.typed] ?? " ";
  }

  /**
   * The telegraph: this fighter has committed to a kick. Two characters in is enough
   * to see it coming, and the defender can see the whole sentence anyway, so this only
   * makes the timing legible.
   */
  telegraphing(): boolean {
    const p = this.prompts[0];
    // Not while a separator is pending: that word has already fired its move, so a lingering
    // KICK INCOMING would be telling the defender to block something that already landed.
    if (!p || p.pendingSpace) return false;
    const w = p.words[p.index];
    return !!w && w.move === "kick" && w.typed >= TELEGRAPH_COMMIT_CHARS;
  }

  /** Any mistake breaks the chain. One sentence of rule, and it is the whole rule. */
  private breakCombo(): void {
    this.combo = 0;
  }

  handleChar(ch: string): CharOutcome {
    // A separator is a real key now, so it is a legal press. Nothing else is.
    if (!/^[a-z ]$/.test(ch)) return { kind: "none" };
    // NO CLOCK ADVANCE HERE, deliberately. This used to add a hard-coded 16ms per
    // keystroke ON TOP of the real dt that tick() already delivers, so the rolling WPM
    // window's time span ran ahead of the wall clock. Measured cost: the meter under-read
    // the player's true speed by 3.3% at 60 WPM and 8.3% at 120 WPM, and the error grew
    // with typing speed — the worst possible shape, because it punishes the player for
    // getting better on the game's own scoreboard. Time now comes from tick() only.

    const prompt = this.prompts[0];
    if (!prompt) return { kind: "none" };

    // ---- the separator: the word is done and the space is what advances the cursor
    if (prompt.pendingSpace) {
      if (ch !== " ") {
        // A key pressed where the separator is due costs accuracy and breaks the chain,
        // but it does NOT flaw the coming word. That word has not been typed yet, so
        // robbing it of its precision bonus would punish a mistake the player has not
        // made in it. Failing to advance is punishment enough.
        this.errors++;
        this.recent.push({ t: this.clock, correct: false });
        this.breakCombo();
        return { kind: "wrong", penalise: this.opts.strictMode };
      }
      prompt.pendingSpace = false;
      prompt.index++;
      prompt.typed = charOffset(prompt.words, prompt.index);
      this.chars++;
      this.correct++;
      this.recent.push({ t: this.clock, correct: true });
      return { kind: "correct" };
    }

    const word = prompt.words[prompt.index];
    if (!word) return { kind: "none" };

    const expected = word.text[word.typed];
    if (ch !== expected) {
      // Rule 4: mark it flawed, but do NOT wipe the player's progress. A typo costs
      // that word's precision bonus and an accuracy point; it does not send the whole
      // sentence back to the start. A stray SPACE mid-word lands here too, because the
      // separator is a real key and can therefore be wrong.
      word.flawed = true;
      prompt.flawed = true;
      this.errors++;
      this.recent.push({ t: this.clock, correct: false });
      this.breakCombo();
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
    // The chain counts the word that just landed, so the third clean word in a row is the
    // one that already carries the extra damage. Rewarding the NEXT word instead would put
    // a beat between the achievement and the payoff.
    if (precision) {
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    } else {
      this.breakCombo();
    }
    const committed: SentenceWord = { ...word };

    const wpm = this.wpm();
    if (wpm > this.bestWpm) this.bestWpm = wpm;

    const last = prompt.index >= prompt.words.length - 1;
    if (!last) {
      // The move has fired, but the sentence does NOT advance. The separator is the next
      // required keypress and the cursor waits on it. `typed` already points at it, because
      // it counts the characters consumed including separators.
      prompt.pendingSpace = true;
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
    // Immediately hand the player the next sentence. There is no gap and no menu, and no
    // trailing separator: the space lives BETWEEN the words, so the last word ends the
    // sentence on its own final letter.
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

  /**
   * The live meter: correct characters within the last WPM_WINDOW seconds, expressed per minute.
   *
   * Two things make this the honest reading, and both were wrong before:
   *
   *   1. THE DIVISOR IS THE WINDOW, NOT THE GAP BETWEEN THE OLDEST AND NEWEST KEYSTROKE IN IT.
   *      Those two are only the same while the player types continuously. Any pause let the span
   *      collapse to whatever survived it, so the meter reported the speed of the surviving burst
   *      rather than the speed of the window, and it swung hard after every hiccup. A pause now
   *      drags the number down and a burst lifts it, over a fixed window, which is the reading a
   *      player expects from a speedometer.
   *   2. Time comes from tick() alone. A hard-coded per-keystroke cost used to advance the window's
   *      clock ahead of the wall clock, and it under-read a fast typist worst of all.
   */
  wpm(): number {
    // Early in a round there is no full window yet, so the elapsed typing time IS the window.
    const span = Math.min(this.clock, WPM_WINDOW);
    if (span < WPM_MIN_SPAN) return 0;
    let correctChars = 0;
    for (const r of this.recent) if (r.correct) correctChars++;
    return Math.round((correctChars / 5) * (60 / span));
  }

  /**
   * The match's honest speed: every correct character typed, over the whole typing clock.
   *
   * This is the number the result screen, the saved personal best and the payout use. It is the
   * same definition the free test on /typing-speed-test uses, so the two agree, and it cannot be
   * inflated by one lucky burst the way a peak can. A peak is a fine thing to celebrate and a bad
   * thing to pay out on.
   *
   * The clock it divides by is typing time only: the countdown, hitstop and a round-over freeze do
   * not advance it, so time the player could not act is not held against them.
   */
  averageWpm(): number {
    if (this.clock < WPM_MIN_SPAN) return 0;
    return Math.round((this.correct / 5) * (60 / this.clock));
  }

  accuracy(): number {
    const total = this.correct + this.errors;
    if (total === 0) return 100;
    return Math.round((this.correct / total) * 1000) / 10;
  }
}