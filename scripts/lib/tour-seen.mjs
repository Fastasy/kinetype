// "I have already seen the tour."
//
// The first-visit tour auto-opens on `/` for any browser that has not seen it, and its overlay
// deliberately swallows every pointer event so a visitor cannot navigate out from under a running
// tour. That is correct behaviour and it means every existing browser probe that CLICKS something on
// the landing page now has a dim layer between it and the element — `verify-browser.mjs` failed on
// exactly that, with Playwright reporting the tour's click-catcher as the thing intercepting its
// click on `play-cta`.
//
// So a probe that is testing something else needs a supported way to say it is not a first-time
// visitor. That is what this is: an init script on the context, applied before any page loads, that
// writes the seen flag.
//
// THE VERSION IS DELIBERATELY ENORMOUS. `hasSeenTour` treats a stored version at or above the
// current one as seen, so one sentinel keeps every probe suppressed for every future version of the
// tour. A probe pinned to `version: 1` would start meeting the tour again the first time the tour
// was revised, and the failure would look like a product bug rather than a stale probe.
//
// Usage:
//
//   import { suppressTour } from "./lib/tour-seen.mjs";
//   const context = await browser.newContext(...);
//   await suppressTour(context);        // before the first goto
//
// `scripts/probe-tour.mjs` does NOT use this — a probe whose whole job is the tour has to be a
// genuine first-time visitor, so it takes a fresh context and touches nothing.

export const TOUR_SUPPRESSED = Object.freeze({ version: Number.MAX_SAFE_INTEGER, at: "probe" });

/**
 * Mark the tour as seen for every page this context will ever open.
 * @param {import("playwright").BrowserContext} context
 */
export async function suppressTour(context) {
  await context.addInitScript((raw) => {
    try {
      window.localStorage.setItem("kinetype:tour", raw);
    } catch {
      // Private mode. The probe will meet the tour; that is the same failure a real visitor would
      // have, so it is not swallowed further.
    }
  }, JSON.stringify(TOUR_SUPPRESSED));
}
