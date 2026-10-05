// Verifies that the ACCOUNT owns the coin economy end to end in a real browser: the balance shown
// comes from the profile, a purchase goes through the server, it survives a reload, and signing out
// hands the browser's own separate guest wallet back.
//
//   node scripts/seed-test-user.mjs
//   npx next dev            # in another terminal
//   node scripts/probe-shop.mjs [baseUrl]
//
// The session is injected into localStorage (`kinetype-auth`) rather than driven through Google, so
// the probe exercises the real RLS + RPC path without a consent screen. The item under test is
// DERIVED from the catalogue and the fixture's current ownership — a hardcoded id is "already owned"
// on the second run and reads as a broken shop.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL_ = creds.project_url;
const ANON = creds.anon_key;
const SVC = creds.service_role_key;
// This probe's OWN throwaway account. A fresh one is the only reliable baseline here: the probe
// BUYS things, so a shared fixture eventually owns the whole catalogue and "the cheapest unowned
// affordable theme" stops existing — a failure with nothing to do with the shop.
const EMAIL = "kt-shop@example.com";
const PASSWORD = "kt-shop-test-9f3a";
const OUT = "verification";

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
};

async function rpc(name, body, token = ANON) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Profile": "kinetype",
      "Content-Profile": "kinetype",
    },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  try { return { status: r.status, json: t ? JSON.parse(t) : null }; } catch { return { status: r.status, json: null }; }
}

