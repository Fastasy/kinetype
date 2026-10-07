// END-TO-END PROOF that quests pay, and pay exactly once.
//
// Everything else in this feature is argued; this script is the evidence. It creates a throwaway
// account, plays a scripted run of matches through the REAL kinetype.submit_match() over the REAL
// Management API, and asserts the money.
//
// WHAT IT PROVES, and why each one needs to be proved rather than assumed:
//
//   1. CONSERVATION. The XP and coins on the profile equal exactly (every match's xp_awarded) +
//      (every quest award) + (the first-win bonus if this run earned it). Not "close to" — equal.
//      This is the check that catches a quest paying twice, paying the wrong amount, or paying for
//      a quest that was never completed.
//   2. THE ROTATION IS WHAT GETS SCORED. It reads the day's plan from the server and asserts the
//      quests that completed are quests from that plan, at their stated rewards. Nothing is
//      hard-coded to a date, so this keeps meaning something on any day it is run.
//   3. A FLAGGED MATCH PAYS NOTHING AND ADVANCES NOTHING. A submission inside the 5-second gap is
//      flagged; it must not land on the profile, must not complete a quest, and must not move a
//      quest's progress.
//   4. A QUEST PAYS ONCE. quest_award() called again pays 0.
//
// It needs the service-role key (to mint the throwaway account) and the access token (to run SQL),
// both already in ~/.kinetype and ~/. Tests run as the table OWNER, which is why it can call
// quest_award() directly — the function is deliberately unreachable from the API.
//
//   npx tsx scripts/probe-quests.ts
//
// IT WRITES TO THE LIVE PROJECT AND THEN DELETES ITS OWN FIXTURE. The account is created fresh and
// removed in a finally block, so a failure cannot leave a half-player behind.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  QUEST_DEFS,
  activeQuests,
  addDays,
  dailyQuestIds,
  dailyRewardCap,
  weeklyRewardCap,
} from "../game/quests";

interface PlanRow {
  id: string;
  scope: string;
  tier: string | null;
  target: number;
  reward_xp: number;
  reward_coins: number;
}

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const REF: string = creds.project_ref;
const URL: string = creds.project_url;
const SERVICE: string = creds.service_role_key;
const TOKEN = readFileSync(join(homedir(), "supabase-access-token"), "utf8").trim();

const EMAIL = "quest-probe@users.kinetype.app";
const PASSWORD = "quest-probe-fixture";

let pass = 0;
let fail = 0;
const failures: string[] = [];
const check = (label: string, ok: boolean, detail = "") => {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
  }
};

