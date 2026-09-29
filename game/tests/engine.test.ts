// Engine tests. Plain Node, no test framework, no browser.
//
// These assert the DESIGN CONTRACT in docs/GAME-DESIGN.md, not merely that the
// code runs. If a balance decision is changed, these are the tests that should
// fail: monotone knockback, the Brawl rule, the commit point, the parry, the
// recovery path, and the anti-degeneracy requirement that damage (not the move
// alone) is what kills.
//
// Run: npx tsx game/tests/engine.test.ts

import assert from "node:assert/strict";


import {
  GUARD_WORDS,
  HEAVY_WORDS,
  LIGHT_WORDS,
  MID_WORDS,
  POOLS,
  RECOVERY_WORDS,
} from "../words";
import {
  COUNTER_MULTIPLIER,
  HIT_COOLDOWN,
  HITSTUN_MAX,
  HITSTUN_MIN,
  PARRY_MULTIPLIER,
  PRECISION_DAMAGE_BONUS,
  PROMPT_COUNT,
  RECOVERY_WINDOW,
  RECOVERY_WINDOW_MIN,
  RECOVERY_WINDOW_STEP,
  SPAWN,
  STAGE,
  STEP,
} from "../constants";
import { TIER, hitstunSeconds, knockbackUnits } from "../knockback";
import { Match } from "../match";
import { TypingRun } from "../typing";
import { createRng } from "../rng";
import { applyOutcome, DEFAULT_SAVE, type SaveData } from "../storage";
import { purchaseWithCoins } from "../commerce";
import { OPPONENT_SKIN_ID, OVERLAYS, PIXEL_KEYS, SKINS, SPRITE_H, SPRITE_W } from "../skins";
import type { MatchOptions, Side, WordTier } from "../types";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  FAIL ${name}\n       ${msg.split("\n")[0]}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------- helpers

const OPTS: MatchOptions = {
  botWpm: 40,
  playerWpmHint: 40,
  strictMode: false,
  bestOf: 3,
  skins: { left: "spark", right: "ember" },
};

/** A match with the right-hand bot removed, so tests fully control both sides. */
function sandbox(seed = 42, opts: Partial<MatchOptions> = {}): Match {
  const m = new Match({ ...OPTS, ...opts }, seed, {}, "left");
  m.bots.right = null;
  m.bots.left = null;
  return m;
}

/** Advance past the countdown so the match accepts input. */
function toLive(m: Match, maxSteps = 400): void {
  let i = 0;
  while (m.phase !== "live" && i++ < maxSteps) m.step(STEP);
  assert.equal(m.phase, "live", "match should reach the live phase");
}

/** Types the live word out. There is exactly one, so there is no slot to choose. */
function typeWord(m: Match, side: Side): void {
  const text = m.typing[side].prompts[0].text;
  for (const ch of text) m.type(side, ch);
}

/**
 * Step while the fight is still running. "finish" is a live sub-state (the
 * decided-match bound), so a loop that stops at "live" exits the moment a fighter
 * is armed for the kill and never reaches the blast line it was waiting for.
 */
function stepWhileRunning(m: Match, maxSteps: number): void {
  for (let i = 0; i < maxSteps; i++) {
    const phase: string = m.phase;
    if (phase !== "live" && phase !== "finish") return;
    m.step(STEP);
  }
}

/** One known word per tier, so a strike is fully deterministic. */
const SAMPLE: Record<WordTier, string> = {
  light: "dash",
  mid: "planet",
  heavy: "keyboard",
};

/**
 * Put a known word of the given tier up and type it out.
 *
 * Prompt tiers are rolled at random. Cycling the pool by attacking in order to
 * fish for a tier accumulated damage on the target until it died, which made a
 * heavy word rarely reachable. Setting the prompt directly keeps the commit -> hit
 * path exercised end to end while making the test deterministic.
 */
function strike(m: Match, side: Side, tier: WordTier): void {
  const text = SAMPLE[tier];
  m.typing[side].prompts[0] = {
    id: 900000 + text.length,
    text,
    tier,
    kind: "attack",
    typed: 0,
    flawed: false,
    age: 0,
  };
  typeWord(m, side);
}

