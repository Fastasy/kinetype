import { SPRITE_H, SPRITE_W, type PixelSkin } from "@/game/skins";

/**
 * Draws a skin as SVG.
 *
 * This is the shop's view of the exact same pixel matrix the canvas blits, so a
 * skin can never look one way in the shop and another way in a fight. Deliberately
 * a server-safe component: no hooks, no state, no client bundle cost.
 *
 * shapeRendering="crispEdges" is required. Without it the browser antialiases the
 * rect seams and the pixel grid goes soft.
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
 const rows = skin.pixels;
 const w = SPRITE_W * scale;
 const h = SPRITE_H * scale;

 const rects = [];
 for (let y = 0; y < rows.length; y++) {
 const row = rows[y];
 for (let x = 0; x < row.length; x++) {
 const ch = row[x];
 if (ch === ".") continue;
 const fill = skin.palette[ch as keyof typeof skin.palette];
 if (!fill) continue;
 rects.push(
 <rect
 key={`${x},${y}`}
 x={x * scale}
 y={y * scale}
 width={scale}
 height={scale}
 fill={fill}
 />,
 );
 }
 }

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
 {rects}
 </svg>
 );
}
