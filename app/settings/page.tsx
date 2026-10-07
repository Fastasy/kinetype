import type { Metadata } from "next";

import AccountSettings from "@/components/profile/AccountSettings";
import PasswordSettings from "@/components/profile/PasswordSettings";
import TourReplayButton from "@/components/tour/TourReplayButton";

/**
 * Your own account: the name and photo other players see.
 *
 * NOINDEX and no sitemap entry — this page is meaningless to a crawler (it is empty until you
 * sign in) and there is no version of it worth someone else's search result.
 */
export const metadata: Metadata = {
  title: "Your account",
  description: "Change the name and profile picture other players see on Kinetype.",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6">
      <header>
        <h1 className="font-pixel text-lg text-ink sm:text-xl">Your account</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">
          Your name and picture are what other players see next to your score, and your password is
          how you sign back in. Set them here and they follow you to any device you sign in on.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TourReplayButton />
          <span className="text-xs text-ink-faint">
            The walkthrough only opens itself on your first visit.
          </span>
        </div>
      </header>

      <div className="mt-6 space-y-6">
        <AccountSettings />
        <PasswordSettings />
      </div>
    </section>
  );
}
