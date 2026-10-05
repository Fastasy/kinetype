// Verifies the rebalanced economy as a PLAYER sees it: the prices in the shop, and the day streak
// on a profile.
//
// Expected prices are read from the SERVER catalogue, not hardcoded — the whole point of the drift
// check is that the two agree, and a probe with its own copy of the numbers is a third source of
// truth that will disagree eventually.
//
// Usage: node scripts/probe-economy-ui.mjs [baseUrl]

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const OUT = "verification";
const HANDLE = "kt-test";
const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL_ = creds.project_url;
const ANON = creds.anon_key;

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

async function main() {
  const catalog = await fetch(`${URL_}/rest/v1/rpc/cosmetic_catalog`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
      "Content-Profile": "kinetype",
      "Accept-Profile": "kinetype",
    },
    body: JSON.stringify({}),
  }).then((r) => r.json());

  const paid = catalog.filter((c) => c.price > 0);
  const total = paid.reduce((n, c) => n + c.price, 0);
  console.log(`catalogue: ${paid.length} paid items, ${total.toLocaleString("en-US")} coins total`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // ============================================================ 1. the shop shows the real prices
  await page.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="theme-swatch"]', { timeout: 30000 });
  const shopText = (await page.textContent("main")) ?? "";

  for (const item of paid) {
    const shown = `${item.price.toLocaleString("en-US")} coins`;
    check(`the shop prices ${item.kind} "${item.id}" at ${shown}`, shopText.includes(shown));
  }

  // The old ladder must be gone — this is the actual complaint being fixed.
  for (const old of ["120 coins", "320 coins", "900 coins", "200 coins", "650 coins"]) {
    check(`the old price "${old}" is gone`, !shopText.includes(old));
  }

  // Rarity is a ladder now, not a rounding error.
  const legendary = paid.filter((c) => c.price === 15000);
  check("the legendary tier is 15,000 coins", legendary.length === 2, `${legendary.length} legendary items`);
  check(
    "a legendary costs 10x a common, so rarity means something",
    Math.max(...paid.map((c) => c.price)) === 15000 && Math.min(...paid.map((c) => c.price)) === 1500,
    `range ${Math.min(...paid.map((c) => c.price))}..${Math.max(...paid.map((c) => c.price))}`,
  );

  // The world's pace claim, checked against the measured earning rate (177 coins/match).
  const matchesForAll = Math.round(total / 177);
  check(
    "the catalogue is now a long-tail goal, not a half-hour",
    matchesForAll > 200,
    `~${matchesForAll} matches to own everything (was ~23)`,
  );

  await page.screenshot({ path: `${OUT}/shop-economy.png`, fullPage: true });

  // ================================================= 2. the streak shows on a profile
  await page.goto(`${BASE}/u/${HANDLE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="activity-heatmap"]', { timeout: 30000 });
  const profileText = (await page.textContent("main")) ?? "";
  check("a profile shows the DAY streak", /Day streak/.test(profileText), "");
  check("...and still names the win streak so the two are not confused", /Best win streak/.test(profileText), "");

  // The public RPC has to carry it, or the stat renders blank
  const pub = await fetch(`${URL_}/rest/v1/rpc/public_profile`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json", "Content-Profile": "kinetype", "Accept-Profile": "kinetype" },
    body: JSON.stringify({ p_handle: HANDLE }),
  }).then((r) => r.json());
  check("the public profile RPC publishes streak_days", pub[0] && "streak_days" in pub[0], Object.keys(pub[0] ?? {}).join(","));

  await page.screenshot({ path: `${OUT}/profile-streak.png`, fullPage: true });

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
