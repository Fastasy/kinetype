// Proves the live Postgres quest rotation and the TypeScript mirror agree, exactly.
//
// This is the harness that matters for quests, for the same reason verify-rewards.ts matters for
// XP: the BOARD is rendered from game/quests.ts, but the PAYMENT is decided by
// kinetype.quest_ids_for() on the server. If the two ever disagree, the board promises a quest the
// server will not score — a quest that can never complete — and the player has no way to tell.
//
// So both sides are compared over a long span: 400 consecutive days for the daily three, 120 weeks
// for the weekly pair, plus every field of the quest book and every reward column. A single quest of
// drift fails the run.
//
// Run under tsx, NOT node, because the whole point is to compare the database against the REAL
// TypeScript rather than a copy of its arithmetic:
//
//   npx tsx scripts/verify-quests.ts
//
// It calls the SQL functions directly through the Management API, so it needs no test account and
// changes nothing.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  QUEST_DEFS,
  activeQuests,
  addDays,
  dailyRewardCap,
  epochDay,
  epochWeek,
  weeklyQuestIds,
  weeklyRewardCap,
  type QuestDef,
} from "../game/quests";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const REF: string = creds.project_ref;
const TOKEN = readFileSync(join(homedir(), "supabase-access-token"), "utf8").trim();

