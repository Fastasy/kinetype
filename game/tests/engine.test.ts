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
  BOT_WPM_LADDER,
  COUNTER_MULTIPLIER,
  COMBO_BONUS_PER_STEP,
  COMBO_FIRE_CHAIN,
  COMBO_MAX_STEPS,
  COMBO_STEP,
  HIT_COOLDOWN,
  HITSTUN_MAX,
  HITSTUN_MIN,
  INPUT_BUFFER_MAX,
  KICK_MIN_CHARS,
  PARRY_MULTIPLIER,
  PRECISION_DAMAGE_BONUS,
  PROMPT_COUNT,
  RECOVERY_SLACK_CHARS,
  RECOVERY_STEP_CHARS,
  RECOVERY_WORD_LENGTH,
  recoveryWindowSeconds,
  secondsPerChar,
  SPAWN,
  STAGE,
  STEP,
  TELEGRAPH_COMMIT_CHARS,
} from "../constants";
import { MOVE, hitstunSeconds, knockbackUnits } from "../knockback";
import { bankWhileStunned } from "../bot";
import { comboIntensity, comboMultiplier, comboSteps } from "../combo";
import { Match } from "../match";
import { TypingRun, type CharOutcome } from "../typing";
import { createRng } from "../rng";
import { applyOutcome, DEFAULT_SAVE, type SaveData } from "../storage";
import { purchaseWithCoins } from "../commerce";
import { OPPONENT_SKIN_ID, PIXEL_KEYS, SKINS, SPRITE_H, SPRITE_W } from "../skins";
import { contrast, luminance, THEMES, themeById, DEFAULT_THEME_ID, SIGNALS_DARK, SIGNALS_LIGHT } from "../themes";
import { DEFAULT_MAP_ID, MAPS, mapById } from "../maps";
import {
  ARENA_DANGER,
  ARENA_HUD,
  ARENA_REWARD,
  CELEBRATION_GOLD,
  PANEL_ALPHA,
  RESULT_FLARE,
  RESULT_PLATE,
} from "../hud";
import { FLARE_RULES, matchFlares } from "../flares";
import { Fx } from "../fx";
import { BOSSES } from "../progression";
import type { MatchOptions, MatchResult, MoveKind, Prompt, PromptKind, Side } from "../types";

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
    pendingSpace: false,
    typed: 0,
    flawed: false,
    age: 0,
  };
}

/**
 * Press the key the run says is next. Asserts one is actually due, so a test that has
 * stalled on a separator fails loudly instead of quietly typing the same letters forever.
 */
function pressNext(run: TypingRun): CharOutcome {
  const key = run.nextKey();
  assert.ok(key !== null, "a sentence is live, so a key must be due");
  return run.handleChar(key as string);
}

/**
 * Type `count` words out in full, separators included — the whole keyboard path a player
 * walks. Tests that only type letters stall on the first separator now that the space is a
 * real key, and a stalled test that still "passes" would be worse than no test at all.
 */
function typeWords(run: TypingRun, count: number): void {
  for (let i = 0; i < count; i++) {
    const word = run.activeWord();
    if (!word) return;
    for (let j = 0; j < word.text.length; j++) pressNext(run);
    const prompt = run.activePrompt();
    if (prompt?.pendingSpace) pressNext(run);
  }
}

