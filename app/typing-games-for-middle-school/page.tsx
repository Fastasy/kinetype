import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Typing Games for Middle School: What Works",
  description:
    "What a typing game needs before it survives a middle school lesson: no install, no student accounts, sound off, short rounds. Plus what Kinetype does not do.",
  alternates: { canonical: "/typing-games-for-middle-school" },
};

const FAQ = [
  {
    q: "Does it work on a school Chromebook?",
    a: "Yes. It needs a modern browser and a physical keyboard, and a Chromebook has both. There is nothing to install.",
  },
  {
    q: "Is it free, and are there ads?",
    a: "It is free to play. There are no payment features switched on, no subscriptions and no ads in the build.",
  },
  {
    q: "Do students need Google accounts?",
    a: "No. The game works completely signed out. A Google sign in is optional and only adds cloud saves, the boss campaign and the leaderboard.",
  },
  {
    q: "Can it be played without sound?",
    a: "Yes. One button turns sound off, and the device remembers the setting so it only has to be done once.",
  },
  {
    q: "Is the content appropriate for school?",
    a: "Every sentence is hand written to a school safe standard: no punctuation, no brand names, no proper nouns and no profanity. The sentences were also screened so each one can both attack and defend, which is a gameplay rule the content had to satisfy.",
  },
  {
    q: "Will it distract students with chat or strangers?",
    a: "No. There is no chat, no messaging and no multiplayer. The player faces a bot.",
  },
];

const REQUIREMENTS: [string, string][] = [
  [
    "It has to run without an install.",
    "School machines are locked down and half of them are Chromebooks. If it needs an app, an extension or an administrator, it is not happening.",
  ],
  [
    "It cannot need student accounts.",
    "Thirty accounts is a lesson, not a warm up. Nobody is doing that on a Tuesday.",
  ],
  [
    "The sound has to be optional.",
    "A room full of typing games with audio on is a room you have lost.",
  ],
  [
    "Rounds have to be short.",
    "A game that runs twenty minutes cannot be a spare ten minutes activity. It has to finish when it says it finishes.",
  ],
  [
    "The words have to be safe.",
    "You should not have to read over a student's shoulder to find out what the game is about to display.",
  ],
  [
    "It must not be trying to get around the school filter.",
    "A game that tunnels traffic to dodge the network is a discipline problem you inherit later, and a liability one after that.",
  ],
];

const LESSON: [string, string][] = [
  [
    "Three minutes, everyone on a low rung",
    "Have the class start on the 20 or 30 word per minute bot. The point is not the score, it is that nobody spends the warm up losing badly, and the game is playable at any speed.",
  ],
  [
    "Five minutes, students pick their own rung",
    "The bot ladder runs from 20 to 120 words per minute and the picker is exposed deliberately, not hidden. A student finds their level because break even sits at roughly three quarters of their own typing speed. A fast typist and a slow typist both get a match they can lose, which is the only version of this that holds attention.",
  ],
  [
    "Two minutes, one round with Strict mistakes on",
    "This is the setting where a mistype costs you a fraction of a second of stagger instead of nothing. It is a different game, and it is the quickest way to show a class why accuracy beats raw speed. Ask them to compare the accuracy figure before and after.",
  ],
  ["Five minutes, free play", "Two or three matches each, and the boss campaign for anyone who wants a target."],
];

