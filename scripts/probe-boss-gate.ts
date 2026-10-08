// END-TO-END PROOF that a locked boss cannot be entered — or paid — by typing a URL.
//
// THE BUG THIS LOCKS DOWN. `/play?boss=<id>` rendered the arena for any boss in the roster, whatever
// the account had earned, and `submit_match()` banked whatever payload it was handed. So a level-1
// player could paste `/play?boss=oblivion`, fight the final boss, and be paid the XP, the flat boss
// bonus, the one-time coin bounty AND the boss clear. The ladder could be skipped outright.
//
// The UI now refuses to mount a locked arena (proved in scripts/probe-boss-gate-ui.mjs). THIS script
// proves the half that cannot be skipped by editing the address bar: the server re-derives the rule
// from rows it owns and REFUSES the match. The important assertion is not merely "it raised" — it is
// that a refusal leaves the account BYTE-IDENTICAL. A locked fight must pay nothing, record nothing
// and move nothing.
//
// It creates a throwaway account, drives the real kinetype.submit_match() through the real
// Management API as that player, and deletes its fixture in a finally block.
//
//   npx tsx scripts/probe-boss-gate.ts
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const REF: string = creds.project_ref;
const URL: string = creds.project_url;
const SERVICE: string = creds.service_role_key;
const TOKEN = readFileSync(join(homedir(), "supabase-access-token"), "utf8").trim();

const EMAIL = "boss-gate-probe@users.kinetype.app";
const PASSWORD = "boss-gate-probe-fixture";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One second clear of the server's 5-second inter-match flag, so an ACCEPTED submit is never
 *  mistaken for a scripted burst. Refusals raise before the flag is even computed. */
const HONEST_GAP_MS = 6000;

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

/** Run a statement with request.jwt.claims set, so auth.uid() answers as this player. Everything is
 *  one transaction, which is how the setting stays scoped — and why a raised refusal rolls back
 *  cleanly rather than leaving a half-written match. Returns the raw response so a refusal can be
 *  asserted rather than thrown. */
async function asPlayerRaw(uid: string, body: string): Promise<{ ok: boolean; text: string }> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `do $probe$
begin
  perform set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', '${uid}', true);
  ${body}
end $probe$;`,
    }),
  });
  return { ok: res.ok, text: await res.text() };
}

/** The payload a client sends for one finished match. `bossId` null means free play. */
function matchCall(args: {
  bossId: string | null;
  botWpm: number;
  won?: boolean;
  wpm?: number;
  accuracy?: number;
  roundsWon?: number;
  roundsLost?: number;
}): string {
  const boss = args.bossId === null ? "null" : `'${args.bossId}'`;
  const mode = args.bossId === null ? "free" : "boss";
  return (
    `perform kinetype.submit_match('${mode}', ${boss}, ${args.botWpm}, ${args.won ?? true}, ` +
    `${args.wpm ?? 65}, ${args.accuracy ?? 98}, 12, ${args.roundsWon ?? 2}, ${args.roundsLost ?? 0}, 1);`
  );
}

interface Profile {
  xp: number;
  coins: number;
  matches: number;
  bosses_cleared: number;
  flags: number;
}

async function profile(uid: string): Promise<Profile> {
  const rows = (await sql(
    `select xp, coins, matches, bosses_cleared, flags from kinetype.profiles where id = '${uid}'`,
  )) as unknown as Profile[];
  return rows[0];
}

async function cleared(uid: string): Promise<string[]> {
  const rows = (await sql(
    `select boss_id from kinetype.boss_clears where user_id = '${uid}' order by boss_id`,
  )) as unknown as Array<{ boss_id: string }>;
  return rows.map((r) => r.boss_id);
}

/** Compare two profile snapshots field by field. A refused match must return the SAME object. */
function same(a: Profile, b: Profile): string {
  const keys: Array<keyof Profile> = ["xp", "coins", "matches", "bosses_cleared", "flags"];
  const diffs = keys.filter((k) => Number(a[k]) !== Number(b[k])).map((k) => `${k} ${a[k]}->${b[k]}`);
  return diffs.join(", ");
}

