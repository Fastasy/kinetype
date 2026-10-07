// Quest tests. Plain Node, no framework, no browser.
//
// These pin the rotation, the reward table and the period maths — the three things the client and
// the server both compute and therefore the three things that can silently drift apart.
//
// The rotation cases below are the EXACT ids live Postgres returned from kinetype.quest_plan()
// during verification. scripts/verify-quests.ts re-checks every one of them against the live
// functions, over 400 consecutive days and 120 weeks, so a failure here means game/quests.ts and
// kinetype.quest_ids_for() have diverged and the board is offering quests the server will not pay.
//
// Run: npx tsx game/tests/quests.test.ts

import assert from "node:assert/strict";

import {
  DAILY_TIERS,
  QUEST_DEFS,
  QUEST_METRICS,
  TIER_OFFSET,
  WEEKLY_CYCLE_WEEKS,
  WEEKLY_SETS,
  activeQuests,
  addDays,
  dailyQuestIds,
  dailyRewardCap,
  epochDay,
  epochWeek,
  mondayKey,
  periodEnd,
  periodKey,
  questById,
  questsFor,
  tierRewardCap,
  utcDayKey,
  weeklyQuestIds,
  weeklyRewardCap,
  type QuestDef,
  type QuestMetric,
} from "../quests";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  FAIL ${name}\n       ${msg.split("\n")[0]}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/** Midday UTC, so a test can never be the one that falls over a midnight boundary. */
function at(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00.000Z`);
}

/** Metrics that ask for a quantity rather than clearing a bar. */
const COUNT_METRICS: QuestMetric[] = ["matches", "wins", "rounds_won", "clean_wins", "boss_wins", "win_streak"];
/** Metrics that ask the player to clear a bar, so they must carry one. */
const BAR_METRICS: QuestMetric[] = ["fast_matches", "sharp_wins", "combo_matches", "big_scalps"];

function pool(scope: string, tier: string | null): QuestDef[] {
  return QUEST_DEFS.filter((q) => q.scope === scope && (tier === null || q.tier === tier)).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

// ================================================================== the book

section("the quest book");

test("twenty-four quests: six easy, seven medium, five hard, six weekly", () => {
  assert.equal(QUEST_DEFS.length, 24);
  assert.equal(pool("daily", "easy").length, 6);
  assert.equal(pool("daily", "medium").length, 7);
  assert.equal(pool("daily", "hard").length, 5);
  assert.equal(pool("weekly", null).length, 6);
});

test("ids are unique and resolvable", () => {
  const ids = QUEST_DEFS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicate quest ids");
  for (const q of QUEST_DEFS) assert.equal(questById(q.id)?.id, q.id);
  assert.equal(questById("not-a-quest"), undefined);
});

test("every daily quest is graded, and no weekly quest is", () => {
  for (const q of pool("daily", null)) assert.ok(q.tier, `${q.id} must carry a tier`);
  for (const q of pool("weekly", null)) assert.equal(q.tier, null, `${q.id} must not carry a tier`);
});

test("sortOrder is contiguous from zero in every pool — the rotation walks by it", () => {
  for (const tier of [...DAILY_TIERS, null]) {
    const list = pool(tier === null ? "weekly" : "daily", tier);
    list.forEach((q, i) => assert.equal(q.sortOrder, i, `${q.id} sortOrder`));
  }
});

test("every metric is known, and every known metric is used", () => {
  const used = new Set(QUEST_DEFS.map((q) => q.metric));
  for (const m of used) assert.ok(QUEST_METRICS.includes(m), `unknown metric ${m}`);
  for (const m of QUEST_METRICS) assert.ok(used.has(m), `metric ${m} is dead — no quest uses it`);
});

test("a bar metric carries a bar; a count metric does not", () => {
  for (const q of QUEST_DEFS) {
    if (BAR_METRICS.includes(q.metric)) {
      assert.ok(q.threshold > 0, `${q.id} (${q.metric}) needs a threshold`);
    } else if (COUNT_METRICS.includes(q.metric)) {
      assert.equal(q.threshold, 0, `${q.id} (${q.metric}) should not carry a threshold`);
    }
  }
});

test("thresholds sit in a range the game actually produces", () => {
  for (const q of QUEST_DEFS) {
    if (q.metric === "sharp_wins") {
      assert.ok(q.threshold >= 80 && q.threshold <= 100, `${q.id}: accuracy ${q.threshold} is not reachable`);
    }
    if (q.metric === "fast_matches") {
      assert.ok(q.threshold >= 30 && q.threshold <= 120, `${q.id}: ${q.threshold} WPM is off the ladder`);
    }
    if (q.metric === "big_scalps") {
      assert.ok(q.threshold >= 20 && q.threshold <= 120, `${q.id}: ${q.threshold} WPM is off the ladder`);
    }
    if (q.metric === "combo_matches") {
      // The chain ladder tops out at COMBO_STEP * COMBO_MAX_STEPS = 12. Asking for more is asking
      // for something the game cannot produce.
      assert.ok(q.threshold <= 12, `${q.id}: a chain of ${q.threshold} is above the ladder cap`);
    }
  }
});

test("every quest has real, short copy — it has to fit on a card", () => {
  for (const q of QUEST_DEFS) {
    assert.ok(q.title.length > 0 && q.title.length <= 22, `${q.id} title: "${q.title}"`);
    assert.ok(q.detail.length > 0 && q.detail.length <= 60, `${q.id} detail: "${q.detail}"`);
    assert.ok(q.target >= 1, `${q.id} target`);
    assert.ok(q.rewardXp >= 0 && q.rewardCoins >= 0, `${q.id} reward`);
  }
});

test("a harder tier always pays more than any easier one", () => {
  const easy = pool("daily", "easy");
  const medium = pool("daily", "medium");
  const hard = pool("daily", "hard");
  const max = (l: QuestDef[]) => Math.max(...l.map((q) => q.rewardXp));
  const maxC = (l: QuestDef[]) => Math.max(...l.map((q) => q.rewardCoins));
  assert.ok(max(easy) < Math.min(...medium.map((q) => q.rewardXp)), "every medium must out-pay every easy");
  assert.ok(max(medium) < Math.min(...hard.map((q) => q.rewardXp)), "every hard must out-pay every medium");
  assert.ok(maxC(easy) < Math.min(...medium.map((q) => q.rewardCoins)));
  assert.ok(maxC(medium) < Math.min(...hard.map((q) => q.rewardCoins)));
});

// ================================================================== the weekly sets

section("the weekly pairs");

test("fifteen pairs, both slots filled, no duplicates", () => {
  assert.equal(WEEKLY_SETS.length, 15);
  assert.equal(WEEKLY_CYCLE_WEEKS, 15);
  const keys = WEEKLY_SETS.map((p) => [...p].sort().join("+"));
  assert.equal(new Set(keys).size, keys.length, "no pair may repeat in the cycle");
  for (const [a, b] of WEEKLY_SETS) {
    assert.notEqual(a, b, `pair ${a}+${b} must be two different quests`);
    assert.ok(questById(a), `unknown quest ${a}`);
    assert.ok(questById(b), `unknown quest ${b}`);
    assert.equal(questById(a)!.scope, "weekly", `${a} must be a weekly`);
    assert.equal(questById(b)!.scope, "weekly", `${b} must be a weekly`);
  }
});

test("every weekly quest appears in exactly five pairs, so the cycle is fair", () => {
  const counts = new Map<string, number>();
  for (const pair of WEEKLY_SETS) for (const id of pair) counts.set(id, (counts.get(id) ?? 0) + 1);
  const weekly = pool("weekly", null).map((q) => q.id);
  assert.equal(counts.size, weekly.length, "every weekly quest must appear");
  for (const id of weekly) assert.equal(counts.get(id), 5, `${id} appears ${counts.get(id)}x, not 5`);
});

test("no two consecutive weeks are the same pair", () => {
  const key = (i: number) => [...WEEKLY_SETS[i]].sort().join("+");
  for (let i = 0; i < WEEKLY_SETS.length; i++) {
    const next = (i + 1) % WEEKLY_SETS.length;
    assert.notEqual(key(i), key(next), `weeks ${i} and ${next} are identical`);
  }
});

// ================================================================== period maths
// The epoch figures are the ones live Postgres returned.

section("period maths (mirrors kinetype.epoch_day / epoch_week / week_start)");

test("the two ordinals match the database", () => {
  assert.equal(epochDay(at("2026-10-07")), 20733);
  assert.equal(epochWeek(at("2026-10-07")), 2962);
});

test("a week starts on Monday, and Sunday belongs to the week before it", () => {
  assert.equal(mondayKey(at("2026-10-07")), "2026-10-05", "Wednesday");
  assert.equal(mondayKey(at("2026-10-05")), "2026-10-05", "Monday is its own start");
  assert.equal(mondayKey(at("2026-10-11")), "2026-10-05", "Sunday closes the week it started in");
  assert.equal(mondayKey(at("2026-10-04")), "2026-09-28", "Sunday 04 Oct belongs to 28 Sep");
  assert.equal(mondayKey(at("1970-01-05")), "1970-01-05", "the first Monday opens week 1");
  assert.equal(mondayKey(at("1970-01-04")), "1969-12-29");
  assert.equal(mondayKey(at("1970-01-01")), "1969-12-29", "day zero was a Thursday");
});

test("the week ordinal increments on Monday and only on Monday", () => {
  for (const [day, next] of [
    ["2026-10-11", "2026-10-12"], // Sunday -> Monday changes the week
    ["2026-10-05", "2026-10-06"], // Monday -> Tuesday does not
  ]) {
    const a = epochWeek(at(day));
    const b = epochWeek(at(next));
    assert.equal(b - a, day === "2026-10-11" ? 1 : 0, `${day} -> ${next}`);
  }
});

test("period keys carry the date and the Monday", () => {
  assert.equal(periodKey(at("2026-10-07"), "daily"), "d:2026-10-07");
  assert.equal(periodKey(at("2026-10-07"), "weekly"), "w:2026-10-05");
  assert.equal(periodKey(at("2026-10-12"), "weekly"), "w:2026-10-12", "the next Monday resets it");
  assert.equal(periodKey(at("2026-10-11"), "weekly"), "w:2026-10-05", "…but Sunday has not");
});

test("periodEnd lands on the next UTC midnight, or the next Monday's", () => {
  assert.equal(periodEnd(at("2026-10-07"), "daily").toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal(periodEnd(at("2026-10-07"), "weekly").toISOString(), "2026-10-12T00:00:00.000Z");
});

test("a period always ends in the future, and a week is exactly seven days", () => {
  for (let i = 0; i < 400; i++) {
    const day = addDays("2026-01-01", i);
    const now = at(day);
    assert.ok(periodEnd(now, "daily").getTime() > now.getTime(), `${day} daily`);
    assert.ok(periodEnd(now, "weekly").getTime() > now.getTime(), `${day} weekly`);
    // Mon..Sun inclusive is <= 7 days away; the window itself must be exactly 7 days wide.
    const days = (periodEnd(now, "weekly").getTime() - now.getTime()) / 86_400_000;
    assert.ok(days > 0 && days <= 7, `${day}: ${days} days to the weekly reset`);
  }
  // A window measured from its own start (UTC midnight) is one day wide, or seven.
  const monday = new Date("2026-10-05T00:00:00.000Z");
  assert.equal(
    (periodEnd(monday, "weekly").getTime() - monday.getTime()) / 86_400_000,
    7,
    "a weekly window is seven days wide",
  );
  assert.equal(
    (periodEnd(monday, "daily").getTime() - monday.getTime()) / 86_400_000,
    1,
    "a daily window is one day wide",
  );
});

test("addDays is exact across a month, a year and a leap day", () => {
  assert.equal(addDays("2026-10-07", 1), "2026-10-08");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2028-02-29", 1), "2028-03-01");
  assert.equal(addDays("2026-10-07", -7), "2026-09-30");
  assert.equal(addDays("2026-10-07", 0), "2026-10-07");
  for (let i = 0; i < 400; i++) {
    const d = addDays("2025-01-01", i);
    assert.equal(utcDayKey(new Date(`${d}T12:00:00.000Z`)), d, "addDays must stay on its own day");
  }
});

// ================================================================== the rotation

section("the rotation");

test("the database's own answer for 2026-10-07 is reproduced exactly", () => {
  // Live: select * from kinetype.quest_plan(date '2026-10-07')
  assert.deepEqual(dailyQuestIds(at("2026-10-07")), [
    "daily-clean-1",
    "daily-streak-2",
    "daily-fast-60",
  ]);
  assert.deepEqual(weeklyQuestIds(at("2026-10-07")), ["weekly-matches-20", "weekly-boss-3"]);
  assert.deepEqual(
    activeQuests(at("2026-10-07")).map((q) => q.id),
    ["daily-clean-1", "daily-streak-2", "daily-fast-60", "weekly-matches-20", "weekly-boss-3"],
  );
});

test("the board is three dailies then two weeklies, graded easy to hard", () => {
  for (let i = 0; i < 60; i++) {
    const board = activeQuests(at(addDays("2026-01-01", i * 7)));
    assert.equal(board.length, 5, "three dailies and two weeklies");
    assert.deepEqual(board.slice(0, 3).map((q) => q.tier), [...DAILY_TIERS]);
    assert.deepEqual(board.slice(3).map((q) => q.tier), [null, null]);
  }
});

test("the same day always offers the same quests", () => {
  const a = activeQuests(at("2026-10-07")).map((q) => q.id);
  const b = activeQuests(new Date("2026-10-07T00:00:00.000Z")).map((q) => q.id);
  const c = activeQuests(new Date("2026-10-07T23:59:59.000Z")).map((q) => q.id);
  assert.deepEqual(a, b, "midnight");
  assert.deepEqual(a, c, "the last second of the day");
});

test("every tier offers a DIFFERENT quest tomorrow — never the same one twice running", () => {
  let previous = dailyQuestIds(at("2025-06-01"));
  for (let i = 1; i <= 400; i++) {
    const day = addDays("2025-06-01", i);
    const today = dailyQuestIds(at(day));
    today.forEach((id, tier) => {
      assert.notEqual(id, previous[tier], `${day}: tier ${DAILY_TIERS[tier]} repeated ${id}`);
    });
    previous = today;
  }
});

test("each tier walks its WHOLE pool — six days of easy quests are six different quests", () => {
  for (const tier of DAILY_TIERS) {
    const size = pool("daily", tier).length;
    const seen = new Set<string>();
    for (let i = 0; i < size; i++) {
      const day = addDays("2026-10-07", i);
      seen.add(dailyQuestIds(at(day))[DAILY_TIERS.indexOf(tier)]);
    }
    assert.equal(seen.size, size, `tier ${tier} only reached ${seen.size} of ${size} quests in ${size} days`);
  }
});

test("the daily combination has a 210-day period (6 x 7 x 5), so it cannot be learned in a month", () => {
  const base = "2026-01-01";
  const first = dailyQuestIds(at(base)).join("|");
  const seen = new Set<string>();
  for (let i = 0; i < 210; i++) seen.add(dailyQuestIds(at(addDays(base, i))).join("|"));
  assert.equal(seen.size, 210, "every one of the 210 combinations must be distinct");
  assert.equal(dailyQuestIds(at(addDays(base, 210))).join("|"), first, "and it repeats on day 210");
});

test("the weekly pair cycles every 15 weeks and never repeats back to back", () => {
  const base = "2026-01-05"; // a Monday
  const seen = new Set<string>();
  for (let w = 0; w < 15; w++) seen.add(weeklyQuestIds(at(addDays(base, w * 7))).join("|"));
  assert.equal(seen.size, 15, "15 weeks must show 15 different pairs");
  assert.deepEqual(
    weeklyQuestIds(at(addDays(base, 15 * 7))),
    weeklyQuestIds(at(base)),
    "and week 16 repeats week 1",
  );
});

test("the weekly quests hold steady all week and turn over on Monday", () => {
  const monday = weeklyQuestIds(at("2026-10-05"));
  for (const day of ["2026-10-06", "2026-10-07", "2026-10-11"]) {
    assert.deepEqual(weeklyQuestIds(at(day)), monday, `${day} is still the same week`);
  }
  assert.notDeepEqual(weeklyQuestIds(at("2026-10-12")), monday, "but the next Monday is a new week");
});

test("questsFor splits the board by scope", () => {
  const now = at("2026-10-07");
  assert.equal(questsFor(now, "daily").length, 3);
  assert.equal(questsFor(now, "weekly").length, 2);
  for (const q of questsFor(now, "daily")) assert.equal(q.scope, "daily");
  for (const q of questsFor(now, "weekly")) assert.equal(q.scope, "weekly");
});

test("the rotation only ever names quests that exist", () => {
  for (let i = 0; i < 400; i++) {
    for (const q of activeQuests(at(addDays("2025-01-01", i)))) {
      assert.ok(questById(q.id), `${q.id} is not in the book`);
      assert.ok(q.target >= 1);
    }
  }
});

// ================================================================== reward caps
// These numbers are quoted in docs/GAME-DESIGN.md as the pacing argument against migration 0007's
// 28-day catalogue. If a reward column moves, this test, the doc and the argument move together.

section("reward caps (the pacing bound)");

test("the per-tier ceilings are the documented ones", () => {
  assert.deepEqual(tierRewardCap("easy"), { xp: 50, coins: 70 });
  assert.deepEqual(tierRewardCap("medium"), { xp: 95, coins: 140 });
  assert.deepEqual(tierRewardCap("hard"), { xp: 195, coins: 270 });
});

test("a perfect day is 340 XP and 480 coins", () => {
  assert.deepEqual(dailyRewardCap(), { xp: 340, coins: 480 });
});

test("a perfect week's pair is 820 XP and 1 130 coins", () => {
  assert.deepEqual(weeklyRewardCap(), { xp: 820, coins: 1130 });
});

test("a perfect week stays at or under 3 200 XP and 4 490 coins", () => {
  const daily = dailyRewardCap();
  const weekly = weeklyRewardCap();
  assert.equal(daily.xp * 7 + weekly.xp, 3200);
  assert.equal(daily.coins * 7 + weekly.coins, 4490);
});

test("a quest is never worth more than a good match — the match must stay the main event", () => {
  // A 2-0 win at the 40 WPM anchor with a 3-streak pays 140 XP / 140 coins. A daily at perfect
  // play is 340 XP, which is about two and a half matches for three quests of work.
  const bestDaily = dailyRewardCap();
  assert.ok(bestDaily.xp < 400, `a perfect three-quest day (${bestDaily.xp} XP) must stay modest`);
  assert.ok(bestDaily.coins < 600, `and so must its coins (${bestDaily.coins})`);
});

test("the offsets are what de-correlate the tiers, and they are distinct", () => {
  const offsets = DAILY_TIERS.map((t) => TIER_OFFSET[t]);
  assert.equal(new Set(offsets).size, DAILY_TIERS.length, "no two tiers may share an offset");
  for (const tier of DAILY_TIERS) {
    assert.ok(TIER_OFFSET[tier] >= 0, `${tier} offset must be non-negative`);
  }
});

// ================================================================== report

console.log(`\n${"-".repeat(56)}`);
console.log(`passed ${passed}   failed ${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log(`${"-".repeat(56)}`);

if (failed > 0) process.exit(1);
