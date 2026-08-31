"use client";

import { useState } from "react";
import Link from "next/link";
import { AFFILIATE } from "@/lib/affiliate";

export default function HeaderNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-mono text-xl font-bold tracking-tight text-zinc-100 transition hover:opacity-90"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-400">
            ⌨
          </div>
          <span>
            kine<span className="text-emerald-400">type</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Main navigation">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-emerald-400"
          >
            Typing Test
          </Link>
          <Link
            href="/articles"
            className="rounded-lg px-3 py-2 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-emerald-400"
          >
            Articles
          </Link>
        </nav>

        {/* Right CTA Button */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            <span>Get Paid to Type</span>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="space-y-2 border-b border-zinc-800 bg-zinc-950 px-4 py-4 md:hidden">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Typing Test
          </Link>
          <Link
            href="/articles"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Articles
          </Link>

          <div className="pt-3">
            <a
              href={AFFILIATE.gotranscript}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              <span>Get Paid to Type</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
