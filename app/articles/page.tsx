import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import ApplyBox from "@/components/ApplyBox";
import ArticlesDirectory from "@/components/ArticlesDirectory";
import { ARTICLES } from "@/lib/articles";
import { AFFILIATE, AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

export const metadata: Metadata = {
  title: "WFH Job Guides, Pay Research & Platform Tests",
  description:
    "Every Kinetype guide in one place: transcription, captioning and data entry jobs, typing test breakdowns, and honest pay research. Search and filter by topic.",
  alternates: {
    canonical: "/articles",
  },
  openGraph: {
    type: "article",
    title: "Articles: WFH Job Guides, Pay Research & Platform Tests",
    description:
      "Every Kinetype guide in one place: transcription, captioning and data entry jobs, typing test breakdowns, and honest pay research.",
    url: "https://www.kinetype.app/articles",
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
    title: "Articles: WFH Job Guides, Pay Research & Platform Tests",
    description:
      "Every Kinetype guide in one place: transcription, captioning and data entry jobs, typing test breakdowns, and honest pay research.",
    images: ["/og.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Kinetype Articles",
  description:
    "Work-from-home job guides, platform test breakdowns, and honest pay research for transcription, captioning, data entry and virtual assistant work.",
  url: "https://www.kinetype.app/articles",
  isPartOf: {
    "@type": "WebSite",
    name: "Kinetype",
    url: "https://www.kinetype.app",
  },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: ARTICLES.length,
    itemListElement: ARTICLES.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: a.title,
      url: `https://www.kinetype.app/${a.slug}`,
    })),
  },
};

export default function ArticlesPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <ArticlesDirectory />

      {/*
        The hub carries one set of CTAs. Every guide links into these platforms
        anyway, so a reader who lands on the directory and goes no further still
        has the path in front of them. GoTranscript is the paying referral; Rev
        and TranscribeMe are applications, not paid placements.
      */}
      <div className="mx-auto max-w-5xl px-4 pb-14">
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
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          {AFFILIATE_DISCLOSURE}
        </p>
      </div>
    </>
  );
}
