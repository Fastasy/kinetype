// Proves sign-in completes THROUGH THE BROKEN PATH.
//
// On this project Supabase ignores `redirect_to` and returns every sign-in to
// `site_url` with the path stripped — so the browser lands on the site ROOT carrying
// the auth payload, not on /auth/callback. This probe reproduces exactly that: it
// mints a real sign-in link, follows it, and asserts the app ends up signed in.
//
// It uses a magic link rather than Google because Google needs a human at the
// consent screen; the landing + session-detection path under test is identical.
//
//   node scripts/probe-oauth-fallback.mjs [baseUrl]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] || process.env.KT_BASE || "http://localhost:3000";
const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const { project_url: SB, service_role_key: SVC } = creds;
const EMAIL = "kt-fallback@example.com";

const api = (path, body) =>
  fetch(`${SB}${path}`, {
    method: "POST",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

await api("/auth/v1/admin/users", { email: EMAIL, email_confirm: true });
const linkRes = await api("/auth/v1/admin/generate_link", { type: "magiclink", email: EMAIL });
const actionLink = linkRes.action_link;
console.log("minted sign-in link; redirect target in link:", linkRes.redirect_to);

let fail = 0;
const check = (n, ok, extra = "") => { console.log(`${ok ? "  ok  " : "  FAIL"} ${n} ${extra}`); if (!ok) fail++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Follow the real link: Supabase 302s to the site root carrying the auth payload.
await page.goto(actionLink, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

const url = page.url();
console.log("landed on:", url.replace(/#.*/, "#<redacted>"));

check("landed on the site (not an error page)", url.startsWith(BASE), `(${url.slice(0, 50)})`);

// The whole point: the app must be SIGNED IN despite landing on the root with no code path.
await page.goto(`${BASE}/bosses`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
let body = await page.textContent("body");
const header = await page.textContent("header");
check("session was picked up (header shows a signed-in account)", /Sign out/i.test(header), `header="${header.replace(/\s+/g, " ").slice(0, 70)}"`);
check("campaign is open, not gated", !/Sign in to fight the bosses/i.test(body));
check("profile was created server-side", /bosses beaten/i.test(body), `"${(body.match(/\d\/9 bosses beaten/) || [""])[0]}"`);
await page.screenshot({ path: "verification/17-oauth-fallback.png" });

check("site root also recognises the session", await (async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  return /Sign out/i.test(await page.textContent("header"));
})());

await browser.close();

// cleanup
const list = await fetch(`${SB}/auth/v1/admin/users?per_page=200`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }).then((r) => r.json());
for (const u of list.users || []) {
  if (u.email === EMAIL) {
    await fetch(`${SB}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  }
}
console.log("\npassed", 5 - fail, " failed", fail);
process.exit(fail ? 1 : 0);
