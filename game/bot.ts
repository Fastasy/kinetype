// Bot opponent.
//
// Design rules from the research:
//   - Difficulty ramps on ONE axis (typing speed), smoothed, with the player
//     choosing it explicitly. Typing skill is uncorrelated with gaming skill, so
//     "easy/normal/hard" would tell the player nothing.
//   - Adaptive correction is bounded (ADAPT_MAX) and only ever applied between
//     rounds, so it can never be felt as cheating inside a round.
//   - The bot plays yomi layer 2: it prefers light words against a player who
//     parries often, because a wasted parry window is an opening.

import {
  ADAPT_MAX,
  BOT_ACCURACY_LADDER,
  BOT_DECISION_DELAY,
  BOT_PARRY_SKILL,
  BOT_WPM_LADDER,
} from "./constants";
import type { Rng } from "./rng";
import type { Fighter, Prompt } from "./types";
import { TypingRun } from "./typing";

export interface BotConfig {
  targetWpm: number;
  accuracy: number;
  /** Median ms between finishing a word and committing to the next. */
  decisionDelay: number;
  /** Probability of completing an offered guard word in time. */
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
  /** Which guard word the parry roll was made for, and what it decided. */
  private guardDecisionId: number | null = null;
  private willParry = false;

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
    this.guardDecisionId = null;
    this.willParry = false;
  }

  private effective(metric: "wpm" | "accuracy" | "parry"): number {
    if (metric === "wpm") return this.cfg.targetWpm * (1 + this.adapt);
    if (metric === "accuracy") return Math.min(0.995, this.cfg.accuracy + this.adapt * 0.05);
    return Math.max(0, Math.min(0.95, this.cfg.parrySkill + this.adapt * 0.2));
  }

  /**
   * Roll parry competence ONCE per guard word, not per keystroke.
   *
   * With a single live word the bot has no word to choose, so parry skill had to move
   * somewhere. A bot that fails this roll never types the guard word and eats the hit it
   * failed to block, which is what "missed the parry" should look like.
   */
  private shouldParry(prompt: Prompt): boolean {
    if (this.guardDecisionId !== prompt.id) {
      this.guardDecisionId = prompt.id;
      this.willParry = this.rng.chance(this.effective("parry"));
    }
    return this.willParry;
  }

  /**
   * Advance the bot. Feeds characters into `typing` exactly as a human would, so
   * there is no separate code path for bot attacks.
   *
   * IMPORTANT: this returns the commit rather than applying it. Damage and
   * knockback are applied in Match.commitWord, and the bot must go through the
   * same door as the player. Applying it here silently produced bots that typed
   * words at full speed and never landed a single hit.
   */
  update(
    dt: number,
    typing: TypingRun,
    self: Fighter,
  ): { prompt: Prompt; precision: boolean } | null {
    if (self.state === "ko" || self.state === "hitstun" || self.state === "staggered") {
      return null;
    }

    this.wait -= dt;
    if (this.wait > 0) return null;

    const live = typing.prompts[0];
    if (!live) return null;

    // A word the bot has not started yet: take a beat, the way a human reads it first.
    if (live.id !== this.targetId) {
      this.targetId = live.id;
      // No deliberation while falling: a recovery word is on a 1.8s clock.
      this.wait = typing.inRecovery
        ? 0
        : (this.cfg.decisionDelay / 1000) * (0.7 + this.rng.next() * 0.6);
      return null;
    }

    // Guard word: only a bot that won its parry roll types it.
    if (live.kind === "guard" && !this.shouldParry(live)) return null;

    const cps = (this.effective("wpm") * 5) / 60;
    this.budget += cps * dt;
    let guard = 0;
    while (this.budget >= 1 && guard++ < 12) {
      this.budget -= 1;
      const current = typing.prompts[0];
      // The word changed under us (guard offered, recovery entered), or it is finished.
      if (!current || current.id !== this.targetId) break;
      if (current.typed >= current.text.length) break;
      const expected = current.text[current.typed];
      const ok = this.rng.next() < this.effective("accuracy");
      const ch = ok ? expected : this.wrongFor(expected);
      const outcome = typing.handleChar(ch);
      if (outcome.kind === "commit" && outcome.commit) {
        this.targetId = null;
        this.wait = (this.cfg.decisionDelay / 1000) * 0.5;
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
