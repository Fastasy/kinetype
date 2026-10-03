// The combo: a chain of flawlessly typed words that escalates damage and screen intensity.
//
// WHY A CHAIN AND NOT JUST THE PRECISION BONUS. The precision bonus already rewards one
// clean word (+25% damage), but it has no memory: a player at 95% accuracy and one at 100%
// deal almost the same damage and nothing ever BUILDS. A fight has no arc. The combo gives
// clean typing a memory — the longer you go without a mistake, the harder every move lands —
// so a round has a shape: timid opening, escalating middle, a peak you can lose.
//
// ONE RULE, and it is the whole rule: any mistake breaks the chain. A wrong letter, a missed
// separator, a stray space mid-word. There is no partial credit and no grace window, because
// a rule the player has to think about is a rule they cannot feel.
//
// Deliberately NOT broken by taking a hit. The chain measures the player's typing, and
// nothing else; mixing in the opponent's success would make it a second health bar and
// muddle the one signal the HUD is trying to send.

import { COMBO_BONUS_PER_STEP, COMBO_MAX_STEPS, COMBO_STEP } from "./constants";

/**
 * How far up the ladder a chain of `chain` flawless words has climbed.
 *
 * chain 0-2 -> 0 steps (no bonus yet: two words is a coincidence, not a streak)
 * chain 3-5 -> 1 step, 6-8 -> 2, 9-11 -> 3, 12+ -> 4 (the cap)
 */
export function comboSteps(chain: number): number {
  if (!Number.isFinite(chain) || chain <= 0) return 0;
  return Math.min(COMBO_MAX_STEPS, Math.floor(chain / COMBO_STEP));
}

/** Damage multiplier earned by the chain. Exactly 1 until the first step is reached. */
export function comboMultiplier(chain: number): number {
  return 1 + comboSteps(chain) * COMBO_BONUS_PER_STEP;
}

/**
 * 0..1 intensity, for scaling screen shake, hitstop, particles and glow.
 *
 * Zero until the chain pays anything, so the screen stays calm while the player is merely
 * doing well and only starts shouting once they are on a run. A HUD that is intense all the
 * time has no headroom left to be exciting with.
 */
export function comboIntensity(chain: number): number {
  return comboSteps(chain) / COMBO_MAX_STEPS;
}
