# Kinetype — Game Design Spec

**Version** 1.1 · **Date** 2026-09-29 · **Status** MVP implementation
**Companion research** vault `Kinetype/Research/2026-09-28-design-evidence-knockback-and-typing.md`

This document is the build contract. Every number here is either sourced from the design research or an explicit tuning constant that lives in `game/constants.ts`. If the code and this document disagree, the code is wrong.

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
| Rounds | Best of 3. Session shape is bounded against typing fatigue at 3-4 minutes. |
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

## 6. Typing

| Element | Decision |
|---|---|
| Unit of input | **One sentence.** Every word inside it is a move, fired when that word is completed. |
| Commit point | **The whole word.** A move fires on the last correct character of its word only. No sub-word timing window exists, so the documented "hold the last letter for the right moment" exploit has nothing to exploit. |
| Spaces | **Never typed.** The cursor jumps from the last letter of a word to the first letter of the next, so every keystroke counts and a stray space cannot register as an error or scroll the page. |
| Prompts on screen | **1 per fighter, always.** The next sentence arrives the instant the current one ends, with no gap and nothing to select. |
| Mistype default | **Bonus lost, not progress lost.** A wrong character clears *that word's* precision bonus. Progress stands and the rest of the sentence still earns its own bonus, so a typo early in a long sentence costs one word's damage rather than the sentence. |
| Strict mode (opt-in) | A player setting. Mistype adds 0.4s of stagger. For players who want the risk dial turned up. |
| Precision bonus | Completing a word with zero errors increases that move's damage by 25% and shows a distinct flash. |
| Accuracy | Tracked per round and per match. Feeds the coin payout. |
| WPM | Live, computed on committed characters over a rolling window. |
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

**Escalating recovery** (added 2026-09-28). The window starts at 1.8s and loses 0.25s for every save already made in that round, flooring at 0.8s. Without this, a bot that types well saved itself every single time and a round could only ever end on the clock, so a KO never actually landed. It is also the platform-fighter convention: recovering gets harder the more you have already been hit.

## 8. Juice

Essential list, all procedural (no image or audio assets, so the build stays far under the 20MB budget).

| # | Element | Spec |
|---|---|---|
| 1 | **Key audio** | WebAudio oscillators. Distinct samples for correct char, wrong char, block, punch, kick, hit, parry, KO. Correct/wrong must be both audible **and** visible: the sentence renders large with per-character highlighting, because typists are looking at the keyboard. A guarded hit plays the block thud *as well as* the hit, because "it landed" and "it was smothered" are different information. |
| 2 | **Hitstop** | 2-6 frames on commit, scaled by damage, hard-capped at 6. Both fighters freeze for the identical duration. Hurtboxes stay **static** while the sprite vibrates, or attacks that should connect start missing. |
| 3 | **Screenshake** | Decaying. Small on light hits, large on KO, minimal on a block. |
| 4 | **Damage gradient** | Section 4 table. |
| 5 | **Kill spark + Finish Zoom** | Distance to blast line, not move power. One slow-motion zoom per match. |
| 6 | **Particles** | One impact puff per hit, a guard burst on a block, a trail behind a launched fighter, confetti on match win. Hand-rolled, capped pool. No particle engine. |
| 7 | **Squash** | Pushed fighter tweens scale and rotation, recovering over ~0.18s. |
| 8 | **Guard frame** | A raised block draws a filled teal slab with a bright lip that fades as the guard runs out, deliberately not the parry's corner brackets, so "I am blocking" and "I have a read" cannot be confused. |

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

A theme repaints the **whole fight**, not one panel. The earlier design shipped "HUD overlays" that recoloured only the prompt card, which is not a theme and was replaced at Ruan's request.

A theme carries the arena sky bands, the hills, the grass and dirt of the stage, the blast-line colour, the prompt card, the panels and everything the fight sits on. Six ship: Paper (free), Midnight, Sunset, Frost, Neon Grid, Volcano.

Two implementation notes matter more than the list:

