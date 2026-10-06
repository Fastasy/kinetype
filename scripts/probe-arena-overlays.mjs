// Verifies the two things Ruan asked for, against a real browser:
//
//   1. THE TIMER. The round countdown used to be drawn in the THEME's ink while sitting on the
//      ARENA, which no theme touches. This loads every theme, samples the REAL PIXEL behind the
//      countdown out of the canvas, and computes the contrast the player actually sees — both for
//      the old themed ink and for the fixed arena ink that replaced it. It also asserts the
//      countdown's colour does NOT move when the theme does, while proving the theme DID apply.
//   2. THE WIN. Drives a real match to a win against the slowest bot and checks the result banner:
//      the fixed plate, the outcome, and that at least one achievement flare fired.
//
//   npx next dev            # in another terminal
//   node scripts/probe-arena-overlays.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const OUT = "verification/overlays";
mkdirSync(OUT, { recursive: true });

// Mirrors game/hud.ts. Kept as literals here on purpose: if someone edits the module and not this
// file the check should FAIL, not silently follow along.
const ARENA_INK = "#ffffff";
const ARENA_OUTLINE = "#0b0b12";
const RESULT_PLATE_BG = "rgb(11, 11, 18)";
const SAVE_KEY = "kinetype.save.v1";

const THEMES = ["paper", "midnight", "sunset", "frost", "neon", "volcano"];

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
};

const luminance = (hex) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const ch = (i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
};
const ratio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const toHex = (r, g, b) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

/** Read the theme currently on <html>, so a "nothing changed" result can be told from a real one. */
async function themeOn(page) {
  return page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      ink: s.getPropertyValue("--color-ink").trim(),
      page: s.getPropertyValue("--color-page").trim(),
    };
  });
}

console.log("\n== 1. the countdown timer, over the arena, in every theme ==");
for (const theme of THEMES) {
  const page = await ctx.newPage();
  await page.addInitScript(
    ([key, id]) => {
      let save = {};
      try {
        save = JSON.parse(localStorage.getItem(key) || "{}");
      } catch {
        save = {};
      }
      save.equippedTheme = id;
      // Slowest bot, so the fight is not over before we have looked at it.
      save.botWpm = 20;
      localStorage.setItem(key, JSON.stringify(save));
    },
    [SAVE_KEY, theme],
  );
  await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="arena"] canvas');
  await page.getByTestId("fight-button").first().click();

  // The countdown is ~2.2s at the start of every round. Sprint to it.
  await page.waitForSelector('[data-testid="countdown"]', { timeout: 15000 });
  const styles = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="countdown"]');
    const s = getComputedStyle(el);
    return { color: s.color, textShadow: s.textShadow, text: el.textContent?.trim() ?? "" };
  });

  // Sample the REAL pixel behind the digit. The canvas is hidden for the one frame of the read so
  // the DOM text is not what we measure; a ResizeObserver can blank a canvas, so poll until the
  // pixel is actually painted rather than trusting the first read.
  const behind = await page.evaluate(async () => {
    const el = document.querySelector('[data-testid="countdown"]');
    const canvas = document.querySelector('[data-testid="arena"] canvas');
    const r = el.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const x = Math.round(((r.left + r.width / 2 - c.left) / c.width) * canvas.width);
    const y = Math.round(((r.top + r.height / 2 - c.top) / c.height) * canvas.height);
    const g = canvas.getContext("2d");
    const prev = el.style.visibility;
    el.style.visibility = "hidden";
    let px = null;
    for (let i = 0; i < 40; i++) {
      px = g.getImageData(x, y, 1, 1).data;
      if (px[3] > 200) break;
      await new Promise((res) => requestAnimationFrame(res));
    }
    el.style.visibility = prev;
    return { x, y, r: px[0], g: px[1], b: px[2], a: px[3] };
  });

  const bg = toHex(behind.r, behind.g, behind.b);
  const themed = await themeOn(page);
  // The old design: whatever ink the theme uses, straight onto that pixel.
  const oldRatio = ratio(themed.ink, bg);
  // The new design: the fixed light fill, and the fixed dark ring around it. Whichever wins.
  const newRatio = Math.max(ratio(ARENA_INK, bg), ratio(ARENA_OUTLINE, bg));

  const rgbToHex = (css) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
    return m ? toHex(Number(m[1]), Number(m[2]), Number(m[3])) : css;
  };

  await page.screenshot({ path: `${OUT}/countdown-${theme}.png`, clip: await page.getByTestId("arena").boundingBox() });
  console.log(
    `  ${theme.padEnd(9)} arena px ${bg}  |  themed ink ${themed.ink} = ${oldRatio.toFixed(2)}:1  ->  ` +
      `arena ink/ring = ${newRatio.toFixed(2)}:1  |  rendered fill ${rgbToHex(styles.color)}`,
  );
  check(
    `${theme}: the countdown is drawn in the arena's fixed ink, not the theme's`,
    rgbToHex(styles.color).toLowerCase() === ARENA_INK &&
      styles.textShadow.includes("rgb(11, 11, 18)"),
    `color=${rgbToHex(styles.color)} shadow=${styles.textShadow.slice(0, 40)}…`,
  );
  check(`${theme}: the countdown is readable on the real pixel behind it`, newRatio >= 3, `${newRatio.toFixed(2)}:1 on ${bg}`);
  check(`${theme}: the theme really is applied (control)`, themed.page.length > 0 && themed.ink.length > 0, `page ${themed.page}`);
  await page.close();
}

