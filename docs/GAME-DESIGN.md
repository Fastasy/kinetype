# Kinetype — Game Design Spec

**Version** 1.5 · **Date** 2026-10-08 · **Status** MVP implementation
**Companion research** vault `Kinetype/Research/2026-09-28-design-evidence-knockback-and-typing.md`
**Companion balance note** vault `Kinetype/Research/2026-10-05-balance-recovery-ladder-and-match-length.md`

This document is the build contract. Every number here is either sourced from the design research or an explicit tuning constant that lives in `game/constants.ts`. If the code and this document disagree, the code is wrong.

**1.5 changelog (2026-10-08).** The boss ladder was enterable from the address bar. `/play?boss=<id>`
turned the arena into ANY boss in the roster whatever the account had earned, and `submit_match()`
paid whatever boss payload it was handed — so a level-1 account could paste `/play?boss=oblivion`,
fight the final boss, and be paid the XP, the boss bonus, the one-time coin bounty and the CLEAR.
Both halves are fixed and the fix is specified in the new §17: the client refuses to mount an
unearned arena, and the server refuses to bank one, from the same rule stated once in TypeScript and
mirrored in SQL (`boss_defs` + `boss_unlocked()`), pinned by a drift verifier. §14's boss paragraph
gained a pointer to it and §13 gained four acceptance criteria. Nothing about the ladder itself,
free play, or any reward changed.

**1.4 changelog (2026-10-07).** The first-visit tour arrives: a nine-step walk through the front door
and into the arena that opens itself once per browser, then can be replayed from Your account or
`?tour=1`. Specified in the new §16. It grants nothing — no coins, no XP — so it needs no migration
and no server rule; the one thing worth flagging up front is that its seen flag is **deliberately
not** part of the save wallet, because the wallet is parked and restored around sign-in and a tour
flag in there would be rolled back by signing out (§16.3). §11.5 gained a paragraph and §13 gained
five acceptance criteria; nothing else changed.

**1.3 changelog (2026-10-07).** Quests arrive: three dailies (one easy, one medium, one hard) and two weeklies, each paying bonus XP and coins, **rotating every day** so the set cannot be memorised. Specified in full in the new §15, which is the only section that changed; §10's currency paragraph and the acceptance criteria were extended to point at it. The one thing worth flagging up front: quests pay **XP as well as coins**, which is a knowing departure from 0007's "daily bonuses pay coins only" rule, argued in §15.5 with its two bounded consequences.

**1.2 changelog (2026-10-05).** The recovery window moved from SECONDS to CHARACTERS. It was a flat seconds figure (1.8s, -0.25s per save, floor 0.8s) and that made surviving a ring-out a pure function of absolute WPM, which measured as a step rather than a curve: nothing below 33 WPM could ever save, nothing at or above 75 WPM could ever fail to, and the 70 WPM bot Ruan reported on saved four times out of five. Also fixed in the same session, on Ruan's call: the bot now banks typing progress through a stun under the player's own `INPUT_BUFFER_MAX` cap (§9), removing a ~1-rung edge the human held for free. Match length was measured, and Ruan decided to accept short arcade rounds rather than pad them (§13.5). §3, §7, §9, §11 and §13.5 changed.

**1.1 changelog.** The unit of input moved from one word to one **sentence**, and the words inside a sentence became moves: small words block, ordinary words punch, difficult words kick. Both fighters now spawn in the middle of the stage. Sections 1, 2, 4, 5, 6, 7, 9 and 13 changed; the rest stands.

---

## 1. The one-line pitch

A two-player platform fighter where the only input is typing. You are handed a sentence, every word in it is a move, and the moves push your opponent toward the edge. Knock them off.

## 2. The problem this design has to solve

Typing speed is a near-linear skill. A pure speed race is tic-tac-toe with a keyboard: knowing what your opponent will do next is worth nothing, because there is no choice to predict. Three structural answers are built in:

1. **Sentence composition.** The sentence decides your next few moves and when they arrive. A sentence with a small word early gives you a cheap block; a sentence with a long word gives you a kill shot four words out. You cannot skip a word, so the sentence you were handed is the hand you have to play, and reading it before you start typing is the skill.
2. **The defensive verb.** A completed small word raises a guard, and a guard held when a kick lands is a parry. The losing player therefore has a read available that is not "type faster".
3. **Cumulative force.** Push is not one binary shove per word; force accumulates so short-run speed differences amortise instead of deciding instantly.

## 3. Match structure

| Element | Decision |
|---|---|
| Players | 1 human vs 1 bot (MVP). Architecture keeps the second fighter controller-swappable for later netplay. |
| Rounds | Best of 3. A round measures ~28-40s and a match ~60-105s — see §13.5. A **SESSION** is 10+ min, i.e. several matches, which is where the fatigue bound actually lives. |
| Win condition | Knock the opponent past their blast line. No health bar. |
| Stage | Side-view. One main platform plus two floating platforms. Blast lines at both horizontal edges and below. |
| Match timer | 90s per round. On timeout, the fighter with the lower damage percent wins the round. |

## 4. Fighters

| Property | Value | Source |
|---|---|---|
| Base weight (`w`) | 100 for both fighters in MVP | Smash knockback formula |
| Damage percent (`p`) | Starts 0, no cap | Damage is an escalation clock, not a health bar |
| Ground/air states | Grounded, airborne, hitstun, recovering, staggered | |
| Movement | Horizontal drift only. No jump input exists; recovery is word-driven | Typing is the only input |
| Spawn | **Centre of the main platform**, 88px apart (x 596 and x 684, stage centre 640) | Ruan's call: 1.1 |

Both fighters spawn in the middle of the stage, 88px apart, which clears the 84px-wide sprite and the 62px hurtbox, so neither starts already overlapping the other. The positions are still symmetric about the stage centre, so neither side starts at an advantage and the spawn is still equidistant from each own blast line.

**Both paths that return a fighter to the stage use this spawn: a round restart and a successful save.** For a long time only the round restart did. The save path still used the old wide marks (`platforms[0].x ± 50`, x 390 / 890), so a ring-out ended with the fight shoved into a corner: the player who had just been launched came back out at the edge while their opponent stayed wherever they happened to be. Ruan caught it by playing: *"the players still dont spawn in the middle after one is knocked off."* It survived a design read and every test, because the constants were correct and only the round path was exercised.

The fix was structural rather than local. Fighter position had drifted into three sites, which is why one of them could keep an obsolete coordinate. Spawn positioning now lives in a single private method, `placeAtSpawn`, and `resetRound` and `recoverSuccess` both call it. The mid-fall clamp in `beginRecovery` deliberately does NOT, and carries a comment saying so, because that one holds a falling fighter at the edge so the player can see what they are saving.

**A save moves BOTH fighters.** Resetting only the saved player would leave the opponent wherever they stood, so a ring-out could still hand either side a positional gift. Returning both to centre makes a save positionally neutral.

**Damage colour gradient** (cheapest legible damage meter, Brawlhalla model, needs no numbers):

| Damage | Colour |
|---|---|
| 0-30% | white |
| 30-60% | yellow |
| 60-100% | orange |
| 100-150% | red |
| 150%+ | near-black |

## 5. Knockback

Adapted from the published Smash formula, with the terms this game actually has:

```
KB = ( ( ( ( (p/10 + p*d/20) × (200/(w+100)) × 1.4 ) + 18 ) × s ) + b ) × r
```

- `p` = target's damage percent after this hit is applied
- `d` = damage this hit deals
- `w` = target weight (100)
- `s` = knockback scaling of the move / 100
- `b` = base knockback
- `r` = situational multiplier (block, parry, counter, recovery vulnerability)

Knockback converts to launch velocity the same way Smash does: `velocity = KB × 0.03`, decaying. Knockback units and pixels travelled are deliberately not the same thing, so launches arc and stop instead of teleporting.

**Word difficulty decides the move**, and the move drives `d` and `s`:

| Word length | Move | Damage `d` | Scaling `s` | Base `b` | Commit cost |
|---|---|---|---|---|---|
| 1-3 chars | **Block** | 0 | — | — | Fastest, and it does not attack |
| 4-7 chars | **Punch** | 8 | 1.05 | 20 | Medium |
| 8+ chars | **Kick** | 14 | 1.25 | 14 | Slowest |

The thresholds live in `game/constants.ts` as `BLOCK_MAX_CHARS` (3) and `KICK_MIN_CHARS` (8), classification lives in `game/moves.ts`, and `scripts/build-sentences.py` classifies the pool with the same numbers. Changing a threshold means regenerating the pool.

Kicks have lower base knockback and higher scaling than punches. That gives kicks positional value early and KO value late, while punches still create space at 0% (base knockback). This is the two-knob structure documented in the research, and it is why the long word is the kill move.

**Hitstun** is derived, never an independent timer: `hitstun = KB × 0.25`, clamped between 0.1s and 0.75s.

**The Brawl rule.** The victim may never cancel hitstun on a fixed schedule. Brawl allowed an air dodge at a fixed 13 frames regardless of knockback and true combos collapsed. Hitstun in this game always scales with the knockback actually taken.

**The anti-lockout rule** (added 2026-09-28, from browser testing). At most one hit can land on a fighter every `HIT_COOLDOWN` (1.05s). A move that arrives during that window is spent for nothing.

This was not in the first design and it is not a nicety. A player landing a word roughly every 0.17s against a 0.75s maximum hitstun left the opponent permanently stunned and unable to take a turn at all. That is precisely the degenerate state Sirlin describes: one dominant strategy, no counterplay.

`HIT_COOLDOWN` must always exceed `HITSTUN_MAX`, so the victim is guaranteed `HIT_COOLDOWN - HITSTUN_MAX` seconds of free action after every hit. Currently 0.30s. `game/tests/engine.test.ts` asserts that invariant, so it cannot be tuned away by accident.

It also improves the game on its own terms: hits become scarce, so timing a kick matters more than typing volume.

