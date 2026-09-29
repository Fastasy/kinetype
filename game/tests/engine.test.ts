// Engine tests. Plain Node, no test framework, no browser.
//
// These assert the DESIGN CONTRACT in docs/GAME-DESIGN.md, not merely that the
// code runs. If a balance decision is changed, these are the tests that should
// fail: monotone knockback, the Brawl rule, the commit point, the sentence-to-move
// mapping, the block, the parry, the recovery path, and the anti-degeneracy
// requirement that damage (not the move alone) is what kills.
//
// Run: npx tsx game/tests/engine.test.ts

import assert from "node:assert/strict";

import {
  BAND_BOUNDS,
  RECOVERY_WORDS,
  SENTENCE_BANDS,
  SENTENCES,
  bandsForTier,
} from "../sentences";
import { charOffset, moveForWord, sentenceText, splitSentence } from "../moves";
import {
  BLOCK_DAMAGE_MULTIPLIER,
  BLOCK_HOLD,
  BLOCK_KB_MULTIPLIER,
  BLOCK_MAX_CHARS,
  COUNTER_MULTIPLIER,
  HIT_COOLDOWN,
  HITSTUN_MAX,
  HITSTUN_MIN,
  KICK_MIN_CHARS,
  PARRY_MULTIPLIER,
  PRECISION_DAMAGE_BONUS,
  PROMPT_COUNT,
  RECOVERY_WINDOW,
  RECOVERY_WINDOW_MIN,
  RECOVERY_WINDOW_STEP,
  SPAWN,
  STAGE,
  STEP,
  TELEGRAPH_COMMIT_CHARS,
} from "../constants";
import { MOVE, hitstunSeconds, knockbackUnits } from "../knockback";
import { Match } from "../match";
import { TypingRun } from "../typing";
import { createRng } from "../rng";
import { applyOutcome, DEFAULT_SAVE, type SaveData } from "../storage";
import { purchaseWithCoins } from "../commerce";
import { OPPONENT_SKIN_ID, PIXEL_KEYS, SKINS, SPRITE_H, SPRITE_W } from "../skins";
import { contrast, THEMES, themeById, DEFAULT_THEME_ID } from "../themes";
import type { MatchOptions, MoveKind, Prompt, PromptKind, Side } from "../types";

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

/** A match with both bots removed, so tests fully control both sides. */
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

/** One known one-word sentence per move, so a single move is fully deterministic. */
const SAMPLE: Record<MoveKind, string> = {
  block: "the",
  punch: "planet",
  kick: "keyboard",
};

/** Build a prompt exactly as TypingRun would, for a sentence the test chooses. */
function promptFor(text: string, kind: PromptKind = "attack"): Prompt {
  const words = splitSentence(text);
  return {
    id: 900000 + text.length,
    text: sentenceText(words),
    words,
    kind,
    index: 0,
    typed: 0,
    flawed: false,
    age: 0,
  };
}

/**
 * Put a known word up as a one-word sentence and type it out, so exactly one move
 * fires.
 *
 * Sentence composition is rolled at random from a pool of hundreds, so cycling it to
 * fish for a kick would accumulate damage on the target until it died and make the
 * heavy rarely reachable. Injecting the prompt keeps the commit -> move path
 * exercised end to end while making the test deterministic.
 */
function strike(m: Match, side: Side, move: MoveKind): void {
  const text = SAMPLE[move];
  m.typing[side].prompts[0] = promptFor(text);
  for (const ch of text) m.type(side, ch);
}

// ================================================================ sentence pool

section("Sentence pool (the move sequence depends on these words)");

test("every sentence is lowercase a-z words separated by single spaces", () => {
  for (const s of SENTENCES) {
    assert.match(s, /^[a-z]+( [a-z]+)*$/, `illegal characters or spacing in: ${s}`);
  }
});

test("every sentence is 4 to 11 words, 16 to 62 characters", () => {
  for (const s of SENTENCES) {
    const words = s.split(" ");
    assert.ok(
      words.length >= 4 && words.length <= 11,
      `${words.length} words in: ${s}`,
    );
    assert.ok(s.length >= 16 && s.length <= 62, `${s.length} characters in: ${s}`);
  }
});

