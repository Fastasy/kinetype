import type { ReactNode } from "react";

/**
 * Centered application CTA box with a heavy pixel border.
 * Wraps the job-platform apply buttons (GoTranscript, Rev, TranscribeMe).
 */
export default function ApplyBox({ children }: { children: ReactNode }) {
 return (
 <div className="relative mt-8 overflow-hidden rounded-2xl border border-brand/30 bg-card/60 p-6 -[0_0_60px_-15px_rgba(16,185,129,0.45)] sm:p-8">
 {/* Emerald glow accents */}
 <div
 className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl"
 aria-hidden="true"
 />
 <div
 className="pointer-events-none absolute -bottom-28 -right-16 h-48 w-48 rounded-full bg-brand-bright/10 blur-3xl"
 aria-hidden="true"
 />
 <div
 className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/60 to-transparent"
 aria-hidden="true"
 />

 <div className="relative flex flex-wrap items-center justify-center gap-3">
 {children}
 </div>
 </div>
 );
}
