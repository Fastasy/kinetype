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
  { href: "/rev-typing-test", label: "Rev test" },
  { href: "/transcribeme-typing-test", label: "TranscribeMe test" },
  { href: "/transcription-jobs", label: "Transcription jobs" },
  { href: "/how-to-become-a-transcriptionist", label: "Career guide" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-200">
        <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-mono text-lg font-bold tracking-tight text-zinc-100">
              kine<span className="text-emerald-400">type</span>
            </Link>
            <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs sm:text-sm">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="font-medium text-zinc-400 transition hover:text-emerald-400"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="mt-16 border-t border-zinc-800 bg-zinc-950">
          <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-zinc-500">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-sm">
                <div className="font-mono text-base font-bold text-zinc-100">
                  kine<span className="text-emerald-400">type</span>
                </div>
                <p className="mt-2">
                  Free typing speed tests with WPM and accuracy scores, plus guides for
                  transcription and work from home jobs that need fast typing.
                </p>
              </div>
              <div>
                <div className="font-medium text-zinc-300">Pages</div>
                <ul className="mt-2 space-y-1">
                  {NAV_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="transition hover:text-emerald-400">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-8 text-xs text-zinc-600">{AFFILIATE_DISCLOSURE}</p>
            <p className="mt-2 text-xs text-zinc-600">
              © {new Date().getFullYear()} {SITE_NAME}. Free forever, no account needed.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
