/**
 * Analytics ingest — POST /api/e.
 *
 * The browser batches events here, same-origin. This route is the only place that
 * knows the visitor's country (Vercel injects it as a header; the browser never
 * sees it), and it is the only writer into `kinetype.analytics_events`.
 *
 * It holds NO secret. The insert goes through `kinetype.log_events()`, a
 * SECURITY DEFINER RPC that is granted to `anon` and validates/clamps every
 * field, while the table itself is RLS-locked with no read policy. So the public
 * blast radius is "can append junk analytics rows" — never read, never touch
 * another table. That is deliberate: it means no new secret has to be provisioned
 * in Vercel for this to work.
 *
 * It ALWAYS answers 204, whatever happens. A tracking endpoint must never be the
 * reason somebody cannot play the game.
 */

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** The schema the analytics objects live in. */
const SCHEMA = "kinetype";

/** Hard cap on the raw request body. A beacon of 20 events is ~1-4KB. */
const MAX_BODY_BYTES = 32_000;
/** Hard cap on events accepted from one request. */
const MAX_EVENTS = 25;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noContent = () => new Response(null, { status: 204 });

/** Coarse device class from the UA. Values stay short — the column is 16 chars. */
function deviceFromUserAgent(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini/.test(s)) return "mobile";
  if (/bot|crawler|spider|crawling|headless|lighthouse|pingdom/.test(s)) return "bot";
  return "desktop";
}

export async function POST(req: Request): Promise<Response> {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return noContent();

    // Same-origin only. Cheap, and it blocks a third-party page quietly using us
    // as a free event sink. A missing Origin (some beacons) is allowed.
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        const host = req.headers.get("host");
        if (!host || new URL(origin).host !== host) return noContent();
      } catch {
        return noContent();
      }
    }

    const raw = await req.text();
    if (!raw || raw.length > MAX_BODY_BYTES) return noContent();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return noContent();
    }

    const events = Array.isArray(parsed) ? parsed : (parsed as { events?: unknown })?.events;
    if (!Array.isArray(events) || events.length === 0) return noContent();

    const batch = events.slice(0, MAX_EVENTS);
    const ua = req.headers.get("user-agent") ?? "";

    // Vercel geo headers. Absent locally and on other hosts — that is fine.
    const country = (req.headers.get("x-vercel-ip-country") ?? "").slice(0, 2);
    const region = (req.headers.get("x-vercel-ip-country-region") ?? "").slice(0, 80);
    const device = deviceFromUserAgent(ua);

    await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_events`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        // PostgREST picks the schema from these: the write profile, then the read one.
        "Content-Profile": SCHEMA,
        "Accept-Profile": SCHEMA,
      },
      body: JSON.stringify({ events: batch, country, region, device }),
      // Never let a slow database hold a player's page open.
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      /* swallow — see the class doc above */
    });

    return noContent();
  } catch {
    return noContent();
  }
}

/** Anything other than POST is not an ingest. */
export async function GET(): Promise<Response> {
  return new Response(null, { status: 405 });
}
