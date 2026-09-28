import type { Metadata } from "next";
import Link from "next/link";

import FightClient from "@/components/game/FightClient";
import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Typing Fighting Game: Type to Knock Them Off the Stage",
  description:
    "Kinetype is a free typing fighting game. Three words are live at once: long words hit harder, short words land faster, and a well timed parry turns a heavy shot back on your opponent. Play in your browser.",
  alternates: { canonical: "/" },
};

const FAQ = [
  {
    q: "What is a typing fighting game?",
    a: "It is a fighting game where typing is the only input. Each player has words on screen. Completing a word lands a hit, and the hit pushes your opponent toward the edge of the stage. Land enough hits and they go off the edge. There is no health bar and no blocking button.",
  },
  {
    q: "Can I play it free without downloading anything?",
    a: "Yes. Kinetype runs in your browser on desktop or laptop. There is no download, no account, and no email required. A physical keyboard is needed, because the whole game is typing.",
  },
  {
    q: "Do I have to be a fast typist to win?",
    a: "No. Three words are live at once, and they differ in length. Long words hit much harder but take longer to land, so a slower typist who picks the right word can beat a faster one who spams short words.",
  },
  {
    q: "How does the parry work?",
    a: "When your opponent starts committing to a heavy word, the game shows a HEAVY INCOMING warning and gives you a GUARD word. Finish that word before their hit lands and you take a third of the knockback, plus you get a counter window where your next word hits twice as hard.",
  },
  {
    q: "What happens if I get knocked off the stage?",
    a: "You are not dead yet. You get one SAVE word with a short timer. Type it and you climb back onto the stage with a moment of invulnerability. Miss it and the round is over.",
  },
  {
    q: "Is there multiplayer?",
    a: "Not yet. Today you fight bots, and you choose the bot's typing speed from 20 to 120 words per minute. The fight logic is built so a second human opponent can be added later without redesigning it.",
  },
];

export default function HomePage() {
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": ["VideoGame", "WebApplication"],
      name: "Kinetype",
      url: "https://kinetype.app/",
      description:
        "A free browser typing fighting game. Type words to land hits and knock your opponent off the stage, and parry heavy attacks with a guard word.",
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
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <JsonLd data={schema} />

      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <h1 className="font-mono text-3xl font-black leading-tight text-strong sm:text-5xl">
          Typing fighting game: type to knock them off the stage
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Kinetype is a browser fighting game where the only weapon is your keyboard. Words appear
          on screen, finishing one lands a hit, and every hit shoves your opponent closer to the
          edge. Long words hurt more but take longer to land, so a slower typist who reads the fight
          can beat a faster one who does not.
        </p>
      </section>

      <div className="mt-6">
        <FightClient />
      </div>

      <section className="mx-auto mt-14 max-w-5xl px-4 sm:px-6" aria-labelledby="how">
        <h2 id="how" className="font-mono text-xl font-bold text-strong sm:text-2xl">
          Three decisions every exchange
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-edge bg-panel/40 p-5">
            <h3 className="font-semibold text-strong">Which word you take</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Three words are live. A four letter word lands quickly and nudges them. An eight letter
              word lands slowly and sends them flying. Which one you take is the decision that decides
              most exchanges.
            </p>
          </article>
          <article className="rounded-2xl border border-edge bg-panel/40 p-5">
            <h3 className="font-semibold text-strong">How much damage is on you</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Damage does not knock you out on its own. It makes the next hit throw you further, so the
              same word that nudged you at 10 percent sends you off the stage at 120. Watch your colour
              shift from white through amber into red.
            </p>
          </article>
          <article className="rounded-2xl border border-edge bg-panel/40 p-5">
            <h3 className="font-semibold text-strong">Whether to parry or race</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              When a heavy word is coming you get a GUARD word. Finish it and you take a third of the
              knockback and answer twice as hard. Guess wrong and you gave up an exchange.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-5xl px-4 sm:px-6" aria-labelledby="rounds">
        <h2 id="rounds" className="font-mono text-xl font-bold text-strong sm:text-2xl">
          Built for one more round
        </h2>
        <ul className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
          <li className="rounded-xl border border-edge bg-panel/30 px-4 py-3">
            Matches are best of three rounds, which keeps a session short enough that your hands do
            not quit before your head does.
          </li>
          <li className="rounded-xl border border-edge bg-panel/30 px-4 py-3">
            Your best words per minute and accuracy are saved on your own device. No account, no
            server, no email.
          </li>
          <li className="rounded-xl border border-edge bg-panel/30 px-4 py-3">
            Every match pays coins. Win rounds, type clean, and hold a streak to earn more.
          </li>
          <li className="rounded-xl border border-edge bg-panel/30 px-4 py-3">
            <Link href="/shop" className="text-brand-bright underline underline-offset-2">
              Skins and HUD overlays
            </Link>{" "}
            are unlocked with those coins. Every one is drawn in code, so nothing to download.
          </li>
        </ul>
      </section>

      <section className="mx-auto mt-14 max-w-5xl px-4 sm:px-6" aria-labelledby="faq">
        <h2 id="faq" className="font-mono text-xl font-bold text-strong sm:text-2xl">
          Questions
        </h2>
        <dl className="mt-5 divide-y divide-edge border-y border-edge">
          {FAQ.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="font-semibold text-strong">{f.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto mt-14 max-w-5xl px-4 sm:px-6" aria-labelledby="more">
        <h2 id="more" className="font-mono text-xl font-bold text-strong sm:text-2xl">
          Keep going
        </h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/how-to-play"
            className="rounded-xl border border-edge-bright px-4 py-2 font-semibold text-body transition hover:border-brand/60 hover:text-brand-bright"
          >
            Strategy guide
          </Link>
          <Link
            href="/typing-games-unblocked"
            className="rounded-xl border border-edge-bright px-4 py-2 font-semibold text-body transition hover:border-brand/60 hover:text-brand-bright"
          >
            Playing from school
          </Link>
          <Link
            href="/typing-speed-test"
            className="rounded-xl border border-edge-bright px-4 py-2 font-semibold text-body transition hover:border-brand/60 hover:text-brand-bright"
          >
            Plain typing speed test
          </Link>
        </div>
      </section>
    </>
  );
}
