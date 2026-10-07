// Tour tests. Plain Node, no framework, no browser.
//
// Two things are worth testing here and nothing else is.
//
//   1. THE STEP LIST IS DATA, so a broken step is a broken tour that still typechecks: a
//      duplicate id, a route that does not start with "/", a body too long to fit a callout, or
//      a tour that navigates A → B → A and thrashes the router.
//   2. THE PLACEMENT ARITHMETIC is the part that can be wrong without looking wrong. A callout
//      40px below the fold reads as a design decision, not a bug, so it is pinned by a sweep
//      over a grid of targets, viewports and preferred sides instead of by one happy path.
//
// Run: npx tsx game/tests/tour.test.ts

import assert from "node:assert/strict";

import {
  TOUR_ARROW,
  TOUR_AUTO_OPEN_ROUTES,
  TOUR_CARD_MAX_WIDTH,
  TOUR_GAP,
  TOUR_MARGIN,
  TOUR_QUERY_PARAM,
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
  TOUR_TARGET_ATTR,
  TOUR_VERSION,
  clampIndex,
  forcedBySearch,
  hasSeenTour,
  isAutoOpenRoute,
  isLastStep,
  parseTourSeen,
  placeCallout,
  serializeTourSeen,
  shouldAutoOpen,
  stepPosition,
  targetSelector,
  type Box,
  type TourPlacement,
} from "../tour";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  FAIL ${name}\n       ${msg.split("\n")[0]}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ================================================================== the step list

section("the step list");

