import type { Metadata } from "next";
import Link from "next/link";
import EarningsCalculator from "@/components/EarningsCalculator";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Transcription Jobs: Where to Find Them in 2026",
  description:
    "Transcription jobs in 2026: what they pay, what you need, and which companies hire from home. Start with a free typing speed test.",
  alternates: {
    canonical: "/transcription-jobs",
  },
  openGraph: {
    title: "Transcription Jobs: Where to Find Them in 2026",
    description:
      "What transcription jobs pay, what you need, and which companies hire from home in 2026.",
    url: "https://kinetype.com/transcription-jobs",
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
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage: "https://kinetype.com/transcription-jobs",
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

export default function TranscriptionJobsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Transcription jobs: where to find them in 2026
        </h1>
        <p className="mt-3 text-zinc-400">
          Transcription is one of the few work from home jobs where typing speed is the
          actual job requirement. If you can type fast and accurately, you already have
          the core skill. Here is what the market looks like in 2026 and where to apply.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">The honest picture</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          AI changed transcription. Zoom, Teams and Meet all produce auto transcripts, so
          the easy work is gone. What remains is the work software gets wrong: bad audio,
          multiple speakers, accents, legal terms and formatting. Companies still hire
          humans for exactly that. GoTranscript, one of the larger platforms, says it is
          short on transcribers and editors and hires across 140 languages. That is the
          market signal: the people who can deliver clean transcripts are in demand.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What you need to start</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-400">
          <li>
            A typing speed of at least 40 to 60 WPM. Not sure where you stand?{" "}
            <Link href="/" className="font-medium text-emerald-400 transition hover:text-emerald-300">
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

        <h2 className="mt-12 text-2xl font-bold text-zinc-50">Where to apply</h2>
        <p className="mt-3 text-zinc-400">
          These platforms hire beginners, pay via PayPal or bank transfer, and publish
          their own tests and rates. We may earn a commission if you sign up through the
          links below, at no cost to you.
        </p>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="text-lg font-bold text-zinc-50">Rev</h3>
            <p className="mt-1 text-sm text-zinc-400">
              One of the largest transcription and captioning platforms. Applications start
              with a typing and grammar test, then a sample transcription. Accepts
              contractors worldwide.
            </p>
            <a
              href={AFFILIATE.rev}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-3 inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Apply to work at Rev
            </a>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="text-lg font-bold text-zinc-50">GoTranscript</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Hires transcribers and editors in 140 languages, including Afrikaans and
              English. You apply per language and take a test for each one.
            </p>
            <a
              href={AFFILIATE.gotranscript}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-3 inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Apply to GoTranscript
            </a>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="text-lg font-bold text-zinc-50">AI transcription tools</h3>
            <p className="mt-1 text-sm text-zinc-400">
              If you produce podcasts, meetings or videos, these tools draft the transcript
              for you and free you up for the jobs that need a human ear. Affiliate links.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={AFFILIATE.sonix}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
              >
                Sonix
              </a>
              <a
                href={AFFILIATE.descript}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
              >
                Descript
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="text-lg font-bold text-zinc-50">TranscribeMe and Scribie</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Smaller platforms that take beginners with short sample tests. Good for your
              first few jobs while you build a track record.
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Search for their current openings; both are usually open to South African
              applicants as contractors.
            </p>
          </div>
        </div>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">South African context</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          If you are in South Africa, the same global platforms apply, and the local call
          centre market is a related option. In 2026, CCI call centre assessments ask for
          25 to 45 WPM depending on the role, with 95% accuracy, tested in a supervised
          lab. Passing that test is a gateway into a stable job. Transcription is the
          freelance version of the same skill set.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Your next step</h2>
        <p className="mt-3 text-zinc-400">
          Know your number before you apply. Take the typing test, note your WPM and
          accuracy, then practice for a week if you are below 45 WPM. Most people gain 5
          to 10 WPM in a few weeks of daily practice, and that difference decides whether
          you pass the application test.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          Take the free typing test
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
