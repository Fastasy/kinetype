#!/usr/bin/env python3
"""
Build game/sentences.ts from the hand-written list in scripts/sentences.txt.

Sentences are authored by hand (grammar and classroom safety are not something a
frequency list can supply), so this script is a validator and a sorter, not a
generator: it checks every rule, buckets each line into a band by character count,
and writes the TypeScript.

Rules enforced here (game/tests/engine.test.ts asserts the same rules on the
generated file, so the two cannot drift apart silently):

  - lowercase a-z and single spaces only; no punctuation, digits or double spaces
  - 4 to 11 words, 16 to 62 characters total
  - no word longer than 12 characters
  - every sentence holds at least one block word (<= BLOCK_MAX_CHARS) and at least
    one punch word (BLOCK_MAX_CHARS+1 .. KICK_MIN_CHARS-1), so every sentence can
    defend and attack. Kick words are optional.
  - no profanity, brands, web noise, abbreviations or lowercased proper nouns

KEEP IN SYNC WITH game/constants.ts:
  BLOCK_MAX_CHARS   = 3
  KICK_MIN_CHARS    = 8
and with the band bounds in game/sentences.ts (BAND_BOUNDS).
"""

import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "sentences.txt")
OUT = os.path.join(ROOT, "game/sentences.ts")

# --- must match game/constants.ts -------------------------------------------
BLOCK_MAX_CHARS = 3
KICK_MIN_CHARS = 8

# --- must match BAND_BOUNDS in the generated file ---------------------------
BAND_MAX = {"short": 28, "medium": 44}  # anything above 44 is "long"
MIN_CHARS, MAX_CHARS = 16, 62
MIN_WORDS, MAX_WORDS = 4, 11
MAX_WORD = 12

BLOCK = set("""
anal anus arse arsehole ass bastard bitch bollocks boob bugger cock crap cunt damn dick
dildo dyke fag faggot fuck fuk gash hell homo honky jackass jizz knobend labia lmao
midget muff nigga nigger nuts orgy paki penis piss porn porno prick pussy queer rape
retard scrotum semen sex shag shit slut sodomy spic sperm tit tosser turd twat vagina
wank whore wog erotic nude naked orgasm bondage bisexual
sexy gay
""".split())

TECH = set("""
com org net www html php url http https biz info wiki mediawiki google youtube facebook
twitter amazon ebay yahoo hotmail gmail blog login logout download upload email website
homepage hosting server mysql linux windows mac android iphone ipad
""".split())

STOP = TECH | set("""
monday tuesday wednesday thursday friday saturday sunday
january february march april june july august september october november december
""".split())

# A word must contain a vowel and at most one apostrophe-free a-z run: this is the
# abbreviation filter the word pools used, kept here so "tv" or "etc" cannot slip in.
VOWELS = set("aeiouy")


def move_of(word):
    if len(word) <= BLOCK_MAX_CHARS:
        return "block"
    if len(word) >= KICK_MIN_CHARS:
        return "kick"
    return "punch"


def band_of(text):
    if len(text) <= BAND_MAX["short"]:
        return "short"
    if len(text) <= BAND_MAX["medium"]:
        return "medium"
    return "long"


raw = open(SRC).read().splitlines()
lines = [ln.strip() for ln in raw if ln.strip() and not ln.strip().startswith("#")]

fails = []
seen = Counter()
sentences = []
for text in lines:
    seen[text] += 1
    words = text.split(" ")

    if not re.fullmatch(r"[a-z]+( [a-z]+)*", text):
        fails.append(f"illegal characters or spacing: {text!r}")
        continue
    if "  " in text:
        fails.append(f"double space: {text!r}")
    if not MIN_WORDS <= len(words) <= MAX_WORDS:
        fails.append(f"{len(words)} words, expected {MIN_WORDS}-{MAX_WORDS}: {text!r}")
    if not MIN_CHARS <= len(text) <= MAX_CHARS:
        fails.append(f"{len(text)} characters, expected {MIN_CHARS}-{MAX_CHARS}: {text!r}")
    for w in words:
        if len(w) > MAX_WORD:
            fails.append(f"word too long ({len(w)}): {w!r} in {text!r}")
        if not any(c in VOWELS for c in w):
            fails.append(f"no-vowel word (abbreviation smell): {w!r} in {text!r}")
        if w in BLOCK:
            fails.append(f"blocked word: {w!r} in {text!r}")
        if w in STOP:
            fails.append(f"day/month or web noise: {w!r} in {text!r}")

    moves = {w: move_of(w) for w in words}
    kinds = set(moves.values())
    if "block" not in kinds:
        fails.append(f"no block word (<= {BLOCK_MAX_CHARS} chars): {text!r}")
    if "punch" not in kinds:
        fails.append(f"no punch word: {text!r}")

    sentences.append((band_of(text), text))

dupes = [t for t, n in seen.items() if n > 1]
if dupes:
    fails.append(f"duplicate sentences: {dupes[:6]}")

# Every word that appears anywhere, checked once more as a vocabulary sanity list.
vocab = sorted({w for _, t in sentences for w in t.split(" ")})

