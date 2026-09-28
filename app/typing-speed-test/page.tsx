import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";
import TypingTest from "@/components/TypingTest";
import { AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Free Typing Speed Test: WPM and Accuracy",
  description:
    "Take a free typing speed test and get your words per minute and accuracy in 15, 30, 60 or 120 seconds. Then take those numbers into a match and find out whether you can type under pressure.",
  alternates: { canonical: "/typing-speed-test" },
};

export default function TypingSpeedTestPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Play", item: "https://kinetype.app/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Typing speed test",
              item: "https://kinetype.app/typing-speed-test",
            },
          ],
        }}
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h1 className="font-mono text-3xl font-black leading-tight text-strong sm:text-4xl">
          Typing speed test
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Measure your words per minute and accuracy on its own, with no opponent. Pick a duration
          and go. When you have your number, use it to set the bot in the fight, one step above where
          you are comfortable.
        </p>
      </div>

      <div className="mt-8">
        <TypingTest />
      </div>

      <div className="mx-auto mt-10 max-w-5xl px-4 text-sm sm:px-6">
        <Link
          href="/"
          className="rounded-xl bg-brand px-5 py-2.5 font-bold text-ink transition hover:bg-brand-bright"
        >
          Take that speed into a fight
        </Link>
        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted">{AFFILIATE_DISCLOSURE}</p>
      </div>
    </>
  );
}
