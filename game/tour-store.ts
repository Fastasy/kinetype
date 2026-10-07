// The tour, as an external store.
//
// Same shape as game/store.ts, for the same two reasons:
//
//   1. Reading localStorage during render would make the server and client markup disagree,
//      which is a hydration mismatch, and a mismatch is a real bug on a page with a modal on it.
//      `useSyncExternalStore` renders the server snapshot first and re-renders with the real
//      value, which is exactly the "appears on the first visit, without flashing" behaviour this
//      feature wants.
//   2. React 19's `react-hooks/set-state-in-effect` rule rejects the effect-based workaround, and
//      the tour has no other state worth owning.
//
// OPENNESS IS DERIVED, NOT STORED. The visitor's `seen` flag, an in-memory `replay` request from
// the settings button, and the current route are enough to answer "is it open?" — so there is no
// `useState`, no open/close race with the route, and nothing to reset when the component
// remounts on navigation.
//
// WHY THE FLAG IS NOT IN THE SAVE WALLET. SaveData is parked and restored around sign-in
// (storage.ts's guest wallet). A tour flag living in there would be rolled back the moment a
// player signed out — they would be shown the first-visit tour again for having the nerve to
// have an account. It is a UI preference about one browser, so it gets its own key.

import {
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
  TOUR_VERSION,
  clampIndex,
  forcedBySearch,
  hasSeenTour,
  isLastStep,
  parseTourSeen,
  serializeTourSeen,
} from "./tour";

export interface TourState {
  /** The browser has seen this version of the tour. */
  seen: boolean;
  /** In-memory only: the visitor asked for it again from Your account. Never persisted. */
  replay: boolean;
  /**
   * In-memory only: the tour has opened and is running.
   *
   * This exists because openness cannot be derived from the route alone. The tour auto-opens on
   * the front door and then WALKS the visitor to /play — and the first version of this closed
   * itself the moment it did, because "/" was no longer the current route. The probe caught it as
   * a null overlay on step 6. `started` is what survives the navigation the tour itself performs.
   */
  started: boolean;
  /** Which step is showing. Lives here so it survives the overlay remounting on navigation. */
  index: number;
}

/**
 * The server's answer, and therefore the answer during hydration: closed. The tour opening is a
 * client decision made one render later, never a difference in the first paint.
 */
const CLOSED: TourState = { seen: true, replay: false, started: false, index: 0 };

let cache: TourState | null = null;
const listeners = new Set<() => void>();

function read(): TourState {
  if (typeof window === "undefined") return CLOSED;
  let seen = false;
  let forced = false;
  try {
    // A seen flag for a PREVIOUS version does not count — that is what the version is for.
    seen = hasSeenTour(parseTourSeen(window.localStorage.getItem(TOUR_STORAGE_KEY)));
    forced = forcedBySearch(window.location.search);
  } catch {
    // Private mode. Showing the tour is the safe direction to fail.
    seen = false;
  }
  return { seen, replay: forced, started: false, index: 0 };
}

/** Cached, because getSnapshot MUST return a stable reference between changes or React loops. */
function getSnapshot(): TourState {
  if (cache === null) cache = read();
  return cache;
}

function getServerSnapshot(): TourState {
  return CLOSED;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function set(next: TourState): void {
  cache = next;
  for (const l of listeners) l();
}

function persistSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      TOUR_STORAGE_KEY,
      serializeTourSeen({ version: TOUR_VERSION, at: new Date().toISOString() }),
    );
  } catch {
    // Quota or private mode. The tour still closes; it just will not remember that it did.
  }
}

export const tourStore = {
  getSnapshot,
  getServerSnapshot,
  subscribe,

  /**
   * The tour has opened. Called by the overlay on the render where it finds itself open, so that
   * walking to another route — which the tour does itself, on purpose — does not close it.
   */
  begin(): void {
    const current = getSnapshot();
    if (current.started) return;
    set({ ...current, started: true });
  },

  /** Next step, or finish the tour if this was the last one. */
  next(): void {
    const current = getSnapshot();
    if (isLastStep(current.index)) {
      tourStore.close();
      return;
    }
    set({ ...current, index: clampIndex(current.index) + 1 });
  },

  /** Previous step. A no-op on the first step rather than a close — Back is not a skip. */
  prev(): void {
    const current = getSnapshot();
    const next = clampIndex(current.index) - 1;
    if (next === current.index) return;
    set({ ...current, index: next });
  },

  /** The visitor finished, skipped or pressed Esc. Record it and close. */
  close(): void {
    persistSeen();
    set({ seen: true, replay: false, started: false, index: 0 });
  },

  /** Your account → "Replay the tour". Does not clear the seen flag; closing it again re-sets it. */
  replay(): void {
    set({ seen: getSnapshot().seen, replay: true, started: true, index: 0 });
  },

  /** Test-only: drop the cache so the next read hits storage again. */
  reset(): void {
    cache = null;
    for (const l of listeners) l();
  },
};

/** Exported for the test harness: the number of steps the index is clamped against. */
export const TOUR_STEP_COUNT = TOUR_STEPS.length;
