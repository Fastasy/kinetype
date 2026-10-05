import type { Metadata } from "next";
import Link from "next/link";

import BossCampaign from "@/components/game/BossCampaign";
import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Boss Campaign: Level Up and Unlock Harder Fights",
  description:
    "Fight nine bosses from 20 to 120 WPM. Win fights to earn XP, level up, and unlock the next boss. Sign in to save your progress and climb the leaderboard.",
  alternates: { canonical: "/bosses" },
};

export default function BossesPage() {
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://kinetype.app/" },
        { "@type": "ListItem", position: 2, name: "Boss Campaign", item: "https://kinetype.app/bosses" },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={schema} />

      <section className="mx-auto max-w-4xl px-4 sm:px-6">
        <header>
          <h1 className="font-pixel text-lg text-ink sm:text-2xl">Boss Campaign</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">
            Nine bosses, one ladder, 20 to 120 words per minute. Every win banks XP, every level
            opens the next fight. Beat the one in front of you.
          </p>
        </header>

        <div className="mt-6">
          <BossCampaign />
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link
            href="/leaderboard"
            className="border-2 border-line-strong bg-card px-4 py-2 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Leaderboard
          </Link>
          <Link
            href="/play"
            className="border-2 border-line-strong bg-card px-4 py-2 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Free play
          </Link>
          <Link
            href="/how-to-play"
            className="border-2 border-line-strong bg-card px-4 py-2 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Strategy guide
          </Link>
        </div>
      </section>
    </>
  );
}
