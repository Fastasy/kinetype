// Themes — the WEBSITE's colours. Applied to <html> by components/ThemeProvider.tsx, so an
// equipped theme repaints the whole site: the marketing pages, the leaderboard, the shop, the
// profile and the game screen inside all of them.
//
// WHAT MOVED OUT, AND WHY
//
// This file used to carry the arena palette too (sky, hills, ground, blast lines). That made
// "a theme" mean two different things at once, and the shop was effectively selling arenas: every
// boss fought in the same recoloured field. The arena is now game/maps.ts, owned by boss — see
// that file for the contrast rules the blast line and platform outline have to satisfy.
//
// WHAT A THEME STILL MUST NEVER CHANGE
//
//   * The damage colour ramp (white through yellow and orange to near-black). One signal a player
//     must never have to relearn, so it is fixed in game/render.ts and is never themed.
//   * The semantic signal tokens in app/globals.css: --color-coin (prices), --color-heat (heavy
//     hits and losses), --color-aqua (blocks and parries), --color-secondary (the brand's cyan).
//     A theme is deliberately not allowed to move those, so a price never stops reading as a
//     price. If a dark theme makes one of them hard to read, the fix belongs in globals.css
//     (signal chips carry their own background) rather than in a theme quietly redefining it.
//
// The prompt card IS themed (promptBg / promptBorder / promptActive): it is the game's surface,
// part of the page, and the test suite checks its text stays readable in every theme.
//
// Every theme is checked for WCAG AA contrast by the test suite: text on surface, and the accent
// against the text that sits on it. A cool-looking theme with unreadable prompts is a defective
// product, so the check is automated rather than eyeballed.

import type { Rarity } from "./skins";

/**
 * The SIGNAL palette: the colours that carry meaning rather than style.
 *
 * coin is a price, heat is a loss, aqua is a block, secondary is the brand's second colour. A
 * player must never have to relearn those, so they are NOT free-form per theme: a theme declares
 * which of exactly TWO palettes it needs, and that is all the choice it gets.
 *
 * Two are required because one can never work on both. Clearing 4.5:1 on a near-black page needs a
 * luminance of at least 0.21; on the light page it needs at most 0.15. Those cannot both be true of
 * one colour — and measured, the light-page values score just 2.2-3.8:1 on the dark themes, which
 * is a price you cannot read. The hue families are preserved exactly: coin stays gold, heat stays
 * red, aqua stays teal. Only the lightness moves.
 *
 * The test suite asserts every theme's effective signals clear WCAG AA against BOTH its page and
 * its card, and that the two chip colours carry their own text.
 */
export interface ThemeSignals {
  coin: string;
  coinDeep: string;
  heat: string;
  heatDeep: string;
  aqua: string;
  secondary: string;
  secondaryBright: string;
  secondarySoft: string;
  secondaryDeep: string;
}

/** The site defaults, mirroring app/globals.css. Verified against the light themes. */
export const SIGNALS_LIGHT: ThemeSignals = {
  coin: "#92400e",
  coinDeep: "#fef3c7",
  heat: "#be123c",
  heatDeep: "#ffe4e6",
  aqua: "#0e7490",
  secondary: "#0e7490",
  secondaryBright: "#0891b2",
  secondarySoft: "#22d3ee",
  secondaryDeep: "#cffafe",
};

/** The same signals, lightened for a dark page. Same meanings, same hue families. */
export const SIGNALS_DARK: ThemeSignals = {
  coin: "#fbbf24",
  coinDeep: "#3a2a06",
  heat: "#fb7185",
  heatDeep: "#3b0d18",
  aqua: "#2dd4bf",
  secondary: "#22d3ee",
  secondaryBright: "#67e8f9",
  secondarySoft: "#0891b2",
  secondaryDeep: "#083344",
};

export interface Theme {
  id: string;
  name: string;
  blurb: string;
  rarity: Rarity;
  price: number;

  /**
   * Which signal palette this theme needs. OMIT it for a light theme: the site defaults apply.
   * Only the VALUES may differ between the two — never the meanings.
   */
  signals?: ThemeSignals;

  /** Background behind the arena and panels. */
  page: string;
  /** Panel surface. */
  surface: string;
  /** Panel border. */
  border: string;
  /** Primary text. */
  text: string;
  /** Secondary text. */
  textMuted: string;
  /** Accent for buttons, badges and equipped states. */
  accent: string;
  /** Text placed ON the accent colour. Must contrast with `accent`. */
  onAccent: string;
  /** Prompt card colours. */
  promptBg: string;
  promptBorder: string;
  promptActive: string;
}

export const DEFAULT_THEME_ID = "paper";

