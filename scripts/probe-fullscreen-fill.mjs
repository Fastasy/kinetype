// Measures how much of a fullscreen viewport the fight actually fills.
//
// Ruan: "make the background of the fight scale to a users monitor size in full screen.
// currently it is just a small box in fullscreen."
//
// Reports the section / arena / canvas boxes against the viewport, so the letterbox bars
// around the arena are a measured number rather than an impression. Run at a few aspect
// ratios: a 16:9 screen hides this, an ultrawide one exposes it.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "verification";
mkdirSync(OUT, { recursive: true });

const SIZES = [
  { w: 1920, h: 1080, label: "16:9  1920x1080" },
  { w: 2560, h: 1080, label: "ultrawide 2560x1080" },
  { w: 1280, h: 800, label: "16:10 1280x800" },
  { w: 1440, h: 900, label: "16:10 1440x900" },
];

const browser = await chromium.launch();

for (const { w, h, label } of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  try {
    await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
    await page.getByTestId("start-overlay").click();
    await page.waitForSelector('[data-testid="player-panel"]', { timeout: 10000 });
    const hint = page.locator('[data-testid="focus-hint"]');
    if (await hint.count()) await hint.first().click();
    await page.waitForTimeout(600);

    // Press the key the game is actually asking for, so the "click here to start typing"
    // overlay clears and the screenshot shows the real fight instead of a washed-out scrim.
    const next = await page.evaluate(
      () => document.querySelector('[data-testid="player-panel"] [data-testid="prompt"]')?.getAttribute("data-next-key") ?? "",
    );
    if (next) {
      await page.keyboard.press(next === " " ? "Space" : next);
      await page.waitForTimeout(400);
    }

    await page.getByTestId("fullscreen-button").click();
    await page.waitForTimeout(900);

    const m = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height),
        };
      };
      const sec = document.querySelector('[data-testid="fight-section"]');
      const arena = document.querySelector('[data-testid="arena"]');
      const canvas = arena?.querySelector("canvas");
      return {
        inFullscreen: Boolean(document.fullscreenElement),
        fsTag: document.fullscreenElement?.getAttribute("data-testid") ?? document.fullscreenElement?.tagName ?? null,
        vw: window.innerWidth,
        vh: window.innerHeight,
        section: box(sec),
        arena: box(arena),
        canvas: box(canvas),
      };
    });

    const a = m.arena;
    const bars = a
      ? { left: a.x, right: m.vw - (a.x + a.w), top: a.y, bottom: m.vh - (a.y + a.h) }
      : null;
    const coverage = a ? Math.round(((a.w * a.h) / (m.vw * m.vh)) * 1000) / 10 : 0;

    console.log(`\n=== ${label} ===`);
    console.log(`  fullscreen=${m.inFullscreen} (${m.fsTag})  viewport=${m.vw}x${m.vh}`);
    console.log(`  section : ${JSON.stringify(m.section)}`);
    console.log(`  arena   : ${JSON.stringify(m.arena)}`);
    console.log(`  canvas  : ${JSON.stringify(m.canvas)}`);
    console.log(`  letterbox bars around arena: ${JSON.stringify(bars)}`);
    console.log(`  arena covers ${coverage}% of the screen`);

    if (m.inFullscreen) {
      await page.screenshot({ path: `${OUT}/fullscreen-${w}x${h}.png` });
    }
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\nwrote ${OUT}/fullscreen-*.png`);
