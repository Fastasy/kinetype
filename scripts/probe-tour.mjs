// Proves the first-visit tour: that it appears once, points at the right thing, stays on screen,
// navigates, and can be brought back deliberately.
//
// WHAT COULD GO WRONG HERE, and therefore what this asserts. A tour is the easiest feature in a
// codebase to ship broken, because a broken tour still looks like a working one: a callout 40px
// below the fold, an arrow pointing at nothing, a modal that reappears on every page load, a modal
// that never appears at all, or a tour that eats the keyboard of the game underneath it. Each of
// those gets a check below, and every check is written so it FAILS on a plausible wrong build —
// a check that cannot fail is not evidence.
//
// It runs against localhost and against production, with a FRESH context each time (no storage), so
// "first visit" means what it says.
//
//   node scripts/probe-tour.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || process.env.KT_BASE || "http://localhost:3000";
mkdirSync("verification", { recursive: true });

let fail = 0;
let total = 0;
const check = (name, ok, extra = "") => {
  total++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${extra ? ` ${extra}` : ""}`);
  if (!ok) fail++;
};

const TOUR = '[data-testid="tour"]';
const NEXT = '[data-testid="tour-next"]';
const SEEN_KEY = "kinetype:tour";

/** The expected walk, in order. The route changes once, on the step that enters the game. */
const WALK = [
  { id: "welcome", route: "/", centered: true },
  { id: "header", route: "/" },
  { id: "coins", route: "/" },
  { id: "play-cta", route: "/" },
  { id: "arena-teaser", route: "/" },
  { id: "fight-controls", route: "/play" },
  { id: "fight-arena", route: "/play" },
  { id: "quest-board", route: "/play" },
  { id: "outro", route: "/play", centered: true },
];

const browser = await chromium.launch();

async function fresh(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const noise = [];
  page.on("pageerror", (e) => noise.push(String(e)));
  page.on("console", (m) => {
    // "Failed to load resource" is the browser's stub for an HTTP failure and carries no URL. The
    // response listener below reports the same thing WITH the URL, and excludes the local PostHog
    // proxy — so this stub is dropped rather than counted twice and unfilterably.
    if (/Failed to load resource/i.test(m.text())) return;
    if (m.type() === "error" || /hydrat/i.test(m.text())) noise.push(m.text());
  });
  // A 4xx/5xx from OUR OWN server is a real failure and worth naming the URL for. PostHog is
  // excluded: the site proxies it through /ph, that proxy is not configured locally, and every
  // probe run against localhost 500s on it. Failing on that would be failing on the dev box.
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/ph/")) noise.push(`${r.status()} ${r.url()}`);
  });
  return { context, page, noise };
}

/** Everything the assertions need, read from the real DOM in one round trip. */
const geom = (page) =>
  page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const tour = document.querySelector('[data-testid="tour"]');
    if (!tour) return null;
    const targetKey = tour.dataset.target || "";
    return {
      step: tour.dataset.step || "",
      index: Number(tour.dataset.index || 0),
      placement: tour.dataset.placement || "",
      hasSpotlight: tour.dataset.spotlight === "1",
      card: rect(document.querySelector('[data-testid="tour-card"]')),
      arrow: rect(document.querySelector('[data-testid="tour-arrow"]')),
      spotlight: rect(document.querySelector('[data-testid="tour-spotlight"]')),
      target: targetKey ? rect(document.querySelector(`[data-tour="${targetKey}"]`)) : null,
      targetKey,
      title: document.querySelector('[data-testid="tour-title"]')?.textContent || "",
      body: document.querySelector('[data-testid="tour-body"]')?.textContent || "",
      position: document.querySelector('[data-testid="tour-position"]')?.textContent || "",
      overflow: getComputedStyle(document.body).overflow,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });

/** The geometric truth about one step: on screen, not covering its own target, arrow correct. */
function checkStep(label, g, { expectSpotlight = true } = {}) {
  if (!g) {
    check(`${label} is on screen`, false, "(no tour found)");
    return;
  }
  const where = `${label} (${g.step})`;
  check(`${where} is showing`, Boolean(g.card), `"${g.title}"`);
  check(
    `${where} draws real copy`,
    g.title.trim().length > 3 && g.body.trim().length > 30,
    `(${g.title.length} + ${g.body.length} chars)`,
  );
  const c = g.card;
  const insideX = c.left >= -1 && c.right <= g.viewport.width + 1;
  const insideY = c.top >= -1 && c.bottom <= g.viewport.height + 1;
  check(
    `${where} callout is fully on screen`,
    insideX && insideY,
    `card ${Math.round(c.left)},${Math.round(c.top)} ${Math.round(c.width)}x${Math.round(c.height)} in ${g.viewport.width}x${g.viewport.height}`,
  );

  if (!expectSpotlight) {
    check(`${where} is centred with no spotlight`, !g.hasSpotlight && !g.arrow && !g.spotlight);
    return;
  }
  check(`${where} spotlights its target`, g.hasSpotlight && Boolean(g.spotlight) && Boolean(g.target));
  if (!g.target) return;

  // The spotlight must BE the target, give or take the 4px inset it is drawn with.
  const sx = Math.abs(g.spotlight.left - (g.target.left - 4)) <= 2 && Math.abs(g.spotlight.top - (g.target.top - 4)) <= 2;
  const sw = Math.abs(g.spotlight.width - (g.target.width + 8)) <= 2;
  check(`${where} spotlight matches the element it points at`, sx && sw);

  // The callout must not sit on top of the thing it is explaining.
  const overlaps =
    c.left < g.target.right && c.right > g.target.left && c.top < g.target.bottom && c.bottom > g.target.top;
  // Whether a callout CAN be clear of the target is geometry, not a bug: the quest board and the
  // arena are taller than a phone screen, and a 360px-wide card cannot sidestep a full-width block.
  // So the strict assertion applies where there is room; where there is none the requirement is
  // that the visitor can still SEE the thing and that the callout pins itself to an edge rather
  // than floating in the middle of it.
  const room = {
    top: g.target.top - 24 >= c.height + 12,
    bottom: g.viewport.height - g.target.bottom >= c.height + 24,
    left: g.target.left - 24 >= c.width + 12,
    right: g.viewport.width - g.target.right >= c.width + 24,
  };
  if (room[g.placement]) {
    check(`${where} callout does not cover its target`, !overlaps);
    const sideOk =
      g.placement === "top"
        ? c.bottom <= g.target.top + 1
        : g.placement === "bottom"
          ? c.top >= g.target.bottom - 1
          : g.placement === "left"
            ? c.right <= g.target.left + 1
            : c.left >= g.target.right - 1;
    check(`${where} callout sits on its ${g.placement} side`, sideOk);
  } else {
    const visibleTarget =
      (Math.min(g.viewport.width, g.target.right) - Math.max(0, g.target.left)) *
      (Math.min(g.viewport.height, g.target.bottom) - Math.max(0, g.target.top));
    const covered =
      Math.max(0, Math.min(c.right, g.target.right) - Math.max(c.left, g.target.left)) *
      Math.max(0, Math.min(c.bottom, g.target.bottom) - Math.max(c.top, g.target.top));
    check(
      `${where} leaves the target visible (no side has room for the callout)`,
      covered < visibleTarget,
      `(covered ${Math.round(covered)} of ${Math.round(visibleTarget)}px²)`,
    );
    const pinned =
      c.top <= 16 || c.bottom >= g.viewport.height - 16 || c.left <= 16 || c.right >= g.viewport.width - 16;
    check(`${where} pins to a viewport edge when nothing fits`, pinned, `(card ${Math.round(c.left)},${Math.round(c.top)})`);
  }

  // The arrow has to actually point at the target, not merely exist.
  if (!g.arrow) {
    check(`${where} draws an arrow`, false);
    return;
  }
  const cx = g.arrow.left + g.arrow.width / 2;
  const cy = g.arrow.top + g.arrow.height / 2;
  // Aimed at the target's VISIBLE span, not its whole box: a block that runs off the bottom of the
  // screen has a centre below the fold, and an arrow pointing there points at nothing a visitor can
  // see. This is the assertion that caught the phone quest-board step.
  const visLeft = Math.max(0, g.target.left);
  const visRight = Math.min(g.viewport.width, g.target.right);
  const visTop = Math.max(0, g.target.top);
  const visBottom = Math.min(g.viewport.height, g.target.bottom);
  const aimOk =
    g.placement === "top" || g.placement === "bottom"
      ? cx >= visLeft - 24 && cx <= visRight + 24
      : cy >= visTop - 24 && cy <= visBottom + 24;
  check(
    `${where} arrow points at the visible part of the target`,
    aimOk,
    `(arrow ${Math.round(cx)},${Math.round(cy)}; visible ${Math.round(visLeft)},${Math.round(visTop)}-${Math.round(visRight)},${Math.round(visBottom)})`,
  );

  // …and it rides the callout edge FACING the target.
  const edgeOk =
    g.placement === "bottom"
      ? cy < c.top + 4
      : g.placement === "top"
        ? cy > c.bottom - 4
        : g.placement === "left"
          ? cx > c.right - 4
          : cx < c.left + 4;
  check(`${where} arrow rides the facing edge`, edgeOk);
}

async function advance(page, expected) {
  await page.click(NEXT);
  await page.waitForSelector(`[data-testid="tour"][data-step="${expected.id}"]`, { timeout: 10000 });
  // Let the spotlight follow the scroll before measuring.
  await page.waitForTimeout(220);
  return geom(page);
}

// ================================================== 1. a first visit, walked end to end
console.log("\n1. first visit, on the front door");
{
  const { context, page, noise } = await fresh();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(TOUR, { timeout: 15000 });
  await page.waitForTimeout(250);

  const first = await geom(page);
  check("the tour opens on the front door", first?.step === "welcome", `(step: ${first?.step})`);
  check("…as step 1 of 9", first?.position === "1", `(position: ${first?.position})`);
  checkStep("step 1", first, { expectSpotlight: false });
  check("the page cannot be scrolled out from under it", first?.overflow === "hidden", `(overflow: ${first?.overflow})`);
  await page.screenshot({ path: "verification/22-tour-welcome.png" });

  for (const expected of WALK.slice(1)) {
    const g = await advance(page, expected);
    checkStep(`step ${g?.position}`, g, { expectSpotlight: !expected.centered });
    if (expected.route !== "/") {
      check(`step ${g?.position} took the visitor into the game`, page.url().includes(expected.route), `(${page.url()})`);
    }
    if (expected.id === "fight-controls") await page.screenshot({ path: "verification/23-tour-play.png" });
  }

  check("the last step says DONE", (await page.locator(NEXT).innerText()).trim().toUpperCase() === "DONE");
  await page.screenshot({ path: "verification/24-tour-outro.png" });

  await page.click(NEXT);
  await page.waitForSelector(TOUR, { state: "detached", timeout: 5000 });
  check("finishing the tour closes it", (await page.locator(TOUR).count()) === 0);

  const stored = await page.evaluate((k) => window.localStorage.getItem(k), SEEN_KEY);
  check("…and records that this browser has seen it", Boolean(stored), `(${stored})`);

  const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  check("…and hands the page back, scrollable", overflow !== "hidden", `(overflow: ${overflow})`);

  // A visitor who has seen it must not be shown it again on the next page load.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  check("it does not open again on a return visit", (await page.locator(TOUR).count()) === 0);

  check("no page errors and no hydration warning", noise.length === 0, noise.slice(0, 3).join(" // "));
  await context.close();
}

// ================================================== 2. it can be asked for again
console.log("\n2. bringing it back deliberately");
{
  const { context, page, noise } = await fresh();
  await page.goto(`${BASE}/?tour=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(TOUR, { timeout: 15000 });
  const reopened = await geom(page);
  check("?tour=1 opens it for a returning visitor", reopened?.step === "welcome");

  await page.keyboard.press("Escape");
  await page.waitForSelector(TOUR, { state: "detached", timeout: 5000 });
  check("Escape closes it", (await page.locator(TOUR).count()) === 0);
  check("…and Escape does not navigate", page.url().endsWith("/?tour=1"), `(${page.url()})`);

  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="tour-replay"]', { timeout: 15000 });
  await page.click('[data-testid="tour-replay"]');
  await page.waitForSelector(TOUR, { timeout: 10000 });
  // The overlay appears before the router has landed on step 1's route, so wait for the navigation
  // rather than reading the URL in the same breath as the click. `waitForFunction` rather than
  // `waitForURL`: the tour navigates with the client-side router, which does not emit the
  // navigation event `waitForURL` is waiting on.
  await page.waitForFunction(() => window.location.pathname === "/", null, { timeout: 10000 });
  const replayed = await geom(page);
  check("Your account → Replay brings it back", replayed?.step === "welcome");
  check("…and takes the visitor to the first step's page", new URL(page.url()).pathname === "/", `(${page.url()})`);
  check("no page errors and no hydration warning", noise.length === 0, noise.slice(0, 3).join(" // "));
  await context.close();
}

