import type { NextConfig } from "next";

/**
 * The site was repurposed from a transcription-jobs content hub into a typing
 * fighting game on 2026-09-28. The 29 old routes were DELETED from the repo. Their
 * content is preserved in the Obsidian vault at Kinetype/Articles/Published and in
 * git history, and their URLs redirect below so no visitor and no crawler hits a
 * dead end.
 *
 * Two of them genuinely concerned typing tests, so those keep a relevant target.
 * Everything else points at the game, which keeps the domain's accumulated link
 * equity in one place instead of scattering it across 404s.
 *
 * Alternative worth knowing: if the intent is to tell search engines "this content
 * is gone, drop it", a 410 would do that more explicitly. Next config redirects
 * can only send 3xx, so that would need middleware. Reversible either way.
 */
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Content-Security-Policy.
 *
 * `script-src` keeps `'unsafe-inline'` because Next.js emits an inline bootstrap
 * script; removing it needs a nonce plus middleware. It is still worth setting: it
 * blocks every EXTERNAL script origin, framing, object embeds, base-uri hijacking and
 * form retargeting, and it pins `connect-src` to this origin plus Supabase, so an
 * injected script cannot quietly post data to a third party.
 *
 * `frame-ancestors 'self'` stops clickjacking. The game is not embedded on other
 * sites anywhere in this repo, so nothing breaks; if a third-party embed is ever
 * wanted, this is the line to widen.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  SUPABASE_ORIGIN
    ? `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_ORIGIN.replace("https://", "wss://")}`
    : "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs a camera, mic, location or payment API. OAuth popups are
  // allowed so Google sign-in is never affected.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  /**
   * REQUIRED for the PostHog proxy below, and it is not optional.
   *
   * Next normalises trailing slashes by default, so a POST to `/ph/e/` answers 308 to `/ph/e`.
   * PostHog's ingest endpoint is slash-sensitive: the rewritten `/e` then bounces the browser to
   * the REAL PostHog host to add the slash back, and that hop is cross-origin, fails CORS, and
   * surfaces in the browser as a bare "Failed to fetch". Capture dies while every other signal —
   * the SDK initialising, `/decide` returning 200, no CSP violation — looks perfectly healthy.
   *
   * Measured: `curl -X POST /ph/e/?ip=1` -> `HTTP 308` with a body of `/ph/e?ip=1`. The same
   * request with this flag set reaches PostHog and returns `{"status": 1}`.
   *
   * Trade-off, stated rather than hidden: our own routes no longer auto-redirect `/shop/` to
   * `/shop`. Internal navigation always emits the canonical (slashless) form because Next's <Link>
   * does, so this only affects hand-typed or externally-linked URLs, which still resolve.
   */
  skipTrailingSlashRedirect: true,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  /**
   * PostHog, proxied through our OWN origin.
   *
   * Two reasons this is a rewrite rather than a direct call to PostHog:
   *
   *  1. CSP. `connect-src` is pinned to 'self' plus Supabase, and the client has to POST its events
   *     somewhere. Pointing the SDK at `/ph` keeps the policy exactly as tight as it is today —
   *     nothing is widened, and the "an injected script cannot quietly post data to a third party"
   *     property the header comments describe still holds.
   *  2. Ad blockers match on the PostHog host, and a blocked request is a SILENTLY missing event.
   *     A same-origin path is not on any blocklist.
   *
   * `/static` is served by a DIFFERENT PostHog host (the asset CDN) and also matches the broad rule
   * below, so it MUST come first: rewrites are first-match-wins, and the broad rule would swallow it.
   *
   * REGION: these are the US hosts, matching this org. A `phc_` token belongs to exactly ONE region
   * and the wrong one answers 401 with nothing visible on the client, so after setting the token
   * check that `/ph/decide?v=3` returns PostHog JSON containing `requestId` — a 401 or the app's own
   * HTML both mean this block needs the EU hosts instead.
   */
  async rewrites() {
    return [
      { source: "/ph/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ph/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  async redirects() {
    /*
     * The 2026-09-28 game conversion deleted 29 content routes and 301'd every
     * one of them to the game. Those routes were restored on 2026-10-08: the job
     * guides earn organic search traffic, and that traffic is what feeds the
     * GoTranscript referral (ref 8311926). So the blanket redirect is gone and
     * only the genuinely superseded alias is left.
     *
     * Do not re-add a catch-all here. A redirect that fires on a route which
     * still exists means the page is built and then never served, which is
     * invisible in a build log and looks exactly like "the article is live".
     */
    return [
      // VA guide consolidated onto the Philippines-specific URL (2026-08-18).
      {
        source: "/become-a-virtual-assistant",
        destination: "/how-to-become-a-virtual-assistant-philippines",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