**Hitstun costs time, never keystrokes** (added 2026-10-03). A hit landing mid-word used to delete whatever the player typed during the stun, and the same was true of the countdown and of a recovery cut. For a typing game that is the worst possible feel bug, because the player is mid-flow and their hands keep moving: the sentence simply stops responding and the game reads as broken. Keystrokes that cannot be applied are now held (up to `INPUT_BUFFER_MAX`) and delivered in order the frame the fighter can act again. The cap is what keeps this a courtesy rather than an exploit — see `game/constants.ts`.

**Corrected 2026-10-06 — the hold is per ROUND, not per match.** The original version of this decision folded the 2.2s countdown into the hold window, and that turned out to be a bug Ruan found by playing: mash while nobody can act and three characters were banked and handed to the NEXT round the moment it went live, i.e. free progress on a sentence he never typed against. Holding now covers hitstun, strict-mode stagger and a recovery cut *inside a live round*; input pressed once the round is decided (through the KO cut, the end-of-round hold and the next countdown) is dropped. Rule: `Match.canHoldInput`.

**Amended 2026-10-07 — the recovery cut is out of the window too.** The correction above drew the line at "inside a live round", which still left the KO cut holding: the player whose OPPONENT is falling cannot act, so their mashing queued up and the HUD announced **"3 KEYS HELD"** while the round was already lost. Ruan photographed that exact chip and said that was the feature he meant. Holding is now limited to **hitstun and strict-mode stagger** — the only two cases where the player is genuinely mid-sentence with the prompt in front of them. Removing the cut costs nobody their save: the cut blocks only the player whose opponent is off the stage, while the falling fighter's own save input is *accepted*, never held.

## 6. Typing

| Element | Decision |
|---|---|
| Unit of input | **One sentence.** Every word inside it is a move, fired when that word is completed. |
| Commit point | **The whole word.** A move fires on the last correct character of its word only. No sub-word timing window exists, so the documented "hold the last letter for the right moment" exploit has nothing to exploit. |
| Spaces | **A real key, and required.** The space between two words is the next required keypress, and nothing advances until it lands. Not optional: if the last letter also moved the cursor, pressing space would be a strictly worse choice than typing straight through and the key would be decoration. It cannot be ignored when wrong either — a stray space mid-word is a mistake like any other. There is no trailing separator, because the space lives BESIDE the words: the last word ends the sentence on its own final letter. |
| Prompts on screen | **1 per fighter, always.** The next sentence arrives the instant the current one ends, with no gap and nothing to select. |
| Mistype default | **Bonus lost, not progress lost.** A wrong character clears *that word's* precision bonus. Progress stands and the rest of the sentence still earns its own bonus, so a typo early in a long sentence costs one word's damage rather than the sentence. |
| Strict mode (opt-in) | A player setting. Mistype adds 0.4s of stagger. For players who want the risk dial turned up. |
| Input while the player cannot act | **Held for a hit and a stagger, dropped everywhere else.** Up to `INPUT_BUFFER_MAX` (3) keystrokes are queued and delivered in the order they were pressed, on the frame the fighter can act again — and only for hitstun and strict-mode stagger, where the player is mid-sentence and the game must not appear to eat their hands. While the opponent is off the stage, once the round is decided, and during the next countdown, input is dropped rather than banked, so the HUD never advertises a queue that has nowhere to go. |
| Combo | **A chain of flawlessly typed words.** Every `COMBO_STEP` (3) clean words in a row adds `COMBO_BONUS_PER_STEP` (15%) to the damage of every move, capped at `COMBO_MAX_STEPS` (4) rungs, so a chain of 12 is worth ×1.60 and no more. ANY mistake breaks it — a wrong letter, a missed separator, a stray space. Stacks on top of the per-word precision bonus. Cleared at the start of each round (a fresh climb) but the match best is kept. |
| Precision bonus | Completing a word with zero errors increases that move's damage by 25% and shows a distinct flash. |
| Accuracy | Tracked per round and per match. Feeds the coin payout. |
| WPM | **Two figures, and the payout uses the conservative one.** The live meter is correct characters within the last `WPM_WINDOW` (8s) divided by the window itself, so a pause drags it down and a burst lifts it. The match figure (`averageWpm`) is every correct character over the whole typing clock, and that is what the result screen, the saved personal best and the coin/XP payout use, because a rolling peak pays a player twice for one lucky burst. The clock is advanced by `tick(dt)` and by nothing else, and it does not run during the countdown, hitstop or a round-over freeze. |
| Sentence load | Scales with the chosen bot speed. See below. |

**The sentence pool is hand-written, 384 sentences, and generated into `game/sentences.ts` by `scripts/build-sentences.py`.** Grammar and classroom safety cannot be supplied by a frequency list, so the source lines live in `scripts/sentences.txt` and the build script validates and sorts them. Rules, all asserted both by the script and by `game/tests/engine.test.ts`:

- lowercase a-z and single spaces only; no punctuation, no digits
- 4 to 16 words, 16 to 88 characters
- no word longer than 12 characters
- **every sentence contains at least one block word and at least one punch word.** A sentence that could not defend would be a trap; one that could not attack would be a wasted exchange.
- no profanity, brands, web noise, abbreviations or lowercased proper nouns. This game targets the school market, so the bar is "a teacher would be fine with it".

Kicks are optional per sentence, and 56% of the pool has one. The long band is 90% kicks; the short band is 37%, because a 25-character sentence only fits an eight-letter word if the word is chosen for it. Short and medium sentences that carry a kick were authored deliberately: without them, a player on a slow bot speed never throws a kick and can never land the knockout the game is built around.

**Sentence load follows the difficulty.** Bands are by total character count, because that is what the player types: short (≤30), medium (31-54), long (55+). `bandsForTier()` maps the bot ladder to bands: tiers 0-2 (20/30/40 WPM) draw short sentences only, tiers 3-5 draw short and medium, tiers 6-8 draw medium and long. A 20 WPM player handed a 75-character sentence spends most of a minute on it and learns nothing, which is why the SHORT band was left almost where it was when the ceiling moved: the extra length belongs at the top, where the player has the speed to use it. The ceiling rose 62 → 88 characters, the word cap 11 → 16, and the long band went from 38 sentences to 116 — the hand a player is dealt is now big enough to plan several moves ahead, which is the whole point of a sentence being a hand rather than a word.

**Design history, so it is not re-litigated.** The first build put three prompts on screen at once and made the player pick. It failed twice over: mechanically the first keystroke was spent *choosing* a word rather than counting toward it, so a player had to type the same letter twice; strategically the choice was not real, because the tiers were rolled by the game, which makes it a menu rather than a decision. Ruan asked for one word and the game was better for it. Ruan then asked for a sentence, and that is better again, because a sentence is a *sequence* of moves the player can see coming: the kick is three words away, the guard is the next small word. Timing rather than volume.

**Difficulty is exposed as WPM, not easy/normal/hard**, because typing skill is uncorrelated with gaming skill. The bot's WPM is chosen from an explicit ladder: 20, 30, 40, 50, 60, 70, 85, 100, 120.

## 7. The defensive verb

**Telegraph.** When a fighter commits to the first 2 characters of a **kick**, the opponent's HUD shows `KICK INCOMING`. The defender can see the whole opposition sentence at all times, so this is information they could already act on. The telegraph only makes the timing legible.

**Block.** Completing a block word (1-3 characters) raises a guard for `BLOCK_HOLD` = 1.15s. A guard is not an attack and never damages. While it is up:

| Incoming move | Effect |
|---|---|
| Punch | Knockback × `BLOCK_KB_MULTIPLIER` (0.45) and damage × `BLOCK_DAMAGE_MULTIPLIER` (0.6) |
| Kick | **Parry.** Knockback × `PARRY_MULTIPLIER` (0.3), chip damage, and a **counter window** (2.5s) in which the defender's next landed hit deals `r = 2.0` |

The guard does not stack: a second block inside the window refreshes the timer rather than adding to it.

Blocked knockback and chip damage compound, because knockback is itself a function of damage dealt. A guarded punch lands at roughly 0.35× an unguarded one rather than the flat 0.45×, and the test suite asserts the compounded figure exactly rather than the constant.

**Why the guard is short.** A long one would mean the fighter who happens to be mid-sentence on a small word is permanently protected and knockback stops mattering. 1.15s is about one word's worth of typing, so blocking is something a player aims rather than something they sit in.

**Cost of blocking.** The block word deals no damage and takes time to type, so a block that was not needed is a lost exchange. Because small words sit at fixed points in the sentence, the read is "will my block be up when their kick lands?", which is a genuine prediction about timing. Sirlin's target is 3 nested layers; this structure supports exactly that count: block the kick (1), punish the frequent blocker with punch volume instead (2), block only when the kick is real (3).

**Lame-duck bound.** If a fighter's position is within one light hit of the blast line, the match enters **FINISH** state: the kill spark shows, one slow-motion Finish Zoom plays, and a hard 6-second limit applies to the exchange. A decided match may not run long.

**Recovery.** A fighter pushed past the blast line is not instantly dead. They get one recovery prompt (a 5-character word, oversize and centred, replacing their sentence). Completing it restores them to the platform edge with 0.6s of invulnerability and hands them a fresh sentence. Failing ends the round. This is the genre's core tension, made typing-native.

**The save window is measured in CHARACTERS, not seconds** (changed 2026-10-05). The window answers one question: *can this fighter type N characters' worth in the time it takes them to type N characters?* N starts at `RECOVERY_SLACK_CHARS` (8) and drops by `RECOVERY_STEP_CHARS` (1.25) for every save already made this round, so the save budget runs out after three saves and the fourth ring-out in a round kills. The budget is converted to seconds using the difficulty RUNG's WPM (`secondsPerChar`), never the fighter's own — which is what makes the mechanic a question about a player's margin over the rung rather than about their absolute speed.

It used to be a flat seconds figure: 1.8s, minus 0.25s per prior save, flooring at 0.8s. Both sides of `5 / (wpm/12) <= 1.8 - 0.25n` are linear in different units, so it collapses to a single threshold, and it measured as a step:

