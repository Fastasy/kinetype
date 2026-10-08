// Proves the live Postgres boss gate and the TypeScript rule agree, exactly.
//
// WHY THIS EXISTS. `/play?boss=<id>` used to turn the arena into ANY boss in the roster, and
// `submit_match()` used to bank whatever payload it was handed — so a pasted URL both started a
// fight the account had not earned AND paid for it. The fix states the rule ("level clears the
// boss's gate AND the previous boss is beaten") in two places, for the same reason the quest
// rotation lives in two places:
//
//   * the CLIENT must answer instantly and signed-out-of-nothing, from `bossUnlocked()` in
//     game/progression.ts — a round trip to render a lock state would be absurd;
//   * the SERVER must own the refusal, so it cannot be handed the answer — `kinetype.boss_unlocked()`
//     plus the `boss_defs` roster in db/migrations/0010_boss_gate.sql.
//
// Two implementations of one rule is normally a defect. The guard is that drift is a FAILING TEST
// rather than a surprise: this script compares the roster field by field and walks the two
// functions against each other over every boss, every level 1..13, and a spread of cleared sets.
// If the client ever draws a lock the server would not enforce — or unlocks a fight the server
// would refuse — it fails here.
//
// Run under tsx, NOT node, because the point is to compare the database against the REAL TypeScript
// rather than a copy of its arithmetic:
//
//   npx tsx scripts/verify-bosses.ts
//
// It calls the SQL functions directly through the Management API, so it needs no test account and
// changes nothing.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { BOSSES, bossUnlocked } from "../game/progression";

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

interface DefRow {
  boss_id: string;
  ord: number;
  unlock_level: number;
}

/** Every level the gate can care about: below the first gate, each boss's own gate ± 1, and past
 *  the last one. Levels outside 1..13 cannot change the answer, because the rule reads level only
 *  through `level < unlockLevel`. */
const LEVELS = Array.from({ length: 13 }, (_, i) => i + 1);

/** A spread of cleared sets per boss: nothing, a stray clear, the immediately-preceding prefix, the
 *  prefix for a LATER boss, everything, and the boss itself. */
function clearedSetsFor(index: number): Array<{ label: string; ids: string[] }> {
  const all = BOSSES.map((b) => b.id);
  return [
    { label: "none", ids: [] },
    { label: "self", ids: [BOSSES[index].id] },
    { label: "stray", ids: ["oblivion"] },
    { label: "prefix", ids: all.slice(0, index) },
    { label: "prefix+1", ids: all.slice(0, index + 1) },
    { label: "all", ids: all },
  ];
}

