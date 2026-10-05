// Cosmetics, as pixel art.
//
// A skin is a PIXEL MATRIX plus a palette. Nothing else. There are no image files:
// the canvas blits each cell as a filled rect, and the shop renders the same matrix
// as SVG. That keeps the build tiny (the ad-network budget wants under 20MB) and it
// means a new skin costs nothing to serve.
//
// GRID RULES, enforced by game/tests/engine.test.ts:
//   - every row is exactly SPRITE_W characters
//   - every character is either "." or a key present in that skin's palette
//   - fonts are irrelevant here; a typo in a row is a visible hole in the sprite,
//     so the row widths are asserted rather than eyeballed.
//
// Legend
//   .  transparent          o  outline (darkest)
//   h  hair / helmet / hood s  skin
//   e  eye                  b  body
//   a  arm                  l  legs
//   f  feet                 t  trim

export const SPRITE_W = 12;
export const SPRITE_H = 16;
/**
 * Sprite scale in stage pixels. Raised from 5 to 7 when the game got its own page and a
 * 66vh arena: at scale 5 the fighters rendered ~50px tall against a large empty sky and
 * did not carry the frame. The hurtbox in game/constants.ts moves with this, because a
 * hurtbox smaller than the sprite means attacks that look like they connect will miss.
 */
export const SPRITE_SCALE = 7;

/** Every legal pixel character. Used by the test to catch typos. */
export const PIXEL_KEYS = ["o", "h", "s", "e", "b", "a", "l", "f", "t"] as const;

export type Rarity = "starter" | "common" | "rare" | "legendary";

export interface PixelPalette {
  o: string; // outline
  h: string; // hair
  s: string; // skin
  e: string; // eye
  b: string; // body
  a: string; // arm
  l: string; // legs
  f: string; // feet
  t: string; // trim
}

export interface PixelSkin {
  id: string;
  name: string;
  blurb: string;
  rarity: Rarity;
  price: number;
  palette: PixelPalette;
  /** SPRITE_H rows of SPRITE_W characters. */
  pixels: string[];
  trail: { colour: string; scale: number; spark: boolean };
}

/** The shop renders this from the same matrix the canvas draws. */
export function spriteRows(skin: PixelSkin): string[] {
  return skin.pixels;
}

// ---------------------------------------------------------------------------
// Body archetypes. Three silhouettes keep the roster visually distinct without
// authoring six unrelated sprites that then drift out of alignment.
// ---------------------------------------------------------------------------

/** Standard build. */
const STANDARD = [
  "....oooo....",
  "...ohhhho...",
  "..ohhhhhho..",
  "..ohssssho..",
  "..osesseso..",
  "..osssssso..",
  "..osssssso..",
  "..obbbbbbo..",
  ".oabbbbbbao.",
  ".oabbtbbbao.",
  ".oabbbbbbao.",
  "..ollllllo..",
  "..ollllllo..",
  "..olll.llo..",
  "..olll.llo..",
  "..offf.ffo..",
];

/** Broad and heavy: wider shoulders, longer torso, shorter legs. */
const BROAD = [
  "....oooo....",
  "...ohhhho...",
  "..ohhhhhho..",
  "..ohhhhhho..",
  "..ohssssho..",
  "..osesseso..",
  "..osssssso..",
  ".obbbbbbbbo.",
  "oabbbbbbbbao",
  "oabbbttbbbao",
  "oabbbbbbbbao",
  ".obbbbbbbbo.",
  "..ollllllo..",
  "..olll.llo..",
  "..olll.llo..",
  "..offf.ffo..",
];

/** Slim and tall: a four-wide torso. */
const SLIM = [
  "....oooo....",
  "...ohhhho...",
  "...ohhhho...",
  "...ohssho...",
  "...osesso...",
  "...osssso...",
  "...obbbbo...",
  "..oabbbbao..",
  "..oabbbbao..",
  "..oabttbao..",
  "..oabbbbao..",
  "...ollllo...",
  "...ollllo...",
  "...oll.llo..",
  "...oll.llo..",
  "...off.ffo..",
];

/** Hooded: hair wraps the shoulders, face sits in shadow. */
const HOODED = [
  "....oooo....",
  "...ohhhho...",
  "..ohhhhhho..",
  "..ohhhhhho..",
  "..ohssssho..",
  "..osesseso..",
  "..osssssso..",
  "..ohhhhhho..",
  ".ohbbbbbbho.",
  ".ohbbttbbho.",
  ".ohbbbbbbho.",
  "..ollllllo..",
  "..ollllllo..",
  "..olll.llo..",
  "..olll.llo..",
  "..offf.ffo..",
];