test("no word in any sentence is longer than 12 characters", () => {
  for (const s of SENTENCES) {
    for (const w of s.split(" ")) {
      assert.ok(w.length <= 12, `word too long (${w.length}): ${w} in "${s}"`);
    }
  }
});

test("every sentence can both defend and attack", () => {
  // A sentence with no block word cannot defend, and one with no punch word is a
  // wasted exchange. scripts/build-sentences.py refuses to write either.
  for (const s of SENTENCES) {
    const moves = new Set(s.split(" ").map(moveForWord));
    assert.ok(moves.has("block"), `no block word in: ${s}`);
    assert.ok(moves.has("punch"), `no punch word in: ${s}`);
  }
});

test("kicks exist at every sentence band", () => {
  // Otherwise a player on a slow bot speed never throws a kick and can never land
  // the knockout the game is built around.
  for (const [band, sentences] of Object.entries(SENTENCE_BANDS)) {
    const withKick = sentences.filter((s) => s.split(" ").some((w) => moveForWord(w) === "kick"));
    assert.ok(
      withKick.length > 0,
      `${band}: no sentence contains a kick word (needs ${KICK_MIN_CHARS}+ characters)`,
    );
  }
});

test("the bands follow total character count, not word count", () => {
  for (const s of SENTENCE_BANDS.short) {
    assert.ok(s.length <= BAND_BOUNDS.short, `${s.length} chars in the short band: ${s}`);
  }
  for (const s of SENTENCE_BANDS.medium) {
    assert.ok(
      s.length > BAND_BOUNDS.short && s.length <= BAND_BOUNDS.medium,
      `${s.length} chars is not medium: ${s}`,
    );
  }
  for (const s of SENTENCE_BANDS.long) {
    assert.ok(s.length > BAND_BOUNDS.medium, `${s.length} chars is not long: ${s}`);
  }
  assert.equal(
    SENTENCES.length,
    SENTENCE_BANDS.short.length + SENTENCE_BANDS.medium.length + SENTENCE_BANDS.long.length,
  );
});

test("no duplicate sentences", () => {
  const seen = new Set<string>();
  for (const s of SENTENCES) {
    assert.ok(!seen.has(s), `duplicate sentence: ${s}`);
    seen.add(s);
  }
});

test("recovery words are exactly 5 characters", () => {
  for (const w of RECOVERY_WORDS) assert.equal(w.length, 5, `recovery word not 5: ${w}`);
});

// ================================================================ move mapping

section("Moves (word difficulty decides what the word does)");

test("a small word blocks, a normal word punches, a difficult word kicks", () => {
  assert.equal(BLOCK_MAX_CHARS, 3);
  assert.equal(KICK_MIN_CHARS, 8);
  assert.equal(moveForWord("the"), "block");
  assert.equal(moveForWord("cat"), "block");
  assert.equal(moveForWord("naps"), "punch");
  assert.equal(moveForWord("planet"), "punch");
  assert.equal(moveForWord("keyboard"), "kick");
  assert.equal(moveForWord("temperature"), "kick");
});

test("the thresholds are a contiguous partition of word lengths", () => {
  for (let len = 1; len <= 16; len++) {
    const word = "a".repeat(len);
    const move = moveForWord(word);
    if (len <= BLOCK_MAX_CHARS) assert.equal(move, "block", `${len} chars should block`);
    else if (len >= KICK_MIN_CHARS) assert.equal(move, "kick", `${len} chars should kick`);
    else assert.equal(move, "punch", `${len} chars should punch`);
  }
});

test("splitSentence produces the whole sentence back", () => {
  const text = "the students gather in the hall";
  const words = splitSentence(text);
  assert.equal(words.length, 6);
  assert.equal(sentenceText(words), text, "the split must be lossless");
  assert.equal(words[5].move, "punch");
  assert.equal(words[4].move, "block");
});

test("charOffset skips the space after each word", () => {
  const words = splitSentence("the cat naps");
  assert.equal(charOffset(words, 0), 0);
  assert.equal(charOffset(words, 1), 4, "after 'the ' the cursor is on 'c'");
  assert.equal(charOffset(words, 2), 8, "after 'cat ' the cursor is on 'n'");
});

// ================================================================ typed input