async function sql(query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`management API HTTP ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text) as Record<string, unknown>[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The gap the server's flag threshold is built on. One second clear of it. */
const HONEST_GAP_MS = 6000;

interface Fixture {
  id: string;
}

/** Delete any leftover fixture, then mint a fresh account. Fresh matters: the first-win bonus and
 *  the day streak must start from zero or the conservation check has to make excuses. */
async function createFixture(): Promise<Fixture> {
  const listing = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  }).then((r) => r.json() as Promise<{ users: Array<{ id: string; email: string }> }>);

  for (const u of listing.users ?? []) {
    if (u.email === EMAIL) {
      await fetch(`${URL}/auth/v1/admin/users/${u.id}`, {
        method: "DELETE",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      });
    }
  }

  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`could not create the fixture account: ${res.status} ${await res.text()}`);
  const created = (await res.json()) as { id: string };
  return { id: created.id };
}

async function deleteFixture(id: string): Promise<void> {
  const res = await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  console.log(`\nfixture account removed: HTTP ${res.status}`);
}

/** Run a statement with request.jwt.claims set, so auth.uid() answers as this player.
 *  Everything happens in ONE transaction, which is how the setting stays scoped to the call. */
async function asPlayer<T>(uid: string, body: string): Promise<T> {
  const rows = await sql(`do $probe$
begin
  perform set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', '${uid}', true);
  ${body}
end $probe$;`);
  return rows as T;
}

/** One finished match, as the client would report it. */
async function submit(
  uid: string,
  args: { won: boolean; wpm: number; accuracy: number; combo: number; roundsWon: number; roundsLost: number; streak: number; mode?: string; bossId?: string | null },
): Promise<void> {
  const bossId = args.bossId ? `'${args.bossId}'` : "null";
  await asPlayer(
    uid,
    `perform kinetype.submit_match('${args.mode ?? "free"}', ${bossId}, 40, ${args.won}, ` +
      `${args.wpm}, ${args.accuracy}, ${args.combo}, ${args.roundsWon}, ${args.roundsLost}, ${args.streak});`,
  );
}

interface QuestRow {
  quest_id: string;
  scope: string;
  tier: string | null;
  target: number;
  reward_xp: number;
  reward_coins: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  period_key: string;
}

/** my_quests() for this player. A DO block cannot return rows, so the result is parked in a temp
 *  table created in the same statement batch and read back. */
async function myQuests(uid: string): Promise<QuestRow[]> {
  return sql(`create temporary table probe_quests as
  select * from kinetype.my_quests() where false;
do $probe$
begin
  perform set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', '${uid}', true);
  insert into probe_quests select * from kinetype.my_quests();
end $probe$;
select quest_id, scope, tier, target, reward_xp, reward_coins, progress, completed, claimed,
       period_key
from probe_quests order by quest_id;`) as unknown as Promise<QuestRow[]>;
}

async function main() {
  const fx = await createFixture();
  console.log(`fixture account: ${fx.id}\n`);

  try {
    // ======================================================== the day's plan, from the server
    const today = (await sql(`select (now() at time zone 'utc')::date::text as d`))[0].d as string;
    const plan = (await sql(
      `select q.id, q.scope, q.tier, q.target, q.reward_xp, q.reward_coins
       from unnest(kinetype.quest_ids_for(date '${today}')) with ordinality as u(id, ord)
       join kinetype.quest_defs q on q.id = u.id order by u.ord`,
    )) as unknown as PlanRow[];

    console.log(`1. the server's plan for ${today}`);
    check("three dailies and two weeklies", plan.length === 5, `got ${plan.length}`);
    check("one easy, one medium, one hard",
      plan.filter((q) => q.scope === "daily").map((q) => q.tier).join(",") === "easy,medium,hard",
      plan.filter((q) => q.scope === "daily").map((q) => q.tier).join(","));
    check("the client's own rotation agrees with the server's plan",
      activeQuests(new Date(`${today}T12:00:00.000Z`)).map((q) => q.id).join("|") ===
        plan.map((q) => q.id).join("|"),
      `client=[${activeQuests(new Date(`${today}T12:00:00.000Z`)).map((q) => q.id).join(",")}] server=[${plan.map((q) => q.id).join(",")}]`);
    for (const q of plan) console.log(`     ${q.tier ?? "weekly"}: ${q.id} (${q.target}, +${q.reward_xp} XP / +${q.reward_coins})`);

    // ======================================================== five honest matches
    // Scripted to clear as many of the day's dailies as a scripted run can: enough matches for a
    // volume quest, every one a 2-0 for a clean win, fast enough for a speed bar, clean enough for
    // an accuracy bar, and a maxed chain for a combo bar.
    console.log("\n2. five honest matches (2-0 wins, 65 WPM, 98-100% accuracy, maxed chain)");
    for (let i = 1; i <= 5; i++) {
      if (i > 1) await sleep(HONEST_GAP_MS);
      await submit(fx.id, {
        won: true, wpm: 65, accuracy: i === 3 ? 100 : 98, combo: 12,
        roundsWon: 2, roundsLost: 0, streak: i,
      });
      process.stdout.write(`  ...match ${i} banked\n`);
    }

    const afterHonest = await sql(
      `select (select coalesce(sum(xp_awarded),0) from kinetype.matches where user_id='${fx.id}') as match_xp,
              (select coalesce(sum(xp),0)          from kinetype.quest_awards where user_id='${fx.id}') as quest_xp,
              (select coalesce(sum(coins),0)       from kinetype.quest_awards where user_id='${fx.id}') as quest_coins,
              (select count(*)                     from kinetype.matches where user_id='${fx.id}' and flag_reason is not null) as flagged,
              (select xp from kinetype.profiles where id='${fx.id}')    as profile_xp,
              (select coins from kinetype.profiles where id='${fx.id}') as profile_coins,
              (select first_win_on from kinetype.profiles where id='${fx.id}') as first_win_on,
              (select streak_days from kinetype.profiles where id='${fx.id}') as streak_days`,
    );
    const a = afterHonest[0] as Record<string, unknown>;
    const num = (k: string) => Number(a[k]);

    check("no honest match was flagged", num("flagged") === 0, `${a.flagged} flagged`);
    check("all five matches were recorded", num("match_xp") > 0);

    const quests = await myQuests(fx.id);
    const claimed = quests.filter((q) => q.claimed);
    // Every claimed quest must be one of the day's plan; a claimed quest the plan does not contain
    // would mean the server scored a quest the board is not showing.
    const claimedDefs = claimed
      .map((q) => plan.find((p) => p.id === q.quest_id))
      .filter((p): p is PlanRow => Boolean(p));
    const expectedQuestXp = claimedDefs.reduce((t, q) => t + Number(q.reward_xp), 0);
    const expectedQuestCoins = claimedDefs.reduce((t, q) => t + Number(q.reward_coins), 0);

    console.log(`\n  quests claimed: ${claimed.length === 0 ? "(none)" : claimed.map((q) => q.quest_id).join(", ")}`);
    check(
      "quest awards in the ledger equal the claimed quests' rewards",
      num("quest_xp") === expectedQuestXp && num("quest_coins") === expectedQuestCoins,
      `ledger ${num("quest_xp")} XP / ${num("quest_coins")} coins vs claimed ${expectedQuestXp} / ${expectedQuestCoins}`,
    );
    check("only quests from the server's own plan were claimed", claimedDefs.length === claimed.length);
    const weekKey = `w:${mondayOfKey(today)}`;
    check(
      "every claimed quest belongs to today's or this week's period",
      claimed.every((q) => q.period_key === `d:${today}` || q.period_key === weekKey),
      claimed.map((q) => `${q.quest_id}=${q.period_key}`).join(","),
    );
    check(
      "at least three quests completed from five scripted wins — a quest that cannot pay is a bug",
      claimed.length >= 3,
      `only ${claimed.length} claimed`,
    );

    // ---- conservation -----------------------------------------------------------------------
    // In free mode a match's coins equal its XP (coins_for_match is xp_for_match minus the boss
    // terms), so the account's balance is exactly:
    //     XP    = match XP    + quest XP
    //     coins = match XP    + quest COINS + the first-win bonus
    // Note the two currencies are NOT the same sum: a quest pays 35 XP but 50 coins, so the quest
    // term has to be read per currency or this check is arithmetic theatre.
    console.log("\n3. conservation — no XP or coin exists that a rule did not create");
    const firstWinPaid = a.first_win_on !== null && a.first_win_on !== undefined;
    const expectedProfileXp = num("match_xp") + num("quest_xp");
    const expectedProfileCoins = num("match_xp") + num("quest_coins") + (firstWinPaid ? 100 : 0);
    check(`the first win of the day was recorded (${String(a.first_win_on)})`, firstWinPaid);
    check("it was today", String(a.first_win_on) === today, `${a.first_win_on} vs ${today}`);
    check(
      `profile XP is exactly match XP + quest XP (${expectedProfileXp})`,
      num("profile_xp") === expectedProfileXp,
      `profile ${a.profile_xp}`,
    );
    check(
      `profile coins are exactly match XP + quest coins + the first-win bonus (${expectedProfileCoins})`,
      num("profile_coins") === expectedProfileCoins,
      `profile ${a.profile_coins}`,
    );
    check(
      "the first-win bonus was paid exactly once, and it is the only coin that did not come from a match or a quest",
      num("profile_coins") - num("match_xp") - num("quest_coins") === 100,
      `difference ${num("profile_coins") - num("match_xp") - num("quest_coins")}`,
    );
    check("today counts as one day of the streak", num("streak_days") === 1, `${a.streak_days}`);

    // ---- the ledger is what the board reads ---------------------------------------------------
    const ledgerRows = await sql(
      `select count(*)::int as n from kinetype.quest_awards where user_id='${fx.id}'`,
    );
    check(
      "there is exactly one ledger row per claimed quest",
      Number((ledgerRows[0] as Record<string, unknown>).n) === claimed.length,
      `ledger rows ${(ledgerRows[0] as Record<string, unknown>).n} vs claimed ${claimed.length}`,
    );

    // ======================================================== a flagged match
    console.log("\n4. a flagged match pays nothing and advances nothing");
    const beforeFlag = await sql(
      `select (select count(*) from kinetype.matches where user_id='${fx.id}') as n,
              (select count(*) from kinetype.quest_awards where user_id='${fx.id}') as awards,
              (select xp from kinetype.profiles where id='${fx.id}') as xp,
              (select coins from kinetype.profiles where id='${fx.id}') as coins`,
    );
    // No sleep: this lands inside the 5-second gap and the server flags it.
    await submit(fx.id, { won: true, wpm: 65, accuracy: 98, combo: 12, roundsWon: 2, roundsLost: 0, streak: 6 });
    const afterFlag = await sql(
      `select (select count(*) from kinetype.matches where user_id='${fx.id}') as n,
              (select count(*) from kinetype.matches where user_id='${fx.id}' and flag_reason is not null) as flagged,
              (select coalesce(max(flag_reason),'') from kinetype.matches where user_id='${fx.id}') as reason,
              (select count(*) from kinetype.quest_awards where user_id='${fx.id}') as awards,
              (select xp from kinetype.profiles where id='${fx.id}') as xp,
              (select coins from kinetype.profiles where id='${fx.id}') as coins`,
    );
    const b = beforeFlag[0] as Record<string, unknown>;
    const c = afterFlag[0] as Record<string, unknown>;
    check("the disputed match was recorded", Number(c.n) === Number(b.n) + 1);
    check("and was flagged", Number(c.flagged) === 1, `${c.flagged} flagged`);
    check(`the flag carries a reason ("${c.reason}")`, String(c.reason).length > 0);
    check("it paid no XP", Number(c.xp) === Number(b.xp), `${b.xp} -> ${c.xp}`);
    check("it paid no coins", Number(c.coins) === Number(b.coins), `${b.coins} -> ${c.coins}`);
    check("it completed no quest", Number(c.awards) === Number(b.awards));

    // The flagged row must also be invisible to quest progress: matches played counts only honest
    // matches, so a flagged one cannot grind a volume quest.
    const honest = await sql(
      `select count(*)::int as n from kinetype.matches where user_id='${fx.id}' and flag_reason is null`,
    );
    const dayWindow = `(date_trunc('day', now() at time zone 'utc') at time zone 'utc'),
                       ((date_trunc('day', now() at time zone 'utc') + interval '1 day') at time zone 'utc')`;
    const prog = await sql(
      `select kinetype.quest_progress_value('matches', 0, ${dayWindow}, '${fx.id}')::int as matches,
              kinetype.quest_progress_value('win_streak', 0, ${dayWindow}, '${fx.id}')::int as best_run,
              kinetype.quest_progress_value('clean_wins', 0, ${dayWindow}, '${fx.id}')::int as clean_wins`,
    );
    const p = prog[0] as Record<string, unknown>;
    check(
      `quest progress counts ${honest[0].n} honest matches, not 6`,
      Number(p.matches) === Number((honest[0] as Record<string, unknown>).n),
      `progress says ${p.matches}, honest matches ${honest[0].n}`,
    );
    check("the flagged match did not extend the win streak", Number(p.best_run) === 5, `${p.best_run}`);
    check("it did not add a clean win", Number(p.clean_wins) === 5, `${p.clean_wins}`);

    // ======================================================== pays once
    console.log("\n5. a quest pays once, ever");
    const again = (await sql(`select * from kinetype.quest_award('${fx.id}')`))[0] as Record<string, unknown>;
    check("calling quest_award() again pays 0 XP and 0 coins",
      Number(again.xp) === 0 && Number(again.coins) === 0,
      `paid ${again.xp} XP / ${again.coins} coins`);
    const final = await sql(
      `select (select count(*) from kinetype.quest_awards where user_id='${fx.id}') as awards,
              (select xp from kinetype.profiles where id='${fx.id}') as xp`,
    );
    check("the ledger did not grow", Number((final[0] as Record<string, unknown>).awards) === Number(c.awards));
    check("the profile did not grow", Number((final[0] as Record<string, unknown>).xp) === Number(c.xp));

    // ======================================================== the board reads it back
    console.log("\n6. the board reads the same numbers back");
    // Progress is the RAW derived metric, not a fraction — it may legitimately exceed the target
    // (five clean wins against a target of one), because that is what actually happened. The bar
    // clamps; the number does not lie.
    const board = await myQuests(fx.id);
    check("my_quests returns the day's full five", board.length === 5, `${board.length}`);
    check("a claimed quest reports claimed and complete",
      board.filter((q) => q.claimed).every((q) => q.completed),
      board.filter((q) => q.claimed).map((q) => `${q.quest_id}:${q.completed}`).join(","));
    check(
      "every completed quest has at least reached its target",
      board.filter((q) => q.completed).every((q) => Number(q.progress) >= Number(q.target)),
      board.map((q) => `${q.quest_id}:${q.progress}/${q.target}`).join(","),
    );
    check(
      "an incomplete quest has NOT reached its target",
      board.filter((q) => !q.completed).every((q) => Number(q.progress) < Number(q.target)),
      board.map((q) => `${q.quest_id}:${q.progress}/${q.target}`).join(","),
    );
    check("quests the player cannot have done are not complete",
      board.every((q) => Number(q.progress) >= Number(q.target) || !q.completed));
    check(
      "no weekly quest was claimed off the back of five free-play matches",
      board.filter((q) => q.scope === "weekly").every((q) => !q.claimed || Number(q.target) <= 5),
    );

    // ======================================================== ceilings
    console.log("\n7. the reward ceilings still describe this build");
    const caps = await sql(`
      select max(q.reward_xp) filter (where q.tier='easy')::int   as easy_xp,
             max(q.reward_xp) filter (where q.tier='medium')::int as medium_xp,
             max(q.reward_xp) filter (where q.tier='hard')::int   as hard_xp
      from kinetype.quest_defs q where q.scope='daily'`);
    const capsRow = caps[0] as Record<string, unknown>;
    const dbPerfectDayXp =
      Number(capsRow.easy_xp) + Number(capsRow.medium_xp) + Number(capsRow.hard_xp);
    check(
      `a perfect day is still ${dailyRewardCap().xp} XP`,
      dbPerfectDayXp === dailyRewardCap().xp,
      `db ${dbPerfectDayXp} vs ts ${dailyRewardCap().xp}`,
    );
    check(
      `a perfect weekly pair still pays ${weeklyRewardCap().xp} XP / ${weeklyRewardCap().coins} coins — the pacing figure the doc quotes`,
      weeklyRewardCap().xp === 820 && weeklyRewardCap().coins === 1130,
      `${weeklyRewardCap().xp}/${weeklyRewardCap().coins}`,
    );

    // ======================================================== the rotation turns over
    console.log("\n8. the rotation turns over (checked against the server's own answer)");
    const tomorrow = addDays(today, 1);
    const tsTomorrow = dailyQuestIds(new Date(`${tomorrow}T12:00:00.000Z`));
    const tsToday = activeQuests(new Date(`${today}T12:00:00.000Z`))
      .filter((q) => q.scope === "daily")
      .map((q) => q.id);
    const rollover = (await sql(
      `select kinetype.quest_ids_for(date '${tomorrow}')::text as ids`,
    ))[0] as Record<string, unknown>;

    check(
      "tomorrow offers a different daily set",
      tsTomorrow.join("|") !== tsToday.join("|"),
      `today=${tsToday.join(",")} tomorrow=${tsTomorrow.join(",")}`,
    );
    check(
      "the server agrees with the client about tomorrow's set",
      tsTomorrow.every((id) => String(rollover.ids).includes(id)),
      `server=${rollover.ids} client=${tsTomorrow.join(",")}`,
    );
    check(
      "every quest named by both sides is a quest that exists",
      tsTomorrow.every((id) => QUEST_DEFS.some((d) => d.id === id)),
    );
  } finally {
    await deleteFixture(fx.id);
  }

  console.log(`\n${"-".repeat(60)}`);
  console.log(`passed ${pass}   failed ${fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`${"-".repeat(60)}`);
  if (fail > 0) process.exit(1);
  console.log("QUESTS VERIFIED END TO END: they pay, exactly once, and only for honest matches");
}

// The Monday that opens a day's week, matching kinetype.week_start().
function mondayOfKey(day: string): string {
  const e = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return new Date((e - ((e + 3) % 7)) * 86_400_000).toISOString().slice(0, 10);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
