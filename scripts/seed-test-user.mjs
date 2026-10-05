// Seeds the `kt-test@example.com` fixture the account/banking probes rely on.
//
// Run this BEFORE scripts/probe-accounts.mjs. It creates the user and replays the
// exact two boss clears that put them at 512 XP / level 3 with `tick` beaten — the
// state probe-accounts.mjs asserts the campaign lock ladder against.
//
// Reads the service_role key from ~/.kinetype/creds.json (kept OUT of the repo on
// purpose — a service key must never be committed). Delete the fixture afterwards
// so it does not sit on a live leaderboard.
//
//   node scripts/seed-test-user.mjs          # create + seed
//   node scripts/seed-test-user.mjs --delete # remove the fixture
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL = creds.project_url, ANON = creds.anon_key, SVC = creds.service_role_key;
const EMAIL = "kt-test@example.com", PASSWORD = "Test-Pass-9f3a2b!";

async function rpc(name, body, token) {
  const r = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json",
      "Accept-Profile": "kinetype", "Content-Profile": "kinetype",
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

if (process.argv.includes("--delete")) {
  const list = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  }).then((r) => r.json());
  const hits = (list.users || []).filter((u) => u.email === EMAIL);
  for (const u of hits) {
    await fetch(`${URL}/auth/v1/admin/users/${u.id}`, {
      method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    });
    console.log("deleted fixture", u.id.slice(0, 8));
  }
  if (!hits.length) console.log("no fixture to delete");
  process.exit(0);
}

// 1. create (or find) the user
let created = await fetch(`${URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
if (created.status >= 400 && !/already/i.test(JSON.stringify(created.body))) {
  throw new Error("could not create fixture: " + JSON.stringify(created.body).slice(0, 200));
}
console.log("fixture user ready:", EMAIL);

// 2. sign in for a real token
const session = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
const token = session.access_token;
if (!token) throw new Error("could not sign in: " + JSON.stringify(session).slice(0, 200));

// 3. ensure profile, then replay the two boss clears that reach 512 XP (level 3)
await rpc("ensure_profile", {}, token);
const base = { p_mode: "boss", p_boss_id: "tick", p_bot_wpm: 20, p_won: true, p_wpm: 42, p_accuracy: 96, p_best_combo: 7, p_rounds_won: 2, p_rounds_lost: 0 };
await rpc("submit_match", { ...base, p_streak: 1 }, token);          // 322 XP + first clear
const again = await rpc("submit_match", { ...base, p_streak: 2 }, token); // +190 = 512 XP
console.log("after seed -> xp:", again.body?.xp, "level:", again.body?.level, "bosses_cleared:", again.body?.bosses_cleared);