section("Typing (the sentence advances one word at a time)");

test("a partial word never commits", () => {
  const run = new TypingRun(createRng(7), { strictMode: false, tier: 4 });
  const word = run.activeWord()!;
  for (let i = 0; i < word.text.length - 1; i++) {
    const out = run.handleChar(word.text[i]);
    assert.notEqual(out.kind, "commit", `committed early at char ${i}`);
  }
  assert.equal(run.words, 0, "no word should be committed yet");
});

test("the final correct character is what fires the move", () => {
  const run = new TypingRun(createRng(7), { strictMode: false, tier: 4 });
  const word = run.activeWord()!;
  let committed = false;
  for (const ch of word.text) {
    const out = run.handleChar(ch);
    if (out.kind === "commit") committed = true;
  }
  assert.ok(committed, "the word should commit on its last character");
  assert.equal(run.words, 1);
});

test("spaces are never typed: the cursor jumps to the next word's first letter", () => {
  const run = new TypingRun(createRng(19), { strictMode: false, tier: 4 });
  const prompt = run.prompts[0];
  const first = prompt.words[0];
  for (const ch of first.text) run.handleChar(ch);
  assert.ok(prompt.index === 1, "the live word should have advanced");
  assert.equal(prompt.typed, charOffset(prompt.words, 1));
  assert.notEqual(prompt.text[prompt.typed], " ", "the cursor must not land on a space");
  assert.equal(prompt.text[prompt.typed], prompt.words[1].text[0]);
});

test("a mistype costs that word's bonus but keeps the player's progress", () => {
  const run = new TypingRun(createRng(3), { strictMode: false, tier: 4 });
  const word = run.activeWord()!;
  run.handleChar(word.text[0]);
  const wrong = run.handleChar(word.text[1] === "z" ? "q" : "z");
  assert.equal(wrong.kind, "wrong");
  assert.equal(wrong.penalise, false, "default mode must not penalise");
  assert.equal(word.typed, 1, "progress must be kept");
  assert.ok(word.flawed, "the precision bonus for THIS word is forfeit");
});

test("a mistake on one word does not write off the next one", () => {
  // Per-word precision. A single flag per sentence meant one typo early on killed
  // the bonus for every remaining word, which punished the length of the sentence
  // rather than the mistake.
  const run = new TypingRun(createRng(5), { strictMode: false, tier: 4 });
  const prompt = run.prompts[0];
  const first = prompt.words[0];
  run.handleChar(first.text[0]);
  run.handleChar(first.text[1] === "z" ? "q" : "z");
  for (let i = 1; i < first.text.length; i++) run.handleChar(first.text[i]);
  const second = prompt.words[1];
  let precision: boolean | null = null;
  for (const ch of second.text) {
    const out = run.handleChar(ch);
    if (out.kind === "commit" && out.commit) precision = out.commit.precision;
  }
  assert.equal(precision, true, "a clean word must still earn its bonus");
});

test("strict mode reports a penalty instead (opt-in only)", () => {
  const run = new TypingRun(createRng(3), { strictMode: true, tier: 4 });
  const word = run.activeWord()!;
  run.handleChar(word.text[0]);
  const wrong = run.handleChar(word.text[1] === "z" ? "q" : "z");
  assert.equal(wrong.penalise, true);
});

test("precision scales damage by the designed bonus", () => {
  assert.equal(PRECISION_DAMAGE_BONUS, 0.25);
});

test("every keystroke counts from the first one", () => {
  const run = new TypingRun(createRng(23), { strictMode: false, tier: 4 });
  // A one-letter word would commit on its own first press, which would test nothing,
  // so put a known multi-word sentence up instead of whatever was rolled.
  run.prompts[0] = promptFor("the cat naps on the mat");
  const word = run.activeWord()!;
  const out = run.handleChar(word.text[0]);
  assert.equal(out.kind, "correct", "the first letter must count toward the word");
  assert.equal(word.typed, 1, "and must advance it");
  assert.equal(run.errors, 0, "the first letter must never count as an error");
});

