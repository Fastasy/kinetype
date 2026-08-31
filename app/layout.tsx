import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { AFFILIATE_DISCLOSURE } from "@/lib/affiliate";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_NAME = "Kinetype";
const SITE_URL = "https://kinetype.app";
const SITE_DESCRIPTION =
  "Free typing speed test. Measure your WPM and accuracy in English, punctuation or code, then get a free certificate of your result.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kinetype | Free Typing Test, WPM Speed and Accuracy",
    template: "%s | Kinetype",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "typing test",
    "typing speed test",
    "WPM test",
    "words per minute",
    "typing accuracy",
    "punctuation typing test",
    "code typing test",
    "free typing test",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Kinetype | Free Typing Test, WPM Speed and Accuracy",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
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
    title: "Kinetype | Free Typing Test, WPM Speed and Accuracy",
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const NAV_LINKS = [
  { href: "/", label: "Typing test" },
  { href: "/how-to-become-a-virtual-assistant-philippines", label: "VA Philippines" },
  { href: "/rev-typing-test", label: "Rev test" },
  { href: "/transcribeme-typing-test", label: "TranscribeMe test" },
  { href: "/transcription-jobs", label: "Transcription jobs" },
  { href: "/how-to-become-a-transcriptionist", label: "Career guide" },
];

import HeaderNav from "@/components/HeaderNav";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-200">
        <HeaderNav />

        <div className="flex-1">{children}</div>

        <footer className="mt-20 border-t border-zinc-800/80 bg-zinc-950">
          <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-zinc-500 sm:px-6">
            <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
              <div className="md:col-span-2 max-w-sm">
                <div className="flex items-center gap-2 font-mono text-lg font-bold text-zinc-100">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                    ⌨
                  </div>
                  <span>
                    kine<span className="text-emerald-400">type</span>
                  </span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  Free online typing speed test with WPM and accuracy scores. Benchmark your speed for transcription exams, VA skill tests, and work-from-home typing jobs.
                </p>
              </div>

              <div>
                <div className="font-semibold text-zinc-200 text-xs uppercase tracking-wider">Exam Prep</div>
                <ul className="mt-3 space-y-2 text-xs">
                  <li>
                    <Link href="/rev-typing-test" className="transition hover:text-emerald-400">
                      Rev Typing Test
                    </Link>
                  </li>
                  <li>
                    <Link href="/transcribeme-typing-test" className="transition hover:text-emerald-400">
                      TranscribeMe Exam
                    </Link>
                  </li>
                  <li>
                    <Link href="/" className="transition hover:text-emerald-400">
                      Speed Practice
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <div className="font-semibold text-zinc-200 text-xs uppercase tracking-wider">Career Guides</div>
                <ul className="mt-3 space-y-2 text-xs">
                  <li>
                    <Link href="/articles" className="transition hover:text-emerald-400">
                      All Articles
                    </Link>
                  </li>
                  <li>
                    <Link href="/how-to-become-a-virtual-assistant-philippines" className="transition hover:text-emerald-400">
                      VA Philippines Guide
                    </Link>
                  </li>
                  <li>
                    <Link href="/transcription-jobs" className="transition hover:text-emerald-400">
                      Transcription Jobs
                    </Link>
                  </li>
                  <li>
                    <Link href="/how-to-become-a-transcriptionist" className="transition hover:text-emerald-400">
                      Become a Transcriptionist
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-10 border-t border-zinc-800/80 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-zinc-600">
              <p>{AFFILIATE_DISCLOSURE}</p>
              <p>© {new Date().getFullYear()} {SITE_NAME}. Free forever, no account needed.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
