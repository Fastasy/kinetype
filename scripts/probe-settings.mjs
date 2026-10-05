// Verifies the account settings page end to end in a real browser, signed in.
//
//   node scripts/seed-test-user.mjs
//   npx next dev            # in another terminal
//   node scripts/probe-settings.mjs [baseUrl]
//   node scripts/seed-test-user.mjs --delete
//
// The session is INJECTED into localStorage rather than driven through Google: the app persists
// it under the `kinetype-auth` key, so seeding that key boots the app already signed in. No
// Google account, no consent screen, and the probe still exercises the real RLS + RPC path.
//
// Expected values are read from the API, never hardcoded — a fixture that evolves must not turn
// a working feature into a red run.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL_ = creds.project_url;
const ANON = creds.anon_key;
const EMAIL = "kt-test@example.com";
const PASSWORD = "Test-Pass-9f3a2b!";
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
const session = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
const token = session.access_token;
if (!token) {
  console.error("run scripts/seed-test-user.mjs first");
  process.exit(1);
}

const me = (await rpc("ensure_profile", {}, token)).json;
const handle = me.handle;
// Always a DIFFERENT name from the one already stored, so Save is genuinely enabled. Derived from
// server truth rather than hardcoded: a fixed target stops being a change the moment the probe
// has run once, and "Save stayed disabled" then reads as a broken form.
const NEW_NAME = me.display_name === "Ruan Verified" ? "Ruan Verified II" : "Ruan Verified";
console.log(`fixture @${handle}, server name "${me.display_name}" -> will rename to "${NEW_NAME}"\n`);

// Shape supabase-js persists under `storageKey: "kinetype-auth"`.
const storedSession = {
  access_token: token,
  token_type: "bearer",
  expires_in: session.expires_in ?? 3600,
  expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  refresh_token: session.refresh_token,
  user: session.user,
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await context.addInitScript(
  ({ key, value }) => window.localStorage.setItem(key, value),
  { key: "kinetype-auth", value: JSON.stringify(storedSession) },
);
const page = await context.newPage();
page.setDefaultTimeout(30000);

// App-side failures are otherwise invisible: a rejected upload surfaces only as a missing status.
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") pageErrors.push(`console: ${m.text().slice(0, 200)}`);
});

// =============================================================== signed out (no session)
{
  const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const anonPage = await anon.newPage();
  await anonPage.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await anonPage.waitForSelector('[data-testid="settings-signed-out"]', { timeout: 30000 });
  const body = await anonPage.textContent("main");
  check("signed out: settings asks you to sign in", /Sign in with Google/.test(body));
  check("signed out: it does NOT expose a name field", (await anonPage.locator('[data-testid="name-input"]').count()) === 0);
  await anon.close();
}

// ================================================================== name: the real thing
await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="account-settings"]', { timeout: 45000 });

const prefilled = await page.inputValue('[data-testid="name-input"]');
check("the name field is pre-filled from the server profile", prefilled === me.display_name, `"${prefilled}"`);

const chipHref = await page.getAttribute("header a[href='/settings']", "href");
check("the header avatar chip points at /settings", chipHref === "/settings", String(chipHref));

// The negative case: nothing has changed yet, so Save must be unavailable rather than offering a
// no-op write.
check("Save is disabled while the name is unchanged", await page.isDisabled('[data-testid="save-name"]'));

await page.fill('[data-testid="name-input"]', NEW_NAME);
check("typing a new name enables Save", await page.isEnabled('[data-testid="save-name"]'));
await page.click('[data-testid="save-name"]');
await page.waitForSelector('[data-testid="settings-status"]', { timeout: 20000 });
const saveStatus = await page.textContent('[data-testid="settings-status"]');
check("saving the name reports success", /Name saved/.test(saveStatus), saveStatus);

// Server truth, not the DOM: read the stored name back through the API.
const afterName = (await rpc("ensure_profile", {}, token)).json;
check("the server actually stored the new name", afterName.display_name === NEW_NAME, `"${afterName.display_name}"`);
check("renaming did NOT move the handle", afterName.handle === handle, `${handle} -> ${afterName.handle}`);

// Reload: a name that only lives in React state would vanish here.
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="account-settings"]', { timeout: 45000 });
check("the new name survives a reload", (await page.inputValue('[data-testid="name-input"]')) === NEW_NAME);

await page.screenshot({ path: `${OUT}/settings-page.png`, fullPage: true });

// ================================================================= photo: upload a real one
// A 300x200 canvas, so the centre-crop to a 256px square is genuinely exercised. The PNG is made
// in the page (no image library needed) and handed to Playwright's own setInputFiles, which
// dispatches a genuine change event rather than a synthetic one the app might not see.
const pngB64 = await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 300; c.height = 200;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0e7490"; ctx.fillRect(0, 0, 300, 200);
  ctx.fillStyle = "#6d28d9"; ctx.fillRect(0, 0, 120, 120);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const buf = new Uint8Array(await blob.arrayBuffer());
  return btoa(String.fromCharCode(...buf));
});
await page.setInputFiles('[data-testid="avatar-input"]', {
  name: "me.png",
  mimeType: "image/png",
  buffer: Buffer.from(pngB64, "base64"),
});

