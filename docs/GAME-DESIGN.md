# Kinetype — Game Design Spec

**Version** 1.2 · **Date** 2026-10-05 · **Status** MVP implementation
**Companion research** vault `Kinetype/Research/2026-09-28-design-evidence-knockback-and-typing.md`
**Companion balance note** vault `Kinetype/Research/2026-10-05-balance-recovery-ladder-and-match-length.md`

This document is the build contract. Every number here is either sourced from the design research or an explicit tuning constant that lives in `game/constants.ts`. If the code and this document disagree, the code is wrong.

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

## 6. Typing

| Element | Decision |
|---|---|
| Unit of input | **One sentence.** Every word inside it is a move, fired when that word is completed. |
| Commit point | **The whole word.** A move fires on the last correct character of its word only. No sub-word timing window exists, so the documented "hold the last letter for the right moment" exploit has nothing to exploit. |
| Spaces | **A real key, and required.** The space between two words is the next required keypress, and nothing advances until it lands. Not optional: if the last letter also moved the cursor, pressing space would be a strictly worse choice than typing straight through and the key would be decoration. It cannot be ignored when wrong either — a stray space mid-word is a mistake like any other. There is no trailing separator, because the space lives BESIDE the words: the last word ends the sentence on its own final letter. |
| Prompts on screen | **1 per fighter, always.** The next sentence arrives the instant the current one ends, with no gap and nothing to select. |
| Mistype default | **Bonus lost, not progress lost.** A wrong character clears *that word's* precision bonus. Progress stands and the rest of the sentence still earns its own bonus, so a typo early in a long sentence costs one word's damage rather than the sentence. |
| Strict mode (opt-in) | A player setting. Mistype adds 0.4s of stagger. For players who want the risk dial turned up. |
| Input while the player cannot act | **Held, not dropped.** Up to `INPUT_BUFFER_MAX` (3) keystrokes are queued and delivered in the order they were pressed, on the frame the fighter can act again. Applies to hitstun, strict-mode stagger, the 2.2s countdown and a recovery cut. The HUD shows the count, so a wait is never silent. |
| Combo | **A chain of flawlessly typed words.** Every `COMBO_STEP` (3) clean words in a row adds `COMBO_BONUS_PER_STEP` (15%) to the damage of every move, capped at `COMBO_MAX_STEPS` (4) rungs, so a chain of 12 is worth ×1.60 and no more. ANY mistake breaks it — a wrong letter, a missed separator, a stray space. Stacks on top of the per-word precision bonus. Cleared at the start of each round (a fresh climb) but the match best is kept. |
| Precision bonus | Completing a word with zero errors increases that move's damage by 25% and shows a distinct flash. |
| Accuracy | Tracked per round and per match. Feeds the coin payout. |
| WPM | Live, computed on committed characters over a rolling window of **real time**. The typing clock is advanced by `tick(dt)` and by nothing else. |
| Sentence load | Scales with the chosen bot speed. See below. |

**The sentence pool is hand-written, 305 sentences, and generated into `game/sentences.ts` by `scripts/build-sentences.py`.** Grammar and classroom safety cannot be supplied by a frequency list, so the source lines live in `scripts/sentences.txt` and the build script validates and sorts them. Rules, all asserted both by the script and by `game/tests/engine.test.ts`:

- lowercase a-z and single spaces only; no punctuation, no digits
- 4 to 11 words, 16 to 62 characters
- no word longer than 12 characters
- **every sentence contains at least one block word and at least one punch word.** A sentence that could not defend would be a trap; one that could not attack would be a wasted exchange.
- no profanity, brands, web noise, abbreviations or lowercased proper nouns. This game targets the school market, so the bar is "a teacher would be fine with it".

Kicks are optional per sentence, and 48% of the pool has one. The long band is 89% kicks; the short band is 32%, because a 25-character sentence only fits an eight-letter word if the word is chosen for it. Short and medium sentences that carry a kick were authored deliberately: without them, a player on a slow bot speed never throws a kick and can never land the knockout the game is built around.

**Sentence load follows the difficulty.** Bands are by total character count, because that is what the player types: short (≤28), medium (29-44), long (45+). `bandsForTier()` maps the bot ladder to bands: tiers 0-2 (20/30/40 WPM) draw short sentences only, tiers 3-5 draw short and medium, tiers 6-8 draw medium and long. A 20 WPM player handed a 55-character sentence spends half a minute on it and learns nothing.

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

**Currency.** Coins, earned only. Payout per match = base by rounds won + WPM bonus + accuracy bonus + streak bonus, **scaled by the opponent's difficulty on a win**.

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
| `/play` | Play it. One line of orientation, then the arena. | "play typing fighting game online" (transactional) |
| `/how-to-play` | Teach the mechanics | "how to play typing fighting game" |
| `/shop` | Skins and themes | "typing game skins" |
| `/typing-games-unblocked` | The school audience | "typing games unblocked" |
| `/typing-speed-test` | Plain test, funnels into the game | "typing speed test" |

Two rules hold this together:

1. **The landing page must not boot the engine.** It renders `ArenaTeaser`, a single SVG built from the same pixel data as the canvas, carrying a static sentence with each word underlined in its move colour. A visitor who never presses Play pays nothing for a physics loop, an audio context or a requestAnimationFrame. `scripts/verify-browser.mjs` asserts there is no `canvas` element on `/`, so this cannot regress quietly.
2. **`/play` gets more room.** `FightClient` takes a `wide` prop that raises the arena cap from 58vh to 66vh (76vh in fullscreen), because on that page the arena is the whole point. The prompt card carries its move legend in its own header rather than on a separate row, so a long sentence wrapped over two lines still leaves the arena, the bot panel and the prompts inside one screenful; `scripts/probe-layout.mjs` measures that block at a 900px, 1000px and 1080px viewport.

Structured data is split so the two pages do not compete: `/` carries `WebSite` + `FAQPage`, `/play` carries `VideoGame` + `WebApplication` + `BreadcrumbList` + its own play-specific `FAQPage`. The fullscreen control wraps the entire fight section, panels included, because a fullscreen arena with the player's prompts outside it would be unplayable.

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
17. A keystroke the player presses while they cannot act is held and delivered, never dropped, and the HUD says so.
18. `npm run build`, `npm run lint` and `tsc --noEmit` all pass clean.
19. The engine's pure logic has unit tests that pass under plain Node.
20. `node scripts/verify-browser.mjs` plays a real match in Chromium, confirms damage lands both ways, and confirms a typed block word raises a visible guard.
21. Keyboard input reaches the game when it is embedded, and a player who cannot type is told to click the arena instead of assuming the game is broken.
22. A guest can play free play with no account; the boss campaign and the leaderboard ask them to sign in rather than failing silently.
23. A signed-in player's finished match is banked server-side, and its XP appears on the leaderboard in the correct window (today / this week / all time).
24. Each boss is gated behind BOTH a player level and the previous boss, and a first clear pays its coin bounty exactly once — a repeat clear does not.
25. `npm run test` covers the progression curve and the boss campaign as well as the engine.

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
leaderboard. Sign-in is Google only.

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
picker in /play is untouched — the campaign is additive.

**Leaderboards** rank by XP earned in a window (today from 00:00 UTC, this ISO week
from Monday, or all time), via the `kinetype.leaderboard()` RPC, which is SECURITY
DEFINER so it reads signed-out too.
