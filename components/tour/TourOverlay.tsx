"use client";

// The first-visit tour, as an overlay.
//
// WHAT IT DRAWS. A dim over the whole viewport with a hole punched over the target, a callout
// beside it, and a square arrow on the callout edge facing the target. Everything is rectangles
// and one 45°-rotated square: the site ships no image assets and the tour is not going to be the
// first exception.
//
// WHERE THE NUMBERS COME FROM. All of the geometry is `placeCallout` in game/tour.ts, which is
// pure and unit-tested over a grid of targets and viewports. This file measures, decides when to
// wait, and renders — it does no arithmetic of its own, so a callout cannot end up off-screen
// because of a change here.
//
// HYDRATION. The store's server snapshot says "seen", so the first paint is closed on both sides
// and the tour opens one client render later. That is deliberate: reading localStorage during
// render is the hydration mismatch this repo has already been bitten by, and every probe fails on
// a hydration warning.
//
// STATE. There is exactly one piece of component state — the measured geometry — and it is written
// from inside `requestAnimationFrame` callbacks, never from an effect body, because React 19's
// `set-state-in-effect` rule rejects the latter. FightClient established that pattern; this copies
// it. The geometry is tagged with the step id it belongs to, so a step change can never render the
// previous step's position and no effect is needed to clear it.
//
// THE KEYBOARD. Listeners are registered in the CAPTURE phase and the tour swallows every key
// while it is open. That is not politeness: FightClient listens on `window` for keydown and treats
// Escape as "quit the match" and every arrow as "do not scroll", so a bubble-phase tour would quit
// the fight the visitor was reading about.
//
// WHEN THE TARGET IS MISSING. A step whose element never appears degrades to a centred callout
// carrying the same copy. The explanation is the payload and the arrow is the polish — a tour that
// silently skips a step is a tour that silently teaches nothing.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  TOUR_ARROW,
  TOUR_CARD_MAX_WIDTH,
  TOUR_MARGIN,
  TOUR_STEPS,
  clampIndex,
  isAutoOpenRoute,
  isLastStep,
  placeCallout,
  stepPosition,
  targetSelector,
  type Box,
  type CalloutLayout,
  type TourPlacement,
} from "@/game/tour";
import { tourStore } from "@/game/tour-store";

/**
 * Frames to keep looking for a target before giving up and centring the callout. ~1.5s, which
 * covers a client-side navigation landing plus a panel that mounts a moment later.
 */
const FIND_FRAMES = 90;
/**
 * Frames to keep sampling once the target is found. The target is scrolled into view and a SMOOTH
 * scroll means the rect keeps moving for a few hundred milliseconds, so the spotlight has to
 * follow it rather than be measured once and left behind.
 */
const SAMPLE_FRAMES = 60;
/** Consecutive identical frames that mean the target has stopped moving. */
const STABLE_FRAMES = 3;
/** How far the arrow's rotated square pokes out of the callout's edge. */
const ARROW_OVERHANG = 6;

interface Measured {
  /** The step this geometry belongs to. Stale geometry is simply not rendered. */
  stepId: string;
  spotlight: Box | null;
  layout: CalloutLayout;
}

function reduceMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Is this element actually on screen? A nav collapsed behind a hamburger is not a target. */
function onScreen(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** The callout's own size, read from the DOM after it has been committed. */
function cardSize(card: HTMLElement | null): { width: number; height: number } {
  if (!card) return { width: TOUR_CARD_MAX_WIDTH, height: 180 };
  return { width: card.offsetWidth, height: card.offsetHeight };
}

function viewport(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight };
}

function centred(card: HTMLElement | null): Measured["layout"] {
  return placeCallout({ target: null, card: cardSize(card), viewport: viewport(), placement: "center" });
}

/** The rotated square's point direction: top-left corner, turned clockwise. */
function arrowRotation(placement: TourPlacement): string {
  if (placement === "bottom") return "rotate(45deg)";
  if (placement === "top") return "rotate(225deg)";
  if (placement === "left") return "rotate(135deg)";
  return "rotate(315deg)";
}

