// TEMPORARY layout probe: does the arena + bot panel + player prompts fit one screenful?
//
// Measured in DOCUMENT coordinates, not viewport coordinates. An earlier version scrolled
// the panel into view first and read getBoundingClientRect(), which reports wherever the
// scroll happened to land and turns a layout question into a scroll-timing question.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();

for (const height of [900, 1000, 1080]) {
  const page = await browser.newPage({ viewport: { width: 1440, height } });
  await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
  // 120 WPM draws the long sentence band, which is the worst case for the layout.
  await page.getByLabel("Bot typing speed in words per minute").selectOption("120");
  await page.waitForTimeout(150);
  await page.getByTestId("start-overlay").click();
  await page.waitForSelector('[data-testid="player-panel"]');
  const hint = page.locator('[data-testid="focus-hint"]');
  if (await hint.count()) await hint.first().click();
  await page.waitForTimeout(2400);

  const geom = async () =>
    page.evaluate(() => {
      const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
      const arena = document.querySelector('[data-testid="arena"]');
      const panel = document.querySelector('[data-testid="player-panel"]');
      const bot = document.querySelector('[data-testid="bot-panel"]');
      const prompt = document.querySelector('[data-testid="player-panel"] [data-testid="prompt"]');
      const words = prompt?.querySelectorAll("[data-word]") ?? [];
      const lines = new Set(
        Array.from(words).map((w) => Math.round(w.getBoundingClientRect().top)),
      ).size;
      return {
        text: prompt?.getAttribute("data-text") ?? "",
        chars: (prompt?.getAttribute("data-text") ?? "").length,
        lines,
        blockFrom: Math.round(docTop(arena)),
        blockTo: Math.round(docTop(panel) + panel.getBoundingClientRect().height),
        panelH: Math.round(panel.getBoundingClientRect().height),
        botH: Math.round(bot?.getBoundingClientRect().height ?? 0),
        arenaH: Math.round(arena.getBoundingClientRect().height),
        pageTop: Math.round(docTop(arena)),
      };
    });

  let worst = null;
  for (let round = 0; round < 24; round++) {
    const m = await geom();
    if (!worst || m.blockTo - m.blockFrom > worst.blockTo - worst.blockFrom) worst = m;
    const live = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="player-panel"] [data-testid="prompt"]');
      const w = p
        ? Array.from(p.querySelectorAll("[data-word]")).find(
            (x) => x.getAttribute("data-live") === "1",
          )
        : null;
      return w
        ? { text: w.getAttribute("data-word"), typed: Number(w.getAttribute("data-typed")) }
        : null;
    });
    if (!live) break;
    for (let i = live.typed; i < live.text.length; i++) {
      await page.keyboard.press(live.text[i]);
      await page.waitForTimeout(80);
    }
  }

  const need = worst.blockTo - worst.blockFrom;
  console.log(
    `viewport ${height}: arena+panels need ${need}px ` +
      `(arena ${worst.arenaH}, bot ${worst.botH}, player ${worst.panelH}, ` +
      `sentence "${worst.text}" ${worst.chars}c/${worst.lines} line) -> ` +
      (need <= height ? `FITS with ${height - need}px spare` : `OVERFLOWS by ${need - height}px`),
  );
  if (height === 1000) await page.screenshot({ path: "verification/probe-layout.png" });
  await page.close();
}

await browser.close();
