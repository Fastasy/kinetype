// Verifies the LOCKED BOSS GATE in the browser — the half of the fix a URL cannot skip.
//
// The hole: `/play?boss=<id>` rendered the arena for any boss in the roster, whatever the account had
// earned, so pasting `/play?boss=oblivion` started the final fight from level 1. The server now
// refuses to bank such a match (scripts/probe-boss-gate.ts proves that), and THIS probe proves the
// browser never offers it in the first place — no arena for an unearned fight, and a reason on
// screen that distinguishes "you are not this level yet" from "someone ahead of it is unbeaten".
//
// It signs in through the REAL form with a throwaway account and moves that account's level and
// clears directly, then re-loads the route and reads the DOM the way a player would. Nothing stubbed.
//
// Usage: node scripts/probe-boss-gate-ui.mjs [base-url]
//   (default http://localhost:3100 — run `npx next start -p 3100` first)

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const SITE = creds.project_url;
const SVC = creds.service_role_key;
const REF = creds.project_ref;
const MGMT = readFileSync(join(homedir(), "supabase-access-token"), "utf8").trim();
const BASE = (process.argv[2] || "http://localhost:3100").replace(/\/$/, "");

const EMAIL = "boss-gate-ui-probe@users.kinetype.app";
const PASSWORD = "boss-gate-ui-probe-fixture";