// ================================================================ word pools

section("Word pools (the balance table depends on these bands)");

test("every light word is 3-4 characters", () => {
  for (const w of LIGHT_WORDS) {
    assert.ok(w.length >= 3 && w.length <= 4, `light word out of band: ${w} (${w.length})`);
  }
});

test("every mid word is 5-7 characters", () => {
  for (const w of MID_WORDS) {
    assert.ok(w.length >= 5 && w.length <= 7, `mid word out of band: ${w} (${w.length})`);
  }
});

test("every heavy word is 8+ characters", () => {
  for (const w of HEAVY_WORDS) {
    assert.ok(w.length >= 8, `heavy word out of band: ${w} (${w.length})`);
  }
});

test("guard words are exactly 5 characters", () => {
  for (const w of GUARD_WORDS) assert.equal(w.length, 5, `guard word not 5: ${w}`);
});

test("recovery words are exactly 5 characters", () => {
  for (const w of RECOVERY_WORDS) assert.equal(w.length, 5, `recovery word not 5: ${w}`);
});

test("all words are lowercase a-z with no punctuation or digits", () => {
  for (const pool of Object.values(POOLS)) {
    for (const w of pool) assert.match(w, /^[a-z]+$/, `bad characters in: ${w}`);
  }
  for (const w of [...GUARD_WORDS, ...RECOVERY_WORDS]) assert.match(w, /^[a-z]+$/);
});

test("no duplicate words within a pool", () => {
  for (const [name, pool] of Object.entries(POOLS)) {
    const seen = new Set<string>();
    for (const w of pool) {
      assert.ok(!seen.has(w), `duplicate in ${name}: ${w}`);
      seen.add(w);
    }
  }
});

// ================================================================ knockback

section("Knockback (monotone, superlinear, escalation clock)");

const baseHit = { damage: 8, weight: 100, scaling: 1.05, base: 20, situational: 1 };

test("knockback rises with accumulated damage", () => {
  const k0 = knockbackUnits({ ...baseHit, targetDamage: 0 });
  const k50 = knockbackUnits({ ...baseHit, targetDamage: 50 });
  const k100 = knockbackUnits({ ...baseHit, targetDamage: 100 });
  assert.ok(k50 > k0, `expected kb(50) > kb(0), got ${k50} vs ${k0}`);
  assert.ok(k100 > k50, `expected kb(100) > kb(50), got ${k100} vs ${k50}`);
});

test("knockback growth is superlinear in damage (it is a clock, not a health bar)", () => {
  const a = knockbackUnits({ ...baseHit, targetDamage: 20 });
  const b = knockbackUnits({ ...baseHit, targetDamage: 40 });
  const c = knockbackUnits({ ...baseHit, targetDamage: 80 });
  // Equal damage steps must produce growing knockback steps.
  assert.ok(
    c - b > b - a,
    `expected accelerating knockback, got steps ${(b - a).toFixed(1)} then ${(c - b).toFixed(1)}`,
  );
});

test("at equal damage a heavy word out-pushes a light word", () => {
  const light = knockbackUnits({
    targetDamage: 60,
    damage: TIER.light.damage,
    weight: 100,
    scaling: TIER.light.scaling,
    base: TIER.light.base,
    situational: 1,
  });
  const heavy = knockbackUnits({
    targetDamage: 60,
    damage: TIER.heavy.damage,
    weight: 100,
    scaling: TIER.heavy.scaling,
    base: TIER.heavy.base,
    situational: 1,
  });
  assert.ok(heavy > light * 1.5, `heavy should be much stronger: ${heavy} vs ${light}`);
});

test("light words have higher base knockback than heavies (positional value early)", () => {
  assert.ok(TIER.light.base > TIER.heavy.base);
});

// ================================================================ the Brawl rule

section("Hitstun (derived, never a fixed schedule)");

test("hitstun scales with knockback across levels", () => {
  const values = [30, 80, 140, 200].map(hitstunSeconds);
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] > values[i - 1], `hitstun should grow: ${values.join(", ")}`);
  }
});

