// Achievement flares — what was actually NOTABLE about a match.
//
// This lives in game/ rather than in the result card for two reasons. It is game logic (what
// counts as an achievement is a design decision about the game, not about how it is laid out), and
// keeping it framework-free means the thresholds can be asserted in the plain-node test suite
// instead of only being visible on screen. The rule at the top of game/match.ts applies: nothing
// under game/ may import react or next.

import { COMBO_FIRE_CHAIN } from "./constants";
import type { MatchResult } from "./types";

export interface Flare {
  label: string;
  /** achievement = something worth naming; plain = a fact about the match. */
  tone: "achievement" | "plain";
}

/**
 * The thresholds, named so they cannot drift and so the test can assert them directly rather than
 * restating the numbers.
 */
export const FLARE_RULES = {
  /** Accuracy at or above this is a flawless run. */
  flawlessAccuracy: 98,
  /** A chain at or above the ladder's top rung. */
  onFireChain: COMBO_FIRE_CHAIN,
  /** A win streak worth announcing. */
  streak: 3,
  /** No more than this many chips ever reach the banner. */
  maxFlares: 4,
} as const;

/**
 * Name what the player actually did.
 *
 * A result card that only says "WIN" teaches nothing and reads like a form being filed. These
 * sentences are the point of the card: "you won" is already on the screen, "you never dropped a
 * round" is information.
 *
 * `bestWpmEver` is the best AFTER this match was banked — applyOutcome has already run by the time
 * the card renders — so `wpm >= bestWpmEver` means this match is the fastest on record. That is
 * also the correct answer on a tie, which is why it is `>=` and not `>`.
 *
 * Both numbers being compared are the match AVERAGE (game/typing.ts:averageWpm), not the rolling
 * peak, which is why the flare says fastest match rather than top speed: it is comparing two honest
 * averages, and a label that promised a peak while showing an average would be the same small lie
 * the payout used to tell.
 *
 * The fastest-match flare is deliberately available on a LOSS as well: "you lost, and you have never
 * typed faster" is the true and useful sentence, and a loss that names an improvement is not a
 * flat wall. Everything else is win-only.
 */
export function matchFlares({
  result,
  bestWpmEver,
  firstWinToday,
  isBoss,
}: {
  result: MatchResult;
  bestWpmEver: number;
  firstWinToday: boolean;
  isBoss: boolean;
}): Flare[] {
  const out: Flare[] = [];

  if (result.humanWon) {
    // A clean sweep is the rarest thing a win can be, so it leads.
    if (result.roundsLost === 0) out.push({ label: "CLEAN SWEEP", tone: "achievement" });
    if (result.accuracy >= FLARE_RULES.flawlessAccuracy) {
      out.push({ label: `FLAWLESS · ${result.accuracy.toFixed(1)}%`, tone: "achievement" });
    }
    if (result.bestCombo >= FLARE_RULES.onFireChain) {
      out.push({ label: `ON FIRE · CHAIN ${result.bestCombo}`, tone: "achievement" });
    }
    if (isBoss) out.push({ label: "BOSS DOWN", tone: "achievement" });
    if (firstWinToday) out.push({ label: "FIRST WIN TODAY", tone: "plain" });
    if (result.streak >= FLARE_RULES.streak) {
      out.push({ label: `${result.streak} IN A ROW`, tone: "achievement" });
    }
  }

  if (result.wpm > 0 && result.wpm >= bestWpmEver) {
    out.push({ label: `FASTEST MATCH · ${result.wpm} WPM`, tone: "plain" });
  }

  // Capped so a freak match cannot paper the banner in chips. Order is the priority order, so the
  // cap drops the least interesting rather than an arbitrary one.
  return out.slice(0, FLARE_RULES.maxFlares);
}
