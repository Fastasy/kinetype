import type { ReactNode } from "react";

/**
 * Centered application CTA box with an emerald glow.
 * Wraps the job-platform apply buttons (GoTranscript, Rev, TranscribeMe).
 */
export default function ApplyBox({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl border border-emerald-500/30 bg-zinc-900/60 p-6 shadow-[0_0_60px_-15px_rgba(16,185,129,0.45)] sm:p-8">
      {/* Emerald glow accents */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-center justify-center gap-3">
        {children}
      </div>
    </div>
  );
}
