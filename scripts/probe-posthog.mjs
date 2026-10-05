// Verifies the PostHog wiring WITHOUT needing a real project token.
//
// Everything except "the events land in a real PostHog project" is provable with a fake `phc_`
// token: that the SDK initialises, that it routes through our own /ph proxy, that the CSP does not
// block it, and that the first-party pipeline underneath still works. So the only remaining risk
// when the real token arrives is the region (see next.config.ts).
//
// Start the dev server WITH a fake token first:
//   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_local_probe_wiring_only \
//   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com \
//   npx next dev --port 3000
//
// Usage: node scripts/probe-posthog.mjs [baseUrl]

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(BASE);

// The public project key, for the direct-ingest check. Read from the environment, else from
// .env.local — never hardcoded, so rotating the key does not silently leave a stale copy here.
const TOKEN_FROM_PAGE =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ??
  (existsSync(".env.local")
    ? (readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=(.+)$/m)?.[1] ?? "")
        .trim()
        .replace(/^["']|["']$/g, "")
    : "");

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const phRequests = [];
  const apiRequests = [];
  const cspViolations = [];
  const consoleErrors = [];
  // Ingest RESPONSES, not just requests. A request that fires proves the wiring; a 200 whose body
  // says `{"status": 1}` proves PostHog ACCEPTED the event — and that is the only thing separating
  // a working token from a wrong-region one, because a rejected capture fails silently in the
  // browser and looks exactly like success from the outside.
  const captures = [];

  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/ph/")) phRequests.push(`${r.method()} ${u.replace(BASE, "")}`);
    if (u.includes("/api/e")) apiRequests.push(`${r.method()} ${u.replace(BASE, "")}`);
  });

  page.on("response", async (res) => {
    const u = res.url();
    if (!/\/ph\/(e|batch|capture|decide)/.test(u)) return;
    let body = "";
    try {
      body = (await res.text()).slice(0, 160);
    } catch {
      // body already consumed or discarded — the status still counts
    }
    captures.push({ url: u.replace(BASE, ""), status: res.status(), body });
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to connect|violates the following/i.test(t)) cspViolations.push(t);
    if (m.type() === "error") consoleErrors.push(t);
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // The proxy must exist even before any SDK runs.
  const decide = await page.request.post(`${BASE}/ph/decide?v=3`, {
    data: { token: "phc_local_probe_wiring_only", distinct_id: "wiring-probe" },
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });
  const body = await decide.text();
  const looksLikePostHog = /"token"|"config"|"error"|"detail"|"requestId"/.test(body);
  check(
    "/ph/decide reaches PostHog, not our own app",
    looksLikePostHog && !/<!DOCTYPE html>/i.test(body),
    `HTTP ${decide.status()}, ${body.slice(0, 90).replace(/\s+/g, " ")}`,
  );
  check(
    "the wrong-region 401 signature is NOT present",
    !(decide.status() === 401 && /invalid token|Invalid personal API/i.test(body)),
    `HTTP ${decide.status()}`,
  );

  // Now the real page: the SDK should boot and emit its first pageview through the proxy.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  // Plain JS inside evaluate: this is an .mjs file, so a TS cast here would be a syntax error.
  await page.waitForFunction(() => Boolean(window.posthog), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const sdk = await page.evaluate(() => {
    const p = window.posthog;
    return {
      present: Boolean(p),
      loaded: Boolean(p && p.__loaded),
      distinctId: (p && p.get_distinct_id && p.get_distinct_id()) || null,
    };
  });
  check("the SDK initialises", sdk.present, JSON.stringify(sdk));

  check("it posts through our OWN origin at /ph", phRequests.length > 0, `${phRequests.length} request(s): ${phRequests.slice(0, 3).join(", ")}`);
  check(
    "no request goes to a PostHog host directly",
    !phRequests.some((r) => /posthog\.com/.test(r)),
    phRequests.slice(0, 3).join(" | "),
  );

  check("the CSP does not block PostHog", cspViolations.length === 0, cspViolations.slice(0, 2).join(" | "));

  // Drive the SDK directly, with `send_instantly`. Nothing would flow to PostHog on its own here:
  // the first-party pipeline is silent on localhost by design, and `capture_pageview` is off. A
  // direct capture is therefore the ONLY way to prove the token + region + proxy ACCEPT an event —
  // which matters, because a rejected capture fails silently in the browser and looks exactly like
  // success from the outside.
  //
  // `send_instantly` is required, not cosmetic: posthog-js queues events and flushes them on a
  // timer, so a single `capture()` can sit in the queue past the end of the probe and make a
  // working integration look dead.
  const sent = await page.evaluate(async () => {
    if (!window.posthog || !window.posthog.capture) return "no sdk";
    window.posthog.capture("probe_wiring_test", { source: "probe-posthog.mjs" }, { send_instantly: true });
    return "sent";
  });
  check("the SDK is reachable from the page and accepted a capture call", sent === "sent", `evaluate returned ${sent}`);

  // Wait for the SDK's OWN flush rather than guessing an interval. posthog-js batches and flushes
  // on a timer (default ~10s), so a short sleep makes a working integration look dead — the
  // failure mode that would send us chasing a nonexistent bug.
  let sdkCapture = null;
  try {
    const res = await page.waitForResponse((r) => /\/ph\/(e|batch|i\/v0\/e)/.test(r.url()), { timeout: 20000 });
    sdkCapture = { url: res.url().replace(BASE, ""), status: res.status(), body: (await res.text()).slice(0, 140) };
  } catch {
    sdkCapture = null;
  }

  // NOT ASSERTABLE FROM AN AUTOMATED BROWSER, so this reports rather than fails.
  //
  // Playwright drives a context that sets `navigator.webdriver` and a headless fingerprint, and
  // posthog-js will not transmit from one. Measured: the SDK is loaded (`__loaded: true`), opted IN
  // (`has_opted_out_capturing() === false`), has a distinct_id, has fetched its remote config and
  // recorder — and `capture()` produces no log line and no request, even with `send_instantly`, an
  // explicit pagehide flush, a realistic user agent, or a 20s wait. That is a property of the
  // harness, not of the app; asserting it here would fail on a CORRECT integration forever.
  //
  // The layer that actually matters is asserted below and does pass: the proxy + token + region
  // ACCEPT a real event. Whether the SDK transmits is verified in a human browser (see
  // posthog-analytics-setup).
  if (sdkCapture) {
    check(
      "the SDK flushes its own event to PostHog and it is ACCEPTED",
      sdkCapture.status === 200 && /"status"\s*:\s*(1|"Ok")/i.test(sdkCapture.body),
      `${sdkCapture.url} -> ${sdkCapture.body}`,
    );
  } else {
    console.log("skip  the SDK's own flush — not observable in an automated browser");
    console.log("      (navigator.webdriver is set; PostHog will not transmit from that context)");
    console.log("      verify in a real browser, or in PostHog's own event view");
  }

  // Belt and braces: hit the ingest endpoint the way the browser does, straight through the proxy.
  // This isolates "does this token+region+proxy accept a capture" from "did the SDK flush in time".
  const direct = await page.evaluate(async (token) => {
    try {
      const res = await fetch("/ph/e/?ip=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: token,
          event: "probe_ingest_direct",
          properties: { distinct_id: "probe-ingest-check" },
          timestamp: new Date().toISOString(),
        }),
      });
      return { status: res.status, body: (await res.text()).slice(0, 120) };
    } catch (e) {
      // A network-level failure here is the silent killer: the request never reaches PostHog and
      // nothing else in the browser reports a problem.
      return { status: 0, body: `fetch threw: ${String(e).slice(0, 110)}` };
    }
  }, TOKEN_FROM_PAGE);
  check(
    "the ingest endpoint accepts our token through the proxy",
    direct.status === 200 && /"status"\s*:\s*(1|"Ok")/i.test(direct.body),
    `HTTP ${direct.status} ${direct.body}`,
  );

  // (There is deliberately no assertion that PostHog received the event — that can only be seen
  // in PostHog itself, or in a human browser. The check above proves the endpoint accepts us.)
  check(
    "no capture was rejected",
    !captures.some((c) => c.status >= 400),
    captures.filter((c) => c.status >= 400).map((c) => `${c.status} ${c.body.slice(0, 80)}`).join(" | "),
  );

  // The first-party pipeline is deliberately SILENT on localhost (see the skill), which is what
  // lets it be verified against a real deploy instead of fighting dev noise. So on localhost the
  // correct assertion is that it stays quiet; the "still works" half belongs against production.
  if (IS_LOCAL) {
    check("on localhost the first-party pipeline stays silent, by design", apiRequests.length === 0, `${apiRequests.length} requests to /api/e`);
  } else {
    const firstParty = await page.evaluate(() => Boolean(window.kinetypeAnalytics));
    check("the first-party analytics API is still exposed", firstParty);
    check("...and still posts to /api/e", apiRequests.length > 0, `${apiRequests.length} request(s)`);
  }

  // React's dev-mode eval() notice and the SDK's retries against a fake token are both expected.
  const real = consoleErrors.filter(
    (e) => !/favicon|401|Failed to load resource|eval\(\) is not supported/i.test(e),
  );
  check("no unexpected console errors", real.length === 0, real.slice(0, 2).join(" | "));

  await browser.close();
  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${fail} failed, ${pass} passed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
