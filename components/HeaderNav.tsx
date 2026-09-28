"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { saveStore } from "@/game/store";

const LINKS = [
 { href: "/", label: "Play" },
 { href: "/how-to-play", label: "How to play" },
 { href: "/shop", label: "Skins" },
 { href: "/typing-games-unblocked", label: "Unblocked" },
 { href: "/typing-speed-test", label: "Typing test" },
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
 `rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-card hover:text-brand-bright ${
 active ? "bg-card text-brand-bright" : "text-ink-soft"
 }`;

 return (
 <header className="sticky top-0 z-50 border-b-2 border-line bg-page">
 <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
 <Link
 href="/"
 className="flex items-center gap-2 font-mono text-xl font-bold tracking-tight text-ink transition hover:opacity-90"
 >
 <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-sm text-brand-bright">
 ⌨
 </span>
 <span>
 kine<span className="text-brand-bright">type</span>
 </span>
 </Link>

 <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
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
 <Link
 href="/shop"
 className="hidden rounded-lg border border-line px-2.5 py-1.5 font-mono text-xs text-ink-soft transition hover:border-coin/50 hover:text-coin sm:block"
 aria-label="Your coin balance"
 >
 <span className="text-coin">{save.coins.toLocaleString("en-US")}</span> coins
 </Link>
 <button
 type="button"
 onClick={() => setOpen((v) => !v)}
 className="rounded-lg p-2 text-ink-faint hover:bg-card hover:text-ink-soft md:hidden"
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
 <div className="space-y-1 border-b border-line bg-page px-4 py-3 md:hidden">
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