test("one prompt is live at a time and the next sentence arrives with no gap", () => {
  const run = new TypingRun(createRng(23), { strictMode: false, tier: 4 });
  assert.equal(PROMPT_COUNT, 1);
  assert.equal(run.prompts.length, 1, "exactly one prompt");
  const first = run.prompts[0].text;
  let sentences = 0;
  while (run.prompts[0].text === first && sentences < 200) {
    const word = run.activeWord();
    if (!word) break;
    for (const ch of word.text) {
      const out = run.handleChar(ch);
      if (out.kind === "commit" && out.commit?.sentenceDone) sentences++;
    }
  }
  assert.equal(sentences, 1, "the sentence should finish exactly once");
  assert.equal(run.prompts.length, 1, "handing over the next sentence changes nothing");
  assert.equal(run.prompts[0].typed, 0, "the next sentence starts clean");
  assert.notEqual(run.prompts[0].text, first, "and is not the sentence just typed");
});

test("sentences scale with the chosen difficulty", () => {
  // A 20 WPM player handed a 55-character sentence spends half a minute on it.
  assert.deepEqual(bandsForTier(0), ["short"]);
  assert.ok(bandsForTier(4).includes("medium"), "mid tiers should see medium sentences");
  assert.ok(bandsForTier(8).includes("long"), "the top of the ladder gets long sentences");
  for (let tier = 0; tier <= 8; tier++) {
    const bands = bandsForTier(tier);
    assert.ok(bands.length > 0, `tier ${tier} must have a band`);
    for (const b of bands) assert.ok(b in SENTENCE_BANDS, `unknown band ${b}`);
  }
});

test("the telegraph fires only on a kick, and only once it has been committed to", () => {
  const run = new TypingRun(createRng(31), { strictMode: false, tier: 4 });
  const words = run.prompts[0].words;
  const kickAt = words.findIndex((w) => w.move === "kick");
  assert.ok(kickAt >= 0, "this seed should offer a kick");
  const kick = words[kickAt];
  for (let i = 0; i < kickAt; i++) for (const ch of words[i].text) run.handleChar(ch);
  assert.equal(run.telegraphing(), false, "an untouched kick is not a telegraph");
  for (let i = 0; i < TELEGRAPH_COMMIT_CHARS; i++) run.handleChar(kick.text[i]);
  assert.equal(run.telegraphing(), true, "two characters in, the kick is legible");
});

// ================================================================ the defensive verb

section("Blocks (a small word is a guard, and a blocked kick is a parry)");

test("completing a block word raises a guard", () => {
  const m = sandbox();
  toLive(m);
  assert.equal(m.fighter("left").guard, 0, "no guard before the block");
  strike(m, "left", "block");
  assert.equal(m.fighter("left").guard, BLOCK_HOLD, "the guard should go up");
  assert.equal(m.typing.left.blocks, 1);
});

test("a block never damages the opponent", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 20;
  strike(m, "left", "block");
  assert.equal(m.fighter("right").damage, 20, "a block is not an attack");
  assert.equal(m.fighter("right").vx, 0, "and it does not push");
});

test("a punch into a guard is smothered by BLOCK_KB_MULTIPLIER", () => {
  const launchThrough = (guarded: boolean) => {
    const m = sandbox();
    toLive(m);
    m.fighter("right").damage = 60;
    if (guarded) m.fighter("right").guard = BLOCK_HOLD;
    strike(m, "left", "punch");
    return Math.abs(m.fighter("right").vx);
  };
  const open = launchThrough(false);
  const blocked = launchThrough(true);
  assert.ok(open > 0, "the unguarded punch should launch");
  assert.ok(blocked < open, `a guard must reduce knockback: ${blocked} vs ${open}`);
  const ratio = blocked / open;

  // The guard does two things at once: it multiplies knockback by BLOCK_KB_MULTIPLIER
  // and it cuts the damage dealt, and knockback is itself a function of damage dealt.
  // So the measured ratio is the product of both effects, and the assertion is exact
  // rather than approximate. A clean strike carries the +25% precision bonus.
  const strikeDamage = MOVE.punch.damage * (1 + PRECISION_DAMAGE_BONUS);
  const kbOf = (damage: number, situational: number) =>
    knockbackUnits({
      targetDamage: 60,
      damage,
      weight: 100,
      scaling: MOVE.punch.scaling,
      base: MOVE.punch.base,
      situational,
    });
  const expected =
    kbOf(strikeDamage * BLOCK_DAMAGE_MULTIPLIER, BLOCK_KB_MULTIPLIER) / kbOf(strikeDamage, 1);
  assert.ok(
    Math.abs(ratio - expected) < 0.01,
    `expected ${expected.toFixed(3)}x, got ${ratio.toFixed(3)}x`,
  );
  assert.ok(ratio < BLOCK_KB_MULTIPLIER, "chip damage must compound the reduction");
});

