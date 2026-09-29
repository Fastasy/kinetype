#!/usr/bin/env python3
"""Validate game/words.ts against every rule the game depends on."""

import re, sys
from collections import Counter

import os
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "game/words.ts")
src = open(SRC).read()

def grab(name):
    m = re.search(rf"export const {name} = \[(.*?)\] as const;", src, re.S)
    if not m:
        sys.exit(f"FAIL: could not find {name}")
    return re.findall(r'"([^"]*)"', m.group(1))

light, mid, heavy = grab("LIGHT_WORDS"), grab("MID_WORDS"), grab("HEAVY_WORDS")
guard, recovery = grab("GUARD_WORDS"), grab("RECOVERY_WORDS")

fails = []

def check(cond, msg):
    if not cond:
        fails.append(msg)

# --- shape rules
for name, words, lo, hi in [
    ("LIGHT", light, 3, 4),
    ("MID", mid, 5, 7),
    ("HEAVY", heavy, 8, 99),
    ("GUARD", guard, 5, 5),
    ("RECOVERY", recovery, 5, 5),
]:
    for w in words:
        check(re.fullmatch(r"[a-z]+", w) is not None, f"{name}: illegal characters in {w!r}")
        check(lo <= len(w) <= hi, f"{name}: {w!r} is {len(w)} chars, expected {lo}-{hi}")

# --- duplicates
for name, words in [("LIGHT", light), ("MID", mid), ("HEAVY", heavy),
                    ("GUARD", guard), ("RECOVERY", recovery)]:
    dupes = [w for w, n in Counter(words).items() if n > 1]
    check(not dupes, f"{name}: duplicate words {dupes[:8]}")

# --- guard/recovery must not also be an attack word, so each word means one thing
mid_set = set(mid)
overlap = sorted(mid_set & (set(guard) | set(recovery)))
check(not overlap, f"GUARD/RECOVERY also appear in MID: {overlap[:10]}")

# --- blocklists must not have leaked through
BLOCK = set("""
anal anus arse arsehole ass bastard bitch bollocks boob bugger cock crap cunt damn dick
dildo dyke fag faggot fuck fuk gash hell homo honky jackass jizz knobend labia lmao
midget muff nigga nigger nuts orgy paki penis piss porn porno prick pussy queer rape
retard scrotum semen sex shag shit slut sodomy spic sperm tit tosser turd twat vagina
wank whore wog erotic nude naked orgasm bondage bisexual
""".split())
leaked = sorted(set(light + mid + heavy + guard + recovery) & BLOCK)
check(not leaked, f"profanity leaked into pools: {leaked}")

TECH = set("""
com org net www html php url http https biz info wiki mediawiki google youtube facebook
twitter amazon ebay yahoo hotmail gmail blog login download upload email website homepage
hosting server mysql linux windows android iphone ipad
""".split())
tech = sorted(set(light + mid + heavy) & TECH)
check(not tech, f"brand/web noise leaked into pools: {tech}")

# --- abbreviations have no vowel; real words do
novowel = sorted(w for w in set(light + mid + heavy + guard + recovery)
                 if not any(c in "aeiouy" for c in w))
check(not novowel, f"no-vowel words (abbreviation smell): {novowel}")

# --- report
total = len(light) + len(mid) + len(heavy)
print(f"LIGHT {len(light)}   MID {len(mid)}   HEAVY {len(heavy)}   "
      f"GUARD {len(guard)}   RECOVERY {len(recovery)}")
print(f"attack words total: {total}")
print()
print("SANITY SAMPLES (eyeball these for non-words or oddities)")
for name, words in [("light", light), ("mid", mid), ("heavy", heavy),
                    ("guard", guard), ("recovery", recovery)]:
    step = max(1, len(words) // 30)
    print(f"  {name:9s}: {' '.join(words[::step][:30])}")
print()

if fails:
    print("FAILURES:")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("ALL WORD-POOL CHECKS PASSED")
