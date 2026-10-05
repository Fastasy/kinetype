// Verifies the match -> server banking wiring, end to end, in a real browser.
//
// Plays an idle match as a signed-in player at the fastest bot speed: an idle player
// loses, but a LOSS still submits, so this exercises the exact code path a win takes.
// Asserts (a) the submit_match RPC actually fires, (b) the result panel shows the
// banked XP, and (c) the stored XP really went up.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.KT_BASE || "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

async function profileXp(token, uid) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=xp,matches&id=eq.${uid}`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Accept-Profile": "kinetype" },
  });
  const rows = await r.json();
  return rows[0];
}

const tr = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "kt-test@example.com", password: "Test-Pass-9f3a2b!" }),
});
const session = await tr.json();
const uid = session.user.id;
const before = await profileXp(session.access_token, uid);
console.log("before:", JSON.stringify(before));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript((s) => window.localStorage.setItem("kinetype-auth", s), JSON.stringify(session));
const page = await ctx.newPage();

let rpcCalls = 0;
let rpcBody = null;
page.on("request", (req) => {
  if (req.url().includes("/rest/v1/rpc/submit_match")) {
    rpcCalls++;
    rpcBody = req.postData();
  }
});

await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
await page.selectOption('select[aria-label="Bot typing speed in words per minute"]', "120");
await page.click('[data-testid="fight-button"]');
console.log("match started; playing idle at 120 WPM bot (a loss still banks)...");

await page.waitForSelector('[data-testid="result"]', { timeout: 260000 });
console.log("result panel appeared");

// The RPC firing is not the same as its response landing — wait for the DOM to update.
await page.waitForSelector('[data-testid="banked"]', { timeout: 20000 }).catch(() => {});
const bankedVisible = await page.locator('[data-testid="banked"]').count();
const bankedText = bankedVisible ? await page.textContent('[data-testid="banked"]') : "";
const after = await profileXp(session.access_token, uid);
console.log("rpc submit_match calls:", rpcCalls);
console.log("rpc payload:", rpcBody);
console.log("banked line:", JSON.stringify(bankedText));
console.log("after:", JSON.stringify(after));
await page.screenshot({ path: "verification/16-match-banked.png" });

await browser.close();

let fail = 0;
const check = (n, ok, extra = "") => { console.log(`${ok ? "  ok  " : "  FAIL"} ${n} ${extra}`); if (!ok) fail++; };
console.log("");
check("submit_match RPC fired from the UI", rpcCalls === 1, `(calls=${rpcCalls})`);
check("payload carries the match facts", /p_wpm/.test(rpcBody || "") && /p_mode/.test(rpcBody || ""));
check("banked XP line rendered", bankedVisible === 1 && /XP banked/.test(bankedText), `"${bankedText}"`);
check("stored XP increased", after.xp > before.xp, `(${before.xp} -> ${after.xp})`);
check("match counted", after.matches === before.matches + 1, `(${before.matches} -> ${after.matches})`);
process.exit(fail > 0 ? 1 : 0);
