import { OPPONENT_SKIN_ID, SPRITE_H, SPRITE_SCALE, SPRITE_W, skinById } from "@/game/skins";
import { skinRects } from "./SkinSprite";

/**
 * A static frame of the game, drawn as one SVG.
 *
 * WHY NOT THE REAL CANVAS: the landing page must not boot a second game engine, or a
 * visitor who never presses Play still pays for a physics loop, an audio context and a
 * requestAnimationFrame. This is the same pixel vocabulary as the game (same sprites,
 * same palette, same blocky platforms) with none of the runtime.
 *
 * One SVG with a fixed 1280x720 viewBox rather than absolutely-positioned divs, so it
 * scales to any container without the sprites drifting out of proportion.
 */

const SKY = ["#cfe9f7", "#bfe0f2", "#add4ea"];
const HILL = "#9fc6a8";
const HILL_ALT = "#8fbb99";
const GRASS = "#6fbf5f";
const GRASS_LIP = "#4e9a44";
const DIRT = "#b07a4e";
const DIRT_DARK = "#8e5f3a";
const INK = "#2a2118";
const TILE = 20;

const CHIPS = [
  { tier: "LIGHT", word: "dash" },
  { tier: "MID", word: "planet" },
  { tier: "HEAVY", word: "keyboard" },
];

function shade(hex: string, mul: number): string {
  const r = Math.round(Math.min(255, parseInt(hex.slice(1, 3), 16) * mul));
  const g = Math.round(Math.min(255, parseInt(hex.slice(3, 5), 16) * mul));
  const b = Math.round(Math.min(255, parseInt(hex.slice(5, 7), 16) * mul));
  return `rgb(${r},${g},${b})`;
}

function tileShade(x: number, y: number): number {
  const n = (x * 73856093) ^ (y * 19349663);
  return 0.92 + ((n >>> 3) % 17) / 100;
}

function Platform({ x, y, w }: { x: number; y: number; w: number }) {
  const cols = Math.ceil(w / TILE);
  const blocks = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 1; r <= 3; r++) {
      blocks.push(
        <rect
          key={`d${c}-${r}`}
          x={x + c * TILE}
          y={y + r * TILE}
          width={TILE}
          height={TILE}
          fill={shade(r === 1 ? DIRT : DIRT_DARK, tileShade(c, r))}
        />,
      );
    }
    blocks.push(
      <rect
        key={`g${c}`}
        x={x + c * TILE}
        y={y}
        width={TILE}
        height={TILE - 6}
        fill={shade(GRASS, tileShade(c, 0))}
      />,
      <rect
        key={`l${c}`}
        x={x + c * TILE}
        y={y + TILE - 6}
        width={TILE}
        height={6}
        fill={GRASS_LIP}
      />,
    );
  }
  return (
    <g>
      {blocks}
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

  // Feet on the platform surface at y=560, so the sprites stand on it exactly as they
  // do in the game.
  const spriteTop = 560 - SPRITE_H * S;

  return (
    <svg
      viewBox="0 0 1280 720"
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="A match in progress: two pixel fighters stand on a grass platform, with three word prompts at the bottom reading dash, planet and keyboard."
    >
      {SKY.map((c, i) => (
        <rect key={c} x={0} y={i * 240} width={1280} height={240} fill={c} />
      ))}

      {Array.from({ length: 22 }).map((_, i) => (
        <rect
          key={`h${i}`}
          x={i * 60}
          y={500 + (i % 2) * 24}
          width={60}
          height={720}
          fill={i % 2 === 0 ? HILL : HILL_ALT}
        />
      ))}

      {/* Blast lines, dashed exactly as the game draws them. */}
      {[44, 1236].map((x) => (
        <g key={x}>
          {Array.from({ length: 22 }).map((_, i) => (
            <rect key={i} x={x} y={i * 34 + 10} width={6} height={20} fill="#be123c" opacity={0.5} />
          ))}
        </g>
      ))}

      <Platform x={236} y={428} w={168} />
      <Platform x={876} y={428} w={168} />
      <Platform x={340} y={560} w={600} />

      <g>{skinRects(left, S, 520 - halfW, spriteTop, "L")}</g>
      <g>{skinRects(right, S, 820 - halfW, spriteTop, "R")}</g>

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
