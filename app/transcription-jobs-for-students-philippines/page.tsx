import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Transcription Jobs for Students in the Philippines",
  description:
    "Part time transcription work that fits around class: realistic earnings for students, which platforms hire, and how to apply.",
  alternates: {
    canonical: "/transcription-jobs-for-students-philippines",
  },
  openGraph: {
    title: "Transcription Jobs for Students in the Philippines",
    description:
      "Part time transcription work that fits around class: realistic earnings for students, which platforms hire, and how to apply.",
    url: "https://kinetype.app/transcription-jobs-for-students-philippines",
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
    title: "Transcription Jobs for Students in the Philippines",
    description:
      "Part time transcription work that fits around class: realistic earnings for students, which platforms hire, and how to apply.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "Can students do transcription jobs?",
    a: "Yes. GoTranscript, TranscribeMe and Rev accept Filipino contractors aged 18 and over, and none require a degree. You pick files around your schedule, so the work fits between classes. Treat it as part-time income and keep your school load first.",
  },
  {
    q: "How much can a student earn from transcription?",
    a: "Realistically $2 to $6 per hour effective, because a 30-minute file takes one to two hours of work. A student doing one or two audio hours a night earns modest but real money each month, which is the realistic expectation to set.",
  },
  {
    q: "Do I need experience as a student?",
    a: "No. Platforms hire beginners who pass a short application test, and they train you on their style guide when you start. What matters is accuracy and following instructions, not a resume. Practice with real audio for a week first if you are unsure.",
  },
  {
    q: "How many hours should a student transcribe?",
    a: "One or two audio hours a night is a reasonable cap for most students. The work runs two to four times audio length, so that is two to eight hours of real time. If deadlines or grades start slipping, cut the hours before you cut the sleep.",
  },
  {
    q: "Which platform is best for students?",
    a: "GoTranscript and TranscribeMe are the common starting points because their tests and style guides are beginner-friendly. Rev is bigger but stricter on style. Apply to two at once so you are not waiting on one approval to start.",
  },
  {
    q: "Will transcription affect my studies?",
    a: "Only if you overcommit. The work is self-paced, so it only affects you when you accept files you cannot finish. Budget around class, skip weeks with exams, and treat deadlines as real. Students who cap their hours find it fits fine.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Transcription jobs for students in the Philippines",
      description:
        "Part time transcription work that fits around class: realistic earnings for students, which platforms hire, and how to apply.",
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage:
        "https://kinetype.app/transcription-jobs-for-students-philippines",
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

export default function TranscriptionJobsForStudentsPhilippinesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Transcription jobs for students in the Philippines
        </h1>
        <p className="mt-3 text-zinc-400">
          Transcription jobs for students in the Philippines are a practical
          fit: flexible hours, remote work, no commute, and small files you can
          finish between classes. The pay is modest, with effective earnings
          around $2 to $6 per hour, but the schedule flexibility is what makes
          it workable around a student timetable.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Why transcription suits students
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Transcription fits a student schedule because you choose when you
          work. Files wait in a queue until you take them, so you can work
          between classes, on weekends or late at night. There is no commute and
          no shift to miss, and a quiet dorm room with a laptop is the whole
          office. You control the volume.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The work itself is steady and self-contained: audio in, text out, one
          file at a time. That suits students because you can stop at a natural
          boundary when class work calls and pick the file back up later. The
          same skills feed into essays and research, since transcription is
          mostly listening carefully and writing accurately. For the wider
          picture of who hires and what it pays, our{" "}
          <Link
            href="/transcription-jobs-philippines"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            transcription jobs in the Philippines
          </Link>{" "}
          guide covers the wider market beyond students.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          How much can a student realistically earn
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Platforms pay per audio minute, and the work runs two to four times
          the audio length, so effective earnings land around $2 to $6 per hour.
          A student doing one or two audio hours a night earns modest but real
          money, enough for allowance, transport or savings. Treat it as
          part-time income, not a salary.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Set the expectation now: a 30-minute file is a one to two hour job,
          not a quick task. If you pick up files between classes without
          budgeting for the real time, you will miss deadlines and hurt your
          rating. Students who plan one or two audio hours a night and skip the
          heavy weeks find the income predictable.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The money is not the only payoff. Transcription builds typing speed,
          accuracy and research skills that transfer to internships and office
          work. If you want a comparison of what similar effort earns elsewhere,
          our guide to{" "}
          <Link
            href="/data-entry-jobs-philippines"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            data entry jobs in the Philippines
          </Link>{" "}
          is the natural next read.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Keep your first few payouts separate from your spending money. Even a
          small balance builds into a semester's worth of buffer, and it teaches
          a saving habit that freelance income demands. When the semester picks
          up and you transcribe less, that buffer is what keeps the experiment
          from becoming stress.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Which platforms hire students
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          GoTranscript, TranscribeMe and Rev all accept Filipino contractors
          aged 18 and over, and none of them requires a degree or prior
          experience. You apply, pass a short test and start picking files.
          Approval takes days to a couple of weeks depending on the platform, so
          apply to two at once.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The platforms differ in style strictness and file availability, but
          the application is the same shape everywhere: a skills check and a
          sample transcription. If you also speak Tagalog well, look into{" "}
          <Link
            href="/tagalog-transcription-jobs"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            Tagalog transcription jobs
          </Link>{" "}
          as well, because bilingual work often has less competition and better
          rates.
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
            href={AFFILIATE.transcribeme}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            Apply to TranscribeMe
          </a>
        </div>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Balancing transcription with class
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The rule is simple: never take a file you cannot finish before the
          deadline. A 30-minute file is a one to two hour job, so budget around
          your schedule before you accept anything. Late work damages your
          rating, and your rating is the only thing that gets you better files.
          School comes first.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Treat exam weeks as automatic lighter weeks. The work queue will still
          be there after finals, and no platform penalizes you for not taking
          files, only for returning them late or badly done. The students who
          manage this best treat transcription like a gym schedule: fixed hours,
          capped volume, and a hard stop when class work needs the time.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          A practical pattern that works: batch your transcription on weekends
          and light evenings, and keep weekdays clear for assignments. One
          focused block of two hours produces more than four distracted hours
          spread across a day. Track your file deadlines in the same calendar as
          your classes, so a deadline never surprises you in the middle of exam
          week.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What you need to start
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          You already have most of it: strong English from school, decent typing
          speed from years of messaging, and research instincts. You need a
          laptop, stable internet and a quiet spot. Platforms gate on accuracy
          and following their style guide, not on typing speed alone, so
          practice with real audio before you apply.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          There is no typing speed requirement on TranscribeMe, and most
          platforms care more about clean, consistent output than raw speed.
          That said, faster typists earn more per hour, which is exactly why a
          few weeks of daily typing practice pays off before you apply. Test
          your speed on the{" "}
          <Link
            href="/"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            free Kinetype typing test
          </Link>{" "}
          and use the number to decide whether to practice first.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">How to apply</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Take the typing test first, then apply to GoTranscript and
          TranscribeMe in the same week. Pass the application test and start
          with the smallest files you can find. Never pay anyone to apply; real
          platforms charge nothing and pay out through PayPal. New to it? The{" "}
          <Link
            href="/how-to-become-a-transcriptionist"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            how to become a transcriptionist
          </Link>{" "}
          guide walks through the process step by step.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The application itself is short: personal details, a skills test and a
          sample file. Expect to wait a few days to a couple of weeks for
          approval, and do not treat the silence as a rejection. Once you are
          in, the first few small files build your rating, which decides how
          much work you see and how much it pays.
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
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
