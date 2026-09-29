import type { Metadata } from "next";
import Link from "next/link";

import ArenaTeaser from "@/components/game/ArenaTeaser";
import JsonLd from "@/components/JsonLd";
import { SKINS, RARITY_LABEL } from "@/game/skins";
import SkinSprite from "@/components/game/SkinSprite";

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
      "@type": "WebSite",
      name: "Kinetype",
      url: "https://kinetype.app/",
      description:
        "Kinetype is a free browser typing fighting game where typed words are attacks and landing enough of them knocks your opponent off the stage.",
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

      {/* ------------------------------------------------------------- hero */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <p className="font-mono text-xs tracking-widest text-ink-faint">
          FREE · BROWSER · NO DOWNLOAD
        </p>
        <h1 className="mt-3 font-pixel text-2xl leading-[1.4] text-ink sm:text-4xl sm:leading-[1.35]">
          Typing fighting game: type to knock them off the stage
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">
          Kinetype is a browser fighting game where the only weapon is your keyboard. Words appear
          on screen, finishing one lands a hit, and every hit shoves your opponent closer to the
          edge. Long words hurt more but take longer to land, so a slower typist who reads the fight
          can beat a faster one who does not.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            data-testid="play-cta"
            href="/play"
            className="border-2 border-brand bg-brand px-6 py-3 font-pixel text-[11px] text-brand-deep transition hover:bg-brand-bright sm:text-xs"
          >
            PLAY NOW
          </Link>
          <Link
            href="/how-to-play"
            className="border-2 border-line-strong bg-card px-6 py-3 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            How to play
          </Link>
          <span className="font-mono text-xs text-ink-faint">
            No account. Plays in about two seconds.
          </span>
        </div>
      </section>

      {/* ------------------------------------------------------- arena frame */}
      <div className="mx-auto mt-9 max-w-5xl px-4 sm:px-6">
        <ArenaTeaser className="w-full border-2 border-line" />
        <p className="mt-3 font-mono text-xs text-ink-faint">
          Three words are live. The long one hits hardest and takes longest to land.
        </p>
      </div>

      {/* ------------------------------------------------------ how it works */}
      <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6" aria-labelledby="how">
        <h2 id="how" className="font-pixel text-sm text-ink sm:text-lg">
          Three decisions every exchange
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <article className="border-2 border-line bg-card p-5">
            <h3 className="font-semibold text-ink">Which word you take</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-faint">
              Three words are live. A four letter word lands quickly and nudges them. An eight
              letter word lands slowly and sends them flying. Which one you take decides most
              exchanges.
            </p>
          </article>
          <article className="border-2 border-line bg-card p-5">
            <h3 className="font-semibold text-ink">How much damage is on you</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-faint">
              Damage does not knock you out on its own. It makes the next hit throw you further, so
              the same word that nudged you at 10 percent sends you off the stage at 120. Your
              outline shifts from white through amber into red.
            </p>
          </article>
          <article className="border-2 border-line bg-card p-5">
            <h3 className="font-semibold text-ink">Whether to parry or race</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-faint">
              When a heavy word is coming you get a GUARD word. Finish it and you take a third of
              the knockback and answer twice as hard. Guess wrong and you gave up an exchange.
            </p>
          </article>
        </div>
      </section>

      {/* ---------------------------------------------------------- the shop */}
      <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6" aria-labelledby="skins">
        <h2 id="skins" className="font-pixel text-sm text-ink sm:text-lg">
          Skins you earn, not buy
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-faint">
          Every match pays coins. Win rounds, type clean and hold a streak to earn more, then spend
          them on fighters and full arena themes in the{" "}
          <Link href="/shop" className="text-brand underline underline-offset-2">
            shop
          </Link>
          . Each one is drawn in code at runtime, so there is nothing to download and no file to
          wait on.
        </p>

        <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {SKINS.map((s) => (
            <li key={s.id} className="border-2 border-line bg-card p-2 text-center">
              <div className="flex h-[92px] items-center justify-center">
                <SkinSprite skin={s} scale={5} />
              </div>
              <p className="mt-2 truncate text-[11px] font-semibold text-ink">{s.name}</p>
              <p className="font-mono text-[10px] text-ink-faint">{RARITY_LABEL[s.rarity]}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ rounds */}
      <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6" aria-labelledby="rounds">
        <h2 id="rounds" className="font-pixel text-sm text-ink sm:text-lg">
          Built for one more round
        </h2>
        <ul className="mt-5 grid gap-3 text-sm text-ink-faint sm:grid-cols-2">
          <li className="border-2 border-line bg-card/50 px-4 py-3">
            Matches are best of three rounds, which keeps a session short enough that your hands do
            not quit before your head does.
          </li>
          <li className="border-2 border-line bg-card/50 px-4 py-3">
            Your best words per minute and accuracy are saved on your own device. No account, no
            server, no email.
          </li>
          <li className="border-2 border-line bg-card/50 px-4 py-3">
            Difficulty ramps on typing speed alone, from 20 to 120 words per minute, so you can
            start where you actually are.
          </li>
          <li className="border-2 border-line bg-card/50 px-4 py-3">
            Nine bots, six fighters, six themes, and no purchase you can make with real money yet.
          </li>
        </ul>
      </section>

      {/* --------------------------------------------------------------- faq */}
      <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6" aria-labelledby="faq">
        <h2 id="faq" className="font-pixel text-sm text-ink sm:text-lg">
          Questions
        </h2>
        <dl className="mt-5 divide-y divide-line border-y-2 border-line">
          {FAQ.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="font-semibold text-ink">{f.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink-faint">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------------------------------------------------- final cta */}
      <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-ink bg-card px-6 py-6">
          <div>
            <p className="font-pixel text-sm text-ink">Ready for one exchange?</p>
            <p className="mt-2 text-sm text-ink-faint">
              Pick a bot speed, then type your way off the edge of the stage.
            </p>
          </div>
          <Link
            data-testid="play-cta-bottom"
            href="/play"
            className="border-2 border-brand bg-brand px-6 py-3 font-pixel text-[11px] text-brand-deep transition hover:bg-brand-bright sm:text-xs"
          >
            PLAY NOW
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link
            href="/typing-games-unblocked"
            className="border-2 border-line-strong bg-card px-4 py-2 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Playing from school
          </Link>
          <Link
            href="/typing-speed-test"
            className="border-2 border-line-strong bg-card px-4 py-2 font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Plain typing speed test
          </Link>
        </div>
      </section>
    </>
  );
}
