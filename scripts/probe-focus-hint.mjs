// Does the "click here to start typing" guard track WINDOW focus correctly?
// Usage: node scripts/probe-focus-hint.mjs http://localhost:3000
import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });

const state = () =>
  page.evaluate(() => ({
    guard: Boolean(document.querySelector('[data-testid="focus-hint"]')),
    focused: document.hasFocus(),
    active: document.activeElement?.tagName || "?",
  }));

await page.getByTestId("start-overlay").click();
await page.waitForTimeout(600);
const s1 = await state();
console.log(`  after Fight: guard=${s1.guard} docFocus=${s1.focused} active=${s1.active}`);

check("the document has focus (so typing reaches the game)", s1.focused === true);
check("the guard clears on focus, WITHOUT any keystroke", s1.guard === false);

// THE REGRESSION: clicking a control must not be mistaken for losing focus.
await page.getByTestId("fullscreen-button").click();
await page.waitForTimeout(600);
const s2 = await state();
check("clicking Fullscreen does NOT bring the guard back", s2.guard === false, `guard=${s2.guard}`);
try {
  await page.evaluate(() => document.exitFullscreen?.());
} catch {
  /* already out of fullscreen */
}

// The window reporting loss of focus must bring the guard back. Driven with synthetic window
// events: headless Chromium will not actually blur a page sitting behind another tab, and the
// handler keys off these events — which is exactly the wiring under test.
await page.evaluate(() => window.dispatchEvent(new Event("blur")));
await page.waitForTimeout(400);
const s3 = await state();
check("the guard RETURNS when the window reports blur", s3.guard === true, `guard=${s3.guard}`);

await page.evaluate(() => window.dispatchEvent(new Event("focus")));
await page.waitForTimeout(400);
const s4 = await state();
check("the guard clears again when the window reports focus", s4.guard === false, `guard=${s4.guard}`);

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
