import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import EmailAuthForm from "@/components/auth/EmailAuthForm";

/**
 * Sign in, or create an account with an email.
 *
 * This page exists because four different places used to fire Google sign-in directly, which left
 * no way to have an account without a Google one. Now every gate links here instead, and this is
 * the only screen in the app that asks for credentials.
 *
 * NOINDEX and no sitemap entry — like /settings, it is meaningless to a crawler (empty until you
 * sign in) and there is no version of it worth somebody else's search result.
 */
export const metadata: Metadata = {
  title: "Sign in or create an account",
  description:
    "Create a free Kinetype account with an email to save your level, unlock the boss campaign and appear on the leaderboard. You can also continue with Google.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <section className="mx-auto max-w-md px-4 sm:px-6">
      <header className="text-center">
        <h1 className="font-pixel text-lg text-ink sm:text-xl">Sign in, or make an account</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-faint">
          An account is what keeps your level, the bosses you have beaten and your place on the
          leaderboard — and it follows you to any device you sign in on.
        </p>
      </header>

      <div className="mt-6">
        {/* useSearchParams needs a Suspense boundary on a prerendered page. */}
        <Suspense
          fallback={
            <p className="border-2 border-line bg-card/50 px-4 py-8 text-center text-sm text-ink-faint">
              Loading the sign-in form…
            </p>
          }
        >
          <EmailAuthForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-faint">
        Free play never asks for an account. Nothing here is required to play the game —{" "}
        <Link href="/play" className="underline transition hover:text-brand">
          jump straight into a match
        </Link>
        .
      </p>
    </section>
  );
}
