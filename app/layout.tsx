import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

import HeaderNav from "@/components/HeaderNav";

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
  "A free typing fighting game. Type words to hit, knock your opponent off the stage, and parry the heavy shots. Play in your browser, no download and no account.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kinetype | Typing Fighting Game: Type to Knock Them Off",
    template: "%s | Kinetype",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "typing fighting game",
    "typing fighter game",
    "typing fighting game online",
    "typing battle game",
    "typing game online fight",
    "typing platform fighter",
    "type to fight game",
    "typing duel online",
    "free typing game",
    "browser typing game",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Kinetype | Typing Fighting Game",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Kinetype typing fighting game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kinetype | Typing Fighting Game",
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

const FOOTER_LINKS = [
  { href: "/", label: "Play" },
  { href: "/how-to-play", label: "How to play" },
  { href: "/shop", label: "Skins and overlays" },
  { href: "/typing-games-unblocked", label: "Play at school" },
  { href: "/typing-speed-test", label: "Typing speed test" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-200">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-emerald-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-zinc-950"
        >
          Skip to content
        </a>

        <HeaderNav />

        <main id="main" className="flex-1 py-6">
          {children}
        </main>

        <footer className="mt-16 border-t border-zinc-800/80 bg-zinc-950">
          <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-zinc-400 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 font-mono text-lg font-bold text-zinc-100">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-400">
                ⌨
              </span>
              <span>
                kine<span className="text-emerald-400">type</span>
              </span>
            </div>
            <p className="mt-3 max-w-lg text-xs leading-relaxed">
              A free browser game where typing is the only weapon. Every fighter, sound and effect is
              generated in code, so there is nothing to download and nothing to install.
            </p>

            <ul className="mt-6 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {FOOTER_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition hover:text-emerald-400">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t border-zinc-800/80 pt-6 text-xs text-zinc-600">
              © {new Date().getFullYear()} {SITE_NAME}. Free, no account needed.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
