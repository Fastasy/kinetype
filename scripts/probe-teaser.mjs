// TEMPORARY teaser probe: screenshot the landing page's static arena frame.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const svg = page.locator('svg[aria-label*="match in progress"]');
await svg.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await svg.screenshot({ path: "verification/probe-teaser.png" });
console.log("saved verification/probe-teaser.png");
await browser.close();
