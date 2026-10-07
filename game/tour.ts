// The first-visit tour.
//
// WHY THIS EXISTS. The landing page explains Kinetype well, and the front door is still a wall:
// six nav destinations, a coin balance, a boss campaign, a shop, and a fight with its own
// vocabulary (chain, parry, blast line, SAVE word). A visitor who does not read the marketing
// copy has no idea what to click first. This points at each piece, in the order a new player
// needs them, and then gets out of the way.
//
// FRAMEWORK-FREE, like everything else in `game/`: no react, no next, no DOM. The overlay
// component renders this data, the store owns whether it has been seen, and the test suite
// asserts the shape of both. The callout ARITHMETIC lives here too, as a pure function, for the
// same reason the recovery window does: it is the part that can be wrong without looking wrong,
// and it is the part a unit test can pin down.
//
// WHAT IT IS NOT. It grants nothing. No coins, no XP, no ownership — so there is no RPC, no
// migration and no anti-cheat surface here. The seen flag is a UI preference on one browser, and
// deliberately NOT part of the save wallet (see game/tour-store.ts).

/** Which edge of the target the callout prefers to sit on. */
export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  /** Stable id. The overlay keys off it and the probe addresses steps by it. */
  id: string;
  /** The route this step's target lives on. The overlay navigates when it differs. */
  route: string;
  /**
   * `data-tour` value of the element to spotlight, or null to centre the callout with no
   * spotlight. A target that never appears degrades to a centred callout rather than a hole in
   * the tour — the copy is the payload, the arrow is the polish.
   */
  target: string | null;
  title: string;
  body: string;
  placement: TourPlacement;
}

/**
 * The tour, start to finish.
 *
 * ORDER AND SCOPE ARE DELIBERATE. It runs on the front door and then inside the arena, which is
 * every section a new player must pass through to play. The Campaign, Leaderboard and shop are
 * NAMED in step 2 rather than visited, because each one costs a page load and a step, and a
 * first-visit tour that outlives a minute gets skipped rather than read. Extending it to those
 * pages is a one-line change per step (add the route + a target that always renders) — the
 * engine already handles it.
 *
 * Every target below is an element that exists BEFORE a match starts. That constraint is not
 * cosmetic: the bot panel, the prompt card and the player panel are only mounted while
 * `stage === "fighting"`, so a step pointing at them would have to either start a fight the
 * visitor did not ask for or silently degrade. Neither is acceptable, so the in-fight UI is
 * described in step 7's copy while the arrow points at the arena that will hold it.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    route: "/",
    target: null,
    placement: "center",
    title: "Welcome to Kinetype",
    body:
      "Nine stops and you will know the whole game. Hit Next to walk through it, or press Esc to skip — it only ever shows once.",
  },
  {
    id: "header",
    route: "/",
    target: "site-header",
    placement: "bottom",
    title: "Everything lives up here",
    body:
      "Play is a free match. Campaign is the boss ladder, Leaderboard is the global board, Guides and How to play hold the strategy, and Skins is the shop. Campaign and Leaderboard ask for a free account; nothing else does.",
  },
  {
    id: "coins",
    route: "/",
    target: "nav-coins",
    placement: "bottom",
    title: "Coins are earned, never bought",
    body:
      "Every match pays coins and there is no way to buy them with money. The balance follows you onto every page so you can always see what the shop can afford.",
  },
  {
    id: "play-cta",
    route: "/",
    target: "play-cta",
    placement: "bottom",
    title: "Start here",
    body:
      "One click and you are in the arena. No download, no account, no email — the fight is ready in about two seconds.",
  },
  {
    id: "arena-teaser",
    route: "/",
    target: "arena-teaser",
    placement: "top",
    title: "This is the whole game",
    body:
      "One sentence is live and every word in it is a move. Short words raise a BLOCK, ordinary words PUNCH, long words KICK, and enough of them shove the other fighter past the red line.",
  },
  {
    id: "fight-controls",
    route: "/play",
    target: "fight-controls",
    placement: "bottom",
    title: "Set the fight up",
    body:
      "Pick the bot's speed: start a rung or two slower than you actually type and win on accuracy before you raise it. Strict mistakes staggers you for 0.4s on every typo, so leave it off while you learn. Then hit Fight.",
  },
  {
    id: "fight-arena",
    route: "/play",
    target: "fight-arena",
    placement: "top",
    title: "Where the typing happens",
    body:
      "Your sentence appears here the moment the round starts — and the space between two words is a real key you have to press. Type clean and your CHAIN builds; finish a BLOCK word under a KICK INCOMING and you parry it for a third of the knockback.",
  },
  {
    id: "quest-board",
    route: "/play",
    target: "quest-board",
    placement: "top",
    title: "Quests pay out every day",
    body:
      "Three dailies and two weeklies, a fresh set every day so it cannot be memorised, and each one pays XP and coins. Quests need a free account — sign in from the top right and they start tracking.",
  },
  {
    id: "outro",
    route: "/play",
    target: null,
    placement: "center",
    title: "That is the tour",
    body:
      "Fight whenever you are ready. How to play has the full strategy, the Leaderboard shows what you are chasing, and you can run this tour again any time from Your account.",
  },
] as const;

/**
 * Bump when the STEPS change in a way a returning visitor should see. The seen flag records the
 * version it was set at, so a visitor who dismissed v1 is shown v2 without being shown v1 again.
 */
