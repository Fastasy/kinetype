// Verifies profile editing: the update_profile() writer, its validation, and the
// kinetype-avatars storage policies.
//
// Pure REST — no browser, no Google account. It signs in the kt-test fixture with a
// password grant, so run the seed first:
//
//   node scripts/seed-test-user.mjs
//   node scripts/probe-profile-editing.mjs
//   node scripts/seed-test-user.mjs --delete      # tidy the fixture away
//
// Reads the service/anon keys from ~/.kinetype/creds.json (kept out of the repo).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL_ = creds.project_url;
const ANON = creds.anon_key;
const EMAIL = "kt-test@example.com";
const PASSWORD = "Test-Pass-9f3a2b!";

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
};

/** PostgREST RPC in the `kinetype` schema. POST needs Content-Profile, not Accept-Profile. */
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
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* plain text error */ }
  return { status: r.status, json, text };
}

// --------------------------------------------------------------- sign in the fixture
const session = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());

const token = session.access_token;
if (!token) {
  console.error("could not sign in the fixture — run: node scripts/seed-test-user.mjs");
  console.error(JSON.stringify(session).slice(0, 300));
  process.exit(1);
}
const uid = session.user.id;

const me = (await rpc("ensure_profile", {}, token)).json;
if (!me?.id) {
  console.error("no profile row for the fixture");
  process.exit(1);
}
console.log(`fixture uid ${uid.slice(0, 8)}  handle @${me.handle}  name "${me.display_name}"\n`);
const handleBefore = me.handle;

// ------------------------------------------------------------------------ the writer
console.log("— name —");
let r = await rpc("update_profile", { p_display_name: "  Ruan   the   Great  " }, token);
check("whitespace is collapsed and trimmed", r.json?.display_name === "Ruan the Great", `-> "${r.json?.display_name}"`);

r = await rpc("update_profile", { p_display_name: "A".repeat(100) }, token);
check("a 100-char name is clamped to 24", r.json?.display_name?.length === 24, `len ${r.json?.display_name?.length}`);

r = await rpc("update_profile", { p_display_name: "   " }, token);
check("an all-whitespace name is refused", r.status >= 400, `HTTP ${r.status}`);

r = await rpc("update_profile", { p_display_name: "<script>alert(1)</script>" }, token);
check(
  "angle brackets and control characters are stripped",
  r.json?.display_name === "scriptalert(1)/script",
  `-> "${r.json?.display_name}"`,
);

r = await rpc("update_profile", { p_display_name: "josé 日本語" }, token);
check("non-Latin and accented names survive intact", r.json?.display_name === "josé 日本語", `-> "${r.json?.display_name}"`);

console.log("\n— avatar —");
r = await rpc("update_profile", { p_avatar_url: "https://evil.example.com/pixel.png" }, token);
check("a third-party URL is refused", r.status >= 400, `HTTP ${r.status}`);

r = await rpc(
  "update_profile",
  { p_avatar_url: `${URL_}/storage/v1/object/public/kinetype-avatars/someone-elses-handle/avatar.png` },
  token,
);
check("another player's folder is refused", r.status >= 400, `HTTP ${r.status}`);

r = await rpc(
  "update_profile",
  { p_avatar_url: `http://${URL_.slice(8)}/storage/v1/object/public/kinetype-avatars/${me.handle}/avatar.png` },
  token,
);
check("a plain-http URL is refused", r.status >= 400, `HTTP ${r.status}`);

console.log("\n— partial update —");
const beforePartial = (await rpc("ensure_profile", {}, token)).json;
r = await rpc("update_profile", { p_display_name: "Partial Name" }, token);
check("omitting the avatar leaves the other field alone", r.json?.display_name === "Partial Name" && r.json?.avatar_url === beforePartial.avatar_url, `avatar "${r.json?.avatar_url}"`);

// ------------------------------------------------------------- real storage round trip
console.log("\n— storage —");
// 1x1 PNG. Content is irrelevant to the policy; the point is that the write is allowed
// ONLY inside the caller's own folder.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const objectPath = `${me.handle}/avatar.png`;

let up = await fetch(`${URL_}/storage/v1/object/kinetype-avatars/${objectPath}`, {
  method: "POST",
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    "Content-Type": "image/png",
    "x-upsert": "true",
  },
  body: png,
});
check("upload into my own folder succeeds", up.status < 300, `HTTP ${up.status} ${(await up.text()).slice(0, 120)}`);

const publicUrl = `${URL_}/storage/v1/object/public/kinetype-avatars/${objectPath}`;
const anonRead = await fetch(publicUrl);
check("the object is publicly readable (needed for <img>)", anonRead.status === 200, `HTTP ${anonRead.status}`);
check("the bytes round-trip", Buffer.from(await anonRead.arrayBuffer()).equals(png));

up = await fetch(`${URL_}/storage/v1/object/kinetype-avatars/someone-elses-handle/avatar.png`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
  body: png,
});
check("upload into SOMEONE ELSE'S folder is refused", up.status >= 400, `HTTP ${up.status}`);

const evil = await fetch(`${URL_}/storage/v1/object/kinetype-avatars/${objectPath}`, { method: "DELETE" });
check("an anonymous delete is refused", evil.status >= 400, `HTTP ${evil.status}`);

// ------------------------------------------------------------------- wire it together
console.log("\n— end to end —");
r = await rpc("update_profile", { p_avatar_url: `${publicUrl}?v=${Date.now()}` }, token);
check("my own uploaded URL is accepted", r.status < 300 && /kinetype-avatars/.test(r.json?.avatar_url ?? ""), `-> ${r.json?.avatar_url}`);
// The leak this migration was re-cut to close: a public object URL carries its path, so a
// uid-namespaced folder would publish the auth UUID on every profile page and leaderboard row.
check(
  "the stored URL names the HANDLE and never the auth uuid",
  r.json?.avatar_url?.includes(`/${me.handle}/`) === true && !String(r.json?.avatar_url).includes(uid),
  r.json?.avatar_url,
);

r = await rpc("public_profile", { p_handle: me.handle }, ANON);
check("the public profile shows the new name", r.json?.[0]?.display_name === "Partial Name", `-> "${r.json?.[0]?.display_name}"`);
check("the public profile shows the new avatar", /kinetype-avatars/.test(r.json?.[0]?.avatar_url ?? ""));

// The regression that matters: ensure_profile() runs on every profile load and refills
// NULLs from OAuth. Clearing to '' must survive it.
console.log("\n— clearing a photo sticks —");
await rpc("update_profile", { p_avatar_url: "" }, token);
const afterClear = (await rpc("ensure_profile", {}, token)).json;
check("a cleared photo is NOT resurrected by ensure_profile()", afterClear.avatar_url === "", `-> "${afterClear.avatar_url}"`);
check("and a renamed display name is NOT reverted either", afterClear.display_name === "Partial Name", `-> "${afterClear.display_name}"`);

console.log("\n— handle is immutable —");
check("the handle never moved through any of this", afterClear.handle === handleBefore, `${handleBefore} -> ${afterClear.handle}`);

console.log("\n— anon cannot write —");
r = await rpc("update_profile", { p_display_name: "hacked" }, ANON);
check("an anonymous update_profile is refused", r.status >= 400, `HTTP ${r.status}`);

// leave the fixture tidy: name back, no photo
await rpc("update_profile", { p_display_name: "KT Test", p_avatar_url: "" }, token);
await fetch(`${URL_}/storage/v1/object/kinetype-avatars/${objectPath}`, {
  method: "DELETE",
  headers: { apikey: ANON, Authorization: `Bearer ${token}` },
});

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
