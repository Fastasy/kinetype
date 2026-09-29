import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Press_Start_2P } from "next/font/google";
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

/**
 * Pixel display face, used only for the wordmark and page headings. Pixel fonts are
 * punishing in long copy, so body text stays Inter.
 */
const pixelFace = Press_Start_2P({
  variable: "--font-pixel-face",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const SITE_NAME = "Kinetype";
const SITE_URL = "https://kinetype.app";
const SITE_DESCRIPTION =
  "A free typing fighting game. Type a sentence and every word in it is a move: small words block, ordinary words punch, long words kick. Knock your opponent off the stage. Play in your browser, no download and no account.";

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
  { href: "/play", label: "Play the game" },
  { href: "/", label: "What is Kinetype" },
  { href: "/how-to-play", label: "How to play" },
  { href: "/shop", label: "Skins and themes" },
  { href: "/typing-games-unblocked", label: "Play at school" },
  { href: "/typing-speed-test", label: "Typing speed test" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
 return (
 <html
   lang="en"
   className={`${inter.variable} ${jetbrainsMono.variable} ${pixelFace.variable} h-full`}
 >
 <body className="min-h-full flex flex-col bg-page text-ink-soft">
 <a
 href="#main"
 className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:font-semibold focus:text-page"
 >
 Skip to content
 </a>

 <HeaderNav />

 <main id="main" className="flex-1 py-6">
 {children}
 </main>

 <footer className="mt-16 border-t border-line/80 bg-page">
 <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-ink-faint sm:px-6">
 <div className="flex flex-wrap items-center gap-2 font-pixel text-sm text-ink">
   <span className="flex h-6 w-6 items-center justify-center border-2 border-brand/40 bg-brand/10 text-xs text-brand-bright">
     ⌨
   </span>
 <span>
 kine<span className="text-brand-bright">type</span>
 </span>
 </div>
 <p className="mt-3 max-w-lg text-xs leading-relaxed">
 A free browser game where typing is the only weapon. Every fighter, sound and effect is
 generated in code, so there is nothing to download and nothing to install.
 </p>

 <ul className="mt-6 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
 {FOOTER_LINKS.map((l) => (
 <li key={l.href}>
 <Link href={l.href} className="transition hover:text-brand-bright">
 {l.label}
 </Link>
 </li>
 ))}
 </ul>

 <div className="mt-8 border-t border-line/80 pt-6 text-xs text-ink-faint">
 © {new Date().getFullYear()} {SITE_NAME}. Free, no account needed.
 </div>
 </div>
 </footer>
 </body>
 </html>
 );
}
