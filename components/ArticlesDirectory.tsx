"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ARTICLES, type ArticleMeta } from "@/lib/articles";

const CATEGORIES = ["All", ...Array.from(new Set(ARTICLES.map((a) => a.category)))];

export default function ArticlesDirectory() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTICLES.filter((a: ArticleMeta) => {
      if (category !== "All" && a.category !== category) return false;
      if (!q) return true;
      const haystack = [a.title, a.blurb, a.category, ...a.tags].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [query, category]);

  return (
    <main className="mx-auto max-w-5xl px-4">
      <article className="pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-strong sm:text-4xl">
          Articles
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Work-from-home job guides, platform test breakdowns, and honest pay
          research for transcription, captioning, data entry and virtual
          assistant work.
        </p>

        {/* Search bar */}
        <div className="mt-8">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles, e.g. Philippines, captioning, salary..."
              aria-label="Search articles"
              className="w-full rounded-2xl border border-edge bg-panel/70 py-3.5 pl-12 pr-4 text-sm text-strong placeholder-muted outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* Category filter chips */}
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  category === c
                    ? "bg-brand text-ink"
                    : "border border-edge-bright text-body hover:border-brand/60 hover:text-brand-bright"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="mt-6 text-xs text-muted" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "article" : "articles"}
          {query.trim() ? ` matching "${query.trim()}"` : ""}
          {category !== "All" ? ` in ${category}` : ""}
        </p>

        {/* Article cards */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {filtered.map((a) => (
            <Link
              key={a.slug}
              href={`/${a.slug}`}
              className="group flex flex-col rounded-2xl border border-edge bg-panel/40 p-5 transition hover:border-brand/50 hover:bg-panel/80"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-bright">
                  {a.category}
                </span>
                <span className="text-muted transition group-hover:text-brand-bright">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
              <h2 className="mt-2 text-base font-semibold text-strong transition group-hover:text-brand-bright">
                {a.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{a.blurb}</p>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-8 rounded-2xl border border-edge p-8 text-center">
            <p className="text-sm text-muted">
              No articles match that search. Try a broader term or browse all categories.
            </p>
          </div>
        )}
      </article>
    </main>
  );
}
