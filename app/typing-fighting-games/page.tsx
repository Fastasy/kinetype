import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Typing Fighting Games: What They Are",
  description:
    "Most typing fighting games are a typing race wearing a costume. What each kind actually does, and what a typing game needs before fighting means anything.",
  alternates: { canonical: "/typing-fighting-games" },
};

const FAQ = [
  {
    q: "Is a typing fighting game good practice?",
    a: "It trains two things a typing test cannot. You have to keep going after a mistake instead of resetting, and you have to choose between finishing fast and finishing clean under pressure. Accuracy and speed stop being separate scores you chase one at a time.",
  },
  {
    q: "Do I need an account to play Kinetype?",
    a: "No. Free play, coins and skins work signed out and are saved on your device. An account adds cloud progress, the boss campaign and the leaderboard.",
  },
  {
    q: "What typing speed do I need?",
    a: "Any speed. The bot ladder runs from 20 to 120 words per minute and you pick the rung, so a beginner starts at 20 and a fast typist starts near their own speed. Break even sits at roughly three quarters of your own speed, so the picker is how you find your level.",
  },
  {
    q: "Can I play on a phone or tablet?",
    a: "It will load and it is playable, because the sentence is typed into a real text input and the phone keyboard works. It is much better on a physical keyboard. The game is built for a laptop.",
  },
  {
    q: "Is there a two player mode?",
    a: "Not yet. The current build is you against a bot, and the bot ladder doubles as a nine fight boss campaign. Real time multiplayer is not built.",
  },
  {
    q: "How long is a match?",
    a: "Best of three rounds, and a round measures around 28 to 40 seconds, so a match runs about a minute to a minute and a half. Short rounds are deliberate, because sustained fast typing gets sloppy after a few minutes and long sessions train the sloppiness.",
  },
];

const TABLE: [string, string, string][] = [
  ["Stage brawler", "Typing Fighter, on Poki, SilverGames and a dozen portals", "Clearing each stage. Combos build as you type, and a perfect score means no mistypes"],
  ["Health bar brawler", "Typing Boxing, on typingbit.com", "Reducing an opponent's health to zero. Each correct letter is a jab, each finished word a punch"],
  ["Race in a costume", "TYPE FiGHTER, TypeRacer, Keymash", "Who finishes the passage first"],
  ["Platform fighter", "Kinetype", "Knockback. Damage accumulates, hits launch further, and pushing your opponent past the edge ends the round"],
];

