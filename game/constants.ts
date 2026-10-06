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
  // Both fighters start in the MIDDLE of the main platform (340..940, centre 640).
  // Ruan's call: after a KO the next round should restart in the centre of the stage,
  // not out at the wide marks. 88px apart, which clears the 84px-wide sprite and the
  // 62px hurtbox, so nobody starts already overlapping their opponent. Symmetric about
  // the centre, so it is still equidistant from each own blast line and neither side
  // starts at an advantage.
  left: { x: 596, y: 500 },
  right: { x: 684, y: 500 },
};

// ---------------------------------------------------------------- sentence moves
/**
 * A sentence is the unit of input and every word in it is a move:
 *
 *   <= BLOCK_MAX_CHARS                block  — raises a guard
 *   BLOCK_MAX_CHARS+1 .. KICK_MIN_CHARS-1  punch — the ordinary hit
 *   >= KICK_MIN_CHARS                 kick   — the heavy, KO-capable hit
 *
 * Kept in sync with scripts/build-sentences.py, which classifies the pool with the
 * same two numbers, and asserted by game/tests/engine.test.ts.
 */
export const BLOCK_MAX_CHARS = 3;
export const KICK_MIN_CHARS = 8;

/**
 * The guard a completed block word raises.
 *
 * The guard is short on purpose. A long one would mean the fighter who happens to be
 * mid-sentence on a small word is permanently protected, and knockback would stop
 * mattering. BLOCK_HOLD is roughly one word's worth of typing, so blocking is
 * something a player aims rather than something they sit in.
 */
export const BLOCK_HOLD = 1.15; // seconds
/** Knockback taken while guarded. A punch is smothered, never stopped dead. */
export const BLOCK_KB_MULTIPLIER = 0.45;
/** Damage taken while guarded. Chip damage, so the escalation clock keeps ticking. */
export const BLOCK_DAMAGE_MULTIPLIER = 0.6;

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
/**
 * How many prompts are live at once. One: the player is given a sentence, not a menu.
 * The input path only ever reads `prompts[0]`, so raising this number on its own is not
 * enough — a multi-sentence mode means reworking the input layer too.
 */
export const PROMPT_COUNT = 1;
/** The recovery word replaces the live sentence entirely, while falling. */
export const RECOVERY_WORD_LENGTH = 5;

