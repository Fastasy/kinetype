"use client";

import { useState } from "react";
import Link from "next/link";
import { AFFILIATE } from "@/lib/affiliate";

const GUIDE_GROUPS = [
  {
    label: "WFH Job Guides",
    links: [
      { href: "/transcription-jobs-philippines", title: "Transcription Jobs Philippines", blurb: "Real pay, real requirements" },
      { href: "/how-to-become-a-virtual-assistant-philippines", title: "Become a VA in the Philippines", blurb: "Hiring funnel and what agencies test" },
      { href: "/typing-test-wfh-jobs", title: "Typing Test to WFH Jobs", blurb: "Which jobs your WPM unlocks" },
      { href: "/transcription-jobs", title: "Transcription Jobs (Global)", blurb: "Where to find them in 2026" },
      { href: "/how-to-become-a-transcriptionist", title: "Become a Transcriptionist", blurb: "The full career path" },
    ],
  },
  {
    label: "Platform Tests",
    links: [
      { href: "/rev-typing-test", title: "Rev Typing Test", blurb: "Passing score and accuracy tips" },
      { href: "/transcribeme-typing-test", title: "TranscribeMe Exam", blurb: "Entrance exam benchmarks" },
    ],
  },
];

export default function HeaderNav() {
  const [guidesOpen, setGuidesOpen] = useState(false);
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

          {/* Guides Dropdown */}
          <div
            className="group relative"
            onMouseEnter={() => setGuidesOpen(true)}
            onMouseLeave={() => setGuidesOpen(false)}
          >
            <button
              type="button"
              onClick={() => setGuidesOpen(!guidesOpen)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-emerald-400"
              aria-expanded={guidesOpen}
              aria-haspopup="true"
            >
              <span>Guides</span>
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  guidesOpen ? "rotate-180 text-emerald-400" : "text-zinc-500"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Links stay in the DOM (crawlable); CSS shows them on hover / click */}
            <div
              className={`absolute left-0 top-full z-50 w-80 pt-1.5 transition-opacity duration-150 ${
                guidesOpen ? "visible opacity-100" : "invisible opacity-0 group-hover:visible group-hover:opacity-100"
              }`}
            >
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-md">
                {GUIDE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {group.label}
                    </div>
                    {group.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setGuidesOpen(false)}
                        className="group/link flex flex-col rounded-xl px-3 py-2 transition hover:bg-zinc-800/80"
                      >
                        <span className="text-sm font-medium text-zinc-200 group-hover/link:text-emerald-400">
                          {link.title}
                        </span>
                        <span className="text-xs text-zinc-500">{link.blurb}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </nav>

        {/* Right CTA Button */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href={AFFILIATE.gotranscript}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 shadow-sm transition hover:bg-emerald-400"
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

          {GUIDE_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {group.label}
              </div>
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-emerald-400"
                >
                  {link.title}
                </Link>
              ))}
            </div>
          ))}

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
