// Arena maps — the PLACE a fight happens in.
//
// WHY THIS IS SEPARATE FROM A THEME
//
// Until now a `Theme` carried both the website's chrome AND the arena palette (sky, hills, ground,
// blast lines). That conflated two different things, and the shop ended up selling arenas: every
// boss fought in the same recoloured field, and "buying a theme" meant buying a different-looking
// field rather than a different-looking site.
//
// The split:
//   * a MAP is where you are. Each boss owns one, so Tick and Oblivion are visibly different
//     places. Free play uses DEFAULT_MAP_ID.
//   * a THEME is the website's own colours (game/themes.ts), and it is what the shop sells.
//
// TWO THINGS A MAP MUST NOT BREAK, both asserted arithmetically by the test suite:
//
//   1. The blast line has to be VISIBLE. It marks instant death, so a line the player cannot see
//      is a broken rule rather than a style choice. `blast` is stored OPAQUE (not the old
//      semi-transparent rgba) so its contrast against the sky is measurable, and it must clear 3:1
//      — the WCAG bar for non-text graphics — against EVERY sky band, not just one.
//
//      That last part constrains the sky itself: the line runs the full height of the stage, so it
//      crosses all three bands. A sky that fades from pale to dark cannot carry a single blast
//      colour — a light line vanishes on the light band and a dark one vanishes on the dark band.
//      Storm Ridge failed exactly this way (2.31:1 on its top band) and was fixed by narrowing the
//      sky's luminance range, not by weakening the rule. Depth here comes from hue, not brightness.
//   2. The platform outline has to be visible ON the ground it outlines. `ink` is therefore not
//      "always dark": on a light arena the outline is dark, and on a dark arena it is a light rim
//      (which is also why the damage-bar track — drawn in `ink` at low alpha — stays readable on
//      a dark map). Every map must clear 2:1 against both its dirt tones.
//
// What a map must NEVER touch: the damage colour ramp (white through yellow and orange to
// near-black). That is one signal a player must never have to relearn, and it lives in
// game/render.ts, outside this data.

export interface ArenaMap {
  id: string;
  name: string;
  /** Three sky bands, top to bottom. */
  sky: [string, string, string];
  hill: string;
  /** Platform surface. */
  grass: string;
  /** The darker lip under the surface, so the platform reads as solid. */
  grassLip: string;
  dirt: string;
  dirtDark: string;
  /** Blast line. Drawn over the sky, so it must stay visible against it. */
  blast: string;
  /** Outline on platform geometry, and the damage-bar track. Must contrast with the ground. */
  ink: string;
}

/** Free play's arena. Every boss fight overrides it with that boss's own. */
export const DEFAULT_MAP_ID = "training-ground";

