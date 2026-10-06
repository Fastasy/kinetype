// Kinetype — progression: XP, levels, and the boss campaign.
//
// Framework-free, like everything in game/. Nothing here may import react or next.
//
// XP MATH IS MIRRORED IN SQL: kinetype.xp_for_match() in
// db/migrations/0001_kinetype_accounts.sql. The SERVER is authoritative — it
// recomputes XP from clamped inputs so a tampered client cannot inflate a score.
// The function below exists so the HUD can preview a payout and so the curve is
// testable under plain Node. If you change one, change the other.
// game/tests/progression.test.ts pins this side of the contract.

import { BOT_WPM_LADDER, DIFFICULTY_PCT } from "./constants";

// ------------------------------------------------------------------ levels
/** XP step of the curve. level = floor(sqrt(xp / 100)) + 1  <=>  xp = (level-1)^2 * 100. */
export const XP_PER_LEVEL_STEP = 100;

/**
 * Level for a lifetime XP total.
 *
 * Reuses the curve the earlier Kinetype typing site shipped, so the number means
 * the same thing to anyone who saw it before: level 2 at 100 XP, level 3 at 400,
 * level 4 at 900, level 8 at 4 900, level 12 at 12 100.
 */
export function levelForXp(xp: number): number {
  const safe = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  return Math.floor(Math.sqrt(safe / XP_PER_LEVEL_STEP)) + 1;
}

/** XP at which `level` begins. Exact inverse of `levelForXp`. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return (l - 1) * (l - 1) * XP_PER_LEVEL_STEP;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP the current level spans in total. */
  levelSpan: number;
  /** XP still needed to reach the next level. */
  remaining: number;
  /** 0..1 fill of the current level. */
  pct: number;
}

/** Everything the XP bar needs, in one call. */
export function levelProgress(xp: number): LevelProgress {
  const safe = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const level = levelForXp(safe);
  const floorXp = xpForLevel(level);
  const ceilXp = xpForLevel(level + 1);
  const levelSpan = Math.max(1, ceilXp - floorXp);
  const intoLevel = safe - floorXp;
  return {
    level,
    intoLevel,
    levelSpan,
    remaining: Math.max(0, ceilXp - safe),
    pct: Math.min(1, intoLevel / levelSpan),
  };
}

// ---------------------------------------------------------------- rewards
export type MatchMode = "free" | "boss";

/** What one finished match earned. The performance terms both payouts share. */
export interface MatchRewardInput {
  won: boolean;
  roundsWon: number;
  wpm: number;
  /** Percent, 0..100. */
  accuracy: number;
  /** Matches won in a row BEFORE this one. The caller zeroes it on a loss. */
  streak: number;
  /**
   * The OPPONENT's rung. Difficulty scales a win and nothing else, and the caller must always
   * supply it: a payout that silently ignored the opponent is the bug this replaced.
   */
  botWpm: number;
}

export interface XpInput extends MatchRewardInput {
  mode: MatchMode;
  /** True only the FIRST time a given boss is beaten. */
  bossFirstClear?: boolean;
}

/**
 * The rung of BOT_WPM_LADDER an opponent sits on.
 *
 * Values between two rungs snap DOWN, and ties (45 sits between 40 and 50) also resolve downward,
 * which is the conservative direction: an ambiguous rung can only ever pay the lower figure.
 * Mirrors the `order by abs(wpm - p), idx limit 1` lookup in kinetype.difficulty_pct().
 */
