// Proves the input buffer never banks a keystroke for a round that has not started.
//
// Ruan's report (2026-10-06): "when the bot is knocked off and I keep typing, three keys are held
// and when the round restarts those keystrokes get added." The engine test pins the KO window at
// the logic level; this one drives it through the real keyboard handler, where the same bug also
// shows up as a HUD that reports held keys and a page that scrolls on a mashed space.
//
//   node scripts/probe-input-buffer.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || process.env.KT_BASE || "http://localhost:3000";
mkdirSync("verification", { recursive: true });

let fail = 0;
let total = 0;
const check = (name, ok, extra = "") => {
  total++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${extra ? ` ${extra}` : ""}`);
  if (!ok) fail++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

/** The player's live word and how much of it is committed. */
const liveWord = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="player-panel"] [data-word][data-live="1"]');
    return el
      ? { text: el.getAttribute("data-word") || "", typed: Number(el.getAttribute("data-typed") || 0) }
      : null;
  });

await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="start-overlay"]', { timeout: 20000 });
await page.getByTestId("start-overlay").click();
await page.waitForSelector('[data-testid="player-panel"]', { timeout: 10000 });

// Hand the game the keyboard the way a player does.
const hint = page.locator('[data-testid="focus-hint"]');
if (await hint.count()) await hint.first().click();
else await page.locator("canvas").click({ position: { x: 20, y: 20 } });

// ---------------------------------------------- the countdown: mash while nobody can act
const countingDown = await page.locator('[data-testid="countdown"]').count();
// Baseline the scroll FIRST. Handing the game the keyboard means clicking the canvas, and that
// click scrolls the arena into view by itself (the big harness documents the same thing), so the
// question is not "is the page at the top" but "did the mashing move it".
const scrollBefore = await page.evaluate(() => window.scrollY);
for (const k of ["w", "a", "s", "d", "e", "Space"]) {
  await page.keyboard.press(k);
}

const held = await page.locator('[data-testid="player-queued"]').count();
const scrollAfter = await page.evaluate(() => window.scrollY);
check("the countdown is on screen while we mash", countingDown >= 1, `(countdown elements: ${countingDown})`);
check("the HUD holds nothing during the countdown", held === 0, `(held indicator: ${held === 0 ? "absent" : "present"})`);
check(
  "a mashed space did not scroll the page",
  scrollAfter === scrollBefore,
  `(scrollY ${scrollBefore} -> ${scrollAfter})`,
);

// ------------------------------------------------- and none of it may land on the new sentence
await page.waitForSelector('[data-testid="countdown"]', { state: "detached", timeout: 15000 });
const first = await liveWord();
check("round one is live, with a word on screen", Boolean(first), `(${JSON.stringify(first)})`);
check(
  "nothing mashed during the countdown was applied",
  (first?.typed ?? -1) === 0,
  `(word "${first?.text}" at ${first?.typed})`,
);
await page.screenshot({ path: "verification/21-input-buffer-live.png" });

// ------------------------------- and normal typing still registers: the fix killed nothing
let typedNow = first?.typed ?? 0;
for (let i = 0; i < 5 && typedNow < 1; i++) {
  const key = await page.getAttribute(
    '[data-testid="player-panel"] [data-testid="prompt"]',
    "data-next-key",
  );
  if (!key) break;
  await page.keyboard.press(key === " " ? "Space" : key);
  await page.waitForTimeout(140);
  typedNow = (await liveWord())?.typed ?? 0;
}
check("typing still registers once the round is live", typedNow >= 1, `(typed ${typedNow})`);

await browser.close();
console.log(`\npassed ${total - fail} of ${total}  failed ${fail}`);
process.exit(fail ? 1 : 0);