export const TOUR_VERSION = 1;

/** localStorage key for the seen flag. Separate from the save wallet on purpose. */
export const TOUR_STORAGE_KEY = "kinetype:tour";

/**
 * Routes the tour opens itself on.
 *
 * ONE ROUTE, AND IT IS THE FRONT DOOR. Auto-opening on /play would drop a modal over an arena
 * the visitor is already using, and auto-opening on the SEO landing pages would cover the copy
 * those pages exist to deliver. The tour is still reachable from anywhere — the replay button on
 * Your account, or `?tour=1`.
 */
export const TOUR_AUTO_OPEN_ROUTES: readonly string[] = ["/"];

/** `?tour=1` (or `?tour=any`) forces the tour open. Handy for sharing and for the probe. */
export const TOUR_QUERY_PARAM = "tour";

/** The attribute an element carries to be addressable as a step target. */
export const TOUR_TARGET_ATTR = "data-tour";

// ------------------------------------------------------------------ geometry constants

/** Minimum distance from any viewport edge. */
export const TOUR_MARGIN = 12;
/** Gap between the target's edge and the callout, before the arrow. */
export const TOUR_GAP = 14;
/** Size of the square that becomes the arrow. */
export const TOUR_ARROW = 10;
/** The callout never grows wider than this, so it stays a caption rather than a page. */
export const TOUR_CARD_MAX_WIDTH = 360;

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CalloutLayout {
  /** The placement actually used, after any flip. */
  placement: TourPlacement;
  left: number;
  top: number;
  /** Which edge the arrow rides, and how far along it. Null for a centred callout. */
  arrow: { axis: "x" | "y"; offset: number } | null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function opposite(p: TourPlacement): TourPlacement {
  if (p === "top") return "bottom";
  if (p === "bottom") return "top";
  if (p === "left") return "right";
  if (p === "right") return "left";
  return "center";
}

/** Would a callout of this size fit on this side of the target? */
function fits(
  side: TourPlacement,
  target: Box,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): boolean {
  const vGap = TOUR_MARGIN + TOUR_GAP + TOUR_ARROW;
  if (side === "top") return target.top - vGap >= card.height + TOUR_MARGIN;
  if (side === "bottom") return target.top + target.height + vGap + card.height + TOUR_MARGIN <= viewport.height;
  if (side === "left") return target.left - vGap >= card.width + TOUR_MARGIN;
  if (side === "right") return target.left + target.width + vGap + card.width + TOUR_MARGIN <= viewport.width;
  return true;
}

/**
 * Where the callout goes and where its arrow points.
 *
 * PURE, and the reason it is pure: this is the part of a tour that can be quietly broken. A
 * callout 40px below the fold, or an arrow pointing at nothing because the target sat off the
 * left edge, looks like a design decision rather than a bug. Every branch here returns a
 * position inside the viewport, and the unit test asserts exactly that over a grid of targets
 * and viewport sizes.
 *
 * The preferred side is tried, then the opposite side, then the two perpendicular sides (a
 * wide target — the arena — has no room above or below it on a short viewport, and landing on
 * "left" is still better than overlapping it). Whatever wins is then CLAMPED, so the callout is
 * always fully on screen even when nothing fits.
 *
 * A TARGET BIGGER THAN THE VIEWPORT IS A REAL CASE, not a degenerate one: the quest board and the
 * arena are both taller than a phone screen. For those, no side can fit and the callout lands over
 * part of the target — which is correct, because the alternative is a callout with nowhere to go.
 * What must NOT happen is the arrow pointing at the target's geometric centre, which for a block
 * that runs off the bottom of the screen is a point the visitor cannot see. So the arrow aims at
 * the middle of the target's VISIBLE span, and the arrow is what carries the meaning.
 */
export function placeCallout(args: {
  target: Box | null;
  card: { width: number; height: number };
  viewport: { width: number; height: number };
  placement: TourPlacement;
}): CalloutLayout {
  const { target, card, viewport } = args;
  if (!target || args.placement === "center") {
    return {
      placement: "center",
      left: Math.round((viewport.width - card.width) / 2),
      top: Math.round((viewport.height - card.height) / 2),
      arrow: null,
    };
  }

  const preferred = args.placement;
  const order: TourPlacement[] = [
    preferred,
    opposite(preferred),
    preferred === "top" || preferred === "bottom" ? "right" : "bottom",
    preferred === "top" || preferred === "bottom" ? "left" : "top",
  ];
  const side = order.find((s) => fits(s, target, card, viewport)) ?? preferred;

  const vGap = TOUR_GAP + TOUR_ARROW;
  let left: number;
  let top: number;
  if (side === "top" || side === "bottom") {
    left = Math.round(target.left + target.width / 2 - card.width / 2);
    top = Math.round(side === "top" ? target.top - vGap - card.height : target.top + target.height + vGap);
  } else {
    left = Math.round(side === "left" ? target.left - vGap - card.width : target.left + target.width + vGap);
    top = Math.round(target.top + target.height / 2 - card.height / 2);
  }

  const maxLeft = Math.max(TOUR_MARGIN, viewport.width - card.width - TOUR_MARGIN);
  const maxTop = Math.max(TOUR_MARGIN, viewport.height - card.height - TOUR_MARGIN);
  left = clamp(left, TOUR_MARGIN, maxLeft);
  top = clamp(top, TOUR_MARGIN, maxTop);

  // The arrow rides the callout edge FACING the target. Its position along that edge is the middle
  // of the part of the target the visitor can actually see — which equals the target's own centre
  // for anything that fits on screen, and is the only sane answer for anything that does not. It
  // is then clamped so it can never slide off the callout's corner when the callout has been
  // clamped away from the target.
  const inset = TOUR_ARROW * 2;
  const visibleLeft = clamp(target.left, 0, viewport.width);
  const visibleRight = clamp(target.left + target.width, 0, viewport.width);
  const visibleTop = clamp(target.top, 0, viewport.height);
  const visibleBottom = clamp(target.top + target.height, 0, viewport.height);
  const aimX =
    visibleRight > visibleLeft ? (visibleLeft + visibleRight) / 2 : target.left + target.width / 2;
  const aimY =
    visibleBottom > visibleTop ? (visibleTop + visibleBottom) / 2 : target.top + target.height / 2;
  let arrow: CalloutLayout["arrow"];
  if (side === "top" || side === "bottom") {
    arrow = {
      axis: "x",
      offset: Math.round(clamp(aimX - left, inset, Math.max(inset, card.width - inset))),
    };
  } else {
    arrow = {
      axis: "y",
      offset: Math.round(clamp(aimY - top, inset, Math.max(inset, card.height - inset))),
    };
  }

  return { placement: side, left, top, arrow };
}

// ------------------------------------------------------------------ seen-state

/** What the browser remembers about the tour. */
export interface TourSeen {
  version: number;
  at: string;
}

/** Defensive parse. A corrupt or partial flag is treated as "never seen", which shows the tour. */
export function parseTourSeen(raw: string | null): TourSeen | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.version !== "number" || !Number.isFinite(p.version)) return null;
    return { version: p.version, at: typeof p.at === "string" ? p.at : "" };
  } catch {
    return null;
  }
}

