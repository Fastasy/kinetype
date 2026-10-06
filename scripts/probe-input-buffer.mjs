// Proves the input buffer never banks a keystroke for a round that has not started.
//
// Ruan's report (2026-10-06): "when the bot is knocked off and I keep typing, three keys are held
// and when the round restarts those keystrokes get added." The engine test pins the KO window at the
// logic level; this one drives it through the real keyboard handler, where the same bug also shows
// up as a HUD that reports held keys and a page that scrolls on a mashed space.
//
// TWO DESIGN POINTS, both learned the hard way on the first version of this probe:
//   1. It mashes the CORRECT next key, not random letters. A wrong letter costs accuracy and moves
//      no progress, so a random mash passes whether the bug is present or not — the assertion has
//      to be able to fail, and on the pre-fix build this probe now does fail.
//   2. It asserts the mash happened INSIDE the countdown window, before and after the presses. If
//      the countdown has already ended, every later assertion is meaningless — and a meaningless
//      pass is worse than a failure, because it closes the question without answering it.
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

const countdown = () => page.locator('[data-testid="countdown"]').count();

/** The player's live word and how much of it is committed. */
const liveWord = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="player-panel"] [data-word][data-live="1"]');
    return el
      ? { text: el.getAttribute("data-word") || "", typed: Number(el.getAttribute("data-typed") || 0) }
      : null;
  });

/** The character the prompt is actually waiting for, from the same source the engine reads. */
const nextKey = () =>
  page.evaluate(() => {
    const p = document.querySelector('[data-testid="player-panel"] [data-testid="prompt"]');
    const direct = p?.getAttribute("data-next-key");
    if (direct) return direct;
    const w = document.querySelector('[data-testid="player-panel"] [data-word][data-live="1"]');
    if (!w) return null;
    const t = Number(w.getAttribute("data-typed") || 0);
    return (w.getAttribute("data-word") || "")[t] ?? null;
  });

await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="start-overlay"]', { timeout: 20000 });
await page.getByTestId("start-overlay").click();

// Wait for the countdown rather than sleeping a guessed interval, then work fast: the window is
// 2.2s and every assertion below has to sit inside it.
await page.waitForSelector('[data-testid="countdown"]', { timeout: 10000 });
const countingBefore = await countdown();
const key = await nextKey();

// ---------------------------------------------- the countdown: mash while nobody can act
// Baseline the scroll first: opening the match scrolls the arena into view by itself, so the
// question is not "is the page at the top" but "did the mash move it".
const scrollBefore = await page.evaluate(() => window.scrollY);
const mashes = [];
if (key) {
  for (let i = 0; i < 3; i++) {
    mashes.push(key);
    await page.keyboard.press(key === " " ? "Space" : key);
  }
} else {
  for (const k of ["w", "a", "s"]) {
    mashes.push(k);
    await page.keyboard.press(k);
  }
}
const heldIndicator = await page.locator('[data-testid="player-queued"]').count();
// Settle before reading the HUD. The snapshot the panel renders comes off the engine's frame loop,
// so reading within a few milliseconds of the last keypress reports "nothing held" even when the
// queue is full — an assertion that cannot fail on the buggy build is not evidence of anything.
// The countdown is 2.2s and the check below confirms we are still inside it.
await page.waitForTimeout(90);
const heldAfterSettle = await page.locator('[data-testid="player-queued"]').count();
const countingAfter = await countdown();
const scrollAfter = await page.evaluate(() => window.scrollY);

check("the countdown was on screen when the mash started", countingBefore >= 1, `(${countingBefore})`);
check(
  "the mash happened INSIDE the countdown window",
  countingAfter >= 1,
  `(countdown after the mash: ${countingAfter})`,
);
check(
  "the HUD holds nothing during the countdown",
  heldIndicator === 0 && heldAfterSettle === 0,
  `(held indicator: ${heldIndicator === 0 ? "absent" : "present"} immediately, ${heldAfterSettle === 0 ? "absent" : "present"} after 90ms)`,
);
check(
  "the mash did not scroll the page",
  scrollAfter === scrollBefore,
  `(scrollY ${scrollBefore} -> ${scrollAfter}; mashed "${mashes.join("")}")`,
);

// ------------------------------------------------- and none of it may land on the new sentence
await page.waitForSelector('[data-testid="countdown"]', { state: "detached", timeout: 15000 });
const first = await liveWord();
check("round one is live, with a word on screen", Boolean(first), `(${JSON.stringify(first)})`);
check(
  "nothing mashed during the countdown was applied",
  (first?.typed ?? -1) === 0,
  `(word "${first?.text}" at ${first?.typed}, mashed "${key}")`,
);
await page.screenshot({ path: "verification/21-input-buffer-live.png" });

// ------------------------------- and normal typing still registers: the fix killed nothing
let typedNow = first?.typed ?? 0;
for (let i = 0; i < 5 && typedNow < 1; i++) {
  const k = await nextKey();
  if (!k) break;
  await page.keyboard.press(k === " " ? "Space" : k);
  await page.waitForTimeout(140);
  typedNow = (await liveWord())?.typed ?? 0;
}
check("typing still registers once the round is live", typedNow >= 1, `(typed ${typedNow})`);

await browser.close();
console.log(`\npassed ${total - fail} of ${total}  failed ${fail}`);
process.exit(fail ? 1 : 0);
