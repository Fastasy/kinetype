// Supabase client for Kinetype.
//
// Kinetype does not own a Supabase project. The account caps a free account at two
// active projects and both are taken (Streakly, Allegro CRM), so Kinetype lives in a
// dedicated `kinetype` SCHEMA inside the existing project rather than in `public`.
// That is why every client here pins `db.schema` — without it the requests would hit
// Streakly's `public` tables.
//
// When Kinetype graduates to its own project, the only change is the two env vars
// and dropping the schema pin: the SDK's default schema is `public`.
//
// No service_role key here, ever. The browser holds the anon key and RLS does the
// rest; every write goes through a SECURITY DEFINER RPC that checks auth.uid().

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** The schema Kinetype's tables and RPCs live in. */
export const KINETYPE_SCHEMA = "kinetype";

/**
 * False when the env vars are missing. The UI checks this so a misconfigured deploy
 * degrades to "accounts are unavailable" instead of a runtime crash on every page.
 */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * `db.schema` makes the SDK send `Accept-Profile: kinetype` on PostgREST calls, which
 * is how PostgREST picks the schema.
 *
 * `detectSessionInUrl` is ON, and that is deliberate. It used to be off, with the
 * OAuth code exchanged explicitly in /auth/callback. That assumed Supabase would
 * return the user to our redirectTo — and on this project it does NOT: `redirect_to`
 * is ignored and the return always lands on `site_url` with any path stripped. So a
 * code would arrive at the site root, where nothing was listening, and sign-in died
 * silently. With detection on, the SDK completes the exchange wherever the browser
 * lands (root, /auth/callback, any page) and fires onAuthStateChange, which is what
 * the app actually depends on.
 */
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "public-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "kinetype-auth",
    },
    db: { schema: KINETYPE_SCHEMA },
  },
);