export function serializeTourSeen(seen: TourSeen): string {
  return JSON.stringify(seen);
}

/**
 * Has the visitor already seen THIS version? A seen flag from an older version does not count,
 * which is the whole point of storing the version rather than a boolean.
 */
export function hasSeenTour(seen: TourSeen | null, version: number = TOUR_VERSION): boolean {
  return seen !== null && seen.version >= version;
}

/** `?tour=1` in a search string forces the tour open. Empty value (`?tour=`) still forces. */
export function forcedBySearch(search: string): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.has(TOUR_QUERY_PARAM);
}

/** Is this a route the tour is allowed to open itself on? */
export function isAutoOpenRoute(pathname: string): boolean {
  return TOUR_AUTO_OPEN_ROUTES.includes(pathname);
}

/** Whether the tour should open itself on this route for a visitor who has not seen it. */
export function shouldAutoOpen(pathname: string, seen: TourSeen | null): boolean {
  if (hasSeenTour(seen)) return false;
  return isAutoOpenRoute(pathname);
}

// ------------------------------------------------------------------ step index

export function clampIndex(index: number, steps: readonly TourStep[] = TOUR_STEPS): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(steps.length - 1, Math.trunc(index)));
}

export function isLastStep(index: number, steps: readonly TourStep[] = TOUR_STEPS): boolean {
  return clampIndex(index, steps) >= steps.length - 1;
}

/** 1-based position and total, for the "3 of 9" readout. */
export function stepPosition(index: number, steps: readonly TourStep[] = TOUR_STEPS): { at: number; of: number } {
  return { at: clampIndex(index, steps) + 1, of: steps.length };
}

/** The selector the overlay queries for a step's target. */
export function targetSelector(target: string): string {
  return `[${TOUR_TARGET_ATTR}="${target}"]`;
}
