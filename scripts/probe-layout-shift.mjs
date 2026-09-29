// Why does the page shift up and down while typing?
//
// Suspicion: committed/next characters carry px-0.5 with no compensating negative margin, so the
// sentence text grows ~4px per keystroke, re-wraps, and pushes everything below it.
//
// This records the geometry before and after every keystroke so the culprit is measured, not
// guessed.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const KEYS = Number(process.env.KEYS ?? 14);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));

const snap = () =>
  page.evaluate(() => {
    const docTop = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY);
    const q = (s) => document.querySelector(s);
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : null);
    const arena = q('[data-testid="arena"]');
    const panel = q('[data-testid="player-panel"]');
    const bot = q('[data-testid="bot-panel"]');
    const bar = q('[data-testid="fight-section"]')?.firstElementChild ?? null;
    const sent = q('[data-testid="player-panel"] [data-testid="sentence"]');
    const live = q('[data-testid="player-panel"] [data-word][data-live="1"]');
    return {
      scrollY: Math.round(window.scrollY),
      docH: document.documentElement.scrollHeight,
      barH: h(bar),
      barTop: bar ? docTop(bar) : null,
      arenaTop: arena ? docTop(arena) : null,
      arenaH: h(arena),
      botTop: bot ? docTop(bot) : null,
      botH: h(bot),
      panelTop: panel ? docTop(panel) : null,
      panelH: h(panel),
      sentH: h(sent),
      liveW: live ? Math.round(live.getBoundingClientRect().width) : null,
      liveWord: live ? live.getAttribute("data-word") : null,
      liveTyped: live ? live.getAttribute("data-typed") : null,
    };
  });

await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
await page.getByTestId("start-overlay").click();
await page.waitForSelector('[data-testid="player-panel"]', { timeout: 8000 });
const hint = page.locator('[data-testid="focus-hint"]');
if (await hint.count()) await hint.first().click();
await page.waitForTimeout(3400); // countdown
// Let the start-up smooth scroll finish, so its motion is not confused with the bug.
await page.waitForTimeout(1500);

const first = await snap();
console.log(
  "baseline".padEnd(9) +
    ` scrollY=${first.scrollY} docH=${first.docH} arenaTop=${first.arenaTop} ` +
    `panelTop=${first.panelTop} panelH=${first.panelH} sentH=${first.sentH} sentW=${first.sentW}`,
);

const expected = await page.evaluate(() => {
  const live = document.querySelector(
    '[data-testid="player-panel"] [data-word][data-live="1"]',
  );
  return live ? live.getAttribute("data-word") : null;
});

let prev = first;
let maxShift = 0;
console.log(`\ntyping "${expected}"\n`);

for (let i = 0; i < KEYS; i++) {
  const ch = await page.evaluate(() => {
    const live = document.querySelector(
      '[data-testid="player-panel"] [data-word][data-live="1"]',
    );
    if (!live) return null;
    const t = Number(live.getAttribute("data-typed"));
    return live.getAttribute("data-word")[t] ?? null;
  });
  if (!ch) break;
  await page.keyboard.press(ch);
  await page.waitForTimeout(220);
  const s = await snap();

  const moved = ["barH", "barTop", "arenaTop", "arenaH", "botTop", "botH", "panelTop", "panelH"].filter(
    (k) => (s[k] ?? 0) !== (prev[k] ?? 0),
  );
  const dLiveW = (s.liveW ?? 0) - (prev.liveW ?? 0);
  const dScroll = s.scrollY - prev.scrollY;
  const shifted = (s.panelTop ?? 0) !== (prev.panelTop ?? 0) || dScroll !== 0;
  maxShift = Math.max(maxShift, Math.abs(s.panelTop - prev.panelTop), Math.abs(dScroll));

  console.log(
    `  '${ch}'  typed=${s.liveTyped}  dLiveW=${dLiveW >= 0 ? "+" : ""}${dLiveW}  ` +
      `dScroll=${dScroll >= 0 ? "+" : ""}${dScroll}  ` +
      (moved.length ? `MOVED: ${moved.join(", ")}` : "nothing moved") +
      (shifted ? "   <-- PAGE SHIFT" : ""),
  );
  prev = s;
}

console.log(
  `\nmax panel/scroll shift: ${maxShift}px  =>  ${maxShift > 0 ? "THE PAGE MOVES WHILE TYPING" : "stable"}`,
);
await page.screenshot({ path: "./verification/probe-shift.png" });
await browser.close();