test("every id is unique and slug-shaped", () => {
  const ids = TOUR_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate step id in ${ids.join(", ")}`);
  for (const id of ids) {
    assert.match(id, /^[a-z0-9-]+$/, `step id "${id}" must be a lowercase slug`);
  }
});

test("every step carries a title and copy that fits a callout", () => {
  for (const s of TOUR_STEPS) {
    assert.ok(s.title.trim().length > 0, `${s.id} has no title`);
    assert.ok(s.title.length <= 48, `${s.id} title is ${s.title.length} chars; keep it to 48`);
    assert.ok(s.body.trim().length >= 30, `${s.id} body is too thin to explain anything`);
    // The callout is a caption, not a page. Two sentences, three at the very most.
    assert.ok(s.body.length <= 260, `${s.id} body is ${s.body.length} chars; cap is 260`);
  }
});

test("every route is absolute and the target is a slug or null", () => {
  for (const s of TOUR_STEPS) {
    assert.ok(s.route.startsWith("/"), `${s.id} route "${s.route}" must start with /`);
    if (s.target !== null) {
      assert.match(s.target, /^[a-z0-9-]+$/, `${s.id} target "${s.target}" must be a slug`);
    }
  }
});

test("a step is either centred or pointing at something, never both", () => {
  for (const s of TOUR_STEPS) {
    if (s.target === null) {
      assert.equal(s.placement, "center", `${s.id} has no target, so its placement must be center`);
    } else {
      assert.notEqual(s.placement, "center", `${s.id} has a target, so its placement cannot be center`);
    }
  }
});

test("the tour opens with a centred welcome and closes with a centred outro", () => {
  assert.equal(TOUR_STEPS[0].target, null, "the first step must not need the DOM to exist");
  assert.equal(TOUR_STEPS[0].placement, "center");
  assert.equal(TOUR_STEPS[TOUR_STEPS.length - 1].target, null, "the last step must be centred");
});

test("no two steps point at the same element", () => {
  const targets = TOUR_STEPS.map((s) => s.target).filter((t): t is string => t !== null);
  assert.equal(new Set(targets).size, targets.length, "a target is spotlighted twice");
});

test("the auto-open route is the first step's route", () => {
  // Otherwise a first visit opens the tour on "/" and immediately navigates away from it, which
  // is a redirect the visitor did not ask for.
  assert.ok(TOUR_AUTO_OPEN_ROUTES.length > 0, "the tour must auto-open somewhere or never appears");
  assert.equal(TOUR_AUTO_OPEN_ROUTES[0], TOUR_STEPS[0].route);
});

test("the routes are visited in contiguous blocks", () => {
  // Each route change costs a navigation. A → B → A would mean the tour walks a visitor back and
  // forth, and it almost always means two steps were written in the wrong order.
  const blocks: string[] = [];
  for (const s of TOUR_STEPS) {
    if (blocks[blocks.length - 1] !== s.route) blocks.push(s.route);
  }
  assert.equal(new Set(blocks).size, blocks.length, `routes revisit a page: ${blocks.join(" -> ")}`);
});

test("the tour only navigates to routes it can come back from", () => {
  for (const s of TOUR_STEPS) {
    assert.ok(s.route.startsWith("/") && !s.route.includes("?") && !s.route.includes("#"));
  }
});

test("the version and the storage key are what the store reads", () => {
  assert.equal(Number.isInteger(TOUR_VERSION) && TOUR_VERSION > 0, true);
  assert.equal(TOUR_STORAGE_KEY, "kinetype:tour");
  assert.equal(TOUR_QUERY_PARAM, "tour");
  assert.equal(targetSelector("play-cta"), `[${TOUR_TARGET_ATTR}="play-cta"]`);
});

// ================================================================== the seen flag

section("the seen flag");

test("no flag means not seen", () => {
  assert.equal(hasSeenTour(null), false);
});

test("a flag from this version counts", () => {
  assert.equal(hasSeenTour({ version: TOUR_VERSION, at: "2026-10-07T00:00:00.000Z" }), true);
});

test("a flag from an older version does NOT count, which is the point of the version", () => {
  assert.equal(hasSeenTour({ version: TOUR_VERSION - 1, at: "" }), false);
});

test("a corrupt flag degrades to not-seen rather than throwing", () => {
  for (const raw of ["", "{", "null", "[]", '"x"', '{"at":"2026-01-01"}', '{"version":"1"}', "true"]) {
    assert.equal(parseTourSeen(raw), null, `${JSON.stringify(raw)} should not parse to a flag`);
    assert.equal(hasSeenTour(parseTourSeen(raw)), false);
  }
});

test("a serialized flag round-trips", () => {
  const seen = { version: TOUR_VERSION, at: "2026-10-07T06:00:00.000Z" };
  assert.deepEqual(parseTourSeen(serializeTourSeen(seen)), seen);
});

// ================================================================== forcing and auto-open

section("forcing and auto-open");

test("?tour forces the tour and nothing else does", () => {
  assert.equal(forcedBySearch(""), false);
  assert.equal(forcedBySearch("?"), false);
  assert.equal(forcedBySearch("?x=1"), false);
  assert.equal(forcedBySearch("?tournament=1"), false, "a param that merely starts with tour is not the param");
  assert.equal(forcedBySearch("?tour"), true);
  assert.equal(forcedBySearch("?tour=1"), true);
  assert.equal(forcedBySearch("?tour="), true, "an empty value still asks for the tour");
  assert.equal(forcedBySearch("?a=1&tour=1"), true);
});

test("auto-open is the front door only, and only until it has been seen", () => {
  assert.equal(shouldAutoOpen("/", null), true);
  assert.equal(shouldAutoOpen("/play", null), false);
  assert.equal(shouldAutoOpen("/shop", null), false);
  assert.equal(shouldAutoOpen("/", { version: TOUR_VERSION, at: "" }), false);
  assert.equal(isAutoOpenRoute("/"), true);
  assert.equal(isAutoOpenRoute("/play"), false);
  assert.equal(isAutoOpenRoute("/typing-games-unblocked"), false);
});

// ================================================================== the index

section("the index");

test("the index clamps into range", () => {
  assert.equal(clampIndex(-4), 0);
  assert.equal(clampIndex(0), 0);
  assert.equal(clampIndex(TOUR_STEPS.length + 9), TOUR_STEPS.length - 1);
  assert.equal(clampIndex(Number.NaN), 0);
});

test("only the last step is the last step", () => {
  assert.equal(isLastStep(0), false);
  assert.equal(isLastStep(TOUR_STEPS.length - 2), false);
  assert.equal(isLastStep(TOUR_STEPS.length - 1), true);
  assert.equal(isLastStep(999), true);
});

test("the position readout is 1-based", () => {
  assert.deepEqual(stepPosition(0), { at: 1, of: TOUR_STEPS.length });
  assert.deepEqual(stepPosition(TOUR_STEPS.length - 1), { at: TOUR_STEPS.length, of: TOUR_STEPS.length });
});

// ================================================================== placement

section("placement");

const VIEWPORT = { width: 1280, height: 800 };
const CARD = { width: TOUR_CARD_MAX_WIDTH, height: 160 };

test("no target centres the callout and draws no arrow", () => {
  const l = placeCallout({ target: null, card: CARD, viewport: VIEWPORT, placement: "center" });
  assert.deepEqual(l, {
    placement: "center",
    left: Math.round((VIEWPORT.width - CARD.width) / 2),
    top: Math.round((VIEWPORT.height - CARD.height) / 2),
    arrow: null,
  });
});

test("a centred step centres even when a target exists", () => {
  const target: Box = { top: 100, left: 100, width: 200, height: 40 };
  const l = placeCallout({ target, card: CARD, viewport: VIEWPORT, placement: "center" });
  assert.equal(l.placement, "center");
  assert.equal(l.arrow, null);
});

test("bottom placement sits under the target at the exact gap, arrow on the top edge", () => {
  const target: Box = { top: 100, left: 600, width: 120, height: 40 };
  const l = placeCallout({ target, card: CARD, viewport: VIEWPORT, placement: "bottom" });
  assert.equal(l.placement, "bottom");
  assert.equal(l.top, target.top + target.height + TOUR_GAP + TOUR_ARROW);
  assert.equal(l.left, Math.round(target.left + target.width / 2 - CARD.width / 2));
  assert.ok(l.arrow);
  assert.equal(l.arrow?.axis, "x");
  assert.equal(l.arrow?.offset, Math.round(target.left + target.width / 2 - l.left));
});

test("top placement sits above the target at the exact gap", () => {
  const target: Box = { top: 400, left: 600, width: 120, height: 40 };
  const l = placeCallout({ target, card: CARD, viewport: VIEWPORT, placement: "top" });
  assert.equal(l.placement, "top");
  assert.equal(l.top, target.top - (TOUR_GAP + TOUR_ARROW) - CARD.height);
  assert.equal(l.arrow?.axis, "x");
});

test("bottom flips to top when there is no room underneath", () => {
  const target: Box = { top: 700, left: 600, width: 120, height: 40 };
  const l = placeCallout({ target, card: CARD, viewport: VIEWPORT, placement: "bottom" });
  assert.equal(l.placement, "top", "a callout with 60px below it must flip above the target");
});

test("left and right placement ride the vertical edge", () => {
  const target: Box = { top: 300, left: 600, width: 120, height: 60 };
  const right = placeCallout({ target, card: CARD, viewport: VIEWPORT, placement: "right" });
  assert.equal(right.placement, "right");
  assert.equal(right.left, target.left + target.width + TOUR_GAP + TOUR_ARROW);
  assert.equal(right.arrow?.axis, "y");
  const left = placeCallout({ target, card: CARD, viewport: VIEWPORT, placement: "left" });
  assert.equal(left.placement, "left");
  assert.equal(left.left, target.left - (TOUR_GAP + TOUR_ARROW) - CARD.width);
});

test("the arrow never slides off the callout's corner", () => {
  // A target whose centre is far to the left of a callout clamped against the right edge.
  const target: Box = { top: 300, left: -400, width: 100, height: 40 };
  const l = placeCallout({ target, card: CARD, viewport: VIEWPORT, placement: "bottom" });
  const offset = l.arrow?.offset ?? 0;
  assert.ok(offset >= TOUR_ARROW * 2, `arrow offset ${offset} must stay inside the corner`);
  assert.ok(offset <= CARD.width - TOUR_ARROW * 2, `arrow offset ${offset} left the callout`);
});

test("a partly off-screen target is aimed at the part of it that can be SEEN", () => {
  // The case that matters: a block running off the bottom of the screen. Aiming at its geometric
  // centre aims below the fold, at a point the visitor cannot see and cannot check against the
  // copy. Before this held, the phone probe caught the quest-board step aiming at nothing.
  //
  // Numbers chosen so nothing else can explain the result: the target is 1400px tall inside an
  // 844px viewport, so its visible span is 100..844 and the middle of that is 472.
  const viewport = { width: 390, height: 844 };
  const card = { width: TOUR_CARD_MAX_WIDTH, height: 400 };
  const target: Box = { top: 100, left: 0, width: 200, height: 1400 };
  const l = placeCallout({ target, card, viewport, placement: "right" });
  assert.equal(l.arrow?.axis, "y", "a left/right callout aims along its vertical edge");
  const aimY = l.top + (l.arrow?.offset ?? 0);
  assert.ok(
    aimY >= 100 && aimY <= viewport.height,
    `the arrow must point at the visible part (100..${viewport.height}), not at ${aimY}`,
  );
  assert.ok(
    Math.abs(aimY - 472) <= TOUR_ARROW * 2,
    `the arrow should aim at the middle of the visible span (472), not ${aimY}`,
  );
});

test("a block taller than the viewport pins the callout and still aims at the target", () => {
  // The quest board on a phone. No side fits, so the callout lands over the block and pins itself
  // to the top of the screen — that is the intended degradation. What it must still do is draw an
  // arrow whose aim point is the target's visible centre, so the copy and the highlight are
  // connected even when they overlap.
  const viewport = { width: 390, height: 844 };
  const card = { width: TOUR_CARD_MAX_WIDTH, height: 247 };
  const target: Box = { top: 120, left: 0, width: 390, height: 1400 };
  const l = placeCallout({ target, card, viewport, placement: "top" });
  assert.equal(l.placement, "top", "the preferred side is kept when nothing fits");
  assert.equal(l.top, TOUR_MARGIN, "the callout pins to the top of the screen rather than floating");
  assert.ok(l.arrow, "a block bigger than the viewport still gets an arrow");
  const aimX = l.left + (l.arrow?.offset ?? 0);
  assert.ok(
    Math.abs(aimX - 195) <= 2,
    `the arrow should aim at the visible horizontal centre (195), not ${aimX}`,
  );
});

test("the sweep: the callout is on screen for every target, viewport and side", () => {
  const viewports = [
    { width: 360, height: 640 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
  ];
  const sides: TourPlacement[] = ["top", "bottom", "left", "right"];
  let checked = 0;
  for (const viewport of viewports) {
    const card = { width: Math.min(TOUR_CARD_MAX_WIDTH, viewport.width - TOUR_MARGIN * 2), height: 160 };
    for (let top = -200; top <= viewport.height + 200; top += 137) {
      for (let left = -200; left <= viewport.width + 200; left += 211) {
        for (const width of [40, 220, viewport.width, viewport.width * 1.4]) {
          for (const height of [24, 180, viewport.height]) {
            const target: Box = { top, left, width, height };
            for (const placement of sides) {
              const l = placeCallout({ target, card, viewport, placement });
              checked++;
              const where = `${viewport.width}x${viewport.height} target(${Math.round(left)},${Math.round(top)} ${Math.round(width)}x${Math.round(height)}) ${placement}`;
              assert.ok(l.left >= TOUR_MARGIN, `${where}: left ${l.left} < ${TOUR_MARGIN}`);
              assert.ok(l.top >= TOUR_MARGIN, `${where}: top ${l.top} < ${TOUR_MARGIN}`);
              // A card that cannot fit at all (bigger than the viewport) is clamped to the top-left
              // corner, which is the one case where it may overflow.
              if (card.width + TOUR_MARGIN * 2 <= viewport.width) {
                assert.ok(
                  l.left + card.width <= viewport.width - TOUR_MARGIN,
                  `${where}: callout runs off the right edge (${l.left}+${card.width} > ${viewport.width})`,
                );
              }
              if (card.height + TOUR_MARGIN * 2 <= viewport.height) {
                assert.ok(
                  l.top + card.height <= viewport.height - TOUR_MARGIN,
                  `${where}: callout runs off the bottom (${l.top}+${card.height} > ${viewport.height})`,
                );
              }
              if (l.arrow) {
                const size = l.arrow.axis === "x" ? card.width : card.height;
                assert.ok(
                  l.arrow.offset >= TOUR_ARROW * 2 && l.arrow.offset <= size - TOUR_ARROW * 2,
                  `${where}: arrow offset ${l.arrow.offset} outside 0..${size}`,
                );
              }
            }
          }
        }
      }
    }
  }
  assert.ok(checked > 1000, `the sweep only covered ${checked} cases`);
});

console.log(`\n${"-".repeat(56)}`);
console.log(`passed ${passed}   failed ${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log(`${"-".repeat(56)}`);

if (failed > 0) process.exit(1);
