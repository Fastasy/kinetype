// Verifies migration 0006 (anti-cheat) against the LIVE project.
//
// The bug this exists for, stated as a test: an ordinary signed-in player must NOT be able to write
// its own score. Before 0006 one PATCH took a zero-match account to rank 1 with 999999 XP.
//
// Usage:  node scripts/probe-anticheat.mjs
// Self-contained: creates its own throwaway account and deletes it again.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL_ = creds.project_url;
const ANON = creds.anon_key;
const SVC = creds.service_role_key;
// Its own account: this probe deliberately gets itself flagged, so it must never share a fixture.
const EMAIL = "kt-anticheat@example.com";
const PASSWORD = "kt-anticheat-test-9f3a";

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function adminUsers(path, init = {}) {
  return fetch(`${URL_}/auth/v1/admin/users${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/** Drop any leftovers from an interrupted run, then create the account fresh. */
async function resetFixture() {
  const list = await adminUsers("?per_page=200").then((r) => r.json());
  for (const u of (list.users ?? []).filter((x) => x.email === EMAIL)) {
    await adminUsers(`/${u.id}`, { method: "DELETE" });
  }
  const created = await adminUsers("", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  if (created.status >= 300) {
    const body = await created.text();
    if (!/already/i.test(body)) throw new Error(`could not create the fixture: HTTP ${created.status} ${body}`);
  }
}

/** An ordinary player's headers: the anon key plus that player's own token. */
function playerHdrs(token) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept-Profile": "kinetype",
    "Content-Profile": "kinetype",
    Prefer: "return=representation",
  };
}

function rpc(fn, body, token) {
  return fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: playerHdrs(token),
    body: JSON.stringify(body),
  });
}

/** A match payload with everything plausible unless overridden. */
function match(over = {}) {
  return {
    p_mode: "free",
    p_boss_id: null,
    p_bot_wpm: 40,
    p_won: true,
    p_wpm: 60,
    p_accuracy: 95,
    p_best_combo: 8,
    p_rounds_won: 2,
    p_rounds_lost: 0,
    p_streak: 2,
    ...over,
  };
}

async function main() {
  await resetFixture();

  const session = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const token = session.access_token;
  const uid = session.user.id;
  if (!token) {
    console.error("could not sign in the fixture");
    process.exit(1);
  }

  // ===================================================== 1. the door is shut
  console.log("— the door —");
  // Create the row FIRST, so "the refused writes changed nothing" is a real assertion rather than
  // a comparison against a profile that does not exist yet.
  await rpc("ensure_profile", {}, token);

  const direct = [
    ["PATCH profiles (own xp)", "PATCH", `${URL_}/rest/v1/profiles?id=eq.${uid}`, { xp: 999999 }],
    ["INSERT profiles", "POST", `${URL_}/rest/v1/profiles`, { id: uid, xp: 999999 }],
    ["PATCH profiles (own coins)", "PATCH", `${URL_}/rest/v1/profiles?id=eq.${uid}`, { coins: 999999 }],
    ["INSERT matches", "POST", `${URL_}/rest/v1/matches`, { user_id: uid, mode: "free", won: true, wpm: 400, xp_awarded: 999999 }],
    ["INSERT boss_clears", "POST", `${URL_}/rest/v1/boss_clears`, { user_id: uid, boss_id: "oblivion" }],
  ];
  for (const [label, method, url, body] of direct) {
    const r = await fetch(url, { method, headers: playerHdrs(token), body: JSON.stringify(body) });
    check(`a player cannot ${label}`, r.status === 401 || r.status === 403, `HTTP ${r.status}`);
  }
  // and anonymous, for good measure
  const anonPatch = await fetch(`${URL_}/rest/v1/profiles?id=eq.${uid}`, {
    method: "PATCH",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json", "Content-Profile": "kinetype" },
    body: JSON.stringify({ xp: 999999 }),
  });
  check("anonymous cannot PATCH a profile either", anonPatch.status === 401 || anonPatch.status === 403, `HTTP ${anonPatch.status}`);

  const stillZero = await fetch(`${URL_}/rest/v1/profiles?select=xp,coins&id=eq.${uid}`, { headers: playerHdrs(token) }).then((r) => r.json());
  check(
    "the refused writes changed nothing",
    stillZero.length === 1 && stillZero[0].xp === 0 && stillZero[0].coins === 0,
    JSON.stringify(stillZero),
  );

  // ===================================================== 2. honest play still works
  console.log("\n— honest play still works (the RPCs are the only door, and they are open) —");
  const honest = await rpc("ensure_profile", {}, token);
  check("ensure_profile still runs", honest.status === 200, `HTTP ${honest.status}`);

  const m1 = await rpc("submit_match", match(), token);
  const p1 = await m1.json();
  check("an honest match is still recorded and paid", m1.status === 200 && p1.xp > 0, `HTTP ${m1.status}, xp ${p1.xp}`);
  check("it is not flagged", p1.flags === 0, `flags ${p1.flags}`);

  // ===================================================== 3. impossible results are refused
  console.log("\n— impossible results are refused —");
  const impossible = [
    ["six rounds", match({ p_rounds_won: 4, p_rounds_lost: 3 })],
    ["won without winning a round", match({ p_won: true, p_rounds_won: 0, p_rounds_lost: 2 })],
    ["accuracy over 100", match({ p_accuracy: 140 })],
    ["negative wpm", match({ p_wpm: -20 })],
    ["typing speed beyond human", match({ p_wpm: 400 })],
    ["an unknown mode", match({ p_mode: "sandbox" })],
  ];
  for (const [label, body] of impossible) {
    const r = await rpc("submit_match", body, token);
    check(`refused: ${label}`, r.status === 400, `HTTP ${r.status} ${(await r.text()).slice(0, 90)}`);
  }

  // ===================================================== 4. implausible submissions do not pay
  console.log("\n— implausible submissions are recorded, flagged, and do not pay —");
  const before = await fetch(`${URL_}/rest/v1/profiles?select=xp,coins,flags,matches&id=eq.${uid}`, { headers: playerHdrs(token) }).then((r) => r.json());

  const cheat = await rpc("submit_match", match({ p_wpm: 250, p_accuracy: 100 }), token);
  const afterCheat = await cheat.json();
  check("an implausible match is still accepted (recorded, not hidden)", cheat.status === 200, `HTTP ${cheat.status}`);
  check("but it pays NO xp", afterCheat.xp === before[0].xp, `${before[0].xp} -> ${afterCheat.xp}`);
  check("and NO coins", afterCheat.coins === before[0].coins, `${before[0].coins} -> ${afterCheat.coins}`);
  check("and it counted a flag", afterCheat.flags === before[0].flags + 1, `flags ${afterCheat.flags}`);

  const flaggedRow = await fetch(
    `${URL_}/rest/v1/matches?select=flag_reason,xp_awarded&user_id=eq.${uid}&order=created_at.desc&limit=1`,
    { headers: playerHdrs(token) },
  ).then((r) => r.json());
  check("the reason is recorded on the match", typeof flaggedRow[0]?.flag_reason === "string" && flaggedRow[0].flag_reason.length > 0, `${flaggedRow[0]?.flag_reason}`);
  check("the flagged match paid 0 xp", flaggedRow[0]?.xp_awarded === 0, `${flaggedRow[0]?.xp_awarded}`);

  // a perfectly normal-looking match submitted instantly is a script, not a player
  const burst = await rpc("submit_match", match(), token);
  const afterBurst = await burst.json();
  check("a second match submitted instantly is flagged for the gap", afterBurst.flags === afterCheat.flags + 1, `flags ${afterBurst.flags}`);
  const gapRow = await fetch(
    `${URL_}/rest/v1/matches?select=flag_reason&user_id=eq.${uid}&order=created_at.desc&limit=1`,
    { headers: playerHdrs(token) },
  ).then((r) => r.json());
  check("...and the reason mentions the gap", /second/.test(gapRow[0]?.flag_reason ?? ""), `${gapRow[0]?.flag_reason}`);

  // a forged boss first-clear must not mint coins or unlock the ladder
  const bossBefore = await fetch(`${URL_}/rest/v1/profiles?select=coins,bosses_cleared,flags&id=eq.${uid}`, { headers: playerHdrs(token) }).then((r) => r.json());
  const fakeBoss = await rpc("submit_match", match({ p_mode: "boss", p_boss_id: "tick", p_bot_wpm: 30, p_wpm: 260 }), token);
  const afterBoss = await fakeBoss.json();
  check("a forged boss clear pays no coins", afterBoss.coins === bossBefore[0].coins, `${bossBefore[0].coins} -> ${afterBoss.coins}`);
  check("and does not unlock the boss", afterBoss.bosses_cleared === bossBefore[0].bosses_cleared, `cleared ${afterBoss.bosses_cleared}`);
  const clears = await fetch(`${URL_}/rest/v1/boss_clears?select=boss_id&user_id=eq.${uid}`, { headers: playerHdrs(token) }).then((r) => r.json());
  check("and writes no boss_clears row", !clears.some((c) => c.boss_id === "tick"), JSON.stringify(clears));

  // ===================================================== 5. three flags makes it unranked
  console.log("\n— 3 flags takes the account off the board (it can still play) —");
  const lbBefore = await fetch(`${URL_}/rest/v1/rpc/leaderboard`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json", "Content-Profile": "kinetype", "Accept-Profile": "kinetype" },
    body: JSON.stringify({ p_window: "overall", p_limit: 200 }),
  }).then((r) => r.json());
  const state = await fetch(`${URL_}/rest/v1/profiles?select=handle,xp,flags&id=eq.${uid}`, { headers: playerHdrs(token) }).then((r) => r.json());
  check("the account still has xp on it", state[0].xp > 0, `xp ${state[0].xp}`);
  check("...and 3+ flags", state[0].flags >= 3, `flags ${state[0].flags}`);
  check("it is NOT on the leaderboard", !lbBefore.some((r) => r.handle === state[0].handle), `board has ${lbBefore.length} rows`);
  const others = lbBefore.filter((r) => r.xp > 0 && r.handle !== state[0].handle);
  check("...while unflagged accounts with xp still are", others.length > 0, `${others.length} others ranked`);

  const report = await adminUsers("?per_page=200");
  check("the fixture is still a normal, playable account", report.status === 200);

  // ===================================================== tidy up
  await adminUsers(`/${uid}`, { method: "DELETE" });
  const gone = await fetch(`${URL_}/rest/v1/profiles?select=handle&id=eq.${uid}`, { headers: playerHdrs(token) }).then((r) => r.json());
  check("the throwaway account is deleted, leaving nothing on a live board", gone.length === 0, JSON.stringify(gone));

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