async function main() {
  const defs = (await runSql(
    "select boss_id, ord, unlock_level from kinetype.boss_defs order by ord",
  )) as unknown as DefRow[];

  // ============================================================ 1. the roster, as data
  console.log("1. kinetype.boss_defs mirrors the TypeScript roster");
  check("the roster has one row per boss", defs.length === BOSSES.length, `db=${defs.length} ts=${BOSSES.length}`);

  let rosterDrift = 0;
  for (let i = 0; i < Math.max(defs.length, BOSSES.length); i += 1) {
    const d = defs[i];
    const b = BOSSES[i];
    if (!d || !b) {
      rosterDrift += 1;
      failures.push(`row ${i}: db=${d ? d.boss_id : "(missing)"} ts=${b ? b.id : "(missing)"}`);
      continue;
    }
    if (d.boss_id !== b.id || Number(d.ord) !== i + 1 || Number(d.unlock_level) !== b.unlockLevel) {
      rosterDrift += 1;
      failures.push(
        `row ${i}: db=${d.boss_id}/ord ${d.ord}/lvl ${d.unlock_level} vs ts=${b.id}/ord ${i + 1}/lvl ${b.unlockLevel}`,
      );
    }
  }
  check("every boss's id, order and level gate matches", rosterDrift === 0, rosterDrift ? failures.slice(-1)[0] : "");

  const ids = defs.map((d) => d.boss_id).sort().join(",");
  const tsIds = BOSSES.map((b) => b.id).sort().join(",");
  check("the id sets are identical", ids === tsIds, `db=[${ids}] ts=[${tsIds}]`);

  const rewards = (await runSql("select boss_id from kinetype.boss_rewards order by boss_id")) as unknown as Array<{ boss_id: string }>;
  check(
    "the coin-bounty table covers exactly the same bosses",
    rewards.map((r) => r.boss_id).sort().join(",") === tsIds,
    `rewards=[${rewards.map((r) => r.boss_id).join(",")}]`,
  );

  // ============================================================ 2. the rule, walked both sides
  // One round trip: every (boss, level, cleared set) handed to the SQL rule at once.
  const rows: Array<{ boss: string; level: number; label: string; ids: string[]; index: number }> = [];
  for (let i = 0; i < BOSSES.length; i += 1) {
    for (const level of LEVELS) {
      for (const set of clearedSetsFor(i)) {
        rows.push({ boss: BOSSES[i].id, level, label: set.label, ids: set.ids, index: i });
      }
    }
  }

  const valuesSql = rows
    .map((r) => `('${r.boss}', ${r.level}, '${r.label}', ${r.ids.length ? `array[${r.ids.map((k) => `'${k}'`).join(",")}]::text[]` : `'{}'::text[]`})`)
    .join(",\n    ");

  console.log(`\n2. kinetype.boss_unlocked() vs bossUnlocked() — ${rows.length} combinations`);
  const sqlRows = (await runSql(
    `select v.boss, v.level, v.label, kinetype.boss_unlocked(v.level, v.boss, v.cleared) as unlocked
     from (values
    ${valuesSql}
     ) as v(boss, level, label, cleared)`,
  )) as unknown as Array<{ boss: string; level: number; label: string; unlocked: boolean }>;

  check("the database answered every combination", sqlRows.length === rows.length, `${sqlRows.length} of ${rows.length}`);

  const byKey = new Map(sqlRows.map((r) => [`${r.boss}|${r.level}|${r.label}`, r.unlocked]));
  let drift = 0;
  for (const r of rows) {
    const boss = BOSSES[r.index];
    const ts = bossUnlocked(boss, r.level, r.ids);
    const db = byKey.get(`${r.boss}|${r.level}|${r.label}`);
    if (ts !== db) {
      drift += 1;
      if (drift <= 8) {
        failures.push(`${r.boss} lvl ${r.level} cleared=[${r.ids.join(",")}]: ts=${ts} db=${db}`);
        console.log(`  FAIL ${r.boss} lvl ${r.level} cleared=[${r.ids.join(",")}]: ts=${ts} db=${db}`);
      }
    }
  }
  check("the two rules agree on every combination", drift === 0, drift ? `${drift} disagreements` : "");

  // The shape of the rule itself, asserted rather than assumed: the first boss is open at level 1
  // with nothing cleared, and the last one needs BOTH its level and the whole preceding ladder.
  console.log("\n3. the rule has the shape the campaign needs");
  check("the first boss is enterable at level 1 with nothing beaten",
    byKey.get(`${BOSSES[0].id}|1|none`) === true);
  check("the last boss is NOT enterable at its own level with the ladder unbeaten",
    byKey.get(`${BOSSES[BOSSES.length - 1].id}|${BOSSES[BOSSES.length - 1].unlockLevel}|none`) === false);
  check("the last boss IS enterable at its own level with the whole ladder beaten",
    byKey.get(`${BOSSES[BOSSES.length - 1].id}|${BOSSES[BOSSES.length - 1].unlockLevel}|prefix`) === true);
  check("clearing a boss you are not allowed to reach does not open its successor",
    byKey.get(`${BOSSES[1].id}|1|self`) === false);

  // ============================================================ 4. the miss cases
  console.log("\n4. the rule refuses what it cannot vouch for");
  const unknown = (await runSql(
    "select kinetype.boss_unlocked(12, 'not-a-boss', '{}'::text[]) as u, kinetype.boss_unlocked(12, '', '{}'::text[]) as e",
  )) as unknown as Array<{ u: boolean; e: boolean }>;
  check("an unknown boss id answers false", unknown[0].u === false && unknown[0].e === false,
    `not-a-boss=${unknown[0].u} empty=${unknown[0].e}`);

  const nullLevel = (await runSql(
    "select kinetype.boss_unlocked(null, 'tick', '{}'::text[]) as u",
  )) as unknown as Array<{ u: boolean }>;
  check("a null level answers false, never true", nullLevel[0].u === false, `${nullLevel[0].u}`);

  const nonEmpty = (await runSql(
    "select kinetype.boss_unlocked(1, 'tick', null) as u",
  )) as unknown as Array<{ u: boolean }>;
  check("a null cleared set does not crash the rule", nonEmpty[0].u === true, `${nonEmpty[0].u}`);

  // ============================================================ 5. submit_match still refuses
  // The rule is only load-bearing if the payout path actually calls it. Read the live function and
  // assert the refusal is in it — a re-definition that dropped the block would sail past everything
  // above, which only tests the helper.
  console.log("\n5. submit_match() actually consults the rule");
  const src = (await runSql(
    "select pg_get_functiondef('kinetype.submit_match(text,text,integer,boolean,numeric,numeric,integer,integer,integer,integer)'::regprocedure) as def",
  )) as unknown as Array<{ def: string }>;
  const def = src[0].def;
  check("the payout path calls kinetype.boss_unlocked", /kinetype\.boss_unlocked\s*\(/.test(def));
  check("the payout path refuses an unlocked-less boss",
    /That boss is not unlocked yet/.test(def));
  check("the payout path refuses an unknown boss", /Unknown boss/.test(def));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\nfailures:");
    for (const f of failures.slice(0, 20)) console.log(`  - ${f}`);
  }
  if (fail > 0) process.exit(1);
}

void main();
