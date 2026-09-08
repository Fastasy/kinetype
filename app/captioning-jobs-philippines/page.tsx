import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";
import ApplyBox from "@/components/ApplyBox";

export const metadata: Metadata = {
  title: "Captioning Jobs Philippines: Subtitle WFH Work",
    description:
    "Captioning jobs in the Philippines explained: the difference between captioning and subtitling, who hires Filipinos, what the work pays, and how to apply today.",
  alternates: {
    canonical: "/captioning-jobs-philippines",
  },
  openGraph: {
    type: "article",
    title: "Captioning Jobs Philippines: Subtitle WFH Work",
    description:
      "Captioning work in the Philippines: what it involves, who hires Filipinos, what it pays, and how to start.",
    url: "https://kinetype.app/captioning-jobs-philippines",
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
    title: "Captioning Jobs Philippines: Subtitle WFH Work",
    description:
      "Captioning work in the Philippines: what it involves, who hires Filipinos, what it pays, and how to start.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "Do captioning jobs in the Philippines pay well?",
    a: "Pay varies too widely for one honest answer, because clients quote per video minute, per audio minute or per hour, and international work usually pays more than local gigs. Part-time hours mean part-time income at the start, so treat early captioning as a skill-building income rather than a full salary.",
  },
  {
    q: "Do I need video editing skills?",
    a: "No. Captioning tools handle the video playback and the timing; your job is accurate text and clean punctuation for each caption line. Basic computer skills matter more than video editing experience. If you already transcribe, you are most of the way there.",
  },
  {
    q: "Is captioning work from home legit?",
    a: "Yes. Media companies, post-production houses and international platforms all hire remote captioners, and many Filipino captioners work from home. Real employers never charge fees to apply or train. Apply only to companies that pay for completed work through traceable methods.",
  },
  {
    q: "How is captioning different from subtitling?",
    a: "Captions mirror what is said in the video's own language and are built for viewers who need the words on screen. Subtitles usually translate the dialogue into another language. Both are time-coded to appear in sync. Transcription, by contrast, produces a written document with no timing.",
  },
  {
    q: "What equipment do I need?",
    a: "A computer, reliable internet, decent headphones and a quiet room. Captioning platforms run in a browser or a simple editor, so there is no expensive software to buy. A second screen helps when you are juggling video and text, but it is a comfort, not a requirement.",
  },
  {
    q: "Which platform should I start with?",
    a: "Start where you can pass the test. Transcription and captioning platforms that accept worldwide contractors, such as GoTranscript, Rev and TranscribeMe, are the usual entry points for Filipinos. Passing one application test and finishing a few small jobs teaches you the workflow faster than weeks of research.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Captioning jobs in the Philippines: subtitle work from home",
      description:
        "Captioning work in the Philippines: what it involves, who hires Filipinos, what it pays, and how to start.",
      keywords: ['captioning jobs philippines', 'subtitle work from home', 'video captioning jobs'],
      author: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app/", logo: "https://kinetype.app/og.png" },
      publisher: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app/", logo: "https://kinetype.app/og.png" },
      mainEntityOfPage: "https://kinetype.app/captioning-jobs-philippines",
      datePublished: "2026-09-08",
      dateModified: "2026-09-08",
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

export default function CaptioningJobsPhilippinesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Captioning jobs in the Philippines: subtitle work from home
        </h1>
        <p className="mt-3 text-zinc-400">
          Captioning jobs in the Philippines have grown with the global demand for
          captioned and subtitled video. The work means adding readable text to video, and
          it suits Filipinos because the skills overlap heavily with transcription, which
          the country already does at scale. This guide covers the work, the pay, who
          hires and how to start.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Captioning jobs in the Philippines: what the work looks like
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Captioning work means turning the audio of a video into on-screen text that
          matches what is said. You watch or listen to the clip, type what you hear, and
          place each line so it appears in sync with the speech. Timing and accuracy matter
          as much as typing speed, because a correct line at the wrong moment is still
          wrong.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          A typical day is a queue of short clips: social videos, webinars, news segments,
          training courses and documentaries. Each clip comes with a deadline and a set of
          client rules about line length, reading speed and spelling. The work is quiet and
          detail-heavy, and it rewards people who check their own output before they
          submit.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Captioning vs subtitling vs transcription
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Transcription turns audio into a written document, while captioning turns the
          same audio into time-coded text that plays on screen. Subtitling usually means
          translating the dialogue into another language. The skills overlap heavily,
          which is why transcriptionists move into captioning easily and why this guide
          keeps pointing back to transcription as the entry point.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          If you are new to the whole field, start with our{" "}
          <Link
            href="/captioning-jobs-for-beginners"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            captioning jobs for beginners
          </Link>{" "}
          guide, which covers the general skills and tools without a country filter. For
          the subtitling side, including translation work, see{" "}
          <Link
            href="/subtitle-jobs-from-home"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            subtitle jobs from home
          </Link>
          . Both skills feed the same portfolio.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Who hires captioners in the Philippines
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          In the Philippines, captioners get hired by broadcasters and media companies in
          Manila, post-production houses, agencies that handle foreign clients, and direct
          freelancers through boards like OnlineJobs.ph. International captioning and
          transcription platforms also accept Filipino contractors. No single employer
          dominates, so expect to spread applications across local and international
          channels.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The mix matters for your income. Local clients pay in pesos and usually want
          someone who understands local context and accents. International clients pay in
          dollars and care mostly about accuracy and turnaround. Most Filipino captioners
          end up with a mix of both, and the international share tends to grow as their
          record improves.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What captioning pays
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Captioning pay in the Philippines varies widely by client, language and platform,
          so quoting one figure would mislead you. Rates get set per video minute, per
          audio minute or per hour, and international platforms usually pay more than local
          gigs. Check current job ads, compare a few offers, and treat every quoted rate as
          a starting point.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Expect the same time reality that transcription has: a five-minute video can take
          twenty minutes or more of real work once you count playback, checking and
          formatting. That is normal at the start. Speed improves with practice, and the
          captioners who earn well are the ones who combine accuracy with fast turnaround,
          not the ones who chase the highest per-minute ad.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What you need
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          You need accurate listening, clean punctuation and the patience to keep each
          caption in sync with the speech. Typing speed around 50 WPM or better helps
          because deadlines are real, and accuracy around 95% keeps rework down. A
          computer, headphones and a quiet room cover the equipment side completely.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          If you have not measured your typing in a while, take the{" "}
          <Link
            href="/"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            free typing test
          </Link>{" "}
          first. Captioning tests during applications rarely demand extreme speed, but a
          score below 40 WPM means every clip takes you twice as long as someone at 60.
          Build the speed habit before you apply, and your accuracy record will follow.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Where to find captioning work
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Real captioning jobs are posted on Philippine freelance boards like OnlineJobs.ph,
          in ads from media and post-production companies, and on international platforms
          that accept worldwide contractors. Applications on real platforms are free. If a
          posting asks for money upfront or promises pay for simple tasks, it is a scam,
          and the fee is the tell.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The platforms below hire beginners and run their own application tests, so they
          are the fastest route to your first paid clip. Rev hires captioners and
          transcribers directly. GoTranscript and TranscribeMe are transcription-first,
          which is the usual entry point into this line of work, and the accuracy skills
          transfer straight across.
        </p>
        <ApplyBox>
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Apply to GoTranscript
          </a>
          <a
            href={AFFILIATE.rev}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            Apply to work at Rev
          </a>
          <a
            href={AFFILIATE.transcribeme}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            Apply to TranscribeMe
          </a>
        </ApplyBox>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          How to build a captioning portfolio
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Start with small jobs and keep samples of your best work in a folder you can show
          clients: short clips with clean captions, correct spelling and tight sync. Keep a
          record of your accuracy and turnaround times. A small portfolio with three or
          four solid samples beats a long resume with no proof of the skill.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          You can build samples before you land any client: caption a short public video,
          get the timing right, and keep the file. When a client asks for experience,
          you show the sample and explain the rules you followed. After a few paid jobs,
          raise your rate a little with each new client, because your speed and accuracy
          record now justify it. For the transcription side of the same skillset, our{" "}
          <Link
            href="/transcription-jobs-philippines"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            transcription jobs in the philippines
          </Link>{" "}
          guide covers that market in full.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          Take the free typing test to start
        </Link>

        <p className="mt-8 text-xs text-zinc-400">{AFFILIATE_DISCLOSURE}</p>
      </article>

      {/* FAQ */}
      <section className="mt-14">

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Related guides</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li>
              <Link href="/captioning-jobs-for-beginners" className="font-medium text-emerald-400 transition hover:text-emerald-300">
                captioning jobs for beginners
              </Link>
            </li>
            <li>
              <Link href="/subtitle-jobs-from-home" className="font-medium text-emerald-400 transition hover:text-emerald-300">
                subtitle jobs from home
              </Link>
            </li>
        </ul>

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
