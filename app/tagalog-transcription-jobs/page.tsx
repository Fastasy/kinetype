import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Tagalog Transcription Jobs (Work From Home)",
  description:
    "Who hires Tagalog transcribers, what the work pays, and how to pass the test. A bilingual niche with less competition than general transcription.",
  alternates: {
    canonical: "/tagalog-transcription-jobs",
  },
  openGraph: {
    title: "Tagalog Transcription Jobs (Work From Home)",
    description:
      "Who hires Tagalog transcribers, what the work pays, and how to pass the test. A bilingual niche with less competition than general transcription.",
    url: "https://kinetype.app/tagalog-transcription-jobs",
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
    title: "Tagalog Transcription Jobs (Work From Home)",
    description:
      "Who hires Tagalog transcribers, what the work pays, and how to pass the test. A bilingual niche with less competition than general transcription.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "Do I need to be fluent in Tagalog?",
    a: "Yes, for real work. You will transcribe natural speech with slang, dialects, and English mixed in, and fluency is what makes that possible. Conversational Tagalog is not enough to pass a platform test reliably.",
  },
  {
    q: "Is Tagalog transcription work done from home?",
    a: "Yes. All major platforms treat transcription as remote contractor work, and most clients posting Tagalog audio hire freelancers. You need a computer, headphones, and stable internet; the rest is a home office.",
  },
  {
    q: "How much do Tagalog transcribers earn?",
    a: "Expect the $2 to $6 per hour effective range that most transcription work lands in, because audio takes two to four times its length to transcribe. Tagalog can sit at the higher end since fewer people qualify.",
  },
  {
    q: "Do I need experience?",
    a: "No. Platforms test you during the application and hire beginners who pass. The test weighs language accuracy and style more than years of work, so a clean application with real practice matters more than a resume.",
  },
  {
    q: "What tools do I need?",
    a: "A computer, decent headphones, and a quiet room. Most platforms run a built-in editor, and a foot pedal or text expander helps once you are working regularly. Nothing expensive is required to start.",
  },
  {
    q: "Is AI replacing Tagalog transcribers?",
    a: "Not yet, and not soon. Machine tools still make errors on Tagalog dialects and code-switching, so clients pay humans to fix the output. The work is shifting toward checking and correcting, but the demand for human quality control is still there.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Tagalog Transcription Jobs (Work From Home)",
      description:
        "Who hires Tagalog transcribers, what the work pays, and how to pass the test. A bilingual niche with less competition than general transcription.",
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage: "https://kinetype.app/tagalog-transcription-jobs",
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

export default function TagalogTranscriptionJobsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Tagalog transcription jobs
        </h1>
        <p className="mt-3 text-zinc-400">
          Tagalog transcription jobs are remote roles where you listen to Filipino and Tagalog audio,
          mostly with mixed English, and type what is said. Fewer people qualify for bilingual work
          than for general English transcription, which keeps the niche smaller and the demand
          steady.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What Tagalog transcription is</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Tagalog transcription is typing audio into text, where the audio is Filipino or Tagalog,
          often with English words mixed in. That mix is called code-switching, and it is the reason
          machine tools stumble. The work includes interviews, webinars, podcasts, and customer
          calls, and the deliverable is a clean, timed transcript.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Most transcripts need timestamps, speaker labels, and formatting from the platform style
          guide. Getting those right is half the pass mark on the application test, so read the style
          guide before you start. The audio itself is usually interviews, webinars, and customer
          calls recorded in the Philippines.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Who hires Tagalog transcribers</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          GoTranscript runs a dedicated Filipino transcription job page and hires Tagalog transcribers
          as contractors. Rev and TranscribeMe also accept Filipino speakers, and language skills
          move you up their lists. Freelance clients on Upwork and OnlineJobs.ph post Tagalog audio
          work too, so the applications are worth spreading around.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          GoTranscript listing Filipino as a language with its own application flow is a sign the
          demand is real. Rev and TranscribeMe route language-qualified transcribers into better work
          queues, and Upwork clients post one-off Tagalog audio jobs that are useful for building a
          portfolio.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The general{" "}
          <Link href="/transcription-jobs" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            transcription jobs
          </Link>{" "}
          guide covers how the platforms work, and{" "}
          <Link href="/transcription-jobs-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            transcription jobs in the Philippines
          </Link>{" "}
          lists the local options if you want to compare routes.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          GoTranscript is the most direct route for Filipino speakers, because it hires for the
          language specifically:
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
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
</div>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What it pays</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Tagalog work can pay better than general English transcription because fewer transcribers
          qualify, but it lands in the $2 to $6 per hour effective range. Rev pays $0.30 to $1.10 per
          audio minute, and GoTranscript and TranscribeMe also pay per audio minute. Real work time
          runs two to four times the audio length, which pulls the hourly rate down.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          OnlineJobs.ph ads for transcribers have advertised around $600 to $700 a month for
          full-time remote roles, which beats platform rates but comes with a steady client and
          deadlines. Platforms pay per audio minute, and the effective hourly rate depends on how
          fast you transcribe. Expect the first few weeks to run slower than your eventual pace.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Pay is quoted per audio minute, but your real income is per hour of work. A 10-minute file
          that takes 30 minutes to transcribe pays for 10 minutes, so accuracy and practice are what
          move your hourly rate up. That is why the platforms gate on accuracy and style rather than
          raw speed.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What you need to qualify</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          You need fluent spoken Tagalog, decent written English, and typing speed around 45 WPM or
          higher. Accuracy matters more than speed, since platforms gate on accuracy and style, not
          raw WPM. Add headphones and a quiet room, and you have a working setup for most platforms.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          If you are not sure where you stand, take the free{" "}
          <Link href="/" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            Kinetype typing test
          </Link>{" "}
          first. It gives you a WPM and accuracy score to compare against the 45 WPM target, and it
          takes two minutes. Written English matters as much as spoken Tagalog, because clients read
          transcripts and expect clean grammar.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          If typing speed is your strength but Tagalog is not, the{" "}
          <Link href="/encoding-jobs-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            encoding jobs in the Philippines
          </Link>{" "}
          page covers work that needs far less language skill.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">How to apply and pass the test</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Apply through the platform's Filipino or Tagalog application page, then take the language
          test seriously. The test usually mixes English and Filipino audio, so practice with real
          mixed audio before you apply. Transcribe a Tagalog podcast daily for a week, check your
          errors, and you will walk into the test ready.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The application has three parts in most cases: a general typing check, a sample
          transcription, and a language evaluation. Practice with real mixed audio for a week before
          you apply, and transcribe one Tagalog episode a day. The full walkthrough in{" "}
          <Link href="/how-to-get-transcription-jobs" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            how to get transcription jobs
          </Link>{" "}
          applies here, with one change: the language test counts for more than speed.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Why this niche is still growing</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Machine transcription still struggles with Tagalog dialects and code-switching, so clients
          keep paying humans to check and correct the output. That quality-control work holds demand
          steady while general English transcription gets squeezed. Fewer bilingual transcribers
          enter each year, which keeps the niche undersupplied relative to demand.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The general English market is crowded, which is why general transcription pay has slid.
          Tagalog audio stays harder for machines, so clients keep a human in the loop for quality
          control. That is the entire reason the niche holds up: the work is the part AI still gets
          wrong.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Dialects complicate machine output further: regional accents and borrowed words from
          Spanish, English, and Chinese appear in everyday audio. Each one is a place where automated
          transcripts break, and a place where a human editor earns the fee.
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
