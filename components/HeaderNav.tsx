"use client";

import { useState } from "react";
import Link from "next/link";
import { AFFILIATE } from "@/lib/affiliate";

interface HeaderNavProps {
  siteName: string;
}

export default function HeaderNav({ siteName }: HeaderNavProps) {
  const [prepOpen, setPrepOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-mono text-xl font-bold tracking-tight text-zinc-100 transition hover:opacity-90"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
            ⌨
          </div>
          <span>
            kine<span className="text-emerald-400">type</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-emerald-400"
          >
            Typing Test
          </Link>

          {/* Exam Prep Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setPrepOpen(true)}
            onMouseLeave={() => setPrepOpen(false)}
          >
            <button
              type="button"
              onClick={() => setPrepOpen(!prepOpen)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-emerald-400"
              aria-expanded={prepOpen}
            >
              <span>Exam Prep</span>
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  prepOpen ? "rotate-180 text-emerald-400" : "text-zinc-500"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {prepOpen && (
              <div className="absolute left-0 top-full pt-1.5 w-64 z-50">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Platform Speed Tests
                  </div>
                  <Link
                    href="/rev-typing-test"
                    onClick={() => setPrepOpen(false)}
                    className="flex flex-col rounded-xl px-3 py-2 transition hover:bg-zinc-800/80 group"
                  >
                    <span className="text-sm font-medium text-zinc-200 group-hover:text-emerald-400">
                      Rev Typing Test
                    </span>
                    <span className="text-xs text-zinc-500">Passing score & accuracy tips</span>
                  </Link>
                  <Link
                    href="/transcribeme-typing-test"
                    onClick={() => setPrepOpen(false)}
                    className="flex flex-col rounded-xl px-3 py-2 transition hover:bg-zinc-800/80 group"
                  >
                    <span className="text-sm font-medium text-zinc-200 group-hover:text-emerald-400">
                      TranscribeMe Exam
                    </span>
                    <span className="text-xs text-zinc-500">Entrance exam benchmarks</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/transcription-jobs"
            className="rounded-lg px-3 py-2 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-emerald-400"
          >
            Transcription Jobs
          </Link>

          <Link
            href="/how-to-become-a-virtual-assistant-philippines"
            className="rounded-lg px-3 py-2 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-emerald-400"
          >
            VA Philippines
          </Link>

          <Link
            href="/how-to-become-a-transcriptionist"
            className="rounded-lg px-3 py-2 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-emerald-400"
          >
            Career Guide
          </Link>
        </nav>

        {/* Right CTA Button */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 shadow-sm"
          >
            <span>Get Paid to Type</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950 px-4 py-4 space-y-2">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Typing Test
          </Link>
          <div className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Exam Prep
          </div>
          <Link
            href="/rev-typing-test"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-xl px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-emerald-400"
          >
            • Rev Typing Test
          </Link>
          <Link
            href="/transcribeme-typing-test"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-xl px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-emerald-400"
          >
            • TranscribeMe Exam
          </Link>
          <div className="pt-2 border-t border-zinc-900" />
          <Link
            href="/transcription-jobs"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Transcription Jobs
          </Link>
          <Link
            href="/how-to-become-a-virtual-assistant-philippines"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            VA Philippines Guide
          </Link>
          <Link
            href="/how-to-become-a-transcriptionist"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Career Guide
          </Link>
          <div className="pt-3">
            <a
              href={AFFILIATE.gotranscript}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-zinc-950"
            >
              <span>Get Paid to Type</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
