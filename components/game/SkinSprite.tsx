import { SPRITE_H, SPRITE_W, type PixelSkin } from "@/game/skins";

/**
 * A skin's pixels as SVG PATHS, merged per colour and run-length merged along each row.
 *
 * WHY NOT A RECT PER PIXEL: the obvious implementation emits ~150 <rect> elements per
 * sprite. With six skins on the landing page and a shop grid that is 1332 DOM nodes, and
 * it measured badly: first contentful paint was 1856ms on `/` against 380ms on `/play`.
 * Bytes were never the problem (brotli takes the markup from 271KB to 25KB); the parse and
 * layout cost was. Merging gives ~9 <path> elements per sprite instead.
 *
 * Exported so the shop's SVG and the landing page's arena teaser share ONE renderer with
 * the canvas instead of three implementations that can drift apart.
 */
export function skinPaths(
  skin: PixelSkin,
  scale: number,
  dx: number,
  dy: number,
  keyPrefix = "",
): React.ReactElement[] {
  const byColour = new Map<string, string[]>();

  skin.pixels.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x++;
        continue;
      }
      // Extend the run while the same colour repeats, so one row of a solid body is one
      // path segment rather than twelve.
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;

      const fill = skin.palette[ch as keyof typeof skin.palette];
      if (fill) {
        const segments = byColour.get(fill) ?? [];
        segments.push(
          `M${dx + x * scale} ${dy + y * scale}h${run * scale}v${scale}h${-run * scale}z`,
        );
        byColour.set(fill, segments);
      }
      x += run;
    }
  });

  return [...byColour].map(([fill, segments]) => (
    <path key={`${keyPrefix}${fill}`} d={segments.join("")} fill={fill} />
  ));
}

/** Natural pixel size of a sprite at a given scale. */
export function spriteSize(scale: number): { w: number; h: number } {
  return { w: SPRITE_W * scale, h: SPRITE_H * scale };
}

/**
 * Draws a skin as a standalone SVG.
 *
 * shapeRendering="crispEdges" is required. Without it the browser antialiases the path
 * seams and the pixel grid goes soft.
 */
export default function SkinSprite({
  skin,
  scale = 7,
  className,
}: {
  skin: PixelSkin;
  scale?: number;
  className?: string;
}) {
  const { w, h } = spriteSize(scale);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={`${skin.name} sprite`}
    >
      {skinPaths(skin, scale, 0, 0)}
    </svg>
  );
}