console.log("\n== 2. the win ==");
{
  const page = await ctx.newPage();
  await page.addInitScript(
    ([key]) => {
      let save = {};
      try {
        save = JSON.parse(localStorage.getItem(key) || "{}");
      } catch {
        save = {};
      }
      // SLOWEST bot, so an accurate typist wins this on merit rather than on luck.
      save.botWpm = 20;
      localStorage.setItem(key, JSON.stringify(save));
    },
    [SAVE_KEY],
  );
  await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="arena"] canvas');
  await page.getByTestId("fight-button").first().click();
  await page.waitForSelector('[data-testid="player-panel"]', { timeout: 15000 });

  // Type what the GAME says is due next — never a reconstructed sentence. That is the only way a
  // harness survives the separator being a real key.
  let typed = 0;
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if ((await page.locator('[data-testid="result"]').count()) > 0) break;
    const key = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="player-panel"] [data-testid="prompt"]');
      return p ? p.getAttribute("data-next-key") : null;
    });
    if (key === null || key === "") {
      await page.waitForTimeout(60);
      continue;
    }
    await page.keyboard.press(key === " " ? "Space" : key);
    typed += 1;
    // Slow enough that the engine's input queue never fills (a full queue silently discards the
    // extra characters and the match stalls, which reads as a hung game).
    await page.waitForTimeout(35);
  }
  await page.waitForSelector('[data-testid="result"]', { timeout: 30000 });

  // Count the celebration ON SCREEN. Confetti is gold and falls from above, so gold pixels in the
  // top of the canvas are the burst — the fighters stand in the lower third. Measured twice, because
  // the first version of this celebration faded out before the player had finished reading the card.
  //
  // The rim is counted by LUMINANCE, not by an exact colour: it is drawn at 50-100% alpha and
  // composites with the sky, so a filter for pure near-black matches nothing even when the rim is
  // working. That was this probe's own bug, and it reported a false FAIL against a correct build.
  const goldPixels = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="arena"] canvas');
      const g = canvas.getContext("2d");
      const band = Math.floor(canvas.height * 0.45);
      const img = g.getImageData(0, 0, canvas.width, band).data;
      let gold = 0;
      let dark = 0;
      for (let i = 0; i < img.length; i += 4) {
        const [r, gg, b, a] = [img[i], img[i + 1], img[i + 2], img[i + 3]];
        if (a < 200) continue;
        if (Math.abs(r - 250) < 70 && Math.abs(gg - 204) < 70 && b < 110) {
          gold += 1;
          continue;
        }
        // A rim pixel is a square of the arena's sky darkened toward #0b0b12. Every sky band in
        // every arena is pale (luminance > 0.3), so anything well below that in this band is rim.
        if (Math.max(r, gg, b) < 150) dark += 1;
      }
      return { gold, dark, sampled: canvas.width * band };
    });

  // POLL for the burst, never sample once. The pieces spawn up to 140px ABOVE the stage and fall
  // into the sampled band, so a single immediate read races the animation and legitimately sees
  // zero on a perfectly working build — which is exactly the false FAIL this check reported. Poll
  // the condition (the skill's rule), then confirm it is still there after the card is read.
  let fresh = { gold: 0, dark: 0, sampled: 0 };
  for (let i = 0; i < 30 && fresh.gold === 0; i++) {
    fresh = await goldPixels();
    if (fresh.gold === 0) await page.waitForTimeout(100);
  }
  await page.waitForTimeout(900);
  const settled = await goldPixels();

  const won = (await page.getAttribute('[data-testid="result"]', "data-won")) === "1";
  const coins = Number(await page.getAttribute('[data-testid="result"]', "data-coins"));
  const banner = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="outcome-banner"]');
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      outcome: el.getAttribute("data-outcome"),
      flares: el.getAttribute("data-flares"),
      bg: s.backgroundColor,
      text: el.innerText.replace(/\s+/g, " ").trim(),
    };
  });

  console.log(`  typed ${typed} keys · won=${won} · coins=${coins}`);
  console.log(`  celebration pixels in the top 45% of the arena: fresh ${JSON.stringify(fresh)} · settled ${JSON.stringify(settled)}`);
  console.log(`  banner: ${JSON.stringify(banner)}`);
  check("a match can be won by typing", won, `data-won=${won}`);
  check(
    "the win burst is actually VISIBLE on the default arena",
    fresh.gold > 0 && fresh.dark > 0,
    `${fresh.gold} gold + ${fresh.dark} rim pixels (was 1.02:1, i.e. invisible, before the rim)`,
  );
  check(
    "the celebration is still on screen while the result card is read",
    settled.gold > 0,
    `${settled.gold} gold pixels 1.2s after the match ended`,
  );
  check("the outcome banner rendered", banner !== null);
  check(
    "the banner is on the fixed plate, not a themed surface",
    banner?.bg === RESULT_PLATE_BG,
    `background ${banner?.bg}`,
  );
  check("the banner says VICTORY", /VICTORY/.test(banner?.text ?? ""), banner?.text);
  check("at least one achievement flare fired on a win", Boolean(banner?.flares), `flares "${banner?.flares}"`);
  const flareNodes = await page.locator('[data-testid="flare"]').count();
  check("the flares are real elements on screen", flareNodes > 0, `${flareNodes} flare elements`);

  await page.screenshot({ path: `${OUT}/win-banner.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/win-banner-viewport.png` });
  await page.close();
}

console.log(`\n${"-".repeat(56)}`);
console.log(`passed ${pass}   failed ${fail}`);
console.log(`screenshots -> ${OUT}/`);
console.log(`${"-".repeat(56)}`);
await browser.close();
if (fail > 0) process.exit(1);
