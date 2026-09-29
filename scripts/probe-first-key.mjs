// Focused probe: does the FIRST keystroke advance the live word?
//
// The full verifier says the first press does nothing while later typing works. That is
// either a real swallowed-keystroke bug or a read-timing artefact. This prints the actual
// data-typed value after every press so the answer is not a guess.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHAR_MS = 120;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const prompt = async () => {
  const p = await page.$$eval('[data-testid="player-panel"] [data-testid="prompt"]', (nodes) =>
    nodes.map((n) => ({
      text: n.getAttribute("data-text"),
      typed: Number(n.getAttribute("data-typed")),
      kind: n.getAttribute("data-kind"),
    })),
  );
  return p[0] ?? null;
};

await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
await page.getByTestId("start-overlay").click();
await page.waitForSelector('[data-testid="player-panel"]', { timeout: 5000 });

// Clear the focus guard the way a player does.
const hint = page.locator('[data-testid="focus-hint"]');
if (await hint.count()) await hint.first().click();
await page.waitForTimeout(3200); // countdown

console.log("--- before any key ---");
let p = await prompt();
console.log(`  word="${p?.text}" typed=${p?.typed} kind=${p?.kind}`);

const first = p.text[0];
console.log(`\n--- pressing the FIRST letter "${first}" ---`);
await page.keyboard.press(first);
for (const wait of [30, 60, 120, 250, 500, 1000]) {
  await page.waitForTimeout(wait === 30 ? 30 : wait - 30);
  p = await prompt();
  console.log(`  +${String(wait).padStart(4)}ms  typed=${p?.typed}  word="${p?.text}"`);
}

console.log(`\n--- pressing "${first}" a SECOND time ---`);
await page.keyboard.press(first);
await page.waitForTimeout(250);
p = await prompt();
console.log(`  typed=${p?.typed}  word="${p?.text}"`);

console.log("\n--- pressing a letter that is definitely wrong (z, unless z is next) ---");
p = await prompt();
const want = p.text[p.typed];
const wrong = want === "z" ? "q" : "z";
await page.keyboard.press(wrong);
await page.waitForTimeout(250);
const after = await prompt();
console.log(`  expected "${want}", pressed "${wrong}" -> typed=${after.typed} flawed=${after.flawed}`);

console.log("\n--- typing the rest of the word out ---");
let safety = 0;
while (safety++ < 20) {
  p = await prompt();
  if (p.typed >= p.text.length) break;
  await page.keyboard.press(p.text[p.typed]);
  await page.waitForTimeout(CHAR_MS);
}
p = await prompt();
console.log(`  after finishing: word="${p?.text}" typed=${p?.typed} (a fresh word should be at 0)`);

console.log(`\nconsole/page errors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
