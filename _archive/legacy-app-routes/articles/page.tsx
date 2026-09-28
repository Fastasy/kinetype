import type { Metadata } from "next";
import { ARTICLES } from "@/lib/articles";
import ArticlesDirectory from "@/components/ArticlesDirectory";

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
    url: "https://kinetype.app/articles",
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
  url: "https://kinetype.app/articles",
  isPartOf: {
    "@type": "WebSite",
    name: "Kinetype",
    url: "https://kinetype.app",
  },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: ARTICLES.length,
    itemListElement: ARTICLES.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: a.title,
      url: `https://kinetype.app/${a.slug}`,
    })),
  },
};

export default function ArticlesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticlesDirectory />
    </>
  );
}
