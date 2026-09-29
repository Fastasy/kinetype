// Bot opponent.
//
// Design rules from the research:
//   - Difficulty ramps on ONE axis (typing speed), smoothed, with the player
//     choosing it explicitly. Typing skill is uncorrelated with gaming skill, so
//     "easy/normal/hard" would tell the player nothing.
//   - Adaptive correction is bounded (ADAPT_MAX) and only ever applied between
//     rounds, so it can never be felt as cheating inside a round.
//   - The bot plays yomi layer 2: its parrySkill is what decides whether it gets its
//     guard up in time against a telegraphed kick, so a player who leans on kicks
//     finds the fast bots blocking and countering them.
//
// Sentence awareness: the bot no longer re-reads a prompt per word. A sentence keeps
// its prompt id from its first word to its last, so the bot's decision delay is paid
// once per sentence and the words inside it flow at the bot's chosen WPM. Paying the
// delay per WORD made a 40 WPM bot effectively much slower than 40 WPM.

import {
  ADAPT_MAX,
  BOT_ACCURACY_LADDER,
  BOT_DECISION_DELAY,
  BOT_PARRY_SKILL,
  BOT_WPM_LADDER,
} from "./constants";
import type { Rng } from "./rng";
import type { Fighter, Prompt } from "./types";
import { TypingRun, type CommitResult } from "./typing";

export interface BotConfig {
  targetWpm: number;
  accuracy: number;
  /** Median ms between being handed a sentence and committing to its first word. */
  decisionDelay: number;
  /** Probability it reacts to a telegraphed kick by snapping off its block word. */
  parrySkill: number;
}

export function botConfigForTier(tier: number): BotConfig {
  const i = Math.max(0, Math.min(BOT_WPM_LADDER.length - 1, tier));
  return {
    targetWpm: BOT_WPM_LADDER[i],
    accuracy: BOT_ACCURACY_LADDER[i],
    decisionDelay: BOT_DECISION_DELAY[i],
    parrySkill: BOT_PARRY_SKILL[i],
  };
}

/** Nearest ladder index for a given speed, so adaptation stays on the ladder. */
export function tierForWpm(wpm: number): number {
  let best = 0;
  let bestGap = Infinity;
  BOT_WPM_LADDER.forEach((v, i) => {
    const gap = Math.abs(v - wpm);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

export class BotController {
  cfg: BotConfig;
  private rng: Rng;
  private budget = 0;
  private wait = 0;
  private targetId: number | null = null;
  /** 0..1, rises when the bot is losing. Bounded by ADAPT_MAX. */
  private adapt = 0;
  /** Which sentence the reflex roll was made for, and what it decided. */
  private reflexFor: number | null = null;
  private willReflex = false;

  constructor(cfg: BotConfig, rng: Rng) {
    this.cfg = cfg;
    this.rng = rng;
  }

  /** Called between rounds only. Never mid-round. */
  observeRound(ownDamage: number, opponentDamage: number): void {
    const deficit = (ownDamage - opponentDamage) / 100;
    this.adapt = Math.max(-ADAPT_MAX, Math.min(ADAPT_MAX, deficit * 0.1));
  }

  reset(): void {
    this.budget = 0;
    this.wait = 0;
    this.targetId = null;
    this.reflexFor = null;
    this.willReflex = false;
  }

  private effective(metric: "wpm" | "accuracy" | "parry"): number {
    if (metric === "wpm") return this.cfg.targetWpm * (1 + this.adapt);
    if (metric === "accuracy") return Math.min(0.995, this.cfg.accuracy + this.adapt * 0.05);
    return Math.max(0, Math.min(0.95, this.cfg.parrySkill + this.adapt * 0.2));
  }

  /**
   * Roll the reflex ONCE per sentence, not per keystroke.
   *
   * A bot that fails this roll keeps typing its sentence at its own pace and eats the
   * kick it saw coming, which is what "missed the read" should look like. The roll is
   * bounded by parrySkill, which is on the same ladder as everything else.
   */
  private shouldReflex(prompt: Prompt): boolean {
    if (this.reflexFor !== prompt.id) {
      this.reflexFor = prompt.id;
      this.willReflex = this.rng.chance(this.effective("parry"));
    }
    return this.willReflex;
  }

  /**
   * Advance the bot. Feeds characters into `typing` exactly as a human would, so
   * there is no separate code path for bot attacks.
   *
   * IMPORTANT: this returns the commit rather than applying it. Damage and
   * knockback are applied in Match.commitMove, and the bot must go through the
   * same door as the player. Applying it here silently produced bots that typed
   * words at full speed and never landed a single hit.
   */
  update(
    dt: number,
    typing: TypingRun,
    self: Fighter,
    /** The opponent has committed to a kick: a read is available. */
    threat = false,
  ): CommitResult | null {
    if (self.state === "ko" || self.state === "hitstun" || self.state === "staggered") {
      return null;
    }

    this.wait -= dt;
    if (this.wait > 0) return null;

    const live = typing.prompts[0];
    if (!live) return null;

    // A sentence the bot has not started yet: take a beat, the way a human reads it
    // first. Paid once per sentence, not once per word.
    if (live.id !== this.targetId) {
      this.targetId = live.id;
      // No deliberation while falling: a recovery word is on a 1.8s clock.
      this.wait = typing.inRecovery
        ? 0
        : (this.cfg.decisionDelay / 1000) * (0.7 + this.rng.next() * 0.6);
      return null;
    }

    const word = typing.activeWord();

    // The read: a kick is coming and the bot is already on a block word. A bot that
    // wins its reflex roll snaps the block off right now, so its guard is up when the
    // kick lands. It cannot skip words in its sentence, it can only hurry this one.
    if (
      threat &&
      word &&
      word.move === "block" &&
      word.typed < word.text.length &&
      this.shouldReflex(live)
    ) {
      this.budget = word.text.length - word.typed;
    }

    const cps = (this.effective("wpm") * 5) / 60;
    this.budget += cps * dt;
    let guard = 0;
    while (this.budget >= 1 && guard++ < 12) {
      this.budget -= 1;
      const current = typing.prompts[0];
      // The sentence changed under us (a new one, or recovery), or it is finished.
      if (!current || current.id !== this.targetId) break;
      const active = typing.activeWord();
      if (!active || active.typed >= active.text.length) break;
      const expected = active.text[active.typed];
      const ok = this.rng.next() < this.effective("accuracy");
      const ch = ok ? expected : this.wrongFor(expected);
      const outcome = typing.handleChar(ch);
      if (outcome.kind === "commit" && outcome.commit) {
        // A word mid-sentence keeps the same prompt id, so the bot carries straight on
        // into the next word. Only a finished sentence earns a fresh beat.
        if (outcome.commit.sentenceDone) {
          this.targetId = null;
          this.wait = (this.cfg.decisionDelay / 1000) * 0.5;
        }
        return outcome.commit;
      }
    }
    return null;
  }

  private wrongFor(expected: string): string {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    let c = alphabet[this.rng.int(26)];
    let guard = 0;
    while (c === expected && guard++ < 8) c = alphabet[this.rng.int(26)];
    return c;
  }
}