| Rung | Old behaviour |
|---|---|
| 20 / 30 WPM | **never saved at all** — a 5-char word takes 2.0s+ against a 1.8s window |
| 40 WPM | saved twice |
| 70 WPM | saved four times out of five — Ruan's report |
| 85 / 100 / 120 WPM | **effectively never failed** — 0.71s needed against a 0.8s floor. Measured, 6 matches per cell: at 85 WPM it still made 89% of saves from the eighth attempt on; the bot's rate was 143/143 at 120v120, 154/155 at 100v100, 207/209 at 120v100 |

Two consequences, both fatal and both measured. First, the top of the ladder could not be KO'd, so rounds there ended on the clock — the exact failure the escalating window was introduced to prevent. Second, and worse, it double-dipped on the game's single axis: WPM decided both who LANDS hits and who SURVIVES them, so there was nothing else to be good at. A player at exactly the bot's WPM won 100% against the 70 bot and 0% against the 120 bot — the same relative skill, opposite outcomes, and nothing on screen to explain it.

The escalating-window idea (added 2026-09-28) is kept, and it is now legible: 8 → 6.75 → 5.5 → out. It was always the right idea — without it a bot that types well saves every time — it was just denominated in the wrong unit. The platform-fighter convention stands: recovering gets harder the more you have already been hit.

**Why the life count is the number to watch, not the difficulty.** A higher budget does not make the game harder; it makes the opponent *save more often before it finally dies*, which is precisely what reads as unbeatable. Measured at 70v70, 8 matches per cell: slack 8 → 3 lives and a 74% save rate; slack 9 → 4 lives and 81%; slack 12 → 6 lives and 86%; slack 16 → 9 lives and 93%. The length response is also far flatter than intuition suggests — four extra lives buy 4 seconds — because lives do not buy match length at all: a ring-out costs only ~7s of clean hitting, so a 3-4 minute match is a damage-ramp question, not a recovery one (§13.5).

## 8. Juice

Essential list, all procedural (no image or audio assets, so the build stays far under the 20MB budget).

| # | Element | Spec |
|---|---|---|
| 1 | **Key audio** | WebAudio oscillators. Distinct samples for correct char, wrong char, block, punch, kick, hit, parry, KO. Correct/wrong must be both audible **and** visible: the sentence renders large with per-character highlighting, because typists are looking at the keyboard. A guarded hit plays the block thud *as well as* the hit, because "it landed" and "it was smothered" are different information. **A decided match gets its own flourish** — a rising C-E-G-C arpeggio for a win with the last note doubled into a chord, a falling three-note figure for a loss — because ending a win and a loss on the same neutral KO thud is the flattest possible reading of the game's biggest moment. |
| 2 | **Hitstop** | 2-6 frames on commit, scaled by damage, hard-capped at 6. Both fighters freeze for the identical duration. Hurtboxes stay **static** while the sprite vibrates, or attacks that should connect start missing. |
| 3 | **Screenshake** | Decaying. Small on light hits, large on KO, minimal on a block. |
| 4 | **Damage gradient** | Section 4 table. |
| 5 | **Kill spark + Finish Zoom** | Distance to blast line, not move power. One slow-motion zoom per match. |
| 6 | **Particles** | One impact puff per hit, a guard burst on a block, a trail behind a launched fighter, confetti on match win. Hand-rolled, capped pool. No particle engine. Confetti is its own case: a curtain of ~100 mixed-size pieces in the winner's skin trim plus gold, spawned up to 140px above the stage so it falls INTO view. It is held at full size with a floor on its opacity and given a **dark rim per piece**, because a light piece on a pale arena is invisible — gold on the Training Ground measured 1.02:1. Impact and trail sparks keep their decay; there the fade *is* the effect. |
| 7 | **Squash** | Pushed fighter tweens scale and rotation, recovering over ~0.18s. |
| 8 | **Guard frame** | A raised block draws a filled teal slab with a bright lip that fades as the guard runs out, deliberately not the parry's corner brackets, so "I am blocking" and "I have a read" cannot be confused. |
| 9 | **Result banner** | The outcome must be the loudest thing on screen. A fixed dark plate (NOT a themed surface, so it reads identically after a cosmetic purchase) carrying a pixel-font VICTORY/DEFEAT, the round score, and up to four **achievement flares** naming what was actually notable: clean sweep, flawless, on fire, boss down, first win today, N in a row, new top speed. Thresholds live in `game/flares.ts` so they are testable and cannot drift. The flare logic is deliberately available on a loss for the top-speed case only — "you lost and you have never typed faster" is the true and useful sentence. The coin payout counts up rather than appearing, with the authoritative figure in `data-coins` so no probe or leaderboard ever reads an animation frame. |

**Over-juice guard.** Hitstop is capped, shake is capped, and particles use a fixed-size pool. Abundant feedback past the point the player notices it becomes noise.

## 9. Bot

Parameterised, single-axis ramp.

| Parameter | Meaning |
|---|---|
| `targetWpm` | The bot's steady-state speed |
| `accuracy` | Probability of a clean character |
| `decisionDelay` | Median ms before the bot commits to a sentence, paid **once per sentence**, not once per word |
| `parrySkill` | Probability it reacts to a telegraphed kick by snapping off the block word it is already on |
| `adaptBias` | Small, smoothed correction toward keeping the match close |

The bot types sentences through the same `TypingRun` as the player, and its commits go through the same `Match.commitMove` door, so there is no separate attack path. Paying the decision delay per word made a 40 WPM bot effectively much slower than 40 WPM; a sentence keeps its prompt id from its first word to its last, so the delay is paid once and the words inside flow at the chosen speed.

The reflex is where parry skill lives now: the bot cannot skip words in its sentence, so what `parrySkill` buys is hurrying the block word it is already typing. A bot that fails the roll keeps typing at its own pace and eats the kick it saw coming, which is what a missed read should look like.

The bot is deliberately **not** hidden about its difficulty. The player picks the WPM. Adaptive correction never moves the effective WPM by more than 12% and never inside a round, so it cannot be felt as cheating.

**Known asymmetry — FIXED 2026-10-05.** A hit landing mid-word no longer drops the human's keystrokes; they are held (up to `INPUT_BUFFER_MAX`) and delivered when the stun ends, which is deliberate and is what stops the typing flow breaking. The bot used to have no equivalent: `BotController.update` returned early on hitstun, so the stun paused its clock outright, and being hit cost the bot its whole stun while costing the player nothing *net*. That measured at roughly **one rung of edge** on the diagonal, so Ruan called it: bank it. `bankWhileStunned()` accrues the bot's progress through a stun under the **same `INPUT_BUFFER_MAX` cap** — the same rule on both sides of the arena, which is what makes a ladder WPM mean the same thing for both fighters. The cap is the anti-exploit half and is asserted directly in the test suite: a larger cap would let a 120 WPM bot (10 chars/s) store a whole word behind one 0.75s stun. A stun still costs the bot time — it just no longer costs it progress.

**The ladder's measured shape is in §13.5.** Every rung is now KO-able and the win rate ramps smoothly with the rung instead of flipping between 100% and 0%, which is what makes the picker usable by a slow and a fast typist alike.

## 10. Cosmetics and shop

Skins are **data**, not assets. A skin is a palette plus silhouette parameters plus a trail style. The renderer draws fighters procedurally from that definition, so:

- the build carries no sprite sheets
- a skin costs a few hundred bytes
- adding a skin is adding one object to a list

Shop surfaces:

| Surface | Content |
|---|---|
| Fighters | Full character skins, recolour and silhouette variants |
| Themes | A full repaint of the fight (see below) |

### Themes

A theme repaints the **whole site**, not one panel and not one page. It is applied to `<html>` by `components/ThemeProvider.tsx`, so an equipped theme recolours the marketing pages, the leaderboard, the shop, the profile and the fight screen inside all of them.

**A theme is no longer the arena.** The design originally had a `Theme` carry both the website chrome and the arena palette (sky, hills, ground, blast line). That conflated two ideas and made the shop effectively sell arenas: every boss fought in the same recoloured field, and "buying a theme" bought a different-looking field rather than a different-looking site. The arena is now `game/maps.ts`, owned by the boss — each boss fights in its own place, free play uses the Training Ground, and nothing about it is unlockable. Six themes ship: Paper (free), Midnight, Sunset, Frost, Neon Grid, Volcano.

**Theming is CSS variables, not a prop drill.** Tailwind v4 emits each colour token as a real custom property, so redefining `--color-page`, `--color-ink`, `--color-brand` and friends on `<html>` restyles everything inside with **zero** class-name changes. This requires `@theme` and NOT `@theme inline` in `globals.css`: the inline form bakes each value into the generated utility and makes a scoped override impossible.

**Signals are not themed.** The damage ramp, the red lethal telegraph, the teal block and parry states, and the per-word move underlines keep their colours in every theme. They tell the player what is happening, and relearning them because the arena changed colour would be a defect. The move chips are drawn as filled blocks with their own background for exactly this reason, so a fixed colour stays readable on a dark theme as well as a light one.

**Nothing drawn on the ARENA may use a theme token.** This is the rule that was broken, and it cost the round countdown its legibility in **31 of the 60 theme × arena pairs** — 29 of them at roughly 1.1:1, i.e. not low contrast but invisible. Free play's own Training Ground hid it on four of the six themes. The same blind spot had the FINISH flag at 2.49:1, the save prompt at 4.09:1, the fullscreen round timer at 4.498:1, and — worst of all — made a win's confetti **1.02:1 on the default arena**, so the only celebration a win had was drawn in the colour the floor already was.

The cause was structural, not careless: the theme suite compares theme tokens against OTHER theme tokens, and all of those pairs passed while the screen was unreadable. So `game/hud.ts` now holds a fixed palette for anything whose backdrop the theme does not decide, and two techniques cover the whole class:

  * **An opaque plate** for anything small — the FINISH flag, the save prompt, the result banner, the achievement flares. Contrast becomes a constant (white on `#0b0b12` is 19.6:1) whatever is behind it.
  * **A light fill over a dark ring** for text too large to sit on a plate (the 60px countdown) and for every confetti piece. The readable contrast is `max(fill, ring)` rather than the fill's own ratio, which is **never below 4.44:1 on any background**, and 3.58:1 for the gold confetti. Because contrast depends only on relative luminance, a sweep of greys proves it for every possible colour, not just the ten arenas shipped.