async function runSql(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`management API HTTP ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text) as Record<string, unknown>[];
}

let pass = 0;
let fail = 0;
const failures: string[] = [];
const check = (label: string, ok: boolean, detail = "") => {
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
  }
};

/** The day window the verifier walks. Chosen to straddle several month and year boundaries. */
const FIRST_DAY = "2025-01-01";
const DAYS = 400;
const WEEKS = 120;

interface CatalogRow {
  id: string;
  scope: string;
  tier: string | null;
  sort_order: number;
  metric: string;
  threshold: number;
  target: number;
  reward_xp: number;
  reward_coins: number;
  title: string;
  detail: string;
}

function compareDef(db: CatalogRow, ts: QuestDef): string | null {
  const fields: Array<[string, unknown, unknown]> = [
    ["scope", db.scope, ts.scope],
    ["tier", db.tier, ts.tier],
    ["sort_order", Number(db.sort_order), ts.sortOrder],
    ["metric", db.metric, ts.metric],
    ["threshold", Number(db.threshold), ts.threshold],
    ["target", Number(db.target), ts.target],
    ["reward_xp", Number(db.reward_xp), ts.rewardXp],
    ["reward_coins", Number(db.reward_coins), ts.rewardCoins],
    ["title", db.title, ts.title],
    ["detail", db.detail, ts.detail],
  ];
  for (const [name, a, b] of fields) {
    if (a !== b) return `${name}: db=${JSON.stringify(a)} ts=${JSON.stringify(b)}`;
  }
  return null;
}

async function main() {
  // ============================================================ 1. the quest book
  console.log("1. the quest book — every field of every row");

  const catalog = (await runSql(
    `select id, scope, tier, sort_order, metric, threshold, target, reward_xp, reward_coins,
            title, detail
     from kinetype.quest_catalog()`,
  )) as unknown as CatalogRow[];

  check(
    `the database holds ${QUEST_DEFS.length} quests`,
    catalog.length === QUEST_DEFS.length,
    `db has ${catalog.length}`,
  );

  const byId = new Map(catalog.map((r) => [r.id, r]));
  for (const ts of QUEST_DEFS) {
    const db = byId.get(ts.id);
    if (!db) {
      check(`quest ${ts.id} exists in the database`, false, "missing entirely");
      continue;
    }
    const drift = compareDef(db, ts);
    check(`quest ${ts.id} matches the TypeScript`, drift === null, drift ?? "");
  }

  // The other direction: a quest in the database that the TypeScript does not know about would
  // never be rendered, but the server could still score it.
  for (const row of catalog) {
    check(
      `${row.id} is known to the TypeScript`,
      QUEST_DEFS.some((q) => q.id === row.id),
      "the server offers a quest the board cannot draw",
    );
  }

  // ============================================================ 2. the rotation
  console.log(`\n2. the rotation — ${DAYS} consecutive days, then ${WEEKS} weeks`);

  const days = Array.from({ length: DAYS }, (_, i) => addDays(FIRST_DAY, i));
  const planRows = (await runSql(
    `select p_day::text as day, u.ord::int as ord, q.id
     from (values ${days.map((d) => `('${d}'::date)`).join(",")}) as t(p_day),
          unnest(kinetype.quest_ids_for(t.p_day)) with ordinality as u(id, ord)
     join kinetype.quest_defs q on q.id = u.id
     order by t.p_day, u.ord`,
  )) as unknown as Array<{ day: string; ord: number; id: string }>;

  // Fold the flat rows back into one list per day, in rotation order.
  const dbByDay = new Map<string, string[]>();
  for (const row of planRows) {
    const list = dbByDay.get(row.day) ?? [];
    list.push(row.id);
    dbByDay.set(row.day, list);
  }

  check(
    `the database answered for all ${DAYS} days`,
    dbByDay.size === DAYS,
    `${dbByDay.size} days came back`,
  );

  let dailyMismatch = 0;
  let missing = 0;
  for (const day of days) {
    const dbIds = dbByDay.get(day) ?? [];
    if (dbIds.length !== 5) {
      missing += 1;
      if (missing <= 3) failures.push(`${day}: the server returned ${dbIds.length} quests, not 5`);
      continue;
    }
    const tsIds = activeQuests(new Date(`${day}T12:00:00.000Z`)).map((q) => q.id);
    if (dbIds.join("|") !== tsIds.join("|")) {
      dailyMismatch += 1;
      if (dailyMismatch <= 5) {
        failures.push(`${day}: db=[${dbIds.join(",")}] ts=[${tsIds.join(",")}]`);
      }
    }
  }
  check(`${DAYS} days of five quests, in the same order`, missing === 0, `${missing} malformed days`);
  check(`every day's rotation matches to the quest`, dailyMismatch === 0, `${dailyMismatch} mismatches`);
  fail += dailyMismatch + missing;

  // The weekly pair, sampled on the Monday of each of 120 weeks — the whole cycle eight times over.
  const mondayOf = (day: string) => {
    const e = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
    return new Date((e - ((e + 3) % 7)) * 86_400_000).toISOString().slice(0, 10);
  };
  const mondays = Array.from({ length: WEEKS }, (_, w) => mondayOf(addDays(FIRST_DAY, w * 7)));
  const weeklyRows = (await runSql(
    `select t.p_day::text as day, q.id
     from (values ${mondays.map((d) => `('${d}'::date)`).join(",")}) as t(p_day),
          unnest(kinetype.quest_ids_for(t.p_day)) with ordinality as u(id, ord)
     join kinetype.quest_defs q on q.id = u.id
     where q.scope = 'weekly'
     order by t.p_day, u.ord`,
  )) as unknown as Array<{ day: string; id: string }>;

  const dbWeekly = new Map<string, string[]>();
  for (const row of weeklyRows) {
    const list = dbWeekly.get(row.day) ?? [];
    list.push(row.id);
    dbWeekly.set(row.day, list);
  }

  let weeklyMismatch = 0;
  for (const monday of mondays) {
    const dbIds = dbWeekly.get(monday) ?? [];
    const tsIds = weeklyQuestIds(new Date(`${monday}T12:00:00.000Z`));
    if (dbIds.join("|") !== tsIds.join("|")) {
      weeklyMismatch += 1;
      if (weeklyMismatch <= 5) {
        failures.push(`week of ${monday}: db=[${dbIds.join(",")}] ts=[${tsIds.join(",")}]`);
      }
    }
  }
  check(`${WEEKS} weeks of weekly pairs match`, weeklyMismatch === 0, `${weeklyMismatch} mismatches`);
  fail += weeklyMismatch;

  // ============================================================ 3. the ordinals
  console.log("\n3. the ordinals the rotation is built on");

  const ordinalRows = await runSql(`
    select t.d::text as day,
           kinetype.epoch_day(t.d)::int  as epoch_day,
           kinetype.epoch_week(t.d)::int as epoch_week,
           kinetype.week_start(t.d)::text as week_start
    from (values ${days.map((d) => `('${d}'::date)`).join(",")}) as t(d)
    order by t.d`);

  let ordinalMismatch = 0;
  for (const row of ordinalRows) {
    const day = String(row.day);
    const ts = new Date(`${day}T12:00:00.000Z`);
    const expectedWeekStart = (() => {
      const e = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
      return new Date((e - ((e + 3) % 7)) * 86_400_000).toISOString().slice(0, 10);
    })();
    const ok =
      Number(row.epoch_day) === epochDay(ts) &&
      Number(row.epoch_week) === epochWeek(ts) &&
      String(row.week_start) === expectedWeekStart;
    if (!ok) {
      ordinalMismatch += 1;
      if (ordinalMismatch <= 3) {
        failures.push(
          `${day}: db day=${row.epoch_day} week=${row.epoch_week} start=${row.week_start} | ` +
            `ts day=${epochDay(ts)} week=${epochWeek(ts)} start=${expectedWeekStart}`,
        );
      }
    }
  }
  check(`epoch_day, epoch_week and week_start agree on all ${DAYS} days`, ordinalMismatch === 0);
  fail += ordinalMismatch;

  // ============================================================ 4. the reward ceilings
  console.log("\n4. the reward ceilings the pacing argument rests on");

  const rewardRows = await runSql(`
    select scope, tier, count(*)::int as n,
           max(reward_xp)::int as max_xp, max(reward_coins)::int as max_coins,
           sum(reward_xp)::int as sum_xp, sum(reward_coins)::int as sum_coins
    from kinetype.quest_defs
    group by scope, tier
    order by scope, tier nulls last`);

  for (const row of rewardRows) {
    const scope = String(row.scope);
    const tier = row.tier === null ? null : String(row.tier);
    const tsPool = QUEST_DEFS.filter((q) => q.scope === scope && q.tier === tier);
    check(
      `${scope}/${tier ?? "all"}: the database holds ${tsPool.length} quests`,
      Number(row.n) === tsPool.length,
      `db has ${row.n}`,
    );
  }

  const dbDailyXp = Math.max(
    ...rewardRows.filter((r) => r.scope === "daily" && r.tier === "easy").map((r) => Number(r.max_xp)),
  );
  const dbDailyCoins = Math.max(
    ...rewardRows.filter((r) => r.scope === "daily" && r.tier === "easy").map((r) => Number(r.max_coins)),
  );
  const tsEasy = QUEST_DEFS.filter((q) => q.scope === "daily" && q.tier === "easy");
  check(
    "the easy tier's best reward agrees",
    dbDailyXp === Math.max(...tsEasy.map((q) => q.rewardXp)) &&
      dbDailyCoins === Math.max(...tsEasy.map((q) => q.rewardCoins)),
  );

  // The headline figures the design doc quotes, recomputed from the database's own rows.
  const dbMaxByTier = new Map<string, { xp: number; coins: number }>();
  for (const row of rewardRows) {
    if (row.scope !== "daily") continue;
    dbMaxByTier.set(String(row.tier), { xp: Number(row.max_xp), coins: Number(row.max_coins) });
  }
  const dbPerfectDay = {
    xp: ["easy", "medium", "hard"].reduce((t, k) => t + (dbMaxByTier.get(k)?.xp ?? 0), 0),
    coins: ["easy", "medium", "hard"].reduce((t, k) => t + (dbMaxByTier.get(k)?.coins ?? 0), 0),
  };
  check(
    `a perfect day from the database is ${dailyRewardCap().xp} XP / ${dailyRewardCap().coins} coins`,
    dbPerfectDay.xp === dailyRewardCap().xp && dbPerfectDay.coins === dailyRewardCap().coins,
    `db=${JSON.stringify(dbPerfectDay)} ts=${JSON.stringify(dailyRewardCap())}`,
  );

  // The best weekly PAIR, straight out of the database's pair table.
  const pairRows = await runSql(`
    select s.ord, sum(q.reward_xp)::int as xp, sum(q.reward_coins)::int as coins
    from kinetype.quest_weekly_sets s
    join kinetype.quest_defs q on q.id = s.quest_id
    group by s.ord`);
  const dbBestPair = {
    xp: Math.max(...pairRows.map((r) => Number(r.xp))),
    coins: Math.max(...pairRows.map((r) => Number(r.coins))),
  };
  check(
    `the best weekly pair from the database is ${weeklyRewardCap().xp} XP / ${weeklyRewardCap().coins} coins`,
    dbBestPair.xp === weeklyRewardCap().xp && dbBestPair.coins === weeklyRewardCap().coins,
    `db=${JSON.stringify(dbBestPair)} ts=${JSON.stringify(weeklyRewardCap())}`,
  );

  // A perfect week, which is the number the doc quotes against migration 0007's 28-day catalogue.
  const perfectWeek = {
    xp: dbPerfectDay.xp * 7 + dbBestPair.xp,
    coins: dbPerfectDay.coins * 7 + dbBestPair.coins,
  };
  console.log(
    `\n  a PERFECT week (all three dailies every day, both weeklies) pays at most ` +
      `${perfectWeek.xp} XP and ${perfectWeek.coins} coins`,
  );
  console.log(
    `  against a measured base of ~1 900 coins a day, that is +${Math.round(
      (perfectWeek.coins / 13_300) * 100,
    )}% on the 0007 catalogue pace at perfect completion\n`,
  );

  // ============================================================ 5. the server's own pool order
  console.log("5. the pools the rotation walks");

  const poolRows = await runSql(`
    select kinetype.quest_pool_ids('daily', 'easy')   as easy,
           kinetype.quest_pool_ids('daily', 'medium') as medium,
           kinetype.quest_pool_ids('daily', 'hard')   as hard,
           kinetype.quest_pool_ids('weekly', null)    as weekly`);

  // Postgres hands a text[] back as a JSON array through this API; normalise defensively so a
  // string form cannot silently turn into a one-element pool.
  const asArray = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return raw as string[];
    if (typeof raw === "string") return raw.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
    return [];
  };

  const poolOf = (tier: string | null) =>
    QUEST_DEFS.filter((q) => q.scope === (tier === null ? "weekly" : "daily") && (tier === null || q.tier === tier))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((q) => q.id);

  for (const [key, tier] of [
    ["easy", "easy"],
    ["medium", "medium"],
    ["hard", "hard"],
    ["weekly", null],
  ] as Array<[string, string | null]>) {
    const raw = (poolRows[0] as Record<string, unknown>)[key];
    const dbPool = asArray(raw);
    const tsPool = poolOf(tier);
    check(
      `the ${key} pool is in the same order (${tsPool.length} quests)`,
      dbPool.join("|") === tsPool.join("|"),
      `db=[${dbPool.join(",")}] ts=[${tsPool.join(",")}]`,
    );
  }

  // ============================================================ report
  console.log(`\n${"-".repeat(64)}`);
  console.log(`passed ${pass}   failed ${fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures.slice(0, 30)) console.log(`  - ${f}`);
    if (failures.length > 30) console.log(`  … and ${failures.length - 30} more`);
  }
  console.log(`${"-".repeat(64)}`);
  if (fail > 0) process.exit(1);
  console.log("QUEST ROTATION VERIFIED: TypeScript and live Postgres agree on every day");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