export const MAPS: ArenaMap[] = [
  {
    // The arena the game shipped with, kept as the home of free play.
    id: "training-ground",
    name: "Training Ground",
    sky: ["#cfe9f7", "#bfe0f2", "#add4ea"],
    hill: "#9fc6a8",
    grass: "#6fbf5f",
    grassLip: "#4e9a44",
    dirt: "#b07a4e",
    dirtDark: "#8e5f3a",
    blast: "#be3c50",
    ink: "#2a2118",
  },
  {
    // Tick — "The Warm-Up". Dew, soft morning light, nothing threatening yet.
    id: "dewfield",
    name: "Dewfield",
    sky: ["#dfeff7", "#c9e4f2", "#b0d6ea"],
    hill: "#a7cfa4",
    grass: "#78c765",
    grassLip: "#549b45",
    dirt: "#b3814f",
    dirtDark: "#8d6339",
    blast: "#c5304a",
    ink: "#1f2a1a",
  },
  {
    // Bandit — "Quick Fingers". Dust and ochre. You cannot see where the ground ends.
    id: "rust-canyon",
    name: "Rust Canyon",
    sky: ["#f6ddb8", "#ecc386", "#dc9e5c"],
    hill: "#c07a45",
    grass: "#cf9a52",
    grassLip: "#9c6b33",
    dirt: "#a8642f",
    dirtDark: "#7d4620",
    blast: "#7a1f3a",
    ink: "#1e1005",
  },
  {
    // Vex — "The Needler". Brambles and something poisonous in the light. A pale rim light.
    id: "thorn-hollow",
    name: "Thorn Hollow",
    sky: ["#e5d6f2", "#cfb2e8", "#b28fd8"],
    hill: "#8d5fa8",
    grass: "#9d5fc0",
    grassLip: "#6f3d8c",
    dirt: "#6b4a7a",
    dirtDark: "#4e3459",
    blast: "#6e0f2c",
    ink: "#efe6ff",
  },
  {
    // Havoc — "Heavy Hitter". Cut stone and steel. Bleak on purpose.
    id: "iron-quarry",
    name: "Iron Quarry",
    sky: ["#dfe3e8", "#c7ced6", "#aab4bf"],
    hill: "#8a929c",
    grass: "#9aa3ad",
    grassLip: "#6f7883",
    dirt: "#757d87",
    dirtDark: "#565d66",
    blast: "#a30f1c",
    ink: "#1b1f24",
  },
  {
    // Quartz — "Steady Hands". Everything is glass, and glass does not forgive.
    id: "crystal-vault",
    name: "Crystal Vault",
    sky: ["#f0fbff", "#daf2fb", "#bfe6f5"],
    hill: "#b8dce8",
    grass: "#a8d8e8",
    grassLip: "#78b6cc",
    dirt: "#9fb8c4",
    dirtDark: "#7d96a3",
    blast: "#d62839",
    ink: "#1f3a44",
  },
  {
    // Cannon — "Loaded". A foundry. The blast line reads as hot metal, not paint.
    id: "foundry",
    name: "Foundry",
    sky: ["#5a4038", "#7a4a34", "#a85a2a"],
    hill: "#4a322b",
    grass: "#c2410c",
    grassLip: "#7c2d12",
    dirt: "#3f2a24",
    dirtDark: "#2e1e1a",
    blast: "#ffd166",
    ink: "#d8c3a5",
  },
  {
    // Nimbus — "Storm Typist". A ridge under heavy weather. Depth comes from hue, not brightness:
    // the sky bands stay within a narrow luminance range so one blast colour reads across all
    // three (a pale-to-dark sky cannot carry a single visible line).
    id: "storm-ridge",
    name: "Storm Ridge",
    sky: ["#6d8399", "#61768b", "#556a7e"],
    hill: "#4a5c72",
    grass: "#5f7d6a",
    grassLip: "#3f5949",
    dirt: "#54646f",
    dirtDark: "#3d4a53",
    blast: "#fff3b0",
    ink: "#d3e3f0",
  },
  {
    // Vortex — "The Blur". Blacked out, lit only by trim.
    id: "neon-grid",
    name: "Neon Grid",
    sky: ["#0b0b18", "#12122a", "#1a1a3d"],
    hill: "#1d1d40",
    grass: "#22ff88",
    grassLip: "#12a35a",
    dirt: "#26264d",
    dirtDark: "#1c1c3a",
    blast: "#ff2e88",
    ink: "#22ff88",
  },
  {
    // Oblivion — "Final Boss". There is no ground left, only an outline holding you up.
    id: "the-void",
    name: "The Void",
    sky: ["#120c16", "#1d1220", "#2c1a2e"],
    hill: "#241428",
    grass: "#7a2a3a",
    grassLip: "#4d1a26",
    dirt: "#2a1a24",
    dirtDark: "#1c1119",
    blast: "#ff6b1a",
    ink: "#c9a8d8",
  },
];

export function mapById(id: string): ArenaMap {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}

export const MAP_ORDER: readonly string[] = MAPS.map((m) => m.id);
