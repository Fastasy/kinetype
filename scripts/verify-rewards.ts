// Proves the live Postgres reward functions and the TypeScript mirrors agree, exactly.
//
// This is the harness that matters for the difficulty-reward change: XP is server-authoritative, so
// if kinetype.xp_for_match() and game/progression.ts:xpForMatch() drift, the HUD, the leaderboard
// and the shop all disagree about what a match is worth. Both sides are compared over a matrix of
// rungs, outcomes and hostile inputs, and every figure must match to the unit.
//
// Run under tsx, NOT node, because the whole point is to compare the database against the REAL
// TypeScript rather than a copy of its arithmetic:
//
//   npx tsx scripts/verify-rewards.ts
//
// It calls the SQL functions directly through the Management API, so it needs no test account and
// changes nothing.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { BOT_WPM_LADDER, DIFFICULTY_PCT } from "../game/constants";
import {
  coinsForMatch,
  difficultyPct,
  rungIndexFor,
  xpForMatch,
  type MatchMode,
} from "../game/progression";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const REF: string = creds.project_ref;
const TOKEN = readFileSync(join(homedir(), "supabase-access-token"), "utf8").trim();

interface Row {
  rung: number;
  won: boolean;
  rounds: number;
  wpm: number;
  acc: number;
  streak: number;
  mode: MatchMode;
  firstClear: boolean;
}

// The rungs, then a spread of realistic outcomes, then hostile input.
const RUNGS = [...BOT_WPM_LADDER];
const PROFILES: Omit<Row, "rung">[] = [
  { won: true, rounds: 2, wpm: 45, acc: 95, streak: 3, mode: "free", firstClear: false },
  { won: true, rounds: 3, wpm: 100, acc: 97, streak: 5, mode: "free", firstClear: false },
  { won: true, rounds: 1, wpm: 30, acc: 88, streak: 0, mode: "free", firstClear: false },
  { won: false, rounds: 0, wpm: 60, acc: 90, streak: 0, mode: "free", firstClear: false },
  { won: false, rounds: 1, wpm: 25, acc: 70, streak: 0, mode: "free", firstClear: false },
  { won: true, rounds: 2, wpm: 70, acc: 96, streak: 1, mode: "boss", firstClear: true },
  { won: true, rounds: 2, wpm: 70, acc: 96, streak: 1, mode: "boss", firstClear: false },
];

const rows: Row[] = [];
for (const rung of RUNGS) for (const p of PROFILES) rows.push({ rung, ...p });

// Off-ladder opponents: a tie must snap DOWN, out-of-range must clamp to the ends.
for (const rung of [0, 25, 45, 119, 999_999]) {
  rows.push({ rung, won: true, rounds: 2, wpm: 45, acc: 95, streak: 3, mode: "free", firstClear: false });
}
// Clamping: absurd input must clamp to the same ceiling as a legal maximum.
rows.push({ rung: 120, won: true, rounds: 999, wpm: 99_999, acc: 99_999, streak: 999, mode: "boss", firstClear: true });
rows.push({ rung: 120, won: true, rounds: 5, wpm: 400, acc: 100, streak: 5, mode: "boss", firstClear: true });
rows.push({ rung: 120, won: false, rounds: -50, wpm: -100, acc: -100, streak: -9, mode: "free", firstClear: false });

function sqlValues(): string {
  return rows
    .map(
      (r) =>
        `(${r.rung}::int, ${r.won}::boolean, ${r.rounds}::int, ${r.wpm}::numeric, ${r.acc}::numeric, ` +
        `${r.streak}::int, '${r.mode}'::text, ${r.firstClear}::boolean)`,
    )
    .join(",\n    ");
}

const query = `
select row_number() over () as i,
       kinetype.rung_wpm(rung)            as snapped,
       kinetype.difficulty_pct(rung)      as pct,
       kinetype.xp_for_match(won, rounds, wpm, acc, streak, mode, first_clear, rung) as xp,
       kinetype.coins_for_match(won, rounds, wpm, acc, streak, rung)                 as coins
from (values
    ${sqlValues()}
) as t(rung, won, rounds, wpm, acc, streak, mode, first_clear)
`;

async function runSql(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`management API HTTP ${res.status}: ${text.slice(0, 500)}`);
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
  }
};

