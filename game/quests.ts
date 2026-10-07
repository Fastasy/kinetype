// Kinetype — quests: the daily/weekly rotation, the reward table, and the period maths.
//
// Framework-free, like everything in game/. Nothing here may import react or next.
//
// ════════════════════════════════════════════════════════════════════════════════════
// WHAT THIS FILE IS, AND WHAT IT IS NOT
// ════════════════════════════════════════════════════════════════════════════════════
//
// This file decides WHICH quests a player is offered today and this week, and it knows what each
// one pays. It does not decide, award, or remember anything.
//
// PROGRESS AND PAYMENT ARE SERVER-OWNED, exactly like XP and coins (see 0005/0006/0007). The
// server derives progress from the matches it already recorded and pays a quest once per period,
// inside submit_match(). A client never sends progress and never sends a reward.
//
// So why does the rotation live here at all? Because it is a PURE FUNCTION OF THE DATE. The quest
// set does not depend on who is asking, so the client can render it instantly, signed out, with no
// round trip and nothing to trust — and the server computes the identical set from the identical
// arithmetic when it comes time to pay. That is the same shape as the XP mirror in
// game/progression.ts, and it is held together the same way:
//
//   * kinetype.quest_catalog() returns the server's own defs — scripts/verify-quests.ts compares
//     them field by field against QUEST_DEFS below and fails on one character of drift.
//   * kinetype.quest_plan(date) returns the server's answer for a given day —
//     the same script walks 400+ consecutive days and 120 weeks and asserts the two rotations pick
//     the same quests, in the same order, every single time.
//
// THE ROTATION. Each tier is an ordered pool walked with a stride of one, so consecutive days are
// always different, and each tier starts at its own offset so the tiers do not move in lockstep.
// The tier sizes are deliberately not all equal: easy(6) x hard(5) has a 30-day pairing period and
// easy x medium x hard has a 210-day period, so the daily SET is not something a player can learn
// by heart in a week.
//
//         easy    pool of 6, offset 0   ->  day + 0
//         medium  pool of 7, offset 2   ->  day + 2
//         hard    pool of 5, offset 4   ->  day + 4
//
// The weekly pair is a curated list of all 15 pairs of the 6 weekly quests, walked one pair per
// week. Curated rather than generated, because a generated pair can be two impossible quests in the
// same week; written out, every week is a sensible week. It is a 15-week cycle.

// --------------------------------------------------------------------------- types

export type QuestScope = "daily" | "weekly";
export type QuestTier = "easy" | "medium" | "hard";

/**
 * What a match contributes to a quest. Every metric is derivable from a row the server already
 * holds in kinetype.matches, which is what makes quest progress impossible to forge: there is no
 * client-supplied progress to forge it from.
 *
 * Most are counts of matches that passed a test. `threshold` carries the test (`fast_matches` at 45
 * means "matches at 45 WPM or faster"); metrics that do not need one leave it at 0.
 *
 * `win_streak` is the odd one out. It is a MAX, not a count — the longest run of consecutive wins
 * inside the period — so it is not additive and cannot be accumulated. It is the only reason a
 * quest's progress is ever allowed to go DOWN in the derivation (a loss after two wins means the
 * run is over), which is why it is derived fresh from the window every time rather than stored.
 */
export type QuestMetric =
  | "matches"        // matches played
  | "wins"           // matches won
  | "rounds_won"     // rounds won, summed
  | "clean_wins"     // wins with no round dropped
  | "boss_wins"      // boss fights won
  | "win_streak"     // longest run of consecutive wins (MAX, not a count)
  | "fast_matches"   // matches finished at >= threshold WPM
  | "sharp_wins"     // wins at >= threshold % accuracy
  | "combo_matches"  // matches reaching a chain of >= threshold clean words
  | "big_scalps";    // wins against an opponent at >= threshold WPM

export const QUEST_METRICS: readonly QuestMetric[] = [
  "matches",
  "wins",
  "rounds_won",
  "clean_wins",
  "boss_wins",
  "win_streak",
  "fast_matches",
  "sharp_wins",
  "combo_matches",
  "big_scalps",
] as const;

