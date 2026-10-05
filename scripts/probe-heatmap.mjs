// Verifies the activity heatmap is DYNAMIC and shows the whole year on screen.
//
// The bug: the squares were a hardcoded 11px, which needs ~742px before the weekday gutter — wider
// than the profile column — so the grid overflowed, the newest weeks were pushed off the right
// edge, and the default scroll position showed a year ago. The player had to scroll right to find
// today.
//
// Usage: node scripts/probe-heatmap.mjs [baseUrl]

import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const OUT = "verification";
const HANDLE = "kt-test";

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Where the grid sits relative to the box that clips it. */
const geometry = (page) =>
  page.evaluate(() => {
    const wrap = document.querySelector('[data-testid="activity-heatmap"]');
    const scroller = document.querySelector('[data-testid="heatmap-scroller"]');
    const cells = document.querySelectorAll('[data-testid="heatmap-scroller"] span[title]');
    const last = cells.length ? cells[cells.length - 1] : null;
    const lastBox = last ? last.getBoundingClientRect() : null;
    const scrollBox = scroller.getBoundingClientRect();
    return {
      cell: Number(wrap?.getAttribute("data-cell") ?? 0),
      fits: wrap?.getAttribute("data-fits") === "true",
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      scrollLeft: scroller.scrollLeft,
      cellCount: cells.length,
      // Is the newest square actually inside the visible box?
      lastVisible: lastBox ? lastBox.right <= scrollBox.right + 1 : false,
      lastRight: lastBox ? Math.round(lastBox.right) : null,
      boxRight: Math.round(scrollBox.right),
      wrapWidth: Math.round(wrap.getBoundingClientRect().width),
    };
  });

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(`${BASE}/u/${HANDLE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="activity-heatmap"]', { timeout: 30000 });
  // Wait for the observer to have measured and resized at least once.
  await page
    .waitForFunction(() => {
      const w = document.querySelector('[data-testid="activity-heatmap"]');
      return w && Number(w.getAttribute("data-cell") ?? 0) > 0;
    }, null, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(400); // let a second observer callback settle

  const wide = await geometry(page);
  console.log("desktop:", JSON.stringify(wide));

  check("the grid has a full year of squares", wide.cellCount > 350, `${wide.cellCount} cells`);
  check("the squares are a measured size, not a hardcoded 11px", wide.cell > 0 && wide.cell <= 12, `${wide.cell}px`);
  check("THE WHOLE MAP FITS — no horizontal scrolling", wide.scrollWidth <= wide.clientWidth + 2, `scrollWidth ${wide.scrollWidth} vs clientWidth ${wide.clientWidth}`);
  check("the grid does not overflow its container", wide.scrollWidth <= wide.wrapWidth + 2, `${wide.scrollWidth} vs ${wide.wrapWidth}`);
  check("the NEWEST day is on screen without scrolling", wide.lastVisible, `last cell right ${wide.lastRight} vs box right ${wide.boxRight}`);
  await page.screenshot({ path: `${OUT}/heatmap-desktop.png` });

  // ---- a phone: a readable square cannot fit, so it must scroll to the NEWEST week, not the oldest
  const narrow = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await narrow.newPage();
  await phone.goto(`${BASE}/u/${HANDLE}`, { waitUntil: "domcontentloaded" });
  await phone.waitForSelector('[data-testid="activity-heatmap"]', { timeout: 30000 });
  await phone.waitForTimeout(900);
  const small = await geometry(phone);
  console.log("phone:", JSON.stringify(small));

  check("on a phone the squares stay readable", small.cell >= 4, `${small.cell}px`);
  if (small.scrollWidth > small.clientWidth) {
    check(
      "...and it opens on the NEWEST week, not a year ago",
      small.scrollLeft > 0 && small.scrollLeft + small.clientWidth >= small.scrollWidth - 2,
      `scrolled to ${small.scrollLeft} of ${small.scrollWidth - small.clientWidth}`,
    );
    check("...so today is visible without scrolling", small.lastVisible, `last right ${small.lastRight} vs box right ${small.boxRight}`);
  } else {
    check("...and the whole year still fits on a phone", true, `scrollWidth ${small.scrollWidth} <= ${small.clientWidth}`);
  }
  await phone.screenshot({ path: `${OUT}/heatmap-phone.png` });

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