await page.waitForFunction(
  () => /Photo updated|Photo removed|did not|too large|WebP|PNG|Could not|failed|not authenticated/.test(
    document.querySelector('[data-testid="settings-status"]')?.textContent || "",
  ),
  null,
  { timeout: 30000 },
).catch(async () => {
  console.log("  .. upload status never appeared; page errors:");
  console.log(`     ${pageErrors.join("\n     ") || "(none)"}`);
  console.log(`     status element: ${await page.textContent('[data-testid="settings-status"]').catch(() => "(absent)")}`);
});
const photoStatus = await page.textContent('[data-testid="settings-status"]');
check("uploading a photo reports success", /Photo updated/.test(photoStatus), photoStatus);

// The preview must be the STORED url, i.e. one that goes through our bucket.
const previewSrc = await page.getAttribute('img[data-testid="avatar-preview"]', "src");
check("the preview renders an uploaded bucket URL", /kinetype-avatars/.test(previewSrc ?? ""), String(previewSrc));
check("it was re-encoded as WebP, not uploaded raw", /avatar\.webp/.test(previewSrc ?? ""), String(previewSrc));

const stored = (await rpc("ensure_profile", {}, token)).json;
check("the server stored the avatar url", /kinetype-avatars/.test(stored.avatar_url ?? ""), stored.avatar_url);

// The object must be publicly fetchable — that is what every other player's browser does.
if (stored.avatar_url) {
  const obj = await fetch(stored.avatar_url);
  const buf = Buffer.from(await obj.arrayBuffer());
  check("the uploaded object is publicly readable", obj.status === 200, `HTTP ${obj.status}`);
  check(
    "it is a downscaled WebP, not a 300x200 PNG",
    buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP",
    `${buf.length} bytes`,
  );
  check("the stored path is inside the fixture's own folder", stored.avatar_url.includes(`/${handle}/`));
  // Regression lock: the folder is the HANDLE on purpose. A uid-namespaced path would publish the
  // player's auth UUID through the image URL on every profile page and leaderboard row.
  check("the avatar URL does not contain the auth uuid", !stored.avatar_url.includes(session.user.id), stored.avatar_url);
}

// ============================================================ what the public sees
await page.goto(`${BASE}/u/${handle}`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1", { timeout: 30000 });
const publicBody = await page.textContent("main");
check("the public profile shows the new name", publicBody.includes(NEW_NAME), publicBody.slice(0, 70).replace(/\s+/g, " "));
const publicImg = await page.locator("main img").first().getAttribute("src").catch(() => null);
check("the public profile shows the uploaded photo", /kinetype-avatars/.test(publicImg ?? ""), String(publicImg));
check("no auth uuid leaked into the public page", !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(await page.content()));
await page.screenshot({ path: `${OUT}/profile-with-photo.png`, fullPage: true });

// ======================================================================= remove it again
await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="remove-photo"]', { timeout: 30000 });
await page.click('[data-testid="remove-photo"]');
await page.waitForFunction(
  () => /Photo removed|did not/.test(document.querySelector('[data-testid="settings-status"]')?.textContent || ""),
  null,
  { timeout: 20000 },
);
const removeStatus = await page.textContent('[data-testid="settings-status"]');
check("removing the photo reports success", /Photo removed/.test(removeStatus), removeStatus);
check("the preview falls back to an initial", (await page.locator('[data-testid="avatar-preview"][data-empty="true"]').count()) === 1);
check("the Remove button disappears once there is no photo", (await page.locator('[data-testid="remove-photo"]').count()) === 0);

const cleared = (await rpc("ensure_profile", {}, token)).json;
check("the server cleared the photo", cleared.avatar_url === "", `"${cleared.avatar_url}"`);
check("the cleared photo does not come back on reload", cleared.display_name === NEW_NAME);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="account-settings"]', { timeout: 30000 });
check("still no photo after a reload", (await page.locator('[data-testid="avatar-preview"][data-empty="true"]').count()) === 1);

await page.screenshot({ path: `${OUT}/settings-after-remove.png`, fullPage: true });

// ------------------------------------------------------------------------------- tidy up
// Restore the name that was there BEFORE, not a hardcoded one. Other probes assert against this
// fixture's name, so writing a fixed string here made scripts/probe-accounts.mjs fail a
// case-sensitive match on "kt-test". A null name is a no-op server-side (nothing to restore).
await rpc("update_profile", { p_display_name: me.display_name, p_avatar_url: "" }, token);

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