export const THEMES: Theme[] = [
  {
    id: "paper",
    name: "Paper",
    blurb: "Daylight. The one the site shipped with.",
    rarity: "starter",
    price: 0,
    page: "#f2ede3",
    surface: "#fffdf7",
    border: "#d5ccb8",
    text: "#1e1a14",
    textMuted: "#6f6656",
    accent: "#6d28d9",
    onAccent: "#ede9fe",
    promptBg: "#f8f5ee",
    promptBorder: "#c9c3b4",
    promptActive: "#6d28d9",
  },
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Deep blue night. Cyan reads like a lit sign.",
    rarity: "common",
    price: 1500,
    signals: SIGNALS_DARK,
    page: "#0f1226",
    surface: "#1a1f3a",
    border: "#39406e",
    text: "#eef1ff",
    textMuted: "#a3aacd",
    accent: "#22d3ee",
    onAccent: "#062a33",
    promptBg: "#1e2440",
    promptBorder: "#4a5488",
    promptActive: "#22d3ee",
  },
  {
    id: "sunset",
    name: "Sunset",
    blurb: "Dusk. Orange on purple, warm and loud.",
    rarity: "common",
    price: 1500,
    signals: SIGNALS_DARK,
    page: "#341a3d",
    surface: "#46235a",
    border: "#7b4a90",
    text: "#ffe9f3",
    textMuted: "#d8aecd",
    accent: "#fb923c",
    onAccent: "#3b1706",
    promptBg: "#4d2760",
    promptBorder: "#8a55a3",
    promptActive: "#fb923c",
  },
  {
    id: "frost",
    name: "Frost",
    blurb: "Ice. Pale, cold, high contrast.",
    rarity: "common",
    price: 1500,
    page: "#eaf3f8",
    surface: "#ffffff",
    border: "#c3dae6",
    text: "#0d2430",
    textMuted: "#476c7c",
    accent: "#0e7490",
    onAccent: "#e0f7ff",
    promptBg: "#f2fafd",
    promptBorder: "#bcd8e2",
    promptActive: "#0e7490",
  },
  {
    id: "neon",
    name: "Neon Grid",
    blurb: "Blacked out, lit by acid green.",
    rarity: "rare",
    price: 5000,
    signals: SIGNALS_DARK,
    page: "#07070d",
    surface: "#12121f",
    border: "#2f2f55",
    text: "#e8fff4",
    textMuted: "#8fa3a0",
    accent: "#22ff88",
    onAccent: "#00220f",
    promptBg: "#15152a",
    promptBorder: "#3a3a68",
    promptActive: "#22ff88",
  },
  {
    id: "volcano",
    name: "Volcano",
    blurb: "Ash and ember. Nothing here is calm.",
    rarity: "legendary",
    price: 15000,
    signals: SIGNALS_DARK,
    page: "#140b0b",
    surface: "#241313",
    border: "#542a2a",
    text: "#ffe9dd",
    textMuted: "#cfa392",
    accent: "#ff6b1a",
    onAccent: "#2a0d00",
    promptBg: "#2a1616",
    promptBorder: "#663232",
    promptActive: "#ff6b1a",
  },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export const THEME_ORDER: readonly string[] = THEMES.map((t) => t.id);

/**
 * A theme as CSS custom properties, ready to write onto an element.
 *
 * ONE place defines this mapping. The provider applies it to <html> for the whole site; having two
 * copies of the list is how a theme ends up quietly half-applied.
 *
 * Includes the signal palette, because those colours have to follow the theme's lightness or a
 * price becomes unreadable on a dark page — but they can only ever be one of the two fixed
 * palettes, so the MEANING of a signal never changes.
 */
export function themeCssVars(theme: Theme): Record<string, string> {
  const s = theme.signals ?? SIGNALS_LIGHT;
  return {
    "--color-page": theme.page,
    "--color-card": theme.surface,
    "--color-line": theme.border,
    "--color-line-strong": theme.promptBorder,
    "--color-ink": theme.text,
    "--color-ink-soft": theme.textMuted,
    "--color-ink-faint": theme.textMuted,
    "--color-brand": theme.accent,
    "--color-brand-bright": theme.accent,
    "--color-brand-soft": theme.accent,
    "--color-brand-deep": theme.onAccent,
    // Signals: meaning fixed, lightness per palette.
    "--color-coin": s.coin,
    "--color-coin-deep": s.coinDeep,
    "--color-heat": s.heat,
    "--color-heat-deep": s.heatDeep,
    "--color-aqua": s.aqua,
    "--color-secondary": s.secondary,
    "--color-secondary-bright": s.secondaryBright,
    "--color-secondary-soft": s.secondarySoft,
    "--color-secondary-deep": s.secondaryDeep,
  };
}

// --------------------------------------------------------------------------- colour maths
// Kept here, next to the data it validates, so the test suite can assert every theme is
// readable without duplicating the formula.

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance of #rgb / #rrggbb. Returns null for anything else (rgba, named). */
export function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two opaque hex colours. */
export function contrast(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
