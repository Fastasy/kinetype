// Verifies the arena/theme split in a real browser:
//   1. each boss fights in ITS OWN arena (sampled from real canvas pixels, not from the source),
//   2. free play uses the default arena,
//   3. an equipped theme repaints the WHOLE SITE, not just the fight,
//   4. a theme can NOT move the semantic signal colours (a price must still read as a price).
//
// Run under tsx, like probe-coins.ts, because it compares the canvas against the REAL map data.
// Everything lives inside main() because this repo has no `"type": "module"`, so tsx compiles .ts
// to CommonJS — where top-level await is a transform error, not a runtime one.
//
//   npx next dev            # in another terminal
//   npx tsx scripts/probe-arenas.ts [baseUrl]
//
// Self-contained: creates its own throwaway account and deletes it again.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

import { MAPS, mapById } from "../game/maps";
import { SIGNALS_DARK, SIGNALS_LIGHT } from "../game/themes";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL_ = creds.project_url;
const ANON = creds.anon_key;
const SVC = creds.service_role_key;
const EMAIL = "kt-arena@example.com";
const PASSWORD = "kt-arena-test-9f3a";
const OUT = "verification";
/** Must match STORAGE_KEY in game/constants.ts. */
const SAVE_KEY = "kinetype.save.v1";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
};