Signals keep their hue families on the arena — red still means a heavy hit is coming, gold still means it is worth something — but they take the DARK palette's values against their own dark chip, because the arena is not the page. The light-page values score 2.4:1 and 2.2:1 there, so hue alone was never going to be enough: this is arithmetic, not taste.

**Every theme is contrast-checked, including against the arena.** The test suite asserts WCAG AA (4.5:1) for text on surface, muted text on both surface and prompt background, accent on prompt background, and onAccent on accent — and separately asserts that each arena overlay clears AA against its own plate, that the outlined text and the rimmed confetti clear their bars on EVERY possible background, and that the fullscreen panels clear AA when composited over every arena at the shipped alpha. Each of those carries a **negative control** asserting the old value fails, so the check cannot quietly go hollow. A theme that looks good and cannot be read is a broken product.

**Currency.** Coins, earned only. Payout per match = base by rounds won + WPM bonus + accuracy bonus + streak bonus, **scaled by the opponent's difficulty on a win**. Quests (§15) are a second, small earning stream, bounded by construction and retunable without touching any of this.

**Difficulty rewards (added 2026-10-06, migration `0008`).** The payout used to ignore the opponent entirely, so beating the 20 WPM warm-up paid exactly what beating the 120 WPM final boss paid. A win is now multiplied by `DIFFICULTY_PCT`, indexed by the rung of `BOT_WPM_LADDER`:

| Rung (WPM) | 20 | 30 | **40** | 50 | 60 | 70 | 85 | 100 | 120 |
|---|---|---|---|---|---|---|---|---|---|
| Win pays | 75% | 88% | **100%** | 125% | 155% | 190% | 230% | 275% | 325% |

- The **40 WPM rung is the 100% anchor**, because break-even sits at 0.75-0.95x the player's own speed and the general adult average is 40-52 WPM, so the median player settles on rung 30-40. Their pace is therefore unchanged and every rung above is earned. Measured with one profile (a 2-0 win, 45 WPM, 95% accuracy, streak 3): 105 coins at rung 20, 140 at rung 40, 455 at rung 120.
- **Losses are NOT scaled.** A loss pays exactly what it always paid, which is the anti-farm rule: if a loss scaled too, "select the hardest bot and throw matches" would out-earn playing at your own level. A win beats a loss at every rung, 1.5x at the bottom rising to 6.7x at the top.
- **The boss terms are NOT scaled.** A first-clear bounty is already priced per boss in `kinetype.boss_rewards` (25 coins for Tick to 400 for Oblivion) and the flat +60 boss win bonus is a mode marker. Scaling either would charge the same difficulty twice.
- **Scaling is integer-exact:** `(base * pct + 50) / 100` with integer division in SQL, `Math.floor` on the same arithmetic in `game/progression.ts`. A `round(base * pct / 100.0)` drifts a coin or two between the two languages, and `scripts/verify-rewards.ts` compares them for exact equality.
- An **off-ladder opponent snaps down** to the nearest real rung, and ties resolve downward, so an ambiguous or hostile `bot_wpm` can only ever pay the lower figure. `submit_match()` now stores the snapped rung rather than the raw client value.
- If the catalogue pace needs retuning, move this anchor or the price tiers, **not both at once**.

**Payment boundary.** `game/commerce.ts` exposes `PURCHASE_PROVIDER`. It is `"earned"` in MVP. The shop renders real prices and a real purchase flow that expects a provider; with `"earned"` the flow takes the earned-currency path. Switching to a real provider is a single module swap. **No payment integration ships until multiplayer exists**, because cosmetics require an audience to be worth buying and the evidence says the ad-removal subscription is the correct first revenue line, not skins.

## 11. Technical budget

Hard constraints, from CrazyGames' published launch metrics.

| Constraint | Target | Why |
|---|---|---|
| Build size | **< 20 MB** | Platform requirement. Procedural art makes this trivially true. |
| Load to playable | **< 10 s** | Platform requirement. No assets to download, so the cost is only JS parse. |
| Frame budget | 60 fps on a mid laptop | Fixed timestep 1/60 with accumulator; render interpolation between steps. |
| Start conversion | 80%+ reach 60s of play | The game must be playable without reading anything. |
| Session target | 10+ min average | Several best-of-three matches (a match measures ~60-105s, §13.5), plus a visible personal best and streak. |
| Mobile | Playable, touch keyboard prompts | Desktop is the real target; mobile must not be broken. |

## 11.5 Palette

Every colour is a token in `app/globals.css`, and components reference tokens (`bg-brand`, `text-muted`, `border-edge`) rather than raw Tailwind colours, so a full reskin is that one file. The engine's own colours (stage, blast lines, platform edges) live in `game/render.ts`, and the default HUD theme lives in `game/skins.ts`.

| Token | Value | Used for |
|---|---|---|
| `ink` | `#07070e` | page background |
| `panel` | `#101021` | cards, prompt panels |
| `edge` | `#23233c` | borders |
| `strong` / `body` / `muted` | `#f1f1fa` / `#c9c9e0` / `#8f8fb0` | text, descending emphasis |
| `brand` / `brand-bright` | `#8b5cf6` / `#a78bfa` | primary actions, player accent |
| `aqua` | `#22d3ee` | block and parry states |
| `flag` | `#fbbf24` | coins, save prompts |
| `heat` | `#fb7185` | heavy hits, blast lines, losses |

The move colours are a separate, fixed set carried by `components/game/PromptCard.tsx` and mirrored by the arena teaser: teal `#0e7490` for a block, purple `#7c3aed` for a punch, red `#be123c` for a kick. Like the damage gradient in `game/knockback.ts`, they are deliberately independent of the theme: they say what a word does, and the one thing a player must never have to relearn is what a word does.

## 11.5 Site structure

The game is NOT the homepage. The fighting box has its own page so the arena can be the point of the page instead of a widget on a marketing page.

| Route | Job | Primary keyword intent |
|---|---|---|
| `/` | Sell it. Hero, a static arena frame, the three things that decide an exchange, the roster, FAQ. **Never boots the engine.** | "typing fighting game" (informational) |
| `/play` | Play it. One line of orientation, then the arena. Below the arena: today's quests (§15). | "play typing fighting game online" (transactional) |
| `/how-to-play` | Teach the mechanics | "how to play typing fighting game" |
| `/shop` | Skins and themes | "typing game skins" |
| `/typing-games-unblocked` | The school audience | "typing games unblocked" |
| `/typing-speed-test` | Plain test, funnels into the game | "typing speed test" |

Two rules hold this together:

1. **The landing page must not boot the engine.** It renders `ArenaTeaser`, a single SVG built from the same pixel data as the canvas, carrying a static sentence with each word underlined in its move colour. A visitor who never presses Play pays nothing for a physics loop, an audio context or a requestAnimationFrame. `scripts/verify-browser.mjs` asserts there is no `canvas` element on `/`, so this cannot regress quietly.
2. **`/play` gets more room.** `FightClient` takes a `wide` prop that raises the arena cap from 58vh to 66vh (76vh in fullscreen), because on that page the arena is the whole point. The prompt card carries its move legend in its own header rather than on a separate row, so a long sentence wrapped over two lines still leaves the arena, the bot panel and the prompts inside one screenful; `scripts/probe-layout.mjs` measures that block at a 900px, 1000px and 1080px viewport.

Structured data is split so the two pages do not compete: `/` carries `WebSite` + `FAQPage`, `/play` carries `VideoGame` + `WebApplication` + `BreadcrumbList` + its own play-specific `FAQPage`. The fullscreen control wraps the entire fight section, panels included, because a fullscreen arena with the player's prompts outside it would be unplayable.

**The front door teaches too** (added 2026-10-07). A first-time visitor gets a nine-step tour that
starts on `/`, points at the header, the coin balance, the Play button and the arena frame, walks
them into `/play`, explains the fight controls, the arena and the quest board, and gets out of the
way. It is the only onboarding in the product and it is specified in §16 — including why it opens on
`/` alone and why its seen flag lives outside the save wallet.

## 12. Out of scope for MVP

Explicitly not built, and not to be smuggled in:

- Real-time multiplayer and netcode
- Real payment processing
- Music (ranked last on cost-effectiveness, and it costs load budget)
- A particle engine (documented programmer trap)

**Promoted OUT of this list (2026-10-04): accounts, cloud saves and leaderboards are
now IN.** They were deferred for the MVP and are specified in §14. Free play still
works fully signed out, so the "no account needed to play" promise on the marketing
pages stays true — an account unlocks the boss campaign, cloud progress and the
leaderboard, and nothing else.

## 13. Acceptance criteria

The MVP is done when all of these are true.

1. A match against a bot runs end to end: rounds, KO, best-of-3, result screen.
2. One sentence is live per fighter at all times and the next one arrives with no gap; every word in it carries a move, and every sentence can both block and punch.
3. A move only fires on the final correct character of its word, and the separator between two words is a required keypress.
4. Mistyping clears that word's bonus and applies no stun in default mode, while the rest of the sentence keeps its own bonus.
5. A chain of flawlessly typed words raises a damage multiplier that escalates the screen shake, hitstop and particle count, is broken by any mistake including a missed separator, and resets each round.
6. A kick pushes materially harder than a punch at equal damage.
7. Damage percent visibly drives an escalating knockback curve.
8. A completed block word raises a guard, a punch into it is smothered, and a kick into it is parried for a counter window.
9. A fighter pushed past the blast line gets a recovery prompt with a working success and failure path.
10. The kill spark and Finish Zoom fire from distance to the blast line.
11. Coins are awarded, persisted, and spendable in the shop.
12. Owned skins can be equipped and visibly change the fighter.
13. WPM and accuracy are live and correct, and survive a refresh as a personal best.
14. A hit cannot land inside the hit cooldown, and the cooldown always exceeds max hitstun.
15. Repeated saves in one round grant progressively tighter windows.
16. Both fighters spawn in the middle of the stage, apart, and symmetric about their own blast lines.
17. A keystroke the player presses while they cannot act is held and delivered — hitstun and strict-mode stagger only — and the HUD reports the real count while it waits. Everywhere else it is the opposite: while the opponent is off the stage, after the round is decided, and during the next countdown, input is DROPPED, never banked and never shown as queued, so the HUD cannot advertise keys waiting for a sentence they will not reach.
18. `npm run build`, `npm run lint` and `tsc --noEmit` all pass clean.
19. The engine's pure logic has unit tests that pass under plain Node.
20. `node scripts/verify-browser.mjs` plays a real match in Chromium, confirms damage lands both ways, and confirms a typed block word raises a visible guard.
21. Keyboard input reaches the game when it is embedded, and a player who cannot type is told to click the arena instead of assuming the game is broken.
22. A guest can play free play with no account; the boss campaign and the leaderboard ask them to sign in rather than failing silently.
23. A signed-in player's finished match is banked server-side, and its XP appears on the leaderboard in the correct window (today / this week / all time).
24. Each boss is gated behind BOTH a player level and the previous boss, and a first clear pays its coin bounty exactly once — a repeat clear does not.
25. `npm run test` covers the progression curve and the boss campaign as well as the engine.

