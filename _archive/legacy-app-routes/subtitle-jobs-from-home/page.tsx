import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";
import ApplyBox from "@/components/ApplyBox";

export const metadata: Metadata = {
  title: "Subtitle Jobs From Home: Pay and Where to Apply",
  description:
    "Subtitling vs captioning vs transcription, who hires subtitle freelancers, what the work pays, and how to land your first job from home without experience.",
  alternates: {
    canonical: "/subtitle-jobs-from-home",
  },
  openGraph: {
    type: "article",
    title: "Subtitle Jobs From Home: What They Pay and Where to Apply",
    description:
      "Subtitling vs captioning vs transcription, who hires subtitle freelancers, what it pays, and how to get your first job.",
    url: "https://kinetype.app/subtitle-jobs-from-home",
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
    title: "Subtitle Jobs From Home: What They Pay and Where to Apply",
    description:
      "Subtitling vs captioning vs transcription, who hires subtitle freelancers, what it pays, and how to get your first job.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "How much do subtitle jobs pay?",
    a: "Monolingual subtitling pays around $2 to $6 per hour of real work for beginners, because files take two to four times their audio length. Translation subtitling can pay more, since fewer freelancers qualify for language pairs.",
  },
  {
    q: "Do I need to know another language?",
    a: "Not for monolingual subtitling, which rewrites dialogue in the same language. Translation subtitling requires real fluency in both languages, and it pays better because of that requirement. Pick the lane that matches your skills.",
  },
  {
    q: "Is subtitling work from home legit?",
    a: "Yes. Established platforms like Rev, HappyScribe and 3Play Media hire remote subtitle freelancers and pay per audio minute. As with any remote work, verify the platform and never pay a fee to start; legitimate employers do not charge applicants.",
  },
  {
    q: "What software do subtitle freelancers use?",
    a: "Platforms provide their own online editors, so you do not need to buy software to start. Professional freelancers later learn tools like Subtitle Edit or Aegisub for offline work, but they are optional and most people add them after getting hired.",
  },
  {
    q: "Do I need experience?",
    a: "No. Entry level subtitle work is tested, not credentialed. The platforms check your typing, grammar and timing with a sample file. If you pass, you start on small jobs and build a rating, exactly like transcription.",
  },
  {
    q: "How do I find subtitle jobs?",
    a: "Apply to Rev and GoTranscript first; both hire subtitlers worldwide. Then widen out to HappyScribe, 3Play Media and freelance boards. Translation subtitlers should look for agencies that work in their language pair.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Subtitle Jobs From Home: What They Pay and Where to Apply",
      description:
        "Subtitling vs captioning vs transcription, who hires subtitle freelancers, what it pays, and how to get your first job.",
      keywords: ['subtitle jobs', 'subtitling from home', 'subtitle freelancer'],
      author: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app/", logo: "https://kinetype.app/og.png" },
      publisher: { "@type": "Organization", name: "Kinetype", url: "https://kinetype.app/", logo: "https://kinetype.app/og.png" },
      mainEntityOfPage: "https://kinetype.app/subtitle-jobs-from-home",
      datePublished: "2026-08-31",
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

export default function SubtitleJobsFromHomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Subtitle jobs from home
        </h1>
        <p className="mt-3 text-zinc-400">
          Subtitle jobs from home involve writing timed text for video, and the
          work splits into two kinds: monolingual subtitling and translation
          subtitling between languages. Both are remote, both hire beginners,
          and translation work pays better because fewer people qualify for it.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          This guide sticks to what the work really pays and who actually
          hires, because most subtitle job articles overstate both. If you can
          type accurately and follow rules, you can do this. The question is
          whether the pay matches your expectations, and the honest numbers are
          below.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What subtitle work actually involves
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          You write the dialogue of a video as text, then time each line to
          appear when it is spoken. Subtitles follow strict rules: character
          limits per line, minimum display times, and clean line breaks so
          viewers can read without rewinding or pausing.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Translation subtitling adds a second step: you convert the dialogue
          into another language while keeping timing and meaning intact. That
          is why character limits matter so much. A long sentence in the source
          language must fit the same time window in the target language.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The work is usually delivered through an online editor supplied by
          the platform or client, which handles the video player and the
          subtitle file format. You focus on the writing and timing. The
          technical side is handled for you, which keeps the entry bar low.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Most subtitle files are for video that already exists, so you are
          never on a live deadline at the start. Platforms give you a window of
          hours or days per file, which suits people working around a day job.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Who hires subtitle freelancers
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Rev, HappyScribe and 3Play Media all hire subtitle freelancers, and
          freelance boards regularly list subtitling gigs from studios,
          agencies and independent creators. Translation subtitling is also
          handled by agencies that pair you with a language pair.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          As with transcription, the platform sits between you and the client
          at first. You receive files, subtitle them in the platform&apos;s
          editor and get paid per audio minute. Once you have a portfolio,
          direct clients become possible, but platforms are the fastest start.
          The{" "}
          <Link
            href="/transcription-jobs"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            transcription jobs roundup
          </Link>{" "}
          lists the main options.
        </p>
        <ApplyBox>
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
</ApplyBox>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Some subtitle work never touches a platform at all. Creators and
          small studios post subtitle gigs directly on freelance marketplaces,
          and they often prefer freelancers with a few samples over big
          credentials. A short portfolio of three subtitled videos is enough to
          start pitching.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Language pairs with more demand, like English to Spanish, French,
          German or Portuguese, get steady work. Rare pairs pay even better
          because the supply of qualified freelancers is tiny. If you speak a
          less common language, that is an advantage, not a niche.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What subtitling pays
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Monolingual subtitling sits in the same effective range as general
          transcription: around $2 to $6 per hour of real work, because files
          take two to four times their audio length to complete. Translation
          subtitling can pay more, because fewer freelancers qualify for it.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          A second language roughly doubles your options and lifts your rates,
          especially for common pairs like English to Spanish or German. The
          honest view is that subtitling is a solid side income, not a salary,
          until you build speed and a client list.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Rates also depend on the platform tier you reach. New freelancers
          start at the base rate and move up as their rating improves, which is
          why the first few months look worse than the third year. Expect the
          ramp, not a jump.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Do not pay for a subtitling job listing, ever. Legitimate platforms
          and clients pay you; they never charge application fees. If a posting
          asks for money upfront, it is a scam, and the same rule applies
          across transcription and captioning.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What you need to qualify
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Fast accurate typing, strong grammar in the language you write, and a
          feel for timing. For translation work you also need real fluency in
          both languages, not dictionary level. Platforms test this during the
          application, so there is no way to bluff it.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          No experience is required for entry level subtitle work. You learn
          the style guides on the job, and the platform checks your first files
          before they reach clients. Attention to detail is the skill that
          actually gets you hired, and it is trainable.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Your typing speed sets the ceiling. Take the{" "}
          <Link
            href="/"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            free Kinetype test
          </Link>{" "}
          to see your real number, and if it is below 45 WPM, practice daily
          for two to four weeks before you apply. Speed is the one requirement
          you can control before the test.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          For translation subtitling, your writing in the target language
          matters more than your spoken fluency. Viewers read the result, so
          clean, natural written style beats conversational ability. Reading
          widely in the target language improves this faster than vocabulary
          apps.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          How to apply
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Start with the typing test so speed is not a hidden weakness. Then
          apply to Rev and GoTranscript, which hire subtitlers alongside
          transcribers. The application includes a test file, and the
          instructions are the same: read the style guide, then work through
          the sample carefully.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          For translation work, apply to platforms that list your language pair
          and mention your second language in your profile. The{" "}
          <Link
            href="/how-to-get-transcription-jobs"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            how to get transcription jobs guide
          </Link>{" "}
          covers the application flow in more depth, and the{" "}
          <Link
            href="/captioning-jobs-for-beginners"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            captioning jobs for beginners guide
          </Link>{" "}
          explains the timing skills that overlap.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Expect a week or two of waiting after you submit. Use that time to
          practice timing on real video, because the gap between passing a test
          and working fast on real files is bigger than most beginners expect.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Keep your first files small, under five minutes if possible. Short
          files teach you the editor and the style rules with low stakes, and a
          clean short file builds your rating faster than a rushed long one.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Subtitling vs captioning vs transcription
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Transcription produces plain text with no timing. Captioning adds
          timing plus sound effects and speaker labels, aimed at viewers who
          cannot hear. Subtitling adds timing for viewers who can hear but do
          not speak the language, and it is often translated.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The skills overlap almost completely: accurate typing, clean grammar
          and timing judgment. That is why the same platforms hire for all
          three, and why starting in one makes the others easier to pick up
          later. Most freelancers end up doing a mix.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The honest pay comparison matters too. The{" "}
          <Link
            href="/transcriptionist-salary"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            transcriptionist salary guide
          </Link>{" "}
          shows the per audio minute math that also applies to subtitling, so
          the two pages read well together when you are deciding where to
          start.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          Take the free typing test to start
        </Link>

        <p className="mt-8 text-xs text-zinc-400">{AFFILIATE_DISCLOSURE}</p>
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
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
