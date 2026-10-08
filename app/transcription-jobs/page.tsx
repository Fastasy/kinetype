import type { Metadata } from "next";
import Link from "next/link";
import EarningsCalculator from "@/components/EarningsCalculator";
import ApplyBox from "@/components/ApplyBox";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Transcription Jobs: Where to Find Them in 2026",
  description:
    "Transcription jobs in 2026: what they pay after real work time, what you need, and which companies hire from home. Start with a free typing test.",
  alternates: {
    canonical: "/transcription-jobs",
  },
  openGraph: {
    type: "article",
    title: "Transcription Jobs: Where to Find Them in 2026",
    description:
      "What transcription jobs pay, what you need, and which companies hire from home in 2026.",
    url: "https://www.kinetype.app/transcription-jobs",
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
    title: "Transcription Jobs: Where to Find Them in 2026",
    description:
      "What transcription jobs pay, what you need, and which companies hire from home in 2026.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "Do transcription jobs still exist with AI around?",
    a: "Yes, but the work changed. AI drafts most transcripts now, so companies hire humans to fix accuracy, formatting and context that software still misses. GoTranscript says it is hiring across 140 languages and has paid freelancers more than $100 million over its history. The bar moved from raw speed to accuracy and judgment.",
  },
  {
    q: "How fast do I need to type for transcription jobs?",
    a: "Most transcription companies expect at least 40 to 60 WPM, and accuracy matters more than raw speed. Start with the free Kinetype test to see where you stand, then practice daily until your score is comfortable above the requirement.",
  },
  {
    q: "How much do transcription jobs pay?",
    a: "Rates vary widely by company, language and whether the work is general, legal or medical. Many companies pay per audio minute rather than per hour, so your effective hourly rate depends on how fast you work. Check each company's published rates before you apply.",
  },
  {
    q: "Do I need a certificate or course first?",
    a: "No. The biggest employers hire beginners after a short test and a sample transcription. Specialized fields like medical or legal transcription usually need extra training, and there are courses for those, but general transcription is mostly a skills test.",
  },
  {
    q: "Can I do transcription jobs from South Africa?",
    a: "Yes. Global companies like Rev and GoTranscript accept applicants worldwide as independent contractors. You need a computer, stable internet, headphones and a quiet space. Payment arrives via PayPal or bank transfer depending on the platform.",
  },
  {
    q: "How do I prove my typing speed to an employer?",
    a: "Most employers run their own typing test as part of the application, so a certificate alone does not get you hired. It still helps to know your number first, because it tells you which roles you can realistically apply for.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Transcription Jobs: Where to Find Them in 2026",
      description:
        "What transcription jobs pay, what you need, and which companies hire from home in 2026.",
      keywords: ['transcription jobs', 'work from home', 'transcriptionist'],
      author: { "@type": "Organization", name: "Kinetype", url: "https://www.kinetype.app/", logo: "https://www.kinetype.app/og.png" },
      publisher: { "@type": "Organization", name: "Kinetype", url: "https://www.kinetype.app/", logo: "https://www.kinetype.app/og.png" },
      mainEntityOfPage: "https://www.kinetype.app/transcription-jobs",
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

export default function TranscriptionJobsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Transcription jobs: where to find them in 2026
        </h1>
        <p className="mt-3 text-ink-soft">
          Transcription is one of the few work from home jobs where typing speed is the
          actual job requirement. If you can type fast and accurately, you already have
          the core skill. Here is what the market looks like in 2026 and where to apply.
        </p>

        <ApplyBox>
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-deep transition hover:bg-brand-bright"
          >
            Apply to GoTranscript
          </a>
          <a
            href={AFFILIATE.rev}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand-bright"
          >
            Apply to work at Rev
          </a>
          <a
            href={AFFILIATE.transcribeme}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand-bright"
          >
            Apply to TranscribeMe
          </a>
        </ApplyBox>

        <h2 className="mt-10 text-2xl font-bold text-ink">The honest picture</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          AI changed transcription. Zoom, Teams and Meet all produce auto transcripts, so
          the easy work is gone. What remains is the work software gets wrong: bad audio,
          multiple speakers, accents, legal terms and formatting. Companies still hire
          humans for exactly that. GoTranscript, one of the larger platforms, says it is
          short on transcribers and editors and hires across 140 languages. That is the
          market signal: the people who can deliver clean transcripts are in demand.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-ink">What you need to start</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
          <li>
            A typing speed of at least 40 to 60 WPM. Not sure where you stand?{" "}
            <Link href="/typing-speed-test" className="font-medium text-brand-bright transition hover:text-brand-bright">
              Take the free typing test
            </Link>{" "}
            first.
          </li>
          <li>
            Accuracy above speed. Most platforms want 95% or better, because every error
            is paid work you have to redo.
          </li>
          <li>
            A computer, stable internet and good headphones. A quiet space matters more
            than expensive gear.
          </li>
          <li>
            Basic grammar and punctuation. Employers test for it, so brush up if your
            writing is rusty.
          </li>
        </ul>

        {/* Interactive Earnings Calculator */}
        <div className="mt-10">
          <EarningsCalculator initialWpm={55} />
        </div>

        <h2 className="mt-12 text-2xl font-bold text-ink">Where to apply</h2>
        <p className="mt-3 text-ink-soft">
          These platforms hire beginners, pay via PayPal or bank transfer, and publish
          their own tests and rates. We may earn a commission if you sign up through the
          links below, at no cost to you.
        </p>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-line bg-card/50 p-5">
            <h3 className="text-lg font-bold text-ink">GoTranscript</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Hires transcribers and editors in 140 languages, including Afrikaans and
              English. You apply per language and take a test for each one.
            </p>
            <a
              href={AFFILIATE.gotranscript}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-deep transition hover:bg-brand-bright"
            >
              Apply to GoTranscript
            </a>
          </div>

          <div className="rounded-2xl border border-line bg-card/50 p-5">
            <h3 className="text-lg font-bold text-ink">Rev</h3>
            <p className="mt-1 text-sm text-ink-soft">
              One of the largest transcription and captioning platforms. Applications start
              with a typing and grammar test, then a sample transcription. Accepts
              contractors worldwide.
            </p>
            <a
              href={AFFILIATE.rev}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand-bright"
            >
              Apply to work at Rev
            </a>
          </div>

          <div className="rounded-2xl border border-line bg-card/50 p-5">
            <h3 className="text-lg font-bold text-ink">TranscribeMe and Scribie</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Smaller platforms that take beginners with short sample tests. Good for your
              first few jobs while you build a track record.
            </p>
            <a
              href={AFFILIATE.transcribeme}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-2 inline-block rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand-bright"
            >
              Apply to TranscribeMe
            </a>
            <p className="mt-2 text-sm text-ink-faint">
              Scribie has its own five-step certification and pays per finished file; check
              their current openings directly.
            </p>
          </div>
        </div>

        <h2 className="mt-10 text-2xl font-bold text-ink">South African context</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          If you are in South Africa, the same global platforms apply, and the local call
          centre market is a related option. In 2026, CCI call centre assessments ask for
          25 to 45 WPM depending on the role, with 95% accuracy, tested in a supervised
          lab. Passing that test is a gateway into a stable job. Transcription is the
          freelance version of the same skill set.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-ink">Your next step</h2>
        <p className="mt-3 text-ink-soft">
          Know your number before you apply. Take the typing test, note your WPM and
          accuracy, then practice for a week if you are below 45 WPM. Most people gain 5
          to 10 WPM in a few weeks of daily practice, and that difference decides whether
          you pass the application test.
        </p>
        <Link
          href="/typing-speed-test"
          className="mt-4 inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-brand-deep transition hover:bg-brand-bright"
        >
          Take the free typing test
        </Link>

        <p className="mt-8 text-xs text-ink-soft">{AFFILIATE_DISCLOSURE}</p>
      </article>

      {/* FAQ */}
      <section className="mt-14">

        <h2 className="mt-10 text-2xl font-bold text-ink">Related guides</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <Link href="/transcriptionist-salary" className="font-medium text-brand-bright transition hover:text-brand-bright">
                How much do transcriptionists actually earn
              </Link>
            </li>
            <li>
              <Link href="/how-to-get-transcription-jobs" className="font-medium text-brand-bright transition hover:text-brand-bright">
                how to get transcription jobs with no experience
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