**Added for quests (2026-10-07, §15).**

26. `/play` shows three daily quests (one easy, one medium, one hard) and two weekly quests, and the daily three are **different tomorrow** — never the same quest twice running.
27. The rotation is a pure function of the UTC date and is computed identically on both sides: the client renders it from `game/quests.ts`, the server pays from `kinetype.quest_ids_for()`, and `npx tsx scripts/verify-quests.ts` fails if they disagree on any of 400 consecutive days or 120 weeks.
28. Quest progress is DERIVED from `kinetype.matches` and is never sent by a client; a quest pays **once** per period, and a second `quest_award()` call pays zero.
29. A **flagged** match advances no quest and pays no quest reward, and neither does a match on a day that has already burned the daily XP ceiling.
30. The account's XP and coins equal exactly (match XP) + (quest awards) + (the first-win bonus) — `npx tsx scripts/probe-quests.ts` proves it against the live project and then deletes its fixture.
31. `node scripts/probe-quests-ui.mjs` plays a real signed-in player's board in Chromium and confirms the cards, the grading, the claimed badges and the progress numbers all come from the server's own figures.

**Added for the first-visit tour (2026-10-07, §16).**

32. A visitor who has never seen it gets a nine-step tour that opens itself on `/`, points at the header, the coin balance, the Play button and the arena frame, walks them into `/play`, explains the fight controls, the arena and the quest board, and closes on a centred outro. A visitor who HAS seen it is not shown it again, and a visitor who lands straight on `/play` is not interrupted at all.
33. Every callout is fully on screen at 1280x900 and at 390x844, sits off its target wherever there is room for it to, and its arrow points at the **visible** part of the target — never at a centre point that a tall block has pushed below the fold. `node scripts/probe-tour.mjs` asserts all of that against the real DOM, on both viewports, on every step.
34. The tour owns the keyboard and the pointer while it is open: Escape and Skip close it, arrows page it, Tab stays inside the callout, and a stray keystroke cannot reach the fight underneath — which it otherwise would, because `FightClient` listens on `window` and reads Escape as "quit the match".
35. It can be brought back deliberately, by `?tour=1` or by "Replay the walkthrough" on `Your account`, and neither is a dead end: the replay navigates to whatever page the first step lives on.
36. Opening the tour never changes the first paint: the seen flag is read on the client, the server snapshot is "seen", and `node scripts/probe-tour.mjs` fails on a hydration warning on every page it visits.

**Added for the locked boss gate (2026-10-08, §17).**

37. A boss a signed-in account has not unlocked does not get an arena. `/play?boss=<id>` for a locked boss renders a gate that says WHICH condition is unmet — the level it needs, or the boss ahead of it by name — links to the campaign and offers free play, and `[data-testid="fight-section"]` is never mounted. A guest still gets the sign-in wall, and free play is unchanged.
38. The server refuses a boss match for a boss the account has not unlocked, and a refusal pays NOTHING: `npx tsx scripts/probe-boss-gate.ts` submits the exact payload a pasted `/play?boss=oblivion` produces on a level-1 account, confirms the refusal, and asserts the profile's XP, coins, match count, clears and flag count are **byte-identical** afterwards. It then proves each condition in isolation — the level alone opens nothing, a level far past every gate skips nothing, and the rung whose ONE prerequisite is beaten does open.
39. The gate is stated twice and pinned: `kinetype.boss_defs` + `kinetype.boss_unlocked()` mirror `BOSSES` + `bossUnlocked()`, and `npx tsx scripts/verify-bosses.ts` fails on one unit of drift — the roster field by field, then 702 combinations of boss, level and cleared set. It also reads the live `submit_match()` body and fails if the refusal block is gone, because the helper being right proves nothing about the payout path calling it.
40. `node scripts/probe-boss-gate-ui.mjs` opens the locked route in a real browser, signed out and signed in, and confirms the level reason, the sequence reason, the earned fight opening, the untouched free-play arena and the campaign page's agreement — on localhost AND production, failing on a hydration warning.

## 13.5 The measured ladder (added 2026-10-05)

`scripts/probe-balance.ts` drives the framework-free core with no browser: a scripted human (its own WPM, accuracy, per-sentence read delay and parry roll, typing through the real `Match.type()` input path) against each bot rung, 8 matches per cell. Raw matrices live in the balance note.

**Saves, per rung, after the 1.2 change** — the point of the change is that this is now flat:

| Rung | save #1 | save #2 | save #3 | save #4+ | lives |
|---|---|---|---|---|---|
| 20 WPM | 99% | 87% | 55% | 0% | 2 (its 0.90 accuracy costs it the third) |
| 40 WPM | 100% | 96% | 76% | 0% | 3 |
| 70 WPM | 100% | 99% | 87% | 0% | 3 |
| 120 WPM | 100% | 100% | 95% | 0% | 3 |

**Rounds now end in KOs.** KO/timeout across the whole ladder, 8 matches per cell: 16-22 KOs and 0-1 timeouts. Before the change the top of the ladder read **1 KO / 13 timeouts** and **0 KO / 12 timeouts** — a KO was arithmetically impossible there.

**The win rate ramps instead of flipping.** Representative columns, player WPM down the side and bot rung across. (Measured with the stun-parity fix in, §9.)

| Player | 20 | 30 | 40 | 50 | 60 | 70 | 85 | 100 | 120 |
|---|---|---|---|---|---|---|---|---|---|
| 20 | 88% | 25% | 0% | 0% | 0% | 0% | 0% | 0% | 0% |
| 40 | 100% | 100% | 63% | 13% | 0% | 0% | 0% | 0% | 0% |
| 60 | 100% | 100% | 100% | 100% | 50% | 25% | 0% | 13% | 0% |
| 70 | 100% | 100% | 100% | 88% | 75% | 38% | 25% | 13% | 0% |
| 85 | 100% | 100% | 100% | 88% | 63% | 38% | 0% | 0% | 13% |
| 100 | 100% | 100% | 100% | 88% | 88% | 100% | 13% | 0% | 25% |
| 120 | 100% | 100% | 100% | 100% | 100% | 75% | 63% | — | — |

**The diagonal**, both fighters at the same WPM — which is what "the rung label means what it says" would demand — now reads 88% / 88% / 63% / 50% / 50% / 38% / 0% / 0% / 0% from 20 up to 120, with **zero timeouts at every one of those cells**.

Read off three things:

1. **A break-even rung exists at every player speed**, so sliding the picker genuinely finds your level instead of flipping between a walkover and a wall. Break-even sits at roughly **0.75-0.95x the player's own WPM**.
2. **The ladder is not pure speed, and the slope is visible.** The bot's accuracy climbs 0.90 → 0.99 and its parry skill 0.05 → 0.90 as the rung rises, while a human's do not, so a high rung is relatively harder than its number suggests: at 40 WPM parity is a 63% win, at 120 WPM parity is 0%. "80 WPM" means *difficulty 80*, not *a bot that types 80 WPM* — which is the stated design position (§6), but it does mean the top rungs are worth ~one notch more than they read. Shifting the ladder's labels, or flattening the accuracy/parry curve so the rung is closer to a pure speed axis, is an open call for the designer; nothing is broken either way.
3. **Timeouts are gone across the board** — 16-23 KOs against 0-1 timeouts per cell, over the entire ladder. The old top of the ladder was 1 KO / 13 and 0 KO / 12.

**Match length is a damage-ramp problem, not a recovery one.** A ring-out costs about **7 seconds of clean hitting** (7 landed hits at `HIT_COOLDOWN`), so a round is roughly `(lives + 1) x 7s` plus the opening. At the shipped 3 lives that is a ~28s round and a ~63s best-of-three. Raising lives is the wrong lever, and measured it is a weak one: slack 9 (4 lives) buys 4 seconds; slack 12 (6 lives) reaches 107s; slack 16 (9 lives) reaches 145s — a ~56s round — but by then the opponent saves 93% of everything and the slow rungs are timing out (9-10 timeouts per 8 matches). That is length bought by re-creating the original complaint. **A 3-4 minute match is not reachable from this constant.** Reaching it means slowing the damage ramp (`HIT_COOLDOWN`, per-move damage, or the blast-line distance) — a separate, larger change to the moment-to-moment feel.

**DECIDED (Ruan, 2026-10-05): accept the short round.** Rounds run ~28-40s and a match ~60-105s. The shape is arcade — several matches inside the 10-minute session target — and the 3-4 minute figure in earlier versions of §3/§11 was written before anyone had measured that a KO needs only ~7s of clean hitting, so it described a match nobody had played. Do NOT "fix" match length by inflating `RECOVERY_SLACK_CHARS`; that trades the KO back for the clock. If a longer match is ever wanted, slow the damage ramp deliberately and re-run the probe.

