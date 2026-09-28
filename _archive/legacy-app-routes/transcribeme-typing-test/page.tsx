import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";
import ApplyBox from "@/components/ApplyBox";

export const metadata: Metadata = {
  title: "TranscribeMe Typing Test: Passing Guide",
  description:
    "How to pass the TranscribeMe entrance exam and typing test in 2026. Speed benchmarks, accuracy scoring, formatting rules, and free practice test.",
  alternates: {
    canonical: "/transcribeme-typing-test",
  },
  openGraph: {
    title: "TranscribeMe Exam & Typing Test: Passing Guide",
    description:
      "Pass the TranscribeMe entrance exam: typing speed requirements, accuracy standards, and free typing practice.",
    type: "article",
    url: "https://kinetype.app/transcribeme-typing-test",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "TranscribeMe typing test and exam prep",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TranscribeMe Exam & Typing Test: Passing Guide",
    description:
      "Pass the TranscribeMe entrance exam: typing speed requirements, accuracy standards, and free typing practice.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "What typing speed do I need for TranscribeMe?",
    a: "TranscribeMe accepts beginners who type at least 40 to 50 WPM. Accuracy is weighted heavily: your exam submission must meet a 98% accuracy threshold according to their style guidelines.",
  },
  {
    q: "How does TranscribeMe pay?",
    a: "TranscribeMe pays per audio minute for standard transcription, with published rates around $15 to $22 per audio hour. Specialized teams can pay more. Remember the honest math: real work time runs 2 to 4 times the audio length, so effective earnings usually land between $2 and $6 an hour. Payments are distributed weekly via PayPal.",
  },
  {
    q: "How long are TranscribeMe audio clips?",
    a: "Unlike long interview files, TranscribeMe chunks files into 2 to 4-minute micro-tasks, making it very flexible for part-time freelancers.",
  },
  {
    q: "Can international freelancers apply to TranscribeMe?",
    a: "Yes. TranscribeMe hires contractors globally as long as you have a verified PayPal account and pass the entrance test.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "TranscribeMe Exam & Typing Test: Passing Guide",
      description:
        "Guide to passing the TranscribeMe transcriptionist exam in 2026.",
      keywords: ['transcribeme exam', 'transcribeme typing test', 'entrance exam'],
      author: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app/", logo: "https://kinetype.app/og.png" },
      publisher: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app/", logo: "https://kinetype.app/og.png" },
      mainEntityOfPage: "https://kinetype.app/transcribeme-typing-test",
      datePublished: "2026-08-18",
      dateModified: "2026-08-31",
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

export default function TranscribeMeTypingTestPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
          Beginner Friendly Platform
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          TranscribeMe typing test: passing guide (2026)
        </h1>
        <p className="mt-4 text-lg text-zinc-400 leading-relaxed">
          TranscribeMe is widely considered one of the easiest remote transcription platforms for beginners to join. Learn the speed benchmarks, exam format, and how to pass on your first attempt.
        </p>

        {/* Action Card */}
        <div className="mt-8 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-zinc-900/80 p-6">
          <h2 className="text-xl font-bold text-zinc-100">Check your typing speed first</h2>
          <p className="mt-2 text-sm text-zinc-300">
            TranscribeMe looks for clean accuracy and steady speed (40 to 50+ WPM). Test your WPM on Kinetype before opening your application.
          </p>
          <ApplyBox>
            <Link
              href="/"
              className="rounded-xl bg-emerald-500 px-5 py-2.5 font-semibold text-zinc-950 transition hover:bg-emerald-400 text-sm shadow-md"
            >
              Take Free Typing Test
            </Link>
            <a
              href={AFFILIATE.transcribeme}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-5 py-2.5 font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400 text-sm"
            >
              Apply to TranscribeMe &rarr;
            </a>
          </ApplyBox>
        </div>

        <h2 className="mt-12 text-2xl font-bold text-zinc-50">TranscribeMe vs Other Platforms</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 font-medium">TranscribeMe</th>
                <th className="px-4 py-3 font-medium">Rev</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-200">File Length</td>
                <td className="px-4 py-3 text-emerald-400">2 - 4 minutes (Short)</td>
                <td className="px-4 py-3">5 - 60+ minutes</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-200">Difficulty</td>
                <td className="px-4 py-3 text-emerald-400">Beginner Friendly</td>
                <td className="px-4 py-3">Intermediate</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-200">Average Rate</td>
                <td className="px-4 py-3">$15 - $22 / audio hr (published)</td>
                <td className="px-4 py-3">$18 - $66 / audio hr (published)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-200">Realistic Take-Home</td>
                <td className="px-4 py-3" colSpan={2}>$2 - $6 / hr effective after real work time (2-4x the audio length)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-200">Payment Schedule</td>
                <td className="px-4 py-3">Weekly (PayPal)</td>
                <td className="px-4 py-3">Weekly (PayPal)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 text-2xl font-bold text-zinc-50">Step-by-Step Passing Strategy</h2>
        <ul className="mt-4 space-y-3 text-zinc-400 leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-zinc-200">Memorize the Clean Verbatim Rules:</strong> TranscribeMe does not want filler words (like &quot;um&quot;, &quot;uh&quot;, or throat clearing) unless specifically asked for full verbatim.
          </li>
          <li>
            <strong className="text-zinc-200">Keep Accuracy Above 98%:</strong> Double-check spelled names, numbers, and capitalization before submitting your exam audio files.
          </li>
          <li>
            <strong className="text-zinc-200">Use Foot Pedal or Shortcut Keys:</strong> Use hotkeys (e.g. Esc for play/pause, F1/F2 for rewind) so your hands never leave the keyboard.
          </li>
        </ul>

        {/* CTA Banner */}
        <div className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
          <h3 className="text-xl font-bold text-zinc-100">Ready to start with TranscribeMe?</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Sign up, take their introductory style exam, and start earning weekly.
          </p>
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-4 inline-block rounded-xl bg-emerald-500 px-6 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400 text-sm shadow-md"
          >
            Apply to GoTranscript
          </a>
          <a
            href={AFFILIATE.transcribeme}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-3 inline-block rounded-xl border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400 text-sm"
          >
            Apply to TranscribeMe Team
          </a>
          <p className="mt-3 text-xs text-zinc-500">
            GoTranscript also hires beginners with no speed gate, pays per audio minute, and
            is a strong second application alongside TranscribeMe.
          </p>
        </div>

        <p className="mt-8 text-xs text-zinc-400">{AFFILIATE_DISCLOSURE}</p>
      </article>

      {/* FAQ */}
      <section className="mt-14">

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Related guides</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li>
              <Link href="/how-to-get-transcription-jobs" className="font-medium text-emerald-400 transition hover:text-emerald-300">
                how to get transcription jobs online
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
