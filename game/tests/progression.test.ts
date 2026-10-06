// Progression tests. Plain Node, no framework, no browser.
//
// These pin the XP curve and the boss campaign. Critically, several cases here are
// the EXACT figures the live Postgres function returned during verification, so a
// failure means game/progression.ts and kinetype.xp_for_match() have drifted apart
// and the leaderboard would disagree with the HUD.
//
// Run: npx tsx game/tests/progression.test.ts

import assert from "node:assert/strict";

import { BOT_WPM_LADDER, DIFFICULTY_PCT } from "../constants";
import {
  BOSS_BOUNTY_TOTAL,
  BOSSES,
  BOSS_WPM_LADDER,
  bossById,
  bossIndex,
  bossUnlocked,
  bossesMatchLadder,
  coinsForMatch,
  difficultyPct,
  levelForXp,
  levelProgress,
  rungIndexFor,
  scaleByPct,
  unlockedBosses,
  xpForLevel,
  xpForMatch,
} from "../progression";

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

// ================================================================ level curve

section("level curve");

test("matches the documented thresholds", () => {
  const cases: Array<[number, number]> = [
    [0, 1], [99, 1], [100, 2], [399, 2], [400, 3], [900, 4],
    [1600, 5], [2500, 6], [4900, 8], [8100, 10], [12100, 12],
  ];
  for (const [xp, lvl] of cases) {
    assert.equal(levelForXp(xp), lvl, `${xp} XP should be level ${lvl}`);
  }
});

test("levelForXp is defensive about junk input", () => {
  assert.equal(levelForXp(-500), 1);
  assert.equal(levelForXp(NaN), 1);
  assert.equal(levelForXp(Infinity), 1); // non-finite is treated as zero XP, not a huge level
});

test("xpForLevel inverts levelForXp at every boundary", () => {
  for (let lvl = 1; lvl <= 25; lvl++) {
    const start = xpForLevel(lvl);
    assert.equal(levelForXp(start), lvl, `level ${lvl} starts at ${start} XP`);
    // One XP below the boundary is still the previous level.
    if (lvl > 1) assert.equal(levelForXp(start - 1), lvl - 1, `level ${lvl} - 1 XP`);
  }
});

test("levelProgress reports a sane fill", () => {
  const p = levelProgress(250); // level 2 spans 100..400
  assert.equal(p.level, 2);
  assert.equal(p.intoLevel, 150);
  assert.equal(p.levelSpan, 300);
  assert.equal(p.remaining, 150);
  assert.ok(Math.abs(p.pct - 0.5) < 1e-9, `pct ${p.pct}`);
  assert.ok(p.pct >= 0 && p.pct <= 1);
});

// ================================================================ XP formula
// These exact numbers came back from Postgres during backend verification.
// scripts/verify-rewards.ts re-checks every one of them against the LIVE functions.
//
// Most cases fight the 40 WPM rung, which is the 100% anchor of DIFFICULTY_PCT. That is deliberate:
// it proves the difficulty change left the anchor's payouts exactly as they were, so every figure
// that was verified before the change still holds there.

section("XP formula (mirrors kinetype.xp_for_match)");

test("free-play win at the anchor, 2 rounds, 60 WPM, 95% acc, streak 2 = 141", () => {
  assert.equal(
    xpForMatch({ won: true, roundsWon: 2, wpm: 60, accuracy: 95, streak: 2, mode: "free", botWpm: 40 }),
    141,
  );
});

test("boss first clear at the anchor, 2 rounds, 70 WPM, 96% acc, streak 1 = 339", () => {
  assert.equal(
    xpForMatch({ won: true, roundsWon: 2, wpm: 70, accuracy: 96, streak: 1, mode: "boss", bossFirstClear: true, botWpm: 40 }),
    339,
  );
});

test("boss first clear at the anchor, 42 WPM, 96% acc, streak 1 = 322 (matched the DB)", () => {
  assert.equal(
    xpForMatch({ won: true, roundsWon: 2, wpm: 42, accuracy: 96, streak: 1, mode: "boss", bossFirstClear: true, botWpm: 40 }),
    322,
  );
});

test("the SAME boss on a repeat clear pays 190, not 330 — bounty is one-time", () => {
  const again = xpForMatch({ won: true, roundsWon: 2, wpm: 42, accuracy: 96, streak: 2, mode: "boss", bossFirstClear: false, botWpm: 40 });
  assert.equal(again, 190);
  assert.equal(322 + 190, 512, "two clears total 512 XP, matching the DB");
});

test("losing still pays a floor, never negative", () => {
  const loss = xpForMatch({ won: false, roundsWon: 0, wpm: 0, accuracy: 0, streak: 0, mode: "free", botWpm: 40 });
  assert.equal(loss, 12);
  assert.ok(loss > 0, "a loss still banks a little XP");
});

