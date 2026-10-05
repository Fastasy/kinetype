// Verifies the public profile page and the leaderboard -> profile link.
// Usage: node scripts/probe-profile.mjs http://localhost:3000
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const OUT = "verification";
mkdirSync(OUT, { recursive: true });

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

// ---------------------------------------------------------------- a real profile
await page.goto(`${BASE}/u/ruan-fx`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const body = await page.textContent("main");

check("profile shows the display name", /Ruan FX/.test(body), body.slice(0, 60).replace(/\s+/g, " "));
check("profile shows the @handle", /@ruan-fx/.test(body));
check("profile shows stats", /Best WPM/.test(body) && /Win rate/.test(body));
check("profile shows the activity section", /Activity/.test(body) && /matches on/.test(body));
check("profile shows the loadout", /Active skin/.test(body) && /Active theme/.test(body));
check("profile shows the skin collection", /Skins owned/.test(body));
check("profile is NOT littered with backend fields", !/show_on_leaderboard|updated_at|"id"/.test(body));

const cells = await page.locator("main span[title*='match']").count();
check("heatmap rendered day cells with tooltips", cells > 0, `${cells} cells with a match title`);

// The raw auth UUID must never appear on a public page.
const html = await page.content();
check(
  "no auth uuid leaked into the page",
  !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(html),
);

await page.screenshot({ path: `${OUT}/profile-page.png`, fullPage: true });

// ------------------------------------------------------------- an unknown handle
await page.goto(`${BASE}/u/nobody-here-at-all`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const missing = await page.textContent("main");
check("unknown handle shows the friendly empty state", /No profile here/.test(missing));

// ------------------------------------------------------ leaderboard -> profile
await page.goto(`${BASE}/leaderboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const links = await page.locator('main a[href^="/u/"]').count();
check("leaderboard rows link to profiles", links > 0, `${links} profile links`);
if (links > 0) {
  const href = await page.locator('main a[href^="/u/"]').first().getAttribute("href");
  await page.click(`main a[href="${href}"]`);
  await page.waitForTimeout(1800);
  const landed = await page.textContent("main");
  check("clicking a leaderboard row opens that profile", /Active skin/.test(landed), `-> ${href}`);
  await page.screenshot({ path: `${OUT}/profile-from-leaderboard.png`, fullPage: true });
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