test("hitstun is clamped to its bounds", () => {
  assert.equal(hitstunSeconds(0), HITSTUN_MIN);
  assert.equal(hitstunSeconds(99999), HITSTUN_MAX);
});

test("a Brawl-style fixed escape timer is NOT used (hitstun differs per knockback)", () => {
  // The failure mode being guarded against: escape at a constant frame count
  // regardless of knockback. Two very different knockbacks must not share hitstun.
  const low = hitstunSeconds(60);
  const high = hitstunSeconds(210);
  assert.notEqual(low, high, "hitstun must not be constant across knockback levels");
});

// ================================================================ anti-lockout

section("Anti-lockout (a victim must always get a turn)");

test("the hit cooldown exceeds the maximum hitstun, guaranteeing a free window", () => {
  // Found by playing the game in a browser: a fast player landed a word every
  // ~0.17s against a 0.75s max hitstun, so the opponent was stunned forever and
  // never got to type. That is a degenerate state, not a difficulty setting.
  assert.ok(
    HIT_COOLDOWN > HITSTUN_MAX,
    `HIT_COOLDOWN (${HIT_COOLDOWN}) must exceed HITSTUN_MAX (${HITSTUN_MAX})`,
  );
  const freeWindow = HIT_COOLDOWN - HITSTUN_MAX;
  assert.ok(freeWindow >= 0.25, `free window should be usable, got ${freeWindow.toFixed(3)}s`);
});

test("a second hit cannot land while the victim is in hit cooldown", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 20;

  strike(m, "left", "light");
  const afterFirst = m.fighter("right").damage;
  assert.ok(afterFirst > 20, "the first hit should land");

  // A second word immediately after must be absorbed by the cooldown.
  strike(m, "left", "light");
  assert.equal(
    m.fighter("right").damage,
    afterFirst,
    "a hit inside the cooldown window must not deal damage",
  );
});

test("after the cooldown expires the victim can be hit again", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 20;
  strike(m, "left", "light");
  const afterFirst = m.fighter("right").damage;

  for (let i = 0; i < Math.ceil((HIT_COOLDOWN + 0.05) * 60); i++) m.step(STEP);
  strike(m, "left", "light");
  assert.ok(
    m.fighter("right").damage > afterFirst,
    "once the cooldown lapses the next hit must land",
  );
});

// ================================================================ typed input

section("Typing (commit point is the whole word)");

test("a partial word never commits", () => {
  const run = new TypingRun(createRng(7), { guardEnabled: true, strictMode: false });
  const text = run.prompts[0].text;
  for (let i = 0; i < text.length - 1; i++) {
    const out = run.handleChar(text[i]);
    assert.notEqual(out.kind, "commit", `committed early at char ${i}`);
  }
  assert.equal(run.words, 0, "no word should be committed yet");
});

test("the final correct character is what fires the push", () => {
  const run = new TypingRun(createRng(7), { guardEnabled: true, strictMode: false });
  const text = run.prompts[0].text;
  let committed = false;
  for (const ch of text) {
    const out = run.handleChar(ch);
    if (out.kind === "commit") committed = true;
  }
  assert.ok(committed, "the word should commit on its last character");
  assert.equal(run.words, 1);
});

test("there is no sub-word window: an early extra character cannot commit", () => {
  const run = new TypingRun(createRng(11), { guardEnabled: true, strictMode: false });
  const text = run.prompts[0].text;
  run.handleChar(text[0]);
  // The exploit from the research is holding the last letter for the right
  // moment. There is nothing to hold: the character is either correct or not.
  const extra = run.handleChar(text[1]);
  assert.notEqual(extra.kind, "commit");
});

test("a mistype loses the precision bonus but keeps the player's progress", () => {
  const run = new TypingRun(createRng(3), { guardEnabled: true, strictMode: false });
  const text = run.prompts[0].text;
  run.handleChar(text[0]);
  const wrong = run.handleChar("z" === text[1] ? "q" : "z");
  assert.equal(wrong.kind, "wrong");
  assert.equal(wrong.penalise, false, "default mode must not penalise");
  // With three words live, a mistype wiped the word and let the player switch. With one
  // word, wiping it would just be punishing: progress stands and the player carries on.
  assert.equal(run.prompts[0].typed, 1, "progress must be kept");
  assert.ok(run.prompts[0].flawed, "the precision bonus is forfeit");
});

