import type { Metadata } from "next";

import LeaderboardBoard from "@/components/game/LeaderboardBoard";
import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Leaderboard: Daily, Weekly and All-Time Typing Rankings",
  description:
    "See the fastest typists on Kinetype. Rankings for today, this week and all time, by XP and level, with the best words-per-minute and boss clears for every player.",
  alternates: { canonical: "/leaderboard" },
};

export default function LeaderboardPage() {
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://kinetype.app/" },
        { "@type": "ListItem", position: 2, name: "Leaderboard", item: "https://kinetype.app/leaderboard" },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={schema} />

      <section className="mx-auto max-w-4xl px-4 sm:px-6">
        <header>
          <h1 className="font-pixel text-lg text-ink sm:text-2xl">Leaderboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">
            Three windows over one number. Today resets every midnight UTC, this week resets
            Monday, and all time never resets. Ranked by XP — which you earn by playing well, not
            just often.
          </p>
        </header>

        <div className="mt-6">
          <LeaderboardBoard />
        </div>
      </section>
    </>
  );
}