export interface QuestDef {
  id: string;
  scope: QuestScope;
  /** null on a weekly quest: only the daily three are graded. */
  tier: QuestTier | null;
  /** Position in its own ordered pool. The rotation walks by this. */
  sortOrder: number;
  metric: QuestMetric;
  /** The bar the metric has to clear. 0 for the metrics that do not use one. */
  threshold: number;
  /** How much of the metric the quest asks for. */
  target: number;
  rewardXp: number;
  rewardCoins: number;
  title: string;
  detail: string;
}

// ---------------------------------------------------------------------------- the pool
//
// SIZED AGAINST THE LIVE ECONOMY, not picked out of the air. Migration 0007 set the catalogue at
// 52 500 coins and measured the earning rate at ~177 coins a match, ~10 matches a day (~1 900 a
// day), which is about 28 days to own everything. A player who completes all three dailies every
// single day and both weeklies adds at most 480 coins a day and 1 130 a week — about +34% at
// PERFECTION, and a lot less in practice, because "win at 100% accuracy" and "win three in a row"
// do not fall on the same evening. That pulls the catalogue in to roughly 21-24 days for an
// engaged player and leaves the casual pace where 0007 put it.
//
// IF THE PACE NEEDS RETUNING, move these reward columns. Nothing else in the game reads them.

