#!/usr/bin/env python3
"""
Generate expanded word pools for Kinetype from a frequency-ranked English list.

Source: google-10000-english (frequency ordered, most common first).
Output: game/words.ts

Rules (the test suite asserts them):
  - lowercase a-z only; LIGHT 3-4, MID 5-7, HEAVY 8+; GUARD/RECOVERY exactly 5
  - no duplicates inside a pool
  - guard/recovery words are excluded from MID so a word means exactly one thing
  - no profanity, no brands/web noise, no abbreviations or proper nouns
"""

import os
import re
import sys
from collections import OrderedDict

# The source list is not committed: fetch it first with
#   curl -sL -o /tmp/en10k.txt \
#     https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english.txt
# Override with: python3 scripts/build-word-pools.py /path/to/list.txt
SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/en10k.txt"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "game/words.ts")

# This game is aimed at the school / "unblocked" audience, so the bar is
# "a teacher would be fine with it".
BLOCK = set("""
anal anus arse arsehole ass bastard bitch bollocks boob bugger cock crap cunt damn dick
dildo dyke fag faggot fuck fuk gash hell homo honky jackass jizz knobend labia lmao
midget muff nigga nigger nuts orgy paki penis piss porn porno prick pussy queer rape
retard scrotum semen sex shag shit slut sodomy spic sperm tit tosser turd twat vagina
wank whore wog erotic nude naked orgasm bondage bisexual
# "sexy" and "gay" are not profanity, but this game is played in classrooms and both
# generate complaints. The bar here is "a teacher would be fine with it".
sexy gay
""".split())

# Brand and web-noise tokens. Real words that merely read as "tech" (software, click,
# hardware) are allowed; this is for tokens that are not really words.
TECH = set("""
com org net www html php url http https biz info wiki mediawiki google youtube facebook
twitter amazon ebay yahoo hotmail gmail blog login logout download upload email website
homepage hosting server mysql linux windows mac android iphone ipad
""".split())

# Abbreviations, units, file types and other non-words that sit in the source list.
JUNK = set("""
jan feb mar apr jun jul aug sep oct nov dec mon tue tues wed thu thur thurs fri sat sun
pdf doc docx png gif jpg jpeg xml css api dns ftp ram cpu gpu usb sql sdk ide cli gui
pre postfixsuffix etc eg ie vs pm am ad ads min max avg img src div nav btn jpg
iii vii viii xii xiii mm cm km kg lb oz ft mb kb gb tb ghz mhz
dept approx misc inc ltd corp co mr mrs ms dr st ave rd blvd
wasnt isnt dont doesnt didnt couldnt wouldnt shouldnt thats whats heres theres
sep oct nov dec hmm ugh huh ok okays yeah nope yep
dvd usa rss faq sony cnet java eur usr est gmt tel prev int non anti iraq san los
june july pic pics
os xp adsl isp sms mms gps gprs lcd led vhs cd
nfl nba mlb nhl fifa ufc pc ibm hp dell intel amd nvidia
bing msn aol skype itunes ipod xbox playstation nintendo wii
casino poker lottery viagra cialis torrent warez
iran cuba peru chile kenya ghana egypt israel mexico brazil argentina portugal greece
poland turkey korea vietnam thailand indonesia malaysia singapore
las del von der le les des du
ohio oregon utah iowa idaho kansas nevada nebraska oklahoma wyoming montana alabama
alaska arizona arkansas hawaii delaware vermont virginia indiana georgia maine
isbn ascii unix modem router admin wifi lan wan intranet ethernet pixel
# Day and month names, plus cities and regions. "march", "may" and "august" are NOT
# blocked: they are ordinary English words too, and they read fine as prompts.
monday tuesday wednesday thursday friday saturday sunday
january february april june july september october november december
chicago boston seattle denver atlanta dallas houston phoenix miami detroit vegas
berlin madrid moscow dublin scotland wales ireland england angeles francisco
toronto sydney melbourne auckland dubai singapore mumbai delhi beijing shanghai
""".split())

# Lowercased proper nouns (names + places) that survive in the source list.
NAMES = set("""
john james david michael chris mike peter paul mark steve robert richard thomas charles
joe jim bill bob tom tim andy kevin brian jason jeff ryan gary frank scott eric greg
mary patricia jennifer linda elizabeth barbara susan jessica sarah karen nancy lisa
margaret betty sandra ashley dorothy kim emily donna michelle carol amanda melissa
deborah stephanie rebecca sharon laura cynthia kathleen amy angela shirley anna ruth
america american english british french german spanish chinese japanese indian russian
london paris tokyo china india france germany spain italy japan canada australia
africa europe asia texas florida california york washington lincoln
""".split())

STOP = BLOCK | TECH | JUNK | NAMES

