"use client";

/**
 * Mounts the analytics tracker and turns App Router navigations into page views.
 *
 * App Router route changes are CLIENT-side, so a tracker that only ran on load
 * would record exactly one page view per visit and every in-app navigation would
 * be invisible. Watching `usePathname()` is what makes /play, /shop and the rest
 * show up.
 *
 * The query string is read off `window.location` rather than `useSearchParams()`:
 * that hook forces every static page into a Suspense boundary, which would change
 * how the whole site prerenders just to satisfy analytics.
 *
 * Renders nothing.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { identify, initAnalytics, pageview, track } from "@/lib/analytics";

/** Once-per-browser-session guard for the `sign_in` event. */
const SIGNIN_SEEN_KEY = "kinetype:signin-logged";

export default function AnalyticsProvider(): null {
  const pathname = usePathname();
  const { ready, userId } = useAuth();

  // Start the tracker once, on mount.
  useEffect(() => {
    initAnalytics();
  }, []);

  // Every navigation is a page view. The first render fires it for the landing page.
  useEffect(() => {
    if (!pathname) return;
    pageview();
  }, [pathname]);

  // Attribute everything that follows to the signed-in player.
  useEffect(() => {
    identify(userId);
  }, [userId]);

  /**
   * One `sign_in` per browser session when a signed-in player arrives. This is
   * "played while signed in", not strictly "completed an OAuth handshake" — a
   * returning player with a live session counts, which is the number worth
   * watching against guest play.
   */
  useEffect(() => {
    if (!ready || !userId) return;
    try {
      if (window.sessionStorage.getItem(SIGNIN_SEEN_KEY) === "1") return;
      window.sessionStorage.setItem(SIGNIN_SEEN_KEY, "1");
    } catch {
      /* storage blocked: fall through and log it anyway */
    }
    track("sign_in", { method: "google" });
  }, [ready, userId]);

  return null;
}
