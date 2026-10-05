// Where does the header nav wrap to a second line?
// Usage: node scripts/probe-nav.mjs http://localhost:3000
import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const WIDTHS = [768, 820, 900, 1024, 1120, 1180, 1280, 1440];

const browser = await chromium.launch();
const page = await browser.newPage();

console.log("width  headerH  navShown  navOverflow  wrappedLinks");
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const m = await page.evaluate(() => {
    const header = document.querySelector("header");
    const inner = header?.firstElementChild;
    const nav = document.querySelector('nav[aria-label="Main navigation"]');
    const links = Array.from(nav?.querySelectorAll("a") ?? []);
    // A single-line nav link is ~36px tall (py-2 + text-sm); two lines is ~56px.
    const wrapped = links.filter((a) => a.getBoundingClientRect().height > 44).map((a) => a.textContent?.trim());
    return {
      headerH: Math.round(header?.getBoundingClientRect().height ?? 0),
      innerOverflow: inner ? Math.round(inner.scrollWidth - inner.clientWidth) : 0,
      links: links.length,
      wrapped: wrapped.filter(Boolean),
      navVisible: Boolean(nav && nav.getBoundingClientRect().width > 0),
    };
  });
  console.log(
    `${String(w).padEnd(6)} ${String(m.headerH).padEnd(8)} ${String(m.navVisible).padEnd(9)} ${String(m.innerOverflow).padEnd(12)} ${m.wrapped.length ? m.wrapped.join(", ") : "(none)"}`,
  );
}

await browser.close();
