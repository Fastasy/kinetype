// Verifies the server-owned coin economy: the price book, the award formula, and buying.
//
/* eslint-disable @typescript-eslint/no-explicit-any -- RPC payloads are dynamic JSON and this is a
   probe script, not shipped code: the assertions are about VALUES, not types. Typing every field of
   every response would add a lot of noise to protect nothing. */
//
// Run under tsx, NOT node, because the whole point is to compare the database against the REAL
// TypeScript constants rather than a copy of them:
//
//   npx tsx scripts/probe-coins.ts
//
// SELF-CONTAINED: it creates its own throwaway account and deletes it again, so it needs no seed and
// cannot disturb (or be disturbed by) the shared kt-test fixture that the other probes use. A fresh
// account is also the only reliable baseline here — this probe SPENDS coins and consumes the
// catalogue, so anything carried over from a previous run quickly turns a correct refusal into a
// reported bug.
//
// Note the throttle: submit_match refuses more than 12 matches a minute, so running this twice
// back to back can see a deliberate 400. That is the throttle working, not a regression.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { SKINS } from "../game/skins";
import { THEMES } from "../game/themes";
import { BOSSES, coinsForMatch } from "../game/progression";

const creds = JSON.parse(readFileSync(join(homedir(), ".kinetype", "creds.json"), "utf8"));
const URL_ = creds.project_url;
const ANON = creds.anon_key;
const SVC = creds.service_role_key;

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
};

type Rpc = { status: number; json: any; text: string };

async function rpc(name: string, body: unknown, token = ANON): Promise<Rpc> {
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
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* plain-text error */ }
  return { status: r.status, json, text };
}

/**
 * The CLIENT's coin formula, CALLED rather than copied.
 *
 * This used to re-derive the arithmetic from the constants, which made the probe a third source of
 * truth for the payout and would have quietly frozen the pre-difficulty numbers in place. It now
 * calls the shipped function, so the probe compares the DATABASE against the real client.
 */
function clientCoins(
  won: boolean,
  roundsWon: number,
  wpm: number,
  accuracy: number,
  streak: number,
  botWpm: number,
): number {
  return coinsForMatch({ won, roundsWon, wpm, accuracy, streak, botWpm });
}

/**
 * Catalogue keys for what a profile owns — `"skin:ember"`, `"theme:paper"`.
 *
 * Skins and themes live in two SEPARATE arrays of bare ids, so comparing them against a
 * `kind:id` key without prefixing both is a silent always-false: every item looks unowned, the
 * probe tries to buy something it already has, and the purchase correctly refuses.
 */
function ownedKeys(p: { owned_skins: string[]; owned_themes: string[] }): Set<string> {
  return new Set<string>([
    ...p.owned_skins.map((id) => `skin:${id}`),
    ...p.owned_themes.map((id) => `theme:${id}`),
  ]);
}

/**
 * This probe's OWN throwaway account.
 *
 * Fresh, so the baseline is known: 0 coins, only the default skin and theme, nothing beaten. That
 * matters because the probe SPENDS the balance and consumes the catalogue — sharing a fixture with
 * the other probes meant the third run found every item already owned and reported a correct refusal
 * as a failure.
 */
const FIXTURE_EMAIL = "kt-coins@example.com";
const FIXTURE_PASSWORD = "kt-coins-test-9f3a";
/** Paid once a day, on the first WIN — see migration 0007. */
const FIRST_WIN_BONUS = 100;
const REF = creds.project_ref;
const MGMT = readFileSync(join(homedir(), "supabase-access-token"), "utf8").trim();