export default function TypingFightingGamesPage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: "Typing fighting games: what they are and where to play",
            description:
              "Most typing fighting games are a typing race wearing a costume. What each kind actually does, and what a typing game needs before fighting means anything.",
            datePublished: "2026-10-06",
            dateModified: "2026-10-06",
            author: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app" },
            publisher: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app" },
            mainEntityOfPage: "https://kinetype.app/typing-fighting-games",
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
              { "@type": "ListItem", position: 2, name: "Guides", item: "https://kinetype.app/guides" },
              {
                "@type": "ListItem",
                position: 3,
                name: "Typing fighting games",
                item: "https://kinetype.app/typing-fighting-games",
              },
            ],
          },
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-mono text-3xl font-black leading-tight text-ink sm:text-4xl">
          Typing fighting games: what they are and where to play
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-faint sm:text-base">
          Most games called a typing fighting game are a typing race wearing a costume. You type, a
          character on screen throws a punch, and whoever reaches the end of the passage first
          wins. That is a perfectly good game. It is not a fight, and the difference matters if a
          fight is what you came for. Here is what is actually out there, and what a typing game has
          to do before the word fighting carries any weight.
        </p>

        <section className="mt-10" aria-labelledby="what-makes">
          <h2 id="what-makes" className="font-mono text-xl font-bold text-ink">
            What makes a typing game a fighting game
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-faint">
            <p>Three things. Most games using the label have none of them.</p>
            <p>
              <strong className="text-ink-soft">You act on your opponent.</strong> In a race your
              opponent is scenery. Their progress is on screen, but nothing about their situation
              changes because of anything you typed. In a fight, what you type changes where they
              are standing and what they are able to do next.
            </p>
            <p>
              <strong className="text-ink-soft">
                There is a way to lose that is not simply being slower.
              </strong>{" "}
              A race has one failure state, and it is finishing second. A fight has a position to
              defend. You can be pushed toward a bad part of the stage, and then pushed off it.
            </p>
            <p>
              <strong className="text-ink-soft">Defence is a real decision.</strong> This is the
              part typing games skip. If your only option when you are losing is to type faster,
              the game runs on one axis and there are no decisions inside it. Speed decides
              everything, so reading your opponent is worth nothing.
            </p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="four-kinds">
          <h2 id="four-kinds" className="font-mono text-xl font-bold text-ink">
            The four kinds you will actually find
          </h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-card/60 text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">An example</th>
                  <th className="px-4 py-3 font-semibold">What decides the match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {TABLE.map((row) => (
                  <tr key={row[0]}>
                    <td className="px-4 py-3 align-top font-semibold text-ink-soft">{row[0]}</td>
                    <td className="px-4 py-3 align-top text-ink-faint">{row[1]}</td>
                    <td className="px-4 py-3 align-top text-ink-faint">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-faint">
            <p>
              The stage brawler is the most common. Typing Fighter is the one you will meet first,
              because it is syndicated across Poki, SilverGames, yaksgames, minigamesville and
              others, and it holds most of the first page for the search itself. You type
              sentences, combos build, and the game scores you on how clean your run was. The
              enemies progress toward you on a stage. It is closer to a rhythm brawler than to a
              duel.
            </p>
            <p>
              Typing Boxing is the health bar version. Every correct letter is a jab, every
              completed word a power punch, and each knockout brings a tougher opponent with more
              health and a tighter window to finish each word. Lose four lives and the run ends. It
              is honest about what it is: a punching bag that gets faster.
            </p>
            <p>
              The race in a costume has the widest field. TYPE FiGHTER puts two players in a real
              time race to finish the same sentence, and how far your opponent has typed is relayed
              to your screen letter by letter. TypeRacer and Keymash run the same idea over passages
              rather than single sentences. There is nothing wrong with any of them. They are races.
            </p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="knockback">
          <h2 id="knockback" className="font-mono text-xl font-bold text-ink">
            Why knockback changes everything
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-faint">
            <p>
              A health bar is a countdown. You chip it down, and the numbers move in a straight
              line until somebody reaches zero. Knockback is an acceleration. In Kinetype, damage
              percent does not sit there as a bar. It feeds the launch formula, so a hit at 90
              percent does dramatically more than the same hit did at 20 percent. Both fighters
              start with nothing, and every exchange makes the next one more dangerous. The game
              does not show your damage as a number. The fighter changes colour, from white through
              yellow and orange to red and then near black, so you can read how close you are to the
              edge without reading anything.
            </p>
            <p>
              The end condition is a knock off, not a knockout. Every stage has a blast line at each
              side. Push your opponent past it and they are not dead. They get one recovery prompt,
              a single five letter word in the middle of the screen, and typing it inside the
              window puts them back on the stage. Fail it and the round is over. That mechanic does
              more for the genre than any amount of particle effects, because it turns the losing
              moment into a prompt you can pass or fail with your hands.
            </p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="hand">
          <h2 id="hand" className="font-mono text-xl font-bold text-ink">
            Your sentence is a hand of cards, not a passage
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-faint">
            <p>This is the part that takes a minute to appreciate.</p>
            <p>
              Every word in your sentence is a move, and its length decides which move. One to
              three characters raises a guard and deals no damage. Four to seven characters is a
              punch. Eight characters or more is a kick, which is slow to land, has low base
              knockback and high scaling, so it matters most when your opponent is already damaged.
            </p>
            <p>
              You cannot skip a word. The sentence you were handed is the hand you have to play, and
              you can see the whole thing before you start typing. A small word early in the
              sentence is a cheap block you can hold. A long word three positions away is a kill
              shot you can see coming and time. Reading the sentence before your hands move is the
              skill, and it is a different skill from raw speed.
            </p>
            <p>
              That is also where defence stops being theoretical. A guard held when a punch lands
              smothers it, and the knockback drops to less than half. A guard held when a kick lands
              is a parry, which cuts the knockback further, deals only chip damage, and opens a
              short window where your next landed hit does double. So the losing player has a read
              available: watch for the kick telegraph, get the guard up, and counter. The player who
              blocks constantly gets punished for it, because blocking costs you time and a block
              that was not needed is a lost exchange. That is three layers of decision, which is
              about as deep as a typing input can be pushed.
            </p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="exists">
          <h2 id="exists" className="font-mono text-xl font-bold text-ink">
            Does a typing platform fighter already exist?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-faint">
            We searched for one on 6 October 2026, across Steam, portal libraries, itch.io and the
            open web, and did not find another typing game that uses escalating knockback from
            accumulated damage, stage out elimination, and a word driven recovery prompt. That is
            worth stating carefully. It is not proof that none exists. It is a record of what could
            be found when someone looked, and the honest position is that the mechanic looks
            unclaimed rather than impossible.
          </p>
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
            href="/typing-games-for-middle-school"
            className="rounded-xl border border-line px-5 py-2.5 font-bold text-ink-soft transition hover:border-brand/50 hover:text-ink"
          >
            Using it in a classroom
          </Link>
          <Link
            href="/games-like-nitro-type"
            className="rounded-xl border border-line px-5 py-2.5 font-bold text-ink-soft transition hover:border-brand/50 hover:text-ink"
          >
            More alternative typing games
          </Link>
        </div>
      </article>
    </>
  );
}