export function rungIndexFor(botWpm: number): number {
  const wpm = Number.isFinite(botWpm) ? Math.max(0, botWpm) : BOT_WPM_LADDER[0];
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < BOT_WPM_LADDER.length; i += 1) {
    const distance = Math.abs(BOT_WPM_LADDER[i] - wpm);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** The percentage of a win that this opponent's rung is worth. See DIFFICULTY_PCT. */
export function difficultyPct(botWpm: number): number {
  return DIFFICULTY_PCT[rungIndexFor(botWpm)];
}

/**
 * Percentage scaling that is INTEGER-EXACT, on purpose.
 *
 * `Math.round(total * pct / 100)` drifts by a coin or two from Postgres once the division is
 * inexact in binary floating point, and the two sides are compared for exact equality.
 * `(total * pct + 50) / 100` with integer division is the same number in both languages, and it
 * rounds halves up.
 */
export function scaleByPct(total: number, pct: number): number {
  return Math.floor((total * pct + 50) / 100);
}

/**
 * The clamped performance terms both payouts are built from.
 * Mirrors the expression inside kinetype.xp_for_match() and kinetype.coins_for_match().
 */
export function performanceBase(i: MatchRewardInput): number {
  const rounds = Math.min(5, Math.max(0, i.roundsWon));
  const wpm = Math.min(400, Math.max(0, i.wpm));
  const accuracy = Math.min(100, Math.max(0, i.accuracy));
  const streak = Math.min(5, Math.max(0, i.streak));
  return (
    (i.won ? 40 : 12) +
    rounds * 10 +
    Math.round(wpm * 0.6) +
    Math.round((accuracy / 100) * 30) +
    streak * 8
  );
}

/**
 * XP for one finished match — mirrors kinetype.xp_for_match().
 *
 * Every term is clamped before it is summed, so a tampered payload cannot inflate the total, and
 * the server computes the same number independently. A WIN is scaled by the opponent's rung; a loss
 * is not. Winning a boss pays a flat bonus, and the first clear of any boss pays a one-time bounty
 * on top (the server refuses to pay that bounty twice — see submit_match). Those two are
 * deliberately NOT difficulty-scaled: the bounty is already priced per boss, from 25 coins for Tick
 * to 400 for Oblivion, and scaling it again would charge the same difficulty twice.
 */
export function xpForMatch(i: XpInput): number {
  const base = performanceBase(i);
  const scaled = i.won ? scaleByPct(base, difficultyPct(i.botWpm)) : base;
  return Math.max(0, scaled + (i.mode === "boss" ? 60 : 0) + (i.bossFirstClear ? 140 : 0));
}

/**
 * Coins for one finished match — mirrors kinetype.coins_for_match().
 *
 * The same formula as XP minus the boss terms, so the two currencies move together and the SQL
 * mirror stays one table instead of two. A loss pays the unscaled base, which is exactly what a loss
 * has always paid, so nothing about losing became more attractive.
 */
export function coinsForMatch(i: MatchRewardInput): number {
  const base = performanceBase(i);
  return Math.max(0, i.won ? scaleByPct(base, difficultyPct(i.botWpm)) : base);
}

// ------------------------------------------------------------------- bosses
export interface Boss {
  id: string;
  name: string;
  title: string;
  blurb: string;
  /** The rung of the bot ladder this boss fights at. */
  botWpm: number;
  /** Player level required before the fight can be entered. */
  unlockLevel: number;
  /** Rounds needed to win the fight. */
  bestOf: number;
  /** Coins the SERVER pays on the first clear (kinetype.boss_rewards, not the local save). */
  rewardCoins: number;
  /**
   * The arena this fight happens in (game/maps.ts). A boss is a PLACE as well as a rung of the
   * ladder — walking into Oblivion should not look like walking into Tick.
   */
  mapId: string;
}

/**
 * The boss campaign: nine fights across the game's nine-rung bot ladder (20..120 WPM).
 *
 * A boss is NOT a new difficulty system — it is a NAMED rung of the ladder the whole
 * game already runs on, gated behind a level and behind the previous boss. The free
 * WPM picker in /play is untouched; this is a separate mode you opt into.
 *
 * unlockLevel climbs on the XP curve: the first four bosses land on levels 1-4
 * (0 / 100 / 400 / 900 XP), then the gaps widen so the tail is earned. The final boss
 * needs level 12 (12 100 XP) and is fought best-of-five.
 *
 * Each boss also owns an ARENA (mapId), so the campaign moves you through ten different places
 * and free play keeps the training ground. The arena palette is data, not a reward — nothing
 * here is unlockable or purchasable, which is why no boss unlocks a map.
 */
export const BOSSES: readonly Boss[] = [
  { id: "tick",     name: "Tick",     title: "The Warm-Up",   blurb: "Reads every word out loud before it types it. Do not lose to Tick.",        botWpm: 20,  unlockLevel: 1,  bestOf: 3, rewardCoins: 25,  mapId: "dewfield" },
  { id: "bandit",   name: "Bandit",   title: "Quick Fingers", blurb: "Steals the round on a single sloppy space. Mind the gaps.",                  botWpm: 30,  unlockLevel: 2,  bestOf: 3, rewardCoins: 40,  mapId: "rust-canyon" },
  { id: "vex",      name: "Vex",      title: "The Needler",   blurb: "Death by a thousand punches. Keep your chain alive or drown in chip damage.", botWpm: 40,  unlockLevel: 3,  bestOf: 3, rewardCoins: 60,  mapId: "thorn-hollow" },
  { id: "havoc",    name: "Havoc",    title: "Heavy Hitter",  blurb: "Hunts kicks. Get a block under the telegraph or leave the platform.",         botWpm: 50,  unlockLevel: 4,  bestOf: 3, rewardCoins: 85,  mapId: "iron-quarry" },
  { id: "quartz",   name: "Quartz",   title: "Steady Hands",  blurb: "Never mistypes and never panics. Out-consistent it, or do not win.",          botWpm: 60,  unlockLevel: 5,  bestOf: 3, rewardCoins: 115, mapId: "crystal-vault" },
  { id: "cannon",   name: "Cannon",   title: "Loaded",        blurb: "One clean kick ends you at high damage. Stay off the red line.",             botWpm: 70,  unlockLevel: 6,  bestOf: 3, rewardCoins: 150, mapId: "foundry" },
  { id: "nimbus",   name: "Nimbus",   title: "Storm Typist",  blurb: "Blocks on reflex, counters on instinct. Your safest word is now a gamble.",   botWpm: 85,  unlockLevel: 8,  bestOf: 3, rewardCoins: 200, mapId: "storm-ridge" },
  { id: "vortex",   name: "Vortex",   title: "The Blur",      blurb: "Faster than you read. You will not out-speed it — out-think it.",            botWpm: 100, unlockLevel: 10, bestOf: 3, rewardCoins: 260, mapId: "neon-grid" },
  { id: "oblivion", name: "Oblivion", title: "Final Boss",    blurb: "120 WPM, best of five, no mercy. The last wall between you and the top.",     botWpm: 120, unlockLevel: 12, bestOf: 5, rewardCoins: 400, mapId: "the-void" },
] as const;

export function bossById(id: string): Boss | undefined {
  return BOSSES.find((b) => b.id === id);
}

export function bossIndex(id: string): number {
  return BOSSES.findIndex((b) => b.id === id);
}

/**
 * Whether a boss can be entered.
 *
 * Two conditions, both required: the player's level must clear the boss's gate, AND
 * the previous boss must already be beaten. The level gate alone would let a grinder
 * walk straight into the final fight; the sequence alone would let a level-1 player
 * grind free play and then meet a 100 WPM wall they were never eased toward.
 */
export function bossUnlocked(boss: Boss, level: number, cleared: Iterable<string>): boolean {
  if (level < boss.unlockLevel) return false;
  const idx = bossIndex(boss.id);
  if (idx <= 0) return true;
  const clearedSet = cleared instanceof Set ? cleared : new Set(cleared);
  return clearedSet.has(BOSSES[idx - 1].id);
}

/** Every boss id whose entry conditions the player currently meets. */
export function unlockedBosses(level: number, cleared: Iterable<string>): Boss[] {
  return BOSSES.filter((b) => bossUnlocked(b, level, cleared));
}

/** Total XP available from first-clearing every boss. */
export const BOSS_BOUNTY_TOTAL = BOSSES.length * 140;

/** The nine rungs the campaign spans, for copy and tests. */
export const BOSS_WPM_LADDER = BOSSES.map((b) => b.botWpm);

/** Sanity guard: the campaign must sit on the game's real bot ladder, in order. */
export function bossesMatchLadder(): boolean {
  return (
    BOSSES.length === BOT_WPM_LADDER.length &&
    BOSSES.every((b, i) => b.botWpm === BOT_WPM_LADDER[i] && b.unlockLevel >= 1)
  );
}
