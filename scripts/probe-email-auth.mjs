// Proves an account can be made with an email and a password — end to end, through the real form.
//
// What it covers, in order:
//   1. the campaign gate LINKS to /signin carrying ?next= (it used to fire Google directly)
//   2. creating an account signs the player in immediately, with no email confirmation
//   3. the profile that email sign-up produces (name derived from the address, handle minted)
//   4. changing the password while signed in — the recovery path that needs no mailer
//   5. signing out, then signing back in with the NEW password
//   6. a wrong password being refused, with the server's own message on screen
//
// It deletes its own fixture at the end and asserts both halves went with it, so nothing is left
// on the leaderboard.
//
//   node scripts/probe-email-auth.mjs [baseUrl]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] || process.env.KT_BASE || "http://localhost:3000";
const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const { project_url: SB, service_role_key: SVC, anon_key: ANON } = creds;

// A fresh address every run: the fixture must never collide with a real account, and a stale one
// from a failed run must not make the next run pass for the wrong reason.
const STAMP = Date.now().toString(36);
const EMAIL = `kt-email-${STAMP}@example.com`;
const PASSWORD = `Kt-Pass-${STAMP}!`;
const NEW_PASSWORD = `Kt-New-${STAMP}!`;

const svc = (path, init = {}) =>
  fetch(`${SB}${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

/**
 * Ask the PUBLIC read path about a handle.
 *
 * `kinetype.profiles` is not reachable over the Data API on purpose — every read and write goes
 * through a function — so a direct `select` answers 42501 and would "prove" nothing (it did, on the
 * first run of this probe). This RPC is the public view of a profile, and it returns NOTHING for a
 * handle that does not exist.
 */
const publicProfile = (handle) =>
  fetch(`${SB}/rest/v1/rpc/public_profile`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
      "Accept-Profile": "kinetype",
      "Content-Profile": "kinetype",
    },
    body: JSON.stringify({ p_handle: handle }),
  })
    .then((r) => r.json())
    .catch(() => null);

let fail = 0;
let total = 0;
const check = (name, ok, extra = "") => {
  total++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${extra ? ` ${extra}` : ""}`);
  if (!ok) fail++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("  !! page error:", String(e).slice(0, 160)));

// ---------------------------------------------------------------- 1. the gate routes to the form
await page.goto(`${BASE}/bosses`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const gate = page.locator('[data-testid="campaign-signin"]');
check("campaign gate offers the sign-in form", (await gate.count()) === 1);
const gateHref = (await gate.count()) ? await gate.getAttribute("href") : null;
check("gate carries its destination", gateHref === "/signin?next=%2Fbosses", `(href="${gateHref}")`);

await page.click('[data-testid="campaign-signin"]');
await page.waitForURL("**/signin**", { timeout: 15000 });
await page.waitForSelector('[data-testid="auth-form"]', { timeout: 15000 });
check("gate click lands on the form", page.url().includes("/signin?next="), `(${page.url()})`);
check(
  "create-account tab is the default",
  (await page.getAttribute('[data-testid="auth-tab-signup"]', "aria-selected")) === "true",
);
check("Google is still offered alongside it", (await page.locator('[data-testid="auth-google"]').count()) === 1);
await page.screenshot({ path: "verification/18-email-auth-form.png" });

// ------------------------------------------------------------------- 2. create the account
await page.fill('[data-testid="auth-email"]', EMAIL);
await page.fill('[data-testid="auth-password"]', PASSWORD);
await page.fill('[data-testid="auth-confirm"]', NEW_PASSWORD); // deliberately mismatched first
await page.click('[data-testid="auth-submit"]');
await page.waitForTimeout(700);
const mismatch = await page.textContent('[data-testid="auth-status"]').catch(() => "");
check(
  "a mismatched confirmation is refused locally",
  /do not match/i.test(mismatch || ""),
  `("${(mismatch || "").trim().slice(0, 60)}")`,
);

await page.fill('[data-testid="auth-confirm"]', PASSWORD);
await page.click('[data-testid="auth-submit"]');
// No confirmation email is sent, so the account is live immediately and the app forwards on.
await page.waitForURL("**/bosses", { timeout: 20000 });
await page.waitForTimeout(2500);
const header = await page.textContent("header");
check(
  "signed in straight away, with no email step",
  /Sign out/i.test(header),
  `header="${header.replace(/\s+/g, " ").slice(0, 60)}"`,
);
check("campaign is open after sign-up", !/Sign in or create an account/i.test(await page.textContent("body")));
await page.screenshot({ path: "verification/19-email-auth-signedup.png" });

// ------------------------------------------------- 3. the profile the email path produced
await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="account-settings"]', { timeout: 20000 });
const nameValue = await page.inputValue('[data-testid="name-input"]');
check(
  "profile name is derived from the address (no OAuth metadata)",
  nameValue === `kt-email-${STAMP}`,
  `(name="${nameValue}")`,
);
// Read the handle from the profile LINK, not from the page text: that row renders
// "@handleView your public profile" with no space between them, so a body-text match swallows the
// following word and every later check then runs against a handle that does not exist.
const profileHref = await page.getAttribute('[data-testid="account-settings"] a[href^="/u/"]', "href");
const handle = profileHref ? profileHref.replace("/u/", "") : null;
check("a public handle was minted", Boolean(handle), `(@${handle})`);
const publicRow = handle ? await publicProfile(handle) : null;
check("and it resolves on the public profile page", Array.isArray(publicRow) && publicRow.length === 1);

