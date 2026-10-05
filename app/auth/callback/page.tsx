"use client";

// OAuth landing page.
//
// IMPORTANT: this page does NOT exchange the code. Supabase on this project ignores
// `redirect_to` and returns every sign-in to the site root, so the browser may land
// here, on `/`, or anywhere else. `detectSessionInUrl` (lib/supabase.ts) handles the
// exchange wherever it happens.
//
// So this page's only job is to wait for the session to appear and then hand the
// player to where they were headed — and to say something useful if it never does.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AUTH_NEXT_KEY, useAuth } from "@/components/auth/AuthProvider";

/** How long to wait for the session before admitting something went wrong. */
const GIVE_UP_MS = 8000;

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, userId } = useAuth();
  const [message, setMessage] = useState("Signing you in…");
  const [failed, setFailed] = useState(false);

  // Provider-reported error (Google or Supabase can both return one).
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const err = params.get("error_description") || params.get("error");
      if (err) {
        setFailed(true);
        setMessage(err);
      }
    });
    return () => {
      active = false;
    };
  }, [params]);

  // Session present -> forward to the intended destination.
  useEffect(() => {
    if (failed || !ready || !userId) return;
    let next = "/bosses";
    try {
      const stashed = window.sessionStorage.getItem(AUTH_NEXT_KEY);
      if (stashed && stashed.startsWith("/")) next = stashed;
      window.sessionStorage.removeItem(AUTH_NEXT_KEY);
    } catch {
      // ignore: default destination
    }
    router.replace(next);
  }, [ready, userId, failed, router]);

  // Signed in but nothing happened -> do not hang on a spinner forever.
  useEffect(() => {
    if (failed || userId) return;
    const t = window.setTimeout(() => {
      setFailed(true);
      setMessage("We could not complete the sign-in. Please try again.");
    }, GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [failed, userId]);

  return (
    <section className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-pixel text-base text-ink">
        {failed ? "Sign-in problem" : "Signing you in"}
      </h1>
      <p className="mt-3 text-sm text-ink-faint">{message}</p>
      {failed && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/bosses"
            className="border-2 border-line-strong bg-card px-5 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Try again
          </Link>
          <Link
            href="/leaderboard"
            className="border-2 border-line-strong bg-card px-5 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Leaderboard
          </Link>
        </div>
      )}
    </section>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-md px-4 py-24 text-center text-sm text-ink-faint">
          Signing you in…
        </section>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