// ================================================== 3. keyboard, and the game underneath
console.log("\n3. keyboard, and the fight must not eat it");
{
  const { context, page, noise } = await fresh();
  await page.goto(`${BASE}/?tour=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(TOUR, { timeout: 15000 });

  await page.keyboard.press("ArrowRight");
  await page.waitForSelector(`${TOUR}[data-step="header"]`, { timeout: 5000 });
  check("ArrowRight advances a step", true);
  await page.keyboard.press("ArrowLeft");
  await page.waitForSelector(`${TOUR}[data-step="welcome"]`, { timeout: 5000 });
  check("ArrowLeft goes back", true);
  check("Back is disabled on the first step", await page.locator('[data-testid="tour-back"]').isDisabled());

  await page.keyboard.press("Tab");
  const trapped = await page.evaluate(
    () => Boolean(document.activeElement?.closest('[data-testid="tour-card"]')),
  );
  check("Tab stays inside the callout", trapped);

  // The real risk: FightClient listens on window for every key and treats Escape as "quit" and every
  // arrow as "do not scroll". The test has to run with the tour open ON /play — which means walking
  // there, since stepping through the tour is what puts it on the game page. (`/play?tour=1` does
  // NOT work here: the tour starts at step 1, whose page is the front door, so it navigates away
  // from the arena before a single key is pressed. That cost a confusing red line to learn.)
  await page.goto(`${BASE}/?tour=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(TOUR, { timeout: 15000 });
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await page.waitForSelector(`${TOUR}[data-step="fight-arena"]`, { timeout: 10000 });
  await page.waitForTimeout(700);
  check(
    "the tour walked the visitor into the game",
    new URL(page.url()).pathname === "/play",
    `(${page.url()})`,
  );
  const fighters = await page.locator('[data-testid="start-overlay"]').count();
  check("…and the arena is behind the overlay", fighters >= 1);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  for (const k of ["a", "b", "f", "Space"]) await page.keyboard.press(k === "Space" ? "Space" : k);
  await page.waitForTimeout(250);
  const started = await page.locator('[data-testid="countdown"]').count();
  const overlay = await page.locator('[data-testid="start-overlay"]').count();
  check(
    "a stray keystroke cannot start the fight behind the tour",
    started === 0 && overlay >= 1,
    `(countdown: ${started}, start button still there: ${overlay >= 1})`,
  );
  check("a stray keystroke cannot scroll the page", (await page.evaluate(() => window.scrollY)) === scrollBefore);
  check("no page errors and no hydration warning", noise.length === 0, noise.slice(0, 3).join(" // "));
  await context.close();
}

// ================================================== 4. it is the front door, not every door
console.log("\n4. a deep link is left alone");
{
  const { context, page, noise } = await fresh();
  await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  check("a first visit straight into the arena is not interrupted", (await page.locator(TOUR).count()) === 0);
  const stored = await page.evaluate((k) => window.localStorage.getItem(k), SEEN_KEY);
  check("…and it is not marked as seen, so the front door still gets it", stored === null, `(${stored})`);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(TOUR, { timeout: 15000 });
  const g = await geom(page);
  check("…and the front door does", g?.step === "welcome");
  check("no page errors and no hydration warning", noise.length === 0, noise.slice(0, 3).join(" // "));
  await context.close();
}

// ================================================== 5. a phone
console.log("\n5. a phone, 390x844");
{
  const { context, page, noise } = await fresh({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(TOUR, { timeout: 15000 });
  await page.waitForTimeout(250);

  const first = await geom(page);
  checkStep("step 1 on a phone", first, { expectSpotlight: false });

  // Every step is measured, not just the last one: a callout that runs off a 390px screen is the
  // single most likely way this feature ships broken, and it would only show on the narrow one.
  const seen = {};
  for (const expected of WALK.slice(1)) {
    const g = await advance(page, expected);
    seen[expected.id] = g;
    // The coin chip is `hidden … sm:block` at this width, so THAT step must degrade to a centred
    // callout rather than point at a zero-sized element; the header is always visible, and the
    // welcome/outro steps are centred by design at every width.
    checkStep(`step ${g?.position} on a phone`, g, {
      expectSpotlight: !expected.centered && expected.id !== "coins",
    });
    if (expected.id === "play-cta") await page.screenshot({ path: "verification/25-tour-mobile.png" });
  }
  check(
    "the coin chip step degrades to a centred callout below sm",
    seen.coins?.hasSpotlight === false,
    `(spotlight: ${seen.coins?.hasSpotlight})`,
  );
  check(
    "the header step still spotlights on a phone",
    seen.header?.hasSpotlight === true,
    "(the header is visible at every width, which is why it is the target and not the nav)",
  );

  // A resize must re-place the callout rather than leave it where it was.
  await page.keyboard.press("Escape");
  await page.waitForSelector(TOUR, { state: "detached", timeout: 5000 });
  await page.goto(`${BASE}/?tour=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(TOUR, { timeout: 15000 });
  await page.click(NEXT);
  await page.waitForSelector(`${TOUR}[data-step="header"]`, { timeout: 5000 });
  await page.waitForTimeout(220);
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.waitForTimeout(300);
  const resized = await geom(page);
  const onScreen =
    resized.card.left >= -1 &&
    resized.card.right <= 1025 &&
    resized.card.top >= -1 &&
    resized.card.bottom <= 701;
  check("the callout re-places itself on resize", onScreen, JSON.stringify(resized.card));
  check("no page errors and no hydration warning", noise.length === 0, noise.slice(0, 3).join(" // "));
  await context.close();
}

await browser.close();
console.log(`\npassed ${total - fail} of ${total}  failed ${fail}`);
process.exit(fail ? 1 : 0);