**Theming is CSS variables, not a prop drill.** Tailwind v4 emits each colour token as a real custom property, so `FightClient` redefines `--color-page`, `--color-ink`, `--color-brand` and friends on the fight `<section>`. Every `bg-page`, `text-ink` and `border-line` inside follows automatically, and a new theme adds no class names. This requires `@theme` and NOT `@theme inline` in `globals.css`: the inline form bakes each value into the generated utility and makes a scoped override impossible.

**Signals are not themed.** The damage ramp, the red lethal telegraph, the teal block and parry states, and the per-word move underlines keep their colours in every theme. They tell the player what is happening, and relearning them because the arena changed colour would be a defect. The move chips are drawn as filled blocks with their own background for exactly this reason, so a fixed colour stays readable on a dark theme as well as a light one.

**Every theme is contrast-checked.** The test suite asserts WCAG AA (4.5:1) for text on surface, muted text on both surface and prompt background, accent on prompt background, and onAccent on accent. A theme that looks good and cannot be read is a broken product, so this is arithmetic in `game/themes.ts` rather than an eyeball judgement.

**Currency.** Coins, earned only. Payout per match = base by rounds won + WPM bonus + accuracy bonus + streak bonus.

**Payment boundary.** `game/commerce.ts` exposes `PURCHASE_PROVIDER`. It is `"earned"` in MVP. The shop renders real prices and a real purchase flow that expects a provider; with `"earned"` the flow takes the earned-currency path. Switching to a real provider is a single module swap. **No payment integration ships until multiplayer exists**, because cosmetics require an audience to be worth buying and the evidence says the ad-removal subscription is the correct first revenue line, not skins.

## 11. Technical budget

Hard constraints, from CrazyGames' published launch metrics.

| Constraint | Target | Why |
|---|---|---|
| Build size | **< 20 MB** | Platform requirement. Procedural art makes this trivially true. |
| Load to playable | **< 10 s** | Platform requirement. No assets to download, so the cost is only JS parse. |
| Frame budget | 60 fps on a mid laptop | Fixed timestep 1/60 with accumulator; render interpolation between steps. |
| Start conversion | 80%+ reach 60s of play | The game must be playable without reading anything. |
| Session target | 10+ min average | Best-of-3 plus a visible personal best and streak. |
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
- Accounts, login, cloud saves
- Real payment processing
- Leaderboards (local personal bests only)
- Music (ranked last on cost-effectiveness, and it costs load budget)
- A particle engine (documented programmer trap)

## 13. Acceptance criteria

The MVP is done when all of these are true.

1. A match against a bot runs end to end: rounds, KO, best-of-3, result screen.
2. One sentence is live per fighter at all times and the next one arrives with no gap; every word in it carries a move, and every sentence can both block and punch.
3. A move only fires on the final correct character of its word, and spaces are never typed.
4. Mistyping clears that word's bonus and applies no stun in default mode, while the rest of the sentence keeps its own bonus.
5. A kick pushes materially harder than a punch at equal damage.
6. Damage percent visibly drives an escalating knockback curve.
7. A completed block word raises a guard, a punch into it is smothered, and a kick into it is parried for a counter window.
8. A fighter pushed past the blast line gets a recovery prompt with a working success and failure path.
9. The kill spark and Finish Zoom fire from distance to the blast line.
10. Coins are awarded, persisted, and spendable in the shop.
11. Owned skins can be equipped and visibly change the fighter.
12. WPM and accuracy are live and correct, and survive a refresh as a personal best.
13. A hit cannot land inside the hit cooldown, and the cooldown always exceeds max hitstun.
14. Repeated saves in one round grant progressively tighter windows.
15. Both fighters spawn in the middle of the stage, apart, and symmetric about their own blast lines.
16. `npm run build`, `npm run lint` and `tsc --noEmit` all pass clean.
17. The engine's pure logic has unit tests that pass under plain Node.
18. `node scripts/verify-browser.mjs` plays a real match in Chromium, confirms damage lands both ways, and confirms a typed block word raises a visible guard.
19. Keyboard input reaches the game when it is embedded, and a player who cannot type is told to click the arena instead of assuming the game is broken.
