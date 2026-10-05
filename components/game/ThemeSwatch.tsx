import type { Theme } from "@/game/themes";

/**
 * A miniature of the WEBSITE in a given theme, for the shop and the profile.
 *
 * It used to be a miniature of the arena (sky, hills, platform, a fighter), which was right when a
 * theme WAS the arena. The arena belongs to the boss now (game/maps.ts), and what a player is
 * actually buying is how the site looks — so the preview shows exactly that: the page, a nav bar, a
 * card with a heading and body copy, an accent button, and the prompt card the game renders inside
 * the site.
 *
 * Drawn from the theme's own tokens rather than a screenshot, so a preview can never disagree with
 * the real thing.
 */
export default function ThemeSwatch({ theme }: { theme: Theme }) {
  return (
    <svg
      viewBox="0 0 160 100"
      shapeRendering="crispEdges"
      className="h-24 w-full"
      role="img"
      aria-label={`${theme.name} theme preview`}
      data-testid="theme-swatch"
      data-theme={theme.id}
    >
      {/* The page itself. */}
      <rect x={0} y={0} width={160} height={100} fill={theme.page} />

      {/* Top bar: a wordmark chip and three nav items. */}
      <rect x={0} y={0} width={160} height={13} fill={theme.surface} />
      <rect x={0} y={12} width={160} height={1} fill={theme.border} />
      <rect x={7} y={4} width={24} height={5} fill={theme.accent} />
      <rect x={98} y={5} width={16} height={3} fill={theme.textMuted} />
      <rect x={120} y={5} width={16} height={3} fill={theme.textMuted} />
      <rect x={142} y={5} width={11} height={3} fill={theme.textMuted} />

      {/* A content card: heading, body copy, and an accent button. */}
      <rect x={10} y={23} width={84} height={48} fill={theme.surface} stroke={theme.border} strokeWidth={2} />
      <rect x={18} y={32} width={46} height={7} fill={theme.text} />
      <rect x={18} y={45} width={64} height={3} fill={theme.textMuted} />
      <rect x={18} y={51} width={56} height={3} fill={theme.textMuted} />
      <rect x={18} y={57} width={60} height={3} fill={theme.textMuted} />
      <rect x={18} y={63} width={30} height={9} fill={theme.accent} />
      <rect x={22} y={66} width={22} height={3} fill={theme.onAccent} />

      {/* The game's prompt card, which is part of the site and follows the theme too. */}
      <rect x={104} y={23} width={46} height={48} fill={theme.promptBg} stroke={theme.promptBorder} strokeWidth={2} />
      <rect x={110} y={33} width={32} height={4} fill={theme.promptActive} />
      <rect x={110} y={42} width={28} height={4} fill={theme.text} />
      <rect x={110} y={51} width={34} height={4} fill={theme.textMuted} />
      <rect x={110} y={60} width={20} height={4} fill={theme.textMuted} />
    </svg>
  );
}