export const QUEST_DEFS: readonly QuestDef[] = [
  // ------------------------------------------------------------------ daily, easy (6)
  { id: "daily-play-3",   scope: "daily", tier: "easy", sortOrder: 0, metric: "matches",      threshold: 0,  target: 3,  rewardXp: 35, rewardCoins: 50,  title: "Three Rounds In",     detail: "Play 3 matches today." },
  { id: "daily-win-1",    scope: "daily", tier: "easy", sortOrder: 1, metric: "wins",         threshold: 0,  target: 1,  rewardXp: 40, rewardCoins: 55,  title: "Open The Account",    detail: "Win a match today." },
  { id: "daily-rounds-3", scope: "daily", tier: "easy", sortOrder: 2, metric: "rounds_won",   threshold: 0,  target: 3,  rewardXp: 40, rewardCoins: 60,  title: "Take Three",          detail: "Win 3 rounds today." },
  { id: "daily-clean-1",  scope: "daily", tier: "easy", sortOrder: 3, metric: "clean_wins",   threshold: 0,  target: 1,  rewardXp: 50, rewardCoins: 70,  title: "Clean Sheet",         detail: "Win a match without dropping a round." },
  { id: "daily-combo-6",  scope: "daily", tier: "easy", sortOrder: 4, metric: "combo_matches", threshold: 6, target: 1,  rewardXp: 40, rewardCoins: 60,  title: "Six Deep",            detail: "Land a chain of 6 clean words." },
  { id: "daily-play-5",   scope: "daily", tier: "easy", sortOrder: 5, metric: "matches",      threshold: 0,  target: 5,  rewardXp: 50, rewardCoins: 70,  title: "Warm Up Properly",    detail: "Play 5 matches today." },

  // ---------------------------------------------------------------- daily, medium (7)
  { id: "daily-win-2",    scope: "daily", tier: "medium", sortOrder: 0, metric: "wins",         threshold: 0,  target: 2,  rewardXp: 85,  rewardCoins: 120, title: "Back It Up",       detail: "Win 2 matches today." },
  { id: "daily-streak-2", scope: "daily", tier: "medium", sortOrder: 1, metric: "win_streak",   threshold: 0,  target: 2,  rewardXp: 90,  rewardCoins: 130, title: "Two On The Trot",  detail: "Win 2 matches in a row." },
  { id: "daily-fast-45",  scope: "daily", tier: "medium", sortOrder: 2, metric: "fast_matches", threshold: 45, target: 2,  rewardXp: 80,  rewardCoins: 115, title: "Finding Fifth Gear", detail: "Finish 2 matches at 45 WPM or faster." },
  { id: "daily-sharp-94", scope: "daily", tier: "medium", sortOrder: 3, metric: "sharp_wins",   threshold: 94, target: 1,  rewardXp: 85,  rewardCoins: 120, title: "Surgical",         detail: "Win a match at 94% accuracy or better." },
  { id: "daily-scalp-50", scope: "daily", tier: "medium", sortOrder: 4, metric: "big_scalps",   threshold: 50, target: 1,  rewardXp: 90,  rewardCoins: 125, title: "Punching Up",      detail: "Beat an opponent at 50 WPM or higher." },
  { id: "daily-rounds-6", scope: "daily", tier: "medium", sortOrder: 5, metric: "rounds_won",   threshold: 0,  target: 6,  rewardXp: 85,  rewardCoins: 125, title: "Split Them Open",  detail: "Win 6 rounds today." },
  { id: "daily-combo-9",  scope: "daily", tier: "medium", sortOrder: 6, metric: "combo_matches", threshold: 9, target: 1,  rewardXp: 95,  rewardCoins: 140, title: "Three Rungs Up",   detail: "Land a chain of 9 clean words." },

  // ------------------------------------------------------------------ daily, hard (5)
  { id: "daily-win-4",    scope: "daily", tier: "hard", sortOrder: 0, metric: "wins",         threshold: 0,   target: 4, rewardXp: 165, rewardCoins: 235, title: "Untouchable",  detail: "Win 4 matches today." },
  { id: "daily-streak-3", scope: "daily", tier: "hard", sortOrder: 1, metric: "win_streak",   threshold: 0,   target: 3, rewardXp: 185, rewardCoins: 260, title: "Hat-Trick",    detail: "Win 3 matches in a row." },
  { id: "daily-fast-60",  scope: "daily", tier: "hard", sortOrder: 2, metric: "fast_matches", threshold: 60,  target: 2, rewardXp: 175, rewardCoins: 250, title: "Flat Out",     detail: "Finish 2 matches at 60 WPM or faster." },
  { id: "daily-flawless", scope: "daily", tier: "hard", sortOrder: 3, metric: "sharp_wins",   threshold: 100, target: 1, rewardXp: 195, rewardCoins: 270, title: "Flawless",     detail: "Win a match at 100% accuracy." },
  { id: "daily-scalp-70", scope: "daily", tier: "hard", sortOrder: 4, metric: "big_scalps",   threshold: 70,  target: 1, rewardXp: 185, rewardCoins: 260, title: "Giant Killer", detail: "Beat an opponent at 70 WPM or higher." },

  // ----------------------------------------------------------------------- weekly (6)
  { id: "weekly-matches-20", scope: "weekly", tier: null, sortOrder: 0, metric: "matches",      threshold: 0,  target: 20, rewardXp: 340, rewardCoins: 470, title: "Regular",       detail: "Play 20 matches this week." },
  { id: "weekly-wins-8",     scope: "weekly", tier: null, sortOrder: 1, metric: "wins",         threshold: 0,  target: 8,  rewardXp: 330, rewardCoins: 460, title: "Eight Down",    detail: "Win 8 matches this week." },
  { id: "weekly-boss-3",     scope: "weekly", tier: null, sortOrder: 2, metric: "boss_wins",    threshold: 0,  target: 3,  rewardXp: 320, rewardCoins: 440, title: "Campaigner",    detail: "Win 3 boss fights this week." },
  { id: "weekly-fast-55",    scope: "weekly", tier: null, sortOrder: 3, metric: "fast_matches", threshold: 55, target: 5,  rewardXp: 350, rewardCoins: 480, title: "Cruising Speed", detail: "Finish 5 matches at 55 WPM or faster." },
  { id: "weekly-streak-5",   scope: "weekly", tier: null, sortOrder: 4, metric: "win_streak",   threshold: 0,  target: 5,  rewardXp: 400, rewardCoins: 550, title: "Five Alive",    detail: "Win 5 matches in a row this week." },
  { id: "weekly-scalp-85",   scope: "weekly", tier: null, sortOrder: 5, metric: "big_scalps",   threshold: 85, target: 3,  rewardXp: 420, rewardCoins: 580, title: "Storm Chaser",  detail: "Beat 3 opponents at 85 WPM or higher." },
] as const;

