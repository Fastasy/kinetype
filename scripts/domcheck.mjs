// Measures DOM size and paint timing on the live site.
//
// CORRECTION TO A PREVIOUS CLAIM: an earlier run of this reported "FCP 1856ms on / against
// 380ms on /play" and blamed the inline pixel-art SVG. That comparison was INVALID. The
// script reused one page for every route, and first-contentful-paint is only reported for
// the first navigation in a fresh document, so every route after the first came back as -1.
// Only one number was real, and it was a cold uncached load of `/` that also pulled three
// font families.
//
// This version gives every route its own fresh, cache-free context so the numbers are
// actually comparable, and counts the font requests so the real cost is visible.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "https://www.kinetype.app";
const ROUTES = ["/", "/play", "/shop", "/how-to-play"];

const browser = await chromium.launch();

console.log(
  `${"route".padEnd(15)} ${"FCP".padStart(7)} ${"LCP".padStart(7)} ${"DCL".padStart(7)} ` +
    `${"load".padStart(7)} ${"nodes".padStart(6)} ${"fonts".padStart(6)} ${"KB(dec)".padStart(8)}`,
);

// WARM-UP PASS. Without it the first route measured absorbs browser cold-start cost and
// looks far worse than the rest, which is exactly the mistake that produced the bogus
// "FCP 1856ms on / vs 380ms on /play" claim.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const warm = await ctx.newPage();
  await warm.goto(`${BASE}/play`, { waitUntil: "load" });
  await warm.waitForTimeout(600);
  await ctx.close();
}

for (const route of ROUTES) {
  // A brand-new context each time: no shared cache, no reused document.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  const fontRequests = [];
  page.on("response", (r) => {
    const url = r.url();
    if (/\.(woff2?|ttf)(\?|$)/i.test(url) || url.includes("fonts.gstatic")) {
      fontRequests.push(url);
    }
  });

  await page.goto(`${BASE}${route}`, { waitUntil: "load" });
  await page.waitForTimeout(1200); // let LCP settle

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return new Promise((resolve) => {
      let lcp = -1;
      const po = new PerformanceObserver((list) => {
        const e = list.getEntries();
        lcp = Math.round(e[e.length - 1].startTime);
      });
      try {
        po.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        /* unsupported */
      }
      setTimeout(
        () =>
          resolve({
            fcp: Math.round(fcp?.startTime ?? -1),
            lcp,
            dcl: Math.round(nav.domContentLoadedEventEnd),
            load: Math.round(nav.loadEventEnd),
            nodes: document.querySelectorAll("*").length,
            decoded: nav.transferSize
              ? Math.round(nav.transferSize / 1024)
              : Math.round((nav.decodedBodySize ?? 0) / 1024),
          }),
        300,
      );
    });
  });

  console.log(
    `${route.padEnd(15)} ${String(m.fcp).padStart(7)} ${String(m.lcp).padStart(7)} ` +
      `${String(m.dcl).padStart(7)} ${String(m.load).padStart(7)} ` +
      `${String(m.nodes).padStart(6)} ${String(fontRequests.length).padStart(6)} ` +
      `${String(m.decoded).padStart(8)}`,
  );

  await context.close();
}

await browser.close();
