// The FIXED palette for anything drawn where the theme does not decide the background.
//
// THE BUG THIS EXISTS TO KILL
//
// A theme is the WEBSITE's colours and the arena is a MAP (game/maps.ts). They are independent by
// design. But four overlays were drawn on top of the arena using THEME tokens:
//
//     countdown digit   text-ink      on the map's sky
//     FINISH flag       text-heat     on heat-deep at 70% alpha over the sky
//     SAVE prompt       text-coin     on coin-deep at 80% alpha over the sky
//     "Xs left in round"  text-ink-faint  on surface at 90% alpha over the sky (fullscreen)
//
// The theme suite only ever compared theme tokens against OTHER theme tokens, so all four passed
// while being invisible on screen. Measured, the countdown digit as themed text was:
//
//     neon theme on Crystal Vault  1.00:1   (light-green ink on a pale sky: the same colour)
//     paper theme on Neon Grid     1.04:1
//     midnight/sunset/volcano/neon on free play's own Training Ground  1.08 - 1.20:1
//
// 31 of the 60 theme x arena combinations were below the 3:1 bar for large text, and 29 of those
// were at roughly 1.1:1 — not "low contrast", but text the player cannot see at all. Ruan:
// "some of themes clash with the text on screen like the timer."
//
// THE RULE
//
// The page may be themed. Anything that sits on the ARENA, or on a translucent panel floating over
// it, must carry its own background or its own outline, so it is readable whatever is behind it.
// That is the same rule the move chips in PromptCard already follow for a different reason.
//
// TWO TOOLS, both arithmetic rather than taste:
//
//  1. PLATE — an opaque background plus ink chosen against it. Contrast is a CONSTANT, independent
//     of theme and arena: white on #0b0b12 is 19.6:1 anywhere. Used for the small chips.
//
//  2. OUTLINE — for text too big to sit on a plate (the 60px countdown digit), a light fill over a
//     dark outline. Whichever of the two rings has the greater contrast against the background is
//     the one that carries the glyph, so the readable contrast is max(fill, outline) — not the
//     fill's own ratio. The worst case of that pair is exactly 4.44:1, at a background luminance of
//     0.103 (where neither ring wins by much), and it is never worse than that on ANY background.
//     See the "outlined text is never unreadable" test, which sweeps the whole luminance range.

import { SIGNALS_DARK } from "./themes";

export const ARENA_HUD = {
  /** Fill for large text drawn straight onto the arena, with `outline` behind it. */
  ink: "#ffffff",
  /** The dark ring behind that fill. */
  outline: "#0b0b12",
  /** An opaque chip's background, for text too small to rely on an outline. */
  plate: "#0b0b12",
  /** Ink on that plate. Constant 19.6:1 — the point of the plate. */
  plateInk: "#ffffff",
  /** Secondary ink on that plate. Constant 12.8:1. */
  plateInkMuted: "#cfcfe0",
} as const;

/**
 * THE TELEGRAPH CHIP (FINISH / KICK INCOMING) and THE SAVE CHIP.
 *
 * These keep their hue family exactly — red means a heavy hit is coming, gold means it is worth
 * something — but they take the DARK palette's values against their own dark plate, because the
 * arena is not the page. The light-page values (#be123c heat, #92400e coin) score 2.4:1 and 2.2:1
 * on that plate, so hue alone is not enough: this pair is the one that passes, and it is frozen
 * here rather than taken from the equipped theme.
 */
export const ARENA_DANGER = { bg: SIGNALS_DARK.heatDeep, ink: SIGNALS_DARK.heat } as const;
export const ARENA_REWARD = { bg: SIGNALS_DARK.coinDeep, ink: SIGNALS_DARK.coin } as const;

/**
 * THE OUTCOME BANNER (win / loss) on the result card.
 *
 * The result card is a themed surface, but its win line was the smallest text on the screen and
 * the loudest moment of the game. The banner is deliberately NOT themed: a win is the game's own
 * signal, not site chrome, and the banner has to read identically after the player has just spent
 * coins on a cosmetic. Gold for a win (the coin language, already taught by every price chip) and
 * heat red for a loss (already taught by every heavy hit).
 */
export const RESULT_PLATE = {
  bg: "#0b0b12",
  win: SIGNALS_DARK.coin, // #fbbf24 — 11.2:1 on the plate
  loss: SIGNALS_DARK.heat, // #fb7185 — 6.6:1 on the plate
  ink: "#ffffff",
  inkMuted: "#cfcfe0",
} as const;

/**
 * An achievement flare on that banner — "CLEAN SWEEP", "ON FIRE · CHAIN 14".
 *
 * Opaque, like the plate, so the pair is a constant: the gold is 9.9:1 and the white 16.4:1 on
 * #1b1b23, whatever the theme and whatever the arena behind the card. A translucent chip here
 * would reintroduce exactly the bug this file exists to kill.
 */
export const RESULT_FLARE = {
  bg: "#1b1b23",
  achievement: SIGNALS_DARK.coin,
  plain: "#ffffff",
} as const;

/** Ring thickness for outlined arena text, matched to the 60px countdown glyph. */
export const ARENA_OUTLINE_PX = 4;

/**
 * The gold that leads a win's confetti.
 *
 * Same value as the "on fire" chain colour in FightClient, for the same reason: gold already means
 * "this is worth something" everywhere else in the game, and a win is the payoff. Shared from here
 * so the particle pool, the win burst and the contrast test cannot drift apart.
 */
export const CELEBRATION_GOLD = "#facc15";

/**
 * Opacity of the fullscreen HUD panels, as a hex alpha byte on the theme's surface colour.
 *
 * These panels FLOAT over the arena with `backdrop-blur`, so every text pair inside them is
 * measured on a composite of the theme's surface over the map's sky — a pair the theme suite never
 * sees, because there it is an opaque theme-vs-theme check. It is exactly the blind spot that let
 * the countdown be invisible for months, one layer up.
 *
 * At 90% (`e6`) the Paper theme's `text-ink-faint` — which is what "Xs left in round" is written
 * in — measured 4.498:1 over the Neon Grid arena: below AA, and it passed every existing assertion.
 * At 95% the worst theme x arena pair is 5.01:1, for under 2% of the arena visible through the
 * panel. Both figures are asserted in the test suite, the first as a negative control so the test
 * can actually catch a regression to the old value.
 */
export const PANEL_ALPHA_BYTE = "f2";

/** The same value as the 0..1 number the contrast arithmetic needs. One source, two forms. */
export const PANEL_ALPHA = parseInt(PANEL_ALPHA_BYTE, 16) / 255;

/**
 * The eight-direction ring for `ARENA_HUD.ink`, built from the constants above so the two colours
 * cannot drift apart. A text-shadow is used rather than -webkit-text-stroke because the stroke is
 * drawn centred on the glyph edge and eats into the fill, and because `paint-order: stroke fill`
 * is not dependable for HTML text.
 */
export const ARENA_OUTLINE_SHADOW = (() => {
  const r = ARENA_OUTLINE_PX;
  const dirs = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];
  return dirs.map(([x, y]) => `${x * r}px ${y * r}px 0 ${ARENA_HUD.outline}`).join(", ");
})();
