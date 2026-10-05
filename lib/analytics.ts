/**
 * Kinetype analytics — client tracker.
 *
 * FIRST-PARTY AND PROVIDER-AGNOSTIC. Events are batched to `/api/e` on our own
 * origin, which forwards them into `kinetype.analytics_events` in Supabase.
 *
 * Why same-origin rather than a third-party analytics host:
 *  - PostHog/GA/etc. hosts sit on every ad-blocker list, so a large slice of a
 *    game audience silently disappears. `/api/e` cannot be domain-matched.
 *  - The site sets a strict CSP (`connect-src 'self'` + Supabase only). A
 *    same-origin endpoint needs no CSP change and can never be blocked.
 *  - Free, no new account, no data leaving infrastructure already in use.
 *
 * PostHog, if it is ever added, plugs in at the bottom of `track()` — every call
 * site in the app stays exactly as it is.
 *
 * PRIVACY POSTURE
 *  - No IP is ever stored (country/region come from Vercel's geo headers,
 *    server-side, in the route).
 *  - `session_id` is a random per-tab id; `anon_id` a random per-browser id.
 *    Neither is derived from anything about the person.
 *  - `user_id` is attached only when the player is signed in, and only because
 *    they chose to create an account.
 *  - Honour Do Not Track, and stay completely silent on localhost.
 *
 * Everything is wrapped so a failure here can NEVER break the game.
 */

export type EventProps = Record<string, string | number | boolean | null | undefined>;

type QueuedEvent = {
  event: string;
  session_id: string;
  anon_id: string;
  user_id?: string;
  path?: string;
  referrer?: string;
  ref_domain?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  props?: EventProps;
};

/** Same-origin ingest endpoint (Next route handler). */
const ENDPOINT = "/api/e";
/** Flush a partial batch this often, so a long session is never all-in-one-request. */
const FLUSH_MS = 5000;
/** Flush early once this many events are queued. */
const FLUSH_AT = 5;
/** Hard ceiling on the in-memory queue if the network is down. */
const MAX_QUEUE = 60;

const SID_KEY = "kinetype:sid";
const AID_KEY = "kinetype:aid";

let queue: QueuedEvent[] = [];
/** "off" = decided not to track; "on" = running. Undecided until init(). */
let state: "idle" | "on" | "off" = "idle";
let userId: string | null = null;

let sessionId = "";
let anonId = "";
let landingReferrer = "";
let refDomain = "";
let utm: Pick<QueuedEvent, "utm_source" | "utm_medium" | "utm_campaign"> = {};

function randomId(): string {
  try {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Older browser or blocked crypto: still random enough for analytics.
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function readStore(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null; // private mode / storage blocked
  }
}

function writeStore(store: Storage | undefined, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Localhost and LAN hosts are never tracked — keeps dev and preview noise out. */
function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "" ||
    hostname.startsWith("127.") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".localhost")
  );
}

function isOptedOut(): boolean {
  try {
    const dnt =
      navigator.doNotTrack ??
      (window as unknown as { doNotTrack?: string | null }).doNotTrack;
    return dnt === "1" || dnt === "yes";
  } catch {
    return false;
  }
}

/** Path plus query, no hash, capped to what the DB column accepts. */
function currentPath(): string {
  try {
    const { pathname, search } = window.location;
    return (pathname + search).slice(0, 200);
  } catch {
    return "";
  }
}

function flush(useBeacon = false): void {
  if (!queue.length) return;
  const batch = queue;
  queue = [];

  let body: string;
  try {
    body = JSON.stringify({ events: batch });
  } catch {
    return;
  }

  try {
    if (useBeacon && typeof navigator.sendBeacon === "function") {
      // The only reliable way to get data out during page unload.
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* dropped; analytics must never surface an error */
    });
  } catch {
    /* ignore */
  }
}

/**
 * Start the tracker. Idempotent — call it as often as you like.
 * Safe to call during SSR (no-ops).
 */
export function initAnalytics(): void {
  if (state !== "idle" || typeof window === "undefined") return;

  if (isLocalHost(window.location.hostname) || isOptedOut()) {
    state = "off";
    return;
  }

  state = "on";

  // Per-tab session id (survives SPA navigation, dies with the tab).
  sessionId = readStore(window.sessionStorage, SID_KEY) ?? randomId();
  writeStore(window.sessionStorage, SID_KEY, sessionId);

  // Per-browser visitor id (survives return visits).
  anonId = readStore(window.localStorage, AID_KEY) ?? randomId();
  writeStore(window.localStorage, AID_KEY, anonId);

  // Acquisition context is captured ONCE, on landing, and remembered for the
  // session — an in-app navigation must not erase where the visitor came from.
  try {
    landingReferrer = (document.referrer || "").slice(0, 300);
    if (landingReferrer) {
      try {
        const host = new URL(landingReferrer).host;
        if (host !== window.location.host) refDomain = host.slice(0, 120);
      } catch {
        /* unparseable referrer — leave the domain empty */
      }
    }

    const params = new URLSearchParams(window.location.search);
    utm = {
      utm_source: params.get("utm_source")?.slice(0, 80) ?? undefined,
      utm_medium: params.get("utm_medium")?.slice(0, 80) ?? undefined,
      utm_campaign: params.get("utm_campaign")?.slice(0, 80) ?? undefined,
    };
  } catch {
    /* ignore */
  }

  try {
    window.setInterval(() => flush(false), FLUSH_MS);
    // pagehide is the one event that fires reliably on mobile Safari and on tab
    // close; visibilitychange catches the "switched away and never came back" case.
    window.addEventListener("pagehide", () => flush(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(true);
    });
  } catch {
    /* ignore */
  }

  // Manual handle, for debugging and for verifying a deploy from the console.
  try {
    (window as unknown as { kinetypeAnalytics?: unknown }).kinetypeAnalytics = {
      track,
      pageview,
      flush: () => flush(false),
      sessionId: () => sessionId,
    };
  } catch {
    /* ignore */
  }
}

/** Record one event. Name must be lowercase snake_case, optionally `$`-prefixed. */
export function track(event: string, props?: EventProps): void {
  if (state !== "on") return;
  if (!/^\$?[a-z0-9_]{1,40}$/.test(event)) return;

  const payload: QueuedEvent = {
    event,
    session_id: sessionId,
    anon_id: anonId,
    path: currentPath(),
    ...utm,
  };
  if (userId) payload.user_id = userId;
  if (refDomain) {
    payload.referrer = landingReferrer;
    payload.ref_domain = refDomain;
  }
  if (props) payload.props = props;

  queue.push(payload);
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  if (queue.length >= FLUSH_AT) flush(false);

  // Fan-out seam. If PostHog (or anything else) is ever added, it lights up here
  // and nothing else in the codebase has to change.
  try {
    (window as unknown as { posthog?: { capture?: (e: string, p?: unknown) => void } })
      .posthog?.capture?.(event, { ...props, path: payload.path });
  } catch {
    /* ignore */
  }
}

/** A page view. Fire on every App Router pathname change. */
export function pageview(): void {
  track("$pageview");
}

/** Attach the signed-in user id to every subsequent event this session. */
export function identify(id: string | null): void {
  userId = id ?? null;
}