// ------------------------------------- 4. change the password while signed in (no email at all)
await page.waitForSelector('[data-testid="password-settings"]', { timeout: 15000 });
await page.fill('[data-testid="new-password"]', NEW_PASSWORD);
await page.fill('[data-testid="confirm-password"]', NEW_PASSWORD);
await page.click('[data-testid="save-password"]');
await page.waitForSelector('[data-testid="password-status"]', { timeout: 15000 });
const pwStatus = await page.textContent('[data-testid="password-status"]');
check(
  "password change while signed in succeeds",
  /Password saved/i.test(pwStatus || ""),
  `("${(pwStatus || "").trim().slice(0, 60)}")`,
);

// --------------------------------------------------------------- 5. sign out, sign back in
await page.click('header button[title="Sign out"]');
await page.waitForTimeout(1500);
const afterOut = await page.textContent("header");
check("signed out", !/Sign out/i.test(afterOut) && /Sign in/i.test(afterOut));

await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="auth-form"]', { timeout: 15000 });
await page.click('[data-testid="auth-tab-signin"]');
await page.fill('[data-testid="auth-email"]', EMAIL);

// The reset flow is UI-verified only: actually sending would spend one of the built-in mailer's
// two-per-hour emails, and the panel is what a forgotten password meets first.
await page.click('[data-testid="auth-forgot"]');
await page.waitForTimeout(300);
check(
  "forgot-password switches to the reset panel",
  /Send reset link/i.test((await page.textContent('[data-testid="auth-submit"]')) || ""),
);
await page.click("text=Back to sign in");
await page.waitForTimeout(300);
check(
  "and back to the sign-in panel",
  /^Sign in$/i.test(((await page.textContent('[data-testid="auth-submit"]')) || "").trim()),
);

// 6. a WRONG password first: the server's message must reach the screen, not a dead button.
await page.fill('[data-testid="auth-password"]', `${PASSWORD}-wrong`);
await page.click('[data-testid="auth-submit"]');
await page.waitForSelector('[data-testid="auth-status"]', { timeout: 15000 });
const badMsg = (await page.textContent('[data-testid="auth-status"]')) || "";
check(
  "a wrong password is refused on screen",
  /invalid|credentials|password/i.test(badMsg),
  `("${badMsg.trim().slice(0, 60)}")`,
);
check("still signed out after a bad password", !/Sign out/i.test(await page.textContent("header")));

// the NEW password must work — that is what proves the change above really landed
await page.fill('[data-testid="auth-password"]', NEW_PASSWORD);
await page.click('[data-testid="auth-submit"]');
await page.waitForURL("**/bosses", { timeout: 20000 });
await page.waitForTimeout(2500);
check("signs in again with the NEW password", /Sign out/i.test(await page.textContent("header")));
await page.screenshot({ path: "verification/20-email-auth-signin.png" });

// The header link must carry the current page, not a hardcoded destination.
await page.click('header button[title="Sign out"]');
await page.waitForTimeout(1200);
await page.goto(`${BASE}/leaderboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const headerLink = await page.getAttribute('[data-testid="header-signin"]', "href");
check(
  "header sign-in link carries the current page",
  headerLink === "/signin?next=%2Fleaderboard",
  `(href="${headerLink}")`,
);

await browser.close();

// ------------------------------------------------------------------------------- cleanup
const list = await svc("/auth/v1/admin/users?per_page=200").then((r) => r.json());
const hits = (list.users || []).filter((u) => u.email === EMAIL);
check("fixture account exists to delete", hits.length === 1);
for (const u of hits) {
  await svc(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
}
// The kinetype.profiles row is FK-cascaded from auth.users. Confirm BOTH went — a test account left
// on a live leaderboard is the one cleanup failure that matters.
const after = await svc("/auth/v1/admin/users?per_page=200").then((r) => r.json());
check("the fixture is gone from auth", !(after.users || []).some((u) => u.email === EMAIL));
const leftover = handle ? await publicProfile(handle) : [1];
check("its public profile went with it", Array.isArray(leftover) && leftover.length === 0);

console.log(`\npassed ${total - fail} of ${total}  failed ${fail}`);
process.exit(fail ? 1 : 0);
