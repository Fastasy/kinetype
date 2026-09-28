import { OPPONENT_SKIN_ID, SPRITE_H, SPRITE_SCALE, SPRITE_W, skinById } from "@/game/skins";
import { skinPaths } from "./SkinSprite";

/**
 * A static frame of the game, drawn as ONE SVG.
 *
 * WHY NOT THE REAL CANVAS: the landing page must not boot a game engine, or a visitor who
 * never presses Play still pays for a physics loop, an audio context and a
 * requestAnimationFrame.
 *
 * WHY PATHS AND NOT RECTS: the first version emitted a <rect> per pixel per platform tile,
 * which came to 1332 DOM nodes on the landing page. Measured: first contentful paint was
 * 1856ms against 380ms for the game page. Everything blocky here is merged into a handful
 * of paths per colour instead.
 *
 * One SVG with a fixed 1280x720 viewBox, so it scales to any container without the
 * sprites drifting out of proportion.
 */

const SKY = ["#cfe9f7", "#bfe0f2", "#add4ea"];
const HILL = "#9fc6a8";
const HILL_ALT = "#8fbb99";
const GRASS = "#6fbf5f";
const GRASS_LIP = "#4e9a44";
const DIRT_SHADES = ["#b07a4e", "#a87448", "#b87f52"];
const INK = "#2a2118";
const TILE = 20;

const CHIPS = [
  { tier: "LIGHT", word: "dash" },
  { tier: "MID", word: "planet" },
  { tier: "HEAVY", word: "keyboard" },
];

/** rect as a path segment. */
const seg = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y}h${w}v${h}h${-w}z`;

/**
 * Three shade buckets rather than continuous variation: it keeps the blocky texture of the
 * canvas without needing a separate element per tile.
 */
function Platform({ x, y, w }: { x: number; y: number; w: number }) {
  const cols = Math.ceil(w / TILE);
  const dirt: string[][] = [[], [], []];
  const grass: string[] = [];
  const lip: string[] = [];

  for (let c = 0; c < cols; c++) {
    for (let r = 1; r <= 3; r++) {
      dirt[(c + r) % 3].push(seg(x + c * TILE, y + r * TILE, TILE, TILE));
    }
    grass.push(seg(x + c * TILE, y, TILE, TILE - 6));
    lip.push(seg(x + c * TILE, y + TILE - 6, TILE, 6));
  }

  return (
    <g>
      {dirt.map((segs, i) => (
        <path key={i} d={segs.join("")} fill={DIRT_SHADES[i]} />
      ))}
      <path d={grass.join("")} fill={GRASS} />
      <path d={lip.join("")} fill={GRASS_LIP} />
      <rect
        x={x + 1}
        y={y + 1}
        width={w - 2}
        height={TILE * 4 - 2}
        fill="none"
        stroke={INK}
        strokeWidth={2}
      />
    </g>
  );
}

export default function ArenaTeaser({ className }: { className?: string }) {
  const left = skinById("spark");
  const right = skinById(OPPONENT_SKIN_ID);

  // Same scale the canvas draws at, so the teaser cannot misrepresent the fighters.
  const S = SPRITE_SCALE;
  const halfW = (SPRITE_W * S) / 2;
  const spriteTop = 560 - SPRITE_H * S;

  // Two alternating bands of hills, merged into one path each.
  const hills = [[], []] as string[][];
  for (let i = 0; i < 22; i++) {
    hills[i % 2].push(seg(i * 60, 500 + (i % 2) * 24, 60, 220));
  }

  // Blast lines: dashes merged per line.
  const blast = (x: number) =>
    Array.from({ length: 22 })
      .map((_, i) => seg(x, i * 34 + 10, 6, 20))
      .join("");

  return (
    <svg
      viewBox="0 0 1280 720"
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="A match in progress: two pixel fighters stand on a grass platform, with three word prompts at the bottom reading dash, planet and keyboard."
    >
      {SKY.map((c, i) => (
        <rect key={c} x={0} y={i * 240} width={1280} height={241} fill={c} />
      ))}

      <path d={hills[0].join("")} fill={HILL} />
      <path d={hills[1].join("")} fill={HILL_ALT} />

      <g opacity={0.5}>
        <path d={blast(44)} fill="#be123c" />
        <path d={blast(1236)} fill="#be123c" />
      </g>

      <Platform x={236} y={428} w={168} />
      <Platform x={876} y={428} w={168} />
      <Platform x={340} y={560} w={600} />

      <g>{skinPaths(left, S, 520 - halfW, spriteTop, "L")}</g>
      <g>{skinPaths(right, S, 820 - halfW, spriteTop, "R")}</g>

      {/* Damage readouts, outlined so every colour reads on a light sky. */}
      <text
        x={520}
        y={spriteTop - 16}
        textAnchor="middle"
        fontSize={26}
        fontWeight={700}
        fontFamily="ui-monospace, monospace"
        stroke="#ffffff"
        strokeWidth={6}
        paintOrder="stroke"
        fill="#4e9a44"
      >
        12%
      </text>
      <text
        x={820}
        y={spriteTop - 16}
        textAnchor="middle"
        fontSize={26}
        fontWeight={700}
        fontFamily="ui-monospace, monospace"
        stroke="#ffffff"
        strokeWidth={6}
        paintOrder="stroke"
        fill="#b45309"
      >
        38%
      </text>

      {/* The prompt panel, shown as part of the frame so the mechanic is legible at a
          glance before anyone plays. */}
      {CHIPS.map((c, i) => {
        const w = 240;
        const gap = 16;
        const totalW = CHIPS.length * w + (CHIPS.length - 1) * gap;
        const x = (1280 - totalW) / 2 + i * (w + gap);
        return (
          <g key={c.tier}>
            <rect x={x} y={636} width={w} height={64} fill="#fffdf7" stroke={INK} strokeWidth={4} />
            <text
              x={x + 16}
              y={666}
              fontSize={16}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              fill="#6f6656"
            >
              {c.tier}
            </text>
            <text
              x={x + 16}
              y={690}
              fontSize={24}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              fill="#1e1a14"
            >
              {c.word}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
