#!/usr/bin/env python3
"""
Validate game/sentences.ts against every rule the game depends on.

This is the read-only check; scripts/build-sentences.py writes the file. Run this
after any hand edit, and in CI before a deploy.

KEEP IN SYNC WITH game/constants.ts: BLOCK_MAX_CHARS = 3, KICK_MIN_CHARS = 8.
"""

import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "game/sentences.ts")
src = open(SRC).read()

BLOCK_MAX_CHARS, KICK_MIN_CHARS = 3, 8
BAND_MAX = {"short": 28, "medium": 44}
MIN_CHARS, MAX_CHARS = 16, 62
MIN_WORDS, MAX_WORDS = 4, 11
MAX_WORD = 12


def grab(name):
    m = re.search(rf"export const {name} = \[(.*?)\] as const;", src, re.S)
    if not m:
        sys.exit(f"FAIL: could not find {name}")
    return re.findall(r'"([^"]*)"', m.group(1))


bands = {b: grab(f"SENTENCES_{b.upper()}") for b in ("short", "medium", "long")}
all_sentences = [s for b in bands.values() for s in b]
recovery = grab("RECOVERY_WORDS")

if not all_sentences:
    sys.exit("FAIL: no sentences parsed — did the file structure change?")


def move_of(word):
    if len(word) <= BLOCK_MAX_CHARS:
        return "block"
    if len(word) >= KICK_MIN_CHARS:
        return "kick"
    return "punch"


fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


# --- shape and composition rules
for band, sentences in bands.items():
    for text in sentences:
        words = text.split(" ")
        check(
            re.fullmatch(r"[a-z]+( [a-z]+)*", text) is not None,
            f"{band}: illegal characters or spacing in {text!r}",
        )
        check(
            MIN_WORDS <= len(words) <= MAX_WORDS,
            f"{band}: {len(words)} words in {text!r}",
        )
        check(
            MIN_CHARS <= len(text) <= MAX_CHARS,
            f"{band}: {len(text)} characters in {text!r}",
        )
        if band != "long":
            check(
                len(text) <= BAND_MAX[band],
                f"{band}: {len(text)} characters exceeds the band bound in {text!r}",
            )
        else:
            check(
                len(text) > BAND_MAX["medium"],
                f"{band}: {len(text)} characters is short enough for a lower band: {text!r}",
            )
        for w in words:
            check(len(w) <= MAX_WORD, f"word too long ({len(w)}): {w!r} in {text!r}")
            check(
                any(c in "aeiouy" for c in w),
                f"no-vowel word (abbreviation smell): {w!r} in {text!r}",
            )
        kinds = {move_of(w) for w in words}
        # Every sentence must be able to defend and to attack. A sentence with no
        # block word is a trap; one with no punch word is a wasted exchange.
        check("block" in kinds, f"no block word (<= {BLOCK_MAX_CHARS} chars): {text!r}")
        check("punch" in kinds, f"no punch word: {text!r}")

# --- duplicates, in a band or across bands
dupes = [s for s, n in Counter(all_sentences).items() if n > 1]
check(not dupes, f"duplicate sentences: {dupes[:6]}")

# --- recovery words
for w in recovery:
    check(re.fullmatch(r"[a-z]{5}", w) is not None, f"recovery word is not 5 letters: {w!r}")
dupes_r = [w for w, n in Counter(recovery).items() if n > 1]
check(not dupes_r, f"duplicate recovery words: {dupes_r[:6]}")

# --- blocklists must not have leaked through
BLOCK = set("""
anal anus arse arsehole ass bastard bitch bollocks boob bugger cock crap cunt damn dick
dildo dyke fag faggot fuck fuk gash hell homo honky jackass jizz knobend labia lmao
midget muff nigga nigger nuts orgy paki penis piss porn porno prick pussy queer rape
retard scrotum semen sex shag shit slut sodomy spic sperm tit tosser turd twat vagina
wank whore wog erotic nude naked orgasm bondage bisexual
""".split())
TECH = set("""
com org net www html php url http https biz info wiki mediawiki google youtube facebook
twitter amazon ebay yahoo hotmail gmail blog login download upload email website homepage
hosting server mysql linux windows android iphone ipad
""".split())
DAYS = set("""
monday tuesday wednesday thursday friday saturday sunday
january february march april june july august september october november december
""".split())

words = {w for s in all_sentences for w in s.split(" ")}
check(not (words & BLOCK), f"profanity leaked in: {sorted(words & BLOCK)}")
check(not (words & TECH), f"brand/web noise leaked in: {sorted(words & TECH)}")
check(not (words & DAYS), f"day or month names leaked in: {sorted(words & DAYS)}")

# --- report
tally = {b: len(v) for b, v in bands.items()}
kicks = sum(1 for s in all_sentences if any(move_of(w) == "kick" for w in s.split(" ")))
moves = Counter(move_of(w) for s in all_sentences for w in s.split(" "))
print(
    f"sentences {len(all_sentences)}  "
    f"(short {tally['short']}, medium {tally['medium']}, long {tally['long']})"
)
print(
    f"moves per word: {moves['block']} block, {moves['punch']} punch, {moves['kick']} kick"
)
print(
    f"sentences containing a kick: {kicks}/{len(all_sentences)} "
    f"({round(100 * kicks / len(all_sentences))}%)"
)
print(f"distinct words: {len(words)}   recovery words: {len(recovery)}")
print()
print("SANITY SAMPLES (eyeball these for grammar and tone)")
for band, sentences in bands.items():
    step = max(1, len(sentences) // 8)
    print(f"  {band:7s}:")
    for s in sentences[::step][:8]:
        kinds = " ".join(move_of(w)[0].upper() for w in s.split(" "))
        print(f"    {kinds:>20s}  {s}")
print()

if fails:
    print("FAILURES:")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("ALL SENTENCE CHECKS PASSED")
