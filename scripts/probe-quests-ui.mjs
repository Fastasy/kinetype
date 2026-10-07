// Verifies the QUEST BOARD renders, signed out and signed in, with real progress.
//
// The server side is proved by scripts/probe-quests.ts. This one checks the half that lives in the
// browser: that /play actually draws today's five quests, that the tier grading survives to the
// screen, that a claimed quest says so, and that the board does not break hydration — which is a
// live risk here, because the rotation is derived from the date and the date is the one value the
// server and the browser can disagree about.
//
// It signs in through the REAL form with a throwaway account that has REAL matches behind it, so
// the progress bars are showing numbers the server actually derived. Nothing is stubbed.
//
// Usage: node scripts/probe-quests-ui.mjs [base-url]
//   (default http://localhost:3100 — run `npx next start -p 3100` first)

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL_ = creds.project_url;
const SVC = creds.service_role_key;
const REF = creds.project_ref;
const MGMT = readFileSync(join(homedir(), "supabase-access-token"), "utf8").trim();
const BASE = (process.argv[2] || "http://localhost:3100").replace(/\/$/, "");

const EMAIL = "quest-ui-probe@users.kinetype.app";
const PASSWORD = "quest-ui-probe-fixture";

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
  const listing = await fetch(`${URL_}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  }).then((r) => r.json());
  for (const u of listing.users ?? []) {
    if (u.email === EMAIL) {
      await fetch(`${URL_}/auth/v1/admin/users/${u.id}`, {
        method: "DELETE",
        headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
      });
    }
  }
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
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

async function main() {
  const uid = await createFixture();
  console.log(`fixture account: ${uid}\n`);

  let browser;
  try {
    // ---- give the account real progress, through the real RPC path --------------------------
    for (let i = 1; i <= 4; i++) {
      if (i > 1) await sleep(6000);
      await asPlayer(
        uid,
        `perform kinetype.submit_match('free', null, 40, true, 65, ${i === 2 ? 100 : 98}, 12, 2, 0, ${i});`,
      );
    }

    const today = (await sql(`select (now() at time zone 'utc')::date::text as d`))[0].d;
    const plan = await sql(
      `select q.id, q.scope, q.tier, q.title, q.target, q.reward_xp, q.reward_coins
       from unnest(kinetype.quest_ids_for(date '${today}')) with ordinality as u(id, ord)
       join kinetype.quest_defs q on q.id = u.id order by u.ord`,
    );
    // The SERVER's own progress numbers, read the same way the page reads them, so the assertion
    // below compares the board against the database rather than against the probe's guess.
    const progressRows = await sql(`create temporary table ui_probe as
  select * from kinetype.my_quests() where false;
do $probe$
begin
  perform set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', '${uid}', true);
  insert into ui_probe select * from kinetype.my_quests();
end $probe$;
select quest_id, progress, target, completed, claimed from ui_probe order by quest_id;`);

    browser = await chromium.launch();

    // ================================================= 1. signed out
    console.log("1. signed out — the board renders and promises nothing it cannot pay");
    const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const guest = await guestCtx.newPage();
    const guestErrors = [];
    guest.on("pageerror", (e) => guestErrors.push(String(e)));
    guest.on("console", (m) => {
      if (m.type() === "error" || /hydrat/i.test(m.text())) guestErrors.push(m.text());
    });

    await guest.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
    await guest.waitForSelector('[data-testid="quests"][data-state="ready"]', { timeout: 20000 });

    const guestCards = await guest.locator('[data-testid="quest-card"]').count();
    check("five quest cards render", guestCards === 5, `${guestCards} cards`);

    const guestIds = await guest.locator('[data-testid="quest-card"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-quest-id")),
    );
    check(
      "the cards are today's plan, in the server's order",
      guestIds.join("|") === plan.map((p) => p.id).join("|"),
      `board=[${guestIds.join(",")}] server=[${plan.map((p) => p.id).join(",")}]`,
    );

    const tiers = await guest.locator('[data-testid="quest-card"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-tier")),
    );
    check(
      "graded easy, medium, hard, then the two weeklies",
      tiers.join(",") === "easy,medium,hard,weekly,weekly",
      tiers.join(","),
    );

    const titles = await guest.locator('[data-testid="quest-card"] h3').allTextContents();
    check(
      "the titles on screen are the server's titles",
      titles.every((t, i) => t.trim() === plan[i].title),
      `board=${titles.join(" | ")}`,
    );

    const guestProgress = await guest.locator('[data-testid="quest-progress"]').count();
    check("a guest is shown no progress bars as numbers", guestProgress === 0, `${guestProgress} found`);
    const cta = await guest.locator('a:has-text("Sign in to bank them")').count();
    check("a guest is offered the sign-in, not blocked by it", cta === 1, `${cta} CTAs`);

    const resetText = await guest.locator('[data-testid="quests"]').innerText();
    check("the daily reset countdown is on the board", /resets in \d+[dhm]/.test(resetText));
    check("no page errors and no hydration warning", guestErrors.length === 0, guestErrors.slice(0, 3).join(" // "));

    await guest.screenshot({ path: "verification/quests-board-signed-out.png", fullPage: false });
    await guestCtx.close();

    // ================================================= 2. signed in
    console.log("\n2. signed in — real progress, from real matches");
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
    // The form NAVIGATES on success (to `?next=`, or /bosses by default) rather than sitting on the
    // page, so the wait is on leaving /signin, not on an element.
    await page.waitForURL((u) => !u.pathname.endsWith("/signin"), { timeout: 25000 });
    check("signed in through the real form", true, page.url());

    // Watch the actual RPC, so a failed fetch is reported as a failed fetch rather than as a board
    // that mysteriously shows nothing.
    const questCalls = [];
    page.on("response", (r) => {
      if (r.url().includes("/rpc/my_quests")) questCalls.push(`${r.status()}`);
    });

    await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="quests"][data-state="ready"]', { timeout: 20000 });
    // Wait for the PROGRESS to arrive, not merely for the board to be up: `quest-progress` renders
    // as soon as we know someone is signed in, which is before the fetch resolves, and reading the
    // cards in that window reports blank progress that is really just "not yet".
    await page
      .waitForFunction(
        () => {
          const cards = [...document.querySelectorAll('[data-testid="quest-card"]')];
          return (
            cards.length === 5 && cards.every((c) => c.getAttribute("data-progress") !== "")
          );
        },
        { timeout: 25000 },
      )
      .catch(() => {});
    check("my_quests answered", questCalls.some((s) => s === "200"), `responses: ${questCalls.join(",") || "none"}`);

    const cards = await page.locator('[data-testid="quest-card"]').count();
    check("five quest cards render signed in too", cards === 5, `${cards}`);

    const board = await page.locator('[data-testid="quest-card"]').evaluateAll((els) =>
      els.map((e) => ({
        id: e.getAttribute("data-quest-id"),
        progress: e.getAttribute("data-progress"),
        target: e.getAttribute("data-target"),
        complete: e.getAttribute("data-complete"),
        claimed: e.getAttribute("data-claimed"),
        text: e.innerText,
      })),
    );

    const byServer = new Map(progressRows.map((r) => [r.quest_id, r]));
    let progressMismatch = 0;
    for (const card of board) {
      const server = byServer.get(card.id);
      if (!server) {
        progressMismatch += 1;
        continue;
      }
      if (Number(card.progress) !== Number(server.progress) || Number(card.target) !== Number(server.target)) {
        progressMismatch += 1;
        failures.push(`${card.id}: board ${card.progress}/${card.target} vs server ${server.progress}/${server.target}`);
      }
    }
    check("every card shows the server's own progress", progressMismatch === 0, `${progressMismatch} mismatched`);

    const claimedOnBoard = board.filter((c) => c.claimed === "1").map((c) => c.id);
    const claimedOnServer = progressRows.filter((r) => r.claimed).map((r) => r.quest_id);
    check(
      "the claimed quests on the board are the claimed quests in the database",
      claimedOnBoard.slice().sort().join(",") === claimedOnServer.slice().sort().join(","),
      `board=[${claimedOnBoard.join(",")}] server=[${claimedOnServer.join(",")}]`,
    );
    check(
      "a claimed card says CLAIMED, on screen",
      board.filter((c) => c.claimed === "1").every((c) => /CLAIMED/.test(c.text)),
      board.filter((c) => c.claimed === "1").map((c) => c.text.replace(/\n/g, " ")).join(" // "),
    );
    check(
      "a claimed card shows its reward on screen",
      board.filter((c) => c.claimed === "1").every((c) => /\+\d+ XP/.test(c.text)),
    );
    check("at least three quests are claimed from the four scripted wins", claimedOnBoard.length >= 3, `${claimedOnBoard.length}`);

    const signInCta = await page.locator('a:has-text("Sign in to bank them")').count();
    check("the sign-in prompt is gone for a signed-in player", signInCta === 0, `${signInCta} left`);

    // The bar must be clamped even though the raw metric can overshoot its target.
    const barWidths = await page.locator('[data-testid="quest-bar"]').evaluateAll((els) =>
      els.map((e) => e.style.width),
    );
    check(
      "no progress bar is wider than 100%",
      barWidths.every((w) => parseFloat(w) <= 100),
      barWidths.join(","),
    );

    // …and the NUMBER must be clamped with it, or "5/1" sits next to a full bar and reads as a bug.
    // The raw value stays available on data-progress for exactly this kind of check.
    const shownVsTarget = board.map((c) => {
      const m = c.text.match(/(\d+)\/(\d+)/);
      return { id: c.id, shown: m ? Number(m[1]) : null, target: m ? Number(m[2]) : null, raw: Number(c.progress) };
    });
    check(
      "no card displays a progress count above its target",
      shownVsTarget.every((c) => c.shown === null || c.shown <= c.target),
      shownVsTarget.map((c) => `${c.id}:${c.shown}/${c.target}`).join(","),
    );
    check(
      "a card that overshot its target is displayed clamped to it, while data-progress keeps the raw count",
      shownVsTarget.every((c) => c.raw <= c.target || c.shown === c.target),
      shownVsTarget.map((c) => `${c.id}: shown ${c.shown}, raw ${c.raw}, target ${c.target}`).join(" | "),
    );

    check("no page errors and no hydration warning", errors.length === 0, errors.slice(0, 3).join(" // "));

    await page.screenshot({ path: "verification/quests-board-signed-in.png", fullPage: false });
    // A tall shot as well, so the whole board is on one image for review.
    await page.evaluate(() => document.querySelector("#quests")?.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "verification/quests-board-full.png", fullPage: true });

    await ctx.close();
  } finally {
    if (browser) await browser.close();
    await fetch(`${URL_}/auth/v1/admin/users/${uid}`, {
      method: "DELETE",
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    });
    console.log("\nfixture account removed");
  }

  console.log(`\n${"-".repeat(58)}`);
  console.log(`passed ${pass}   failed ${fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`${"-".repeat(58)}`);
  if (fail > 0) process.exit(1);
  console.log("QUEST BOARD VERIFIED IN A BROWSER: drawn, graded, and reading the server's numbers");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