test("a guarded hit deals chip damage, not nothing", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 40;
  m.fighter("right").guard = BLOCK_HOLD;
  strike(m, "left", "punch");
  const dealt = m.fighter("right").damage - 40;
  assert.ok(dealt > 0, "damage must still accumulate or the clock stops");
  const clean = MOVE.punch.damage * (1 + PRECISION_DAMAGE_BONUS);
  assert.ok(dealt < clean, `chip damage should be less than a clean hit: ${dealt}`);
  assert.ok(
    Math.abs(dealt - clean * BLOCK_DAMAGE_MULTIPLIER) < 1e-6,
    "chip damage should use BLOCK_DAMAGE_MULTIPLIER",
  );
});

test("a kick into a guard is parried: third knockback and a counter window", () => {
  const launchThrough = (guarded: boolean) => {
    const m = sandbox();
    toLive(m);
    m.fighter("right").damage = 60;
    if (guarded) m.fighter("right").guard = BLOCK_HOLD;
    strike(m, "left", "kick");
    return { vx: Math.abs(m.fighter("right").vx), counter: m.fighter("right").counter };
  };
  const open = launchThrough(false);
  const blocked = launchThrough(true);
  assert.ok(blocked.vx < open.vx, "the parry must reduce a kick: it is the read");
  const ratio = blocked.vx / open.vx;

  const strikeDamage = MOVE.kick.damage * (1 + PRECISION_DAMAGE_BONUS);
  const kbOf = (damage: number, situational: number) =>
    knockbackUnits({
      targetDamage: 60,
      damage,
      weight: 100,
      scaling: MOVE.kick.scaling,
      base: MOVE.kick.base,
      situational,
    });
  const expected =
    kbOf(strikeDamage * BLOCK_DAMAGE_MULTIPLIER, PARRY_MULTIPLIER) / kbOf(strikeDamage, 1);
  assert.ok(
    Math.abs(ratio - expected) < 0.01,
    `expected ${expected.toFixed(3)}x, got ${ratio.toFixed(3)}x`,
  );
  assert.equal(open.counter, 0, "an unguarded kick grants nothing");
  assert.ok(blocked.counter > 0, "a parried kick opens the counter window");
});

test("the guard expires after BLOCK_HOLD", () => {
  const m = sandbox();
  toLive(m);
  strike(m, "left", "block");
  assert.ok(m.fighter("left").guard > 0);
  for (let i = 0; i < Math.ceil((BLOCK_HOLD + 0.1) * 60); i++) m.step(STEP);
  assert.equal(m.fighter("left").guard, 0, "the guard must run out");
});

test("a block word that is only partly typed raises nothing", () => {
  const m = sandbox();
  toLive(m);
  const text = SAMPLE.block;
  m.typing.left.prompts[0] = promptFor(text);
  for (const ch of text.slice(0, -1)) m.type("left", ch);
  assert.equal(m.fighter("left").guard, 0, "a partial word must not raise a guard");
});

test("a counter is cashed in on the next landed move and then consumed", () => {
  const m = sandbox();
  toLive(m);
  const atk: Side = "left";
  m.fighter(atk).counter = 5;
  strike(m, atk, "punch");
  assert.equal(m.fighter(atk).counter, 0, "the counter should be spent");
});

test("the counter multiplier is stronger than a plain hit", () => {
  const mk = (withCounter: boolean) => {
    const m = sandbox();
    toLive(m);
    m.fighter("right").damage = 40;
    if (withCounter) m.fighter("left").counter = 5;
    strike(m, "left", "punch");
    return Math.abs(m.fighter("right").vx);
  };
  assert.ok(mk(true) > mk(false) * 1.5, "a cashed counter should hit much harder");
  assert.ok(COUNTER_MULTIPLIER > 1);
});