test("clamps hostile input so a tampered payload cannot inflate", () => {
  const maxed = xpForMatch({ won: true, roundsWon: 999, wpm: 99999, accuracy: 99999, streak: 999, mode: "boss", bossFirstClear: true, botWpm: 120 });
  const legit = xpForMatch({ won: true, roundsWon: 5, wpm: 400, accuracy: 100, streak: 5, mode: "boss", bossFirstClear: true, botWpm: 120 });
  assert.equal(maxed, legit, "over-cap inputs clamp to the same ceiling as legal maxes");
  assert.equal(legit, 1500, "the verified ceiling at the hardest rung");
  const neg = xpForMatch({ won: false, roundsWon: -50, wpm: -100, accuracy: -100, streak: -9, mode: "free", botWpm: 120 });
  assert.equal(neg, 12, "negative inputs clamp to zero per term");
});

test("XP is monotone in WPM and accuracy", () => {
  const base = { won: true, roundsWon: 1, accuracy: 90, streak: 0, mode: "free" as const, botWpm: 40 };
  assert.ok(xpForMatch({ ...base, wpm: 80 }) > xpForMatch({ ...base, wpm: 40 }), "faster pays more");
  assert.ok(
    xpForMatch({ ...base, wpm: 40, accuracy: 100 }) > xpForMatch({ ...base, wpm: 40, accuracy: 60 }),
    "cleaner pays more",
  );
});

// ====================================================== difficulty scaling
// Added 2026-10-06. The payout used to ignore the opponent entirely, so beating the 20 WPM warm-up
// paid exactly what beating the 120 WPM final boss paid.

const WIN_CASE = { won: true, roundsWon: 2, wpm: 45, accuracy: 95, streak: 3, mode: "free" as const };

section("difficulty scaling (mirrors kinetype.difficulty_pct)");

test("a win pays more at every rung above the last (DB-verified figures)", () => {
  const at = (botWpm: number) => xpForMatch({ ...WIN_CASE, botWpm });
  assert.equal(at(20), 105);
  assert.equal(at(40), 140);
  assert.equal(at(120), 455);
  for (let i = 1; i < BOT_WPM_LADDER.length; i += 1) {
    assert.ok(
      at(BOT_WPM_LADDER[i]) > at(BOT_WPM_LADDER[i - 1]),
      `${BOT_WPM_LADDER[i]} must pay more than ${BOT_WPM_LADDER[i - 1]}`,
    );
  }
  assert.equal(DIFFICULTY_PCT[2], 100, "the 40 WPM rung is the 100% anchor");
  assert.equal(difficultyPct(40), 100);
});

test("a loss is NOT scaled by difficulty — that is the anti-farm rule", () => {
  const at = (botWpm: number) =>
    coinsForMatch({ won: false, roundsWon: 0, wpm: 45, accuracy: 95, streak: 0, botWpm });
  const values = BOT_WPM_LADDER.map(at);
  assert.deepEqual(values, values.map(() => 68), "a loss pays the same at every rung");
});

test("a win beats a loss at every rung", () => {
  for (const botWpm of BOT_WPM_LADDER) {
    const win = coinsForMatch({ won: true, roundsWon: 2, wpm: 60, accuracy: 96, streak: 2, botWpm });
    const loss = coinsForMatch({ won: false, roundsWon: 0, wpm: 60, accuracy: 96, streak: 0, botWpm });
    assert.ok(win > loss, `rung ${botWpm}: a win (${win}) must beat a loss (${loss})`);
  }
});

test("the boss bonus and the first-clear bounty are not difficulty-scaled", () => {
  for (const botWpm of BOT_WPM_LADDER) {
    const common = { won: true, roundsWon: 2, wpm: 70, accuracy: 96, streak: 1, botWpm };
    const free = xpForMatch({ ...common, mode: "free" });
    const boss = xpForMatch({ ...common, mode: "boss", bossFirstClear: false });
    const first = xpForMatch({ ...common, mode: "boss", bossFirstClear: true });
    assert.equal(boss - free, 60, `rung ${botWpm}: the boss mode bonus stays flat`);
    assert.equal(first - boss, 140, `rung ${botWpm}: the first-clear bounty stays flat`);
  }
});

test("coins and XP agree outside boss mode, so one table serves both", () => {
  for (const botWpm of BOT_WPM_LADDER) {
    const input = { won: true, roundsWon: 2, wpm: 55, accuracy: 93, streak: 2, botWpm };
    assert.equal(coinsForMatch(input), xpForMatch({ ...input, mode: "free" }));
  }
});

