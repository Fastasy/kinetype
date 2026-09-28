import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "How to Play Kinetype: Typing Fighting Game Controls and Strategy",
  description:
    "How the Kinetype typing fighter works: picking words, reading damage, timing a parry, saving yourself off the edge, and choosing a bot difficulty from 20 to 120 words per minute.",
  alternates: { canonical: "/how-to-play" },
};

const STEPS = [
  {
    h: "Read the three words before you type",
    p: "You always have three words on screen, and their lengths are the whole game. A short word commits in under a second and gives a small shove. A long word takes longer to finish and throws your opponent across the stage. If you are being pushed back, a short word can steady things. If they are close to the edge, a long word is how you finish it.",
  },
  {
    h: "Start typing the word you want",
    p: "You do not have to click anything. The first letter you type locks onto the word that starts with it, and once a word is locked you are committed to it. You can also press 1, 2 or 3 to pick a slot deliberately. If two words start with the same letter, pressing the number is faster.",
  },
  {
    h: "Watch the damage colour",
    p: "There is no health bar, because damage does not knock you out on its own. It makes you easier to knock out. Your outline shifts from white to yellow to orange to red as it climbs, and the same hit throws you further at 100 percent than it did at 10. Once you are deep in the red, a single well placed long word ends the round.",
  },
  {
    h: "Parry the heavy shots",
    p: "When your opponent starts committing to a long word, a HEAVY INCOMING warning appears and your middle slot turns into a GUARD word. Finish the guard word before their hit connects and you take about a third of the knockback. You also get a counter window, which doubles the damage of your next completed word.",
  },
  {
    h: "Type the save word if you go off the edge",
    p: "Going past the red line does not end the round straight away. A large SAVE word appears with a short timer. Complete it and you climb back onto the stage with a brief moment of invulnerability. Miss it and the round is over. This is the most important word in the match, so keep an eye on the timer.",
  },
];

const FAQ = [
  {
    q: "Do I need to be fast to win?",
    a: "Speed helps, but word choice decides more fights than raw words per minute. A player who reads which word to take, and who parries the heavy shots, beats a faster player who ignores both. The bot ladder lets you test that: try beating the 70 word per minute bot while you type at 45.",
  },
  {
    q: "What do I lose if I make a mistake?",
    a: "By default, only time. A wrong letter clears the precision bonus on that word and restarts it, but you are not stunned. Turn on Strict mistakes if you want a wrong letter to cost you about half a second of movement, which is the harder version of the game.",
  },
  {
    q: "How do I choose the difficulty?",
    a: "You set the bot's typing speed directly, from 20 to 120 words per minute, rather than picking easy or normal. Typing speed and gaming skill are not the same thing, so a number tells you far more about what you are in for.",
  },
  {
    q: "How many rounds is a match?",
    a: "Best of three. Rounds also have a 90 second limit, and if the clock runs out the player with less damage wins the round.",
  },
  {
    q: "Why do words sometimes look different?",
    a: "Blue and bordered means GUARD, which is your parry prompt. Amber and large means SAVE, which is your recovery prompt. Everything else is an attack word, and the badge on top tells you whether it is light, mid or heavy.",
  },
];

export default function HowToPlayPage() {
  return (
    <>
      <JsonLd
        data={[
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
                name: "How to play",
                item: "https://kinetype.app/how-to-play",
              },
            ],
          },
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-mono text-3xl font-black leading-tight text-strong sm:text-4xl">
          How to play Kinetype
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          Kinetype looks like a fighting game and plays like a typing test with consequences. These
          five things decide almost every exchange, and they are worth two minutes before your first
          match.
        </p>

        <div className="mt-8 space-y-6">
          {STEPS.map((s, i) => (
            <section key={s.h} className="rounded-2xl border border-edge bg-panel/40 p-5">
              <h2 className="flex items-baseline gap-3 font-semibold text-strong">
                <span className="font-mono text-sm text-brand-bright">{i + 1}</span>
                {s.h}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.p}</p>
            </section>
          ))}
        </div>

        <section className="mt-10" aria-labelledby="controls">
          <h2 id="controls" className="font-mono text-xl font-bold text-strong">
            Controls
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-edge">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel/60 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Key</th>
                  <th className="px-4 py-2 font-semibold">Does</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge text-body">
                <tr>
                  <td className="px-4 py-2 font-mono text-brand-bright">A to Z</td>
                  <td className="px-4 py-2">Types into the locked word, or locks a word by its first letter</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-brand-bright">1 2 3</td>
                  <td className="px-4 py-2">Picks a word slot deliberately</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            That is the whole control scheme. There is no jump, no block button and no movement keys,
            because typing is the only verb in the game.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="faq">
          <h2 id="faq" className="font-mono text-xl font-bold text-strong">
            Common questions
          </h2>
          <dl className="mt-4 divide-y divide-edge border-y border-edge">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-semibold text-strong">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link
            href="/"
            className="rounded-xl bg-brand px-5 py-2.5 font-bold text-ink transition hover:bg-brand-bright"
          >
            Play now
          </Link>
          <Link
            href="/shop"
            className="rounded-xl border border-edge-bright px-5 py-2.5 font-semibold text-body transition hover:border-brand/60 hover:text-brand-bright"
          >
            See the skins
          </Link>
        </div>
      </article>
    </>
  );
}