async function createFixture(): Promise<string> {
  const listing = (await fetch(`${URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  }).then((r) => r.json())) as { users?: Array<{ id: string; email: string }> };
  for (const u of listing.users ?? []) {
    if (u.email === EMAIL) {
      // Delete any leftover FIRST, so a failed previous run cannot leave a boss already cleared and
      // make this run's "level 1, nothing beaten" premise a lie.
      await fetch(`${URL}/auth/v1/admin/users/${u.id}`, {
        method: "DELETE",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      });
    }
  }
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`could not create the fixture account: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

async function deleteFixture(id: string): Promise<void> {
  const res = await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  console.log(`\nfixture account removed: HTTP ${res.status}`);
}

async function main() {
  const uid = await createFixture();
  console.log(`fixture account: ${uid} (level 1, nothing cleared)\n`);

  try {
    // The profile row is created on first sign-in; ensure_profile() is what a real client calls.
    await asPlayerRaw(uid, "perform kinetype.ensure_profile();");

    /** The level the DB derives from a lifetime XP total. Set XP as the OWNER, straight to the
     *  column: a probe cannot earn a level 12 account honestly in one run, and level is a GENERATED
     *  column off `xp`, so writing xp IS setting the level — not a bypass of the gate. */
    async function setXp(xp: number): Promise<number> {
      await sql(`update kinetype.profiles set xp = ${xp} where id = '${uid}'`);
      const rows = (await sql(`select level from kinetype.profiles where id = '${uid}'`)) as unknown as Array<{ level: number }>;
      return Number(rows[0].level);
    }

    async function setClears(ids: string[]): Promise<void> {
      await sql(`delete from kinetype.boss_clears where user_id = '${uid}'`);
      if (ids.length) {
        await sql(
          `insert into kinetype.boss_clears (user_id, boss_id) values ` +
            ids.map((id) => `('${uid}', '${id}')`).join(", "),
        );
      }
    }

    // ==================================================== 1. the pasted-URL payload is refused
    console.log("1. a locked boss cannot be entered — the exact payload /play?boss=oblivion sends");
    const before = await profile(uid);

    const oblivion = await asPlayerRaw(uid, matchCall({ bossId: "oblivion", botWpm: 120 }));
    check("level 1 vs the final boss: refused", !oblivion.ok, oblivion.ok ? "accepted!" : "");
    check(
      "the refusal names the reason",
      /not unlocked yet/i.test(oblivion.text),
      oblivion.text.slice(0, 300),
    );

    const bandit = await asPlayerRaw(uid, matchCall({ bossId: "bandit", botWpm: 30 }));
    check("level 1 vs boss 2: refused", !bandit.ok && /not unlocked yet/i.test(bandit.text));

    const vexLocked = await asPlayerRaw(uid, matchCall({ bossId: "vex", botWpm: 40 }));
    check("level 1 vs boss 3: refused", !vexLocked.ok && /not unlocked yet/i.test(vexLocked.text));

    const unknown = await asPlayerRaw(uid, matchCall({ bossId: "not-a-boss", botWpm: 40 }));
    check("an unknown boss id: refused", !unknown.ok && /unknown boss/i.test(unknown.text), unknown.text.slice(0, 200));

    const nameless = await asPlayerRaw(uid, "perform kinetype.submit_match('boss', null, 40, true, 65, 98, 12, 2, 0, 1);");
    check("boss mode with no boss: refused", !nameless.ok && /needs a boss/i.test(nameless.text), nameless.text.slice(0, 200));

    // ---- the assertion that actually matters: a refusal pays NOTHING ---------------------------
    const after = await profile(uid);
    const drift = same(before, after);
    check("five refusals left the account byte-identical", drift === "", drift);

    const rows = (await sql(`select count(*)::int as n from kinetype.matches where user_id = '${uid}'`)) as unknown as Array<{ n: number }>;
    check("no match row was written by any refusal", Number(rows[0].n) === 0, `${rows[0].n} rows`);
    check("no boss clear was registered by any refusal", (await cleared(uid)).length === 0);

    // ==================================================== 2. the boss the account HAS earned
    console.log("\n2. the boss the account has earned, and only that one");
    await sleep(HONEST_GAP_MS);
    const tick = await asPlayerRaw(uid, matchCall({ bossId: "tick", botWpm: 20 }));
    check("level 1 vs boss 1 (the only unlocked fight): accepted", tick.ok, tick.text.slice(0, 300));

    const afterTick = await profile(uid);
    check("the accepted match was recorded", Number(afterTick.matches) === 1, `matches=${afterTick.matches}`);
    check("the accepted match paid", Number(afterTick.xp) > Number(before.xp), `xp ${before.xp}->${afterTick.xp}`);
    check("the accepted win registered the clear", (await cleared(uid)).join(",") === "tick", (await cleared(uid)).join(","));

    // ==================================================== 3. the LEVEL gate, isolated
    // Boss 1's own clear pays enough XP to reach level 2 on the campaign's own curve, so "beating
    // boss 1 opened boss 2" proves nothing about WHICH condition did it. Wipe the clears, set the
    // level, and hold one condition constant at a time.
    console.log("\n3. the level gate on its own opens nothing");
    await setClears([]);
    const lvl2 = await setXp(100);
    check("the fixture is level 2 with nothing beaten", lvl2 === 2, `level=${lvl2}`);

    const beforeSeq = await profile(uid);
    const banditByLevelOnly = await asPlayerRaw(uid, matchCall({ bossId: "bandit", botWpm: 30 }));
    check(
      "level 2 clears boss 2's level gate AND boss 2 is still refused — the sequence is required too",
      !banditByLevelOnly.ok && /not unlocked yet/i.test(banditByLevelOnly.text),
      banditByLevelOnly.ok ? "accepted!" : banditByLevelOnly.text.slice(0, 200),
    );
    const afterSeqRefusal = await profile(uid);
    const seqDrift = same(beforeSeq, afterSeqRefusal);
    check("that refusal moved nothing", seqDrift === "", seqDrift);
    check("and registered no clear", (await cleared(uid)).length === 0);

    // Same level, but now the previous boss is beaten — so it opens.
    await sleep(HONEST_GAP_MS);
    const tickAgain = await asPlayerRaw(uid, matchCall({ bossId: "tick", botWpm: 20 }));
    check("boss 1 beaten at level 2: accepted", tickAgain.ok, tickAgain.text.slice(0, 300));
    await sleep(HONEST_GAP_MS);
    const banditOpen = await asPlayerRaw(uid, matchCall({ bossId: "bandit", botWpm: 30 }));
    check("level 2 + boss 1 beaten: boss 2 accepted", banditOpen.ok, banditOpen.text.slice(0, 300));
    check("boss 2's clear was registered", (await cleared(uid)).join(",") === "bandit,tick", (await cleared(uid)).join(","));

    // ==================================================== 4. the SEQUENCE gate, isolated
    // Now hold the LEVEL far above every boss and hold the clears at one. The level gate can no
    // longer be the thing refusing, so anything refused here is refused by the sequence.
    console.log("\n4. a high level does not skip the ladder");
    await setClears(["tick"]);
    const lvl12 = await setXp(12100);
    check("the fixture is level 12 with only boss 1 beaten", lvl12 === 12, `level=${lvl12}`);

    const beforeLadder = await profile(uid);
    const oblivionByLevelOnly = await asPlayerRaw(uid, matchCall({ bossId: "oblivion", botWpm: 120 }));
    check(
      "level 12 vs the final boss with the ladder unbeaten: refused",
      !oblivionByLevelOnly.ok && /not unlocked yet/i.test(oblivionByLevelOnly.text),
      oblivionByLevelOnly.ok ? "accepted!" : "",
    );
    const vexByLevelOnly = await asPlayerRaw(uid, matchCall({ bossId: "vex", botWpm: 40 }));
    check(
      "level 12 vs boss 3 with boss 2 unbeaten: refused",
      !vexByLevelOnly.ok && /not unlocked yet/i.test(vexByLevelOnly.text),
      vexByLevelOnly.ok ? "accepted!" : "",
    );
    const afterLadder = await profile(uid);
    const ladderDrift = same(beforeLadder, afterLadder);
    check("neither refusal moved the account", ladderDrift === "", ladderDrift);
    check("neither refusal advanced the ladder", (await cleared(uid)).join(",") === "tick", (await cleared(uid)).join(","));

    // The next rung IS open at that level, because its ONE prerequisite is beaten.
    await sleep(HONEST_GAP_MS);
    const banditAt12 = await asPlayerRaw(uid, matchCall({ bossId: "bandit", botWpm: 30 }));
    check("level 12 + boss 1 beaten: boss 2 accepted", banditAt12.ok, banditAt12.text.slice(0, 300));
    const nimbus = await asPlayerRaw(uid, matchCall({ bossId: "nimbus", botWpm: 85 }));
    check("boss 7 still refused — the ladder is a sequence, not a menu", !nimbus.ok && /not unlocked yet/i.test(nimbus.text));

    // ==================================================== 5. free play is untouched
    console.log("\n5. free play is not gated by any of this");
    const beforeFree = await profile(uid);
    await sleep(HONEST_GAP_MS);
    const free = await asPlayerRaw(uid, matchCall({ bossId: null, botWpm: 40 }));
    const afterFree = await profile(uid);
    check(
      "an ordinary free match is still accepted",
      free.ok && Number(afterFree.matches) === Number(beforeFree.matches) + 1,
      free.ok ? `matches ${beforeFree.matches}->${afterFree.matches}` : free.text.slice(0, 200),
    );
    check("free play paid", Number(afterFree.xp) > Number(beforeFree.xp));

    const finalClears = await cleared(uid);
    check("the ladder advanced only where it was allowed to", finalClears.join(",") === "bandit,tick", finalClears.join(","));

    console.log(`\n${pass} passed, ${fail} failed`);
    if (failures.length) {
      console.log("\nfailures:");
      for (const f of failures) console.log(`  - ${f}`);
    }
  } finally {
    await deleteFixture(uid);
  }

  if (fail > 0) process.exit(1);
}

void main();
