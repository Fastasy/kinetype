import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Typing game guides",
  description:
    "Guides to typing fighting games: what the genre actually is, what works in a classroom, and which typing games are worth your time if you are tired of races.",
  alternates: { canonical: "/guides" },
};

/** Newest first. Array position is display order. */
const GUIDES = [
  {
    href: "/typing-fighting-games",
    title: "Typing fighting games: what they are and where to play",
    blurb:
      "Most typing fighting games are races in costume. What each type actually does, and what a typing game needs before the word fighting means anything.",
  },
  {
    href: "/games-like-nitro-type",
    title: "Games like Nitro Type: typing games that are not only races",
    blurb:
      "What each alternative actually does, from racing and RPGs to battle royale, plus the six checks worth running before you commit to one.",
  },
  {
    href: "/typing-games-for-middle-school",
    title: "Typing games for middle school: what actually works in a classroom",
    blurb:
      "No install, no student accounts, sound off, short rounds. The checklist a typing game has to pass to survive a lesson, and what Kinetype does not do.",
  },
];

export default function GuidesPage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Kinetype guides",
            description:
              "Guides to typing fighting games, classroom use and alternatives to typing races.",
            url: "https://kinetype.app/guides",
            hasPart: GUIDES.map((g) => ({
              "@type": "Article",
              headline: g.title,
              url: `https://kinetype.app${g.href}`,
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Play", item: "https://kinetype.app/" },
              { "@type": "ListItem", position: 2, name: "Guides", item: "https://kinetype.app/guides" },
            ],
          },
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-mono text-3xl font-black leading-tight text-ink sm:text-4xl">
          Guides
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-faint sm:text-base">
          Kinetype is a typing game where the typing is a weapon rather than a stopwatch. These
          pages explain what that actually means, how it differs from the rest of the genre, and
          what it is like to use in a classroom.
        </p>

        <ul className="mt-8 divide-y divide-line border-y border-line">
          {GUIDES.map((g) => (
            <li key={g.href} className="py-5">
              <Link
                href={g.href}
                className="font-mono text-lg font-bold text-ink transition hover:text-secondary"
              >
                {g.title}
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-ink-faint">{g.blurb}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link
            href="/play"
            className="rounded-xl bg-brand px-5 py-2.5 font-bold text-brand-deep transition hover:bg-brand-bright"
          >
            Play Kinetype
          </Link>
          <Link
            href="/how-to-play"
            className="rounded-xl border border-line px-5 py-2.5 font-bold text-ink-soft transition hover:border-brand/50 hover:text-ink"
          >
            How to play
          </Link>
          <Link
            href="/typing-speed-test"
            className="rounded-xl border border-line px-5 py-2.5 font-bold text-ink-soft transition hover:border-brand/50 hover:text-ink"
          >
            Typing speed test
          </Link>
        </div>
      </article>
    </>
  );
}
