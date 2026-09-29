import { skinById } from "@/game/skins";
import type { Theme } from "@/game/themes";
import { skinPaths } from "./SkinSprite";

/**
 * A miniature of the arena in a given theme, for the shop.
 *
 * Drawn from the same sprite renderer the game and the landing page use, so a preview can
 * never show a theme or a fighter the real thing would not.
 */
export default function ThemeSwatch({ theme }: { theme: Theme }) {
  return (
    <svg
      viewBox="0 0 160 100"
      shapeRendering="crispEdges"
      className="h-24 w-full"
      role="img"
      aria-label={`${theme.name} theme preview`}
    >
      {theme.sky.map((c, i) => (
        <rect key={`${theme.id}-sky-${i}`} x={0} y={i * 34} width={160} height={35} fill={c} />
      ))}

      {/* Blocky hills, same stepping idea as the renderer. */}
      <path
        d="M0 64h14v-7h14v7h14v-5h14v5h14v-7h14v7h14v-6h14v6h14v-5h14v5h14v-7h14v7h14v36H0z"
        fill={theme.hill}
      />

      {/* One fighter on the stage, so the swatch shows the theme against a real sprite. */}
      <g transform="translate(46 52)">{skinPaths(skinById("spark"), 2, 0, 0, `${theme.id}-f`)}</g>

      {/* The main platform. */}
      <rect x={16} y={78} width={128} height={5} fill={theme.grass} />
      <rect x={16} y={83} width={128} height={4} fill={theme.grassLip} />
      <rect x={16} y={87} width={128} height={13} fill={theme.dirt} />
      <rect x={16} y={78} width={128} height={22} fill="none" stroke={theme.ink} strokeWidth={2} />

      {/* The prompt card, which is where a theme is felt most. */}
      <rect
        x={40}
        y={16}
        width={80}
        height={18}
        fill={theme.promptBg}
        stroke={theme.promptBorder}
        strokeWidth={2}
      />
      <rect x={45} y={21} width={3} height={9} fill={theme.accent} />
      <rect x={50} y={21} width={7} height={9} fill={theme.accent} />
      <rect x={59} y={21} width={3} height={9} fill={theme.textMuted} />
      <rect x={64} y={21} width={7} height={9} fill={theme.textMuted} />

      {/* Blast lines. */}
      <rect x={4} y={0} width={2} height={100} fill={theme.blast} />
      <rect x={154} y={0} width={2} height={100} fill={theme.blast} />
    </svg>
  );
}