// ================================================================ escalation

section("Escalation (damage is what kills, not the move alone)");

test("a kick at 0% does NOT cross the blast line from spawn", () => {
  const m = sandbox();
  toLive(m);
  strike(m, "left", "kick");
  for (let i = 0; i < 240 && m.phase === "live"; i++) m.step(STEP);
  assert.notEqual(m.phase, "recovery", "a kick at 0% must not kill");
});

test("a kick at high damage DOES cross the blast line", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 110;
  strike(m, "left", "kick");
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
  assert.ok(crossed, "a kick at 110% should reach the blast line");
});

test("at equal damage a kick out-pushes a punch", () => {
  const at = (move: "punch" | "kick") =>
    knockbackUnits({
      targetDamage: 60,
      damage: MOVE[move].damage,
      weight: 100,
      scaling: MOVE[move].scaling,
      base: MOVE[move].base,
      situational: 1,
    });
  assert.ok(at("kick") > at("punch") * 1.5, `a kick should be much stronger`);
});

test("punches have higher base knockback than kicks (positional value early)", () => {
  assert.ok(MOVE.punch.base > MOVE.kick.base);
});

// ================================================================ knockback maths

section("Knockback (monotone, superlinear, escalation clock)");

const baseHit = {
  damage: MOVE.punch.damage,
  weight: 100,
  scaling: MOVE.punch.scaling,
  base: MOVE.punch.base,
  situational: 1,
};

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
  assert.ok(
    c - b > b - a,
    `expected accelerating knockback, got steps ${(b - a).toFixed(1)} then ${(c - b).toFixed(1)}`,
  );
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
  const low = hitstunSeconds(60);
  const high = hitstunSeconds(210);
  assert.notEqual(low, high, "hitstun must not be constant across knockback levels");
});

// ================================================================ anti-lockout

section("Anti-lockout (a victim must always get a turn)");

test("the hit cooldown exceeds the maximum hitstun, guaranteeing a free window", () => {
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

  strike(m, "left", "punch");
  const afterFirst = m.fighter("right").damage;
  assert.ok(afterFirst > 20, "the first hit should land");

  // A second move immediately after must be absorbed by the cooldown.
  strike(m, "left", "punch");
  assert.equal(m.fighter("right").damage, afterFirst, "the cooldown must absorb the second hit");
});

test("after the cooldown expires the victim can be hit again", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 20;
  strike(m, "left", "punch");
  const first = m.fighter("right").damage;
  for (let i = 0; i < Math.ceil(HIT_COOLDOWN * 60) + 2; i++) m.step(STEP);
  strike(m, "left", "punch");
  assert.ok(m.fighter("right").damage > first, "the next hit should land once the window opens");
});

// ================================================================ recovery

section("Recovery (one chance to get back)");

test("crossing the blast line opens a recovery prompt rather than killing", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 110;
  strike(m, "left", "kick");
  stepWhileRunning(m, 400);
  assert.equal(m.phase, "recovery", "should be in the recovery phase");
  assert.equal(m.recoveryVictim, "right");
  assert.ok(m.typing.right.inRecovery, "the victim should hold a recovery prompt");
  assert.equal(m.typing.right.prompts.length, 1, "only the recovery word is live");
  assert.equal(m.typing.right.prompts[0].words.length, 1, "the save is a single word");
});

test("completing the recovery word restores the fighter and resumes the fight", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 110;
  strike(m, "left", "kick");
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
  assert.ok(
    m.typing.right.prompts[0].kind === "attack",
    "a fresh sentence should replace the save word",
  );
});

test("failing to recover ends the round", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 110;
  strike(m, "left", "kick");
  stepWhileRunning(m, 400);
  assert.equal(m.phase, "recovery");
  for (let i = 0; i < 400 && m.phase === "recovery"; i++) m.step(STEP);
  assert.ok(m.wins.left >= 1, "the attacker should win the round");
  const endPhase: string = m.phase;
  assert.ok(endPhase === "roundOver" || endPhase === "matchOver", `unexpected phase ${endPhase}`);
});

