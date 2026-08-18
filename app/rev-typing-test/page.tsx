import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Rev Typing Test: WPM Requirements, Exam Tips & Practice (2026)",
  description:
    "Everything you need to pass the Rev transcriptionist typing test in 2026: WPM speed requirements, accuracy standards, exam breakdown, and free test practice.",
  alternates: {
    canonical: "/rev-typing-test",
  },
  openGraph: {
    title: "Rev Typing Test: WPM Requirements, Exam Tips & Practice",
    description:
      "Pass the Rev transcription typing test: required WPM speed, accuracy thresholds, and free test practice.",
    url: "https://kinetype.app/rev-typing-test",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Rev typing test speed guide and practice",
      },
    ],
  },
};

const FAQS = [
  {
    q: "What WPM typing speed does Rev require?",
    a: "Rev recommends a minimum typing speed of 45 to 50+ WPM with at least 95% to 98% accuracy. While typing speed helps you earn more per hour, accuracy is the most critical metric during their applicant review.",
  },
  {
    q: "What is included in the Rev application test?",
    a: "The Rev application includes two parts: a grammar and style quiz based on the Rev Style Guide, followed by a real audio transcription test where you transcribe and format a short audio sample.",
  },
  {
    q: "How much can you earn on Rev?",
    a: "Rev transcriptionists earn between $0.30 and $1.10 per audio minute. Top typists earn between $15 and $30 per hour depending on audio quality and typing speed.",
  },
  {
    q: "Can I retake the Rev test if I fail?",
    a: "If your initial application is rejected, Rev typically allows applicants to reapply after 45 to 90 days. We recommend practicing daily on Kinetype to boost your speed and accuracy before re-submitting.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Rev Typing Test: WPM Requirements, Exam Tips & Practice",
      description:
        "Comprehensive guide to passing the Rev freelancer transcriptionist test in 2026.",
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage: "https://kinetype.app/rev-typing-test",
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

export default function RevTypingTestPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
          Career Guide & Exam Prep
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Rev Typing Test: Passing Score, Requirements & Practice
        </h1>
        <p className="mt-4 text-lg text-zinc-400 leading-relaxed">
          Want to get paid typing from home for Rev? Here is an exact breakdown of what Rev looks for on the typing assessment, how the evaluation works, and how to guarantee a passing score.
        </p>

        {/* Action Card */}
        <div className="mt-8 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-zinc-900/80 p-6">
          <h2 className="text-xl font-bold text-zinc-100">Test your speed before applying</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Rev requires <strong>45–50+ WPM</strong> with strict punctuation and capitalization accuracy. Check your WPM score on Kinetype right now.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl bg-emerald-500 px-5 py-2.5 font-semibold text-zinc-950 transition hover:bg-emerald-400 text-sm shadow-md"
            >
              Take Free Typing Test
            </Link>
            <a
              href={AFFILIATE.rev}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-5 py-2.5 font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400 text-sm"
            >
              Apply to Rev Directly &rarr;
            </a>
          </div>
        </div>

        <h2 className="mt-12 text-2xl font-bold text-zinc-50">Rev Typing Speed & Accuracy Requirements</h2>
        <p className="mt-3 text-zinc-400 leading-relaxed">
          Rev does not reject applicants solely based on a rigid WPM cutoff, but they expect freelance transcriptionists to produce clean transcripts efficiently. Here are the realistic targets:
        </p>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Metric</th>
                <th className="px-4 py-3 font-medium">Minimum</th>
                <th className="px-4 py-3 font-medium">Recommended for Good Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-200">Typing Speed</td>
                <td className="px-4 py-3 font-mono">40 WPM</td>
                <td className="px-4 py-3 font-mono text-emerald-400">55 - 75+ WPM</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-200">Accuracy</td>
                <td className="px-4 py-3 font-mono">95%</td>
                <td className="px-4 py-3 font-mono text-emerald-400">98% - 100%</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-200">Punctuation</td>
                <td className="px-4 py-3">Basic</td>
                <td className="px-4 py-3 text-emerald-400">Full Rev Style Guide adherence</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 text-2xl font-bold text-zinc-50">3 Tips to Pass the Rev Audio Assessment</h2>
        <ol className="mt-4 space-y-4 text-zinc-400 leading-relaxed list-decimal list-inside">
          <li>
            <strong className="text-zinc-200">Study the Rev Style Guide:</strong> Most candidates fail not because of typing speed, but because of formatting rules (e.g. verbatim vs non-verbatim, handling inaudibles, and speaker tags).
          </li>
          <li>
            <strong className="text-zinc-200">Practice with Punctuation Mode:</strong> Rev penalizes run-on sentences and missing commas. Use the Kinetype <em>! punctuation</em> mode to build muscle memory for quotes, commas, and hyphens.
          </li>
          <li>
            <strong className="text-zinc-200">Use Good Headphones:</strong> Accurate audio transcription depends on hearing muffled words and background speakers clearly.
          </li>
        </ol>

        {/* CTA Footer */}
        <div className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
          <h3 className="text-xl font-bold text-zinc-100">Ready to join Rev?</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Pass the test, start claiming audio files, and receive weekly payouts via PayPal.
          </p>
          <a
            href={AFFILIATE.rev}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-4 inline-block rounded-xl bg-emerald-500 px-6 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400 text-sm shadow-md"
          >
            Start Rev Freelancer Application
          </a>
        </div>

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
