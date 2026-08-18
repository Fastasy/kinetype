import type { Metadata } from "next";
import Link from "next/link";
import TypingTest from "@/components/TypingTest";

export const metadata: Metadata = {
  title: "Kinetype | Free Typing Test, WPM Speed and Accuracy",
  description:
    "Take a free typing test and get your WPM and accuracy in under a minute. English, Afrikaans and code modes. Share your result or print a free certificate.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Kinetype | Free Typing Test, WPM Speed and Accuracy",
    description:
      "Take a free typing test and get your WPM and accuracy in under a minute. English, Afrikaans and code modes.",
    url: "https://kinetype.com/",
  },
};

const FAQS = [
  {
    q: "What is a typing test?",
    a: "A typing test measures how fast and how accurately you can type. You get a score in words per minute (WPM) and an accuracy percentage. Kinetype runs entirely in your browser, so there is nothing to install and no account to create.",
  },
  {
    q: "What is a good WPM score?",
    a: "Most people type between 35 and 45 WPM. Office and admin jobs usually ask for at least 35 to 45 WPM, data entry roles often want 40 to 60, and professional transcriptionists regularly type 60 WPM or more.",
  },
  {
    q: "Is Kinetype free?",
    a: "Yes. The typing test, the Afrikaans and code modes, and the printable certificate are all free. There is no account, no signup and no paywall.",
  },
  {
    q: "How is WPM calculated?",
    a: "WPM is calculated as correct characters typed, divided by 5 (the standard length of a word), divided by the minutes elapsed. Accuracy is correct characters divided by total characters typed. Backspaces do not count against your accuracy.",
  },
  {
    q: "Can I take an Afrikaans typing test?",
    a: "Yes. Switch the language to Afrikaans and the test uses common Afrikaans words, including characters like ê and ë. It works the same way as the English test.",
  },
  {
    q: "Can I get a typing certificate?",
    a: "Yes. After you finish a test you can open the free certificate, add your name, and print or save it as a PDF. It shows your WPM, accuracy and the date. Some employers run their own typing test as well, so treat the certificate as extra proof, not a replacement.",
  },
  {
    q: "How can I improve my typing speed?",
    a: "Practice for a few minutes every day and focus on accuracy before speed. Use all your fingers and keep your eyes on the screen instead of the keyboard. Most people gain 5 to 10 WPM within a few weeks of daily practice.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Kinetype",
      url: "https://kinetype.com/",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      description:
        "Free typing speed test with WPM and accuracy scores in English, Afrikaans and code modes.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a,
        },
      })),
    },
  ],
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="pt-12 text-center sm:pt-16">
        <h1 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
          The free typing test that gives you a real <span className="text-emerald-400">WPM score</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-400 sm:text-lg">
          Measure your typing speed and accuracy in under a minute. No signup, no install,
          no paywall. English, Afrikaans and code modes.
        </p>
      </section>

      {/* Test */}
      <section className="mt-8">
        <TypingTest />
      </section>

      {/* What your score means */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-zinc-50">What your score means</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">WPM</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Typical roles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              <tr>
                <td className="px-4 py-3 font-mono">20 - 35</td>
                <td className="px-4 py-3">Getting started</td>
                <td className="px-4 py-3">Most people land here before daily practice</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">35 - 55</td>
                <td className="px-4 py-3">Solid</td>
                <td className="px-4 py-3">Admin, call centre and general office work</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">55 - 75</td>
                <td className="px-4 py-3">Fast</td>
                <td className="px-4 py-3">Data entry, court reporting prep, transcription</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">75+</td>
                <td className="px-4 py-3">Professional</td>
                <td className="px-4 py-3">Transcriptionists, programmers, executive assistants</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-zinc-500">
          These ranges are typical, not a rule. Employers set their own thresholds, and most
          interview processes include their own typing assessment.
        </p>
      </section>

      {/* Why it matters + funnel */}
      <section className="mt-16 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-xl font-bold text-zinc-50">Fast typing opens doors</h2>
          <p className="mt-3 text-zinc-400">
            Transcription jobs, data entry, call centre work and remote admin roles all ask
            for a typing speed test. Knowing your WPM tells you which roles you can apply
            for today and what to practice to reach the next level.
          </p>
          <Link
            href="/transcription-jobs"
            className="mt-4 inline-block font-semibold text-emerald-400 transition hover:text-emerald-300"
          >
            See transcription jobs that pay
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-xl font-bold text-zinc-50">Practice daily, gain fast</h2>
          <p className="mt-3 text-zinc-400">
            A few minutes of focused typing practice each day beats an hour once a week.
            Use the code mode to practice programming syntax or the Afrikaans mode if you
            type in Afrikaans at work.
          </p>
          <Link
            href="/how-to-become-a-transcriptionist"
            className="mt-4 inline-block font-semibold text-emerald-400 transition hover:text-emerald-300"
          >
            How to become a transcriptionist
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16">
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
