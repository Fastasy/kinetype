// Knockback math.
//
// Adapted from the published Super Smash Bros. formula (Melee through Ultimate):
//
//   KB = ( ( ( ( (p/10 + p*d/20) * (200/(w+100)) * 1.4 ) + 18 ) * s ) + b ) * r
//
// p = target damage percent after this hit, d = damage this hit deals,
// w = target weight, s = knockback scaling / 100, b = base knockback,
// r = situational multiplier.
//
// Two design properties are load-bearing and must not be "simplified" away:
//   1. Knockback is monotone and superlinear in accumulated damage. Damage is an
//      escalation clock, not a health bar: the p*d/20 term multiplies current
//      damage by the attack's damage.
//   2. Hitstun is DERIVED from knockback, never an independent timer. Brawl let
//      players cancel hitstun on a fixed schedule and true combos collapsed.

import { HITSTUN_FACTOR, HITSTUN_MAX, HITSTUN_MIN, KB_TO_VELOCITY } from "./constants";
import type { AttackMove } from "./types";

export interface MoveProfile {
  /** d — damage dealt by this move. */
  damage: number;
  /** s — knockback scaling, expressed as a multiplier (Smash divides by 100). */
  scaling: number;
  /** b — base knockback, added after scaling. Gives launch even at 0%. */
  base: number;
  /** Launch angle above horizontal, degrees. Punches pop up, kicks send flat. */
  angle: number;
  /** Label for the HUD. */
  label: string;
}

/**
 * The two attacking moves. Blocks are not here: a block never enters the knockback
 * maths, it only changes what the defender takes (see BLOCK_* in constants.ts).
 *
 * Kicks carry the heavy profile: lower base knockback, higher scaling, so they are
 * ordinary early and lethal once damage has accumulated. That two-knob structure is
 * the one the design research documents, and it is why the KO move is the long word.
 */
export const MOVE: Record<AttackMove, MoveProfile> = {
  punch: { damage: 8, scaling: 1.05, base: 20, angle: 32, label: "PUNCH" },
  kick: { damage: 14, scaling: 1.25, base: 14, angle: 20, label: "KICK" },
};

export interface KnockbackInput {
  /** Target's damage percent BEFORE this hit lands. */
  targetDamage: number;
  /** Attack's damage. */
  damage: number;
  /** Target weight. 100 = baseline. */
  weight: number;
  /** Attack scaling. */
  scaling: number;
  /** Attack base knockback. */
  base: number;
  /** Situational multiplier: parry 0.3, counter 2.0, otherwise 1. */
  situational: number;
}

/** Raw knockback units. */
export function knockbackUnits(input: KnockbackInput): number {
  const p = input.targetDamage + input.damage;
  const weightFactor = 200 / (input.weight + 100);
  return (
    ((((p / 10 + (p * input.damage) / 20) * weightFactor * 1.4) + 18) *
      input.scaling +
      input.base) *
    input.situational
  );
}

/** Hitstun in seconds, derived from the knockback actually taken. */
export function hitstunSeconds(kb: number): number {
  const raw = (kb * HITSTUN_FACTOR) / 60;
  return Math.min(HITSTUN_MAX, Math.max(HITSTUN_MIN, raw));
}

export interface Launch {
  kb: number;
  vx: number;
  vy: number;
  hitstun: number;
}

/**
 * Convert knockback units into a launch velocity. Knockback units and pixels
 * travelled are deliberately different quantities so launches arc and stop
 * rather than teleporting.
 */
export function launchFrom(
  input: KnockbackInput,
  angleDeg: number,
  facingOfAttacker: 1 | -1,
): Launch {
  const kb = knockbackUnits(input);
  const speed = kb * KB_TO_VELOCITY;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    kb,
    // Pushed away from the attacker, toward the victim's own blast line.
    vx: Math.cos(rad) * speed * facingOfAttacker,
    vy: -Math.sin(rad) * speed,
    hitstun: hitstunSeconds(kb),
  };
}

/** Damage colour gradient. Cheapest legible damage meter: no numbers required. */
export function damageColour(damage: number): string {
  if (damage < 30) return "#f4f4f5";
  if (damage < 60) return "#facc15";
  if (damage < 100) return "#fb923c";
  if (damage < 150) return "#ef4444";
  return "#3f0d0d";
}
