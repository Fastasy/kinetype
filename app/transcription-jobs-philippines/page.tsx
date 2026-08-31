import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Transcription Jobs Philippines (2026): Real Pay & Requirements",
  description:
    "Real 2026 pay for transcription jobs in the Philippines: GoTranscript, Rev, TranscribeMe and Scribie rates, application gates, AI reality, and scam red flags.",
  alternates: {
    canonical: "/transcription-jobs-philippines",
  },
  openGraph: {
    title: "Transcription Jobs Philippines (2026): Real Pay & Requirements",
    description:
      "Real 2026 pay for transcription jobs in the Philippines: rates, application gates, AI reality, and scam red flags.",
    url: "https://kinetype.app/transcription-jobs-philippines",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Transcription jobs in the Philippines guide",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Transcription Jobs Philippines (2026): Real Pay & Requirements",
    description:
      "Real 2026 pay for transcription jobs in the Philippines: rates, application gates, AI reality, and scam red flags.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "How much do transcription jobs in the Philippines pay in 2026?",
    a: "Published rates run from $0.40 to $1.75 per audio minute (Rev and GoTranscript) or $5 to $25 per audio hour (Scribie). After real work time of 2 to 4 times the audio length, effective pay lands around $2 to $6 an hour, roughly ₱123 to ₱369.",
  },
  {
    q: "Do I need a fast typing speed to get hired?",
    a: "No. TranscribeMe explicitly does not hire based on typing speed. GoTranscript and Scribie test accuracy, and Rev suggests aiming for 60 WPM for legal work. The hard gates live elsewhere: 35 WPM for CSC clerical roles and the Mercer/Mettl tests used in BPO hiring.",
  },
  {
    q: "Which transcription companies hire Filipinos right now?",
    a: "GoTranscript has hiring fully open for Filipino speakers with a dedicated Filipino page. Rev's application is live. TranscribeMe hires globally, including the Philippines. Scribie certifies new applicants with a verified PayPal account. OnlineJobs.ph carries active 2026 transcription ads, including medical scribe roles.",
  },
  {
    q: "Is transcription still worth it now that AI exists?",
    a: "Raw verbatim typing of easy audio is shrinking. Human QC and AI draft editing is growing: Scribie runs AI drafts edited by humans, employers post AI QA roles, and medical, legal, and Philippine language work is where demand sits.",
  },
  {
    q: "How do I spot a transcription job scam?",
    a: "The CICC logged 10,004 scam complaints in 2024, up 202% year on year, with around ₱198 million lost. Red flags: pay to start, Telegram tasking or recharging schemes, and no resume asked. Legitimate platforms pay you, never the reverse.",
  },
  {
    q: "How long does it take to get accepted?",
    a: "GoTranscript says you can start within 30 minutes, with an answer in a few business days, after the quiz and sample. TranscribeMe requires studying a 39-page style guide and passing the entrance exam. Scribie gives you up to 10 attempts on the test file after setting up a verified PayPal account.",
  },
  {
    q: "How do I get paid?",
    a: "GoTranscript pays weekly on Fridays via PayPal, Payoneer, or USDC. Rev pays weekly via PayPal. Scribie pays daily via PayPal with a $1 minimum. Employers on OnlineJobs.ph pay through EasyPay inside the platform.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Transcription Jobs in the Philippines (2026): Real Pay, Real Requirements",
      description:
        "Real 2026 pay for transcription jobs in the Philippines: platform rates, application gates, AI reality, and scam red flags.",
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage: "https://kinetype.app/transcription-jobs-philippines",
      datePublished: "2026-08-18",
      dateModified: "2026-08-18",
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

export default function TranscriptionJobsPhilippinesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Transcription Jobs in the Philippines (2026): Real Pay, Real Requirements
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          Published 18 August 2026 · Updated 18 August 2026
        </p>

        <p className="mt-6 text-zinc-400">
          If you are searching for transcription jobs in the Philippines, the ads look great.
          Earn up to $105 per audio hour. Then you apply, pass the test, finish one file, and
          the math looks different. This guide covers what the platforms actually pay after
          real work time, who is hiring Filipinos right now, what the application gates test,
          where AI has changed the work, and how to spot a scam. Every figure below is from
          employer pages and public reports checked in August 2026.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">The honest rate table</h2>
        <p className="mt-3 text-zinc-400">
          Every platform publishes a per minute or per audio hour rate. Here they are side by
          side with the peso equivalent (about 61.5 to the dollar).
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Published rate</th>
                <th className="px-4 py-3 font-medium">Face value per audio hour</th>
                <th className="px-4 py-3 font-medium">Peso equivalent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              <tr>
                <td className="px-4 py-3">GoTranscript</td>
                <td className="px-4 py-3">$0.50 to $1.20 per audio minute on the Filipino page (up to $1.75 on the jobs page)</td>
                <td className="px-4 py-3">About $30 to $105</td>
                <td className="px-4 py-3">Roughly ₱1,850 to ₱6,460</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Rev</td>
                <td className="px-4 py-3">$0.40 to $1.10 per audio or video minute</td>
                <td className="px-4 py-3">About $24 to $66</td>
                <td className="px-4 py-3">Roughly ₱1,480 to ₱4,060</td>
              </tr>
              <tr>
                <td className="px-4 py-3">TranscribeMe</td>
                <td className="px-4 py-3">$15 to $22 per audio hour</td>
                <td className="px-4 py-3">$15 to $22</td>
                <td className="px-4 py-3">Roughly ₱920 to ₱1,350</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Scribie</td>
                <td className="px-4 py-3">$5 to $25 per audio hour</td>
                <td className="px-4 py-3">$5 to $25</td>
                <td className="px-4 py-3">Roughly ₱310 to ₱1,540</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Now the part the ads skip: those rates are for the file, not for your time. A 10
          minute file at $1 a minute looks like $60 an hour. Then you listen, rewind, check
          spellings, follow the style guide, format, and proofread. Real work time usually
          runs 2 to 4 times the audio length, which puts effective pay around $2 to $6 an
          hour. That is roughly ₱123 to ₱369 an hour at current rates.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Treat the published rates as an upper bound, not a salary. The platforms below are
          real and hire Filipinos, but expect the first few weeks to be training pay while
          your accuracy comes up.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Which platforms are hiring Filipinos right now</h2>

        <h3 className="mt-6 text-lg font-bold text-zinc-100">GoTranscript</h3>
        <p className="mt-2 text-zinc-400">
          GoTranscript is the most explicitly pro-Philippines of the group. It runs a
          dedicated Filipino hiring page, says hiring is fully open, and lists major projects
          through 2026 spanning 130 languages (140+ overall), with more than $100 million
          paid to freelancers so far. The application is two steps: pass a guidelines quiz
          (A/B questions), then transcribe a short sample clip. GoTranscript says you can
          start within 30 minutes, with an answer in a few business days. Accuracy matters
          more than speed, and each language is a separate test. Pay runs $0.50 to $1.20 per
          audio minute on the Filipino page, paid weekly on Fridays via PayPal, Payoneer, or
          USDC.{" "}
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Apply to GoTranscript
          </a>
          .
        </p>

        <h3 className="mt-6 text-lg font-bold text-zinc-100">Rev</h3>
        <p className="mt-2 text-zinc-400">
          Rev hires transcribers, captioners, legal transcriptionists, and subtitle
          translators. The application is a form, a short English and grammar skills
          assessment, and a transcription sample. Pay is $0.40 to $1.10 per audio or video
          minute, paid weekly via PayPal. Rev guidance for legal transcription suggests
          typing 50 to 75 WPM, with 60 as the target.{" "}
          <a
            href={AFFILIATE.rev}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            Start the Rev freelancer application
          </a>
          .
        </p>

        <h3 className="mt-6 text-lg font-bold text-zinc-100">TranscribeMe</h3>
        <p className="mt-2 text-zinc-400">
          TranscribeMe hires globally, including the Philippines, and pays $15 to $22 per
          audio hour. The average earner takes home about $250 a month, and top monthly
          earners reach $2,200. The gate is a real exam: join free, train, then pass an
          entrance test built on a 39-page style guide, with pass rates set in the high 90s
          for accuracy. Clips run 2 to 4 minutes. Get through and you can advance to Special
          Teams, where medical work pays more.{" "}
          <a
            href={AFFILIATE.transcribeme}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            Apply at TranscribeMe jobs
          </a>
          .
        </p>

        <h3 className="mt-6 text-lg font-bold text-zinc-100">Scribie</h3>
        <p className="mt-2 text-zinc-400">
          Scribie uses a five-step certification: create an account, add a verified PayPal
          account (mandatory, you cannot skip it), work through practice files, pass a test
          file (10 attempts maximum), then you are certified. Files average about 6 minutes
          and pay $0.50 to $2.50 each, which works out to $5 to $25 per audio hour. Payments
          go out daily via PayPal with a $1 minimum. Scribie now runs a hybrid model where AI
          drafts the transcript and humans edit it, so the work you actually do is quality
          control.
        </p>

        <h3 className="mt-6 text-lg font-bold text-zinc-100">Job boards with live ads</h3>
        <p className="mt-2 text-zinc-400">
          Beyond the big platforms, OnlineJobs.ph has a live transcription category with 2026
          ads: a transcriber role at $600 to $700 a month, an AI quality assurance specialist
          reviewing AI-generated transcriptions of historical handwritten documents at $350 a
          month part time (20 hours a week), and medical scribes at $3 to $6 an hour.
          Jobstreet PH lists 63 live transcription jobs, and the listings skew heavily
          medical.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Do you need a fast typing speed? The actual gates</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The transcription platforms do not hire on typing speed. TranscribeMe says it in
          writing: they do not hire based on your typing speed. Their gate is accuracy and
          style adherence on the entrance exam. GoTranscript tests accuracy with its quiz and
          sample. Scribie targets 99%+ accuracy on the test file. The only published Rev guidance is
          the 50 to 75 WPM range for legal work, with 60 as a target.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The hard WPM gates live in government and BPO hiring. The Civil Service Commission
          requires 35 WPM on a 5 minute English typing test for clerical roles like Admin
          Aide, Clerk, and Encoder, with local government units asking 30 to 35 WPM,
          stenographer roles 40+, and accuracy around 95%. BPO and shared services data
          entry roles run typing speed, accuracy, and data validation tests, like the 40
          minute Mercer/Mettl Data Entry Operators Hiring Test.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          So if a transcription ad tells you to hit 80 WPM or you are out, that is not how
          these platforms work. You need accuracy, stamina, and clean output under time
          pressure, exactly what timed typing practice trains.{" "}
          <Link href="/" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            Take the free typing test at Kinetype
          </Link>{" "}
          before you apply. It scores WPM and accuracy, and the timed practice is the closest
          thing to the TranscribeMe exam and the CSC test you can do at home. If you can hold
          60 WPM with high accuracy, you clear the typing gate for almost every role in this
          article.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">What AI actually changed</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          IMF working paper WP/25/43 (February 2025) classifies about a third of Philippine
          occupations as highly exposed to AI and flags BPO workers as highly exposed with
          low complementarity. BPO is roughly 3% of the workforce but 7.4% of GDP, which is
          why this matters beyond individual jobs.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Here is what is happening on the ground. Raw verbatim typing of easy audio is
          shrinking, because auto-transcription handles it. What is growing is human work
          around the machine. Scribie already runs AI drafts edited by humans. Employers on
          OnlineJobs.ph are advertising AI quality assurance roles. The Transcription
          Certification Institute reported in January 2026 that employers still hire humans
          for accuracy, context, formatting, and QC, and the job is becoming editing AI
          drafts. Medical and legal scribing is where the listings are. Philippine language
          work is open too: the ICC opened a freelance roster for Tagalog and Cebuano
          transcribers in January 2025, and GoTranscript maintains a Filipino language track.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Treat transcription as an entry point and a skills accelerator, not a gold mine.
          The easy files are automated. The well paid work is human QC, medical and legal
          specialization, and PH language work. The skill that gets you past every test is
          typing accuracy.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Scam red flags: the 2026 reality</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Scam exposure is real and getting worse. The CICC logged 10,004 online scam
          complaints in 2024, up 202% year on year, with around ₱198 million lost. The SEC
          issued a fresh warning in July 2025 about job offer scams. The pattern is
          consistent: pay to start, Telegram tasking or recharging schemes, and no resume
          asked. Kung may nagpabayad sa iyo para mag-apply, takbo ka na. Legitimate platforms
          pay you for work. They never charge you to apply, and they do not recruit through
          Telegram tasking groups.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">Practice before you apply</h2>
        <p className="mt-3 text-zinc-400">
          The short path:{" "}
          <Link href="/" className="font-medium text-emerald-400 transition hover:text-emerald-300">
            take the free typing test
          </Link>
          , drill to 60 WPM with high accuracy, then apply in this order: GoTranscript
          (fastest gate), TranscribeMe (clear exam process), Rev, and Scribie.
        </p>
        <ul className="mt-4 space-y-2 text-zinc-400">
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
        <p className="mt-4 text-sm text-zinc-400">
          Once you are earning, AI editing tools like{" "}
          <a
            href={AFFILIATE.sonix}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            Sonix
          </a>{" "}
          and{" "}
          <a
            href={AFFILIATE.descript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            Descript
          </a>{" "}
          can speed up the QC work that is actually in demand.
        </p>
        <p className="mt-4 text-xs text-zinc-600">{AFFILIATE_DISCLOSURE}</p>

        <h2 className="mt-10 text-xl font-bold text-zinc-50">Related guides</h2>
        <ul className="mt-3 space-y-2 text-zinc-400">
          <li>
            <Link href="/how-to-become-a-virtual-assistant-philippines" className="font-medium text-emerald-400 transition hover:text-emerald-300">
              How to become a virtual assistant in the Philippines
            </Link>
          </li>
          <li>
            <Link href="/typing-test-wfh-jobs" className="font-medium text-emerald-400 transition hover:text-emerald-300">
              Free typing speed test: which WFH jobs can you qualify for?
            </Link>
          </li>
          <li>
            <Link href="/rev-typing-test" className="font-medium text-emerald-400 transition hover:text-emerald-300">
              Rev typing test requirements and practice
            </Link>
          </li>
          <li>
            <Link href="/transcribeme-typing-test" className="font-medium text-emerald-400 transition hover:text-emerald-300">
              TranscribeMe exam and typing test guide
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