/** Type the live sentence out end to end. Returns true if it finished. */
function typeSentence(run: TypingRun): boolean {
  const id = run.activePrompt()?.id;
  let guard = 0;
  while (guard++ < 600) {
    const prompt = run.activePrompt();
    if (!prompt || prompt.id !== id) return true;
    const key = run.nextKey();
    if (key === null) return true;
    const out = run.handleChar(key);
    if (out.kind === "commit" && out.commit?.sentenceDone) return true;
  }
  return false;
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

test("charOffset returns the index of a word's first letter", () => {
  const words = splitSentence("the cat naps");
  assert.equal(charOffset(words, 0), 0);
  assert.equal(charOffset(words, 1), 4, "after 'the ' the cursor is on 'c'");
  assert.equal(charOffset(words, 2), 8, "after 'cat ' the cursor is on 'n'");
  // The offset lands on the LETTER, and the separator it skipped over sits at offset - 1.
  // That is exactly the character the player must type to get here, which is what makes the
  // separator's own position recoverable without a second index.
  for (let i = 1; i < words.length; i++) {
    assert.equal(sentenceText(words)[charOffset(words, i) - 1], " ", `separator before word ${i}`);
  }
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

test("the separator is required: a finished word does not advance the cursor until space lands", () => {
  const run = new TypingRun(createRng(19), { strictMode: false, tier: 4 });
  const prompt = run.prompts[0];
  const first = prompt.words[0];
  for (const ch of first.text) run.handleChar(ch);

  // The MOVE has fired — the commit point is unchanged — but the SENTENCE has not advanced.
  assert.equal(run.words, 1, "the word itself committed and its move fired");
  assert.equal(prompt.index, 0, "the cursor must not have moved to the next word");
  assert.equal(prompt.pendingSpace, true, "the separator is now the required keypress");
  assert.equal(run.nextKey(), " ", "and the game says so");
  assert.equal(prompt.text[prompt.typed], " ", "the cursor sits on the separator itself");

  // Skipping it is a mistake, not a free pass. This is the whole reason the separator is
  // mandatory: if typing straight through worked, pressing space would be a worse choice
  // than not pressing it and the key would be decoration.
  const errorsBefore = run.errors;
  const skipped = run.handleChar(prompt.words[1].text[0]);
  assert.equal(skipped.kind, "wrong", "the next word's first letter is NOT the next key");
  assert.equal(prompt.index, 0, "nothing advances");
  assert.equal(prompt.pendingSpace, true, "the separator is still due");
  assert.equal(run.errors, errorsBefore + 1, "it costs accuracy");
  assert.equal(prompt.words[1].flawed, false, "a separator miss must not flaw the coming word");
  assert.equal(prompt.words[1].typed, 0, "which has not been typed yet");

  // The space is what advances, and then the next letter is what is due.
  const ok = run.handleChar(" ");
  assert.equal(ok.kind, "correct");
  assert.equal(prompt.pendingSpace, false);
  assert.equal(prompt.index, 1, "the cursor reaches the next word only via the separator");
  assert.equal(prompt.typed, charOffset(prompt.words, 1));
  assert.equal(run.nextKey(), prompt.words[1].text[0]);
});

test("a stray space mid-word is a mistake, because space is a real key", () => {
  const run = new TypingRun(createRng(3), { strictMode: false, tier: 4 });
  const word = run.activeWord()!;
  run.handleChar(word.text[0]);
  const out = run.handleChar(" ");
  assert.equal(out.kind, "wrong", "space can be wrong now, which it never used to be");
  assert.equal(word.typed, 1, "progress is kept");
  assert.ok(word.flawed, "and it costs this word its precision bonus");
});

test("the last word needs no trailing separator: the sentence ends on its own last letter", () => {
  const run = new TypingRun(createRng(23), { strictMode: false, tier: 4 });
  run.prompts[0] = promptFor("the cat naps");
  const first = run.prompts[0].text;

  typeWords(run, 2); // 'the', separator, 'cat', separator
  assert.equal(run.prompts[0].index, 2, "two words consumed");
  assert.equal(run.prompts[0].pendingSpace, false, "and the gap before the last word is behind us");

  for (let i = 0; i < run.prompts[0].words[2].text.length; i++) pressNext(run);
  assert.notEqual(run.prompts[0].text, first, "the sentence handed over on the final letter");
  assert.equal(run.prompts[0].typed, 0, "and the next sentence starts clean");
});

test("a whole sentence goes down, separators and all", () => {
  const run = new TypingRun(createRng(23), { strictMode: false, tier: 4 });
  run.prompts[0] = promptFor("the cat naps on the mat");
  const text = run.prompts[0].text;

  assert.ok(typeSentence(run), "six words plus five separators should complete");
  assert.equal(run.sentences, 1);
  assert.equal(run.errors, 0, "typing it correctly must produce no errors at all");
  assert.equal(run.chars, text.length, "every character counts, separators included");
  assert.equal(run.correct, text.length);
  assert.equal(run.accuracy(), 100);
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
  // The separator now stands between the words, so it has to be pressed to reach word two.
  assert.equal(prompt.pendingSpace, true);
  pressNext(run);
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
    if (typeSentence(run)) sentences++;
    else break;
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
  // Type the words ahead of the kick out in full, separators included.
  typeWords(run, kickAt);
  assert.equal(run.telegraphing(), false, "an untouched kick is not a telegraph");
  for (let i = 0; i < TELEGRAPH_COMMIT_CHARS; i++) run.handleChar(kick.text[i]);
  assert.equal(run.telegraphing(), true, "two characters in, the kick is legible");

  // And it must go quiet the moment the word is spent. A KICK INCOMING that lingers over a
  // word waiting for its separator is telling the defender to block something already thrown.
  for (let i = TELEGRAPH_COMMIT_CHARS; i < kick.text.length; i++) run.handleChar(kick.text[i]);
  assert.equal(run.telegraphing(), false, "a committed kick stops telegraphing");
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

// ================================================================ input buffer

section("Input buffering (a hit must not eat the player's keystrokes)");

test("the buffer is small enough that a stun cannot bank a word", () => {
  // The invariant that keeps the buffer a courtesy rather than an exploit. A one-word
  // sentence is at least a single block word, so a cap below the shortest word length
  // means no fighter can ever queue up a whole move while stunned. Hitstun is meant to
  // cost the player TIME; it must not cost them keystrokes, and it must not hand them one.
  assert.ok(INPUT_BUFFER_MAX >= 1, "a cap of zero is the bug this buffer exists to fix");
  assert.ok(
    INPUT_BUFFER_MAX <= 4,
    `INPUT_BUFFER_MAX (${INPUT_BUFFER_MAX}) is large enough to bank a whole word`,
  );
});

test("a keystroke pressed while being hit is held, not dropped", () => {
  const m = sandbox();
  toLive(m);
  m.typing.left.prompts[0] = promptFor("planet");

  // A genuine punch, through the same door the player's own moves use.
  strike(m, "right", "punch");
  assert.equal(m.left.state, "hitstun", "the punch should stun the player");

  const word = m.typing.left.activeWord();
  assert.ok(word, "the player should still have a live word");
  const before = m.typing.left.chars;

  // Ruan's report: "when he hits me and I type a letter at the same time, it does not
  // register." It must register. It may be DELAYED, but it must not vanish.
  const consumed = m.type("left", word.text[0]);
  assert.equal(consumed, true, "the keystroke must be accepted, not discarded");
  assert.equal(m.typing.left.chars, before, "it cannot be applied while stunned");
  assert.equal(m.queuedFor("left"), 1, "it should be waiting in the buffer");
});

test("held keystrokes land the moment hitstun ends, in the order they were pressed", () => {
  const m = sandbox();
  toLive(m);
  m.typing.left.prompts[0] = promptFor("planet");
  strike(m, "right", "punch");

  const word = m.typing.left.activeWord();
  assert.ok(word, "the player should still have a live word");
  m.type("left", word.text[0]);
  m.type("left", word.text[1]);
  assert.equal(m.typing.left.chars, 0, "nothing lands while stunned");
  assert.equal(m.queuedFor("left"), 2);

  let guard = 0;
  while (m.left.state === "hitstun" && guard++ < 300) m.step(STEP);

  assert.equal(m.typing.left.chars, 2, "both held keystrokes should have landed");
  assert.equal(
    m.typing.left.activeWord()?.typed,
    2,
    "they must land in order, from where the player left off",
  );
  assert.equal(m.queuedFor("left"), 0, "the buffer should be empty again");
});

test("the cap drops the overflow, and the first keys pressed are the ones kept", () => {
  const m = sandbox();
  toLive(m);
  m.typing.left.prompts[0] = promptFor("planet");
  strike(m, "right", "punch");

  const word = m.typing.left.activeWord();
  assert.ok(word, "the player should still have a live word");
  // Mash the entire word while stunned. First in, first kept: the player's fingers were
  // already at the start of the word, so the leading characters are the meaningful ones.
  for (const ch of word.text) m.type("left", ch);

  assert.equal(m.queuedFor("left"), INPUT_BUFFER_MAX, "the queue must stop at the cap");
  let guard = 0;
  while (m.left.state === "hitstun" && guard++ < 300) m.step(STEP);

  assert.equal(m.typing.left.chars, INPUT_BUFFER_MAX, "only the cap may land");
  assert.ok(
    m.typing.left.chars < word.text.length,
    "a whole word must never be banked through a stun",
  );
});

test("held keystrokes can still commit the word and fire its move", () => {
  const m = sandbox();
  toLive(m);
  // A three-character block word: exactly the size of the buffer, so the save word
  // completes the instant the player can act again.
  m.typing.left.prompts[0] = promptFor("the");
  strike(m, "right", "punch");

  for (const ch of "the") m.type("left", ch);
  assert.equal(m.typing.left.blocks, 0, "nothing may fire while the player is stunned");

  let guard = 0;
  while (m.left.state === "hitstun" && guard++ < 300) m.step(STEP);

  assert.equal(m.typing.left.blocks, 1, "the block should fire as soon as the stun clears");
});

test("strict mode's stagger holds keystrokes rather than eating them", () => {
  const m = sandbox(42, { strictMode: true });
  toLive(m);
  m.typing.left.prompts[0] = promptFor("planet");

  const word = m.typing.left.activeWord();
  assert.ok(word, "the player should have a live word");
  m.type("left", word.text[0] === "z" ? "y" : "z"); // deliberate mistake
  assert.equal(m.left.state, "staggered", "strict mode should stagger on a mistake");

  m.type("left", word.text[0]);
  assert.equal(m.typing.left.chars, 0, "the good keystroke waits out the stagger");
  assert.equal(m.queuedFor("left"), 1);

  let guard = 0;
  while (m.left.state === "staggered" && guard++ < 300) m.step(STEP);
  assert.equal(m.typing.left.chars, 1, "the key the player meant should land afterwards");
});

test("keystrokes typed during the countdown land when the round goes live", () => {
  const m = sandbox(); // starts in the countdown
  m.typing.left.prompts[0] = promptFor("planet");

  const word = m.typing.left.activeWord();
  assert.ok(word, "the player should have a live word");
  m.type("left", word.text[0]);
  m.type("left", word.text[1]);
  assert.equal(m.typing.left.chars, 0, "the round has not started");
  assert.equal(m.queuedFor("left"), 2, "they should be held, not swallowed");

  toLive(m);
  assert.equal(m.typing.left.chars, 2, "both should land on the frame the round goes live");
});

test("a decided round discards its held keystrokes instead of carrying them over", () => {
  const m = sandbox();
  toLive(m);
  m.fighter("right").damage = 110;
  strike(m, "left", "kick");

  // The right fighter has no bot controller in a sandbox, so it cannot save itself and
  // the round ends in a KO. Drive until the recovery cut is open.
  let guard = 0;
  while (!m.recoveryVictim && guard++ < 400) m.step(STEP);
  // Declared as `string`: the point of this test is the round transition, and TS 5.5
  // narrows `m.phase` through the assertion below, which then rejects the loop guard.
  const cutPhase: string = m.phase;
  assert.ok(cutPhase === "recovery", "the kick should have opened a recovery window");
  assert.equal(m.recoveryVictim, "right", "the right fighter is the one falling");

  // Mash while the round is being decided: the player cannot act during the cut, so all
  // of this is held in the buffer.
  const charsBeforeMash = m.typing.left.chars;
  for (const ch of "wasd") m.type("left", ch);
  assert.ok(m.queuedFor("left") > 0, "the mashing should be held while the cut runs");

  // Drive on until round two is actually live and accepting input.
  let guard2 = 0;
  while (m.phase !== "live" && guard2++ < 4000) m.step(STEP);
  assert.equal(m.phase, "live", "the next round should have started");

  assert.equal(m.queuedFor("left"), 0, "nothing may be banked into the next round");
  assert.equal(
    m.typing.left.chars,
    charsBeforeMash,
    "and nothing may be applied in the next round",
  );
});

test("junk is refused outright and never enters the buffer", () => {
  const m = sandbox();
  toLive(m);
  m.typing.left.prompts[0] = promptFor("planet");
  strike(m, "right", "punch"); // stun the player so everything gets buffered
  for (const ch of ["A", "1", "-", "!", "é"]) m.type("left", ch);
  assert.equal(m.queuedFor("left"), 0, "only a-z and the separator may be held");
  // And the separator itself IS a legal key now, so it must be held like any other.
  m.type("left", " ");
  assert.equal(m.queuedFor("left"), 1, "a space is a real key and gets buffered like one");
});

// ================================================================ WPM honesty

section("The WPM meter (the scoreboard has to be true)");

test("the typing clock is real time: a keystroke does not advance it", () => {
  const m = sandbox();
  toLive(m);
  const t = m.typing.left;
  m.typing.left.prompts[0] = promptFor("planet");

  const before = t.clockSeconds;
  const word = t.activeWord();
  assert.ok(word, "the player should have a live word");
  t.handleChar(word.text[0]);
  t.handleChar(word.text[1]);
  assert.ok(
    Math.abs(t.clockSeconds - before) < 1e-9,
    "handleChar must not move the clock: time comes from tick() alone",
  );

  t.tick(0.5);
  assert.ok(
    Math.abs(t.clockSeconds - (before + 0.5)) < 1e-9,
    "tick is the only thing that may advance the clock",
  );
});

test("the meter waits for a real interval before it reports a speed", () => {
  const m = sandbox();
  toLive(m);
  const t = m.typing.left;
  m.typing.left.prompts[0] = promptFor("planet");

  const word = t.activeWord();
  assert.ok(word, "the player should have a live word");
  t.handleChar(word.text[0]);
  t.handleChar(word.text[1]);
  // Two keystrokes in the same instant is not a speed. Dividing by that span produced a
  // number that swung wildly at the start of every round.
  assert.equal(t.wpm(), 0, "a sub-second span must not be reported as WPM");
});

test("a steady typist's meter matches the speed they actually typed", () => {
  const m = sandbox();
  toLive(m);

  // 120 WPM is 10 correct characters per second, i.e. one every 6 frames. This is the
  // speed at which the old hard-coded 16ms-per-keystroke clock was worst: it made the
  // meter under-read by 8.3%, punishing the player for getting faster.
  //
  // The next key is read from the run rather than from the word, because a separator is a
  // real keypress and therefore a real character in the WPM count.
  const framesPerChar = 6;
  let realTime = 0;
  let typed = 0;
  for (let frame = 0; frame < 60 * 20 && typed < 100; frame++) {
    m.step(STEP);
    realTime += STEP;
    if (frame % framesPerChar === 0) {
      const key = m.typing.left.nextKey();
      if (key === null) break;
      m.type("left", key);
      typed++;
    }
  }

  const trueWpm = (typed / 5) * (60 / realTime);
  const reported = m.typing.left.wpm();
  const error = Math.abs(reported - trueWpm) / trueWpm;
  assert.ok(
    error < 0.12,
    `meter reported ${reported} WPM for a true ${trueWpm.toFixed(1)} WPM (${(error * 100).toFixed(1)}% off)`,
  );
});

// ================================================================ combo

section("Combo (a chain of flawless words escalates the damage)");

test("the ladder pays nothing until the first rung, then steps, then caps", () => {
  // Two clean words in a row is a coincidence, not a streak. Silence at x1 is what makes the
  // meter's appearance mean something.
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(COMBO_STEP - 1), 1, "below the first rung there is no bonus");
  assert.equal(comboSteps(COMBO_STEP - 1), 0);
  assert.ok(Math.abs(comboMultiplier(COMBO_STEP) - (1 + COMBO_BONUS_PER_STEP)) < 1e-9);
  assert.equal(comboSteps(COMBO_STEP), 1);

  // Each rung pays the same, and the top rung is the last one — a chain across several
  // rounds must not compound until one punch ends the match.
  for (let step = 1; step <= COMBO_MAX_STEPS; step++) {
    const chain = COMBO_STEP * step;
    assert.equal(comboSteps(chain), step);
    assert.ok(Math.abs(comboMultiplier(chain) - (1 + COMBO_BONUS_PER_STEP * step)) < 1e-9);
  }
  const capped = comboMultiplier(COMBO_STEP * COMBO_MAX_STEPS);
  assert.equal(comboMultiplier(500), capped, "the ladder stops at the top rung");
  assert.equal(comboIntensity(500), 1, "intensity saturates with it");
  assert.equal(comboIntensity(COMBO_STEP * COMBO_MAX_STEPS), 1);
  assert.equal(comboIntensity(COMBO_STEP), 1 / COMBO_MAX_STEPS);
});

test("the multiplier never decreases as the chain grows", () => {
  // Monotone by construction, but the HUD promises it and a future retune must not break it.
  let previous = -Infinity;
  for (let chain = -5; chain <= COMBO_STEP * (COMBO_MAX_STEPS + 3); chain++) {
    const m = comboMultiplier(chain);
    assert.ok(m >= previous, `the multiplier dropped at chain ${chain}`);
    assert.ok(m >= 1, `bonus below 1 at chain ${chain}`);
    assert.ok(
      m <= 1 + COMBO_BONUS_PER_STEP * COMBO_MAX_STEPS + 1e-9,
      `bonus above the cap at chain ${chain}`,
    );
    previous = m;
  }
  assert.equal(comboMultiplier(-3), 1, "a nonsense chain must not pay");
});

test("flawless words build the chain, one per word, across the separators", () => {
  const run = new TypingRun(createRng(23), { strictMode: false, tier: 4 });
  run.prompts[0] = promptFor("the cat naps on the mat");
  typeSentence(run);
  assert.equal(run.combo, 6, "six clean words is a chain of six");
  assert.equal(run.bestCombo, 6);
  // The separators are part of the sentence but NOT part of the chain: the chain counts
  // moves, and a separator is not a move.
  assert.equal(run.words, 6);
});

test("any mistake breaks the chain, including a missed separator", () => {
  const run = new TypingRun(createRng(23), { strictMode: false, tier: 4 });
  run.prompts[0] = promptFor("the cat naps on the mat");
  typeWords(run, 3);
  assert.equal(run.combo, 3, "three clean words in a row");

  // Complete a fourth word without its separator, so the separator is genuinely next.
  const fourth = run.activeWord();
  assert.ok(fourth, "a fourth word should be live");
  for (let i = 0; i < fourth.text.length; i++) pressNext(run);
  assert.equal(run.combo, 4);
  assert.equal(run.nextKey(), " ", "the very next required key is a separator");

  // Press a letter where the separator is due: the classic miss.
  const out = run.handleChar("q");
  assert.equal(out.kind, "wrong");
  assert.equal(run.combo, 0, "one slip and it is gone, whichever key slipped");
  assert.equal(run.bestCombo, 4, "the best chain is remembered");
});

test("repairing a flawed word does not restore the chain", () => {
  const run = new TypingRun(createRng(23), { strictMode: false, tier: 4 });
  run.prompts[0] = promptFor("the cat naps on the mat");

  for (let i = 0; i < run.prompts[0].words[0].text.length; i++) pressNext(run);
  pressNext(run); // the separator
  assert.equal(run.combo, 1);

  const word = run.prompts[0].words[1];
  run.handleChar(word.text[0] === "z" ? "y" : "z"); // fumble
  assert.equal(run.combo, 0, "the chain breaks the instant the mistake is made");
  for (let i = 0; i < word.text.length; i++) pressNext(run); // then type it properly
  assert.equal(run.combo, 0, "finishing it cleanly does not give the chain back");
  assert.equal(run.bestCombo, 1);
});

test("resetCombo clears the chain for a new round but never the match best", () => {
  const run = new TypingRun(createRng(23), { strictMode: false, tier: 4 });
  run.prompts[0] = promptFor("the cat naps on the mat");
  typeSentence(run);
  assert.equal(run.combo, 6);
  run.resetCombo();
  assert.equal(run.combo, 0, "a new round starts a fresh climb");
  assert.equal(run.bestCombo, 6, "the best chain is a match record, not a round one");
});

test("the chain actually multiplies the damage a move deals", () => {
  /** Damage a clean punch deals when the chain stood at `chainBefore` as the word landed. */
  const damageAt = (chainBefore: number): number => {
    const m = sandbox();
    toLive(m);
    m.fighter("right").damage = 30;
    m.typing.left.combo = chainBefore;
    strike(m, "left", "punch");
    return m.fighter("right").damage - 30;
  };

  const cold = damageAt(0); // the word makes the chain 1, below the first rung
  const warm = damageAt(COMBO_STEP - 1); // makes it COMBO_STEP: the first rung pays
  const hot = damageAt(COMBO_STEP * 2 - 1); // makes it two rungs up

  assert.ok(warm > cold, `clearing the first rung must hit harder (${warm} vs ${cold})`);
  assert.ok(hot > warm, `the ladder must keep paying (${hot} vs ${warm})`);
  // Same move, same precision, same target damage — so the ONLY difference is the chain and
  // the ratio must be exactly the designed multiplier.
  assert.ok(
    Math.abs(warm / cold - comboMultiplier(COMBO_STEP)) < 1e-6,
    `expected x${comboMultiplier(COMBO_STEP)}, got x${(warm / cold).toFixed(4)}`,
  );
  assert.ok(
    Math.abs(hot / cold - comboMultiplier(COMBO_STEP * 2)) < 1e-6,
    `expected x${comboMultiplier(COMBO_STEP * 2)}, got x${(hot / cold).toFixed(4)}`,
  );
});

test("the combo stacks on top of the precision bonus rather than replacing it", () => {
  const damageAt = (chainBefore: number, flawedWord: boolean): number => {
    const m = sandbox();
    toLive(m);
    m.fighter("right").damage = 30;
    m.typing.left.combo = chainBefore;
    m.typing.left.prompts[0] = promptFor("planet");
    // Make the word flawed first, so it commits without precision.
    if (flawedWord) m.typing.left.handleChar("z");
    for (let i = 0; i < "planet".length; i++) {
      const w = m.typing.left.activeWord();
      if (!w) break;
      m.type("left", w.text[w.typed]);
    }
    return m.fighter("right").damage - 30;
  };

  const clean = damageAt(COMBO_STEP - 1, false);
  const flawed = damageAt(COMBO_STEP - 1, true);
  // Both land the same number of moves; the clean one keeps precision, so it must be bigger.
  assert.ok(clean > flawed, `precision must survive the combo (${clean} vs ${flawed})`);
});

test("the fire threshold is reachable and sits at the top of the ladder", () => {
  assert.equal(COMBO_FIRE_CHAIN, COMBO_STEP * COMBO_MAX_STEPS);
  assert.equal(comboSteps(COMBO_FIRE_CHAIN), COMBO_MAX_STEPS, "fire means a maxed ladder");
  assert.equal(comboSteps(COMBO_FIRE_CHAIN - 1), COMBO_MAX_STEPS - 1, "and not one word sooner");
});

test("a bot builds a chain exactly like the player does", () => {
  // The bot goes through TypingRun, so it earns (and loses) the combo on the same terms.
  // If the bot were handed a separate path its multiplier would drift from the player's.
  // The human is on the right here, so the BOT is `typing.left` and never receives input.
  const m = new Match({ ...OPTS, botWpm: 40 }, 77, {}, "right");
  let guard = 0;
  while (!m.result && guard++ < 60 * 60 * 6) m.step(STEP);
  assert.ok(m.result, "the match should finish");
  assert.ok(
    m.typing.left.bestCombo > 0,
    "the bot should have strung clean words together through the shared typing layer",
  );
  assert.ok(m.result.bestCombo >= 0, "the result should carry the human best chain");
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
  const wpm = BOT_WPM_LADDER[5]; // 70 — the rung Ruan reported on
  const window = (recoveries: number) => recoveryWindowSeconds(wpm, recoveries);
  assert.equal(window(0), RECOVERY_SLACK_CHARS * secondsPerChar(wpm), "a fresh round opens on the full slack");
  assert.equal(
    window(1),
    (RECOVERY_SLACK_CHARS - RECOVERY_STEP_CHARS) * secondsPerChar(wpm),
    "one prior save costs exactly RECOVERY_STEP_CHARS of budget",
  );
  assert.ok(window(1) < window(0), "the second save should be tighter");
  assert.ok(window(4) < window(1), "the fifth save should be tighter still");
  assert.equal(window(99), 0, "the budget must run out, never floor above zero");
});

test("every rung can be KO'd: the save budget is finite and identical in CHARACTERS", () => {
  // The bug this exists to prevent. The window used to be a flat seconds figure, so the save
  // collapsed to `5 / (wpm/12) <= 1.8 - 0.25n` and the ladder became a step function:
  // <=30 WPM could never save at all, and >=85 WPM could never FAIL to (0.71s needed against a
  // 0.8s floor). A 120 WPM bot saved 143/143 and rounds at the top of the ladder ended on the
  // clock because a KO was arithmetically impossible. Both ends of that are asserted here.
  const wordTime = (wpm: number) => RECOVERY_WORD_LENGTH * secondsPerChar(wpm);
  for (const wpm of BOT_WPM_LADDER) {
    // 1. A rung is never immortal: the budget must fall below the word before too long.
    let lives = 0;
    while (recoveryWindowSeconds(wpm, lives) >= wordTime(wpm)) {
      lives++;
      assert.ok(lives < 20, `${wpm} WPM never loses the ability to save — that rung cannot be KO'd`);
    }
    assert.ok(lives >= 2, `${wpm} WPM gets ${lives} save(s) — a KO would be trivially cheap`);
    assert.ok(lives <= 5, `${wpm} WPM gets ${lives} lives — the fight would outlast the round`);

    // 2. A slow rung is never locked out: the FIRST save must always be reachable, or a slow
    //    player never sees the mechanic at all.
    assert.ok(
      recoveryWindowSeconds(wpm, 0) > wordTime(wpm),
      `${wpm} WPM cannot make even its first save`,
    );

    // 3. The life count is a property of the RUNG, not of the clock, so it is flat across the
    //    ladder. This is what stops speed deciding survival as well as damage.
    const atZero = recoveryWindowSeconds(wpm, 0) / secondsPerChar(wpm);
    assert.equal(atZero, RECOVERY_SLACK_CHARS, "the first-save budget must be flat across rungs");
  }
});

test("a stunned bot banks at most the player's buffer, at every rung", () => {
  // Parity rule, added 2026-10-05 with the fix. A hit used to pause the bot's clock outright
  // while the human's keystrokes were held and delivered — so a stun cost the bot its whole
  // duration and cost the player nothing net. Ruan's call: bank it, capped at the player's
  // own cap. Both halves of that matter, and the second is the anti-exploit half: a larger
  // cap would let a fast bot store most of a word behind one stun.
  for (const wpm of BOT_WPM_LADDER) {
    // Two full seconds of stun is longer than any stun in the game (HITSTUN_MAX x2), so the
    // ceiling MUST be reached — asserting the cap exists, not merely that accrual is bounded.
    const banked = bankWhileStunned(0, 2, wpm);
    assert.equal(banked, INPUT_BUFFER_MAX, `${wpm} WPM must bank exactly the player's cap`);

    // Never more than the player, at any rung or any stun length.
    for (const dt of [1 / 60, 0.25, 0.75, 1.5]) {
      assert.ok(
        bankWhileStunned(0, dt, wpm) <= INPUT_BUFFER_MAX,
        `${wpm} WPM banked past the player's cap over ${dt}s`,
      );
    }
    // And it is a CEILING, not a floor: a short stun banks less than the cap.
    assert.ok(bankWhileStunned(0, 1 / 60, wpm) < INPUT_BUFFER_MAX, `${wpm} WPM should not start full`);
  }
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
        // `typed` counts separators, so text[typed] is the exact next key — space included.
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

// ------------------------------------------------------------------------ arena maps
// The arena belongs to the BOSS now (game/maps.ts); a theme is the website's colours. Two things
// about a map are rules rather than style, and both are checked by arithmetic instead of by eye:
// the blast line marks instant death, and the platform outline has to be visible on the ground it
// outlines. A dark arena cannot carry a dark outline, and this is what stops one being added.

test("every boss owns its own arena", () => {
  assert.ok(BOSSES.length >= 9, `expected the full campaign, got ${BOSSES.length}`);
  for (const b of BOSSES) {
    assert.equal(mapById(b.mapId).id, b.mapId, `${b.id} points at an arena that does not exist (${b.mapId})`);
  }
  const used = new Set(BOSSES.map((b) => b.mapId));
  assert.equal(used.size, BOSSES.length, "two bosses share an arena — every fight should look different");
});

test("free play keeps an arena of its own", () => {
  assert.equal(mapById(DEFAULT_MAP_ID).id, DEFAULT_MAP_ID);
  assert.ok(
    !BOSSES.some((b) => b.mapId === DEFAULT_MAP_ID),
    "free play should have its own home arena, not one borrowed from the campaign",
  );
});

test("every arena is a complete, well-formed palette", () => {
  for (const m of MAPS) {
    assert.equal(m.sky.length, 3, `${m.id} needs three sky bands`);
    const colours = [m.sky[0], m.sky[1], m.sky[2], m.hill, m.grass, m.grassLip, m.dirt, m.dirtDark, m.blast, m.ink];
    for (const c of colours) {
      // OPAQUE hex, deliberately: a translucent blast line cannot be contrast-checked, and it is
      // a lethal boundary rather than a decorative hairline.
      assert.ok(/^#[0-9a-f]{6}$/i.test(c), `${m.id}: "${c}" is not an opaque hex colour`);
    }
  }
  assert.equal(new Set(MAPS.map((m) => m.id)).size, MAPS.length, "map ids must be unique");
});

test("the blast line is visible on every arena", () => {
  // 3:1 is the WCAG bar for a non-text graphic, checked against every sky band the line crosses.
  for (const m of MAPS) {
    for (const band of m.sky) {
      const ratio = contrast(m.blast, band) ?? 0;
      assert.ok(ratio >= 3, `${m.id}: blast ${m.blast} on sky ${band} is only ${ratio.toFixed(2)}:1`);
    }
  }
});

test("the platform outline is visible on every arena's ground", () => {
  // Deliberately not "always dark": on a dark arena `ink` is a pale rim. The same colour draws the
  // damage-bar track at low alpha, so this also keeps that readable on a dark map.
  for (const m of MAPS) {
    for (const ground of [m.dirt, m.dirtDark]) {
      const ratio = contrast(m.ink, ground) ?? 0;
      assert.ok(ratio >= 2, `${m.id}: ink ${m.ink} on ground ${ground} is only ${ratio.toFixed(2)}:1`);
    }
  }
});

test("arena and theme ids never collide", () => {
  // They are separate concepts now, and a shared id would make a lookup bug look like data.
  const mapIds = new Set(MAPS.map((m) => m.id));
  for (const t of THEMES) {
    assert.ok(!mapIds.has(t.id), `"${t.id}" is both a theme and an arena`);
  }
});

test("every theme's SIGNALS stay readable on its own surfaces", () => {
  // Signals carry meaning — coin is a price, heat is a loss, aqua is a block — so a theme may swap
  // between the two fixed palettes but never invent values. Two palettes exist because NO single
  // colour can clear AA on both a near-black page and the light one; measured, the light-page
  // values score only 2.2-3.8:1 on the dark themes, which is a price you cannot read.
  for (const t of THEMES) {
    const s = t.signals ?? SIGNALS_LIGHT;
    for (const [name, colour] of [["coin", s.coin], ["heat", s.heat], ["aqua", s.aqua], ["secondary", s.secondary]] as const) {
      for (const [surfaceName, surface] of [["page", t.page], ["card", t.surface]] as const) {
        const ratio = contrast(colour, surface) ?? 0;
        assert.ok(ratio >= 4.5, `${t.id}: ${name} ${colour} on ${surfaceName} ${surface} is only ${ratio.toFixed(2)}:1`);
      }
    }
    // A signal chip has to carry its own text.
    assert.ok((contrast(s.coin, s.coinDeep) ?? 0) >= 4.5, `${t.id}: coin is not readable on its chip`);
    assert.ok((contrast(s.heat, s.heatDeep) ?? 0) >= 4.5, `${t.id}: heat is not readable on its chip`);
  }
});

test("signal colours are not free-form per theme", () => {
  // The guard that keeps the MEANING fixed: a theme picks one of exactly two palettes.
  for (const t of THEMES) {
    if (!t.signals) continue;
    assert.ok(
      t.signals === SIGNALS_LIGHT || t.signals === SIGNALS_DARK,
      `${t.id} invents its own signal palette — signals must not drift per theme`,
    );
  }
});

test("themeById never returns nothing", () => {
  assert.equal(themeById(DEFAULT_THEME_ID).id, DEFAULT_THEME_ID);
  assert.equal(themeById("nope-does-not-exist").id, THEMES[0].id);
});

// ---------------------------------------------------------------- the arena overlay blind spot
//
// THE BUG THESE EXIST FOR.
//
// A theme is the WEBSITE's colours; an arena is a MAP that no theme touches. Four overlays were
// drawn ON the arena using THEME tokens, so they were compared against the theme in every test
// above and passed — while being invisible on screen. Measured, the round countdown was 1.00:1 on
// 29 of the 60 theme x arena pairs (neon ink on Crystal Vault's pale sky is literally the same
// colour) and below the 3:1 bar on 31 of them. Ruan: "some of themes clash with the text on
// screen like the timer."
//
// So the overlays now carry their OWN background (an opaque plate) or their own outline, and the
// whole class of bug is asserted here rather than eyeballed.

/** Alpha-composite `fg` at `a` over `bg`. Both must be opaque hex, which is asserted separately. */
function over(fg: string, a: number, bg: string): string {
  const parts = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = parts(fg);
  const [r2, g2, b2] = parts(bg);
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(mix(r1, r2))}${hex(mix(g1, g2))}${hex(mix(b1, b2))}`;
}

test("the old themed countdown really was invisible, so this measure can see the bug", () => {
  // The negative control. If this ever starts passing, the assertion below has stopped measuring
  // anything real and should not be trusted.
  let worst = Infinity;
  let where = "";
  for (const t of THEMES) {
    for (const m of MAPS) {
      for (const band of m.sky) {
        const r = contrast(t.text, band) ?? 0;
        if (r < worst) {
          worst = r;
          where = `${t.id} ink on ${m.id}`;
        }
      }
    }
  }
  assert.ok(worst < 3, `themed ink straight onto the arena should be broken; measured ${worst.toFixed(2)}:1 (${where})`);
});

test("outlined arena text is readable on ANY background, not just the ten arenas we ship", () => {
  // contrast() depends only on relative luminance, so a sweep of greys covers EVERY possible
  // background colour: a saturated sky and a grey of the same luminance score identically. The
  // worst case of a light fill over a dark ring is where neither ring wins outright — measured
  // 4.44:1 at luminance 0.103, which clears the 3:1 bar for large text with room to spare.
  //
  // This is why the 60px countdown digit can sit straight on the arena while the small chips
  // cannot: an outline only guarantees ~4.4:1, and small text needs 4.5:1 on top of that.
  let worst = Infinity;
  let worstAt = "";
  for (let v = 0; v <= 255; v++) {
    const bg = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
    const readable = Math.max(contrast(ARENA_HUD.ink, bg) ?? 0, contrast(ARENA_HUD.outline, bg) ?? 0);
    if (readable < worst) {
      worst = readable;
      worstAt = bg;
    }
  }
  assert.ok(
    worst >= 4.4,
    `outlined arena text drops to ${worst.toFixed(2)}:1 on ${worstAt}; the light fill plus dark ring must never go below ~4.4`,
  );
});

test("every arena overlay is a self-contained pair, on an opaque background", () => {
  const pairs: [string, string, string][] = [
    ["countdown plate ink", ARENA_HUD.plateInk, ARENA_HUD.plate],
    ["countdown plate muted", ARENA_HUD.plateInkMuted, ARENA_HUD.plate],
    ["telegraph chip", ARENA_DANGER.ink, ARENA_DANGER.bg],
    ["save chip", ARENA_REWARD.ink, ARENA_REWARD.bg],
    ["result banner win", RESULT_PLATE.win, RESULT_PLATE.bg],
    ["result banner loss", RESULT_PLATE.loss, RESULT_PLATE.bg],
    ["result banner meta", RESULT_PLATE.inkMuted, RESULT_PLATE.bg],
    ["flare achievement", RESULT_FLARE.achievement, RESULT_FLARE.bg],
    ["flare plain", RESULT_FLARE.plain, RESULT_FLARE.bg],
  ];
  for (const [label, ink, bg] of pairs) {
    // lucid: an alpha colour cannot be contrast-checked, and a translucent surface over an arena
    // is exactly how the FINISH flag got to 2.5:1 while every assertion passed.
    assert.notEqual(luminance(bg), null, `${label}: background ${bg} must be an OPAQUE hex colour`);
    const ratio = contrast(ink, bg) ?? 0;
    assert.ok(ratio >= 4.5, `${label}: ${ink} on ${bg} is ${ratio.toFixed(2)}:1, below AA`);
  }
});

test("the telegraph and save chips keep their meaning while changing lightness", () => {
  // A signal must not have to be relearned because a cosmetic changed. Red still means a heavy hit
  // is coming and gold still means it is worth something — only the lightness moved, onto the dark
  // palette's values, because the arena is not the page.
  assert.equal(ARENA_DANGER.ink, SIGNALS_DARK.heat, "the telegraph chip must keep the heat hue family");
  assert.equal(ARENA_DANGER.bg, SIGNALS_DARK.heatDeep);
  assert.equal(ARENA_REWARD.ink, SIGNALS_DARK.coin, "the save chip must keep the coin hue family");
  assert.equal(ARENA_REWARD.bg, SIGNALS_DARK.coinDeep);
  // And the light-page values really do fail on that plate — which is WHY the dark pair is frozen
  // here rather than taken from the equipped theme.
  assert.ok((contrast(SIGNALS_LIGHT.heat, ARENA_DANGER.bg) ?? 0) < 4.5, "light heat on the dark chip should fail");
  assert.ok((contrast(SIGNALS_LIGHT.coin, ARENA_REWARD.bg) ?? 0) < 4.5, "light coin on the dark chip should fail");
});

test("the old translucent chips really were unreadable over the arena", () => {
  // The second negative control, for the chips specifically. FINISH used to be
  // `bg-heat-deep/70 text-heat` and the save prompt `bg-coin-deep/80 text-coin`: a themed SIGNAL
  // colour at partial alpha over a sky no theme owns. Measured across every theme x arena pair,
  // the best case was 4.49:1 and the worst 2.49:1 — so the two most urgent messages in the game
  // were below AA everywhere and near-illegible in places, while all four of the flat pairs above
  // passed. If this ever stops failing, the chip assertion above has gone hollow.
  const worstChip = (ink: string, plate: string, alpha: number): number => {
    let min = Infinity;
    for (const m of MAPS) {
      for (const band of m.sky) {
        min = Math.min(min, contrast(ink, over(plate, alpha, band)) ?? 0);
      }
    }
    return min;
  };
  for (const t of THEMES) {
    const s = t.signals ?? SIGNALS_LIGHT;
    assert.ok(
      worstChip(s.heat, s.heatDeep, 0.7) < 4.5,
      `${t.id}: the old FINISH chip should fail over the arena; it measured ${worstChip(s.heat, s.heatDeep, 0.7).toFixed(2)}:1`,
    );
    assert.ok(
      worstChip(s.coin, s.coinDeep, 0.8) < 4.5,
      `${t.id}: the old save chip should fail over the arena; it measured ${worstChip(s.coin, s.coinDeep, 0.8).toFixed(2)}:1`,
    );
  }
});

test("the fullscreen panels stay readable over every arena — and 90% did not", () => {
  // These panels float over the arena at a partial alpha with `backdrop-blur`, so every text pair
  // inside them — including "Xs left in round" — is measured on a composite of the theme's surface
  // over the map's sky. The flat theme-vs-theme check at the top of this file cannot see that.
  const worstPanel = (alpha: number): { ratio: number; where: string } => {
    let min = Infinity;
    let where = "";
    for (const t of THEMES) {
      for (const m of MAPS) {
        for (const band of m.sky) {
          const r = contrast(t.textMuted, over(t.surface, alpha, band)) ?? 0;
          if (r < min) {
            min = r;
            where = `${t.id}/${m.id}`;
          }
        }
      }
    }
    return { ratio: min, where };
  };

  const now = worstPanel(PANEL_ALPHA);
  assert.ok(now.ratio >= 4.5, `fullscreen timer text drops to ${now.ratio.toFixed(2)}:1 (${now.where})`);

  // Negative control: the 90% the panels used to use lands at 4.498:1 on Paper over Neon Grid —
  // under AA, and invisible to every assertion that existed at the time.
  const before = worstPanel(0xe6 / 255);
  assert.ok(before.ratio < 4.5, `the old 90% alpha should fail; measured ${before.ratio.toFixed(3)}:1`);
  assert.ok(PANEL_ALPHA > 0xe6 / 255, "PANEL_ALPHA must be more opaque than the value it replaced");
});

// ---------------------------------------------------------------- celebration confetti

test("the win's confetti is visible on a PALE arena, not only on a dark one", () => {
  // A win's confetti is gold plus the winner's light skin tones, and it is drawn with no
  // background of its own. Measured against the arena behind it, gold on free play's own Training
  // Ground sky is 1.02:1 — so on the arena MOST players fight in, the only celebration a win had
  // was drawn in the colour the floor already was.
  const onDefaultArena = Math.min(...MAPS[0].sky.map((b) => contrast(CELEBRATION_GOLD, b) ?? 0));
  assert.ok(
    onDefaultArena < 1.6,
    `gold on the default arena should be invisible without help; measured ${onDefaultArena.toFixed(2)}:1`,
  );

  // Rendering now puts a dark rim under every piece, so the readable contrast is whichever of the
  // piece and the rim sits further from the background — the same max() argument as the countdown
  // outline. It is never worse than 3.58:1 on ANY background.
  let worst = Infinity;
  let worstAt = "";
  for (let v = 0; v <= 255; v++) {
    const bg = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
    const readable = Math.max(contrast(CELEBRATION_GOLD, bg) ?? 0, contrast(ARENA_HUD.outline, bg) ?? 0);
    if (readable < worst) {
      worst = readable;
      worstAt = bg;
    }
  }
  assert.ok(worst >= 3, `rimmed confetti drops to ${worst.toFixed(2)}:1 on ${worstAt}`);

  // And on every arena actually shipped, not just the hypothetical worst case.
  for (const m of MAPS) {
    for (const band of m.sky) {
      const readable = Math.max(contrast(CELEBRATION_GOLD, band) ?? 0, contrast(ARENA_HUD.outline, band) ?? 0);
      assert.ok(readable >= 3, `${m.id}: rimmed confetti is only ${readable.toFixed(2)}:1 on sky ${band}`);
    }
  }
});

test("a win is loud: the burst is a curtain of mixed sizes, in the winner's colours", () => {
  const fx = new Fx();
  fx.emitConfetti(960, [CELEBRATION_GOLD, "#6d28d9", "#ffffff"]);
  assert.equal(fx.particles.length, 102, "three colours at the default 34 pieces each");
  assert.ok(
    fx.particles.every((p) => p.kind === "confetti"),
    "a win burst must not emit impact or trail particles",
  );
  // Mixed sizes are what stop a burst reading as one flat sheet.
  const sizes = new Set(fx.particles.map((p) => p.size > 8));
  assert.equal(sizes.size, 2, "the burst must mix large and small pieces");

  // It has to still be on screen when the player looks back up at the arena, which is where the
  // result card sits below in a non-fullscreen match.
  const longest = Math.max(...fx.particles.map((p) => p.life));
  assert.ok(longest >= 2.5, `confetti should linger while the card is read; longest life ${longest.toFixed(2)}s`);

  // Every piece starts ABOVE the stage so it falls INTO view rather than appearing mid-air.
  assert.ok(fx.particles.every((p) => p.y < 0), "pieces must spawn above the stage");
});

test("flares name what actually happened", () => {
  const result = (over: Partial<MatchResult> = {}): MatchResult => ({
    winner: "left" as Side,
    humanWon: false,
    roundsWon: 1,
    roundsLost: 2,
    wpm: 48,
    accuracy: 93.4,
    bestWpm: 48,
    bestCombo: 5,
    coins: 70,
    streak: 0,
    ...over,
  });

  // A dominant win names all of it, loudest first.
  const big = matchFlares({
    result: result({
      humanWon: true,
      roundsWon: 3,
      roundsLost: 0,
      accuracy: 99.1,
      bestCombo: 14,
      streak: 5,
    }),
    bestWpmEver: 48,
    firstWinToday: true,
    isBoss: true,
  });
  assert.ok(big.length <= FLARE_RULES.maxFlares, `capped at ${FLARE_RULES.maxFlares}, got ${big.length}`);
  assert.deepEqual(
    big.map((f) => f.label),
    ["CLEAN SWEEP", "FLAWLESS · 99.1%", "ON FIRE · CHAIN 14", "BOSS DOWN"],
  );

  // An ordinary loss gets nothing at all rather than a consolation prize it did not earn.
  const quiet = matchFlares({
    result: result(),
    bestWpmEver: 61,
    firstWinToday: false,
    isBoss: false,
  });
  assert.deepEqual(quiet, []);

  // A loss that IS a personal best gets exactly the one true thing about it.
  const fast = matchFlares({
    result: result({ wpm: 64, bestWpm: 64 }),
    bestWpmEver: 64,
    firstWinToday: false,
    isBoss: false,
  });
  assert.deepEqual(fast, [{ label: "NEW TOP SPEED · 64 WPM", tone: "plain" }]);

  // Win-only flares must never appear on a loss, whatever the numbers.
  const lostWell = matchFlares({
    result: result({ accuracy: 99.9, bestCombo: 20, streak: 9, roundsLost: 0 }),
    bestWpmEver: 99,
    firstWinToday: true,
    isBoss: true,
  });
  assert.deepEqual(lostWell, [], "a loss must not collect win-only flares");

  // And a zero-WPM match (never typed anything) must not be crowned a personal best.
  const idle = matchFlares({
    result: result({ wpm: 0, bestWpm: 0 }),
    bestWpmEver: 0,
    firstWinToday: false,
    isBoss: false,
  });
  assert.deepEqual(idle, [], "0 WPM is not a top speed");
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