/** The daily tiers, in the order the board shows them. */
export const DAILY_TIERS: readonly QuestTier[] = ["easy", "medium", "hard"] as const;

/** Each tier's first index in the rotation, so the three pools do not walk in lockstep. */
export const TIER_OFFSET: Record<QuestTier, number> = { easy: 0, medium: 2, hard: 4 };

/**
 * The weekly pairs, walked one per week. All 15 pairs of the six weekly quests, ordered so that a
 * hard volume week is followed by a skill week rather than stacked behind another hard one.
 *
 * WRITTEN OUT rather than generated on purpose. A generated pair can be "win 5 in a row" next to
 * "beat three 85 WPM opponents" — technically legal, and a miserable week with two near-identical
 * asks. Every quest appears in exactly five pairs, which is asserted by the test suite.
 */
export const WEEKLY_SETS: readonly (readonly [string, string])[] = [
  ["weekly-matches-20", "weekly-scalp-85"],
  ["weekly-wins-8",     "weekly-fast-55"],
  ["weekly-boss-3",     "weekly-streak-5"],
  ["weekly-matches-20", "weekly-fast-55"],
  ["weekly-wins-8",     "weekly-boss-3"],
  ["weekly-fast-55",    "weekly-scalp-85"],
  ["weekly-wins-8",     "weekly-streak-5"],
  ["weekly-matches-20", "weekly-boss-3"],
  ["weekly-boss-3",     "weekly-scalp-85"],
  ["weekly-matches-20", "weekly-streak-5"],
  ["weekly-wins-8",     "weekly-scalp-85"],
  ["weekly-fast-55",    "weekly-boss-3"],
  ["weekly-matches-20", "weekly-wins-8"],
  ["weekly-streak-5",   "weekly-fast-55"],
  ["weekly-streak-5",   "weekly-scalp-85"],
] as const;

/** How long a weekly set lasts, in weeks. Mirrors the server's `count(distinct ord)`. */
export const WEEKLY_CYCLE_WEEKS = WEEKLY_SETS.length;

const MS_PER_DAY = 86_400_000;

// ------------------------------------------------------------------------ period maths
//
// EVERY WINDOW IS UTC. The server's day is `(now() at time zone 'utc')::date`, its week starts on
// Monday, and both are derived from the same two ordinals below — so the client's countdown lands
// on the same instant the server flips the quests, without either side telling the other.

/** The UTC calendar day of an instant, as `YYYY-MM-DD`. */
export function utcDayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function epochDayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Days since 1970-01-01 (UTC). The daily rotation's clock. Mirrors kinetype.epoch_day(). */
export function epochDay(at: Date): number {
  return epochDayOfKey(utcDayKey(at));
}

/**
 * Monday-aligned weeks since 1970-01-05. Mirrors kinetype.epoch_week().
 *
 * The +3 is the alignment: 1970-01-01 was a Thursday, so day 0 sits three days INTO its Monday
 * week, and the first Monday (day 4) has to open week 1 rather than week 0.
 */
export function epochWeek(at: Date): number {
  return Math.floor((epochDay(at) + 3) / 7);
}