async function main() {
  const db = await runSql(query);
  check("the database returned one row per case", db.length === rows.length, `${db.length} vs ${rows.length}`);

  // The two tables themselves, rung by rung.
  const ladderRows = await runSql(`
    select r as rung, kinetype.difficulty_pct(r) as pct, kinetype.rung_wpm(r) as snapped
    from (values ${RUNGS.map((r) => `(${r}::int)`).join(",")}) t(r) order by r`);
  for (const row of ladderRows) {
    const rung = Number(row.rung);
    const idx = rungIndexFor(rung);
    check(
      `ladder ${rung} wpm -> ${DIFFICULTY_PCT[idx]}%`,
      Number(row.pct) === DIFFICULTY_PCT[idx] && Number(row.snapped) === BOT_WPM_LADDER[idx],
      `db pct=${row.pct} snapped=${row.snapped}, ts pct=${DIFFICULTY_PCT[idx]} snapped=${BOT_WPM_LADDER[idx]}`,
    );
  }

  let mismatches = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const d = db[i];
    if (!d) continue;
    const tsXp = xpForMatch({
      won: r.won,
      roundsWon: r.rounds,
      wpm: r.wpm,
      accuracy: r.acc,
      streak: r.streak,
      botWpm: r.rung,
      mode: r.mode,
      bossFirstClear: r.firstClear,
    });
    const tsCoins = coinsForMatch({
      won: r.won,
      roundsWon: r.rounds,
      wpm: r.wpm,
      accuracy: r.acc,
      streak: r.streak,
      botWpm: r.rung,
    });
    const tsPct = difficultyPct(r.rung);
    const tsSnapped = BOT_WPM_LADDER[rungIndexFor(r.rung)];

    const same =
      Number(d.xp) === tsXp &&
      Number(d.coins) === tsCoins &&
      Number(d.pct) === tsPct &&
      Number(d.snapped) === tsSnapped;
    if (!same) {
      mismatches += 1;
      if (mismatches <= 8) {
        failures.push(
          `case ${i} (rung ${r.rung}, won ${r.won}, wpm ${r.wpm}, acc ${r.acc}, streak ${r.streak}, ${r.mode}): ` +
            `db xp=${d.xp} coins=${d.coins} pct=${d.pct} snapped=${d.snapped} | ` +
            `ts xp=${tsXp} coins=${tsCoins} pct=${tsPct} snapped=${tsSnapped}`,
        );
      }
    }
  }
  check(`every one of ${rows.length} cases matches to the unit`, mismatches === 0, `${mismatches} mismatches`);
  fail += mismatches;

  // The shape of the curve, asserted on the DB's own numbers so a silent retune cannot pass.
  const curve = await runSql(`
    select r as rung,
           kinetype.coins_for_match(true, 2, 45, 95, 3, r)  as win_coins,
           kinetype.coins_for_match(false, 0, 45, 95, 0, r) as loss_coins
    from (values ${RUNGS.map((r) => `(${r}::int)`).join(",")}) t(r) order by r`);
  const wins = curve.map((c) => Number(c.win_coins));
  const losses = curve.map((c) => Number(c.loss_coins));
  console.log("\n  rung   win   loss   (win/loss)");
  curve.forEach((c, i) => {
    const ratio = losses[i] > 0 ? (wins[i] / losses[i]).toFixed(1) : "-";
    console.log(
      `  ${String(c.rung).padStart(4)}  ${String(wins[i]).padStart(4)}  ${String(losses[i]).padStart(5)}   ${ratio}x`,
    );
  });
  console.log();

  check("a win pays strictly more at every rung above the one below", wins.every((v, i) => i === 0 || v > wins[i - 1]));
  check("a win beats a loss at every rung", wins.every((v, i) => v > losses[i]));
  check("a loss is unchanged by difficulty", losses.every((v) => v === losses[0]));
  check("the 40 WPM rung is the 100% anchor (unchanged pace)", wins[RUNGS.indexOf(40)] === 140, `${wins[RUNGS.indexOf(40)]}`);

  console.log(`passed ${pass}   failed ${fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  if (fail > 0) process.exit(1);
  console.log("REWARD MIRROR VERIFIED: TypeScript and live Postgres agree");
}

// tsx compiles this as CJS, where a top-level `await` is a transform error, so the async entry
// point is called and its rejection handled explicitly.
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
