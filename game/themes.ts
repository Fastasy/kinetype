// Themes. A theme restyles the WHOLE fight: the arena sky, the hills, the platforms, the
// blast lines, the prompt panel, the HUD panels and the section they sit on.
//
// This replaced the old "HUD overlay" concept, which only recoloured the prompt panel. Ruan
// asked for themes, and a theme that changes one panel is not a theme.
//
// WHAT A THEME MUST NEVER CHANGE: the damage colour ramp (white through yellow and orange to
// near-black). That is one signal a player must never have to relearn, so it stays fixed
// across every theme and lives in game/render.ts.
//
// Every theme is checked for WCAG AA contrast by the test suite: text on surface, and the
// accent against the text that sits on it. A cool-looking theme with unreadable prompts is a
// defective product, so the check is automated rather than eyeballed.

import type { Rarity } from "./skins";

export interface Theme {
  id: string;
  name: string;
  blurb: string;
  rarity: Rarity;
  price: number;

  // ---- chrome (panels, prompt card, surrounding section)
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

  // ---- arena (read by the canvas renderer)
  /** Three sky bands, top to bottom. */
  sky: [string, string, string];
  hill: string;
  grass: string;
  grassLip: string;
  dirt: string;
  dirtDark: string;
  /** Blast line colour. */
  blast: string;
  /** Outline on platform geometry and UI bars. */
  ink: string;
}

export const DEFAULT_THEME_ID = "paper";

export const THEMES: Theme[] = [
  {
    id: "paper",
    name: "Paper",
    blurb: "Daylight. The one the game shipped with.",
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
    sky: ["#cfe9f7", "#bfe0f2", "#add4ea"],
    hill: "#9fc6a8",
    grass: "#6fbf5f",
    grassLip: "#4e9a44",
    dirt: "#b07a4e",
    dirtDark: "#8e5f3a",
    blast: "rgba(190,60,80,0.55)",
    ink: "#2a2118",
  },
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Deep blue night. Cyan reads like a lit sign.",
    rarity: "common",
    price: 200,
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
    sky: ["#131a3d", "#1b2350", "#243066"],
    hill: "#26305c",
    grass: "#3f8fb0",
    grassLip: "#2a5f7b",
    dirt: "#3a4070",
    dirtDark: "#2b3059",
    blast: "rgba(244,114,182,0.6)",
    ink: "#05070f",
  },
  {
    id: "sunset",
    name: "Sunset",
    blurb: "Dusk over the stage. Orange on purple.",
    rarity: "common",
    price: 300,
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
    sky: ["#ff9e6d", "#ec6f9b", "#a44bb0"],
    hill: "#8b3f86",
    grass: "#d1609a",
    grassLip: "#a03a72",
    dirt: "#7a3a6b",
    dirtDark: "#5f2c54",
    blast: "rgba(255,241,150,0.65)",
    ink: "#241028",
  },
  {
    id: "frost",
    name: "Frost",
    blurb: "Ice field. Pale, cold, high contrast.",
    rarity: "common",
    price: 300,
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
    sky: ["#dcefff", "#c6e4f7", "#a8d4ef"],
    hill: "#cfe6ee",
    grass: "#a8d8e8",
    grassLip: "#7fbcd4",
    dirt: "#b8c9d2",
    dirtDark: "#9aabb5",
    blast: "rgba(190,60,80,0.5)",
    ink: "#2a3a44",
  },
  {
    id: "neon",
    name: "Neon Grid",
    blurb: "Blackout arena with acid green trim.",
    rarity: "rare",
    price: 650,
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
    sky: ["#0b0b18", "#12122a", "#1a1a3d"],
    hill: "#1d1d40",
    grass: "#22ff88",
    grassLip: "#12a35a",
    dirt: "#26264d",
    dirtDark: "#1c1c3a",
    blast: "rgba(255,0,200,0.65)",
    ink: "#04040a",
  },
  {
    id: "volcano",
    name: "Volcano",
    blurb: "Ash and lava. The stage is already losing.",
    rarity: "legendary",
    price: 900,
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
    sky: ["#2b1210", "#4a1a12", "#7a2a14"],
    hill: "#3a1a14",
    grass: "#c2410c",
    grassLip: "#7c2d12",
    dirt: "#3f2320",
    dirtDark: "#2e1a18",
    blast: "rgba(255,220,120,0.65)",
    ink: "#0a0505",
  },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export const THEME_ORDER: readonly string[] = THEMES.map((t) => t.id);

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