**Consequence for the round timer.** At 3 lives the 90s timer never binds — 0-1 timeouts per cell across the whole ladder — so the "on timeout the lower-damage fighter wins" rule is now close to dead code. It stays as a safety net (a stuck match must still resolve), but it is no longer doing balance work and should not be relied on as a round-length governor.

## 14. Accounts, progression and leaderboards (added 2026-10-04)

The feature Ruan asked for: accounts, level up, unlock harder bosses, and daily /
weekly / overall leaderboards.

**Where the data lives.** Kinetype does not own a Supabase project — the free plan
caps an account at two active projects and both are used. The backend is therefore a
dedicated `kinetype` SCHEMA inside an existing project, isolated from that project's
own `public` tables. Migration: `db/migrations/0001_kinetype_accounts.sql`; it is
idempotent and additive. Moving to a dedicated project later is an env-var change
plus dropping the `db.schema` pin in `lib/supabase.ts`.

**Accounts are optional.** Free play, coins and cosmetics stay in localStorage and
work signed out — the marketing promise ("no account needed to play") is intact. An
account adds exactly three things: cloud progress, the boss campaign and the
leaderboard.

**Two ways in: Google, or an email and a password** (added 2026-10-06). Email
accounts are made at `/signin`, and every gate in the app now links THERE instead of
firing Google on the spot — the header, the campaign gate, the boss gate and the
leaderboard each pass `?next=`, so the player lands back where they were. Google stays
one click on that page rather than being removed.

Sign-up is INSTANT: the project runs with Supabase's `mailer_autoconfirm` ON, so no
confirmation email is sent and the account is usable the moment the form is submitted.
That is a deliberate trade. The project is on the free plan, using Supabase's built-in
mailer, which caps auth email at TWO PER HOUR project-wide — so a confirmation-based
signup would fail for the third new player in any hour, which is worse than an
unverified address. The two consequences are worth stating plainly: nothing verifies
that an address is real, and password-RESET email is capped by that same limit. That is
why `/settings` can set a password while signed in — that path needs no email at all
and is the recovery route that always works. Custom SMTP (Resend's free tier covers
3,000 emails a month) removes the cap; the code already handles a confirmation-based
flow if `mailer_autoconfirm` is ever turned back on (`signUpWithEmail` returns
`"confirm-email"` and the form shows a "check your inbox" panel instead of signing in).

Verified by `scripts/probe-email-auth.mjs`: it creates an account through the real
form, checks the profile the email path produced, changes the password while signed
in, signs out, signs back in with the NEW password, asserts a wrong password is
refused, checks the campaign gate routes to the form carrying `?next=`, and deletes
its own fixture afterwards.

**Considered and DEFERRED (2026-10-06): username-first sign-in.** Ruan asked whether sign-in
could be a username with the email optional, linked later in settings. It is feasible — every
claim below was verified against this project with throwaway accounts, all deleted — and the
findings live here so nobody re-runs the investigation:

- **Sign-up and sign-in with a username-shaped address work.** A synthetic
  `<handle>@users.kinetype.app` email plus a password returns a session immediately (confirmation
  is off), and `signInWithPassword` accepts the same address. The unique `@` would therefore be
  free: Supabase's own email uniqueness enforces it, with no lookup RPC and no way to enumerate
  other players' addresses.
- **Linking a REAL email to such an account FAILS on the ordinary path.** `PUT /user { email }`
  answers `400 "Email address "<synthetic>" is invalid"`, because the change flow wants to email
  the CURRENT address to approve it, and that address is not deliverable. A real email can never
  become a Supabase identity on a username account.
- **Two escape routes DO work** (both verified): the admin API can migrate an existing account
  onto a synthetic email, and `admin/generate_link { type: "recovery" }` mints a reset link for a
  synthetic account WITHOUT sending mail — so recovery would be OURS to deliver (Resend), and the
  built-in mailer's two-emails-per-hour cap would stop mattering for signup entirely.
- **What the unique `@` still needs** before it can serve as a login key: a case-insensitive
  unique index (`Ruan` and `ruan` are two separate accounts today), a claim-not-suffix RPC
  (`assign_handle()` silently answers `ruan-2` on a collision — fine for a generated display
  handle, wrong for a login, where the player must be TOLD a name is taken), a reserved-name list
  and a profanity filter for a school-facing site.

**Why deferred:** the recovery cliff is the real cost. An account with no linked email could never
be recovered, so "optional email" becomes a permanent nag, and genuine recovery needs custom SMTP
(Resend) plus a recovery route of our own. There is no evidence yet that the email field costs
signups, and the identity benefit is already mostly present — every profile has a unique public
handle today. **REVISIT when either (a) signup attempts show a drop-off at the email field, or
(b) the account count passes ~50** — the migration cost verified above grows with every account
created, so this gets more expensive the longer it waits. Not a revenue task either way.

**XP is server-authoritative.** `kinetype.submit_match()` recomputes XP from clamped
inputs; the client never sends a score, only the raw match facts. The formula is
mirrored in `game/progression.ts` (`xpForMatch`) and the two are pinned together by
`game/tests/progression.test.ts`, which asserts the exact XP the live SQL returned
during verification, and by `scripts/verify-rewards.ts`, which compares both sides over
a matrix of rungs, outcomes and hostile input and fails on a single coin of drift.
**Both XP and coins scale with the opponent's difficulty on a win** — the coin table in
§10 is the XP table, applied to the same performance terms, so one table serves both and
the two currencies move together. That means XP does inflate at the top of the ladder,
and the campaign is gated by the boss SEQUENCE rather than by the level curve: the level
gate delays the ladder, it cannot skip it. Level is a GENERATED column:
`floor(sqrt(xp/100)) + 1` — the same curve the earlier typing site used. It is derived,
so the HUD and the leaderboard can never disagree about someone's level.

**The boss campaign** is nine fights on the game's existing nine-rung bot ladder
(20..120 WPM). A boss is a NAMED rung, not a new difficulty system: `game/progression.ts`
holds the roster. Each fight needs BOTH the player's level to clear `unlockLevel` AND
the previous boss to be beaten, and the final boss is best-of-five. The free WPM
picker in /play is untouched — the campaign is additive. **That gate is enforced on both
sides of the wire and a URL cannot skip it — see §17 (added 2026-10-08).**

**Leaderboards** rank by XP earned in a window (today from 00:00 UTC, this ISO week
from Monday, or all time), via the `kinetype.leaderboard()` RPC, which is SECURITY
DEFINER so it reads signed-out too.

---

## 15. Quests (added 2026-10-07)

**The feature.** Three daily quests — one **easy**, one **medium**, one **hard** — and two **weekly**
quests, each paying bonus XP and coins, and **the daily set changes every day**.

Migration `0009_quests.sql`. Rotation and reward table in `game/quests.ts`. Board in
`components/game/QuestBoard.tsx`, mounted on `/play` below the arena.

### 15.1 What it is for

0007 gave the day a hook — a first-win bonus and a consecutive-day streak — but the hook is the
**same** every day and pays a flat 100. There is no answer to "what should I do *today*". A quest is
that answer, and grading it means there is always one worth doing and one worth reaching for.

The second half matters as much as the first: a fixed checklist is not a game, it is homework you
learn once. So the set rotates.

### 15.2 The rotation is a pure function of the DATE

Not of the player, and not of a roll. Same day, same quests, for everybody, on every device, with
**no assignment state stored anywhere** — no row saying who was given what.

```
epoch_day(d)  = days since 1970-01-01                      // the daily clock
epoch_week(d) = floor((epoch_day(d) + 3) / 7)              // Monday-aligned weeks
```

The `+3` is the alignment and it is not arbitrary: 1970-01-01 was a **Thursday**, so day 0 sits
three days into its Monday week, and the first Monday (day 4) has to open week *1* rather than week
0. Sunday therefore belongs to the week that started six days earlier — asserted in the test suite on
real dates, because a week boundary that is off by a day is the kind of bug that only shows up on a
Sunday.

Each tier is an ordered pool walked with a **stride of one**, with its own starting offset so the
tiers do not march in lockstep:

| Tier | Pool | Offset |
|---|---|---|
| easy | 6 | `+0` |
| medium | 7 | `+2` |
| hard | 5 | `+4` |

A stride of one is what guarantees the property the whole feature is about: **tomorrow's easy quest
is never today's easy quest.** The unequal pool sizes are doing real work too. `6 × 5 = 30` means
easy and hard only re-pair every 30 days, and `lcm(6, 7, 5) = 210` means the daily **set** does not
repeat for 210 days — so the rotation cannot be learned by heart inside a month, which is exactly
what a fixed rotation would collapse into.

The weekly pair is a **curated** list of all fifteen pairs of the six weekly quests, walked one pair
per week — a 15-week cycle. Written out rather than generated: a generated pair can be "win five in
a row" next to "beat three 85 WPM opponents", which is legal and miserable. Every weekly quest
appears in exactly five pairs, so the cycle is fair.

### 15.3 Progress is DERIVED, never sent

Every metric is a count over rows the server **already holds** in `kinetype.matches`:

| Metric | Counts | Uses `threshold` |
|---|---|---|
| `matches` | matches played | — |
| `wins` | matches won | — |
| `rounds_won` | rounds won, summed | — |
| `clean_wins` | wins with no round dropped | — |
| `boss_wins` | boss fights won | — |
| `win_streak` | **longest run** of consecutive wins | — |
| `fast_matches` | matches at ≥ N WPM | WPM |
| `sharp_wins` | wins at ≥ N% accuracy | accuracy |
| `combo_matches` | matches reaching a chain of ≥ N | chain length |
| `big_scalps` | wins against an opponent at ≥ N WPM | WPM |

There is **no parameter to send progress in**. A client cannot claim 3/3 because there is nowhere to
put the claim. `win_streak` is the odd one out — it is a MAX, not a count, so it is recomputed fresh
from the window on every call with the standard gaps-and-islands trick rather than accumulated in a
column. That is deliberate: a loss after two wins means the run is over, and a stored counter could
not express that.

### 15.4 Payment, and the anti-farm rules

**Once per quest per period, forever**, enforced by the primary key on
`kinetype.quest_awards (user_id, quest_id, period_key)` and an `on conflict do nothing` insert. A
quest that has paid is paid; a replayed or concurrent submission finds the row and pays nothing.

