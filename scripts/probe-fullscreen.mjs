// Can a headless browser enter fullscreen, and if it does, is the sentence visible?
//
// This decides whether the fullscreen bug can have a real automated test or only a manual one.
// Ruan: "fullscreen mode does not work properly as I cannot see the words I need to type."

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const HEIGHT = Number(process.env.VH ?? 768); // short screen: where the 76vh arithmetic broke

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: HEIGHT } });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));

const report = async (label) => {
  // Pin the scroll to the top BEFORE measuring. This is the honest position: a real fullscreen
  // element cannot be scrolled, so anything below the fold is genuinely unreachable. Without
  // this the test passes on a page that happens to be scrolled to the right place, which is how
  // a broken fullscreen can look fine to an automated check.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  const m = await page.evaluate(() => {
    const fsEl = document.fullscreenElement;
    const p = document.querySelector('[data-testid="player-panel"]');
    // SCOPE THIS TO THE PLAYER PANEL. Both panels carry a sentence and the bot panel comes first
    // in the DOM, so a bare [data-testid="sentence"] matches the BOT's, which always sits near
    // the top of the page. Measuring that reported "visible" however badly the player's own
    // prompt was pushed off-screen, which is exactly how a broken fullscreen passes a test.
    const s = document.querySelector('[data-testid="player-panel"] [data-testid="sentence"]');
    const sec = document.querySelector('[data-testid="fight-section"]');
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
    };
    return {
      inFullscreen: Boolean(fsEl),
      vh: window.innerHeight,
      docH: document.documentElement.scrollHeight,
      scrollable: document.documentElement.scrollHeight > window.innerHeight + 2,
      section: box(sec),
      panel: box(p),
      sentence: box(s),
    };
  });
  const ok = m.sentence && m.sentence.bottom <= m.vh + 2;
  console.log(
    `${label.padEnd(26)} fs=${String(m.inFullscreen).padEnd(5)} vh=${m.vh} docH=${m.docH} ` +
      `scrollable=${m.scrollable} sentence=${m.sentence ? `${m.sentence.top}..${m.sentence.bottom}` : "null"} visible=${ok}`,
  );
  return { ...m, ok };
};

await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
await page.getByTestId("start-overlay").click();
await page.waitForSelector('[data-testid="player-panel"]', { timeout: 8000 });
const hint = page.locator('[data-testid="focus-hint"]');
if (await hint.count()) await hint.first().click();
await page.waitForTimeout(3200);
await report("normal");

const btn = page.getByTestId("fullscreen-button");
const supported = await page.evaluate(() => typeof document.documentElement.requestFullscreen === "function");
console.log(`\nrequestFullscreen available: ${supported}`);

// A real click is a user gesture, which is what the Fullscreen API requires.
await btn.click();
await page.waitForTimeout(900);
const fs = await report("after clicking fullscreen");

if (!fs.inFullscreen) {
  console.log("\nRESULT: headless browser did NOT enter fullscreen.");
  console.log("        -> the fullscreen path cannot be covered by the browser suite; it needs a");
  console.log("           manual check, or a simulated layout state.");
} else {
  console.log("\nRESULT: fullscreen IS testable headless. Sentence visible: " + fs.ok);
  await page.screenshot({ path: "./verification/probe-fullscreen.png" });

  // Now re-apply the OLD layout in the page and measure again, to prove this check would have
  // caught the bug rather than merely passing now. Full rebuild not needed: the old layout was
  // pure CSS, so restoring those three declarations reproduces it exactly.
  console.log("\n--- re-applying the OLD layout (76vh arena, block section, no flex) ---");
  await page.evaluate(() => {
    const section = document.querySelector('[data-testid="fight-section"]');
    const wrapper = document.querySelector('[data-testid="arena"]').parentElement;
    const arena = document.querySelector('[data-testid="arena"]');
    if (section) {
      section.style.display = "block";
      section.style.height = "auto";
      section.style.maxHeight = "none";
      section.style.overflow = "visible";
    }
    if (wrapper) {
      wrapper.style.display = "block";
      wrapper.style.flex = "none";
      wrapper.style.minHeight = "0";
    }
    if (arena) {
      arena.style.maxHeight = "none";
      arena.style.maxWidth = "calc(76vh * 16 / 9)";
      arena.style.width = "100%";
      arena.style.aspectRatio = "16 / 9";
    }
  });
  await page.waitForTimeout(700);
  const old = await report("OLD layout (simulated)");
  console.log(
    old.ok
      ? "  -> the old layout ALSO kept it visible at this height; the check would not have caught it here"
      : "  -> the old layout pushed the sentence off-screen, which is Ruan's bug reproduced",
  );
  await page.screenshot({ path: "./verification/probe-fullscreen-old.png" });
}

await browser.close();