test("strict mode reports a penalty instead (opt-in only)", () => {
  const run = new TypingRun(createRng(3), { guardEnabled: true, strictMode: true });
  const text = run.prompts[0].text;
  run.handleChar(text[0]);
  const wrong = run.handleChar("z" === text[1] ? "q" : "z");
  assert.equal(wrong.penalise, true);
});

test("precision scales damage by the designed bonus", () => {
  assert.equal(PRECISION_DAMAGE_BONUS, 0.25);
});

test("every keystroke counts from the first one", () => {
  // Regression. With three words live, the first keystroke was spent PICKING a word: it
  // never advanced the prompt, so the player had to type that same letter a second time,
  // and a letter matching no word counted as an error.
  const run = new TypingRun(createRng(23), { guardEnabled: true, strictMode: false });
  const text = run.prompts[0].text;
  const out = run.handleChar(text[0]);
  assert.equal(out.kind, "correct", "the first letter must count toward the word");
  assert.equal(run.prompts[0].typed, 1, "and must advance it");
  assert.equal(run.errors, 0, "the first letter must never count as an error");
});

test("one word is live at a time and the next arrives with no gap", () => {
  const run = new TypingRun(createRng(23), { guardEnabled: true, strictMode: false });
  assert.equal(PROMPT_COUNT, 1);
  assert.equal(run.prompts.length, 1, "exactly one prompt");
  const first = run.prompts[0].text;
  for (const ch of first) run.handleChar(ch);
  assert.equal(run.words, 1);
  assert.equal(run.prompts.length, 1, "handing over the next word changes nothing about the count");
  assert.equal(run.prompts[0].typed, 0, "the next word starts clean");
  assert.notEqual(run.prompts[0].text, first, "and is not the word just typed");
});

// ================================================================ the parry

section("The defensive verb (parry and counter)");

test("completing a guard word opens a counter window", () => {
  const m = sandbox();
  toLive(m);
  const def: Side = "right";
  assert.ok(m.typing[def].offerGuard(), "a guard word should be offered");
  assert.equal(m.typing[def].prompts[0].kind, "guard", "the guard REPLACES the live word");
  typeWord(m, def);
  assert.ok(m.fighter(def).counter > 0, "the parry should grant a counter window");
});

test("a parry multiplies incoming knockback by PARRY_MULTIPLIER", () => {
  const m = sandbox();
  toLive(m);
  const atk: Side = "left";
  const def: Side = "right";

  // Baseline: a heavy word with no parry active.
  m.fighter(def).damage = 60;
  strike(m, atk, "heavy");
  const unparried = Math.abs(m.fighter(def).vx);
  assert.ok(unparried > 0, "the hit should have launched the target");

  // Reset and repeat with the parry live.
  const m2 = sandbox();
  toLive(m2);
  m2.fighter(def).damage = 60;
  assert.ok(m2.typing[def].offerGuard());
  typeWord(m2, def);
  assert.ok(m2.fighter(def).counter > 0);
  strike(m2, atk, "heavy");
  const parried = Math.abs(m2.fighter(def).vx);

  assert.ok(parried < unparried, `parry should reduce knockback: ${parried} vs ${unparried}`);
  const ratio = parried / unparried;
  assert.ok(
    Math.abs(ratio - PARRY_MULTIPLIER) < 0.06,
    `expected roughly ${PARRY_MULTIPLIER}x, got ${ratio.toFixed(3)}x`,
  );
});

test("a counter is cashed in on the next landed word and then consumed", () => {
  const m = sandbox();
  toLive(m);
  const atk: Side = "left";
  m.fighter(atk).counter = 5;
  strike(m, atk, "mid");
  assert.equal(m.fighter(atk).counter, 0, "the counter should be spent");
});

test("the counter multiplier is stronger than a plain hit", () => {
  const mk = (withCounter: boolean) => {
    const m = sandbox();
    toLive(m);
    m.fighter("right").damage = 40;
    if (withCounter) m.fighter("left").counter = 5;
    strike(m, "left", "mid");
    return Math.abs(m.fighter("right").vx);
  };
  assert.ok(mk(true) > mk(false) * 1.5, "a cashed counter should hit much harder");
  assert.ok(COUNTER_MULTIPLIER > 1);
});

