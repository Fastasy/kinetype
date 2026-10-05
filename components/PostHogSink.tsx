"use client";

// PostHog, initialised once at module scope.
//
// WHY MODULE SCOPE, NOT AN EFFECT
//
// Every event in this app already funnels through one function — `lib/analytics.ts:track()` — which
// writes to the first-party Supabase pipeline AND fans out to `window.posthog?.capture?.()`. That
// fan-out is a silent no-op until `window.posthog` exists. Module scope runs during client bundle
// evaluation, before any component effect, so the very first `$pageview` already has somewhere to
// go. Initialising from a `useEffect` would quietly drop whatever fired first — and the seam's whole
// purpose is that adding PostHog touches exactly one file and no call sites.
//
// WHY THERE IS NO PAGEVIEW CODE HERE
//
// The first-party pipeline already emits `$pageview` on every App Router pathname change
// (components/AnalyticsProvider.tsx) — client-side navigations included, which is the part PostHog's
// built-in capture gets wrong in the App Router. That event fans out to PostHog too, so
// `capture_pageview` is deliberately OFF. Turning it on would double-count every navigation.
//
// WHY NOTHING BREAKS WITHOUT A TOKEN
//
// No token, no init, no network: the SDK is simply idle and the first-party pipeline underneath
// carries on exactly as it does today. That is what makes this safe to ship before the project is
// provisioned.

import posthog from "posthog-js";

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
// Kept for the ui_host/toolbar and for a future direct-connect mode; the SDK itself always goes
// through the proxy below.
const DIRECT_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

if (typeof window !== "undefined" && TOKEN) {
  posthog.init(TOKEN, {
    // ALWAYS same-origin, dev included. The obvious pattern is to talk to the real host in dev —
    // and it is wrong HERE, because next.config.ts applies the CSP in development too, so
    // `connect-src` would block the SDK and PostHog would look broken locally while working in
    // production. The rewrite is live in dev as well, so one path serves both and local testing
    // exercises the same code that runs live.
    api_host: "/ph",
    ui_host: DIRECT_HOST.includes("eu.") ? "https://eu.posthog.com" : "https://us.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    // Only mint a person profile once we actually know who the player is. This is a game: an
    // anonymous profile per browser would inflate the people count for no analytical gain.
    person_profiles: "identified_only",
  });

  // REQUIRED, and easy to miss: the npm package does NOT put itself on `window` — that is the
  // JS snippet's behaviour, not the library's. Measured: the SDK was fully running (it had fetched
  // its config and flags) while `window.posthog` was still undefined. Every event in this app
  // reaches PostHog through that global (see the seam in lib/analytics.ts), so without this line
  // the SDK would load, bill, and receive NOTHING — the seam would be a silent no-op and the
  // analytics would look wired while capturing zero.
  (window as unknown as { posthog?: typeof posthog }).posthog = posthog;
}

/** Renders nothing. Its whole job is the module-scope init above. */
export default function PostHogSink() {
  return null;
}