async function rpc(name: string, body: unknown, token = ANON) {
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

async function adminUsers(path: string, init: RequestInit = {}) {
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

async function resetFixture(): Promise<void> {
  const list = await adminUsers("?per_page=200").then((r) => r.json());
  for (const u of (list.users ?? []).filter((x: { email: string }) => x.email === EMAIL)) {
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

/** The rgb() string Chromium reports for a hex, so the two can be compared. */
function rgb(hex: string): string {
  const h = hex.replace("#", "");
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
}

/**
 * Make every `page.evaluate` callback safe under tsx.
 *
 * esbuild rewrites named functions to call a `__name(fn, "fn")` helper, and Playwright SERIALISES
 * the callback into the page — where that helper does not exist, so every evaluate dies with
 * `ReferenceError: __name is not defined`. It only exists to set a function's `.name` for
 * debugging, so a no-op shim is enough. Without this the whole probe fails on the first sample,
 * and it would fail identically in any other tsx-run browser probe.
 */
async function shimEsbuildNames(target: BrowserContext): Promise<void> {
  await target.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__name = w.__name ?? ((fn: unknown) => fn);
  });
}

/**
 * Count how many canvas pixels match each candidate colour EXACTLY.
 *
 * The sky is painted with a plain `fillRect` per band, so its pixels are exact — no interpolation
 * to allow for, unlike the tiled grass, which the renderer shades per tile. That makes this a
 * precise test rather than a fuzzy one, and it needs no knowledge of where the stage sits inside
 * the canvas: DPR scaling and letterbox offsets do not matter if we COUNT rather than sample a
 * fixed point.
 */
async function tallyCanvas(page: Page, colours: string[]): Promise<Record<string, number> | null> {
  for (let attempt = 0; attempt < 40; attempt++) {
    // Poll rather than sleep: a canvas resize CLEARS it until the next frame, so sampling too early
    // reads a blank backing store and looks like the wrong arena.
    const tally = await page.evaluate((list: string[]) => {
      const c = document.querySelector("canvas");
      const context = c?.getContext("2d");
      if (!c || !context) return null;
      const { data } = context.getImageData(0, 0, c.width, c.height);
      const hex = (v: number) => v.toString(16).padStart(2, "0");
      const wanted = new Set(list);
      const counts: Record<string, number> = Object.fromEntries(list.map((k) => [k, 0]));
      for (let i = 0; i < data.length; i += 4) {
        const h = `#${hex(data[i])}${hex(data[i + 1])}${hex(data[i + 2])}`;
        if (wanted.has(h)) counts[h] += 1;
      }
      return counts;
    }, colours);
    const total = tally ? Object.values(tally).reduce((a, b) => a + b, 0) : 0;
    if (total > 500) return tally;
    await page.waitForTimeout(250);
  }
  return null;
}

const readTokens = (page: Page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      page: cs.getPropertyValue("--color-page").trim(),
      ink: cs.getPropertyValue("--color-ink").trim(),
      coin: cs.getPropertyValue("--color-coin").trim(),
      heat: cs.getPropertyValue("--color-heat").trim(),
      aqua: cs.getPropertyValue("--color-aqua").trim(),
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });

async function main(): Promise<void> {
  await resetFixture();
  const session = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  if (!session.access_token) throw new Error("could not sign in the throwaway fixture");

  // One free-play win reaches level 2, which unlocks `bandit` — so BOTH bosses compared below are
  // enterable, and a locked-boss gate can never masquerade as a missing canvas.
  await rpc(
    "submit_match",
    { p_mode: "free", p_boss_id: null, p_bot_wpm: 40, p_won: true, p_wpm: 60, p_accuracy: 95, p_best_combo: 6, p_rounds_won: 2, p_rounds_lost: 0, p_streak: 2 },
    session.access_token,
  );

  const browser = await chromium.launch();

  // ========================================================= 1. the arena each fight is in
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await shimEsbuildNames(ctx);
  await ctx.addInitScript((s) => window.localStorage.setItem("kinetype-auth", s as string), JSON.stringify(session));
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const SKY_TOPS = MAPS.map((m) => m.sky[0]);
  const arenas = [
    { label: "free play", url: "/play", expect: mapById("training-ground") },
    { label: "boss tick", url: "/play?boss=tick", expect: mapById("dewfield") },
    { label: "boss bandit", url: "/play?boss=bandit", expect: mapById("rust-canyon") },
  ];

  const seen: Record<string, string> = {};
  for (const a of arenas) {
    await page.goto(`${BASE}${a.url}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 30000 });
    const tally = await tallyCanvas(page, SKY_TOPS);
    const mine = tally?.[a.expect.sky[0]] ?? 0;
    const othersTotal = tally
      ? Object.entries(tally).filter(([c]) => c !== a.expect.sky[0]).reduce((sum, [, n]) => sum + n, 0)
      : 0;
    check(`${a.label} draws the "${a.expect.name}" sky`, mine > 500, `${mine} px of ${a.expect.sky[0]}`);
    check(`${a.label} draws no other arena's sky`, othersTotal === 0, `${othersTotal} px belonging to other maps`);
    seen[a.label] = a.expect.sky[0];
    // The idle state covers the arena with the intro panel, so a screenshot here would show the
    // intro rather than the world (which is exactly how a correct arena once looked broken). Start
    // the fight and grab the countdown, where the arena is unobstructed.
    await page
      .locator('button:has-text("Start the fight")')
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/arena-${a.label.replace(/\s+/g, "-")}.png` });
  }
  check(
    "the three arenas are genuinely different places",
    new Set(Object.values(seen)).size === Object.keys(seen).length,
    Object.entries(seen).map(([k, v]) => `${k}=${v}`).join("  "),
  );

  // ================================================ 2. a theme repaints the WHOLE SITE
  // Signed OUT, so nothing mirrors over this local choice: it is a guest's own theme, and the page
  // under test has no arena on it at all — which is the whole point.
  const guest = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await shimEsbuildNames(guest);
  const guestPage = await guest.newPage();

  await guestPage.goto(`${BASE}/leaderboard`, { waitUntil: "domcontentloaded" });
  await guestPage.waitForSelector("table", { timeout: 30000 });
  const before = await readTokens(guestPage);
  check("the default site uses the shipped Paper palette", before.page === "#f2ede3", before.page);
  check("the default page background is the Paper background", before.bodyBg === rgb("#f2ede3"), before.bodyBg);
  const signalBefore = { coin: before.coin, heat: before.heat, aqua: before.aqua };

  await guestPage.evaluate(
    (arg: { key: string; value: string }) => window.localStorage.setItem(arg.key, arg.value),
    { key: SAVE_KEY, value: JSON.stringify({ version: 1, equippedTheme: "midnight" }) },
  );
  await guestPage.reload({ waitUntil: "domcontentloaded" });
  await guestPage.waitForSelector("table", { timeout: 30000 });
  await guestPage
    .waitForFunction(() => getComputedStyle(document.body).backgroundColor !== "rgb(242, 237, 227)", null, { timeout: 20000 })
    .catch(() => {});

  const after = await readTokens(guestPage);
  check("an equipped theme reaches the LEADERBOARD, which has no arena on it", after.page === "#0f1226", after.page);
  check("...and repaints the page background itself", after.bodyBg === rgb("#0f1226"), after.bodyBg);
  check("...and the text colour follows it", after.ink === "#eef1ff", after.ink);
  check(
    "a dark theme swaps in the dark signal palette, so a price stays readable",
    after.coin === SIGNALS_DARK.coin && after.heat === SIGNALS_DARK.heat && after.aqua === SIGNALS_DARK.aqua,
    `coin ${after.coin}, heat ${after.heat}, aqua ${after.aqua}`,
  );
  check(
    "...while the light themes keep the site defaults",
    signalBefore.coin === SIGNALS_LIGHT.coin && signalBefore.heat === SIGNALS_LIGHT.heat,
    `coin ${signalBefore.coin}, heat ${signalBefore.heat}`,
  );
  await guestPage.screenshot({ path: `${OUT}/site-theme-leaderboard.png`, fullPage: true });

  await guestPage.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded" });
  await guestPage.waitForSelector('[data-testid="theme-swatch"]', { timeout: 30000 });
  const shopText = (await guestPage.textContent("main")) ?? "";
  check("the shop sells WEBSITE themes", /Website themes/.test(shopText));
  check("the shop no longer claims a theme repaints the fight", !/repaints the whole fight/.test(shopText));
  const swatches = await guestPage.locator('[data-testid="theme-swatch"]').count();
  check("every theme renders a site preview swatch", swatches >= 6, `${swatches} swatches`);
  await guestPage.screenshot({ path: `${OUT}/shop-website-themes.png`, fullPage: true });

  // ------------------------------------------------------------------- tidy up
  await adminUsers(`/${session.user.id}`, { method: "DELETE" });
  await browser.close();

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