The periods are `d:2026-10-07` and `w:2026-10-05` — the week is named by its **Monday**, not an ISO
week number, so it is unambiguous without a calendar lookup.

Three rules bound it, all consistent with 0006:

- **A flagged match does nothing.** It does not advance a quest and cannot complete one. A flagged
  submission is not a match the game believes.
- **A capped day does nothing.** If the day has already burned the 25 000 XP ceiling, quests are not
  scored either — a farm must not advance the board.
- **The ceiling now covers quest XP too.** `quest_award()` reads match XP *plus* quest XP already
  paid today, so "no account mints more than 25 000 XP in a UTC day" stays literally true instead of
  becoming "25 000 from matches plus whatever quests happen to pay". The guard can only ever reduce a
  payout.

The board's progress number is the **raw** metric and may overshoot its target — five clean wins
against a target of one is five. The bar and the displayed count clamp to the target, because "5/1"
beside a full bar reads as a bug; the raw figure stays on `data-progress` so a probe can still see it.

### 15.5 Quests pay XP, and that is a knowing departure from 0007

0007 says daily bonuses pay **coins only**, never XP, because "XP drives the level curve and unlocks
the boss ladder, and it is pinned by a test that mirrors `xp_for_match`". Quests break that rule at
the designer's instruction.

The consequences are real, and both are acceptable **because they are bounded**:

1. **Quest XP is small next to match XP.** A *perfect* day is 340 XP; a single 2-0 win at the 40 WPM
   anchor pays 140. All three dailies together are worth about two and a half matches, for
   considerably more than two and a half matches of work.
2. **It accelerates the boss ladder slightly.** Level is derived from XP, so quest XP does open
   levels sooner. That is inherent in "quests give XP" and was chosen knowingly. The campaign is
   still gated by the boss SEQUENCE, so a level bought with quest XP cannot skip a fight — it only
   gets you to the gate sooner.

### 15.6 The pacing figure, and where to turn the dial

Measured against 0007's own numbers: the catalogue costs 52 500 coins and the measured base earning
rate is ~1 900 coins a day, which 0007 sized at about 28 days to own everything.

| | XP | coins |
|---|---|---|
| best possible daily trio | 340 | 480 |
| best possible weekly pair | 820 | 1 130 |
| **a PERFECT week** (all three dailies every day, both weeklies) | **3 200** | **4 490** |

That is **+34% at PERFECTION** against a base of ~13 300 coins a week — and perfection is not
realistic, because "win a match at 100% accuracy" and "win three in a row" rarely land on the same
evening. The effect in practice is closer to +15-20%, which pulls the catalogue in to roughly 21-24
days for an engaged player and leaves the casual pace where 0007 put it.

**The dials are the reward columns in `kinetype.quest_defs` and nothing else.** No other code reads
them. The reward ceilings are asserted by `game/tests/quests.test.ts` and re-checked against the
database by `scripts/verify-quests.ts`, so a cap cannot drift upward by accident. If the pace needs
retuning, move these numbers — or 0007's price tiers — and not both at once.

### 15.7 Two copies of one table, on purpose

The board renders the rotation from `game/quests.ts`; the server pays from
`kinetype.quest_ids_for()`. Two implementations of one rule is normally a defect, and here it is a
deliberate trade with a guard on it:

- the client needs the quests **instantly and signed out** — the rotation is pure, so asking the
  server for it would be a round trip to compute a constant;
- the server must **own payment**, so it cannot be handed the answer.

The guard is that drift is a failing test rather than a surprise. `scripts/verify-quests.ts` checks
every field of every quest against the database, then walks **400 consecutive days and 120 weeks**
comparing both rotations quest by quest, and fails on a single one. If the board ever promised a
quest the server would not score, that is a quest nobody could ever complete.

### 15.8 Verified, not argued

| What | Where |
|---|---|
| The rotation, the period maths, the weekly pairs, the reward ceilings | `game/tests/quests.test.ts` (35 cases) |
| TypeScript vs live Postgres, 400 days + 120 weeks + every field | `npx tsx scripts/verify-quests.ts` (65 checks) |
| Quests pay, pay once, and only for honest matches — against the live project | `npx tsx scripts/probe-quests.ts` (39 checks) |
| The board draws, graded, signed in and out, with the server's own numbers | `node scripts/probe-quests-ui.mjs` (21 checks) |

`scripts/probe-quests.ts` is the one that matters most and it is a **conservation** check: it makes a
throwaway account play a scripted run of five wins, then asserts the profile's XP and coins equal
*exactly* (match XP) + (quest awards) + (the first-win bonus). Not "close to". A quest paying twice,
paying the wrong amount, or paying for a quest that was never completed all break that equation. It
then submits a match inside the server's 5-second gap to confirm a flagged submission pays nothing
and moves no quest, calls `quest_award()` again to confirm it pays zero, and deletes its own fixture
in a `finally` block.

The UI probe signs in through the **real form** with an account that has **real matches** behind it,
so the progress bars are showing numbers the server actually derived. It also fails on a hydration
warning, which is a live risk here: the rotation is derived from the date, and the date is the one
value the server and the browser can disagree about. `QuestBoard` reads it in an **effect**, never
during render, and renders one frame of skeleton instead — the same discipline `game/store.ts`
documents for the save.

## 16. The first-visit tour (added 2026-10-07)

### 16.1 The problem it solves

Kinetype explains itself well and still loses people at the front door. `/` carries six nav
destinations, a coin balance, a boss campaign, a shop, and a fight with its own vocabulary — chain,
parry, blast line, SAVE word. All of it is written down, and all of it is written down in
paragraphs. A visitor who does not read paragraphs has no idea what to click first, and the
cheapest fix for that is not more copy: it is pointing at the thing while saying one sentence
about it.

So: a nine-step tour, once per browser. It is the only onboarding in the product.

### 16.2 What it does

Nine steps, in this order, and the order is the argument — it follows a visitor from "what is this"
to "I am in the arena":

| # | Where | Points at | Says |
|---|---|---|---|
| 1 | `/` | nothing (centred) | what the tour is, and how to leave it |
| 2 | `/` | the header | every destination in the product, and which two need an account |
| 3 | `/` | the coin balance | that coins are earned and cannot be bought |
| 4 | `/` | the Play button | one click, no download, no account |
| 5 | `/` | the arena frame | the whole game in one sentence: small words block, ordinary punch, long kick |
| 6 | `/play` | the fight controls | bot speed, strict mode, then Fight |
| 7 | `/play` | the arena | where the sentence appears, that the space is a real key, what a parry is |
| 8 | `/play` | the quest board | three dailies and two weeklies, rotating daily, account required |
| 9 | `/play` | nothing (centred) | where the strategy lives, and how to get the tour back |

**It navigates, once.** Step 6's route is `/play`, so advancing from step 5 pushes the router and
the tour carries on over the arena. It is one navigation in one direction; Back walks it in
reverse. A first-visit tour that outlives a minute gets skipped rather than read, which is why the
Campaign, Leaderboard and shop are NAMED in step 2 and not visited — three more page loads is three
more steps, and a step list that long is a step list nobody finishes. Extending it is one entry in
`TOUR_STEPS`; the engine already handles a route change.

**What it draws.** A dim over the viewport with a hole cut over the target (`box-shadow: 0 0 0
9999px`, one element, no seams), a bordered callout beside it, and a square arrow on the callout
edge facing the target. There is no image asset and no tour library: `placeCallout` in
`game/tour.ts` is pure, unit-tested arithmetic, and the overlay measures and renders. The points
where this gets subtle are all in that function:

- The preferred side is tried, then the opposite side, then the two perpendicular sides, then it is
  clamped — so a callout is never off-screen, ever.
- The arrow aims at the middle of the target's **visible span**, not its geometric centre. A block
  taller than the viewport, which the quest board and the arena both are on a phone, has its centre
  below the fold; an arrow pointing there points at nothing the visitor can see. This was a real
  defect, caught by the phone probe rather than by eye, and it is now pinned by two unit cases.
- A target with no room around it — again the quest board on a phone — gets a callout pinned to a
  viewport edge, over the block. That is the intended degradation: the alternative is nowhere to
  put it.

### 16.3 Where the state lives, and where it must not

The seen flag is `localStorage["kinetype:tour"]`, holding `{version, at}`.

**Not in the save wallet**, and that is a deliberate decision rather than tidiness. `SaveData` is
parked in `kinetype:save:guest` while an account is signed in and restored on sign-out (§14), so a
tour flag living in there would be rolled back by the act of signing out: a player would be shown
the first-visit tour again for having the nerve to have an account. It is a UI preference about one
browser and it gets its own key.

**Versioned, not a boolean.** `hasSeenTour` compares the stored version against `TOUR_VERSION`, so
shipping a materially different tour sets `TOUR_VERSION = 2` and returning visitors see the new one
without ever being shown the old one again.

**Read on the client, never during render.** `game/tour-store.ts` follows `game/store.ts` exactly:
a cached `getSnapshot`, a server snapshot that means "seen", and `useSyncExternalStore`. The server
and the first client paint both render closed, and the tour opens on the render after hydration.
Reading localStorage during render would be a hydration mismatch, and every probe in this repo
fails on one.

**`started` is load-bearing.** Openness is derived from three terms: a replay request, a tour that
has already begun, and a visitor who has not seen it arriving at `/`. The first version derived it
from two, and the tour closed itself the moment it walked the visitor to `/play` — because `/` was
no longer the current route. The probe caught it as a missing overlay after the navigation. It is
the kind of bug that a screenshot of step 1 would never show.

### 16.4 Why the front door only

`TOUR_AUTO_OPEN_ROUTES` is `["/"]`. Auto-opening on `/play` would drop a modal over an arena the
visitor is already using, and auto-opening on the SEO landing pages (`/typing-games-unblocked` and
friends) would cover the copy those pages exist to deliver. A visitor who lands deep and later
clicks through to the front door gets the tour then, which is the right moment anyway.

