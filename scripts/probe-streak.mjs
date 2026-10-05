// Verifies migration 0007: the daily streak, the first-win bonus, and the streak milestones.
//
// A streak is only interesting ACROSS days, which a probe cannot wait for — so this sets the
// profile's streak state directly (via the management API, because clients cannot write those
// columns any more) and then submits a real match to see what the server does with it.
//
// Usage: node scripts/probe-streak.mjs

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL_ = creds.project_url;
const ANON = creds.anon_key;
const SVC = creds.service_role_key;
const REF = creds.project_ref;
const MGMT = readFileSync(join(homedir(), "supabase-access-token"), "utf8").trim();

const EMAIL = "kt-streak@example.com";
const PASSWORD = "kt-streak-test-9f3a";

// What the server pays, derived from the exact payloads below (not from a different scenario):
//   win  = 40 base + 2 rounds*10 + 60wpm*0.6 (36) + 95% acc (29) + streak 2*8 (16) = 141
//   loss = 12 base + 0 rounds    + 60wpm*0.6 (36) + 95% acc (29) + streak 0      =  77
const WIN = 141;
const LOSS = 77;
const FIRST_WIN_BONUS = 100;
const MILE_3 = 250;
const MILE_7 = 600;

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

function sql(query) {
  return fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  }).then((r) => r.json());
}

/** Only the server may set streak state, so days are simulated here rather than waited out. */
async function setStreak(uid, { days, lastPlayedOn, awarded = 0, firstWinOn = null }) {
  await sql(`update kinetype.profiles set streak_days = ${days},
               last_played_on = ${lastPlayedOn === null ? "null" : `date '${lastPlayedOn}'`},
               streak_awarded = ${awarded},
               first_win_on = ${firstWinOn === null ? "null" : `date '${firstWinOn}'`}
             where id = '${uid}'`);
}

async function adminUsers(path, init = {}) {
  return fetch(`${URL_}/auth/v1/admin/users${path}`, {
    ...init,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

async function main() {
  // fresh account
  const list = await adminUsers("?per_page=200").then((r) => r.json());
  for (const u of (list.users ?? []).filter((x) => x.email === EMAIL)) {
    await adminUsers(`/${u.id}`, { method: "DELETE" });
  }
  const created = await adminUsers("", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  if (created.status >= 300 && !/already/i.test(await created.text())) throw new Error("fixture");

  const session = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const token = session.access_token;
  const uid = session.user.id;

  const H = {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept-Profile": "kinetype",
    "Content-Profile": "kinetype",
    Prefer: "return=representation",
  };
  const profile = () => fetch(`${URL_}/rest/v1/profiles?select=*&id=eq.${uid}`, { headers: H }).then((r) => r.json()).then((r) => r[0]);
  const play = async (over = {}) => {
    // Anything faster than 5s apart is (correctly) flagged as scripted and pays nothing, so a
    // probe that submits back to back would measure the anti-cheat instead of the streak.
    await new Promise((res) => setTimeout(res, 6000));
    const r = await fetch(`${URL_}/rest/v1/rpc/submit_match`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        p_mode: "free", p_boss_id: null, p_bot_wpm: 40, p_won: true, p_wpm: 60,
        p_accuracy: 95, p_best_combo: 8, p_rounds_won: 2, p_rounds_lost: 0, p_streak: 2, ...over,
      }),
    });
    return r.json();
  };

  await fetch(`${URL_}/rest/v1/rpc/ensure_profile`, { method: "POST", headers: H, body: "{}" });
  const start = await profile();
  check("a new account starts with no streak", start.streak_days === 0 && start.first_win_on === null, `streak ${start.streak_days}`);

  // ---- a LOSS must not consume the daily first-win bonus
  let before = await profile();
  let r = await play({ p_won: false, p_rounds_won: 0, p_rounds_lost: 2, p_streak: 0 });
  check("a loss pays the match and nothing else", r.coins - before.coins === LOSS, `+${r.coins - before.coins} (expected ${LOSS})`);
  check("...but it still counts as a day played", r.streak_days === 1, `streak ${r.streak_days}`);
  check("...and leaves the first-win bonus unclaimed", r.first_win_on === null, `first_win_on ${r.first_win_on}`);

  // ---- the first WIN of the day
  before = await profile();
  r = await play();
  check("the first win of the day pays a bonus", r.coins - before.coins === WIN + FIRST_WIN_BONUS, `+${r.coins - before.coins} (expected ${WIN + FIRST_WIN_BONUS})`);

  // ---- a second win the same day must not pay it again
  before = await profile();
  r = await play();
  check("a second win the same day does NOT", r.coins - before.coins === WIN, `+${r.coins - before.coins} (expected ${WIN})`);
  check("...and the streak does not double-count today", r.streak_days === 1, `streak ${r.streak_days}`);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // ---- a consecutive day advances the streak and pays the 3-day milestone
  await setStreak(uid, { days: 2, lastPlayedOn: yesterday, awarded: 0, firstWinOn: today });
  before = await profile();
  r = await play();
  check("playing the next day advances the streak", r.streak_days === 3, `streak ${r.streak_days}`);
  check("...and pays the 3-day milestone", r.coins - before.coins === WIN + MILE_3, `+${r.coins - before.coins} (expected ${WIN + MILE_3})`);
  check("...marking the milestone as paid", r.streak_awarded === 3, `awarded ${r.streak_awarded}`);

  // ---- the 7-day milestone
  await setStreak(uid, { days: 6, lastPlayedOn: yesterday, awarded: 3, firstWinOn: today });
  before = await profile();
  r = await play();
  check("a 7-day streak pays its own milestone", r.streak_days === 7 && r.coins - before.coins === WIN + MILE_7, `streak ${r.streak_days}, +${r.coins - before.coins}`);

  // ---- a missed day breaks the chain
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  await setStreak(uid, { days: 7, lastPlayedOn: threeDaysAgo, awarded: 7, firstWinOn: today });
  before = await profile();
  r = await play();
  check("a missed day resets the streak to 1", r.streak_days === 1, `streak ${r.streak_days}`);
  check("...and re-opens the milestones", r.streak_awarded === 0, `awarded ${r.streak_awarded}`);
  check("...and pays no milestone on the way back", r.coins - before.coins === WIN, `+${r.coins - before.coins} (expected ${WIN})`);

  // ---- a flagged submission is not a day played
  await setStreak(uid, { days: 1, lastPlayedOn: today, awarded: 0, firstWinOn: today });
  before = await profile();
  r = await play({ p_wpm: 250 });
  check("a flagged match pays nothing", r.coins - before.coins === 0, `+${r.coins - before.coins}`);
  check("...and does not advance the streak", r.streak_days === 1, `streak ${r.streak_days}`);
  check("...and is recorded as flagged", r.flags > 0, `flags ${r.flags}`);

  // ---- tidy up
  await adminUsers(`/${uid}`, { method: "DELETE" });
  const gone = await sql(`select count(*) as n from kinetype.profiles where id = '${uid}'`);
  check("the throwaway account is deleted", gone[0].n === 0, JSON.stringify(gone));

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
