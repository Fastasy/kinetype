// Kinetype — tuning constants.
// Every number a designer might want to touch lives here.
// See docs/GAME-DESIGN.md; if code and spec disagree, code is wrong.

/** Fixed simulation step, seconds. Render may interpolate; the sim never varies. */
export const STEP = 1 / 60;

// ---------------------------------------------------------------- physics
export const GRAVITY = 2400;
export const DRIFT_ACCEL = 1500;
export const MAX_DRIFT = 300;
export const AIR_DRAG = 0.995;
export const GROUND_FRICTION = 0.82;

/** Knockback units -> launch velocity (px/s). Smash uses 0.03 units/frame; we work in px/s. */
export const KB_TO_VELOCITY = 9;
/** Exponential horizontal decay rate while airborne (per second). Tuned so a
 *  heavy word KOs from centre around 90% damage and a light word never does.
 *  Launch arcs and stops; knockback units and pixels are different quantities. */
export const LAUNCH_DECAY = 2.2;

/**
 * Fixed hurtbox for every fighter, in px, independent of the equipped skin.
 * Sakurai's hitstop notes: hurtboxes must stay static while visuals vibrate, or
 * attacks that should connect start missing. Skins change the drawing, never this.
 *
 * Sized to sit inside the pixel sprite (12x16 cells at scale 7 = 84x112), so the
 * sprite's hair rides above the hurtbox while its feet take the hits. Re-derived when
 * the roster moved from vector silhouettes to pixel art, and again when the sprite scale
 * went from 5 to 7.
 */
export const HURTBOX = { w: 62, h: 88 };

// ---------------------------------------------------------------- hitstun
/** Hitstun is derived from knockback, never an independent timer.
 *  The factor and cap are tuned so the curve stays LIVE across the whole practical
 *  knockback range (roughly 40 to 220 units). A cap that saturates early is the
 *  Brawl failure mode wearing a different hat. */
export const HITSTUN_FACTOR = 0.25;
export const HITSTUN_MIN = 0.1; // seconds
export const HITSTUN_MAX = 0.75; // seconds
/**
 * Minimum gap between two hits LANDING on the same fighter.
 *
 * This is not a nicety, it is the anti-degeneracy rule. In browser testing a player
 * landed a word roughly every 0.17s while max hitstun is 0.75s, so the opponent was
 * permanently stunned and never got a turn. That is exactly the failure Sirlin
 * describes: one dominant strategy (spam the fastest word) with no counterplay.
 *
 * The invariant that makes it safe: HIT_COOLDOWN must always exceed HITSTUN_MAX, so
 * the victim is guaranteed HIT_COOLDOWN - HITSTUN_MAX seconds of free action after
 * every hit. Currently 1.05 - 0.75 = 0.30s. game/tests/engine.test.ts enforces it.
 *
 * It also improves the game on its own terms: hits become precious, so timing a
 * heavy word matters more than typing volume.
 */
export const HIT_COOLDOWN = 1.05;
/** The Brawl rule: escape may never be on a fixed schedule. */
export const HITSTUN_ESCAPABLE = false;

// ---------------------------------------------------------------- juice
export const HITSTOP_MAX = 0.1; // seconds (6 frames at 60fps)
export const HITSTOP_MIN = 0.033; // 2 frames
export const SHAKE_DECAY = 6.5;
export const SHAKE_MAX = 26; // px

// ---------------------------------------------------------------- the stage
export const STAGE = {
  width: 1280,
  height: 720,
  platforms: [
    { x: 340, y: 560, w: 600 }, // main
    { x: 236, y: 428, w: 168 }, // left float
    { x: 876, y: 428, w: 168 }, // right float
  ],
  blast: { left: 44, right: 1236, bottom: 800 },
};

export const SPAWN = {
  // Equidistant from their OWN blast line, so neither side starts at an advantage.
  left: { x: 540, y: 500 },
  right: { x: 740, y: 500 },
};

// ---------------------------------------------------------------- match
export const ROUND_TIME = 90; // seconds
export const COUNTDOWN_TIME = 2.2;
export const FINISH_MAX_TIME = 6; // lame-duck bound
export const ROUND_END_HOLD = 1.6;
/** Damage above which a fighter is one light hit from the blast line. */
export const FINISH_DAMAGE_HINT = 110;
/** Horizontal distance to blast line that counts as "about to die". */
export const SPARK_DISTANCE = 240;

// ---------------------------------------------------------------- typing
export const PROMPTS_PER_FIGHTER = 3;
/** Guard words appear in the middle slot; recovery words replace everything. */
export const GUARD_WORD_LENGTH = 5;
export const RECOVERY_WORD_LENGTH = 5;
export const RECOVERY_WINDOW = 1.8; // seconds
export const RECOVERY_INVULN = 0.6; // seconds
/**
 * Each successful save in a round shortens the next window. Without this, a bot
 * that types well saves itself every single time and the round can only ever end on
 * the clock, so the KO fantasy never lands. Escalating difficulty is also the
 * platform-fighter convention: recovering gets harder the more you have been hit.
 */
export const RECOVERY_WINDOW_STEP = 0.25; // seconds removed per prior save
export const RECOVERY_WINDOW_MIN = 0.8; // seconds floor
export const COUNTER_WINDOW = 2.5; // seconds
export const COUNTER_MULTIPLIER = 2.0;
export const PARRY_MULTIPLIER = 0.3;
/** Seconds a heavy attacker must have committed before the telegraph shows. */
export const TELEGRAPH_COMMIT_CHARS = 2;
export const PRECISION_DAMAGE_BONUS = 0.25;
export const STRICT_STAGGER = 0.4; // seconds, opt-in only
/** Rolling window for live WPM, seconds. */
export const WPM_WINDOW = 8;

// ---------------------------------------------------------------- economy
export const COIN_BASE_WIN = 40;
export const COIN_BASE_LOSS = 12;
export const COIN_PER_ROUND = 10;
export const COIN_WPM_FACTOR = 0.6;
export const COIN_ACCURACY_FACTOR = 30;
export const COIN_STREAK_STEP = 8;
export const COIN_STREAK_CAP = 5;

// ---------------------------------------------------------------- bot
/** The explicit WPM ladder. Not easy/normal/hard: typing skill is uncorrelated with gaming skill. */
export const BOT_WPM_LADDER = [20, 30, 40, 50, 60, 70, 85, 100, 120] as const;
export const BOT_ACCURACY_LADDER = [0.90, 0.93, 0.95, 0.96, 0.97, 0.975, 0.98, 0.985, 0.99] as const;
export const BOT_DECISION_DELAY = [520, 470, 430, 390, 350, 320, 290, 260, 230] as const;
export const BOT_PARRY_SKILL = [0.05, 0.12, 0.2, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9] as const;
/** Adaptive correction is bounded and never applied inside a round. */
export const ADAPT_MAX = 0.12;

// ---------------------------------------------------------------- storage
export const STORAGE_KEY = "kinetype.save.v1";
