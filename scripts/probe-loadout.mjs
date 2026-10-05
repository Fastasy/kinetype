// The loadout a player wears is SERVER-OWNED now, and this checks the half that has nothing to do
// with writing it: what OTHER people see on the public profile.
//
// The write path (buying, wearing, and the fact that a client cannot grant itself a skin) is
// covered by scripts/probe-coins.ts. What is unique here is the READ path: an anonymous visitor
// fetching a profile by handle must see the equipped and owned cosmetics, and must NOT see the
// things a profile has no business publishing.
//
// Self-contained: it creates its own throwaway user and deletes it again, so it needs no seed.
// Usage: npx tsx --no-warnings scripts/probe-loadout.mjs   (or: node scripts/probe-loadout.mjs)
import { readFileSync } from "node:fs";

const URL = "https://conppuuscajzfrggxxdc.supabase.co";
const ANON_KEY = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(
  readFileSync(".env.local", "utf8"),
)[1].trim();
const SVC = JSON.parse(readFileSync(`${process.env.HOME}/.kinetype/creds.json`, "utf8"))
  .service_role_key;
const EMAIL = "kt-loadout@example.com";
const PASSWORD = "kt-loadout-test-9f3a";

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
};

const H = (token) => ({
  apikey: ANON_KEY,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Accept-Profile": "kinetype",
  "Content-Profile": "kinetype",
});

async function rpc(fn, body, token) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: H(token),
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

// ---------------------------------------------------------------- fixture user
const users = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, {
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
}).then((r) => r.json());
const existing = (users.users || []).find((u) => u.email === EMAIL);
const user =
  existing ??
  (await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  }).then((r) => r.json()));
console.log(`fixture: ${user.id.slice(0, 8)}${existing ? " (existing)" : " (created)"}`);

const session = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
const token = session.access_token;
check("signed in as the fixture user", Boolean(token));

const ens = await rpc("ensure_profile", {}, token);
const handle = ens.body?.handle;
check("ensure_profile minted a handle", typeof handle === "string" && handle.length >= 3, handle);

// ------------------------------------------------------------------ earn, then buy, then wear
// A brand-new account starts at 0 coins (by design — no import from a browser wallet), so it has
// to EARN the skin before it can own it. One free-play win is worth 141.
check("a new account starts with no coins", ens.body?.coins === 0, `coins ${ens.body?.coins}`);
const won = await rpc(
  "submit_match",
  { p_mode: "free", p_boss_id: null, p_bot_wpm: 40, p_won: true, p_wpm: 60, p_accuracy: 95, p_best_combo: 6, p_rounds_won: 2, p_rounds_lost: 0, p_streak: 2 },
  token,
);
check("playing pays coins", won.body?.coins === 141, `coins ${won.body?.coins}`);

const bought = await rpc("purchase_cosmetic", { p_kind: "skin", p_id: "ember" }, token);
check("the account can buy a skin it has earned", bought.status < 300, `HTTP ${bought.status}`);
check("the purchase is equipped", bought.body?.equipped_skin === "ember", `wearing ${bought.body?.equipped_skin}`);

// ------------------------------------------------------------------- what the public sees
const anon = await rpc("public_profile", { p_handle: handle }, ANON_KEY);
const p = anon.body?.[0];
check("anon can read the profile by handle", Boolean(p), `handle ${handle}`);
check("the equipped skin is public", p?.equipped_skin === "ember", `got ${p?.equipped_skin}`);
check("the equipped theme is public", p?.equipped_theme === "paper", `got ${p?.equipped_theme}`);
check("the owned skins are public", (p?.owned_skins ?? []).includes("ember"), JSON.stringify(p?.owned_skins));

// A profile publishes cosmetics, not the wallet or anything identifying.
check("the public profile does NOT publish the coin balance", p?.coins === undefined, `coins ${JSON.stringify(p?.coins)}`);
check(
  "the public profile does NOT publish an auth identifier",
  !JSON.stringify(p ?? {}).includes(user.id),
  "no uuid in the payload",
);

// ------------------------------------- wearing something unowned is still refused server-side
await rpc("set_equipped", { p_skin: "voidwing", p_theme: "paper" }, token);
const after = await rpc("public_profile", { p_handle: handle }, ANON_KEY);
check("an unowned skin cannot be worn, even via the public view", after.body?.[0]?.equipped_skin === "ember", `wearing ${after.body?.[0]?.equipped_skin}`);
check("and it is not granted by trying", !(after.body?.[0]?.owned_skins ?? []).includes("voidwing"));

// ---------------------------------------------------------------------- cleanup
await fetch(`${URL}/auth/v1/admin/users/${user.id}`, {
  method: "DELETE",
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
});
const gone = await rpc("public_profile", { p_handle: handle }, ANON_KEY);
check("fixture deleted (profile no longer resolves)", (gone.body ?? []).length === 0);

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