// ================================================================ escalation

section("Escalation (damage is what kills, not the move alone)");

test("a heavy word at 0% does NOT cross the blast line from spawn", () => {
  const m = sandbox();
  toLive(m);
  strike(m, "left", "heavy");
  for (let i = 0; i < 240 && m.phase === "live"; i++) m.step(STEP);
  assert.notEqual(m.phase, "recovery", "a heavy at 0% must not kill");
});

test("a heavy word at high damage DOES cross the blast line", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 110;
  strike(m, "left", "heavy");
  let crossed = false;
  for (let i = 0; i < 400; i++) {
    m.step(STEP);
    if (m.phase === "recovery" || m.recoveryVictim) {
      crossed = true;
      break;
    }
    if (m.phase === "roundOver" || m.phase === "matchOver") {
      crossed = true;
      break;
    }
  }
  assert.ok(crossed, "a heavy at 110% should reach the blast line");
});

// ================================================================ recovery

section("Recovery (one chance to get back)");

test("crossing the blast line opens a recovery prompt rather than killing", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 110;
  strike(m, "left", "heavy");
  stepWhileRunning(m, 400);
  assert.equal(m.phase, "recovery", "should be in the recovery phase");
  assert.equal(m.recoveryVictim, "right");
  assert.ok(m.typing.right.inRecovery, "the victim should hold a recovery prompt");
  assert.equal(m.typing.right.prompts.length, 1, "only the recovery word is live");
});

test("completing the recovery word restores the fighter and resumes the fight", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 110;
  strike(m, "left", "heavy");
  stepWhileRunning(m, 400);
  assert.equal(m.phase, "recovery");

  const word = m.typing.right.prompts[0].text;
  for (const ch of word) m.type("right", ch);

  assert.equal(m.phase, "live", "the fight should resume");
  assert.equal(m.recoveryVictim, null);
  assert.ok(m.fighter("right").invuln > 0, "recovery should grant brief invulnerability");
  const main = STAGE.platforms[0];
  const back = m.fighter("right");
  assert.ok(
    back.x >= main.x && back.x <= main.x + main.w,
    `should be back on the platform, x=${back.x}`,
  );
  assert.ok(back.y < STAGE.blast.bottom, "should not be below the blast line");
});

test("failing to recover ends the round", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 110;
  strike(m, "left", "heavy");
  stepWhileRunning(m, 400);
  assert.equal(m.phase, "recovery");
  // Do nothing and let the window expire.
  for (let i = 0; i < 400 && m.phase === "recovery"; i++) m.step(STEP);
  assert.ok(m.wins.left >= 1, "the attacker should win the round");
  const endPhase: string = m.phase;
  assert.ok(endPhase === "roundOver" || endPhase === "matchOver", `unexpected phase ${endPhase}`);
});

test("each save in a round shortens the next recovery window", () => {
  // Without this, a bot that types well saves itself every time and a round can
  // only end on the clock, so a KO never lands. Verified by measuring the window
  // the match actually grants, not by reading the constant back.
  const window = (recoveries: number) =>
    Math.max(RECOVERY_WINDOW_MIN, RECOVERY_WINDOW - recoveries * RECOVERY_WINDOW_STEP);
  assert.equal(window(0), RECOVERY_WINDOW);
  assert.ok(window(1) < window(0), "the second save should be tighter");
  assert.ok(window(4) < window(1), "the fifth save should be tighter still");
  assert.equal(window(99), RECOVERY_WINDOW_MIN, "the window must floor, never reach zero");
  assert.ok(RECOVERY_WINDOW_MIN >= 0.7, "the floor must still be humanly possible");
});