let pass = 0;
let fail = 0;
const failures = [];
function check(label, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
  }
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`management API HTTP ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createFixture() {
  const listing = await fetch(`${SITE}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  }).then((r) => r.json());
  for (const u of listing.users ?? []) {
    if (u.email === EMAIL) {
      await fetch(`${SITE}/auth/v1/admin/users/${u.id}`, {
        method: "DELETE",
        headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
      });
    }
  }
  const res = await fetch(`${SITE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`fixture create failed: ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

async function asPlayer(uid, body) {
  return sql(`do $probe$
begin
  perform set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', '${uid}', true);
  ${body}
end $probe$;`);
}

/** The account state the gate reads: level, and the bosses beaten. */
async function setState(uid, xp, clearIds) {
  await sql(`update kinetype.profiles set xp = ${xp} where id = '${uid}'`);
  await sql(`delete from kinetype.boss_clears where user_id = '${uid}'`);
  if (clearIds.length) {
    await sql(
      `insert into kinetype.boss_clears (user_id, boss_id) values ` +
        clearIds.map((id) => `('${uid}', '${id}')`).join(", "),
    );
  }
  const rows = await sql(`select level from kinetype.profiles where id = '${uid}'`);
  return Number(rows[0].level);
}

/** Read the gate for one route, after letting the component finish deciding. */
async function gate(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(
      () =>
        !!document.querySelector('[data-testid="boss-locked"]') ||
        !!document.querySelector('[data-testid="fight-section"]') ||
        !!document.querySelector('[data-testid="boss-gate"]'),
      { timeout: 25000 },
    )
    .catch(() => {});
  await sleep(300);
  return page.evaluate(() => {
    const locked = document.querySelector('[data-testid="boss-locked"]');
    const fight = document.querySelector('[data-testid="fight-section"]');
    const signin = document.querySelector('[data-testid="boss-gate"]');
    const checking = document.querySelector('[data-testid="boss-checking"]');
    return {
      locked: !!locked,
      reason: locked ? locked.getAttribute("data-reason") : null,
      boss: locked ? locked.getAttribute("data-boss") : null,
      text: locked ? locked.innerText.replace(/\s+/g, " ").trim() : "",
      fight: !!fight,
      signin: !!signin,
      checking: !!checking,
    };
  });
}

async function main() {
  const uid = await createFixture();
  console.log(`fixture account: ${uid} (level 1, nothing cleared)\n`);

  let browser;
  try {
    browser = await chromium.launch();

    // ================================================= 1. a guest with a pasted URL
    console.log("1. signed out — a pasted boss URL asks for an account, it does not open an arena");
    const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const guest = await guestCtx.newPage();
    const guestErrors = [];
    guest.on("pageerror", (e) => guestErrors.push(String(e)));
    guest.on("console", (m) => {
      if (m.type() === "error" || /hydrat/i.test(m.text())) guestErrors.push(m.text());
    });

    const guestTick = await gate(guest, "/play?boss=tick");
    check("a guest on /play?boss=tick gets the sign-in wall", guestTick.signin && !guestTick.fight,
      JSON.stringify(guestTick));

    const guestOblivion = await gate(guest, "/play?boss=oblivion");
    check("a guest on /play?boss=oblivion also gets the sign-in wall, never the final fight",
      guestOblivion.signin && !guestOblivion.fight, JSON.stringify(guestOblivion));
    check("no page errors and no hydration warning for a guest", guestErrors.length === 0, guestErrors.slice(0, 3).join(" // "));
    await guestCtx.close();

    // ================================================= 2. a real, fresh account
    console.log("\n2. signed in — the gate reads the account, not the URL");
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(m.text());
    });

    await page.goto(`${BASE}/signin?next=%2Fplay`, { waitUntil: "domcontentloaded" });
    await page.click('[data-testid="auth-tab-signin"]');
    await page.fill('[data-testid="auth-email"]', EMAIL);
    await page.fill('[data-testid="auth-password"]', PASSWORD);
    await page.click('[data-testid="auth-submit"]');
    await page.waitForURL((u) => !u.pathname.endsWith("/signin"), { timeout: 25000 });
    check("signed in through the real form", true, page.url());

    // The account exists server-side now; make its state explicit rather than assumed.
    await asPlayer(uid, "perform kinetype.ensure_profile();");
    const level0 = await setState(uid, 0, []);
    check("the account is level 1 with nothing beaten", level0 === 1, `level=${level0}`);

    const oblivionLocked = await gate(page, "/play?boss=oblivion");
    check("level 1 pasting the final boss: LOCKED, no arena", oblivionLocked.locked && !oblivionLocked.fight,
      JSON.stringify(oblivionLocked));
    check("the lock names the LEVEL as the reason", oblivionLocked.reason === "level", `reason=${oblivionLocked.reason}`);
    check("the gate shows the level it needs", /level 12/i.test(oblivionLocked.text), oblivionLocked.text);
    check("the gate offers a way forward, not a dead end", /See the campaign/i.test(oblivionLocked.text));
    await page.screenshot({ path: "verification/boss-gate-locked-level.png" });

    const banditLocked = await gate(page, "/play?boss=bandit");
    check("level 1 pasting boss 2: LOCKED", banditLocked.locked && !banditLocked.fight, JSON.stringify(banditLocked));

    const tickOpen = await gate(page, "/play?boss=tick");
    check("the one fight the account HAS earned opens", tickOpen.fight && !tickOpen.locked, JSON.stringify(tickOpen));

    // ================================================= 3. the sequence reason
    console.log("\n3. a high level does not skip the ladder");
    const level12 = await setState(uid, 12100, ["tick"]);
    check("the account is level 12 with only boss 1 beaten", level12 === 12, `level=${level12}`);

    const oblivionSeq = await gate(page, "/play?boss=oblivion");
    check("level 12 with the ladder unbeaten: still LOCKED", oblivionSeq.locked && !oblivionSeq.fight,
      JSON.stringify(oblivionSeq));
    check("and this time the lock names the SEQUENCE, not the level", oblivionSeq.reason === "sequence",
      `reason=${oblivionSeq.reason}`);
    check("the gate names the boss that stands in the way", /Vortex/i.test(oblivionSeq.text), oblivionSeq.text);

    const vexSeq = await gate(page, "/play?boss=vex");
    check("level 12 pasting boss 3: LOCKED on the sequence", vexSeq.locked && vexSeq.reason === "sequence",
      JSON.stringify(vexSeq));

    // ================================================= 4. the earned fight opens
    console.log("\n4. beating the ladder opens the fight it earned");
    await setState(uid, 12100, ["tick", "bandit", "vex", "havoc", "quartz", "cannon", "nimbus", "vortex"]);
    const oblivionOpen = await gate(page, "/play?boss=oblivion");
    check("the whole ladder beaten at level 12: the final fight OPENS", oblivionOpen.fight && !oblivionOpen.locked,
      JSON.stringify(oblivionOpen));
    await page.screenshot({ path: "verification/boss-gate-unlocked.png" });

    // ================================================= 5. free play untouched
    console.log("\n5. free play is unaffected");
    const free = await gate(page, "/play");
    check("plain /play still opens the arena", free.fight && !free.locked && !free.signin, JSON.stringify(free));

    const campaign = await page.goto(`${BASE}/bosses`, { waitUntil: "domcontentloaded" });
    // The ladder draws as soon as we know someone is signed in, which is BEFORE the profile lands —
    // read it in that window and every gated boss still reads as locked at the default level 1. Wait
    // for the profile's own numbers to arrive (the standing panel prints the level) before asserting.
    await page.waitForFunction(() => /Level 12/.test(document.body.innerText), { timeout: 25000 }).catch(() => {});
    await page.waitForSelector('[data-boss="oblivion"]', { timeout: 20000 }).catch(() => {});
    const states = await page
      .locator("li[data-boss]")
      .evaluateAll((els) => els.map((e) => `${e.getAttribute("data-boss")}:${e.getAttribute("data-state")}`));
    check("the campaign page agrees the ladder is done", states.length === 9 && !states.some((s) => /locked/.test(s)),
      states.join(" "));
    check("the campaign page loaded cleanly", (campaign?.status() ?? 0) === 200, `HTTP ${campaign?.status()}`);

    check("no page errors and no hydration warning anywhere in the run", errors.length === 0, errors.slice(0, 4).join(" // "));

    console.log(`\n${pass} passed, ${fail} failed`);
    if (failures.length) {
      console.log("\nfailures:");
      for (const f of failures) console.log(`  - ${f}`);
    }
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    const res = await fetch(`${SITE}/auth/v1/admin/users/${uid}`, {
      method: "DELETE",
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    });
    console.log(`\nfixture account removed: HTTP ${res.status}`);
  }

  if (fail > 0) process.exit(1);
}

void main();
