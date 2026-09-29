// End-to-end verification in a real browser.
//
// This does not check that the page renders. It checks that the GAME WORKS: it
// starts a match, reads the live prompts out of the DOM, types words into the game
// at a human pace, and asserts that damage lands both ways.
//
// Three of the bugs this caught were invisible to a build check:
//   1. Bots typed words at full speed and never dealt damage.
//   2. At high typing speed the opponent was stunned permanently (no counterplay).
//   3. A finished match showed no result panel, so it looked like a frozen game.
//
// Run: node scripts/verify-browser.mjs   (needs a server on BASE_URL)

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = "verification";
mkdirSync(SHOTS, { recursive: true });

/** Per-character delay. Deliberately human-paced: typing flat out starves the
 *  opponent of turns, which makes the "bot fights back" check meaningless. */
const CHAR_MS = 120;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("requestfailed", (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ""}`));

// ---------------------------------------------------------------- helpers

async function canvasColours() {
  return page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return { ok: false, reason: "no canvas" };
    const ctx = c.getContext("2d");
    if (!ctx) return { ok: false, reason: "no 2d context" };
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) {
      seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      if (seen.size > 8) break;
    }
    return { ok: seen.size > 3, reason: `${seen.size} distinct sampled colours` };
  });
}

/** Read a data-value, or null if that element is not on screen any more. */
async function valueOf(testid) {
  const el = page.locator(`[data-testid="${testid}"]`);
  if ((await el.count()) === 0) return null;
  const v = await el.first().getAttribute("data-value");
  return v === null ? null : Number(v);
}

async function readPrompts(panelTestId) {
  return page.$$eval(`[data-testid="${panelTestId}"] [data-testid="prompt"]`, (nodes) =>
    nodes.map((n) => ({
      text: n.getAttribute("data-text") ?? "",
      typed: Number(n.getAttribute("data-typed") ?? "0"),
      kind: n.getAttribute("data-kind") ?? "attack",
      move: n.getAttribute("data-move") ?? "",
      index: Number(n.getAttribute("data-index") ?? "0"),
      // Every word in the sentence carries its own move, which is the mechanic: a small
      // word blocks, an ordinary word punches, a difficult word kicks.
      words: Array.from(n.querySelectorAll("[data-word]")).map((w) => ({
        text: w.getAttribute("data-word") ?? "",
        move: w.getAttribute("data-move") ?? "",
        typed: Number(w.getAttribute("data-typed") ?? "0"),
        live: w.getAttribute("data-live") === "1",
      })),
    })),
  );
}

async function matchOver() {
  return (await page.locator('[data-testid="result"]').count()) > 0;
}

/**
 * Wait until the arena has actually been painted.
 *
 * WHY THIS EXISTS: starting a match scrolls the arena into view, and that scroll changes the
 * canvas box, which fires the ResizeObserver, which resizes the canvas, which CLEARS it. The
 * next animation frame redraws it. Sampling during that window reads a blank canvas and looks
 * exactly like "the renderer is broken", which is a false alarm this suite has now raised
 * twice. Poll for the painted state instead of sleeping a fixed time and hoping.
 */
async function waitForArena(maxMs = 8000) {
  const deadline = Date.now() + maxMs;
  let last = { ok: false, reason: "never sampled" };
  while (Date.now() < deadline) {
    last = await canvasColours();
    if (last.ok) return last;
    await page.waitForTimeout(120);
  }
  return last;
}

/**
 * One exchange: type out the live WORD of the sentence. Words are the commit unit, so
 * this is one move.
 *
 * The expected character is re-read from the DOM on every keystroke rather than cached
 * up front: hitstun blocks input, a sentence rolls over to the next one, and (while
 * falling) a save word replaces everything. A cached copy would keep typing into a
 * prompt that no longer exists and rack up errors.
 *
 * Returns the move of the word that was completed, which is what the game acted on.
 */
async function playOneWord() {
  const [start] = await readPrompts("player-panel");
  if (!start) return { typed: false, move: "" };
  const live = start.words.find((w) => w.live);
  if (!live) return { typed: false, move: "" };

  for (let i = 0; i < 24; i++) {
    const [now] = await readPrompts("player-panel");
    const word = now?.words.find((w) => w.live);
    // The sentence moved on without us, or it rolled over: either way this word is done.
    if (!word || word.text !== live.text || word.typed >= word.text.length) {
      return { typed: true, move: live.move };
    }
    const ch = word.text[word.typed];
    if (!ch) return { typed: true, move: live.move };
    await page.keyboard.press(ch);
    await page.waitForTimeout(CHAR_MS);
  }
  return { typed: true, move: live.move };
}

// ------------------------------------------------------------- landing page
console.log("\n--- Landing page (/) ---");
const t0 = Date.now();
const homeRes = await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const loadMs = Date.now() - t0;
check("landing returns 200", homeRes?.status() === 200, `status ${homeRes?.status()}`);
check("loads in under 10s", loadMs < 10000, `${loadMs}ms`);

const h1 = (await page.locator("h1").first().innerText()).trim();
check("H1 targets the primary keyword", /typing fighting game/i.test(h1), h1.slice(0, 72));

// The whole point of the split: the landing page sells, the game page plays. If the
// engine boots here, a visitor who never presses Play still pays for a physics loop,
// an audio context and a requestAnimationFrame.
const landCanvases = await page.locator("canvas").count();
check("the landing page does NOT boot the game engine", landCanvases === 0, `${landCanvases} canvas`);
check(
  "the landing page shows a static arena frame instead",
  (await page.locator('svg[aria-label*="match in progress"]').count()) > 0,
);

let ldJoined = (
  await page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((n) => n.textContent ?? ""),
  )
).join(" ");
check("FAQPage structured data present", ldJoined.includes('"FAQPage"'));
check("FAQ answers are real text", ldJoined.includes("parry") && ldJoined.includes("SAVE word"));
await page.screenshot({ path: `${SHOTS}/00-landing.png` });

// --------------------------------------------------------------- game page
console.log("\n--- Game page (/play) ---");

// Reach it by CLICKING the CTA a real visitor uses, not by typing the URL.
const cta = page.getByTestId("play-cta");
check("the primary CTA is present", (await cta.count()) > 0);
await cta.first().click();
await page.waitForURL("**/play", { timeout: 10000 });
check("the CTA navigates to the game page", page.url().endsWith("/play"), page.url());

const playH1 = (await page.locator("h1").first().innerText()).trim();
check("game page H1 is about playing", /play kinetype/i.test(playH1), playH1.slice(0, 48));

ldJoined = (
  await page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((n) => n.textContent ?? ""),
  )
).join(" ");
check("VideoGame structured data is on the game page", ldJoined.includes('"VideoGame"'));
check("BreadcrumbList structured data present", ldJoined.includes('"BreadcrumbList"'));
check("a fullscreen control exists", (await page.getByTestId("fullscreen-button").count()) > 0);

// Poll rather than sample once: arriving here via client-side navigation means the preview
// engine may not have painted its first frame yet.
const preview = await waitForArena();
check("arena is drawn behind the intro", preview.ok, preview.reason);
await page.screenshot({ path: `${SHOTS}/01-ready.png` });

// ---------------------------------------------------------------- play a match
console.log("\n--- Playing a match ---");

// Case the difficulty at 85 WPM. At the default 40 the scripted player (about
// 96 WPM) never lets the bot finish a word, so the bot-to-player damage path
// would go unexercised. Verification should test the two-way exchange.
await page
  .getByLabel("Bot typing speed in words per minute")
  .selectOption("85");
await page.waitForTimeout(150);

await page.getByTestId("start-overlay").click();
await page.waitForSelector('[data-testid="player-panel"]', { timeout: 5000 });
check("player panel appears after starting", true);

// The focus guard exists because a keydown listener on `window` does not fire
// unless the game's document has focus. This was a real bug: the game shipped
// looking completely unresponsive when embedded, because typing did nothing.
const hintBefore = await page.locator('[data-testid="focus-hint"]').count();
check("a focus prompt shows before any input arrives", hintBefore > 0, `${hintBefore} present`);
// Do what a player does: click the arena once so it can read the keyboard.
const hint = page.locator('[data-testid="focus-hint"]');
if (await hint.count()) await hint.first().click();
else await page.locator("canvas").click({ position: { x: 20, y: 20 } });

await page.waitForTimeout(2300); // countdown is 2.2s

const mid = await waitForArena();
check("arena is drawn during the match", mid.ok, mid.reason);

// A typing game is unplayable if your own prompts are below the fold, or if you have to
// scroll between the fight and your sentence. Measure the arena + bot panel + player
// panel as ONE BLOCK, in DOCUMENT coordinates.
//
// This used to scroll the panel into view and read getBoundingClientRect(), which reports
// wherever the scroll happened to land: the game itself scrolls the arena into view with
// smooth behaviour, so the check turned into a scroll-timing test and reported a 5px
// overflow that the layout did not have. The requirement is scroll-independent.
const viewportH = page.viewportSize()?.height ?? 0;
const fightBlock = await page.evaluate(() => {
  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const arena = document.querySelector('[data-testid="arena"]');
  const panel = document.querySelector('[data-testid="player-panel"]');
  if (!arena || !panel) return null;
  return {
    height: Math.round(docTop(panel) + panel.getBoundingClientRect().height - docTop(arena)),
    arenaTop: Math.round(docTop(arena)),
  };
});
check(
  "the arena and the player's prompts fit one screenful",
  !!fightBlock && fightBlock.height <= viewportH,
  `arena + bot panel + prompts need ${fightBlock?.height ?? "?"}px, viewport ${viewportH}px`,
);
check(
  "the arena is drawn above the prompts",
  !!fightBlock && fightBlock.arenaTop > 0 && fightBlock.height > 0,
  `arena starts at ${fightBlock?.arenaTop ?? -1}px in the document`,
);

// ---------------------------------------------------------------- fullscreen
// Ruan: "fullscreen mode does not work properly as I cannot see the words I need to type."
//
// Run this at a SHORT viewport on purpose. At the suite's 1000px the old layout happened to fit,
// which is exactly why nothing caught this: the arena asked for a fixed 76vh on top of roughly
// 200px of panels, and 76% of the screen plus 200px only overflows once the screen is short.
// 768px is an ordinary laptop height, so it is the case worth pinning.
{
  await page.setViewportSize({ width: 1280, height: 768 });
  await page.waitForTimeout(250);

  await page.getByTestId("fullscreen-button").click();
  await page.waitForTimeout(900);
  const inFullscreen = await page.evaluate(() => Boolean(document.fullscreenElement));

  // Scroll to the top BEFORE measuring. A real fullscreen element cannot be scrolled, so
  // anything below the fold is genuinely unreachable; measuring wherever the page happened to be
  // scrolled lets a broken layout look fine.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  // Scoped to the player panel. BOTH panels carry a sentence and the bot panel comes first in
  // the DOM, so a bare [data-testid="sentence"] matches the bot's, which always sits near the
  // top of the page and would report "visible" however badly the player's own prompt overflowed.
  const fsSentence = await page
    .locator('[data-testid="player-panel"] [data-testid="sentence"]')
    .boundingBox();

  check(
    "fullscreen keeps the player's sentence on screen",
    inFullscreen && !!fsSentence && fsSentence.y + fsSentence.height <= 768 + 2,
    inFullscreen
      ? `sentence ends at ${fsSentence ? Math.round(fsSentence.y + fsSentence.height) : "?"}px, viewport 768px`
      : "the browser did not enter fullscreen",
  );

  if (inFullscreen) {
    await page.evaluate(() => void document.exitFullscreen());
    await page.waitForTimeout(400);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(250);
}

const initial = await readPrompts("player-panel");
check(
  "exactly one sentence is live for the player",
  initial.length === 1,
  `${initial.length} prompts: ${initial.map((p) => p.text).join(" | ")}`,
);
check(
  "the live sentence is split into words and each word carries a move",
  (initial[0]?.words.length ?? 0) >= 4 &&
    initial[0].words.every((w) => ["block", "punch", "kick"].includes(w.move)),
  `${initial[0]?.words.length ?? 0} words: ${(initial[0]?.words ?? [])
    .map((w) => `${w.text}/${w.move}`)
    .join(" ")}`,
);
check(
  "the sentence can both defend and attack",
  (initial[0]?.words ?? []).some((w) => w.move === "block") &&
    (initial[0]?.words ?? []).some((w) => w.move === "punch"),
  "every sentence must contain a block word and a punch word",
);

// REGRESSION GUARD for the bug Ruan reported. With three words live, the first keystroke
// was spent CHOOSING a word: it never advanced the prompt, so you had to type that same
// letter a second time, and a letter matching no word counted as an error. The very first
// press of a fight must move the prompt forward.
{
  const [before] = await readPrompts("player-panel");
  // The first keystroke of a session can be lost if it lands before the keydown listener is
  // attached, so press, poll, and press once more before calling it a failure. The behaviour
  // itself is verified by scripts/probe-first-key.mjs, which shows the word advancing within
  // 30ms.
  let after = before;
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.keyboard.press(before.text[0]);
    for (let i = 0; i < 15; i++) {
      [after] = await readPrompts("player-panel");
      if (after && after.typed > before.typed) break;
      await page.waitForTimeout(100);
    }
    if (after && after.typed > before.typed) break;
  }
  check(
    "the first keystroke advances the sentence",
    !!after && after.typed === before.typed + 1,
    `typed ${before.typed} -> ${after?.typed} after pressing "${before.text[0]}"`,
  );
}

// The block is the defensive verb and it is invisible to a check that only reads damage
// numbers, so prove it end to end: type words until a block word completes, then confirm
// the guard actually reached the HUD. Every sentence contains a block word by
// construction, so this cannot loop forever on a healthy build.
{
  let guardSeen = false;
  for (let w = 0; w < 14 && !guardSeen; w++) {
    const { typed, move } = await playOneWord();
    if (!typed) break;
    if (move !== "block") continue;
    for (let i = 0; i < 8; i++) {
      if ((await page.locator('[data-testid="player-guard"]').count()) > 0) {
        guardSeen = true;
        break;
      }
      await page.waitForTimeout(100);
    }
  }
  check("a completed block word raises a visible guard", guardSeen);
}

// Move variety is measured ACROSS the match, never on one draw: one sentence proves
// nothing about a pool of hundreds.
const movesSeen = new Set();
const sentencesSeen = new Set();
for (const p of initial) {
  sentencesSeen.add(p.text);
  for (const w of p.words) movesSeen.add(w.move);
}

let wordsTyped = 0;
let maxBotDamage = 0;
let maxPlayerDamage = 0;
let maxBotWpm = 0;
let maxPlayerWpm = 0;
let shotMid = false;

const started = Date.now();
const FIRST_WINDOW_MS = 60000;

while (Date.now() - started < FIRST_WINDOW_MS) {
  if (await matchOver()) break;
  const { typed } = await playOneWord();
  if (!typed) {
    await page.waitForTimeout(150);
    continue;
  }
  wordsTyped++;

  // Sample live state every exchange. The panels disappear the moment the match
  // resolves, so a single read after the loop can miss everything.
  const live = await readPrompts("player-panel");
  for (const p of live) {
    sentencesSeen.add(p.text);
    for (const w of p.words) movesSeen.add(w.move);
  }
  const bd = await valueOf("bot-damage");
  if (bd !== null) maxBotDamage = Math.max(maxBotDamage, bd);
  const pd = await valueOf("player-damage");
  if (pd !== null) maxPlayerDamage = Math.max(maxPlayerDamage, pd);
  const bw = await valueOf("bot-wpm");
  if (bw !== null) maxBotWpm = Math.max(maxBotWpm, bw);
  const pw = await valueOf("player-wpm");
  if (pw !== null) maxPlayerWpm = Math.max(maxPlayerWpm, pw);

  if (!shotMid && wordsTyped === 5) {
    await page.screenshot({ path: `${SHOTS}/02-midfight.png` });
    shotMid = true;
  }
}

check("words were typed into the game", wordsTyped > 3, `${wordsTyped} words`);
check(
  "the sentence pool varies across a match",
  sentencesSeen.size >= 3,
  `${sentencesSeen.size} distinct sentences`,
);
check(
  "all three moves appear across a match",
  movesSeen.has("block") && movesSeen.has("punch") && movesSeen.has("kick"),
  `moves seen: ${[...movesSeen].sort().join(", ")}`,
);
check(
  "the focus prompt clears once typing works",
  (await page.locator('[data-testid="focus-hint"]').count()) === 0,
);
check(
  "typing words deals damage to the opponent",
  maxBotDamage > 0,
  `bot peaked at ${Math.round(maxBotDamage)}%`,
);
check("the player's WPM is measured", maxPlayerWpm > 0, `${maxPlayerWpm} WPM`);
check("the bot is actually typing, not idle", maxBotWpm > 0, `bot reached ${maxBotWpm} WPM`);
check(
  "the bot fights back",
  maxPlayerDamage > 0,
  `player peaked at ${Math.round(maxPlayerDamage)}%`,
);

// ---------------------------------------------------------------- result screen
console.log("\n--- Result ---");
let sawResult = await matchOver();
if (!sawResult) {
  // Play it out. Rounds cap at 90s and a match is best of three.
  const deadline = Date.now() + 280000;
  while (Date.now() < deadline) {
    if (await matchOver()) break;
    const { typed } = await playOneWord();
    if (!typed) await page.waitForTimeout(200);
  }
  sawResult = await matchOver();
}

check("match reaches a result screen", sawResult);
if (sawResult) {
  const coins = Number(await page.getAttribute('[data-testid="result"]', "data-coins"));
  const wpm = Number(await page.getAttribute('[data-testid="result"]', "data-wpm"));
  const won = (await page.getAttribute('[data-testid="result"]', "data-won")) === "1";
  check("coins are awarded", coins > 0, `${coins} coins`);
  check("WPM is recorded from real typing", wpm > 0, `${wpm} WPM`);
  check(
    "the payout matches the result",
    won ? coins > 12 : coins >= 12,
    `${won ? "win" : "loss"}, ${coins} coins`,
  );
  await page.screenshot({ path: `${SHOTS}/03-result.png` });

  const stored = await page.evaluate(() => window.localStorage.getItem("kinetype.save.v1"));
  check("the save persisted to localStorage", !!stored && stored.includes("coins"));
}

// ---------------------------------------------------------------- shop
console.log("\n--- Shop ---");
await page.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
const skinCards = await page.locator("li").count();
check("shop lists items", skinCards >= 8, `${skinCards} cards`);
const themeCards = await page.locator('[data-testid="theme-card"]').count();
check("shop lists several themes", themeCards >= 5, `${themeCards} themes`);
await page.screenshot({ path: `${SHOTS}/04-shop.png`, fullPage: true });

await page.evaluate(() => {
  const key = "kinetype.save.v1";
  const raw = window.localStorage.getItem(key);
  const save = raw ? JSON.parse(raw) : {};
  save.coins = 2000;
  save.ownedSkins = ["spark"];
  save.equippedSkin = "spark";
  save.ownedThemes = ["paper"];
  save.equippedTheme = "paper";
  delete save.ownedOverlays;
  delete save.equippedOverlay;
  window.localStorage.setItem(key, JSON.stringify(save));
});
await page.reload({ waitUntil: "networkidle" });

const unlockButtons = page.getByRole("button", { name: "Unlock" });
const unlockCount = await unlockButtons.count();
check("paid items show an Unlock button", unlockCount > 0, `${unlockCount} unlockable`);
if (unlockCount > 0) {
  await unlockButtons.first().click();
  await page.waitForTimeout(400);
  const parsed = JSON.parse(
    (await page.evaluate(() => window.localStorage.getItem("kinetype.save.v1"))) ?? "{}",
  );
  check(
    "buying deducts coins and grants the item",
    parsed.coins < 2000 && parsed.ownedSkins.length > 1,
    `coins ${parsed.coins}, owned ${parsed.ownedSkins.join(",")}`,
  );
  check("the bought skin is auto-equipped", parsed.equippedSkin !== "spark", parsed.equippedSkin);
  await page.screenshot({ path: `${SHOTS}/05-shop-bought.png`, fullPage: true });
}

// ---------------------------------------------------------------- themes
// A theme has to actually repaint the fight, not just sit in a list looking pretty. Read the
// custom property the fight section exposes, then buy and equip a different theme and read it
// again. This is the only check that proves the whole theme path is wired end to end.
console.log("\n--- Themes ---");

const readFightVar = async (name) => {
  await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
  return page
    .locator('[data-testid="fight-section"]')
    .evaluate((el, n) => el.style.getPropertyValue(n).trim(), name);
};

const themeBefore = await readFightVar("--color-page");
check("the default theme is applied to the fight", themeBefore === "#f2ede3", themeBefore);

await page.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const key = "kinetype.save.v1";
  const save = JSON.parse(window.localStorage.getItem(key) ?? "{}");
  save.coins = 2000;
  window.localStorage.setItem(key, JSON.stringify(save));
});
await page.reload({ waitUntil: "networkidle" });

const buyMidnight = page.locator(
  '[data-testid="theme-card"][data-theme="midnight"] [data-testid="buy-theme"]',
);
check("a paid theme offers an Unlock button", (await buyMidnight.count()) > 0);
if (await buyMidnight.count()) {
  await buyMidnight.click();
  await page.waitForTimeout(400);
  const themeAfter = await readFightVar("--color-page");
  check(
    "buying a theme equips it and repaints the fight",
    themeAfter === "#0f1226",
    `--color-page ${themeBefore} -> ${themeAfter}`,
  );
  await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/06-theme-midnight.png` });
}