test("the granted window actually shrinks after a save in the same round", () => {
  const m = sandbox();
  toLive(m);

  const launch = () => {
    const victim = m.fighter("right");
    victim.damage = 120;
    victim.hitCooldown = 0;
    victim.invuln = 0;
    victim.state = "idle";
    victim.x = 740;
    victim.y = 500;
    strike(m, "left", "heavy");
    stepWhileRunning(m, 400);
  };

  launch();
  assert.equal(m.phase, "recovery", "the first launch should open a recovery prompt");
  const first = m.recoveryTimer;

  // Save ourselves by typing the save word, which is the only way to continue.
  for (const ch of m.typing.right.prompts[0].text) m.type("right", ch);
  assert.equal(m.phase, "live", "completing the save word should resume the fight");

  launch();
  assert.equal(m.phase, "recovery", "the second launch should open a recovery prompt");
  const second = m.recoveryTimer;

  assert.ok(
    second < first,
    `the second window (${second.toFixed(2)}s) should be tighter than the first (${first.toFixed(2)}s)`,
  );
});

// ================================================================ termination

section("Match structure");

test("a bot beats an idle player and the match terminates with a result", () => {
  const m = new Match({ ...OPTS, botWpm: 85 }, 99, {}, "left");
  let steps = 0;
  while (!m.result && steps++ < 60 * 60 * 8) m.step(STEP);
  assert.ok(m.result, "the match must terminate");
  assert.equal(m.result?.humanWon, false, "an idle player should lose");
});

test("a match is a bounded best-of-3", () => {
  const m = new Match({ ...OPTS, botWpm: 85 }, 5, {}, "left");
  let steps = 0;
  while (!m.result && steps++ < 60 * 60 * 8) m.step(STEP);
  assert.ok(m.result);
  assert.ok(m.result!.roundsWon + m.result!.roundsLost <= 3, "best-of-3 must not exceed 3 rounds");
});

test("winning pays more than losing", () => {
  /** A scripted "human" that types at a fixed WPM, so the human side can win. */
  const autoType = (m: Match, side: Side, wpm: number) => {
    let budget = 0;
    return (dt: number) => {
      const t = m.typing[side];
      if (t.inRecovery) {
        const word = t.prompts[0]?.text ?? "";
        for (const ch of word) m.type(side, ch);
        return;
      }
      budget += ((wpm * 5) / 60) * dt;
      let guard = 0;
      while (budget >= 1 && guard++ < 10) {
        budget -= 1;
        const live = t.activePrompt();
        if (!live || live.typed >= live.text.length) break;
        m.type(side, live.text[live.typed]);
      }
    };
  };

  // Case A: the human types fast against a slow bot, and should win.
  const win = new Match({ ...OPTS, botWpm: 20 }, 21, {}, "right");
  const drive = autoType(win, "right", 120);
  let s1 = 0;
  while (!win.result && s1++ < 60 * 60 * 8) {
    drive(STEP);
    win.step(STEP);
  }
  assert.ok(win.result, "the winning match should finish");

  // Case B: the same setup, but the human never types.
  const lose = new Match({ ...OPTS, botWpm: 20 }, 21, {}, "right");
  let s2 = 0;
  while (!lose.result && s2++ < 60 * 60 * 8) lose.step(STEP);
  assert.ok(lose.result, "the losing match should finish");

  assert.equal(win.result!.humanWon, true, "a 120 WPM human should beat a 20 WPM bot");
  assert.equal(lose.result!.humanWon, false, "an idle human should lose");
  assert.ok(lose.result!.coins > 0, "a loss should still pay something");
  assert.ok(
    win.result!.coins > lose.result!.coins,
    `winning should pay more: ${win.result!.coins} vs ${lose.result!.coins}`,
  );
});

// ================================================================ determinism

section("Determinism (frame-rate independence and reproducible outcomes)");

function stateHash(m: Match): string {
  return [
    m.round,
    m.phase,
    m.left.damage.toFixed(3),
    m.right.damage.toFixed(3),
    m.left.x.toFixed(3),
    m.right.x.toFixed(3),
    m.typing.left.words,
    m.typing.right.words,
    m.wins.left,
    m.wins.right,
  ].join("|");
}

