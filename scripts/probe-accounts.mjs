// Runtime verification for accounts / boss campaign / leaderboards.
//
// Signed-out: gates must appear instead of silent failures.
// Signed-in (a real Supabase session injected into localStorage, so the app fetches
// real rows): the campaign must show the correct lock states and the board must mark
// the player. Run: node scripts/probe-accounts.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";

const BASE = process.env.KT_BASE || "http://localhost:3000";
const OUT = "verification";
mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

let pass = 0;
let fail = 0;
const check = (name, ok, extra = "") => {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

// ---- mint a real session for the test user ------------------------------------
const tr = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "kt-test@example.com", password: "Test-Pass-9f3a2b!" }),
});
const session = await tr.json();
if (!session.access_token) throw new Error("could not mint a session: " + JSON.stringify(session).slice(0, 200));
const sessionJson = JSON.stringify(session);

// The fixture's OWN name and rank, read from the SERVER. Asserting a literal ("kt-test", "rank 1")
// goes stale the moment the fixture is renamed — and other probes in this suite DO rename it — or
// another player out-scores it. Same rule the header assertion further down already follows.
const profileRows = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=handle,display_name&id=eq.${session.user.id}`,
  {
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Accept-Profile": "kinetype",
    },
  },
).then((r) => r.json());
const myHandle = profileRows[0]?.handle;
const myName = profileRows[0]?.display_name ?? myHandle ?? "Player";

// The board renders display_name as text (the handle only appears in the link's href, which
// textContent does not include), so the name is what the page assertions must look for.
const board = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/leaderboard`, {
  method: "POST",
  headers: {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Accept-Profile": "kinetype",
    "Content-Profile": "kinetype",
  },
  body: JSON.stringify({ p_window: "overall", p_limit: 200 }),
}).then((r) => r.json());
const myRank = board.find?.((r) => r.handle === myHandle)?.rank;

const browser = await chromium.launch();

// ============================================================ signed OUT
console.log("\nsigned out");
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/bosses`, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  check("bosses shows a sign-in wall", /Sign in to fight the bosses/i.test(body));
  await page.screenshot({ path: `${OUT}/10-bosses-signedout.png`, fullPage: false });

  await page.goto(`${BASE}/play?boss=tick`, { waitUntil: "networkidle" });
  const gate = await page.locator('[data-testid="boss-gate"]').count();
  const gateText = await page.textContent("body");
  check("boss fight is gated for guests", gate === 1 && /Tick/.test(gateText));
  await page.screenshot({ path: `${OUT}/11-boss-gate.png` });

  await page.goto(`${BASE}/leaderboard`, { waitUntil: "networkidle" });
  await page.waitForSelector("table", { timeout: 15000 }).catch(() => {});
  const table = await page.locator("table").count();
  const lbText = await page.textContent("body");
  check("leaderboard renders a table signed-out", table === 1);
  check("leaderboard shows the test player", lbText.includes(myName), `looking for "${myName}"`);
  check("leaderboard has three windows", /Today/.test(lbText) && /This week/.test(lbText) && /All time/.test(lbText));
  await page.screenshot({ path: `${OUT}/12-leaderboard.png`, fullPage: false });

  await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
  const navText = await page.textContent("header");
  check("nav has Campaign + Leaderboard", /Campaign/.test(navText) && /Leaderboard/.test(navText));
  check("nav offers Google sign-in", /Sign in/i.test(navText));
  await page.close();
}

// ============================================================ signed IN
console.log("\nsigned in (real session, real rows)");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript((s) => {
    window.localStorage.setItem("kinetype-auth", s);
  }, sessionJson);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/bosses`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-boss]", { timeout: 20000 });
  const count = await page.locator("[data-boss]").count();
  check("nine bosses listed", count === 9, `(got ${count})`);

  const state = async (id) => page.locator(`[data-boss="${id}"]`).getAttribute("data-state");
  // kt-test has 512 XP -> level 3, and has cleared only `tick`.
  check("tick reads as beaten", (await state("tick")) === "cleared", `(got ${await state("tick")})`);
  check("bandit is open (level 2 met, tick cleared)", (await state("bandit")) === "open", `(got ${await state("bandit")})`);
  check("vex is locked by SEQUENCE (level 3 met, bandit not cleared)", (await state("vex")) === "locked-sequence", `(got ${await state("vex")})`);
  check("havoc is locked by LEVEL", (await state("havoc")) === "locked-level", `(got ${await state("havoc")})`);

  const header = await page.textContent("header");
  // Read the expected level/XP from the server rather than hardcoding a fixture value,
  // so this assertion cannot go stale as the probe suite adds matches.
  const prof = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=xp,level&id=eq.${session.user.id}`,
    { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`, "Accept-Profile": "kinetype" } },
  ).then((r) => r.json());
  const expectLevel = prof[0]?.level, expectXp = prof[0]?.xp;
  check(
    "header shows level + XP",
    header.includes(`Lv ${expectLevel}`) && header.includes(String(expectXp)),
    `expected Lv ${expectLevel} / ${expectXp}; header="${header.replace(/\s+/g, " ").slice(0, 80)}"`,
  );
  check("campaign shows progress", /1\/9 bosses beaten/.test(await page.textContent("body")));
  await page.screenshot({ path: `${OUT}/13-bosses-signedin.png` });

  await page.goto(`${BASE}/leaderboard`, { waitUntil: "networkidle" });
  await page.waitForSelector("table", { timeout: 15000 }).catch(() => {});
  const lbText = await page.textContent("body");
  check("own row is marked", /you/.test(lbText) && lbText.includes(myName));
  check(
    "standing line present",
    typeof myRank === "number" && new RegExp(`rank ${myRank}`, "i").test(lbText),
    `expected "rank ${myRank}"`,
  );
  await page.screenshot({ path: `${OUT}/14-leaderboard-signedin.png` });

  // boss arena renders with the boss badge and the right bot speed
  await page.goto(`${BASE}/play?boss=bandit`, { waitUntil: "networkidle" });
  const badge = await page.locator('[data-testid="boss-badge"]').count();
  const badgeText = badge ? await page.textContent('[data-testid="boss-badge"]') : "";
  check("boss arena shows the boss badge", badge === 1 && /Bandit/.test(badgeText) && /30 WPM/.test(badgeText), `"${badgeText}"`);
  await page.screenshot({ path: `${OUT}/15-boss-arena.png` });

  await ctx.close();
}

await browser.close();
console.log(`\n${"-".repeat(52)}`);
console.log(`passed ${pass}   failed ${fail}`);
console.log("-".repeat(52));
if (fail > 0) process.exit(1);
