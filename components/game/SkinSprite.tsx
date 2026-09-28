import { SPRITE_H, SPRITE_W, type PixelSkin } from "@/game/skins";

/**
 * The pixel rects for a skin, positioned at (dx, dy) in whatever coordinate space the
 * caller is drawing in.
 *
 * Exported so the shop's SVG and the landing page's arena teaser share ONE renderer
 * with the canvas instead of three implementations that can drift apart. A skin must
 * look identical everywhere it appears.
 */
export function skinRects(
  skin: PixelSkin,
  scale: number,
  dx: number,
  dy: number,
  keyPrefix = "",
): React.ReactElement[] {
  const out: React.ReactElement[] = [];
  skin.pixels.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const fill = skin.palette[ch as keyof typeof skin.palette];
      if (!fill) continue;
      out.push(
        <rect
          key={`${keyPrefix}${x},${y}`}
          x={dx + x * scale}
          y={dy + y * scale}
          width={scale}
          height={scale}
          fill={fill}
        />,
      );
    }
  });
  return out;
}

/** Natural pixel size of a sprite at a given scale. */
export function spriteSize(scale: number): { w: number; h: number } {
  return { w: SPRITE_W * scale, h: SPRITE_H * scale };
}

/**
 * Draws a skin as a standalone SVG.
 *
 * shapeRendering="crispEdges" is required. Without it the browser antialiases the rect
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
      {skinRects(skin, scale, 0, 0)}
    </svg>
  );
}