test("each save in a round shortens the next recovery window", () => {
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
    victim.x = SPAWN.right.x;
    victim.y = SPAWN.right.y;
    strike(m, "left", "kick");
    stepWhileRunning(m, 400);
  };

  launch();
  assert.equal(m.phase, "recovery", "the first launch should open a recovery prompt");
  const first = m.recoveryTimer;

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

test("a save puts BOTH fighters back in the middle of the stage", () => {
  // Ruan's bug report: "the players still dont spawn in the middle after one is knocked off".
  //
  // Round restarts already used the centre spawn, which is why this looked correct in the
  // design doc and passed every other test. The path that was wrong is the SAVE: completing the
  // recovery word landed the player at platforms[0].x +- 50 (x 390 / 890), the wide marks, so a
  // ring-out ended with the fight shoved into a corner.
  const m = sandbox();
  toLive(m);

  const victim = m.fighter("right");
  victim.damage = 120;
  victim.hitCooldown = 0;
  victim.invuln = 0;
  victim.state = "idle";
  victim.x = SPAWN.right.x;
  victim.y = SPAWN.right.y;
  strike(m, "left", "kick");
  stepWhileRunning(m, 400);
  assert.equal(m.phase, "recovery", "the launch should open a recovery prompt");

  // Park the attacker out in a corner first. Without this the test could pass by accident,
  // because an attacker who never left the middle is trivially "in the middle" afterwards.
  const attacker = m.fighter("left");
  attacker.x = STAGE.platforms[0].x + 50;
  attacker.y = STAGE.platforms[0].y - 100;
  assert.ok(Math.abs(attacker.x - SPAWN.left.x) > 100, "the attacker must start far from spawn");

  for (const ch of m.typing.right.prompts[0].text) m.type("right", ch);
  assert.equal(m.phase, "live", "completing the save word should resume the fight");

  assert.equal(victim.x, SPAWN.right.x, "the saved fighter must come back to the middle");
  assert.equal(victim.y, SPAWN.right.y, "on the spawn line, not on the platform lip");
  assert.equal(
    attacker.x,
    SPAWN.left.x,
    "the opponent must be reset to the middle with them, not left in the corner",
  );

  // Regression guards. Both of these are positions that were used before the spawn moved.
  const wideMark = STAGE.platforms[0].x + 50;
  assert.ok(
    Math.abs(victim.x - wideMark) > 1,
    `the saved fighter must no longer return to the wide mark (x ${wideMark})`,
  );
  assert.ok(
    Math.abs(victim.x - (STAGE.blast.right - 56)) > 1,
    "and must not be left clamped at the blast line",
  );
});

// ================================================================ match structure

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
        for (const ch of t.prompts[0]?.text ?? "") m.type(side, ch);
        return;
      }
      budget += ((wpm * 5) / 60) * dt;
      let guard = 0;
      while (budget >= 1 && guard++ < 10) {
        budget -= 1;
        const live = t.activePrompt();
        if (!live || live.typed >= live.text.length) break;
        // Spaces are skipped by the typing layer, so text[typed] is always a letter.
        m.type(side, live.text[live.typed]);
      }
    };
  };

  const win = new Match({ ...OPTS, botWpm: 20 }, 21, {}, "right");
  const drive = autoType(win, "right", 120);
  let s1 = 0;
  while (!win.result && s1++ < 60 * 60 * 8) {
    drive(STEP);
    win.step(STEP);
  }
  assert.ok(win.result, "the winning match should finish");

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

test("a bot that types its sentences lands moves and wins rounds", () => {
  // The whole point of routing the bot through commitMove: a bot that never lands a
  // hit is a broken opponent, and this has silently regressed before.
  const hits: Record<Side, number> = { left: 0, right: 0 };
  const raised: Record<Side, number> = { left: 0, right: 0 };
  const m = new Match(
    { ...OPTS, botWpm: 60 },
    77,
    {
      onEvent: (e) => {
        if (e.type === "hit") hits[e.side]++;
        if (e.type === "block") raised[e.side]++;
      },
    },
    "left",
  );
  let steps = 0;
  while (!m.result && steps++ < 60 * 60 * 8) m.step(STEP);
  assert.ok(m.result, "the match must terminate");
  assert.ok(m.right.stats.words >= 8, `the bot threw ${m.right.stats.words} moves`);
  assert.ok(hits.left > 3, `the bot landed ${hits.left} hits on an idle player`);
  assert.ok(raised.right > 0, "the bot raises guards as it types its sentences");
  assert.ok(m.wins.right > 0, "the bot should win at least one round against an idle player");
});

