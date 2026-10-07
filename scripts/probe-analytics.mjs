// Verify the analytics pipeline in a REAL browser against a REAL deploy.
//
// This does not check that analytics "exists" in the bundle -- it drives the live
// site, captures the actual POST bodies the tracker sends to /api/e, and reports
// them. That is the only way to prove the client half of the chain works, because
// the tracker stays deliberately silent on localhost.
//
// Run: SITE=https://www.kinetype.app node scripts/probe-analytics.mjs

import { chromium } from "playwright";

import { suppressTour } from "./lib/tour-seen.mjs";

const SITE = process.env.SITE ?? "https://www.kinetype.app";

// Prefer the real Chrome already on the machine over Playwright's bundled build:
// no 150MB download, and the traffic looks like an actual visitor.
const CHANNEL = process.env.CHANNEL ?? "chrome";

const browser = await chromium.launch(
  CHANNEL === "bundled" ? {} : { channel: CHANNEL },
);
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
});
// Not a first-time visitor. This probe clicks a /play link on the landing page, and the
// first-visit tour auto-opens there for a fresh browser with an overlay that swallows clicks —
// see scripts/lib/tour-seen.mjs for why.
await suppressTour(context);
const page = await context.newPage();

const sends = [];
const pageErrors = [];
const consoleErrors = [];

page.on("request", (r) => {
  if (r.url().includes("/api/e") && r.method() === "POST") {
    sends.push(r.postData() ?? "");
  }
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

const events = () => {
  const out = [];
  for (const body of sends) {
    try {
      const parsed = JSON.parse(body);
      for (const e of parsed.events ?? []) out.push(e);
    } catch {
      /* ignore */
    }
  }
  return out;
};

console.log(`--- 1. landing on ${SITE}/ ---`);
await page.goto(`${SITE}/`, { waitUntil: "load" });
await page.waitForTimeout(2000);

const sessionId = await page.evaluate(() => window.kinetypeAnalytics?.sessionId?.() ?? null);
const tracker = await page.evaluate(() => typeof window.kinetypeAnalytics);
console.log(`  tracker exposed: ${tracker}`);
console.log(`  session id: ${sessionId}`);

// Let the 5s interval flush the landing page view.
await page.waitForTimeout(4000);

console.log("--- 2. client-side navigation (App Router) -> /play ---");
const link = page.locator('a[href="/play"]').first();
if (await link.count()) {
  await link.click();
  await page.waitForTimeout(2500);
} else {
  console.log("  no /play link found in nav");
}

console.log("--- 3. start a match (funnel event) ---");
const startBtn = page.locator('[data-testid="start-overlay"]').first();
if (await startBtn.count()) {
  await startBtn.click();
  await page.waitForTimeout(3000);
} else {
  console.log("  start overlay not found");
}

await page.evaluate(() => window.kinetypeAnalytics?.flush?.());
await page.waitForTimeout(2500);

console.log("--- 4. what the page actually sent ---");
const all = events();
console.log(`  POSTs to /api/e: ${sends.length}`);
console.log(`  events captured: ${all.length}`);
for (const e of all) {
  console.log(`   * ${e.event}  path=${e.path ?? "-"}  props=${JSON.stringify(e.props ?? {})}`);
}

console.log("--- 5. errors ---");
console.log(`  page errors: ${pageErrors.length}`);
pageErrors.slice(0, 5).forEach((e) => console.log(`   ! ${e}`));
console.log(`  console errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 5).forEach((e) => console.log(`   ! ${e}`));

console.log(`SESSION_ID=${sessionId}`);
await browser.close();
