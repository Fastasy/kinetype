import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Encoding Jobs in the Philippines: Pay and How to Start",
  description:
    "What encoding work really is, what encoder jobs pay in the Philippines, where the real jobs are posted, and how to avoid the scams.",
  alternates: {
    canonical: "/encoding-jobs-philippines",
  },
  openGraph: {
    title: "Encoding Jobs in the Philippines: Pay and How to Start",
    description:
      "What encoding work really is, what encoder jobs pay in the Philippines, where the real jobs are posted, and how to avoid the scams.",
    url: "https://kinetype.app/encoding-jobs-philippines",
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
    title: "Encoding Jobs in the Philippines: Pay and How to Start",
    description:
      "What encoding work really is, what encoder jobs pay in the Philippines, where the real jobs are posted, and how to avoid the scams.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "How much do data encoders earn in the Philippines?",
    a: "Entry-level office encoder roles start around PHP 12,000 to 18,000 a month. Freelance rates vary widely by task and client, so the monthly figure depends on how much work you take. Senior or specialist roles pay more.",
  },
  {
    q: "Do encoding jobs require experience?",
    a: "Most entry-level roles do not. Employers test your typing speed and basic spreadsheet skills instead. A small sample of work, like a cleaned spreadsheet you did at home, helps more than a long resume.",
  },
  {
    q: "Is encoding work from home real?",
    a: "Yes, but it is rarer than the ads suggest. Real remote encoding jobs exist on Upwork and OnlineJobs.ph, and overseas clients hire Philippine encoders full time. Anything that asks you to pay to start is not a job, it is a scam.",
  },
  {
    q: "What typing speed do I need?",
    a: "Most encoder postings ask for 35 to 45 WPM. Government clerical roles in other markets screen at 35 WPM with around 95% accuracy. Measure yours on the free Kinetype test before you apply, and practice daily until you clear the posting's number.",
  },
  {
    q: "How do I avoid encoding job scams?",
    a: "Never pay to apply or train. Real employers do not charge for applications, tests, or certificates. Check the company on the SEC Philippines registry, search the ad text, and leave if they push for payment or personal banking details.",
  },
  {
    q: "What software do I need?",
    a: "A spreadsheet program, a text editor, and a reliable browser cover nearly all encoder work. Most employers use Google Sheets or Excel, and some use data entry portals. Nothing expensive is required to start.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Encoding Jobs in the Philippines: Pay and How to Start",
      description:
        "What encoding work really is, what encoder jobs pay in the Philippines, where the real jobs are posted, and how to avoid the scams.",
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage: "https://kinetype.app/encoding-jobs-philippines",
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

export default function EncodingJobsPhilippinesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Encoding jobs in the Philippines
        </h1>
        <p className="mt-3 text-zinc-400">
          Encoding jobs in the Philippines are entry-level data work: typing information into
          spreadsheets, forms, and databases for a set hourly rate or monthly salary. Real encoding
          jobs exist, but so do scams that target this exact search, so knowing where to look matters
          as much as typing speed.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What encoding work actually is</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Data encoding means entering and cleaning data, not creative work. Encoders type figures
          into spreadsheets, encode forms, update customer records, and check files for errors. Most
          of it is straightforward and repetitive, which is exactly why employers screen for typing
          speed and basic spreadsheet skills.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          A typical day involves forms, invoices, product catalogs, or customer records that need
          clean entry. Some roles add light verification work, like checking that totals match. The
          common thread is that output quality is measured by error rate, so a careful typist beats a
          fast one.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The name confuses people because encoding sounds technical. In practice it is typing work:
          taking information from one format and entering it into another. That is why the job ads
          ask for typing speed and spreadsheet basics before anything else. Employers use the words
          encoder and{" "}
          <Link href="/data-entry-jobs-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            data entry
          </Link>{" "}
          interchangeably in Philippine postings, so search both terms to catch every opening.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          How much do encoder jobs pay in the Philippines?
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Full-time encoder roles in local offices typically start around PHP 12,000 to 18,000 per
          month for entry-level work. Freelance rates vary far more, from per-task pricing to hourly
          rates, so compare carefully. Treat any ad promising PHP 500 a day from home with suspicion
          until the employer is verified.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The gap between local and remote pay is real, and it is why many encoders use remote work
          to climb. Entry-level remote rates still sit near the bottom of the freelance market, so
          treat the big claims in ads as marketing, not salary data.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Where the real jobs are posted</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Jobstreet and Indeed PH carry the bulk of local office encoder roles. For remote work,
          Upwork and OnlineJobs.ph are the main marketplaces, and Facebook groups for Filipino
          freelancers post daily openings. Skip the ads that appear in random comment sections and
          messenger spam.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Jobstreet and Indeed PH are the safest starting points because they host verified
          companies. Upwork and OnlineJobs.ph add overseas clients who hire Philippine encoders full
          time. Facebook groups move faster but have no vetting, so check each employer before
          sharing anything.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What you need to get hired</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Employers look for 35 to 45 WPM, basic spreadsheet skills, and working English. A clean
          resume with your typing speed measured on a real test helps. No degree is required for most
          entry-level encoding roles, and companies that hire remote encoders usually test you before
          the interview.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Measure your speed on the free{" "}
          <Link href="/" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            Kinetype typing test
          </Link>{" "}
          before you apply, and put the real number on your resume. Employers test you anyway, so an
          honest baseline stops you from applying to roles you cannot pass yet. If you are under 35
          WPM, two weeks of daily practice usually closes the gap.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          English matters more for remote roles, because overseas clients communicate in English and
          expect clean emails. Local office roles lean on Filipino plus enough English for the
          software and forms. Either way, most encoder interviews are short: expect an on-the-spot
          typing and spreadsheet check.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          If you want paid typing work while you look for a full-time encoder role, transcription
          platforms hire from the Philippines and test you during the application:
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
          The{" "}
          <Link href="/transcription-jobs-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            transcription jobs in the Philippines
          </Link>{" "}
          guide covers that route in detail, and if you speak Tagalog,{" "}
          <Link href="/tagalog-transcription-jobs" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            Tagalog transcription
          </Link>{" "}
          sits at the higher end of the pay range. If you want to move past data entry entirely, the{" "}
          <Link href="/how-to-become-a-virtual-assistant-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            virtual assistant path
          </Link>{" "}
          is the natural next step, with OnlineJobs.ph listings commonly advertising $4 to $5 an hour
          for entry VA work.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">How to start this week</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Take the free Kinetype typing test today to get your real WPM, then fix your resume to one
          page and list the skills in the posting. Create profiles on Jobstreet, Indeed PH, and
          OnlineJobs.ph, and apply to five to ten roles a day. Most local employers reply within a
          week.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Do the applications in batches: mornings for local postings, evenings for overseas clients,
          because time zones matter for replies. Keep a simple tracker of where you applied and what
          the employer does, so you can spot a scam pattern early. Ten focused applications beat
          fifty rushed ones.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Scam warning</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Never pay to apply for a job, ever. The classic scams in this niche ask for an activation
          fee, sell captcha encoding work, or promise typing jobs that pay per character. Real
          employers pay you, and real remote work never asks for a deposit before your first payslip.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The captcha encoding ads are the classic trap: you type captchas for a promised payout that
          never comes, after paying a registration fee. Genuine employers in the Philippines are
          registered with the SEC, and genuine recruiters never ask for payment, bank passwords, or a
          processing fee at any stage.
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
