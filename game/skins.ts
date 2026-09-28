// Cosmetics.
//
// Skins are DATA, not assets. A skin is a palette plus silhouette parameters plus
// a trail style. The renderer draws fighters procedurally from this definition, so
// the build carries no sprite sheets and a new skin costs a few hundred bytes.
//
// Prices are in coins, earned by playing. See game/commerce.ts for the purchase
// boundary: no real-money provider ships until multiplayer exists.

import type { TrailPoint } from "./types";

export type SkinRarity = "starter" | "common" | "rare" | "legendary";

export interface Silhouette {
  /** Body width / height in px at rest. */
  w: number;
  h: number;
  /** 0 = round, 1 = sharp. Drives head and shoulder geometry. */
  edge: number;
  /** Extra crest/shoulder mass, 0..1. */
  mass: number;
  /** Number of spine fins drawn on the back. */
  fins: number;
}

export interface Skin {
  id: string;
  name: string;
  /** One-line shop blurb. */
  blurb: string;
  rarity: SkinRarity;
  /** Price in coins. 0 = owned by default. */
  price: number;
  /** Surface, accent and glow. */
  palette: {
    body: string;
    accent: string;
    trim: string;
    glow: string;
  };
  silhouette: Silhouette;
  trail: {
    /** Particle colour. */
    colour: string;
    /** Size multiplier. */
    scale: number;
    /** Emit extra motes at high damage. */
    spark: boolean;
  };
}

export const SKINS: Skin[] = [
  {
    id: "spark",
    name: "Spark",
    blurb: "The default frame. Balanced, bright, no nonsense.",
    rarity: "starter",
    price: 0,
    palette: { body: "#e6e6f2", accent: "#a78bfa", trim: "#4c1d95", glow: "#ddd6fe" },
    silhouette: { w: 46, h: 84, edge: 0.35, mass: 0.3, fins: 0 },
    trail: { colour: "#ddd6fe", scale: 1, spark: false },
  },
  {
    id: "ember",
    name: "Ember",
    blurb: "Runs hot. Trails burn orange when you get launched.",
    rarity: "common",
    price: 120,
    palette: { body: "#fb923c", accent: "#fbbf24", trim: "#7c2d12", glow: "#fed7aa" },
    silhouette: { w: 46, h: 84, edge: 0.55, mass: 0.35, fins: 2 },
    trail: { colour: "#fb923c", scale: 1.1, spark: true },
  },
  {
    id: "tide",
    name: "Tide",
    blurb: "Cool and wide. Built for players who hold the middle.",
    rarity: "common",
    price: 120,
    palette: { body: "#38bdf8", accent: "#22d3ee", trim: "#0c4a6e", glow: "#bae6fd" },
    silhouette: { w: 51, h: 81, edge: 0.25, mass: 0.5, fins: 0 },
    trail: { colour: "#38bdf8", scale: 1.15, spark: false },
  },
  {
    id: "monolith",
    name: "Monolith",
    blurb: "Heavy silhouette, flat launch arcs. Reads as weight.",
    rarity: "rare",
    price: 320,
    palette: { body: "#a1a1aa", accent: "#e4e4e7", trim: "#27272a", glow: "#d4d4d8" },
    silhouette: { w: 59, h: 89, edge: 0.85, mass: 0.75, fins: 0 },
    trail: { colour: "#a1a1aa", scale: 1.35, spark: false },
  },
  {
    id: "violet",
    name: "Violet Static",
    blurb: "Slim frame, crackling trail. For speed players.",
    rarity: "rare",
    price: 320,
    palette: { body: "#f0abfc", accent: "#e879f9", trim: "#701a75", glow: "#fae8ff" },
    silhouette: { w: 41, h: 86, edge: 0.7, mass: 0.2, fins: 3 },
    trail: { colour: "#f0abfc", scale: 0.95, spark: true },
  },
  {
    id: "voidwing",
    name: "Voidwing",
    blurb: "The legendary frame. Near-black body, green rim light.",
    rarity: "legendary",
    price: 900,
    palette: { body: "#18181b", accent: "#4ade80", trim: "#052e16", glow: "#bbf7d0" },
    silhouette: { w: 49, h: 92, edge: 0.95, mass: 0.55, fins: 4 },
    trail: { colour: "#4ade80", scale: 1.4, spark: true },
  },
];

export const DEFAULT_SKIN_ID = "spark";

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export const RARITY_LABEL: Record<SkinRarity, string> = {
  starter: "Starter",
  common: "Common",
  rare: "Rare",
  legendary: "Legendary",
};

// ------------------------------------------------------------------ overlays

export interface Overlay {
  id: string;
  name: string;
  blurb: string;
  price: number;
  panel: string;
  border: string;
  promptBg: string;
  promptActive: string;
}

export const OVERLAYS: Overlay[] = [
  {
    id: "hud-default",
    name: "Terminal",
    blurb: "The standard HUD. High contrast, no decoration.",
    price: 0,
    panel: "rgba(8,8,20,0.86)",
    border: "#2a2a45",
    promptBg: "#12121f",
    promptActive: "#a78bfa",
  },
  {
    id: "hud-amber",
    name: "Amber CRT",
    blurb: "Warm phosphor. Softer on the eyes at night.",
    price: 150,
    panel: "rgba(24,16,4,0.84)",
    border: "#78350f",
    promptBg: "#1c1206",
    promptActive: "#fbbf24",
  },
  {
    id: "hud-ice",
    name: "Cryo",
    blurb: "Cold blue panels with cyan highlight.",
    price: 150,
    panel: "rgba(6,18,30,0.84)",
    border: "#0c4a6e",
    promptBg: "#071a2b",
    promptActive: "#22d3ee",
  },
];

export const DEFAULT_OVERLAY_ID = "hud-default";

export function overlayById(id: string): Overlay {
  return OVERLAYS.find((o) => o.id === id) ?? OVERLAYS[0];
}

/** Engine-level trail style, resolved from the equipped skin. */
export interface TrailStyle {
  colour: string;
  scale: number;
  spark: boolean;
}

export function trailFor(skin: Skin): TrailStyle {
  return { ...skin.trail };
}

export type { TrailPoint };
