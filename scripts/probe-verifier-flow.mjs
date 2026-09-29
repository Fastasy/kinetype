// Replicates the verifier's exact flow, because the probe that loads /play directly does not
// reproduce the verifier's failures. The difference is the client-side navigation from the
// landing page.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));

const sample = async (label) => {
  const m = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const out = { canvases: document.querySelectorAll("canvas").length };
    if (c) {
      const ctx = c.getContext("2d");
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) {
        seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
        if (seen.size > 8) break;
      }
      out.w = c.width;
      out.h = c.height;
      out.distinct = seen.size;
    }
    const p = document.querySelector('[data-testid="player-panel"]');
    out.panelBottom = p ? Math.round(p.getBoundingClientRect().bottom) : null;
    out.promptCount = document.querySelectorAll('[data-testid="player-panel"] [data-testid="prompt"]').length;
    out.promptText = document.querySelector('[data-testid="player-panel"] [data-testid="prompt"]')?.getAttribute("data-text");
    out.promptTyped = document.querySelector('[data-testid="player-panel"] [data-testid="prompt"]')?.getAttribute("data-typed");
    out.vh = window.innerHeight;
    return out;
  });
  console.log(`${label.padEnd(34)} canvases=${m.canvases} ${m.w}x${m.h} distinct=${m.distinct} panelBottom=${m.panelBottom}/${m.vh} prompts=${m.promptCount} "${m.promptText}" typed=${m.promptTyped}`);
  return m;
};

// Walk the CTA path the way the verifier does.
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const cta = page.getByTestId("play-cta");
await cta.first().click();
await page.waitForURL("**/play", { timeout: 8000 });
await page.waitForTimeout(400);
await sample("after CTA nav (intro)");

await page.getByTestId("start-overlay").click();
await page.waitForSelector('[data-testid="player-panel"]', { timeout: 5000 });
await sample("after start click");

const hint = page.locator('[data-testid="focus-hint"]');
if (await hint.count()) await hint.first().click();
for (const t of [800, 1600, 2400, 3200, 4200]) {
  await page.waitForTimeout(t === 800 ? 800 : 800);
  await sample(`t=${t}ms`);
}

console.log("\n--- pressing the first letter of the live word ---");
const before = await sample("before press");
await page.keyboard.press(before.promptText[0]);
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="player-panel"] [data-testid="prompt"]');
    return p ? { text: p.getAttribute("data-text"), typed: p.getAttribute("data-typed") } : null;
  });
  console.log(`  +${(i + 1) * 250}ms  "${after?.text}" typed=${after?.typed}`);
}

await browser.close();