/**
 * THE SAVE IS MEASURED IN CHARACTERS, NOT SECONDS (changed 2026-10-05).
 *
 * It used to be a flat seconds window (1.8s, -0.25s per prior save, floor 0.8s). That
 * made the difficulty of surviving a ring-out a pure function of the fighter's WPM,
 * because the test collapsed to one comparison:
 *
 *     (fixed 5-char word) / (WPM x cps)  <=  (fixed seconds)
 *
 * Both sides of that are linear in DIFFERENT units, so it is not a curve, it is a
 * single threshold — and it measured as a step, not a ramp:
 *
 *     <=30 WPM   never saves   (a 5-char word takes 2.0s+, window is 1.8s)
 *     40 WPM     saves twice
 *     70 WPM     saves four times      <- Ruan: "the bot gets almost every rescue word right"
 *     >=85 WPM   NEVER FAILS   (needs 0.71s, the 0.8s floor guarantees it)
 *
 * Measured, 6 matches per cell: the BOT's save rate at the top of the ladder was
 * 143/143 at 120v120, 154/155 at 100v100 and 207/209 at 120v100 — and at 85 WPM it still
 * made 89% of its saves from the eighth attempt onward. Rounds up there ended on the
 * clock because a KO was arithmetically impossible, which is the exact failure the
 * escalating window had been added to prevent. The bottom is the same failure mirrored:
 * a 20 or 30 WPM fighter — bot OR player — could never save at all, so the recovery
 * fantasy, the genre's core tension, never happened for a slow typist either.
 *
 * Worse, it double-dipped on the single axis the game has: speed decided both who
 * LANDS hits and who SURVIVES them, so there was nothing else to be good at. A player
 * at exactly the bot's WPM won 100% against the 70 bot and 0% against the 120 bot.
 *
 * The window is therefore now denominated in CHARACTERS and converted to seconds using
 * the DIFFICULTY RUNG the match is being played at, not the fighter's own speed. The
 * fighter is asked "can you type N characters' worth in the time it takes you to type
 * N characters", which is a question about a player's margin over the rung rather than
 * about their absolute WPM. Consequences, all of them intended:
 *
 *   - Every rung grants the same number of lives, so no rung is immortal.
 *   - A KO is always reachable, so rounds end in a KO instead of the clock.
 *   - A player faster than the rung recovers comfortably; a player slower than the rung
 *     does not. Speed still buys survival, it just no longer decides it outright.
 *   - Accuracy buys a life, because a mistype costs a character of the budget.
 *
 * THE SLIDER, measured (8 matches per cell at 70v70, probe-balance.ts). `lives` is how many
 * times a fighter at the rung's own speed survives before the budget drops under the
 * 5-char word. The aggregate save% RISES with lives by construction — only the LAST attempt
 * fails — so more lives does not mean "harder", it means "the opponent saves more often
 * before it finally dies", which is what read as unbeatable in the first place:
 *
 *   slack | lives | ~match @70v70 | bot saves % | timeouts per 8 matches
 *      8  |   3   |      63s      |     74%     |         0
 *      9  |   4   |      67s      |     81%     |         0
 *     12  |   6   |     107s      |     86%     |         1
 *     16  |   9   |     145s      |     93%     |   5  (9-10 at the slow rungs)
 *
 * 8 is the shipped value: the lowest save rate, no timeouts, and a round short enough to
 * keep a best-of-three inside a minute. NOTE it does NOT reach the 3-4 minute match the
 * original brief asked for, and note how flat the length response is — four extra lives buy
 * 4 seconds at slack 9 and only reach 145s at nine lives, by which point the opponent saves
 * 93% of everything and the slow rungs are timing out. A ring-out costs about 7 seconds of
 * clean hitting, so match length is governed by the DAMAGE ramp, not by this constant. See
 * the balance note before reaching for this number to fix match length.
 *
 * Any value where `slack - k * step` lands exactly on the 5-char word length is a bad value
 * (slack 10 does: 10 - 1.25*4 = 5.0, and that 5th save measured 0% at most rungs but 76% at
 * others — a quantisation coin-flip, not a difficulty).
 */
export const RECOVERY_SLACK_CHARS = 8;
/**
 * Characters removed from the budget per save already made this round.
 *
 * 1.25 and not 1.0 on purpose. With a step of exactly 1 the fourth save is handed a
 * budget of exactly RECOVERY_WORD_LENGTH, which is not a difficulty — it is a
 * quantisation coin-flip (measured: 0% at 30/50/60/70/85/100/120 WPM but 55% at 20).
 * A step that leaves every budget clear of the word length makes the life count a
 * number a designer can read off the table instead of a rounding artifact.
 *
 * At parity this yields 3 lives for a clean typist and 2 for a sloppy one (a mistype
 * costs a character of budget), and the count is flat across the ladder.
 */
export const RECOVERY_STEP_CHARS = 1.25;

/** Seconds one character takes at `wpm`. The conversion the recovery rule is built on. */
export function secondsPerChar(wpm: number): number {
  return 60 / (Math.max(1, wpm) * 5);
}

/**
 * The save window, in seconds, for a fighter being rung out at difficulty rung `rungWpm`
 * with `recoveries` saves already made this round.
 *
 * THE ONLY PLACE THIS IS COMPUTED. The match, the probe and the test suite all call it,
 * so they cannot drift — the old inline formula was duplicated in three places and the
 * step function survived in all three.
 *
 * Returns 0 once the budget is spent, which is deliberate: the fighter is out of lives
 * for the round and the ring-out kills. A floor in seconds was what made a fast bot
 * immortal, so there is deliberately no floor here beyond zero.
 */
export function recoveryWindowSeconds(rungWpm: number, recoveries: number): number {
  const chars = RECOVERY_SLACK_CHARS - recoveries * RECOVERY_STEP_CHARS;
  return Math.max(0, chars) * secondsPerChar(rungWpm);
}

/** Invulnerability granted by a successful save, so the attacker cannot immediately re-hit. */
export const RECOVERY_INVULN = 0.6; // seconds