/** Helmeted: a full visor slit, no skin on the head. */
const HELMETED = [
  "....oooo....",
  "...ohhhho...",
  "..ohhhhhho..",
  "..ohhhhhho..",
  "..oeeeeeeo..",
  "..ohhhhhho..",
  "..osssssso..",
  ".obbbbbbbbo.",
  "oabbbbbbbbao",
  "oabbbttbbbao",
  "oabbbbbbbbao",
  ".obbbbbbbbo.",
  "..ollllllo..",
  "..olll.llo..",
  "..olll.llo..",
  "..offf.ffo..",
];

/** Spiky hair, marked by the split crown row. */
const SPIKY = [
  "..o.oooo.o..",
  "..ohhhhhho..",
  ".ohhhhhhhho.",
  ".ohssssssho.",
  "..osesseso..",
  "..osssssso..",
  "..obbbbbbo..",
  ".oabbbbbbao.",
  ".oabbbbbbao.",
  ".oabttttbao.",
  ".oabbbbbbao.",
  "..ollllllo..",
  "..ollllllo..",
  "..olll.llo..",
  "..olll.llo..",
  "..offf.ffo..",
];

export const SKINS: PixelSkin[] = [
  {
    id: "spark",
    name: "Spark",
    blurb: "The default build. Balanced, bright, no nonsense.",
    rarity: "starter",
    price: 0,
    palette: {
      o: "#1b1b22",
      h: "#6b4423",
      s: "#e8b48a",
      e: "#22303f",
      b: "#3b7dd8",
      a: "#3b7dd8",
      l: "#3a3f4b",
      f: "#242832",
      t: "#dfe7f2",
    },
    pixels: STANDARD,
    trail: { colour: "#7fb0f0", scale: 1, spark: false },
  },
  {
    id: "ember",
    name: "Ember",
    blurb: "Burns hot. Reads huge knockback.",
    rarity: "common",
    price: 1500,
    palette: {
      o: "#2a1410",
      h: "#f97316",
      s: "#e8b48a",
      e: "#3a1a12",
      b: "#c2410c",
      a: "#c2410c",
      l: "#3f2119",
      f: "#241512",
      t: "#fbbf24",
    },
    pixels: BROAD,
    trail: { colour: "#fb923c", scale: 1.15, spark: true },
  },
  {
    id: "tide",
    name: "Tide",
    blurb: "Cool and swift. A slim profile for clean dodges.",
    rarity: "common",
    price: 1500,
    palette: {
      o: "#0d2430",
      h: "#155e75",
      s: "#d9a97e",
      e: "#0b2a36",
      b: "#0891b2",
      a: "#0891b2",
      l: "#164e63",
      f: "#0e3a49",
      t: "#a5f3fc",
    },
    pixels: SLIM,
    trail: { colour: "#67e8f9", scale: 0.95, spark: false },
  },
  {
    id: "monolith",
    name: "Monolith",
    blurb: "A wall with legs. The heaviest frame in the roster.",
    rarity: "rare",
    price: 5000,
    palette: {
      o: "#1c1c22",
      h: "#6b7280",
      s: "#9ca3af",
      e: "#111827",
      b: "#4b5563",
      a: "#4b5563",
      l: "#374151",
      f: "#1f2937",
      t: "#d1d5db",
    },
    pixels: HELMETED,
    trail: { colour: "#9ca3af", scale: 1.25, spark: false },
  },
  {
    id: "violet-static",
    name: "Violet Static",
    blurb: "Spiked frame. Leaves a crackling trail.",
    rarity: "rare",
    price: 5000,
    palette: {
      o: "#2b0f3a",
      h: "#a21caf",
      s: "#e8b48a",
      e: "#2b0f3a",
      b: "#9333ea",
      a: "#9333ea",
      l: "#581c87",
      f: "#3b0764",
      t: "#f0abfc",
    },
    pixels: SPIKY,
    trail: { colour: "#e879f9", scale: 0.95, spark: true },
  },
  {
    id: "voidwing",
    name: "Voidwing",
    blurb: "The legendary frame. Hooded, dark, quiet.",
    rarity: "legendary",
    price: 15000,
    palette: {
      o: "#05130d",
      h: "#14532d",
      s: "#8f7a5a",
      e: "#d9f99d",
      b: "#1f2937",
      a: "#1f2937",
      l: "#111827",
      f: "#052e16",
      t: "#4ade80",
    },
    pixels: HOODED,
    trail: { colour: "#4ade80", scale: 1.1, spark: true },
  },
];

export function skinById(id: string): PixelSkin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

/**
 * The enemy always wears Ember. It makes the two sides readable at a glance
 * without the player having to check a label, and it means an equipped skin can
 * never be confused with the opponent.
 */
export const OPPONENT_SKIN_ID = "ember";

/** What a brand new save starts with. */
export const DEFAULT_SKIN_ID = "spark";
export const RARITY_LABEL: Record<Rarity, string> = {
  starter: "STARTER",
  common: "COMMON",
  rare: "RARE",
  legendary: "LEGENDARY",
};