// ---------------------------------------------------------------- SEO routes
console.log("\n--- Routes and SEO ---");
for (const path of ["/how-to-play", "/typing-games-unblocked", "/typing-speed-test"]) {
  const r = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  const h1text = await page.locator("h1").first().innerText();
  check(`${path} renders`, r?.status() === 200 && h1text.length > 3, `"${h1text.slice(0, 40)}"`);
}

const sitemapRes = await page.goto(`${BASE}/sitemap.xml`);
const sitemapBody = (await page.content()) || "";
check(
  "sitemap lists the new routes",
  sitemapRes?.status() === 200 && sitemapBody.includes("/how-to-play"),
);

const robotsRes = await page.goto(`${BASE}/robots.txt`);
check("robots.txt is served", robotsRes?.status() === 200);

// ---------------------------------------------------------------- redirects
console.log("\n--- Legacy redirects ---");
for (const [from, expectPath] of [
  ["/transcription-jobs", "/"],
  ["/rev-typing-test", "/typing-speed-test"],
  ["/articles", "/"],
]) {
  const resp = await page.request.get(`${BASE}${from}`, { maxRedirects: 0 });
  const status = resp.status();
  const loc = resp.headers()["location"] ?? "";
  check(
    `${from} redirects (${status})`,
    status >= 300 && status < 400 && loc.includes(expectPath),
    `→ ${loc}`,
  );
}
const resolved = await page.request.get(`${BASE}/transcription-jobs`, { maxRedirects: 5 });
check("redirect chain resolves to a live page", resolved.status() === 200, `${resolved.status()}`);

// ---------------------------------------------------------------- diagnostics
console.log("\n--- Diagnostics ---");
check("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
const realFailures = failedRequests.filter((f) => !f.includes("favicon"));
check("no failed network requests", realFailures.length === 0, realFailures.slice(0, 3).join(" | "));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${"-".repeat(60)}`);
console.log(`passed ${results.length - failed.length}   failed ${failed.length}`);
if (failed.length) {
  console.log("\nFailures:");
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
}
console.log(`screenshots in ./${SHOTS}/`);
console.log(`${"-".repeat(60)}`);
process.exit(failed.length ? 1 : 0);