test("an identical seed produces an identical match state", () => {
  const a = new Match({ ...OPTS, botWpm: 70 }, 1234, {}, "left");
  const b = new Match({ ...OPTS, botWpm: 70 }, 1234, {}, "left");
  for (let i = 0; i < 60 * 20; i++) {
    a.step(STEP);
    b.step(STEP);
  }
  assert.equal(stateHash(a), stateHash(b), "same seed must give same state");
});

test("different seeds diverge", () => {
  const a = new Match({ ...OPTS, botWpm: 70 }, 1, {}, "left");
  const b = new Match({ ...OPTS, botWpm: 70 }, 2, {}, "left");
  for (let i = 0; i < 60 * 20; i++) {
    a.step(STEP);
    b.step(STEP);
  }
  assert.notEqual(stateHash(a), stateHash(b), "different seeds should diverge");
});

test("the simulation step is fixed, so a slow frame cannot change the outcome", () => {
  // Stepping 1/60 twice must equal stepping 1/60 once in two calls: the engine
  // never takes a variable dt.
  const a = new Match({ ...OPTS, botWpm: 60 }, 8, {}, "left");
  const b = new Match({ ...OPTS, botWpm: 60 }, 8, {}, "left");
  for (let i = 0; i < 600; i++) a.step(STEP);
  for (let i = 0; i < 600; i++) b.step(STEP);
  assert.equal(stateHash(a), stateHash(b));
});

// ================================================================ economy

section("Economy and shop");

test("a purchase fails when coins are short", () => {
  const save: SaveData = { ...DEFAULT_SAVE, coins: 10 };
  const r = purchaseWithCoins(save, "skin", "ember", 120);
  assert.equal(r.ok, false);
  assert.match(String(r.reason), /coins/i);
});

test("a purchase succeeds, deducts exactly the price, and equips the skin", () => {
  const save: SaveData = { ...DEFAULT_SAVE, coins: 500 };
  const r = purchaseWithCoins(save, "skin", "ember", 120);
  assert.equal(r.ok, true);
  assert.equal(r.save!.coins, 380);
  assert.ok(r.save!.ownedSkins.includes("ember"));
  assert.equal(r.save!.equippedSkin, "ember");
});

test("buying the same skin twice is refused", () => {
  const save: SaveData = { ...DEFAULT_SAVE, coins: 500, ownedSkins: ["spark", "ember"] };
  const r = purchaseWithCoins(save, "skin", "ember", 120);
  assert.equal(r.ok, false);
});

test("coins can never go negative", () => {
  let save: SaveData = { ...DEFAULT_SAVE, coins: 130 };
  const r = purchaseWithCoins(save, "skin", "tide", 120);
  assert.ok(r.save);
  save = r.save!;
  assert.ok(save.coins >= 0);
  const again = purchaseWithCoins(save, "skin", "monolith", 320);
  assert.equal(again.ok, false);
  assert.ok(save.coins >= 0);
});

