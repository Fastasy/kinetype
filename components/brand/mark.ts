// The Kinetype brand mark.
//
// A pixel-art K: violet stem (primary), cyan diagonals (secondary). It is drawn from a
// character matrix exactly like the fighter skins, so the header logo, the favicon and the
// Apple touch icon cannot drift apart, and there are no image files to keep in sync.
//
// WHY THE CYAN IS DARKER THAN IT LOOKS LIKE IT SHOULD BE. The paper background is #f2ede3,
// which is very light (relative luminance 0.85), so a bright cyan like #22d3ee is almost
// invisible on it. Two values are used instead:
//
//   secondary         #0e7490   4.59:1 on paper — safe for TEXT, and the wordmark uses it
//   secondary-bright  #0891b2   3.15:1 on paper — graphics only, but it meets the 3:1 WCAG
//                               bar for non-text elements, so the mark stays legible
//
// The mark uses the bright value because a mark is a graphic, not text, and the darker one
// would read as navy against violet rather than as a second colour.

export const BRAND = {
  /** Primary, unchanged. */
  primary: "#6d28d9",
  /** Slightly darker, for the shaded edge of the mark so it has depth at small sizes. */
  primaryDark: "#4c1d95",
  /** Secondary — text-safe cyan on paper. */
  secondary: "#0e7490",
  /** Secondary for graphics. */
  secondaryBright: "#0891b2",
} as const;

/**
 * 16x16. `.` transparent, `p` primary, `P` primary dark, `s` secondary.
 *
 * A stem with two diagonals, four pixels thick, which is about the thickest a K can be at this
 * size and still read as a K at 16px in a browser tab.
 */
export const MARK_ROWS: readonly string[] = [
  "................",
  "................",
  "..pppp....ssss..",
  "..pppp...ssss...",
  "..pppp..ssss....",
  "..pppp.ssss.....",
  "..ppppssss......",
  "..pppppp........",
  "..pppppp........",
  "..ppppssss......",
  "..pppp.ssss.....",
  "..pppp..ssss....",
  "..pppp...ssss...",
  "..pppp....ssss..",
  "................",
  "................",
];

const COLOUR_OF: Record<string, string | null> = {
  ".": null,
  p: BRAND.primary,
  P: BRAND.primaryDark,
  s: BRAND.secondaryBright,
};

export interface MarkRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

/**
 * Horizontal runs merged into single rects, the same trick the fighter sprites use: one row of
 * the stem becomes one rect instead of four, which keeps the SVG small enough to inline in the
 * header on every page.
 */
export function markRects(): MarkRect[] {
  const rects: MarkRect[] = [];
  MARK_ROWS.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const fill = COLOUR_OF[row[x]] ?? null;
      if (!fill) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < row.length && (COLOUR_OF[row[x + w]] ?? null) === fill) w++;
      rects.push({ x, y, w, h: 1, fill });
      x += w;
    }
  });
  return rects;
}

export const MARK_SIZE = 16;

/** A standalone SVG string, for the favicon and the touch icon. */
export function markSvgString(): string {
  const body = markRects()
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.fill}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}" ` +
    `width="${MARK_SIZE}" height="${MARK_SIZE}" shape-rendering="crispEdges">${body}</svg>`
  );
}