# Guard words: read as "defend". Written by hand rather than sampled, because a random
# common 5-letter word makes a meaningless prompt. The first version of this generator
# padded them from the frequency list and produced guards like "other" and "these".
GUARD_5 = [
    "block", "brace", "cover", "dodge", "fence", "guard", "hedge", "parry",
    "poise", "rally", "raise", "ready", "repel", "rigid", "shell", "spike",
    "stall", "stand", "steel", "stern", "stiff", "still", "stout", "strap",
    "stone", "stoop", "tower", "wield", "avert", "blunt", "clamp", "dense",
    "erect", "evade", "forge", "level", "lever", "nerve", "plate", "press",
    "prime", "proof", "sharp", "solid", "stake", "stark", "stead", "sting",
    "tight", "tough", "tried", "vigil", "watch",
]

# Recovery words: read as "get back to the stage while falling".
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

reserved5 = set(GUARD_5) | set(RECOVERY_5)


def load_existing():
    """Keep the hand-picked, game-flavoured attack words already in the file."""
    src = open(OUT).read()

    def grab(name):
        m = re.search(rf"export const {name} = \[(.*?)\] as const;", src, re.S)
        return re.findall(r'"([a-z]+)"', m.group(1)) if m else []

    return {k: grab(n) for k, n in [
        ("light", "LIGHT_WORDS"), ("mid", "MID_WORDS"), ("heavy", "HEAVY_WORDS")]}


existing = load_existing()

VOWELS = set("aeiouy")


def is_wordlike(w):
    """Last line of defence against abbreviations: a real word has a vowel."""
    return re.fullmatch(r"[a-z]{3,}", w) is not None and any(c in VOWELS for c in w)


freq = [w.strip() for w in open(SRC)
        if is_wordlike(w.strip()) and w.strip() not in STOP]

TARGET = {"light": 450, "mid": 800, "heavy": 800}


def band_of(w):
    return "light" if len(w) <= 4 else ("mid" if len(w) <= 7 else "heavy")


pools = {b: OrderedDict() for b in TARGET}

# Existing words first, but drop any that are now reserved or blocked.
for b, words in existing.items():
    for w in words:
        if w in STOP or w in reserved5:
            continue
        if band_of(w) != b:
            continue
        pools[b][w] = None

# Top up from the frequency list, most common first.
for w in freq:
    b = band_of(w)
    if len(pools[b]) >= TARGET[b]:
        continue
    if b == "mid" and w in reserved5:
        continue
    pools[b][w] = None

pools = {b: list(v) for b, v in pools.items()}


def fmt(words, per_line=6):
    return "\n".join(
        "  " + ", ".join(f'"{w}"' for w in words[i:i + per_line]) + ","
        for i in range(0, len(words), per_line)
    )


header = '''// Word pools. Lowercase a-z only, no proper nouns, no punctuation.
//
// Length bands are load-bearing: the tier decides damage and knockback scaling, so a
// word must never be moved between pools without re-checking the balance table.
// game/tests/engine.test.ts asserts every word sits inside its band.
//
// Provenance: the attack pools are drawn from a frequency-ranked English list
// (google-10000-english, most common first) so prompts are words a player actually knows
// and can spell. The hand-picked game-flavoured words this file started with are kept and
// merged in. Filtered for profanity, brand/web noise, abbreviations and lowercased proper
// nouns, because this game is aimed at the school market.
//
// GUARD_WORDS and RECOVERY_WORDS are written by hand rather than sampled: they need to
// read as "defend" and "get back up", and a randomly sampled 5-letter word does not.
// No word appears in both MID and the guard/recovery pools.
'''

body = f'''import type {{ WordTier }} from "./types";

/** 3-4 characters. Fast, low damage, high base knockback. Creates space. */
export const LIGHT_WORDS = [
{fmt(pools["light"])}
] as const;

/** 5-7 characters. Balanced. */
export const MID_WORDS = [
{fmt(pools["mid"])}
] as const;

/** 8+ characters. Slow, high damage, high knockback scaling. */
export const HEAVY_WORDS = [
{fmt(pools["heavy"])}
] as const;

/** Exactly GUARD_WORD_LENGTH (5) characters. Short enough to be a real parry window. */
export const GUARD_WORDS = [
{fmt(GUARD_5)}
] as const;

/** Exactly RECOVERY_WORD_LENGTH (5) characters. Typed while falling, must be easy. */
export const RECOVERY_WORDS = [
{fmt(RECOVERY_5)}
] as const;

export const POOLS: Record<WordTier, readonly string[]> = {{
  light: LIGHT_WORDS,
  mid: MID_WORDS,
  heavy: HEAVY_WORDS,
}};

export const TIER_ORDER: readonly WordTier[] = ["light", "mid", "heavy"];
'''

open(OUT, "w").write(header + body)

print("wrote", OUT)
for k in ("light", "mid", "heavy"):
    print(f"  {k:6s} {len(pools[k])}")
print(f"  guard    {len(GUARD_5)}")
print(f"  recovery {len(RECOVERY_5)}")
print(f"  TOTAL attack words: {sum(len(v) for v in pools.values())}")
