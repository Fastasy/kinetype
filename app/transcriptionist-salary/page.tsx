import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";
import ApplyBox from "@/components/ApplyBox";

export const metadata: Metadata = {
  title: "Transcriptionist Salary: Real Pay Per Hour in 2026",
  description:
    "The honest math behind transcription pay: per audio minute rates, real work time, and what you can actually earn per month.",
  alternates: {
    canonical: "/transcriptionist-salary",
  },
  openGraph: {
    title: "Transcriptionist Salary: Real Pay Per Hour in 2026",
    description:
      "The honest math behind transcription pay: per audio minute rates, real work time, and realistic monthly earnings.",
    url: "https://kinetype.app/transcriptionist-salary",
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
    title: "Transcriptionist Salary: Real Pay Per Hour in 2026",
    description:
      "The honest math behind transcription pay: per audio minute rates, real work time, and realistic monthly earnings.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "How much do transcriptionists make per hour?",
    a: "Effective earnings for general transcription land between $2 and $6 per hour of real work, because files take two to four times their audio length. Rates climb with accuracy, speed, specialization and additional languages.",
  },
  {
    q: "What pays more, transcription or captioning?",
    a: "Transcription usually pays more per audio minute than captioning, because caption audio is often cleaner and timing is partly automated. Both land beginners in a similar effective range, so choose the work you can sustain.",
  },
  {
    q: "Does typing speed affect transcription pay?",
    a: "Yes, directly. Pay is per audio minute, so the faster you transcribe cleanly, the more you complete per hour. Rev's guidance for legal transcription targets 60 WPM, and accuracy matters just as much, since rework is unpaid.",
  },
  {
    q: "How much can a beginner transcriptionist earn?",
    a: "A beginner at 10 hours a week at $4 effective earns roughly $160 a month. It is modest income, but it grows as you qualify for better files, add languages and specialize.",
  },
  {
    q: "Do transcriptionists get paid per audio minute?",
    a: "Yes. Rev pays $0.30 to $1.10 per audio minute, and GoTranscript and TranscribeMe pay per audio minute too. The rate is for the audio you transcribe, not the time the work takes, which is why effective hourly pay is lower.",
  },
  {
    q: "Is transcription still worth it in 2026?",
    a: "Yes, for the right person. AI removed the easy files, leaving harder audio, quality control and specialized work where human accuracy matters. It is a modest side income that can grow, not a path to riches.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Transcriptionist Salary: Real Pay Per Hour in 2026",
      description:
        "The honest math behind transcription pay: per audio minute rates, real work time, and what you can actually earn per month.",
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage: "https://kinetype.app/transcriptionist-salary",
      datePublished: "2026-08-31",
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

export default function TranscriptionistSalaryPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          How much do transcriptionists make
        </h1>
        <p className="mt-3 text-zinc-400">
          How much do transcriptionists make depends on one number you will not
          see on any rate sheet: effective hourly pay, which is what you earn
          after files take two to four times their audio length to complete.
          For general work, that lands between $2 and $6 an hour.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          The real math behind transcription pay
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Per audio minute rates look good on paper. At $0.60 per audio minute,
          a 30 minute file appears to pay $18. But real work runs two to four
          times the audio length: replaying difficult passages, cleaning up
          names and numbers, and formatting. That same file takes one to two
          hours.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Divide the rate by real time and effective hourly pay lands between
          $2 and $6 for general work. That is the honest number to plan around.
          It is not a comfortable wage, but it is real income, and it climbs
          with accuracy, speed and specialization.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The math also explains why beginners quit. They see per audio minute
          rates, assume the hourly equivalent, and feel cheated when their
          first check is small. The rate is not the problem. The expectation
          was.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Track your own numbers from the first week: words per minute,
          accuracy, and minutes of work per audio minute. Most people
          overestimate how fast they are until they measure it. The{" "}
          <Link
            href="/"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            Kinetype test
          </Link>{" "}
          gives you the typing number, and your first few files give you the
          work time.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What each platform pays
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Rev pays $0.30 to $1.10 per audio minute for transcription, with the
          rate depending on audio difficulty and your rating. GoTranscript and
          TranscribeMe also pay per audio minute, and TranscribeMe has no
          typing speed requirement, which makes it a gentler entry point.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The rate sheet matters less than how fast you work. Two transcribers
          on the same platform can earn very different effective hourly rates,
          because one replays every sentence and the other flows. That is why
          practice compounds directly into pay.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Platforms gate on accuracy and style, not speed alone, so a slower
          but cleaner transcriber can out-earn a fast messy one. The typing
          speed requirement is mostly a floor, not a ranking. The{" "}
          <Link
            href="/transcription-jobs"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            transcription jobs roundup
          </Link>{" "}
          compares the main platforms directly.
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
</ApplyBox>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          How much can you actually earn per month
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Run the math on ten hours a week at $4 effective: that is $40 a week,
          roughly $160 a month. It is honest money, not a salary. Online job
          boards show the range in practice, with transcribers advertised
          around $600 to $700 a month and booking virtual assistants at $4 to
          $5 an hour.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Full time at 40 hours a week, still at $4 effective, comes to around
          $640 a month before you build any edge. People who beat that number
          specialize, add languages, or push their speed toward 60 WPM and
          their accuracy toward 99%.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Your monthly figure is really your effective rate times your working
          hours, so the two levers are speed and file selection. Choosing files
          you can do well is as valuable as typing faster, because rework and
          rejections are unpaid.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The monthly math also depends on how much work you actually take.
          Platforms do not assign you a schedule; you pick files. Consistent
          daily hours beat weekend bursts, both for income and for building the
          rating that opens up better files.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Why AI changed the pay scale
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          AI ate the easy files. Clean, single speaker audio now goes through
          speech engines, and the remaining work is the hard stuff: heavy
          accents, overlapping speakers, bad recordings, quality control and
          editing AI drafts. That is why platforms still hire humans and why
          per audio minute rates stopped growing.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The work that survives is closer to editing and checking than typing.
          If you treat transcription as a typing job, AI will squeeze you. If
          you treat it as an accuracy job, there is still a market, because no
          engine reliably handles bad audio or holds a style guide.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          This is not a reason to avoid the field. It is a reason to enter it
          with the right skill set. The people who keep earning are the ones
          who can judge, fix and format, which are exactly the skills AI cannot
          deliver consistently.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          AI also created transcription adjacent work: reviewing machine
          transcripts, fixing timestamps and formatting outputs for clients.
          Some freelancers earn more from that cleanup work than from typing
          from scratch, because clients pay for accuracy, not for who produced
          the draft.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          How to earn more
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Specialize. Legal and medical transcription pay more than general
          work, and both reward the terminology and formatting skills most
          applicants never learn. A second language helps too, because
          multilingual transcribers get more offers at better rates. The full
          entry path is covered in the{" "}
          <Link
            href="/how-to-become-a-transcriptionist"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            how to become a transcriptionist guide
          </Link>
          .
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Push your typing speed toward 60 WPM and your accuracy toward 99%.
          Rev&apos;s own guidance for legal transcription recommends 50 to 75
          WPM, with 60 WPM as the target, and accuracy gates everything. Each
          improvement raises your effective rate on every file you take.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Adding a field takes training, but general transcription experience
          shortens the learning curve. You already know how to listen, type and
          format; a course adds the terminology and style rules on top. Most
          people do this after their first few months of general work.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Government clerical roles ask for 35 WPM at about 95% accuracy, which
          shows how modest the floor is for typing work in general.
          Transcription sits above that bar, and treating 60 WPM as your target
          keeps you competitive. If your speed is below target, the guide on{" "}
          <Link
            href="/how-to-pass-a-typing-test-for-a-job"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            how to pass a typing test for a job
          </Link>{" "}
          breaks down a realistic practice routine.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          The honest verdict
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Treat transcription as a ramp, not a gold mine. At the start you earn
          around $2 to $6 an hour of real work. With specialization, languages
          and speed, experienced freelancers do better, and the{" "}
          <Link
            href="/how-to-get-transcription-jobs"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            how to get transcription jobs guide
          </Link>{" "}
          covers the entry path in detail.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The realistic plan is to start while you have another income, build
          the rating and the skills, and let the effective rate climb. If you
          are at 45 WPM today and 70 WPM in six months, your pay roughly
          doubles on the same platform without anyone raising the rate sheet.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Transcription is a good first remote job because the entry cost is
          near zero and the skill is portable. It is not a career for everyone,
          and this guide is honest about that. If the math works for your
          goals, the{" "}
          <Link
            href="/"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            free typing test
          </Link>{" "}
          is the fastest way to check your starting point.
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
        <h2 className="text-2xl font-bold text-zinc-50">
          Frequently asked questions
        </h2>
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
