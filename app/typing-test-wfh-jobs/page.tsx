import type { Metadata } from "next";
import Link from "next/link";
import ApplyBox from "@/components/ApplyBox";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Typing Test for WFH Jobs: Speed Requirements",
  description:
    "Take a free typing speed test and see which work-from-home jobs in the Philippines you qualify for, from CSC clerical to BPO, VA and transcription roles.",
  alternates: {
    canonical: "/typing-test-wfh-jobs",
  },
  openGraph: {
    type: "article",
    title: "Typing Test for WFH Jobs: Speed Requirements",
    description:
      "Map your WPM to real jobs: CSC clerical, BPO, VA and transcription roles. Free typing test with accuracy scoring.",
    url: "https://kinetype.app/typing-test-wfh-jobs",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Free typing speed test for work-from-home jobs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Typing Test for WFH Jobs: Speed Requirements",
    description:
      "Map your WPM to real jobs: CSC clerical, BPO, VA and transcription roles. Free typing test with accuracy scoring.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "How fast do I need to type for a government job in the Philippines?",
    a: "CSC clerical roles, including Admin Aide, Clerk and Encoder, require 35 WPM in English on a 5-minute test, with accuracy around 95%. LGUs often accept 30 to 35 WPM, and stenographer posts ask for 40 WPM and up.",
  },
  {
    q: "Is typing speed or accuracy more important for transcription jobs?",
    a: "Accuracy. TranscribeMe does not hire based on typing speed. GoTranscript, TranscribeMe and Rev all gate applicants on accuracy, grammar and style rather than WPM. Rev suggests 60 WPM as a comfortable pace for legal transcription, but that is guidance, not a cutoff.",
  },
  {
    q: "How many VA applicants actually pass the skill test?",
    a: "Very few. VA Masters tracked 102,677 applications over 12 months. Of those, 60.3% received a skill test, only 8.8% submitted it, and 1 in 708 applicants was hired.",
  },
  {
    q: "What does the BPO typing test look like?",
    a: "Many Philippine BPOs and shared-services companies use a 40-minute typing and data test, such as the Mercer and Mettl Data Entry Operators Hiring Test. It covers typing speed, accuracy and data validation.",
  },
  {
    q: "Is the Kinetype typing test really free?",
    a: "Yes. It measures WPM, accuracy and errors in English and code modes, and you get a free certificate when you finish. You can retake it as often as you like.",
  },
  {
    q: "How much do data entry jobs pay in the Philippines?",
    a: "Local jobs pay about ₱12,000 to ₱16,000 a month, and international remote roles are the higher end of the verified ₱13,000 to ₱20,000 range for entry-level work. A transcriber role on OnlineJobs.ph was advertised at $600 to $700 a month, which is above the typical local entry band.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Typing Test for WFH Jobs: Speed Requirements",
      description:
        "Map your WPM to real work-from-home jobs in the Philippines: CSC clerical, BPO, VA and transcription roles, with a free typing test.",
      keywords: ['typing test', 'wfh jobs', 'typing speed requirements'],
      author: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app/", logo: "https://kinetype.app/og.png" },
      publisher: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app/", logo: "https://kinetype.app/og.png" },
      mainEntityOfPage: "https://kinetype.app/typing-test-wfh-jobs",
      datePublished: "2026-08-18",
      dateModified: "2026-08-31",
      image: "https://kinetype.app/og.png",
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

export default function TypingTestWfhJobsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Free Typing Speed Test: Which WFH Jobs Can You Qualify For?
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          Published 18 August 2026 · Updated 18 August 2026
        </p>

        <p className="mt-6 text-zinc-400">
          If you searched for a typing speed test in the Philippines, you probably have a
          work-from-home job in mind. Maybe a VA agency sent you a skill test, or a CSC exam
          is coming up. Or maybe you just want to know whether your fingers are fast enough
          to earn in dollars.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          This article answers that. It maps real typing requirements to real jobs, shows you
          where applicants actually lose the offer, and points you to a free typing test you
          can take right now. Kailangan mo lang malaman kung saan ka pasok.
        </p>

        <ApplyBox>
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            GoTranscript application
          </a>
          <a
            href={AFFILIATE.transcribeme}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            TranscribeMe jobs
          </a>
          <a
            href={AFFILIATE.rev}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            Rev freelancer application
          </a>
        </ApplyBox>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Your WPM, mapped to real jobs</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">WPM band</th>
                <th className="px-4 py-3 font-medium">Jobs in range</th>
                <th className="px-4 py-3 font-medium">Typical pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              <tr>
                <td className="px-4 py-3 font-mono">35 WPM</td>
                <td className="px-4 py-3">CSC clerical: Admin Aide, Clerk, Encoder (LGU roles accept 30 to 35)</td>
                <td className="px-4 py-3">Government salary grade, stable but local</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">40 to 60 WPM</td>
                <td className="px-4 py-3">Data entry, VA, BPO and shared services</td>
                <td className="px-4 py-3">₱12K to ₱16K local; ₱20K to ₱40K international; VAs $6.50 to $15/hr</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">60+ WPM</td>
                <td className="px-4 py-3">Transcription edge (Rev legal guidance), faster data entry</td>
                <td className="px-4 py-3">$0.40 to $1.75 per audio minute at face value</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 text-lg font-bold text-zinc-100">35 WPM: government clerical work</h3>
        <p className="mt-2 text-zinc-400">
          The Civil Service Commission requires 35 WPM in English on a 5-minute test for
          Admin Aide, Clerk and Encoder positions. Local government units often accept 30 to
          35 WPM. Stenographer posts ask for 40 WPM and up. Court stenographers work on
          stenotype machines at 200+ WPM, which is a different game entirely.
        </p>
        <p className="mt-2 text-zinc-400">
          The CSC test pairs that speed cutoff with accuracy of around 95%. Type 35 WPM with
          errors and you still fail. Practice both.
        </p>

        <h3 className="mt-6 text-lg font-bold text-zinc-100">40 to 60 WPM: data entry, VA and BPO roles</h3>
        <p className="mt-2 text-zinc-400">
          This is the band most WFH applicants in the Philippines live in. Data entry pays
          about ₱12,000 to ₱16,000 a month for local jobs, with verified entry-level rates
          up to ₱20,000. A transcriber role on OnlineJobs.ph was advertised at $600 to
          $700 a month. VA agencies place Filipinos at $6.50 to $15 an hour.
        </p>
        <p className="mt-2 text-zinc-400">
          The catch: these employers test you first. Most run a typing or data-entry screen
          before they look at your CV closely.
        </p>

        <h3 className="mt-6 text-lg font-bold text-zinc-100">60 WPM and up: the transcription edge</h3>
        <p className="mt-2 text-zinc-400">
          Rev guidance for legal transcription says to type 50 to 75 WPM and aim for 60.
          Hold 60+ with clean accuracy and you have a real edge on transcription work.
        </p>
        <p className="mt-2 text-zinc-400">
          Transcription platforms are accuracy-based, not speed-based. TranscribeMe states
          plainly that it does not hire based on your typing speed. GoTranscript and Rev gate
          applicants on accuracy, grammar and style rather than WPM. Speed gets you through
          the work comfortably. Accuracy gets you hired.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">The skill test is where most applicants lose the job</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          VA Masters published funnel numbers for 102,677 applications over 12 months. Of
          those applicants, 60.3% received a skill test. Only 8.8% submitted it. In the end,
          1 in 708 applicants was hired, or 0.141%.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Read those numbers again. More than half of applicants got a test, and nine out of
          ten never submitted it. People stall on timed tests. They underestimate them, or
          they wait until the deadline passes. The gap between getting the test and submitting
          the test is entirely in your control, and it is the easiest gap to close. A little
          practice beforehand decides which side of that stat you land on.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What each test actually checks</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-400">
          <li>
            The Civil Service test checks 35 WPM in English on a 5-minute run, with accuracy
            around 95%.
          </li>
          <li>
            BPO and shared-services companies in the Philippines commonly use a 40-minute
            typing and data test, such as the Mercer and Mettl Data Entry Operators Hiring
            Test. It covers speed, accuracy and data validation. Speed matters, but accuracy
            and careful data handling carry equal weight.
          </li>
          <li>
            Transcription platforms run their own gates. GoTranscript has a two-step process:
            a guidelines quiz, then a short sample clip. TranscribeMe runs an entrance exam
            based on a 39-page style guide, with pass rates set in the high 90s on accuracy.
            Rev sends a skills assessment covering English and grammar, then a transcription
            sample. None of them publish a WPM cutoff, and none of them want a fast typist
            who ignores the style guide.
          </li>
        </ul>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Take the free typing test</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          <Link href="/" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            Kinetype
          </Link>{" "}
          is a free typing test with English and code modes. It reports your WPM, accuracy
          and error count, and you get a free certificate when you finish, handy for
          attaching to applications. It runs on your phone and your laptop, and one session
          takes about five minutes. Subukan mo na, libre naman.
        </p>
        <p className="mt-3 text-zinc-400">
          Know your number before you apply. Employers will test you anyway, so find out
          where you stand now, while it is still just practice.
        </p>
        <div className="mt-5">
          <Link
            href="/"
            className="inline-block rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Take the free typing test
          </Link>
        </div>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">A practice plan that works</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-400">
          <li>
            Keep it small. Five to ten minutes a day is enough, as long as you do it
            consistently.
          </li>
          <li>
            Accuracy before speed. Slow down to the pace where your errors drop, then push
            speed up gradually. A clean 45 WPM beats a sloppy 60 WPM in almost every hiring
            test in this article.
          </li>
          <li>
            Track your numbers. Note your WPM, accuracy and errors each session. When
            accuracy sits above 95%, start pushing speed again.
          </li>
          <li>
            Retest weekly. Your number moves faster than you expect.
          </li>
        </ul>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Transcription platforms worth applying to</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          GoTranscript is actively hiring Filipino speakers and pays $0.50 to $1.20 per audio
          minute. TranscribeMe pays $15 to $22 per audio hour and has no typing speed
          requirement. Rev pays $0.40 to $1.10 per audio minute with weekly PayPal payouts.
          Want the full breakdown? Read the{" "}
          <Link href="/transcription-jobs-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            transcription jobs Philippines guide
          </Link>
          .
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-zinc-400">
          <li>
            <a
              href={AFFILIATE.gotranscript}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              GoTranscript application
            </a>
          </li>
          <li>
            <a
              href={AFFILIATE.transcribeme}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
            >
              TranscribeMe jobs
            </a>
          </li>
          <li>
            <a
              href={AFFILIATE.rev}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
            >
              Rev freelancer application
            </a>
          </li>
        </ul>
        <p className="mt-4 text-xs text-zinc-400">{AFFILIATE_DISCLOSURE}</p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          One last thing: legitimate employers never charge you to start. The CICC logged
          10,004 online-scam complaints in 2024, up 202% year on year. A pay-to-start job
          offer is a red flag, not an opportunity.
        </p>

        <h2 className="mt-10 text-xl font-bold text-zinc-50">Related guides</h2>
        <ul className="mt-3 space-y-2 text-zinc-400">
          <li>
            <Link href="/how-to-become-a-virtual-assistant-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
              How to become a virtual assistant in the Philippines
            </Link>
          </li>
          <li>
            <Link href="/transcription-jobs-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
              Transcription jobs in the Philippines: real pay and requirements
            </Link>
          </li>
          <li>
            <Link href="/rev-typing-test" className="font-medium text-emerald-400 transition hover:text-emerald-300">
              Rev typing test requirements and practice
            </Link>
          </li>
        </ul>
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