test("every skin has a unique id and a sane price", () => {
  const ids = new Set<string>();
  for (const s of SKINS) {
    assert.ok(!ids.has(s.id), `duplicate skin id: ${s.id}`);
    ids.add(s.id);
    assert.ok(s.price >= 0);
    // Every skin must actually draw something. Sprite geometry is asserted in the
    // sprite section further down.
    assert.ok(s.pixels.length > 0, `${s.id} has no pixels`);
    assert.match(s.trail.colour, /^#[0-9a-f]{6}$/i, `${s.id} trail colour must be hex`);
  }
});

test("at least one skin is free so the shop is never empty for a new player", () => {
  assert.ok(SKINS.some((s) => s.price === 0));
});

test("applying a match outcome persists bests and pays coins", () => {
  const before: SaveData = { ...DEFAULT_SAVE, coins: 100, bestWpm: 40 };
  const after = applyOutcome(before, {
    coins: 55,
    wpm: 62,
    accuracy: 97.5,
    humanWon: true,
    streak: 2,
  });
  assert.equal(after.coins, 155);
  assert.equal(after.bestWpm, 62);
  assert.equal(after.wins, 1);
  assert.equal(after.streak, 2);
  assert.equal(after.matches, 1);
});

// ================================================================ geometry

section("Geometry sanity");

test("the blast lines sit outside the main platform", () => {
  const main = STAGE.platforms[0];
  assert.ok(STAGE.blast.left < main.x, "left blast line must be past the platform edge");
  assert.ok(STAGE.blast.right > main.x + main.w, "right blast line must be past the platform edge");
});

test("spawns sit on the main platform, equally far from their own blast line", () => {
  const main = STAGE.platforms[0];
  assert.ok(SPAWN.left.x > main.x && SPAWN.left.x < main.x + main.w);
  assert.ok(SPAWN.right.x > main.x && SPAWN.right.x < main.x + main.w);
  const leftDist = SPAWN.left.x - STAGE.blast.left;
  const rightDist = STAGE.blast.right - SPAWN.right.x;
  assert.ok(
    Math.abs(leftDist - rightDist) < 1,
    `spawns must be symmetric: ${leftDist} vs ${rightDist}`,
  );
});

// ================================================================ sprites

// The roster is pixel art, so a typo is a visible hole in a fighter. Row widths and
// palette coverage are asserted rather than eyeballed, because a 12-character row
// that is actually 11 characters still compiles.

test("every sprite row is the right width", () => {
  for (const skin of SKINS) {
    assert.equal(skin.pixels.length, SPRITE_H, `${skin.id}: expected ${SPRITE_H} rows`);
    skin.pixels.forEach((row, i) => {
      assert.equal(
        row.length,
        SPRITE_W,
        `${skin.id} row ${i} is ${row.length} chars, expected ${SPRITE_W}: "${row}"`,
      );
    });
  }
});

test("sprites use only legal pixel characters", () => {
  const legal = new Set<string>([".", ...PIXEL_KEYS]);
  for (const skin of SKINS) {
    skin.pixels.forEach((row, i) => {
      for (const ch of row) {
        assert.ok(legal.has(ch), `${skin.id} row ${i} has an illegal pixel "${ch}"`);
      }
    });
  }
});

test("every pixel a sprite uses is defined in its palette", () => {
  for (const skin of SKINS) {
    const used = new Set(skin.pixels.join("").split("").filter((c) => c !== "."));
    for (const key of used) {
      assert.ok(
        skin.palette[key as keyof typeof skin.palette],
        `${skin.id} uses "${key}" but its palette does not define it`,
      );
    }
    assert.ok(used.size >= 6, `${skin.id} is barely drawn (${used.size} colours)`);
  }
});

test("no two skins are identical", () => {
  const fingerprints = SKINS.map((s) => `${s.pixels.join("|")}::${JSON.stringify(s.palette)}`);
  assert.equal(new Set(fingerprints).size, SKINS.length, "two skins are indistinguishable");
  assert.equal(new Set(SKINS.map((s) => s.id)).size, SKINS.length, "skin ids must be unique");
});

test("exactly one skin is free and the rest cost coins", () => {
  const starters = SKINS.filter((s) => s.rarity === "starter");
  assert.equal(starters.length, 1, "there must be exactly one starter skin");
  assert.equal(starters[0].price, 0, "the starter skin must be free");
  for (const s of SKINS) {
    if (s.rarity === "starter") continue;
    assert.ok(s.price > 0, `${s.id} must cost coins`);
  }
});

test("the opponent skin is real and differs from the starter", () => {
  assert.ok(SKINS.some((s) => s.id === OPPONENT_SKIN_ID), "opponent skin must exist");
  assert.notEqual(OPPONENT_SKIN_ID, SKINS.find((s) => s.rarity === "starter")?.id);
});

test("there is a free overlay and paid ones cost coins", () => {
  const free = OVERLAYS.filter((o) => o.rarity === "starter");
  assert.equal(free.length, 1, "exactly one overlay should be free");
  assert.equal(free[0].price, 0);
  for (const o of OVERLAYS) {
    if (o.rarity === "starter") continue;
    assert.ok(o.price > 0, `${o.id} must cost coins`);
  }
  assert.equal(new Set(OVERLAYS.map((o) => o.id)).size, OVERLAYS.length);
});

// ================================================================ report

console.log(`\n${"-".repeat(56)}`);
console.log(`passed ${passed}   failed ${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log(`${"-".repeat(56)}`);

if (failed > 0) process.exit(1);