export default function TourOverlay() {
  const state = useSyncExternalStore(
    tourStore.subscribe,
    tourStore.getSnapshot,
    tourStore.getServerSnapshot,
  );
  const pathname = usePathname();
  const router = useRouter();

  const index = clampIndex(state.index);
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0];
  // Openness is DERIVED, in three terms: a replay asked for from Your account, a tour that has
  // already begun, or a visitor who has never seen this version arriving at the front door. There
  // is no open/close state to fall out of sync with the route.
  //
  // The `started` term is load-bearing: the tour walks the visitor from the front door into /play,
  // so "the current route is the auto-open route" stops being true halfway through. Without it the
  // overlay closed itself on step 6 — which the probe caught as a missing overlay after the
  // navigation, and which no amount of staring at the step list would have found.
  const open = state.replay || state.started || (!state.seen && isAutoOpenRoute(pathname));
  const onRoute = step.route === pathname;

  const [measured, setMeasured] = useState<Measured | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const stepId = step.id;
  const stepTarget = step.target;
  const stepPlacement = step.placement;

  // -------------------------------------------------------------- navigation
  // The moment it is open, the tour is running — see the `started` term above. Declared BEFORE the
  // navigation effect so the flag is set in the same commit that pushes the first route change.
  useEffect(() => {
    if (open) tourStore.begin();
  }, [open]);

  // A step that lives on another route takes the visitor there. Back does the same in reverse,
  // because the step is the only input and this effect runs on every change.
  useEffect(() => {
    if (!open || onRoute) return;
    router.push(step.route);
  }, [open, onRoute, step.route, router]);

  // -------------------------------------------------------------- measuring
  useEffect(() => {
    if (!open || !onRoute) return;
    let cancelled = false;
    let raf = 0;
    let frames = 0;
    let stable = 0;
    let lastKey = "";
    let scrolled = false;

    const settle = (spotlight: Box | null, layout: CalloutLayout) => {
      setMeasured({ stepId, spotlight, layout });
    };

    const measure = () => {
      if (cancelled) return;

      // A centred step needs no DOM at all, so it settles on the first frame.
      if (stepTarget === null) {
        settle(null, centred(cardRef.current));
        return;
      }

      const el = document.querySelector<HTMLElement>(targetSelector(stepTarget));
      if (el && !onScreen(el)) {
        // Rendered but hidden — a nav behind a hamburger on a phone, typically. It will not become
        // visible by waiting, so the step centres now rather than stalling for the full budget.
        settle(null, centred(cardRef.current));
        return;
      }
      if (!el) {
        // Absent is different: a route change or a lazily mounted panel is still on its way, so
        // this waits. After the budget the target is treated as missing and the callout centres,
        // carrying the same copy.
        if (frames < FIND_FRAMES) {
          frames++;
          raf = window.requestAnimationFrame(measure);
          return;
        }
        settle(null, centred(cardRef.current));
        return;
      }

      if (!scrolled) {
        scrolled = true;
        el.scrollIntoView({
          block: "center",
          inline: "center",
          behavior: reduceMotion() ? "auto" : "smooth",
        });
      }

      const box = boxOf(el);
      const key = `${Math.round(box.top)}|${Math.round(box.left)}|${Math.round(box.width)}|${Math.round(box.height)}`;
      stable = key === lastKey ? stable + 1 : 0;
      lastKey = key;

      settle(
        box,
        placeCallout({
          target: box,
          card: cardSize(cardRef.current),
          viewport: viewport(),
          placement: stepPlacement,
        }),
      );

      if (stable < STABLE_FRAMES && frames < SAMPLE_FRAMES) {
        frames++;
        raf = window.requestAnimationFrame(measure);
      }
    };

    raf = window.requestAnimationFrame(measure);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [open, onRoute, stepId, stepTarget, stepPlacement]);

  // A resize re-measures once, immediately. The mobile probe depends on this: the callout has to
  // still be on screen after the viewport changes under it.
  useEffect(() => {
    if (!open || !onRoute) return;
    let raf = 0;
    const onResize = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const el = stepTarget ? document.querySelector<HTMLElement>(targetSelector(stepTarget)) : null;
        if (stepTarget && (!el || !onScreen(el))) return;
        const box = el ? boxOf(el) : null;
        setMeasured({
          stepId,
          spotlight: box,
          layout: placeCallout({
            target: box,
            card: cardSize(cardRef.current),
            viewport: viewport(),
            placement: box ? stepPlacement : "center",
          }),
        });
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [open, onRoute, stepId, stepTarget, stepPlacement]);

  // -------------------------------------------------------------- keyboard
  const close = useCallback(() => tourStore.close(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        tourStore.next();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        tourStore.prev();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const items = Array.from(
          cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [],
        );
        if (!items.length) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        const to = e.shiftKey ? (at - 1 + items.length) % items.length : (at + 1) % items.length;
        items[to]?.focus();
        return;
      }
      // Everything else belongs to the tour while it is open, so a space bar pressed on a page the
      // visitor is only reading cannot land on the fight behind it.
      if (!e.metaKey && !e.ctrlKey && !e.altKey) e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  // -------------------------------------------------------------- focus and scroll lock
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;
    restoreFocus.current = before instanceof HTMLElement && before !== document.body ? before : null;
    return () => {
      const back = restoreFocus.current;
      restoreFocus.current = null;
      if (back?.isConnected) back.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => cardRef.current?.focus());
    return () => window.cancelAnimationFrame(raf);
  }, [open, stepId]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const previous = body.style.overflow;
    // The tour scrolls its own target into view. `overflow: hidden` stops the visitor wandering off
    // mid-step, and programmatic scrolling still works — which is exactly why this is not the usual
    // position:fixed body lock.
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const live = measured && measured.stepId === stepId ? measured : null;
  const layout = live?.layout ?? null;
  const spotlight = live?.spotlight ?? null;
  const position = stepPosition(index);
  const last = isLastStep(index);
  const placement: TourPlacement = layout?.placement ?? stepPlacement;

  let arrow: { style: CSSProperties; rotation: string } | null = null;
  if (live && spotlight && layout?.arrow) {
    const along = layout.arrow.offset - TOUR_ARROW / 2;
    const pos: CSSProperties =
      placement === "bottom"
        ? { top: -ARROW_OVERHANG, left: along }
        : placement === "top"
          ? { bottom: -ARROW_OVERHANG, left: along }
          : placement === "left"
            ? { right: -ARROW_OVERHANG, top: along }
            : { left: -ARROW_OVERHANG, top: along };
    arrow = { style: pos, rotation: arrowRotation(placement) };
  }

  return (
    <div
      data-testid="tour"
      data-step={stepId}
      data-target={stepTarget ?? ""}
      data-index={index}
      data-placement={placement}
      data-spotlight={spotlight ? "1" : "0"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-[80]"
    >
      {onRoute && spotlight ? (
        <div
          aria-hidden="true"
          data-testid="tour-spotlight"
          className="absolute border-2"
          style={{
            top: spotlight.top - 4,
            left: spotlight.left - 4,
            width: spotlight.width + 8,
            height: spotlight.height + 8,
            borderColor: "var(--color-brand)",
            // One element, one hole: the shadow paints everything except the spotlight. Cheaper
            // and crisper than four dim rectangles, and it cannot leave a seam at the corners.
            boxShadow: "0 0 0 9999px rgba(30, 26, 20, 0.74)",
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          data-testid="tour-dim"
          className="absolute inset-0"
          style={{ background: "rgba(30, 26, 20, 0.74)" }}
        />
      )}

      {/* The tour owns the pointer while it is open: a click goes nowhere, so the page cannot be
          navigated out from under a running tour. Keyboard users get Tab trapped in the callout. */}
      <div aria-hidden="true" className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {onRoute && (
        <div
          className="absolute z-10"
          style={{
            left: layout?.left ?? 0,
            top: layout?.top ?? 0,
            width: `min(${TOUR_CARD_MAX_WIDTH}px, calc(100vw - ${TOUR_MARGIN * 2}px))`,
            // Held invisible for the frame or two before the first measurement, so the callout
            // never flashes at (0,0).
            opacity: layout ? 1 : 0,
          }}
        >
          {arrow && (
            <span
              aria-hidden="true"
              data-testid="tour-arrow"
              className="absolute h-[10px] w-[10px] border-t-2 border-l-2 bg-card"
              style={{ ...arrow.style, transform: arrow.rotation, borderColor: "var(--color-line-strong)" }}
            />
          )}

          <div
            key={stepId}
            ref={cardRef}
            tabIndex={-1}
            data-testid="tour-card"
            data-step-card={stepId}
            className="kt-pop max-h-[calc(100vh-24px)] overflow-y-auto border-2 border-line-strong bg-card text-ink outline-none"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <span className="font-mono text-[10px] font-bold tracking-widest text-ink-faint">
                STEP <span data-testid="tour-position">{position.at}</span> OF {position.of}
              </span>
              <button
                type="button"
                data-testid="tour-skip"
                onClick={close}
                className="font-mono text-[10px] font-bold text-ink-faint underline underline-offset-2 transition hover:text-ink"
              >
                SKIP TOUR
              </button>
            </div>

            <div className="px-4 py-3">
              <h2 id="tour-title" data-testid="tour-title" className="font-pixel text-xs text-ink">
                {step.title}
              </h2>
              <p data-testid="tour-body" className="mt-2 text-sm leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
              <button
                type="button"
                data-testid="tour-back"
                onClick={() => tourStore.prev()}
                disabled={index === 0}
                className="border-2 border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-ink-soft"
              >
                Back
              </button>
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {TOUR_STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className="h-1.5 w-1.5"
                    style={{ background: i === index ? "var(--color-brand)" : "var(--color-line-strong)" }}
                  />
                ))}
              </div>
              <button
                type="button"
                data-testid="tour-next"
                onClick={() => tourStore.next()}
                className="border-2 border-brand bg-brand px-4 py-1.5 font-pixel text-[10px] text-brand-deep transition hover:bg-brand-bright"
              >
                {last ? "DONE" : "NEXT"}
              </button>
            </div>
          </div>
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {`Step ${position.at} of ${position.of}: ${step.title}`}
      </span>
    </div>
  );
}
