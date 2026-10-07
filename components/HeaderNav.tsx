"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { saveStore } from "@/game/store";
import BrandMark from "./brand/BrandMark";
import AuthMenu from "./auth/AuthMenu";

const LINKS = [
  { href: "/play", label: "Play" },
  { href: "/bosses", label: "Campaign" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/how-to-play", label: "How to play" },
  { href: "/guides", label: "Guides" },
  { href: "/shop", label: "Skins" },
];

export default function HeaderNav() {
 const [open, setOpen] = useState(false);
 const pathname = usePathname();
 const save = useSyncExternalStore(
 saveStore.subscribe,
 saveStore.getSnapshot,
 saveStore.getServerSnapshot,
 );

 const linkClass = (active: boolean) =>
   `whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition hover:bg-card hover:text-secondary ${
     active ? "bg-card text-secondary" : "text-ink-soft"
   }`;

 return (
 // `data-tour` is the first-visit tour's handle on this element (game/tour.ts). It is on the
 // HEADER rather than on the <nav>, because the nav is `hidden lg:flex` and a target that does not
 // exist on a phone is a step that cannot point at anything.
 <header data-tour="site-header" className="sticky top-0 z-50 border-b-2 border-line bg-page">
 <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
 <Link
   href="/"
   className="flex items-center gap-2 font-pixel text-[13px] text-ink transition hover:opacity-90"
 >
   <BrandMark className="h-7 w-7" label="Kinetype" />
   <span>
     kine<span className="text-secondary">type</span>
   </span>
 </Link>

 <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main navigation">
 {LINKS.map((l) => (
 <Link
 key={l.href}
 href={l.href}
 aria-current={pathname === l.href ? "page" : undefined}
 className={linkClass(pathname === l.href)}
 >
 {l.label}
 </Link>
 ))}
 </nav>

 <div className="flex items-center gap-2">
 <AuthMenu compact />
 <Link
 href="/shop"
 data-tour="nav-coins"
 className="hidden rounded-lg border border-line px-2.5 py-1.5 font-mono text-xs text-ink-soft transition hover:border-coin/50 hover:text-coin sm:block"
 aria-label="Your coin balance"
 >
 <span className="text-coin">{save.coins.toLocaleString("en-US")}</span> coins
 </Link>
 <button
 type="button"
 onClick={() => setOpen((v) => !v)}
 className="rounded-lg p-2 text-ink-faint hover:bg-card hover:text-ink-soft lg:hidden"
 aria-label="Toggle navigation menu"
 aria-expanded={open}
 >
 <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 {open ? (
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 ) : (
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
 )}
 </svg>
 </button>
 </div>
 </div>

 {open && (
 <div className="space-y-1 border-b border-line bg-page px-4 py-3 lg:hidden">
 {LINKS.map((l) => (
 <Link
 key={l.href}
 href={l.href}
 onClick={() => setOpen(false)}
 className="block rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-card"
 >
 {l.label}
 </Link>
 ))}
 </div>
 )}
 </header>
 );
}
