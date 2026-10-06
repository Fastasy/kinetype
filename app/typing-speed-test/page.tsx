import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";
import SpeedTestClient from "@/components/SpeedTestClient";
import { SENTENCES_LONG, SENTENCES_MEDIUM, SENTENCES_SHORT } from "@/game/sentences";

export const metadata: Metadata = {
  title: "Typing Speed Test: Free WPM Test",
  description:
    "A free typing speed test in the browser. 15, 30 or 60 seconds, words per minute and accuracy, and an honest note on what counts as fast. No account, no download.",
  alternates: { canonical: "/typing-speed-test" },
};

/**
 * The pool the test draws from. Taken from the game's own school-safe sentences so the
 * text a visitor types here is the same text the game uses, and there is no second
 * content set to keep clean. Weighted toward the medium band, which is the length that
 * measures a steady pace rather than a burst.
 */
const TEST_SENTENCES: string[] = [
  ...SENTENCES_SHORT.slice(0, 8),
  ...SENTENCES_MEDIUM.slice(0, 24),
  ...SENTENCES_LONG.slice(0, 8),
];

const FAQ = [
  {
    q: "How is words per minute calculated?",
    a: "Correct characters are divided by five, which is the standard word length in typing, and then divided by the minutes you have been typing. So 300 correct characters in one minute is 60 words per minute. Only characters that match the passage count.",
  },
  {
    q: "Does backspacing to fix a mistake hurt my score?",
    a: "It lowers your accuracy but not your speed. Every character is counted the moment you type it, and deleting it does not refund it, so a corrected typo still shows up in the accuracy figure. The characters you got right stay counted toward your words per minute.",
  },
  {
    q: "What is a good typing speed?",
    a: "Most sources put the general adult average between 40 and 52 words per minute. Below 30 is a normal place to start, and anything above 70 is fast for a general typist rather than a specialist.",
  },
  {
    q: "How long should a typing test be?",
    a: "60 seconds is the standard, because it is long enough to include a slow patch and short enough that fatigue has not set in. A 15 second run measures your best burst rather than your pace, so use it for warm-ups and use 60 seconds to compare yourself over time.",
  },
  {
    q: "Is this the same as the game?",
    a: "No, and the difference is the point. A test has nothing to lose, so you can stop and correct yourself. The game gives you an opponent, turns every word into a move, and if you mistype you keep your progress but lose that word's bonus, so accuracy costs you something in real time.",
  },
  {
    q: "Do I need an account or a download?",
    a: "Neither. The test runs in the page and nothing is uploaded. The game works the same way, and an account is only needed for cloud progress, the boss campaign and the leaderboard.",
  },
];

const BANDS: [string, string][] = [
  ["Under 30", "A normal starting point. Accuracy first, and speed follows it."],
  ["30 to 39", "Just under the general adult range."],
  ["40 to 52", "The range most sources give for the general adult average."],
  ["53 to 70", "Above the general adult range."],
  ["71 to 90", "Fast for a general typist."],
  [
    "Over 90",
    "Very fast. For context, Monkeytype's own English leaderboard has a median in the nineties, and that is a self-selected crowd of enthusiasts rather than a benchmark for anyone else.",
  ],
];

export default function TypingSpeedTestPage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Kinetype typing speed test",
            url: "https://kinetype.app/typing-speed-test",
            applicationCategory: "UtilitiesApplication",
            operatingSystem: "Any modern browser",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "ZAR" },
            description:
              "A free browser typing speed test with words per minute and accuracy over 15, 30 or 60 seconds.",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
          {
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
          },
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-mono text-3xl font-black leading-tight text-ink sm:text-4xl">
          Typing speed test: find your words per minute
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-faint sm:text-base">
          Type the passage below and you get two numbers: words per minute and accuracy. Pick 15,
          30 or 60 seconds. The timer only starts when your fingers do, so reading the passage first
          costs you nothing. Nothing is uploaded, there is no account, and the text is the same
          school-safe pool the game uses.
        </p>

        <SpeedTestClient sentences={TEST_SENTENCES} />

        <section className="mt-10" aria-labelledby="counted">
          <h2 id="counted" className="font-mono text-xl font-bold text-ink">
            How the two numbers are counted
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-faint">
            <p>
              Words per minute is correct characters divided by five, then divided by the minutes
              you typed for. Five characters is the standard word length in typing, which is why a
              figure like 300 correct characters in a minute reads as 60 words per minute.
            </p>
            <p>
              Accuracy is the characters you got right divided by every character you typed,
              including the ones you deleted. That detail matters: if you mistype and backspace to
              fix it, the fix is counted and the mistake is not forgiven. Without that rule you
              could clean up a messy run and the accuracy figure would flatter you.
            </p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="good">
          <h2 id="good" className="font-mono text-xl font-bold text-ink">
            What counts as a good typing speed
          </h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-card/60 text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-semibold">Words per minute</th>
                  <th className="px-4 py-3 font-semibold">What it means</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {BANDS.map(([band, note]) => (
                  <tr key={band}>
                    <td className="px-4 py-3 align-top font-semibold text-ink-soft">{band}</td>
                    <td className="px-4 py-3 align-top text-ink-faint">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-faint">
            Read those bands as rough landmarks rather than a ladder to climb. The number that
            matters for your own progress is your own figure from last month. Run 60 seconds three
            times with a break between each and take the middle one, because a single run catches
            whatever mood your hands are in.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="differs">
          <h2 id="differs" className="font-mono text-xl font-bold text-ink">
            Why a game measures something a test cannot
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-faint">
            <p>
              A test has a forgiving property: nothing is at stake. If you fumble a word you can
              backspace, slow down and recover, and the final figure only really reflects the run
              you salvaged.
            </p>
            <p>
              Kinetype takes that away. You get an opponent, and every word in your sentence is a
              move: short words raise a guard, ordinary words punch, long words kick. A mistype
              keeps your progress but costs that word its precision bonus, so an error has a price
              you feel immediately rather than a penalty you can edit out afterwards. The long word
              you were saving for a knockout is also visible to your opponent, which makes reading
              ahead part of the skill.
            </p>
            <p>
              So the honest order is this: get your test number first, then find out whether it
              survives pressure. That second number is the one that goes on the{" "}
              <Link href="/leaderboard" className="text-secondary transition hover:text-brand-bright">
                leaderboard
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="faq">
          <h2 id="faq" className="font-mono text-xl font-bold text-ink">
            Questions
          </h2>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-semibold text-ink">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-faint">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

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
            How the game works
          </Link>
          <Link
            href="/typing-games-unblocked"
            className="rounded-xl border border-line px-5 py-2.5 font-bold text-ink-soft transition hover:border-brand/50 hover:text-ink"
          >
            Playing at school
          </Link>
        </div>
      </article>
    </>
  );
}