test("an off-ladder opponent snaps DOWN to a real rung", () => {
  assert.equal(BOT_WPM_LADDER[rungIndexFor(45)], 40, "45 is a tie, and ties resolve downward");
  assert.equal(BOT_WPM_LADDER[rungIndexFor(44)], 40);
  assert.equal(BOT_WPM_LADDER[rungIndexFor(46)], 50);
  assert.equal(BOT_WPM_LADDER[rungIndexFor(0)], 20);
  assert.equal(BOT_WPM_LADDER[rungIndexFor(-100)], 20);
  assert.equal(BOT_WPM_LADDER[rungIndexFor(999999)], 120);
  assert.equal(BOT_WPM_LADDER[rungIndexFor(NaN)], 20);
});

test("scaleByPct is integer-exact and rounds halves up", () => {
  assert.equal(scaleByPct(140, 100), 140);
  assert.equal(scaleByPct(140, 75), 105);
  assert.equal(scaleByPct(140, 325), 455);
  assert.equal(scaleByPct(3, 50), 2, "1.5 rounds up");
  assert.equal(scaleByPct(0, 325), 0);
});

// ================================================================ boss campaign

section("boss campaign");

test("nine bosses on the game's real bot ladder, in order", () => {
  assert.equal(BOSSES.length, 9);
  assert.equal(BOT_WPM_LADDER.length, 9);
  assert.ok(bossesMatchLadder(), "boss WPMs must equal BOT_WPM_LADDER exactly");
  assert.deepEqual([...BOSS_WPM_LADDER], [...BOT_WPM_LADDER]);
});

test("boss ids are unique and resolvable", () => {
  const ids = BOSSES.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicate boss ids");
  for (const b of BOSSES) {
    assert.equal(bossById(b.id)?.id, b.id);
    assert.ok(bossIndex(b.id) >= 0);
  }
  assert.equal(bossById("does-not-exist"), undefined);
});

test("unlock levels and reward coins only ever climb", () => {
  for (let i = 1; i < BOSSES.length; i++) {
    assert.ok(BOSSES[i].unlockLevel >= BOSSES[i - 1].unlockLevel, `${BOSSES[i].id} unlock level must not drop`);
    assert.ok(BOSSES[i].rewardCoins > BOSSES[i - 1].rewardCoins, `${BOSSES[i].id} must pay more than ${BOSSES[i - 1].id}`);
  }
  assert.ok(BOSSES[0].unlockLevel >= 1, "the first boss is always reachable");
});

test("the final boss is a best-of-five gauntlet", () => {
  assert.equal(BOSSES[BOSSES.length - 1].bestOf, 5);
  for (const b of BOSSES.slice(0, -1)) assert.equal(b.bestOf, 3, `${b.id} should be best-of-three`);
});

test("a fresh level-1 player can only enter the first boss", () => {
  const open = unlockedBosses(1, []);
  assert.deepEqual(open.map((b) => b.id), ["tick"]);
});

test("sequence gate: clearing a boss opens the next even at a high level", () => {
  const highLevel = 99;
  // Level alone is not enough — nothing but boss #1 is open to a level-99 player
  // who has cleared nothing, because the sequence gate still holds.
  assert.deepEqual(unlockedBosses(highLevel, []).map((b) => b.id), ["tick"]);
  // Clear tick and the next gate opens.
  assert.ok(bossUnlocked(BOSSES[1], highLevel, ["tick"]));
  assert.ok(!bossUnlocked(BOSSES[2], highLevel, ["tick"]), "boss 3 still needs boss 2");
});

test("level gate: the sequence alone is not enough", () => {
  const clearedEverything = BOSSES.map((b) => b.id);
  // Level 1 cannot enter boss 2 even though boss 1 is beaten.
  assert.ok(!bossUnlocked(BOSSES[1], 1, ["tick"]));
  assert.ok(bossUnlocked(BOSSES[1], BOSSES[1].unlockLevel, clearedEverything));
});

test("bossUnlocked accepts both a Set and an array of clears", () => {
  assert.ok(bossUnlocked(BOSSES[1], 5, new Set(["tick"])));
  assert.ok(bossUnlocked(BOSSES[1], 5, ["tick"]));
});

test("the first clear bounty is worth exactly 140 XP per boss", () => {
  assert.equal(BOSS_BOUNTY_TOTAL, BOSSES.length * 140);
  const first = xpForMatch({ won: true, roundsWon: 2, wpm: 40, accuracy: 95, streak: 1, mode: "boss", bossFirstClear: true, botWpm: 40 });
  const again = xpForMatch({ won: true, roundsWon: 2, wpm: 40, accuracy: 95, streak: 1, mode: "boss", bossFirstClear: false, botWpm: 40 });
  assert.equal(first - again, 140);
});

// ================================================================ report

console.log(`\n${"-".repeat(56)}`);
console.log(`passed ${passed}   failed ${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log(`${"-".repeat(56)}`);

if (failed > 0) process.exit(1);
