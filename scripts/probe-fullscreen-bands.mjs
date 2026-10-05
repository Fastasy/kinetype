// Vertical stack of the fight section's containers in FULLSCREEN.
// Ruan: controls "Bot speed / Your side / Strict mistakes / Sound off" and the
// "Wearing ... / 10W-6L ..." strip have a massive gap between them in fullscreen.
// Usage: node scripts/probe-fullscreen-bands.mjs http://localhost:3000
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const OUT = "verification";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });

await page.getByTestId("start-overlay").click();
await page.waitForTimeout(300);
const hint = page.locator('[data-testid="focus-hint"]');
if (await hint.count()) await hint.first().click();
await page.waitForTimeout(400);

const key = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="player-panel"] [data-testid="prompt"]');
  return el?.getAttribute("data-next-key") || null;
});
if (key) await page.keyboard.press(key === " " ? "Space" : key);
await page.waitForTimeout(400);

await page.getByTestId("fullscreen-button").click();
await page.waitForTimeout(700);

const bands = await page.evaluate(() => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
  };
  const byText = (needle) =>
    Array.from(document.querySelectorAll("section div")).find(
      (d) => d.textContent?.includes(needle) && d.querySelector("span,select"),
    ) || null;
  return {
    vh: window.innerHeight,
    fullscreen: Boolean(document.fullscreenElement),
    controls: rect(byText("Bot speed")),
    botPanel: rect(document.querySelector('[data-testid="bot-panel"]')),
    arena: rect(document.querySelector('[data-testid="arena"]')),
    playerPanel: rect(document.querySelector('[data-testid="player-panel"]')),
    footer: rect(byText("Wearing")),
  };
});

console.log(JSON.stringify(bands, null, 2));
console.log("\nvertical order top->bottom:");
const named = Object.entries(bands).filter(([k]) => k !== "vh" && k !== "fullscreen");
named.sort((a, b) => (a[1]?.top ?? Infinity) - (b[1]?.top ?? Infinity));
for (const [k, v] of named) console.log(`  ${k.padEnd(12)} ${v ? `top=${v.top} bottom=${v.bottom} h=${v.h}` : "(absent)"}`);

await page.screenshot({ path: `${OUT}/fullscreen-bands.png` });
await browser.close();
