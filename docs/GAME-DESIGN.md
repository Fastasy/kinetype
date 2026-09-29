# Kinetype — Game Design Spec

**Version** 1.0 · **Date** 2026-09-28 · **Status** MVP implementation
**Companion research** vault `Kinetype/Research/2026-09-28-design-evidence-knockback-and-typing.md`

This document is the build contract. Every number here is either sourced from the design research or an explicit tuning constant that lives in `game/constants.ts`. If the code and this document disagree, the code is wrong.

---

## 1. The one-line pitch

A two-player platform fighter where the only input is typing. Complete a word to land a hit; the hit pushes your opponent toward the edge. Knock them off.

## 2. The problem this design has to solve

Typing speed is a near-linear skill. A pure speed race is tic-tac-toe with a keyboard: knowing what your opponent will do next is worth nothing, because there is no choice to predict. Three structural answers are built in:

1. **Word choice.** Three simultaneous prompts per fighter. Long words push harder and are slower to land. Short words are fast and weak. Choosing *which* word is the risk dial.
2. **The defensive verb.** A telegraph and a parry, so the losing player has a read available that is not "type faster".
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
- `r` = situational multiplier (parry, counter, recovery vulnerability)

Knockback converts to launch velocity the same way Smash does: `velocity = KB × 0.03`, decaying. Knockback units and pixels travelled are deliberately not the same thing, so launches arc and stop instead of teleporting.

**Word tiers drive `d` and `s`:**

| Tier | Length | Damage `d` | Scaling `s` | Base `b` | Commit cost |
|---|---|---|---|---|---|
| Light | 3-4 chars | 4 | 0.90 | 24 | Fast |
| Mid | 5-7 chars | 8 | 1.05 | 20 | Medium |
| Heavy | 8+ chars | 14 | 1.25 | 14 | Slow |

Heavier words have lower base knockback and higher scaling. That gives them positional value early and KO value late, while light words still create space at 0% (base knockback). This is the two-knob structure documented in the research.

**Hitstun** is derived, never an independent timer: `hitstun = KB × 0.25`, clamped between 0.1s and 0.75s.

**The Brawl rule.** The victim may never cancel hitstun on a fixed schedule. Brawl allowed an air dodge at a fixed 13 frames regardless of knockback and true combos collapsed. Hitstun in this game always scales with the knockback actually taken.

**The anti-lockout rule** (added 2026-09-28, from browser testing). At most one hit can land on a fighter every `HIT_COOLDOWN` (1.05s). A word that arrives during that window is spent for nothing.

This was not in the first design and it is not a nicety. A player landing a word roughly every 0.17s against a 0.75s maximum hitstun left the opponent permanently stunned and unable to take a turn at all. That is precisely the degenerate state Sirlin describes: one dominant strategy, no counterplay.

`HIT_COOLDOWN` must always exceed `HITSTUN_MAX`, so the victim is guaranteed `HIT_COOLDOWN - HITSTUN_MAX` seconds of free action after every hit. Currently 0.30s. `game/tests/engine.test.ts` asserts that invariant, so it cannot be tuned away by accident.

It also improves the game on its own terms: hits become scarce, so timing a heavy word matters more than typing volume.

## 6. Typing

| Element | Decision |
|---|---|
| Commit point | **The whole word.** Push fires on the last correct character only. No sub-word timing window exists, so the documented "hold the last letter for the right moment" exploit has nothing to exploit. |
| Prompts on screen | **1 per fighter, always.** The next word arrives the instant the current one commits, with no gap and nothing to select. |
| Mistype default | **Bonus lost, not progress lost.** A wrong character clears the word's precision bonus. Progress stands, so the player presses the correct key and carries on. No stun, no penalty beyond lost time. |
| Strict mode (opt-in) | A player setting. Mistype adds 0.4s of stagger. For players who want the risk dial turned up. |
| Precision bonus | Completing a word with zero errors increases that hit's damage by 25% and shows a distinct flash. |
| Accuracy | Tracked per round and per match. Feeds the coin payout. |
| WPM | Live, computed on committed characters over a rolling window. |

**Why one word and not three.** The first build put three prompts on screen at once and made the player pick. It failed twice over. Mechanically, the first keystroke was spent *choosing* a word rather than counting toward it, so the player had to type the same letter twice, and a letter matching no word's first character registered as an error. Strategically, the choice it created was not a real one: word tiers are rolled by the game, so the "risk dial" was picking whichever of three random words looked best, which is a menu, not a decision. Ruan asked for one word and the game is better for it. Every keystroke counts from the first press.