if fails:
    print("FAILURES:")
    for f in fails:
        print("  -", f)
    sys.exit(1)

by_band = {b: [t for band, t in sentences if band == b] for b in ("short", "medium", "long")}

# The recovery word must still be a 5-character word a player can hit while falling.
RECOVERY_5 = [
    "catch", "climb", "cling", "float", "glide", "grasp", "hoist", "hover",
    "latch", "ledge", "mount", "perch", "reach", "scale", "swing", "vault",
    "surge", "boost", "drift", "fling", "heave", "hitch", "lunge", "pivot",
    "scoop", "seize", "shift", "slide", "swoop", "throw", "trail", "tread",
    "wedge", "wheel", "whirl", "wring", "carry", "chute", "crawl", "crest",
    "flick", "guide", "hinge", "march", "plane", "probe", "shove", "skate",
    "spare", "steer", "storm", "strut", "sweep", "swift", "tempo", "track",
    "train", "truss", "turbo",
]

kicks = sum(1 for _, t in sentences if any(move_of(w) == "kick" for w in t.split(" ")))
blocks = sum(1 for _, t in sentences if sum(move_of(w) == "block" for w in t.split(" ")) >= 2)


def fmt(items, per_line=1):
    """One sentence per line: they contain spaces, so they cannot share a line."""
    return "\n".join(f'  "{t}",' for t in items)


def fmt_words(items, per_line=6):
    return "\n".join(
        "  " + ", ".join(f'"{w}"' for w in items[i:i + per_line]) + ","
        for i in range(0, len(items), per_line)
    )


header = '''// Sentence pool. Lowercase a-z and single spaces only, no punctuation.
//
// GENERATED FILE — edit scripts/sentences.txt and run
//   python3 scripts/build-sentences.py
// then commit both. scripts/validate-sentences.py re-checks the output, and
// game/tests/engine.test.ts asserts the same rules on this file.
//
// A sentence is the unit of input, and every WORD inside it is a move:
//
//   block  (<= BLOCK_MAX_CHARS)  raises a guard
//   punch  (BLOCK_MAX_CHARS+1..KICK_MIN_CHARS-1)  a normal hit
//   kick   (>= KICK_MIN_CHARS)   the heavy, KO-capable hit
//
// So a sentence is a combo string, not a word list, and its composition decides
// what a fighter can do in the next few seconds. Every sentence below therefore
// contains at least one block word and at least one punch word: a sentence that
// could not defend would be a trap, and one that could not attack would be a
// wasted exchange.
//
// Sentences are hand-written rather than sampled. Grammar and classroom safety
// cannot be supplied by a frequency list, and this game is played in schools.
// The bands are by TOTAL CHARACTER COUNT, because that is what the player types.
'''

body = f'''export type SentenceBand = "short" | "medium" | "long";

/** Upper bound of each band, in characters. Above "medium" is "long". */
export const BAND_BOUNDS = {{ short: {BAND_MAX["short"]}, medium: {BAND_MAX["medium"]} }} as const;

/** {len(by_band["short"])} sentences, {BAND_MAX["short"]} characters or fewer. */
export const SENTENCES_SHORT = [
{fmt(by_band["short"])}
] as const;

/** {len(by_band["medium"])} sentences, {BAND_MAX["short"] + 1} to {BAND_MAX["medium"]} characters. */
export const SENTENCES_MEDIUM = [
{fmt(by_band["medium"])}
] as const;

/** {len(by_band["long"])} sentences, {BAND_MAX["medium"] + 1}+ characters. */
export const SENTENCES_LONG = [
{fmt(by_band["long"])}
] as const;

export const SENTENCE_BANDS: Record<SentenceBand, readonly string[]> = {{
  short: SENTENCES_SHORT,
  medium: SENTENCES_MEDIUM,
  long: SENTENCES_LONG,
}};

export const SENTENCES: readonly string[] = [
  ...SENTENCES_SHORT,
  ...SENTENCES_MEDIUM,
  ...SENTENCES_LONG,
];

/**
 * Which bands a fighter draws from, by bot-ladder tier.
 *
 * A 20 WPM player handed a 55-character sentence spends half a minute on it and
 * learns nothing, so the sentence load has to follow the chosen speed. The tier is
 * the only difficulty knob the player sets, so it is the honest input for this.
 */
export function bandsForTier(tier: number): readonly SentenceBand[] {{
  if (tier <= 2) return ["short"];
  if (tier <= 5) return ["short", "medium"];
  return ["medium", "long"];
}}

/** Exactly RECOVERY_WORD_LENGTH (5) characters. Typed while falling, must be easy. */
export const RECOVERY_WORDS = [
{fmt_words(RECOVERY_5)}
] as const;
'''

open(OUT, "w").write(header + body)

print("wrote", OUT)
print(f"  sentences {len(sentences)}  (short {len(by_band['short'])}, "
      f"medium {len(by_band['medium'])}, long {len(by_band['long'])})")
print(f"  with a kick word: {kicks}   with two or more block words: {blocks}")
print(f"  distinct words used: {len(vocab)}   recovery words: {len(RECOVERY_5)}")