// ------------------------------------------------------------------ sign in the fixture
async function adminUsers(path, init = {}) {
  return fetch(`${URL_}/auth/v1/admin/users${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/** Delete any leftovers from an interrupted run, then create the account fresh. */
async function resetFixture() {
  const list = await adminUsers("?per_page=200").then((r) => r.json());
  for (const u of (list.users ?? []).filter((x) => x.email === EMAIL)) {
    await adminUsers(`/${u.id}`, { method: "DELETE" });
  }
  const created = await adminUsers("", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  if (created.status >= 300) {
    const body = await created.text();
    if (!/already/i.test(body)) throw new Error(`could not create the fixture: HTTP ${created.status} ${body}`);
  }
}

await resetFixture();

const session = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
const token = session.access_token;
if (!token) {
  console.error("could not sign in the throwaway fixture");
  process.exit(1);
}

// Earn enough to buy something, server-side, so the shop has a real purchase to make.
for (let i = 0; i < 2; i++) {
  await rpc(
    "submit_match",
    { p_mode: "free", p_boss_id: null, p_bot_wpm: 40, p_won: true, p_wpm: 60, p_accuracy: 95, p_best_combo: 6, p_rounds_won: 2, p_rounds_lost: 0, p_streak: 2 },
    token,
  );
}

const catalog = (await rpc("cosmetic_catalog", {})).json;
const me = (await rpc("ensure_profile", {}, token)).json;
console.log(`fixture @${me.handle}: ${me.coins} coins, owns ${me.owned_skins.length} skins / ${me.owned_themes.length} themes`);
// A fresh account has no coins, so this is a real assertion about the award, not just a printout:
// two free-play wins at 141 each.
check("two won matches paid the account 282 coins", me.coins === 282, `${me.coins}`);

// The cheapest unowned THEME the balance can afford. A theme is chosen because its card carries a
// stable data-testid; a skin would work just as well.
const owned = new Set([
  ...me.owned_skins.map((id) => `skin:${id}`),
  ...me.owned_themes.map((id) => `theme:${id}`),
]);
const target = catalog
  .filter((c) => c.kind === "theme" && c.price > 0 && c.price <= me.coins && !owned.has(`theme:${c.id}`))
  .sort((a, b) => a.price - b.price)[0];
if (!target) {
  console.error("no affordable unowned theme to buy — re-seed the fixture");
  process.exit(1);
}
console.log(`will buy theme "${target.id}" for ${target.price}\n`);

const storedSession = {
  access_token: token,
  token_type: "bearer",
  expires_in: session.expires_in ?? 3600,
  expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  refresh_token: session.refresh_token,
  user: session.user,
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
await context.addInitScript(
  ({ key, value }) => window.localStorage.setItem(key, value),
  { key: "kinetype-auth", value: JSON.stringify(storedSession) },
);
const page = await context.newPage();
page.setDefaultTimeout(30000);

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(`pageerror: ${e.message}`));

const readBalance = async () => {
  const text = await page.textContent('[data-testid="shop-balance"]');
  return Number((text || "").replace(/[^0-9]/g, ""));
};

// ================================================ the account's balance is what the shop shows
await page.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="shop-balance"]', { timeout: 45000 });
await page.waitForFunction(
  (expected) => (document.querySelector('[data-testid="shop-balance"]')?.textContent || "").replace(/[^0-9]/g, "") === String(expected),
  me.coins,
  { timeout: 30000 },
);
check("the shop shows the ACCOUNT balance, not a local one", (await readBalance()) === me.coins, `${await readBalance()} vs ${me.coins}`);

const headerChip = await page.textContent('header [aria-label="Your coin balance"]');
check("the header coin chip agrees with the account", Number((headerChip || "").replace(/[^0-9]/g, "")) === me.coins, headerChip?.trim());

// ===================================================================== buying, for real
const card = `[data-testid="theme-card"][data-theme="${target.id}"]`;
check("the target theme is offered for sale", (await page.locator(`${card} [data-testid="buy-theme"]`).count()) === 1);

await page.click(`${card} [data-testid="buy-theme"]`);
await page.waitForSelector('[data-testid="theme-card"][data-theme="' + target.id + '"] >> text=Equipped', { timeout: 30000 });
check("the purchase reports the item as equipped", true);

const afterBuy = await rpc("ensure_profile", {}, token);
check("the server debited exactly the price", me.coins - afterBuy.json.coins === target.price, `${me.coins} -> ${afterBuy.json.coins}, price ${target.price}`);
check("the server granted the theme", afterBuy.json.owned_themes.includes(target.id));
check("the server recorded it as equipped", afterBuy.json.equipped_theme === target.id);

// The page must follow the SERVER, not its own arithmetic.
await page.waitForFunction(
  (expected) => (document.querySelector('[data-testid="shop-balance"]')?.textContent || "").replace(/[^0-9]/g, "") === String(expected),
  afterBuy.json.coins,
  { timeout: 20000 },
);
check("the shop's balance follows the server after buying", (await readBalance()) === afterBuy.json.coins, `${await readBalance()}`);

await page.screenshot({ path: `${OUT}/shop-after-buy.png`, fullPage: true });

// ------------------------------------------------------------------- survives a reload
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="theme-card"]', { timeout: 45000 });
await page.waitForFunction(
  (expected) => (document.querySelector('[data-testid="shop-balance"]')?.textContent || "").replace(/[^0-9]/g, "") === String(expected),
  afterBuy.json.coins,
  { timeout: 30000 },
);
check("the purchase survives a reload (it lives on the account)", (await page.locator(`${card} >> text=Equipped`).count()) > 0);
check("the balance survives a reload", (await readBalance()) === afterBuy.json.coins, `${await readBalance()}`);

// =========================================== signing out hands back the GUEST wallet
// The browser context started empty, so its own wallet is 0 coins. If the account's balance were
// simply left in the local store, it would still read the account's number here.
await page.click('button[title="Sign out"]');
await page.waitForSelector('header a[href="/settings"]', { state: "detached", timeout: 20000 }).catch(() => {});
await page.waitForFunction(
  () => (document.querySelector('[data-testid="shop-balance"]')?.textContent || "").replace(/[^0-9]/g, "") === "0",
  null,
  { timeout: 20000 },
);
check("signing out restores the separate guest wallet", (await readBalance()) === 0, `${await readBalance()} coins`);

const stillMine = await rpc("ensure_profile", {}, token);
check("…and the ACCOUNT keeps its balance", stillMine.json.coins === afterBuy.json.coins, `${stillMine.json.coins}`);
check("…and keeps the theme it bought", stillMine.json.owned_themes.includes(target.id));

if (pageErrors.length) console.log(`\npage errors:\n  ${pageErrors.join("\n  ")}`);

// Tidy up: a throwaway account must not sit on a live leaderboard.
await adminUsers(`/${session.user.id}`, { method: "DELETE" });

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