The cost is that the parry is now a **forced reaction** rather than a choice between blocking and attacking: the telegraph replaces your live word with the guard word. That is the honest trade for a one-word design, and it is what makes a telegraphed heavy hit a genuine reaction test.

Word pools, expanded from ~720 to 2,050 attack words: LIGHT 450 (3-4 chars), MID 800 (5-7), HEAVY 800 (8+), plus 53 guard and 59 recovery words. Drawn from a frequency-ranked English list so prompts are words a player knows and can spell, then filtered for profanity, brand and web noise, abbreviations, and lowercased proper nouns. This game targets the school market, so the bar is "a teacher would be fine with it". Regenerating the pools is a scripted job, not a hand edit.

**Difficulty is exposed as WPM, not easy/normal/hard**, because typing skill is uncorrelated with gaming skill. The bot's WPM is chosen from an explicit ladder: 20, 30, 40, 50, 60, 70, 85, 100, 120.

## 7. The defensive verb

The unsolved question from the research gets this answer:

**Telegraph.** When a fighter commits to the first 2 characters of a **heavy** word, the opponent's HUD shows a telegraph for that word. The defender can see the opposition's prompt tier at all times, so this is information they could already act on. The telegraph only makes the timing legible.

**Parry.** On telegraph, the defender's live word is replaced by a **guard word** (5 characters, visually distinct). Completing it before the attacker's heavy word lands:

- locks incoming knockback to `r = 0.30`
- grants the defender a **counter window**: their next completed word within 2.5s deals `r = 2.0`

**Cost of parrying.** Typing the guard word is time not spent attacking, so a parry that is not needed is a lost exchange. Mistyping the guard word in strict mode applies the full stagger.

**Why this is a read and not a reaction.** The defender can see the attacker's word length before the attacker has typed anything. Choosing to pre-load a parry against an expected heavy attack, versus racing with a light attack, is a prediction about intent. That is yomi layer 1. Layer 2 is the attacker noticing the defender parries often and switching to fast light words to punish the wasted window. Layer 3 is the defender pre-empting that. Sirlin's target is 3 nested layers; this structure supports exactly that count, and no more is needed.

**Lame-duck bound.** If a fighter's position is within one light hit of the blast line, the match enters **FINISH** state: the kill spark shows, one slow-motion Finish Zoom plays, and a hard 6-second limit applies to the exchange. A decided match may not run long.

**Recovery.** A fighter pushed past the blast line is not instantly dead. They get one recovery prompt (a 5-character word, oversize and centred). Completing it restores them to the platform edge with 0.6s of invulnerability. Failing ends the round. This is the genre's core tension, made typing-native.

**Escalating recovery** (added 2026-09-28). The window starts at 1.8s and loses 0.25s for every save already made in that round, flooring at 0.8s. Without this, a bot that types well saved itself every single time and a round could only ever end on the clock, so a KO never actually landed. It is also the platform-fighter convention: recovering gets harder the more you have already been hit.

## 8. Juice

Essential list, all procedural (no image or audio assets, so the build stays far under the 20MB budget).

| # | Element | Spec |
|---|---|---|
| 1 | **Key audio** | WebAudio oscillators. Distinct samples for correct char, wrong char, word commit, hit, parry, KO. Correct/wrong must be both audible **and** visible: the prompt renders large with per-character highlighting, because typists are looking at the keyboard. |
| 2 | **Hitstop** | 2-6 frames on word commit, scaled by damage, hard-capped at 6. Both fighters freeze for the identical duration. Hurtboxes stay **static** while the sprite vibrates, or attacks that should connect start missing. The attacker micro-moves during hitstop. Vibration decays. Grounded fighters vibrate horizontally, airborne vertically. |
| 3 | **Screenshake** | Decaying. Small on light hits, large on KO. |
| 4 | **Damage gradient** | Section 4 table. |
| 5 | **Kill spark + Finish Zoom** | Distance to blast line, not move power. One slow-motion zoom per match. |
| 6 | **Particles** | One impact puff per hit, a trail behind a launched fighter, confetti on match win. Hand-rolled, capped pool. No particle engine. |
| 7 | **Squash** | Pushed fighter tweens scale and rotation, recovering over ~0.18s. |
| 8 | **Anticipation** | One frame of wind-up pose before a push lands. |

**Over-juice guard.** Hitstop is capped, shake is capped, and particles use a fixed-size pool. Abundant feedback past the point the player notices it becomes noise.

