import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "Captioning Jobs for Beginners: Closed Captioning From Home",
  description:
    "What captioning work really involves, how it differs from transcription, what it pays, and how to apply with no experience.",
  alternates: {
    canonical: "/captioning-jobs-for-beginners",
  },
  openGraph: {
    title: "Captioning Jobs for Beginners: Closed Captioning From Home",
    description:
      "What captioning work really involves, how it differs from transcription, and how to apply with no experience.",
    url: "https://kinetype.app/captioning-jobs-for-beginners",
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
    title: "Captioning Jobs for Beginners: Closed Captioning From Home",
    description:
      "What captioning work really involves, how it differs from transcription, and how to apply with no experience.",
    images: ["/og.png"],
  },
};

const FAQS = [
  {
    q: "Do captioning jobs require experience?",
    a: "No. Platforms like Rev hire beginner captioners after a short test that checks typing, grammar and style. No resume or degree is needed. The test and the style guide are the gate, and you can learn both in a few days of practice.",
  },
  {
    q: "How much do beginner captioners earn?",
    a: "Beginners typically earn the equivalent of $2 to $5 per hour of real work, because files take two to four times their length to caption. Rates climb with accuracy and speed as you get used to timing and style rules.",
  },
  {
    q: "What is the difference between captioning and subtitling?",
    a: "Captioning writes the spoken words for viewers who cannot hear, and includes sound effects and speaker labels. Subtitling usually translates dialogue into another language. Both are timed to the video, but they serve different audiences.",
  },
  {
    q: "Do I need special software?",
    a: "No. Caption platforms provide their own online editors, so you only need a computer and internet. A good pair of headphones helps. A foot pedal is optional and most people add one only after they start working regularly.",
  },
  {
    q: "Is closed captioning work from home?",
    a: "Yes. Captioning is remote work by nature: platforms assign files, you caption them in their editor and return them online. As long as you have a computer, internet and a quiet space, you can work from anywhere.",
  },
  {
    q: "How do I get started in captioning?",
    a: "Take a free typing test to confirm your speed, then apply to Rev or GoTranscript. Practice captioning a short video by hand against a public style guide first. Pass the application test and start with small files to build a rating.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Captioning Jobs for Beginners: Closed Captioning From Home",
      description:
        "What captioning work really involves, how it differs from transcription, what it pays, and how to apply with no experience.",
      author: { "@type": "Organization", name: "Kinetype" },
      publisher: { "@type": "Organization", name: "Kinetype" },
      mainEntityOfPage: "https://kinetype.app/captioning-jobs-for-beginners",
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

export default function CaptioningJobsForBeginnersPage() {
  return (
    <main className="mx-auto max-w-3xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Captioning jobs for beginners
        </h1>
        <p className="mt-3 text-zinc-400">
          Captioning jobs for beginners are real remote work: you add
          synchronized text to video so deaf and hard of hearing viewers can
          follow the dialogue. It pays modestly at first, but the entry bar is
          low, the demand is steady, and the skills carry over into other
          work. It suits anyone with a computer, internet and decent typing.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What captioning work actually is
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Captioning means writing the words people say on screen, timed to
          appear exactly as the words are spoken. You also label speakers, note
          sound effects in brackets, and follow a style guide that controls
          punctuation, line breaks and how long each caption stays visible.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Most of the work comes from video platforms, course creators, media
          companies and social channels that need captions for accessibility
          and reach. Some jobs caption existing audio, others write captions
          from scratch. Either way, the daily task is the same: accurate text,
          timed well.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The audience for captions is larger than most people assume. Beyond
          accessibility law, viewers watch video with sound off in public
          places, and platforms reward captioned content with better reach.
          That demand is why the work keeps coming.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Caption work also shows up in unexpected places: court proceedings,
          corporate training, live events and academic lectures all need it.
          Each setting has its own conventions, but the core skill, writing
          what you hear with clean timing, is identical.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          How captioning differs from transcription
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Transcription turns audio into plain text with no timing. Captioning
          does that and then times every line to the video, so the words appear
          the moment they are spoken. That timing layer is the whole
          difference, and it is where beginners lose the most points.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Captions also carry information transcription leaves out. You write
          [applause] or [music playing], you label each speaker, and you follow
          rules about characters per line and minimum display time.
          Transcription style guides are simpler, because the text does not
          need to be readable at a glance on screen.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Beginners often ask whether captioning is harder than transcription.
          It is not harder, it is different: the typing is the easy part, and
          timing judgment is the part you learn on the job. Nobody expects you
          to be fast at timing on day one, and every file makes the next one
          easier.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          Who hires beginner captioners
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Rev hires caption freelancers worldwide, and its caption application
          includes a test, which makes it the most common entry point. Other
          known names in the space include 3Play Media, HappyScribe and
          Speechpad, which hire captioners and subtitlers for client work.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Platforms sit between you and the customer: they distribute files,
          grade your work and pay you per audio minute. You rarely talk to the
          end client at the start. That keeps things simple while you learn,
          and it is the same model transcription and subtitling use. The full
          list of platforms hiring captioners is in the{" "}
          <Link
            href="/transcription-jobs"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            transcription jobs roundup
          </Link>
          .
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
            Apply for captioning at Rev
          </a>
</div>
        <p className="mt-3 leading-relaxed text-zinc-400">
          You can also approach creators directly once you have a few samples,
          offering captioning for a flat rate per video. That route takes
          longer to build but pays better than platforms. Most beginners start
          on platforms for the steady file flow.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What it pays
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Captioning usually pays less per audio minute than transcription,
          because caption audio is often cleaner and the timing is partly
          automated. For beginners, effective earnings land in the $2 to $5 per
          hour range once you count the time files actually take.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Per audio minute rates look small, because they are. A ten minute
          video might pay a dollar or two. The work is consistent, though, and
          your effective rate climbs as you get faster at timing, which is why
          practice matters more than the rate sheet.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          The honest comparison is to transcription: the same typing skill,
          slightly lower rates, similar workload. If you already transcribe,
          captioning is a natural second income stream. If you are new, either
          entry works, and the{" "}
          <Link
            href="/how-to-get-transcription-jobs"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            how to get transcription jobs guide
          </Link>{" "}
          explains the shared application flow.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Your costs are close to zero: no software, no fees, no training
          required to start, and platforms charge nothing to apply. The only
          real investment is time, which is why captioning works as a first
          remote job.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          What you need to qualify
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          You need fast accurate typing, strong grammar, and the attention span
          to follow a style guide exactly. No experience is needed at entry;
          the application test teaches you the rules before you work. A decent
          pair of headphones and a quiet room are the real requirements.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          A foot pedal helps later, once you are working regularly, because it
          lets you pause the video without leaving the keyboard. Do not buy one
          before you are hired. The platforms provide their own caption
          editors, so you do not need special software either.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Grammar matters more than typing speed at the entry level, because a
          caption that reads wrong fails even when it is perfectly timed. If
          English is your strong suit, lean into it. Most caption work is
          written in English, and clean writing is the differentiator.
        </p>

        <h2 className="mt-10 text-2xl font-bold text-zinc-50">
          How to apply for captioning jobs
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Rev&apos;s application includes a caption test, where you caption a
          short video sample against their style guide. Practice with the{" "}
          <Link
            href="/"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            Kinetype test
          </Link>{" "}
          first, because the speed and accuracy they check are the same skills.
          Then apply, take the test when you are fresh, and follow the guide
          exactly.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Apply to more than one platform so you are not waiting on a single
          decision, and check the{" "}
          <Link
            href="/rev-typing-test"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            Rev typing test guide
          </Link>{" "}
          if you want to know what the speed check looks like. The{" "}
          <Link
            href="/subtitle-jobs-from-home"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            subtitle jobs from home guide
          </Link>{" "}
          covers the same platforms from the subtitling angle.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Expect a week or two between applying and your first accepted file.
          The wait is normal, and it is shorter if you applied to two
          platforms. While you wait, keep typing daily so the test is not your
          only practice.
        </p>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Every platform&apos;s style guide is public before you apply. Read it
          before the test, not after. The rules about numbers, speaker labels
          and caption length are exactly what the grader checks, and memorizing
          them is the fastest way to pass.
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