async function adminUsers(path: string, init: RequestInit = {}) {
  return fetch(`${URL_}/auth/v1/admin/users${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/** Delete any leftovers from an interrupted run, then create the account fresh. */
async function resetFixture(): Promise<void> {
  const list = await adminUsers("?per_page=200").then((r) => r.json());
  for (const u of (list.users ?? []).filter((x: { email: string }) => x.email === FIXTURE_EMAIL)) {
    await adminUsers(`/${u.id}`, { method: "DELETE" });
  }
  const created = await adminUsers("", {
    method: "POST",
    body: JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD, email_confirm: true }),
  });
  if (created.status >= 300) {
    const body = await created.text();
    if (!/already/i.test(body)) throw new Error(`could not create the fixture: HTTP ${created.status} ${body}`);
  }
}

async function dropFixture(uid: string): Promise<void> {
  await adminUsers(`/${uid}`, { method: "DELETE" });
}

/**
 * Submit a match with a gap in front of it.
 *
 * Two submissions less than 5 seconds apart are (correctly) read as scripted by the anti-cheat and
 * pay NOTHING, so a probe that fires them back to back measures the detector instead of the payout
 * and reports correct behaviour as a broken economy.
 */
async function play(body: Record<string, unknown>, token: string) {
  await new Promise((res) => setTimeout(res, 6000));
  return rpc("submit_match", body, token);
}

/**
 * Set the fixture's balance directly, through the management API.
 *
 * Clients cannot write `coins` any more — that is the whole point of the server-owned economy — so
 * the SPENDING tests are handed a known balance out-of-band. Earning is still asserted from zero,
 * on a fresh account, above.
 */
async function setCoins(uid: string, coins: number): Promise<void> {
  await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: `update kinetype.profiles set coins = ${coins} where id = '${uid}'` }),
  });
}

async function main() {
  await resetFixture();

  // ------------------------------------------------------------------ sign in the fixture
  const session = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD }),
  }).then((r) => r.json());

  const token: string = session.access_token;
  if (!token) {
    console.error("could not sign in the throwaway fixture");
    process.exit(1);
  }

  // ===================================================== 1. the price book cannot drift
  console.log("— the price book —");
  const catalog = (await rpc("cosmetic_catalog", {})).json as { kind: string; id: string; price: number }[];
  check("the catalog is readable and non-empty", Array.isArray(catalog) && catalog.length > 0, `${catalog?.length} rows`);

  const tsItems = [
    ...SKINS.map((s) => ({ kind: "skin", id: s.id, price: s.price })),
    ...THEMES.map((t) => ({ kind: "theme", id: t.id, price: t.price })),
  ];
  const serverMap = new Map(catalog.map((c) => [`${c.kind}:${c.id}`, c.price]));
  for (const item of tsItems) {
    check(
      `${item.kind} "${item.id}" is priced the same in SQL and TypeScript`,
      serverMap.get(`${item.kind}:${item.id}`) === item.price,
      `server ${serverMap.get(`${item.kind}:${item.id}`)} vs ts ${item.price}`,
    );
  }
  const tsKeys = new Set(tsItems.map((i) => `${i.kind}:${i.id}`));
  const extra = [...serverMap.keys()].filter((k) => !tsKeys.has(k));
  check("the server sells nothing the shop does not know about", extra.length === 0, extra.join(", "));

  // ============================================================ 2. earning, by the formula
  console.log("\n— earning —");
  const before = (await rpc("ensure_profile", {}, token)).json;
  const coinsBefore: number = before.coins;
  console.log(`  starting balance: ${coinsBefore} coins`);

  // A legitimate free-play win. This is the number the XP test suite already pins (141) — the
  // coin payout for a non-boss match is the same figure, so the two formulas are pinned together.
  const freeInput = { p_mode: "free", p_boss_id: null, p_bot_wpm: 40, p_won: true, p_wpm: 60, p_accuracy: 95, p_best_combo: 6, p_rounds_won: 2, p_rounds_lost: 0, p_streak: 2 };
  const afterFree = (await play(freeInput, token)).json;
  const expectedFree = clientCoins(true, 2, 60, 95, 2, freeInput.p_bot_wpm) + FIRST_WIN_BONUS;
  check(
    "a free-play win pays the client formula PLUS the first win of the day",
    afterFree.coins - coinsBefore === expectedFree,
    `paid ${afterFree.coins - coinsBefore}, expected ${expectedFree} (formula ${clientCoins(true, 2, 60, 95, 2, freeInput.p_bot_wpm)} + ${FIRST_WIN_BONUS} daily)`,
  );

  // A boss FIRST clear also pays that boss's bounty — server-side now, not added by the client.
  // Which boss still counts as a FIRST clear depends on what earlier runs beat, so it is looked up
  // rather than hardcoded: a repeated run against an already-beaten boss has no bounty to pay and
  // would read as a regression. `boss_clears` is own-row readable, so no RPC is needed.
  const clears = await fetch(`${URL_}/rest/v1/boss_clears?select=boss_id`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Accept-Profile": "kinetype" },
  }).then((r) => r.json());
  const clearedIds = new Set<string>((Array.isArray(clears) ? clears : []).map((r: { boss_id: string }) => r.boss_id));
  const boss = BOSSES.find((b) => !clearedIds.has(b.id));
  check("there is an unbeaten boss left to test the bounty with", Boolean(boss), `${clearedIds.size} of ${BOSSES.length} already cleared`);

  if (boss) {
    const bossInput = {
      p_mode: "boss", p_boss_id: boss.id, p_bot_wpm: boss.botWpm, p_won: true,
      p_wpm: 70, p_accuracy: 96, p_best_combo: 5, p_rounds_won: 2, p_rounds_lost: 1, p_streak: 1,
    };
    const afterBoss = (await play(bossInput, token)).json;
    const expectedBoss = clientCoins(true, 2, 70, 96, 1, boss.botWpm) + boss.rewardCoins;
    check(
      `a first clear of "${boss.id}" (${boss.botWpm} WPM) pays the match AND the bounty, once`,
      afterBoss.coins - afterFree.coins === expectedBoss,
      `paid ${afterBoss.coins - afterFree.coins}, expected ${expectedBoss}`,
    );

    // No second daily bonus here: the first WIN of the day was already the free-play match above.
    const afterRepeat = (await play(bossInput, token)).json;
    check(
      "clearing the same boss again pays the match but NOT the bounty",
      afterRepeat.coins - afterBoss.coins === clientCoins(true, 2, 70, 96, 1, boss.botWpm),
      `paid ${afterRepeat.coins - afterBoss.coins}`,
    );
  }
  // A tampered payload is now REFUSED outright. 9999 wpm is not "implausible", it is impossible,
  // and the anti-cheat rejects it before anything is recorded — so there is no payout to clamp.
  // The clamp still exists inside the formulas as defence in depth; it is simply unreachable from
  // here now, which is the point.
  const hostile = { p_mode: "free", p_boss_id: null, p_bot_wpm: 40, p_won: true, p_wpm: 9999, p_accuracy: 500, p_best_combo: 6, p_rounds_won: 99, p_rounds_lost: 0, p_streak: 99 };
  const afterHostile = await play(hostile, token);
  check("a tampered payload is REFUSED outright", afterHostile.status >= 400, `HTTP ${afterHostile.status}`);
  check(
    "…and the client formula CLAMPS to the same ceiling instead of inventing thousands",
    clientCoins(true, 99, 9999, 500, 99, 40) === 400,
    `client would say ${clientCoins(true, 99, 9999, 500, 99, 40)}, expected 400 (clamped base at the anchor rung)`,
  );

  // ========================================================================== 3. spending
  console.log("\n— spending —");
  // A known balance, granted out-of-band, because clients cannot write `coins` any more. The
  // cheapest item is 1 500 now, so earning it honestly in a probe would take a dozen paced matches.
  await setCoins(session.user.id, 12_000);
  const wallet = (await rpc("ensure_profile", {}, token)).json;
  console.log(`  balance for the purchase tests: ${wallet.coins} coins`);

  // Pick an affordable item the fixture does NOT already own. Which one that is depends on what
  // earlier runs bought, so it is DERIVED from the catalogue, never hardcoded — a hardcoded id is
  // "already owned" on the second run and reads as a broken purchase. Skins are preferred only
  // because the equip assertion is easier to read; a theme is just as valid.
  const ownedBefore = ownedKeys(wallet);
  const affordable = catalog
    .filter((c) => c.price > 0 && c.price <= wallet.coins && !ownedBefore.has(`${c.kind}:${c.id}`))
    .sort((a, b) => a.price - b.price);
  const target = affordable.find((c) => c.kind === "skin") ?? affordable[0];

  check("there is an affordable, unowned item to buy", Boolean(target), `${wallet.coins} coins, ${affordable.length} candidates`);
  if (!target) {
    console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
    process.exit(1);
  }
  console.log(`  buying ${target.kind} "${target.id}" for ${target.price}`);

  const bought = (await rpc("purchase_cosmetic", { p_kind: target.kind, p_id: target.id }, token)).json;
  check("buying debits exactly the server price", wallet.coins - bought.coins === target.price, `debit ${wallet.coins - bought.coins}, price ${target.price}`);
  check(
    "buying grants the item",
    [...bought.owned_skins, ...bought.owned_themes].includes(target.id),
    bought.owned_skins.join(","),
  );
  const wornAfterBuy = target.kind === "skin" ? bought.equipped_skin : bought.equipped_theme;
  check("buying wears what was bought", wornAfterBuy === target.id, `wearing ${wornAfterBuy}`);

  const again = await rpc("purchase_cosmetic", { p_kind: target.kind, p_id: target.id }, token);
  check("buying the same item twice is refused", again.status >= 400, `HTTP ${again.status}`);

  const phantom = await rpc("purchase_cosmetic", { p_kind: target.kind, p_id: "no-such-item" }, token);
  check("an item that does not exist is refused", phantom.status >= 400, `HTTP ${phantom.status}`);

  const badKind = await rpc("purchase_cosmetic", { p_kind: "horse", p_id: target.id }, token);
  check("an unknown item TYPE is refused", badKind.status >= 400, `HTTP ${badKind.status}`);

  // "Not enough coins" needs to actually BE short, and the starting balance is not known. Buy the
  // priciest affordable item until nothing is affordable, then a purchase must be refused. Bounded,
  // so a legacy balance cannot spin this.
  const priced = catalog.filter((c) => c.price > 0);
  let balance: number = bought.coins;
  let ownedNow = ownedKeys(bought);
  for (let i = 0; i < 5; i++) {
    const pick = priced
      .filter((c) => c.price <= balance && !ownedNow.has(`${c.kind}:${c.id}`))
      .sort((a, b) => b.price - a.price)[0];
    if (!pick) break;
    const r = await rpc("purchase_cosmetic", { p_kind: pick.kind, p_id: pick.id }, token);
    if (r.status >= 300) break;
    balance = r.json.coins;
    ownedNow = ownedKeys(r.json);
  }
  const tooExpensive = priced
    .filter((c) => c.price > balance && !ownedNow.has(`${c.kind}:${c.id}`))
    .sort((a, b) => a.price - b.price)[0];
  check(
    "the probe could spend the fixture down to a short balance",
    Boolean(tooExpensive) && balance >= 0,
    `balance ${balance}`,
  );
  if (tooExpensive) {
    const broke = await rpc("purchase_cosmetic", { p_kind: tooExpensive.kind, p_id: tooExpensive.id }, token);
    check(
      "an item costing more than the balance is refused",
      broke.status >= 400,
      `HTTP ${broke.status} (balance ${balance}, price ${tooExpensive.price})`,
    );
    const unchanged = (await rpc("ensure_profile", {}, token)).json;
    check("a refused purchase debits nothing", unchanged.coins === balance, `${balance} -> ${unchanged.coins}`);
  }

  const anonBuy = await rpc("purchase_cosmetic", { p_kind: "skin", p_id: "ember" });
  check("an anonymous purchase is refused", anonBuy.status >= 400, `HTTP ${anonBuy.status}`);

  // ============================================================== 4. wearing something
  console.log("\n— wearing —");
  const owned = (await rpc("ensure_profile", {}, token)).json;
  const beforeWear = owned.equipped_skin;

  await rpc("set_equipped", { p_skin: "spark", p_theme: owned.equipped_theme }, token);
  const wore = (await rpc("ensure_profile", {}, token)).json;
  check("wearing an OWNED skin is allowed", wore.equipped_skin === "spark", `${beforeWear} -> ${wore.equipped_skin}`);

  // Which skins the fixture owns depends on what the spend-down above managed to buy, so pick an
  // unowned one dynamically — falling back to an id that does not exist at all, which must be
  // ignored just the same.
  const notOwned = SKINS.map((s) => s.id).find((id) => !wore.owned_skins.includes(id)) ?? "no-such-skin";
  await rpc("set_equipped", { p_skin: notOwned, p_theme: wore.equipped_theme }, token);
  const refused = (await rpc("ensure_profile", {}, token)).json;
  check(
    "wearing an UNOWNED skin is ignored, not applied",
    refused.equipped_skin === "spark" && !refused.owned_skins.includes(notOwned),
    `tried ${notOwned}, still wearing ${refused.equipped_skin}`,
  );

  // ================================================ 5. ownership has no client write path
  console.log("\n— ownership is server-owned —");
  const beforeLegacy = refused;
  const legacy = await rpc("set_loadout", { p_skin: "voidwing", p_theme: "paper", p_owned_skins: ["voidwing"], p_owned_themes: ["paper"] }, token);
  check("the old self-reported set_loadout() is GONE", legacy.status >= 400, `HTTP ${legacy.status}`);
  const afterLegacy = (await rpc("ensure_profile", {}, token)).json;
  // The invariant that matters, and it does not depend on what the fixture happens to own: the
  // ownership set is IDENTICAL across the attempt.
  check(
    "…so attempting it changes nothing the client owns",
    JSON.stringify(afterLegacy.owned_skins) === JSON.stringify(beforeLegacy.owned_skins) &&
      JSON.stringify(afterLegacy.owned_themes) === JSON.stringify(beforeLegacy.owned_themes),
    `${beforeLegacy.owned_skins.join(",")} -> ${afterLegacy.owned_skins.join(",")}`,
  );

  const anonWear = await rpc("set_equipped", { p_skin: "spark", p_theme: "paper" });
  check("an anonymous set_equipped is refused", anonWear.status >= 400, `HTTP ${anonWear.status}`);

  // hand the fixture back in a clean state
  await rpc("set_equipped", { p_skin: "spark", p_theme: "paper" }, token);

  // Tidy up: a throwaway account must not sit on a live leaderboard.
  await dropFixture(session.user.id);

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
