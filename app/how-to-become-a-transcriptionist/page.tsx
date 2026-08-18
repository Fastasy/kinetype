import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "How to Become a Transcriptionist from Home",
  description:
    "A step by step path to become a transcriptionist: test your typing speed, practice accuracy, pick general or specialized work, and apply.",
  alternates: {
    canonical: "/how-to-become-a-transcriptionist",
  },
  openGraph: {
    title: "How to Become a Transcriptionist from Home",
    description:
      "The step by step path to transcription work: typing speed, accuracy, training and applications.",
    url: "https://kinetype.app/how-to-become-a-transcriptionist",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Kinetype free typing speed test",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Become a Transcriptionist from Home",
    description:
      "The step by step path to transcription work: typing speed, accuracy, training and applications.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "Do I need experience to become a transcriptionist?",
    a: "No. General transcription platforms hire beginners after a short test. Specialized fields like legal or medical transcription usually require training first, which is why paid courses exist for them.",
  },
  {
    q: "How long does it take to get hired?",
    a: "It depends on your typing speed and accuracy. If you are already at 50+ WPM with clean accuracy, you can pass an application test within a week or two. If you are below 40 WPM, budget a month of daily practice first.",
  },
  {
    q: "What equipment do I need?",
    a: "A computer, stable internet, decent headphones and a quiet workspace. A foot pedal and text expander help once you are working, but they are not required to start.",
  },
  {
    q: "Is transcription worth it compared to AI?",
    a: "AI handles the easy parts, which pushed pay down on simple work. The remaining work is harder audio, multiple speakers and specialized fields, where human accuracy still wins. That is why companies keep hiring for accuracy and judgment, not just speed.",
  },
  {
    q: "Can I do this part time?",
    a: "Yes. Most platforms let you pick files whenever you want, so you can work evenings and weekends. Many transcribers start part time and scale up once they qualify in more languages or fields.",
  },
  {
    q: "What is the best way to practice?",
    a: "Type every day, even for 10 minutes, and track your accuracy as closely as your speed. Transcribe a short podcast or news clip by hand each day to get used to real audio. The free Kinetype test gives you an instant score to track progress.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "How to Become a Transcriptionist from Home",
      description:
        "The step by step path to transcription work: typing speed, accuracy, training and applications.",
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage: "https://kinetype.app/how-to-become-a-transcriptionist",
      datePublished: "2026-08-18",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function HowToBecomeTranscriptionistPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          How to become a transcriptionist from home
        </h1>
        <p className="mt-3 text-zinc-400">
          Transcription is a skills test more than a career ladder. Get your typing speed
          and accuracy right, and the applications are mostly formality. Here is the path
          in six steps.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Step 1: Test your typing speed</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Transcription companies set a minimum speed, usually 40 to 60 WPM, and they
          test you during the application. Take the{" "}
          <Link href="/" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            free Kinetype typing test
          </Link>{" "}
          first so you know your real number, not your guess. If you are below 45 WPM,
          plan two to four weeks of daily practice before applying.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Step 2: Practice accuracy, not just speed</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Employers ask for 95% accuracy or better. Speed without accuracy means rework,
          and rework does not get paid. Practice by transcribing a short podcast or news
          clip by hand every day. Compare your version to the transcript and note where
          you slip: names, numbers, or sentence structure. Most people gain 5 to 10 WPM
          in a few weeks when they practice this way.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Step 3: Pick general or specialized</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          General transcription is the fastest entry point and needs no training. Legal
          and medical transcription pay more but usually require a course. If you want
          the higher-paying route, look for structured training that covers terminology,
          formatting and style guides. TranscribeAnywhere is one of the better-known
          training options for general and legal transcription.
        </p>
        <a
          href={AFFILIATE.transcribeAnywhere}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-3 inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
        >
          See TranscribeAnywhere training
        </a>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Step 4: Apply to platforms that hire beginners</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Rev and GoTranscript are the biggest entry points. Both accept worldwide
          contractors, test you during the application, and pay via PayPal or bank
          transfer. Apply to two or three at once; approval times vary and you want
          options when you start.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={AFFILIATE.rev}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Apply to work at Rev
          </a>
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Apply to GoTranscript
          </a>
        </div>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Step 5: Set up your workspace</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          You need a computer, stable internet, headphones and a quiet room. A foot pedal
          (about R500 to R1,500 locally) lets you pause audio without touching the
          keyboard once you are working regularly. A text expander saves time on words
          you type hundreds of times. None of this is needed on day one.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Step 6: Pass the test and start small</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The application test checks typing speed, accuracy and a sample transcription.
          Pass it, then take small files first. Your first few jobs build your rating,
          which unlocks better work. Qualify in a second language if you speak one:
          transcription platforms pay differently per language, and multilingual
          transcribers get more offers.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">How long until you earn?</h2>
        <p className="mt-3 text-zinc-400">
          If you already type 50+ WPM, a month is realistic: a week of practice, two
          weeks of applications and tests, then your first small jobs. If you start below
          40 WPM, add a month of daily practice. The skill compounds: every hour of
          transcription makes the next hour faster.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          Take the free typing test to start
        </Link>

        <p className="mt-8 text-xs text-zinc-600">{AFFILIATE_DISCLOSURE}</p>
      </article>

      {/* FAQ */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold text-zinc-50">Frequently asked questions</h2>
        <div className="mt-4 divide-y divide-zinc-800 rounded-2xl border border-zinc-800">
          {FAQS.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium text-zinc-200 transition group-open:text-emerald-400">
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
