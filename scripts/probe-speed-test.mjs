// Functional verification of /typing-speed-test.
//
// Static HTML checks cannot prove a typing test works: the WPM figure, the accuracy rule and
// the result panel are all client behaviour. This drives a real browser and asserts the numbers.
//
// Usage: node scripts/probe-speed-test.mjs http://localhost:3000
// Exits non-zero on any failure.
import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const fails = [];
const pass = [];
const check = (cond, msg) => (cond ? pass.push(msg) : fails.push(msg));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/typing-speed-test`, { waitUntil: "networkidle" });

const passage = async () => ((await page.locator("[data-test-passage]").textContent()) || "").replace(/\u00a0/g, " ");
const num = async (sel) => {
  const t = (await page.locator(sel).first().textContent()) || "";
  const m = t.match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
};

// 1. the test page must not boot the game engine (the / rule)
check((await page.locator("canvas").count()) === 0, "no canvas on the test page");

const input = page.locator("#speedtest-input");
check((await input.count()) === 1, "one typing input present");

const first = await passage();
check(first.length > 10, `passage renders (${first.length} chars)`);

// 2. typing a sentence correctly produces a live, non-zero WPM
await input.click();
await input.type(first, { delay: 0 });
await page.waitForTimeout(200);

const wpm1 = await num("[data-test-wpm]");
check(Number.isFinite(wpm1) && wpm1 > 0, `live wpm is non-zero after typing (${wpm1})`);

const second = await passage();
check(second !== first, "passage advances to the next sentence on completion");

// 3. a wrong character must lower accuracy, and backspacing must not refund it
const wrong = second[0] === "z" ? "q" : "z";
await input.type(wrong, { delay: 0 });
await page.waitForTimeout(200);
const accWrong = await num("[data-test-accuracy]");
check(accWrong < 100, `wrong character lowers accuracy (${accWrong}%)`);

await input.press("Backspace");
await page.waitForTimeout(200);
const accAfterFix = await num("[data-test-accuracy]");
check(accAfterFix < 100, `accuracy is not refunded by backspacing (${accAfterFix}%)`);

// 4. a full timed run reaches the result panel with real figures
await page.getByRole("button", { name: "15s", exact: true }).click();
await page.waitForTimeout(250);
await input.click();

const deadline = Date.now() + 17000;
while (Date.now() < deadline) {
  const t = await passage();
  if (!t) break;
  try {
    await input.type(t, { delay: 0 });
  } catch {
    break; // the input is torn down the moment the run ends
  }
}

await page.waitForSelector("[data-test-result]", { timeout: 10000 });
const resultText = (await page.locator("[data-test-result]").innerText()).replace(/\s+/g, " ");
const finalWpm = resultText.match(/^(\d+) wpm/);
const finalWpmNum = finalWpm ? parseInt(finalWpm[1], 10) : NaN;
check(Number.isFinite(finalWpmNum) && finalWpmNum > 0, `result panel shows a WPM figure (${finalWpmNum})`);
check(/accuracy \d+%/i.test(resultText), "result panel reports accuracy");
check(/try again/i.test(resultText), "result panel offers a restart");
// The band text depends on the figure, and this probe types far faster than a human, so
// assert the band that MATCHES the measured speed rather than one fixed string.
const bandOk =
  finalWpmNum <= 52
    ? /general adult range/i.test(resultText)
    : finalWpmNum <= 90
      ? /above the general adult range/i.test(resultText)
      : /enthusiast/i.test(resultText);
check(bandOk, `result panel states the band matching the measured speed (${finalWpmNum} wpm)`);

// 5. restart returns to a live test
await page.getByRole("button", { name: /try again/i }).click();
await page.waitForTimeout(250);
check((await page.locator("#speedtest-input").count()) === 1, "restart returns to a typing input");
check((await num("[data-test-wpm]")) === 0, "restart resets the live wpm to 0");

await browser.close();

console.log("PASS:");
for (const p of pass) console.log("  ok  ", p);
console.log();
if (fails.length) {
  console.log(`FAILURES (${fails.length}):`);
  for (const f of fails) console.log("  !!", f);
  process.exit(1);
}
console.log("SPEED TEST VERIFIED IN A REAL BROWSER");
