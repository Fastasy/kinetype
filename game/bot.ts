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
  FINISH_DAMAGE_HINT,
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
  }

  private effective(metric: "wpm" | "accuracy" | "parry"): number {
    if (metric === "wpm") return this.cfg.targetWpm * (1 + this.adapt);
    if (metric === "accuracy") return Math.min(0.995, this.cfg.accuracy + this.adapt * 0.05);
    return Math.max(0, Math.min(0.95, this.cfg.parrySkill + this.adapt * 0.2));
  }

  private chooseTarget(
    typing: TypingRun,
    self: Fighter,
    opponent: Fighter,
    opponentParryRate: number,
  ): Prompt | undefined {
    if (typing.inRecovery) return typing.prompts[0];

    // Parry opportunity: a guard word is live and we have the skill to take it.
    const guard = typing.prompts.find((p) => p.kind === "guard");
    if (guard && this.rng.chance(this.effective("parry"))) return guard;

    const attacks = typing.prompts.filter((p) => p.kind === "attack");
    if (attacks.length === 0) return undefined;

    // Yomi layer 2: a player who parries a lot is wasting windows. Punish with speed.
    if (opponentParryRate > 0.45) {
      return attacks.find((p) => p.tier === "light") ?? attacks[0];
    }
    // Counter window is live: cash it with the biggest word available.
    if (self.counter > 0) {
      return attacks.find((p) => p.tier === "heavy") ?? attacks[attacks.length - 1];
    }
    // Target is nearly dead: take the KO.
    if (opponent.damage >= FINISH_DAMAGE_HINT) {
      return attacks.find((p) => p.tier === "heavy") ?? attacks[0];
    }
    // Default: prefer light for tempo, occasionally pick mid.
    const lights = attacks.filter((p) => p.tier === "light");
    if (lights.length && this.rng.chance(0.7)) return lights[0];
    return attacks[this.rng.int(attacks.length)];
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
    opponent: Fighter,
    opponentParryRate: number,
  ): { prompt: Prompt; precision: boolean } | null {
    if (self.state === "ko" || self.state === "hitstun" || self.state === "staggered") {
      return null;
    }

    this.wait -= dt;
    if (this.wait > 0) return null;

    let target = typing.prompts.find((p) => p.id === this.targetId);
    if (!target) {
      target = this.chooseTarget(typing, self, opponent, opponentParryRate);
      if (!target) return null;
      const idx = typing.prompts.findIndex((p) => p.id === target!.id);
      typing.selectSlot(idx);
      this.targetId = target.id;
      // No deliberation while falling: a recovery word is on a 1.8s clock.
      this.wait = typing.inRecovery
        ? 0
        : (this.cfg.decisionDelay / 1000) * (0.7 + this.rng.next() * 0.6);
      return null;
    }

    const cps = (this.effective("wpm") * 5) / 60;
    this.budget += cps * dt;
    let guard = 0;
    while (this.budget >= 1 && guard++ < 12) {
      this.budget -= 1;
      const live = typing.prompts.find((p) => p.id === this.targetId);
      if (!live || live.typed >= live.text.length) break;
      const expected = live.text[live.typed];
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