export default function MiddleSchoolPage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: "Typing games for middle school: what actually works in a classroom",
            description:
              "What a typing game needs before it survives a middle school lesson: no install, no student accounts, sound off, short rounds. Plus what Kinetype does not do.",
            datePublished: "2026-10-06",
            dateModified: "2026-10-06",
            author: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app" },
            publisher: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app" },
            mainEntityOfPage: "https://kinetype.app/typing-games-for-middle-school",
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
                name: "Typing games for middle school",
                item: "https://kinetype.app/typing-games-for-middle-school",
              },
            ],
          },
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-mono text-3xl font-black leading-tight text-ink sm:text-4xl">
          Typing games for middle school: what actually works in a classroom
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-faint sm:text-base">
          There are two different jobs hiding behind this search, and they need different tools. If
          you need to set assignments, see which students are falling behind and produce something
          for a report, you want a classroom platform. Typing.com and TypingClub are built for
          exactly that, they have teacher dashboards, and nothing on this page competes with them.
          If you need a game a class can open in the ten spare minutes before the bell, on whatever
          machine is in front of them, without thirty logins and without you policing the content,
          the checklist is shorter and sharper.
        </p>

        <section className="mt-10" aria-labelledby="requirements">
          <h2 id="requirements" className="font-mono text-xl font-bold text-ink">
            The six things that decide whether a game survives a lesson
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-faint">
            A game that fails any of these is not usable in a real classroom, no matter how good
            the game is.
          </p>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {REQUIREMENTS.map(([lead, body]) => (
              <div key={lead} className="py-4">
                <dt className="font-semibold text-ink">{lead}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-faint">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10" aria-labelledby="measures-up">
          <h2 id="measures-up" className="font-mono text-xl font-bold text-ink">
            How Kinetype measures up against that list
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-faint">
            <p>
              It is a web page and a keyboard. No install, no extension, no plugin, so there is
              nothing for IT to approve and nothing to remove afterwards. It runs anywhere a modern
              browser runs, Chromebooks included, because it uses canvas and JavaScript and nothing
              else.
            </p>
            <p>
              You can play it entirely signed out. Free play, coins and unlocked skins are saved in
              the browser, so a student who never signs in still gets a full game. Sign in is Google
              only, and it unlocks three things: cloud progress, the boss campaign and the
              leaderboard. None of that is needed to play.
            </p>
            <p>
              Sound turns off with one button next to the difficulty selector, and the setting is
              remembered on that device, so a student does it once. The visual feedback is complete
              without audio: the next letter is boxed, typed letters turn green, and a mistake
              flashes the word red. If you are running a silent room, that is enough to play on.
            </p>
            <p>
              A round is capped at 90 seconds, but measured rounds run about 28 to 40 seconds and a
              full best of three match takes roughly a minute to a minute and a half. A ten minute
              slot fits several matches.
            </p>
            <p>
              The words are the part worth checking first. Every sentence in the game is hand
              written, 305 of them, and the rules are strict: lowercase letters and single spaces
              only, no punctuation, no numbers, no abbreviations, no brand names, no proper nouns
              and no profanity. Every sentence has to contain at least one short word and at least
              one ordinary word, so the sentence can always both attack and defend. The test the
              pool was built against is simple. A teacher should be fine with any sentence the game
              displays.
            </p>
            <p>
              It does not try to get around anything. It is an ordinary page served over HTTPS and
              it does not proxy, tunnel or disguise its traffic. If your school blocks the domain,
              the block applies, and that is the school&apos;s call to make.
            </p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="does-not">
          <h2 id="does-not" className="font-mono text-xl font-bold text-ink">
            What Kinetype does not do
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-faint">
            A teacher will find out in the first lesson anyway, so here is the short version. There
            is no classroom manager. You cannot create a class, assign work, set a deadline or
            see a roster. There are no student progress reports and no grades, and the sign in is
            Google, so there is no school managed student account either. A match gives the player
            their own words per minute and accuracy at the end, and that is where the numbers stop.
            If reporting is what you need, use a platform built for it.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="lesson">
          <h2 id="lesson" className="font-mono text-xl font-bold text-ink">
            A fifteen minute lesson shape that works
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-faint">
            Because rounds are short, a lesson can have a shape instead of just being game time.
          </p>
          <div className="mt-4 space-y-4">
            {LESSON.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-line bg-card/40 p-5">
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-faint">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="short">
          <h2 id="short" className="font-mono text-xl font-bold text-ink">
            Why short practice works better than long practice
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-faint">
            <p>
              Sustained typing at speed gets sloppy after three or four minutes. Practising
              sloppily trains the sloppiness, so a long session is worth less than it looks and can
              actively cost you. The game stops the match for this reason. The honest advice for a
              student who wants to improve is three short matches with a break between them, not one
              long grind.
            </p>
            <p>
              The other reason is the mistake rule. In Kinetype a mistype clears the precision bonus
              on that word and leaves your progress alone, so you keep going the wrong way if you
              are rushing. The only way to score well is to slow down to a speed you can hold, which
              is the habit you actually want a student forming.
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
            href="/typing-games-unblocked"
            className="rounded-xl border border-line px-5 py-2.5 font-bold text-ink-soft transition hover:border-brand/50 hover:text-ink"
          >
            What unblocked actually means
          </Link>
        </div>
      </article>
    </>
  );
}
