"use client";

// "Show me that again."
//
// The tour only ever opens itself once, which is the right default and a dead end for anyone who
// skipped it in a hurry or wants a second look at a step. This is the way back in: it asks the
// store for a replay, and the overlay — mounted at the root — navigates to the first step and runs
// the whole thing again. Deliberately NOT a link to `/?tour=1`: that would throw away the page the
// visitor was on when they asked for it.

import { tourStore } from "@/game/tour-store";

export default function TourReplayButton() {
  return (
    <button
      type="button"
      data-testid="tour-replay"
      onClick={() => tourStore.replay()}
      className="border-2 border-line-strong bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
    >
      Replay the walkthrough
    </button>
  );
}
