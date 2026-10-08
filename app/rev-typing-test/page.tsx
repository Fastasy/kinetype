import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";
import ApplyBox from "@/components/ApplyBox";

export const metadata: Metadata = {
  title: "Rev Typing Test: Requirements, Tips & Practice",
  description:
    "Everything you need to pass the Rev transcriptionist typing test in 2026: WPM speed requirements, accuracy standards, exam breakdown, and free test practice.",
  alternates: {
    canonical: "/rev-typing-test",
  },
  openGraph: {
    title: "Rev Typing Test: WPM Requirements, Exam Tips & Practice",
    description:
      "Pass the Rev transcription typing test: required WPM speed, accuracy thresholds, and free test practice.",
    type: "article",
    url: "https://www.kinetype.app/rev-typing-test",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Rev typing test speed guide and practice",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rev Typing Test: WPM Requirements, Exam Tips & Practice",
    description:
      "Pass the Rev transcription typing test: required WPM speed, accuracy thresholds, and free test practice.",
    images: ["/og.png"],
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
    a: "Rev transcriptionists earn between $0.30 and $1.10 per audio minute. That is the published rate; real work time runs 2 to 4 times the audio length, so effective earnings usually land between $2 and $6 an hour.",
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
      keywords: ['rev typing test', 'rev transcription', 'wpm requirements'],
      author: { "@type": "Organization", name: "Kinetype", url: "https://www.kinetype.app/", logo: "https://www.kinetype.app/og.png" },
      publisher: { "@type": "Organization", name: "Kinetype", url: "https://www.kinetype.app/", logo: "https://www.kinetype.app/og.png" },
      mainEntityOfPage: "https://www.kinetype.app/rev-typing-test",
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

export default function RevTypingTestPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-bright border border-brand/20">
          Career Guide & Exam Prep
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Rev Typing Test: Passing Score, Requirements & Practice
        </h1>
        <p className="mt-4 text-lg text-ink-soft leading-relaxed">
          Want to get paid typing from home for Rev? Here is an exact breakdown of what Rev looks for on the typing assessment, how the evaluation works, and how to guarantee a passing score.
        </p>

        {/* Action Card */}
        <div className="mt-8 rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/10 to-card/80 p-6">
          <h2 className="text-xl font-bold text-ink">Test your speed before applying</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Rev requires <strong>45 to 50+ WPM</strong> with strict punctuation and capitalization accuracy. Check your WPM score on Kinetype right now.
          </p>
          <ApplyBox>
            <Link
              href="/typing-speed-test"
              className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-brand-deep transition hover:bg-brand-bright text-sm shadow-md"
            >
              Take Free Typing Test
            </Link>
            <a
              href={AFFILIATE.rev}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="rounded-xl border border-line-strong bg-line px-5 py-2.5 font-semibold text-ink transition hover:border-brand hover:text-brand-bright text-sm"
            >
              Apply to Rev Directly &rarr;
            </a>
          </ApplyBox>
        </div>

        <h2 className="mt-12 text-2xl font-bold text-ink">Rev Typing Speed & Accuracy Requirements</h2>
        <p className="mt-3 text-ink-soft leading-relaxed">
          Rev does not reject applicants solely based on a rigid WPM cutoff, but they expect freelance transcriptionists to produce clean transcripts efficiently. Here are the realistic targets:
        </p>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-card text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Metric</th>
                <th className="px-4 py-3 font-medium">Minimum</th>
                <th className="px-4 py-3 font-medium">Recommended for Good Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink-soft">
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Typing Speed</td>
                <td className="px-4 py-3 font-mono">40 WPM</td>
                <td className="px-4 py-3 font-mono text-brand-bright">55 - 75+ WPM</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Accuracy</td>
                <td className="px-4 py-3 font-mono">95%</td>
                <td className="px-4 py-3 font-mono text-brand-bright">98% - 100%</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Punctuation</td>
                <td className="px-4 py-3">Basic</td>
                <td className="px-4 py-3 text-brand-bright">Full Rev Style Guide adherence</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 text-2xl font-bold text-ink">3 Tips to Pass the Rev Audio Assessment</h2>
        <ol className="mt-4 space-y-4 text-ink-soft leading-relaxed list-decimal list-inside">
          <li>
            <strong className="text-ink">Study the Rev Style Guide:</strong> Most candidates fail not because of typing speed, but because of formatting rules (e.g. verbatim vs non-verbatim, handling inaudibles, and speaker tags).
          </li>
          <li>
            <strong className="text-ink">Practice with Punctuation Mode:</strong> Rev penalizes run-on sentences and missing commas. Use the Kinetype <em>! punctuation</em> mode to build muscle memory for quotes, commas, and hyphens.
          </li>
          <li>
            <strong className="text-ink">Use Good Headphones:</strong> Accurate audio transcription depends on hearing muffled words and background speakers clearly.
          </li>
        </ol>

        {/* CTA Footer */}
        <div className="mt-12 rounded-2xl border border-line bg-card/60 p-6 text-center">
          <h3 className="text-xl font-bold text-ink">Ready to join Rev?</h3>
          <p className="mt-2 text-sm text-ink-soft">
            Pass the test, start claiming audio files, and receive weekly payouts via PayPal.
          </p>
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-4 inline-block rounded-xl bg-brand px-6 py-3 font-bold text-brand-deep transition hover:bg-brand-bright text-sm shadow-md"
          >
            Apply to GoTranscript
          </a>
          <a
            href={AFFILIATE.rev}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-3 inline-block rounded-xl border border-line-strong px-6 py-3 font-semibold text-ink transition hover:border-brand hover:text-brand-bright text-sm"
          >
            Start Rev Freelancer Application
          </a>
          <p className="mt-3 text-xs text-ink-faint">
            GoTranscript also hires beginners, pays per audio minute, and is another solid
            first application alongside Rev.
          </p>
        </div>

        <p className="mt-8 text-xs text-ink-soft">{AFFILIATE_DISCLOSURE}</p>
      </article>

      {/* FAQ */}
      <section className="mt-14">

        <h2 className="mt-10 text-2xl font-bold text-ink">Related guides</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <Link href="/how-to-get-transcription-jobs" className="font-medium text-brand-bright transition hover:text-brand-bright">
                how to get transcription jobs online
              </Link>
            </li>
        </ul>

        <h2 className="text-2xl font-bold text-ink">Frequently asked questions</h2>
        <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {FAQS.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium text-ink transition group-open:text-brand-bright">
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