## 9. Bot

Parameterised, single-axis ramp.

| Parameter | Meaning |
|---|---|
| `targetWpm` | The bot's steady-state speed |
| `accuracy` | Probability of a clean character |
| `decisionDelay` | Median ms before the bot commits to a chosen prompt |
| `parrySkill` | Probability it identifies and completes a guard word |
| `adaptBias` | Small, smoothed correction toward keeping the match close |

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
| Trails | The launch trail particle style |
| Overlays | HUD theme (prompt panel and damage meter styling) |

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

Every colour is a token in `app/globals.css`, and components reference tokens (`bg-brand`,
`text-muted`, `border-edge`) rather than raw Tailwind colours, so a full reskin is that one file.
The engine's own colours (stage, blast lines, platform edges) live in `game/render.ts`, and the
default HUD theme lives in `game/skins.ts`.

| Token | Value | Used for |
|---|---|---|
| `ink` | `#07070e` | page background |
| `panel` | `#101021` | cards, prompt panels |
| `edge` | `#23233c` | borders |
| `strong` / `body` / `muted` | `#f1f1fa` / `#c9c9e0` / `#8f8fb0` | text, descending emphasis |
| `brand` / `brand-bright` | `#8b5cf6` / `#a78bfa` | primary actions, player accent |
| `aqua` | `#22d3ee` | parry states |
| `flag` | `#fbbf24` | coins, save prompts |
| `heat` | `#fb7185` | heavy hits, blast lines, losses |

The damage gradient in `game/knockback.ts` is deliberately independent of the theme. White through
yellow, orange and red to near-black reads as "how close to death" in any palette, and it is the one
thing a player must never have to relearn.

## 11.5 Site structure

The game is NOT the homepage. The fighting box has its own page so the arena can be the point
of the page instead of a widget on a marketing page.

| Route | Job | Primary keyword intent |
|---|---|---|
| `/` | Sell it. Hero, a static arena frame, the three decisions, the roster, FAQ. **Never boots the engine.** | "typing fighting game" (informational) |
| `/play` | Play it. One line of orientation, then the arena. | "play typing fighting game online" (transactional) |
| `/how-to-play` | Teach the mechanics | "how to play typing fighting game" |
| `/shop` | Skins and overlays | "typing game skins" |
| `/typing-games-unblocked` | The school audience | "typing games unblocked" |
| `/typing-speed-test` | Plain test, funnels into the game | "typing speed test" |

Two rules hold this together:

1. **The landing page must not boot the engine.** It renders `ArenaTeaser`, a single SVG built
   from the same pixel data as the canvas. A visitor who never presses Play pays nothing for a
   physics loop, an audio context or a requestAnimationFrame. `scripts/verify-browser.mjs`
   asserts there is no `canvas` element on `/`, so this cannot regress quietly.
2. **`/play` gets more room.** `FightClient` takes a `wide` prop that raises the arena cap from
   58vh to 66vh (76vh in fullscreen), because on that page the arena is the whole point.

Structured data is split so the two pages do not compete: `/` carries `WebSite` + `FAQPage`,
`/play` carries `VideoGame` + `WebApplication` + `BreadcrumbList` + its own play-specific
`FAQPage`. The fullscreen control wraps the entire fight section, panels included, because a
fullscreen arena with the player's prompts outside it would be unplayable.

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
2. Three prompts are visible per fighter at all times and refill correctly.
3. A word only fires on its final correct character.
4. Mistyping clears the word and applies no stun in default mode.
5. Heavy words push materially harder than light words at equal damage.
6. Damage percent visibly drives an escalating knockback curve.
7. A parry reduces incoming knockback and grants a working counter window.
8. A fighter pushed past the blast line gets a recovery prompt with a working success and failure path.
9. The kill spark and Finish Zoom fire from distance to the blast line.
10. Coins are awarded, persisted, and spendable in the shop.
11. Owned skins can be equipped and visibly change the fighter.
12. WPM and accuracy are live and correct, and survive a refresh as a personal best.
13. A hit cannot land inside the hit cooldown, and the cooldown always exceeds max hitstun.
14. Repeated saves in one round grant progressively tighter windows.
15. `npm run build`, `npm run lint` and `tsc --noEmit` all pass clean.
16. The engine's pure logic has unit tests that pass under plain Node.
17. `node scripts/verify-browser.mjs` plays a real match in Chromium and confirms damage lands.
18. Keyboard input reaches the game when it is embedded, and a player who cannot type is told to click the arena instead of assuming the game is broken.
