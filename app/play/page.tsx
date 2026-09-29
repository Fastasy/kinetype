import type { Metadata } from "next";
import Link from "next/link";

import FightClient from "@/components/game/FightClient";
import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Play Kinetype: Free Online Typing Fighting Game",
  description:
    "Play Kinetype free in your browser. Choose a bot from 20 to 120 WPM, then type a sentence where small words block, ordinary words punch and long words kick. Knock your opponent off the stage. No download and no account.",
  alternates: { canonical: "/play" },
  keywords: [
    "play typing fighting game",
    "typing fighting game online",
    "typing fighter game free",
    "type to fight game",
    "typing battle game",
    "free browser typing game",
  ],
};

/** Play-specific questions only. The wider "what is this" questions live on the landing page. */
const PLAY_FAQ = [
  {
    q: "How do I control the fight?",
    a: "Just type. One sentence is on screen and you type it straight through, one word at a time, with no spaces to type and nothing to select. Every word is a move: small words block, ordinary words punch, long words kick. Escape leaves the match.",
  },
  {
    q: "Which difficulty should I start on?",
    a: "Pick a bot a little slower than you actually type, then win on accuracy before you raise the speed. The bot ladder runs from 20 words per minute up to 120, so there is a sensible starting point for a beginner and a real fight for a fast typist.",
  },
  {
    q: "Does it need a keyboard?",
    a: "Yes. The whole game is typing, so it needs a physical keyboard on a desktop or laptop. It does not play on a phone, and we would rather say that plainly than pretend otherwise.",
  },
  {
    q: "Do I need an account?",
    a: "No. Coins, unlocked skins and your best words per minute are stored in your own browser only. Nothing is uploaded, and there is no email to hand over before you can play.",
  },
];

export default function PlayPage() {
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": ["VideoGame", "WebApplication"],
      name: "Kinetype",
      url: "https://kinetype.app/play",
      description:
        "A free browser typing fighting game. Type a sentence where every word is a move, block and parry the incoming kicks, and knock your opponent off the stage.",
      applicationCategory: "GameApplication",
      genre: ["Fighting", "Typing", "Platform fighter"],
      gamePlatform: "Web browser",
      operatingSystem: "Any",
      playMode: "SinglePlayer",
      browserRequirements: "Requires a physical keyboard and HTML5 canvas support",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://kinetype.app/" },
        { "@type": "ListItem", position: 2, name: "Play", item: "https://kinetype.app/play" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: PLAY_FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <JsonLd data={schema} />

      {/* Deliberately thin. The arena is the page; everything above it is one line of
          orientation so a first-time visitor knows what to press. */}
      <section className="mx-auto max-w-6xl px-3 sm:px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="font-pixel text-lg text-ink sm:text-2xl">Play Kinetype</h1>
          <p className="font-mono text-xs text-ink-faint sm:text-sm">
            Small words block, ordinary words punch, long words kick. <span className="text-ink">Esc</span> quits.
          </p>
        </div>
      </section>

      <div className="mt-2">
        <FightClient wide />
      </div>

      <section className="mx-auto mt-12 max-w-3xl px-4 sm:px-6" aria-labelledby="play-faq">
        <h2 id="play-faq" className="font-pixel text-sm text-ink sm:text-base">
          Before you start
        </h2>
        <dl className="mt-4 divide-y divide-line border-y-2 border-line">
          {PLAY_FAQ.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="font-semibold text-ink">{f.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink-faint">{f.a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/how-to-play"
            className="border-2 border-line-strong bg-card px-4 py-2 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Full strategy guide
          </Link>
          <Link
            href="/shop"
            className="border-2 border-line-strong bg-card px-4 py-2 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Skins and themes
          </Link>
          <Link
            href="/"
            className="border-2 border-line-strong bg-card px-4 py-2 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            What is Kinetype
          </Link>
        </div>
      </section>
    </>
  );
}