It can still be asked for from anywhere: `?tour=1` forces it, and "Replay the walkthrough" on
`Your account` sets an in-memory replay that takes the visitor to step 1's page. The replay is
in-memory rather than a link to `/?tour=1` so it does not throw away the page they were on.

### 16.5 The keyboard is the hard part

`FightClient` listens on **`window`** for keydown, reads Escape as "quit the match", and swallows
Tab and every arrow. A tour listening on the bubble phase would therefore quit the fight the
visitor was reading about, the first time they pressed Escape. So the overlay registers in the
**capture** phase, before the game's listener can see anything, and swallows every key while it is
open. Tab is trapped inside the callout, the pointer is swallowed by a full-viewport catcher (the
highlighted element is deliberately NOT clickable — the tour does its own navigation), and body
scroll is locked with `overflow: hidden` rather than a `position: fixed` hack, because the tour
still has to be able to scroll its own target into view.

Focus is moved to the callout on every step and returned to whatever had it when the tour closes.

### 16.6 Where it lives

| Piece | Path |
|---|---|
| The steps, the copy, the seen flag, the callout arithmetic (pure) | `game/tour.ts` |
| The external store: seen, replay, started, index | `game/tour-store.ts` |
| The overlay | `components/tour/TourOverlay.tsx` |
| The "show me that again" button | `components/tour/TourReplayButton.tsx` |
| Targets | a `data-tour="<id>"` attribute on the element itself |
| Unit cases | `game/tests/tour.test.ts` (wired into `npm test`) |
| The browser probe | `scripts/probe-tour.mjs` |

A step's target is an attribute, not a selector, so a step names an element the way the rest of the
codebase names one and a refactor that moves the element only has to carry the attribute. Every
target is an element that exists **before a match starts** — the bot panel, the prompt card and the
player panel only mount while `stage === "fighting"`, so a step pointing at one of them would have
to start a fight the visitor did not ask for or silently degrade. The in-fight UI is therefore
described in step 7's copy while the arrow points at the arena that will hold it. A target that
never appears at all degrades to a centred callout with the same copy: the explanation is the
payload and the arrow is the polish, and a tour that silently skips a step teaches nothing.

Not instrumented: no PostHog event is fired for the tour, so there is no funnel data on it yet. If
that changes, `tourStore` is the one place to emit from.

### 16.7 Verified, not argued

| What | Where |
|---|---|
| The step list's shape, the seen flag, the index maths, and the placement arithmetic over a grid of targets and viewports | `game/tests/tour.test.ts` (30 cases) |
| The tour opening, walking, navigating, closing, remembering, replaying, on desktop and on a phone | `node scripts/probe-tour.mjs` (173 checks) |

The unit sweep is the part worth stealing: it runs **every** combination of five viewports, targets
from 200px off-screen on each side up to 1.4 viewports wide and a full viewport tall, and all four
preferred sides — and asserts the callout always lands inside the viewport and the arrow always
lands inside the callout. A callout 40px below the fold looks like a design decision, so it is
cheaper to make it a failing test than to notice it in a screenshot.

The browser probe is the one that found the two defects this feature actually had: the tour closing
itself on the navigation to `/play`, and the arrow aiming below the fold at the quest board. It runs
with a **fresh context** every time, so "first visit" means what it says, on `reducedMotion:
"reduce"` so the scroll settles deterministically, and it fails on a hydration warning on every
page it touches. It reports a 4xx/5xx from our own server with the URL, and ignores the local
PostHog proxy (`/ph`), which fails on this box because the rewrite resolves PostHog to IPv6 and the
connect is refused — noise about the dev machine, not about the change.

**It is run against localhost AND production, and that is not ceremony.** The production pass (173
checks against `www.kinetype.app`, after the 2026-10-07 deploy) found two timing assumptions that
localhost hides because localhost is too fast to expose them: the probe was measuring a step as soon
as its attribute flipped, before the router had landed and mounted the callout, and it was clicking
the replay button inside the hydration window, where a click is dispatched to markup with no handler
attached yet. Both are probe defects rather than product defects — but only one of them was visible
from the dev box, which is exactly why the production run exists.

## 17. A locked boss is not enterable, on either side of the wire (added 2026-10-08)

### 17.1 The hole

`/play?boss=<id>` turns the arena into a campaign fight. `bossById()` resolves the id and
`FightClient` renders that boss — and until this change it rendered **any** id in the roster,
whatever the account had earned. The campaign page at `/bosses` gated its **buttons**; it never
gated the **route**. So a level-1 account could paste `/play?boss=oblivion` and start the final
fight, and the ladder — the entire progression the campaign exists to sell — was a text box.

The UI hole was only half of it, and the quieter half was worse. `submit_match()` paid every boss
payload it was handed: the flat +60 boss term, the level-scaled win, the one-time coin bounty out of
`boss_rewards`, and the **clear** it registered in `boss_clears`. So the paste did not merely let a
player *preview* the final boss — it **skipped the ladder outright**, with the same authority the
server uses for an honest match. A gate the client enforces and the server does not is decoration.

### 17.2 The rule, and why it lives in two places

The rule already existed, in full, in `game/progression.ts` as `bossUnlocked()`: the player's level
must clear the boss's `unlockLevel`, **and** the previous boss must already be beaten. Two conditions,
both required. What was missing was a server that could derive it.

So the rule moved to SQL as a mirror, exactly like the reward tables (§14) and the quest rotation
(§15.7) before it:

| Fact the rule reads | TypeScript | SQL |
|---|---|---|
| The ladder's order and each level gate | `BOSSES` order, `BOSSES[].unlockLevel` | `kinetype.boss_defs` (`ord`, `unlock_level`) |
| Which bosses are beaten | the `cleared` set passed in | `kinetype.boss_clears` |
| The rule itself | `bossUnlocked(boss, level, cleared)` | `kinetype.boss_unlocked(level, boss_id, cleared[])` |

The coin bounty already lived in `boss_rewards` (§14), so with `boss_defs` the roster is now fully
described in data rather than compiled into the payout function. Two copies of one rule is normally a
defect; here the client must answer **instantly and without a round trip** (a lock state is a render,
not a request) while the server must **own the refusal** and cannot be handed the answer. The guard
is the same one §15.7 uses: drift is a failing test, `scripts/verify-bosses.ts`, which compares the
roster field by field and then walks both functions against each other over **every boss × every
level 1..13 × six cleared sets — 702 combinations.**

### 17.3 The client half: a URL is not an unlock

`FightClient` now resolves one of four states before it draws anything a player can type into:

- **guest** — the existing sign-in wall. Boss mode needs an account, because a lock state that
  evaporates on refresh is not a campaign.
- **deciding** — `Checking your campaign…`. The gate needs two server facts (the level, and the
  cleared set) and it must WAIT for both.
- **locked** — a gate that names the unmet condition (the level it needs, or the boss ahead of it)
  and links to the campaign. The arena is not mounted.
- **open** — the fight.

**The `deciding` state is the part worth keeping.** Guessing "locked" while the profile is in flight
would throw a false wall at a player who has earned the fight; guessing "open" would mount an arena
the server then refuses. Both are worse than a one-round-trip message, so the gate reports that it
does not know yet. The failure mode is bounded: if the profile read fails outright, the level falls
back to 1, which is the conservative direction — it can under-promise, never over-promise — and the
server is the authority regardless.

Two reasons are named, not one, because they are different problems for the player: *you are not this
level yet* is answered by playing more, *the boss ahead of you is unbeaten* is answered by beating
that boss by name. `data-reason` carries which one the probe reads.

### 17.4 The server half: the refusal is the load-bearing one

`submit_match()` now refuses, alongside the round-count and WPM impossibilities it already checks:

- boss mode with no boss id → refused;
- a boss id not in `boss_defs` → refused (a rule that guessed about a name it had never heard of
  would be the wrong default);
- a boss the player has not unlocked → refused, with the rule re-derived from `profiles.level` and
  their own `boss_clears`.

**A refusal must pay nothing, and the refusal is placed before every write** — so the transaction
rolls back and the account is left byte-identical. That is what `scripts/probe-boss-gate.ts` asserts,
rather than merely that an error came back: the profile's XP, coins, match count, clears and flag
count are compared before and after, and the match table is asserted empty. Paying a partial bounty
for a refused fight, or registering the clear anyway, would be the exploit surviving the fix.

It is also the reason the migration landed before the deploy: for the window between them, the server
refuses a fight the old client would still offer — which is the safe direction to be inconsistent in.

### 17.5 What the probe found that was worth writing down

The campaign's own economy makes the **sequence** the load-bearing condition, not the level. Beating
boss 1 at level 1 pays 302 XP against a level-2 threshold of 100, so the first clear levels the player
past the next gate in the same breath — the probe's first draft asserted "boss 2 is still locked after
boss 1" and was simply wrong about the game. §14 already said the level gate "delays the ladder, it
cannot skip it"; the measured version is sharper — at the bottom of the ladder the delay is zero and
the sequence does all the work; at the top (level 8, 10, 12 gates against 12 100 XP) the gate is the
real wait. Neither condition is redundant, which is why both are still enforced and both are tested
in isolation.

### 17.6 Verified, not argued

| What | Where |
|---|---|
| The rule's shape, the roster's order and level gates, and the gate's monotonicity | `game/tests/progression.test.ts` |
| TypeScript vs live Postgres: the roster field by field, then 702 combinations of boss, level and cleared set; plus the live `submit_match()` body still calling the rule | `npx tsx scripts/verify-bosses.ts` (16 checks) |
| The refusal, and that a refusal pays NOTHING — byte-identical profile, no match row, no clear | `npx tsx scripts/probe-boss-gate.ts` (30 checks) |
| The browser never offers an unearned arena, and names the reason | `node scripts/probe-boss-gate-ui.mjs` (21 checks) |

`scripts/verify-bosses.ts` deliberately checks the live **body of `submit_match()`** as well as the
helper: a verifier that proves `boss_unlocked()` is correct while the payout path has stopped calling
it would be a green light on a broken gate. The same instinct as the probe's byte-identical check —
test the thing that pays, not the thing that explains.
