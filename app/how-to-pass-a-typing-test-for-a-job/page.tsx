import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "How to Pass a Typing Test for a Job",
  description:
    "What employers test, the typing speed you need by job type, a two week practice plan, and how to pass on the day.",
  alternates: {
    canonical: "/how-to-pass-a-typing-test-for-a-job",
  },
  openGraph: {
    title: "How to Pass a Typing Test for a Job",
    description:
      "What employers test, the typing speed you need by job type, a two week practice plan, and how to pass on the day.",
    url: "https://kinetype.app/how-to-pass-a-typing-test-for-a-job",
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
    title: "How to Pass a Typing Test for a Job",
    description:
      "What employers test, the typing speed you need by job type, a two week practice plan, and how to pass on the day.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "What is a good typing speed for a job?",
    a: "Around 40 WPM is the common baseline for office roles, while 50 to 60 WPM opens data-heavy and transcription work. The posting states its own number, so aim at the role you want, not at a general average.",
  },
  {
    q: "How long is a typing test?",
    a: "Most employer typing tests run 1 to 5 minutes, with 5-minute tests the most common. A longer test gives a steadier score, because a 1-minute sprint can flatter your speed and hide weak accuracy.",
  },
  {
    q: "Do employers check accuracy or speed first?",
    a: "Accuracy comes first. Most test software refuses a pass below roughly 95% accuracy, and recruiters read that number before WPM. Type clean and the speed that follows will look better than a fast, error-heavy score.",
  },
  {
    q: "Can I use my own keyboard?",
    a: "In most cases, yes. Remote tests run on your own machine, and in-person tests give you a standard keyboard. Either way, practice on the setup you will test on, because muscle memory for a specific keyboard is real.",
  },
  {
    q: "What happens if I fail?",
    a: "Most employers allow a retake after a waiting period, often 30 days or more, and a failed test with one company does not affect applications elsewhere. Treat the first attempt as data: it shows exactly what to fix.",
  },
  {
    q: "How do I type faster in a week?",
    a: "Practice 15 to 30 minutes daily, keep accuracy high, and stop looking at the keys. In one week you can expect a few WPM of gain; over a month of daily practice, 5 to 10 WPM is realistic for most people.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "How to Pass a Typing Test for a Job",
      description:
        "What employers test, the typing speed you need by job type, a two week practice plan, and how to pass on the day.",
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage: "https://kinetype.app/how-to-pass-a-typing-test-for-a-job",
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

export default function HowToPassTypingTestPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          How to pass a typing test for a job
        </h1>
        <p className="mt-3 text-zinc-400">
          To learn how to pass a typing test for a job, practice daily until your speed and accuracy
          clear the role's threshold, then stay calm on test day. Employers score speed and accuracy
          together, so train both. Most job seekers need two to four weeks of short daily sessions to
          get ready.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What employers actually test</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Employer typing tests measure words per minute and accuracy at the same time. Most run 1 to
          5 minutes on a short passage, and the software counts your keystrokes, marks errors, and
          produces a single score. Many systems will not pass you below 95% accuracy no matter how
          fast you type.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Accuracy in these tests is measured across every character you type, and backspaces count
          against you. A backspace-heavy minute can pull your accuracy below the pass line, so resist
          fixing every typo mid-passage. Correct errors only when it is safe to do so.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Most online tests work the same way: you get a passage, a countdown, and a results screen
          with your WPM and error rate. The test is usually embedded in the application portal, so
          there is nothing to install. Some employers add a second, longer test later in the process
          to confirm your score.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">How fast do you need to type?</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Office and admin roles usually ask for 35 to 45 WPM. Data entry roles set the bar at 40 to
          60. Transcription and court reporting sit at 50 WPM and up, with legal transcription
          targeting around 60. Check the posting itself, because the range varies by employer and
          country.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The threshold is usually stated in the job ad under requirements or in the test
          instructions. If it is not listed, ask the recruiter before you apply. Aim 5 WPM above the
          number, because most people score slightly under their practice average under pressure.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          If your target role needs 50 WPM or more, transcription is the biggest employer of that
          skill. These platforms hire beginners and test you during the application:
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
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
        </div>
        <p className="mt-3 leading-relaxed text-zinc-400">
          For the wider picture, the{" "}
          <Link href="/transcription-jobs" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            transcription jobs
          </Link>{" "}
          guide covers the platforms, and the{" "}
          <Link href="/typing-test-wfh-jobs" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            work from home typing jobs
          </Link>{" "}
          list shows where these tests show up in remote applications.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Some employers accept an external test certificate in place of their own test. If you have
          a recent score from a recognized test, mention it in the application. It can move you past
          the first screen entirely.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">A two week practice plan</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Start by measuring your baseline on the free{" "}
          <Link href="/" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            Kinetype typing test
          </Link>
          , then practice 15 to 30 minutes daily. Focus on accuracy before speed: type slowly enough
          to stay clean, and speed follows. Keep your eyes on the screen instead of the keys, and you
          will unlearn old habits within two weeks.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Week one is about consistency: type the same passage every day and watch accuracy climb.
          Week two, add longer passages and time yourself. Re-test on Kinetype every few days; most
          people gain 5 to 10 WPM in a fortnight when they practice this way.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          One drill that works is typing the same 200-word passage three times in a row. First pass
          for feel, second for accuracy, third for speed. Compare the three scores and you will see
          exactly which one you are trading away.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Track your numbers after every session in a note or spreadsheet. WPM alone is misleading;
          log accuracy with it and watch the trend across sessions. When both climb together, you are
          ready to apply regardless of the calendar.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What to do on test day</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Warm up for 10 minutes before the test starts, then stop a few minutes before so your
          fingers are fresh. Read the instructions once, note whether errors count against your
          score, and do not rush. A clean 45 WPM beats a sloppy 55 every time.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Set up your chair, screen, and keyboard before the timer starts. If you are testing from
          home, close other tabs and put your phone away. A stable desk and a keyboard you know
          count for more than people expect.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Pace yourself in the first 30 seconds. Most test takers start too fast, rack up errors, and
          spend the rest of the test recovering. Settle into a rhythm you can hold for the full
          duration, then hold it.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What happens after the test</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Your score is compared to the role's threshold, and the recruiter usually sees both WPM and
          accuracy. If you pass, the result is often valid for months, so one good test can cover
          several applications. If you fall short, ask about retakes, then keep practicing.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Some employers use the test as a hard gate, others as a ranking tool when candidates are
          close. That means a good score helps even when the role does not list typing in the title,
          so it is worth taking any free test you are offered.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          A typing score is a portable asset. The same number that clears a data entry test also
          supports transcription applications, and the walkthrough in{" "}
          <Link href="/how-to-get-transcription-jobs" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            how to get transcription jobs
          </Link>{" "}
          covers that route in detail. Markets with heavy BPO hiring, like the one on the{" "}
          <Link href="/data-entry-jobs-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            data entry jobs in the Philippines
          </Link>{" "}
          page, screen on the same skills.
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