export const COUNTER_WINDOW = 2.5; // seconds
export const COUNTER_MULTIPLIER = 2.0;
export const PARRY_MULTIPLIER = 0.3;
/** Seconds a heavy attacker must have committed before the telegraph shows. */
export const TELEGRAPH_COMMIT_CHARS = 2;
export const PRECISION_DAMAGE_BONUS = 0.25;
export const STRICT_STAGGER = 0.4; // seconds, opt-in only
/** Rolling window for live WPM, seconds. */
export const WPM_WINDOW = 8;
/**
 * Shortest span a WPM reading may be measured over, seconds.
 *
 * A rate needs a denominator worth dividing by. Two keystrokes 30ms apart is not a
 * speed, it is the start of a sentence, and reporting a number from it swung the HUD
 * from 0 to 200 in the first moments of every round. Below this span the meter reports
 * 0 and waits for enough keystrokes to mean something.
 */
export const WPM_MIN_SPAN = 1;

// ---------------------------------------------------------------- input buffer
/**
 * How many keystrokes are held while the player cannot act.
 *
 * A hit landing mid-word used to DELETE the keystrokes pressed during the stun: the
 * input path returned false and the character was gone. Ruan hit it directly — "when he
 * hits me and I type a letter at the same time, it does not register" — and it is the
 * single worst feel bug a typing game can have, because the player is mid-flow and their
 * hands keep moving. The identical thing happened during the 2.2s countdown.
 *
 * So input that cannot be applied now is held instead of dropped, and delivered in order
 * the moment it becomes legal. Three is the cap: it is enough to cover the keystrokes a
 * player fires off while being knocked back, and far too few to bank a whole word during
 * a long stun. Past the cap the excess is discarded rather than queued forever.
 */
export const INPUT_BUFFER_MAX = 3;

// ---------------------------------------------------------------- combo
/**
 * Flawless words per rung of the combo ladder.
 *
 * Three is the smallest chain that reads as intentional rather than lucky. It is also
 * comfortably reachable inside ONE sentence: the pool's sentences run 4 to 16 words, so a
 * clean short sentence clears the first rung and a clean long one peaks the ladder. A player
 * who cannot feel the combo build inside a single sentence never learns it exists.
 */
export const COMBO_STEP = 3;
/** Damage added per rung. At the cap that is +60% — big enough to want, small enough that
 *  a clean player still has to land the hit, and it stacks ON TOP of the precision bonus. */
export const COMBO_BONUS_PER_STEP = 0.15;
/**
 * The rung the ladder stops at, i.e. a chain of COMBO_STEP * COMBO_MAX_STEPS (12) flawless
 * words. Capping matters: without it, a chain across several rounds would compound until one
 * punch ended the match and the escalation would eat its own tension.
 */
export const COMBO_MAX_STEPS = 4;
/** Chains at or above this show as "ON FIRE" in the HUD. Purely presentational. */
export const COMBO_FIRE_CHAIN = COMBO_STEP * COMBO_MAX_STEPS;

// ---------------------------------------------------------------- economy
export const COIN_BASE_WIN = 40;
export const COIN_BASE_LOSS = 12;
export const COIN_PER_ROUND = 10;
export const COIN_WPM_FACTOR = 0.6;
export const COIN_ACCURACY_FACTOR = 30;
export const COIN_STREAK_STEP = 8;
export const COIN_STREAK_CAP = 5;

/**
 * What a WIN is worth, as a PERCENTAGE, indexed by the rung of BOT_WPM_LADDER.
 *
 * The problem this fixes: the payout used to ignore the opponent entirely, so beating the 20 WPM
 * warm-up paid exactly what beating the 120 WPM final boss paid. Difficulty was decorative.
 *
 * Index 2 (the 40 WPM rung) is deliberately 100, and that is the whole balance argument. Break-even
 * sits at 0.75-0.95x the player's own speed and the general adult average is 40-52 WPM, so the
 * median player settles on rung 30-40. Anchoring there leaves the economy pace chosen in migration
 * 0007 (about 28 days to own everything) intact for a median player, while every rung above it is
 * now earned. If the 0007 pace needs retuning, move that anchor or the price tiers, not both.
 *
 * LOSSES ARE NOT SCALED BY THIS TABLE. A loss pays exactly what it always paid, which is what stops
 * "select the hardest bot and throw matches" from becoming a farm. See coinsForMatch().
 */
export const DIFFICULTY_PCT = [75, 88, 100, 125, 155, 190, 230, 275, 325] as const;

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