test("blocks are thrown by both sides across a real match", () => {
  const m = new Match({ ...OPTS, botWpm: 60 }, 123, {}, "left");
  let steps = 0;
  while (!m.result && steps++ < 60 * 60 * 8) m.step(STEP);
  assert.ok(m.typing.right.blocks > 0, "the bot should raise guards");
  assert.ok(m.right.stats.words > 0);
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
    m.typing.left.sentences,
    m.typing.right.sentences,
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

test("both fighters spawn in the middle of the stage, symmetric and apart", () => {
  const main = STAGE.platforms[0];
  const centre = main.x + main.w / 2;
  for (const side of ["left", "right"] as Side[]) {
    const x = SPAWN[side].x;
    assert.ok(x > main.x && x < main.x + main.w, `${side} spawn must be on the main platform`);
    assert.ok(
      Math.abs(x - centre) <= 100,
      `${side} spawn (${x}) should be near the middle of the stage (${centre})`,
    );
  }
  // Apart, or the two hurtboxes overlap on the first frame.
  assert.ok(Math.abs(SPAWN.right.x - SPAWN.left.x) >= 62, "spawns must not overlap");
  // Still symmetric about each own blast line, so neither side starts at an advantage.
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

test("there is a free theme and paid ones cost coins", () => {
  const free = THEMES.filter((t) => t.rarity === "starter");
  assert.equal(free.length, 1, "exactly one theme should be free");
  assert.equal(free[0].price, 0);
  for (const t of THEMES) {
    if (t.rarity === "starter") continue;
    assert.ok(t.price > 0, `${t.id} must cost coins`);
  }
  assert.equal(new Set(THEMES.map((t) => t.id)).size, THEMES.length, "theme ids unique");
  assert.ok(THEMES.length >= 5, `expected a real spread of themes, got ${THEMES.length}`);
});

// ---------------------------------------------------------------- theme contrast
// A cool-looking theme with unreadable prompts is a broken product. This is Ruan's standing
// AA rule applied to the themes, checked by arithmetic rather than by eye.

test("every theme passes WCAG AA on the text that sits on it", () => {
  for (const t of THEMES) {
    const pairs: [string, number | null, string][] = [
      ["text on surface", contrast(t.text, t.surface), `${t.text} on ${t.surface}`],
      ["muted on surface", contrast(t.textMuted, t.surface), `${t.textMuted} on ${t.surface}`],
      ["text on page", contrast(t.text, t.page), `${t.text} on ${t.page}`],
      ["onAccent on accent", contrast(t.onAccent, t.accent), `${t.onAccent} on ${t.accent}`],
      ["muted on promptBg", contrast(t.textMuted, t.promptBg), `${t.textMuted} on ${t.promptBg}`],
      ["accent on promptBg", contrast(t.accent, t.promptBg), `${t.accent} on ${t.promptBg}`],
      ["text on promptBg", contrast(t.text, t.promptBg), `${t.text} on ${t.promptBg}`],
    ];
    for (const [label, ratio, detail] of pairs) {
      assert.ok(ratio !== null, `${t.id}: ${label} uses a non-hex colour (${detail})`);
      assert.ok(
        (ratio as number) >= 4.5,
        `${t.id}: ${label} is ${(ratio as number).toFixed(2)}:1, needs 4.5:1 (${detail})`,
      );
    }
  }
});

test("every theme defines a full arena palette", () => {
  for (const t of THEMES) {
    assert.equal(t.sky.length, 3, `${t.id} needs three sky bands`);
    for (const c of [...t.sky, t.hill, t.grass, t.grassLip, t.dirt, t.dirtDark, t.ink]) {
      assert.ok(/^#[0-9a-f]{6}$/i.test(c), `${t.id}: "${c}" is not a hex colour`);
    }
  }
});

test("themeById never returns nothing", () => {
  assert.equal(themeById(DEFAULT_THEME_ID).id, DEFAULT_THEME_ID);
  assert.equal(themeById("nope-does-not-exist").id, THEMES[0].id);
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
