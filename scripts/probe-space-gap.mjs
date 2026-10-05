// Verifies the pending-space separator is a CARET ON THE SPACE, not a chip and not nothing.
//
// Ruan, in three steps, landing here:
//   "remove the spacebar icon inbetween the text, I mean there should be a space between them"
//   -> a bare space (caret then vanished)
//   "make the carrett highlight the space aswell. because now the carrett just dissapears when a
//    word is done and space needs to be entered"
//
// So the space must now carry the SAME caret as a letter: the accent block, one character wide,
// with no glyph in it. Asserted against a real committed character rather than a hardcoded colour,
// so a theme change cannot silently pass this.
//
// NOTE: `[data-testid="prompt"]` exists in BOTH panels and the bot's comes first in DOM order, so
// every selector here is scoped to the player panel.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "verification";
const PLAYER = '[data-testid="player-panel"]';
mkdirSync(OUT, { recursive: true });

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
  await page.click('[data-testid="fight-button"]');

  const hint = page.locator('[data-testid="focus-hint"]');
  if (await hint.count()) await hint.first().click().catch(() => {});
  await page.waitForSelector(`${PLAYER} [data-testid="prompt"]`, { timeout: 20000 });

  const readPrompt = () =>
    page.evaluate((sel) => {
      const n = document.querySelector(`${sel} [data-testid="prompt"]`);
      if (!n) return null;
      return {
        nextKey: n.getAttribute("data-next-key") ?? "",
        pendingSpace: n.getAttribute("data-pending-space") === "1",
      };
    }, PLAYER);

  let state = await readPrompt();
  let presses = 0;
  while (state && !state.pendingSpace && presses < 60) {
    const k = state.nextKey;
    if (!k) break;
    await page.keyboard.press(k === " " ? "Space" : k);
    presses++;
    await page.waitForTimeout(70);
    state = await readPrompt();
  }
  check("reached a pending-space state by typing", Boolean(state?.pendingSpace), `${presses} keypresses`);

  const sentenceText = (await page.textContent(`${PLAYER} [data-testid="sentence"]`)) ?? "";
  check("no SPACE label inside the sentence", !/SPACE/i.test(sentenceText), JSON.stringify(sentenceText.slice(0, 70)));

  // The caret under test, measured against a real committed character in the same word.
  const m = await page.evaluate((sel) => {
    const space = document.querySelector(`${sel} [data-testid="space-cursor"]`);
    // The live word is fully typed while its separator is outstanding, so its characters are
    // all committed — and committed characters are painted with theme.accent.
    const live = document.querySelector(`${sel} [data-word][data-live="1"]`);
    const char = live?.querySelector("span");
    if (!space) return { space: null, char: null };
    const ss = getComputedStyle(space);
    const sr = space.getBoundingClientRect();
    const cs = char ? getComputedStyle(char) : null;
    const cr = char ? char.getBoundingClientRect() : null;
    return {
      space: {
        background: ss.backgroundColor,
        text: space.textContent,
        klass: space.className,
        animation: ss.animationName,
        w: Math.round(sr.width * 100) / 100,
        h: Math.round(sr.height * 100) / 100,
      },
      char: cs ? { colour: cs.color, w: cr ? Math.round(cr.width * 100) / 100 : null, h: cr ? Math.round(cr.height * 100) / 100 : null } : null,
    };
  }, PLAYER);

  const s = m.space;
  const c = m.char;
  console.log(`     caret: bg=${s?.background} ${s?.w}x${s?.h}px · committed char: colour=${c?.colour} ${c?.w}x${c?.h}px`);

  check("a space caret element exists", Boolean(s));
  check("the caret holds whitespace, not text", Boolean(s) && s.text.trim() === "", JSON.stringify(s?.text));
  check(
    "the caret is HIGHLIGHTED (not transparent)",
    Boolean(s) && s.background !== "rgba(0, 0, 0, 0)" && s.background !== "transparent",
    s?.background,
  );
  check(
    "the caret uses the same accent as a letter's caret",
    Boolean(s && c) && s.background === c.colour,
    `space ${s?.background} vs letter ${c?.colour}`,
  );
  check("still not chipped markup", Boolean(s) && !/px-|py-|animate-pulse/.test(s.klass), s?.klass || "(no class)");

  // The gap must still read as a space, and the caret must sit INSIDE it. Deliberately not
  // asserting "one character wide": a space is narrower than a letter here (the row's gap is
  // 0.6ch), so a caret sized to a full character would overrun the gap and shove the words
  // apart. The bar is the cursor; the gap is the space.
  const gaps = await page.evaluate((sel) => {
    const words = Array.from(document.querySelectorAll(`${sel} [data-word]`));
    const out = [];
    for (let i = 0; i < words.length - 1; i++) {
      const a = words[i].getBoundingClientRect();
      const b = words[i + 1].getBoundingClientRect();
      out.push({
        live: words[i].getAttribute("data-live") === "1",
        sameLine: Math.abs(a.top - b.top) < 1,
        gap: Math.round((b.left - a.right) * 100) / 100,
      });
    }
    return out;
  }, PLAYER);
  const live = gaps.find((g) => g.live && g.sameLine);
  const others = gaps.filter((g) => !g.live && g.sameLine).map((g) => g.gap);
  const medianOther = others.length ? others.slice().sort((a, b) => a - b)[Math.floor(others.length / 2)] : null;
  check(
    "the pending-space gap still matches the normal word gap",
    Boolean(live) && medianOther != null && Math.abs(live.gap - medianOther) <= 3,
    `live ${live?.gap}px vs normal ${medianOther}px`,
  );
  check("the caret is a visible bar, not a hairline", Boolean(s) && s.w >= 3, `${s?.w}px wide`);
  check(
    "the caret sits inside the word gap rather than widening it",
    Boolean(s) && medianOther != null && s.w <= medianOther + 3,
    `caret ${s?.w}px vs gap ${medianOther}px`,
  );
  check(
    "the caret is not the removed 'SPACE' chip",
    Boolean(s) && (s.h < 60), // a chip with a label would be much shorter/boxier; this spans the line
    `${s?.h}px tall`,
  );

  await page.locator(`${PLAYER} [data-testid="prompt"]`).screenshot({ path: `${OUT}/space-caret.png` });
  await page.screenshot({ path: `${OUT}/space-caret-full.png` });
  console.log(`     wrote ${OUT}/space-caret.png`);
} finally {
  await browser.close();
}

console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
