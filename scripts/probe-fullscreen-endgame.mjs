// Drives a match to its END in FULLSCREEN and measures what breaks.
// Ruan: "the fullscreen buggs out as soon as I lose or win, then I have to exit fullscreen
// and the background is fucked with black spaces".
//
// Reaching the end reliably is the hard part: hammering correct keys fills the engine's
// input queue and progress stalls, so instead this picks the FASTEST bot and types nothing —
// the bot wins, which is one of the two end states we care about.
// Usage: node scripts/probe-fullscreen-endgame.mjs http://localhost:3000
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const OUT = "verification";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });

const speed = page.locator('select[aria-label="Bot typing speed in words per minute"]');
const opts = await speed.locator("option").allTextContents();
await speed.selectOption({ index: opts.length - 1 }); // fastest bot
console.log(`bot options: ${opts.join(", ")} -> picked ${opts[opts.length - 1]}`);

await page.getByTestId("start-overlay").click();
await page.waitForTimeout(400);
const hint = page.locator('[data-testid="focus-hint"]');
if (await hint.count()) await hint.first().click();

await page.getByTestId("fullscreen-button").click();
await page.waitForTimeout(700);

const measure = async (label) => {
  const m = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
    };
    const de = document.documentElement;
    return {
      fs: Boolean(document.fullscreenElement),
      fsTag: document.fullscreenElement?.getAttribute("data-testid") || null,
      vh: window.innerHeight,
      section: rect('[data-testid="fight-section"]'),
      result: rect('[data-testid="result"]'),
      playerPanel: rect('[data-testid="player-panel"]'),
      canvas: rect('[data-testid="arena"] canvas'),
      docScrollH: de.scrollHeight,
      docScrollTop: de.scrollTop,
      rootOverflow: getComputedStyle(de).overflow,
      bodyOverflow: getComputedStyle(document.body).overflow,
      overflowBottom: Math.round(de.scrollHeight - window.innerHeight),
    };
  });
  console.log(`\n[${label}]`, JSON.stringify(m));
  return m;
};

await measure("during fight");

let ended = false;
for (let i = 0; i < 120; i += 1) {
  if (await page.locator('[data-testid="result"]').count()) {
    ended = true;
    break;
  }
  await page.waitForTimeout(1000);
}
console.log(`\nmatch ended: ${ended}`);

await page.waitForTimeout(1500);
await measure("at result (before any scrolling)");
await page.screenshot({ path: `${OUT}/fullscreen-endgame.png` });

// Does scrolling inside the fullscreen element expose the backdrop (the black)?
// A real wheel gesture, NOT window.scrollBy: overflow:hidden blocks USER scrolling, while a
// programmatic scrollTop assignment bypasses the lock and would give a false reading.
await page.mouse.move(960, 540);
await page.mouse.wheel(0, 400);
await page.waitForTimeout(500);
const scrolled = await measure("after a 400px wheel gesture");
await page.screenshot({ path: `${OUT}/fullscreen-endgame-scrolled.png` });
console.log(`\nscrolled ${scrolled.docScrollTop}px`);

await browser.close();