/** `YYYY-MM-DD` shifted by whole days. */
export function addDays(key: string, delta: number): string {
  return new Date((epochDayOfKey(key) + delta) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The Monday of the week an instant falls in, as `YYYY-MM-DD`. */
export function mondayKey(at: Date): string {
  const key = utcDayKey(at);
  return addDays(key, -((epochDayOfKey(key) + 3) % 7));
}

/** The period a quest belongs to, as the server names it: `d:2026-10-07`, `w:2026-10-05`. */
export function periodKey(at: Date, scope: QuestScope): string {
  return scope === "daily" ? `d:${utcDayKey(at)}` : `w:${mondayKey(at)}`;
}

/** The instant the current period ENDS — next UTC midnight, or next Monday's. Drives the countdown. */
export function periodEnd(at: Date, scope: QuestScope): Date {
  return scope === "daily"
    ? new Date((epochDay(at) + 1) * MS_PER_DAY)
    : new Date((epochDayOfKey(mondayKey(at)) + 7) * MS_PER_DAY);
}

// -------------------------------------------------------------------------- rotation

function poolOf(scope: QuestScope, tier: QuestTier | null): QuestDef[] {
  return QUEST_DEFS.filter((q) => q.scope === scope && (tier === null || q.tier === tier)).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

const defById = new Map(QUEST_DEFS.map((q) => [q.id, q]));

export function questById(id: string): QuestDef | undefined {
  return defById.get(id);
}

/**
 * The three daily quests for a UTC day, in tier order (easy, medium, hard).
 *
 * `(day + offset) % poolSize` — a stride of one, so tomorrow's easy quest is always a different
 * quest from today's, never the same one twice running. The offset only decides where each tier
 * enters its cycle.
 */
export function dailyQuestIds(at: Date): [string, string, string] {
  const day = epochDay(at);
  return DAILY_TIERS.map((tier) => {
    const pool = poolOf("daily", tier);
    return pool[(day + TIER_OFFSET[tier]) % pool.length].id;
  }) as [string, string, string];
}

/** The two weekly quests for the Monday-aligned week an instant falls in. */
export function weeklyQuestIds(at: Date): [string, string] {
  return WEEKLY_SETS[epochWeek(at) % WEEKLY_SETS.length] as unknown as [string, string];
}

/**
 * Everything on the board for an instant: the three dailies then the two weeklies.
 *
 * This is what the client renders and what the server pays against. Both call the same two
 * functions above, so the board cannot offer a quest the server will not score.
 */
export function activeQuests(at: Date): QuestDef[] {
  const ids = [...dailyQuestIds(at), ...weeklyQuestIds(at)];
  return ids.map((id) => {
    const def = defById.get(id);
    // Unreachable while QUEST_DEFS and WEEKLY_SETS agree, which the test suite asserts. Throwing
    // beats rendering a quest with no target and no reward.
    if (!def) throw new Error(`Unknown quest id in the rotation: ${id}`);
    return def;
  });
}

/** The four windows a quest can be scored over, in the order the board shows them. */
export function questsFor(at: Date, scope: QuestScope): QuestDef[] {
  return activeQuests(at).filter((q) => q.scope === scope);
}

// ------------------------------------------------------------------------- reward caps
//
// Used by the test suite as a reasonableness bound and by docs/GAME-DESIGN.md for the pacing
// argument. A cap that moves has to be re-argued against the 0007 catalogue pace.
//
// These are CEILINGS, not sums: the most a tier COULD pay, which is the largest single reward in
// it. Summing the pool would total every quest in the rotation rather than the three that are
// actually live on a given day, and would describe a day that cannot happen.

function maxReward(defs: readonly QuestDef[]): { xp: number; coins: number } {
  return defs.reduce(
    (best, q) => ({
      xp: Math.max(best.xp, q.rewardXp),
      coins: Math.max(best.coins, q.rewardCoins),
    }),
    { xp: 0, coins: 0 },
  );
}

/** The most a single daily tier can pay. */
export function tierRewardCap(tier: QuestTier): { xp: number; coins: number } {
  return maxReward(poolOf("daily", tier));
}

/** The most all three dailies can pay in one day: the best easy, the best medium, the best hard. */
export function dailyRewardCap(): { xp: number; coins: number } {
  return DAILY_TIERS.map(tierRewardCap).reduce(
    (total, t) => ({ xp: total.xp + t.xp, coins: total.coins + t.coins }),
    { xp: 0, coins: 0 },
  );
}

/** The most one week's pair of weeklies can pay. The LARGEST PAIR, not the average and not the
 *  best single quest — a week carries two, so the ceiling has to add them up. */
export function weeklyRewardCap(): { xp: number; coins: number } {
  const pairs = WEEKLY_SETS.map((pair) =>
    pair.reduce(
      (total, id) => {
        const def = defById.get(id);
        return def
          ? { xp: total.xp + def.rewardXp, coins: total.coins + def.rewardCoins }
          : total;
      },
      { xp: 0, coins: 0 },
    ),
  );
  return pairs.reduce(
    (best, p) => ({ xp: Math.max(best.xp, p.xp), coins: Math.max(best.coins, p.coins) }),
    { xp: 0, coins: 0 },
  );
}
