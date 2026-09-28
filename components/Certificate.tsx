"use client";

import { useEffect, useRef, useState } from "react";
import { AFFILIATE } from "@/lib/affiliate";

interface CertificateProps {
 wpm: number;
 accuracy: number;
 onClose: () => void;
}

export default function Certificate({ wpm, accuracy, onClose }: CertificateProps) {
 const [name, setName] = useState("");
 const overlayRef = useRef<HTMLDivElement>(null);
 const date = new Date().toLocaleDateString("en-ZA", {
 year: "numeric",
 month: "long",
 day: "numeric",
 });

 useEffect(() => {
 const onKey = (e: KeyboardEvent) => {
 if (e.key === "Escape") onClose();
 };
 window.addEventListener("keydown", onKey);
 overlayRef.current?.focus();
 return () => window.removeEventListener("keydown", onKey);
 }, [onClose]);

 return (
 <div
 ref={overlayRef}
 tabIndex={-1}
 className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 outline-none"
 >
 <div className="flex min-h-full items-center justify-center">
 <div
 id="cert-area"
 className="w-full max-w-2xl rounded-2xl border-4 border-ink-soft bg-white p-8 text-card sm:p-10"
 >
 <div className="text-center">
 <div className="font-mono text-sm uppercase tracking-[0.3em] text-ink-faint">
 Kinetype
 </div>
 <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Certificate of Typing Speed</h2>
 <div className="mx-auto mt-4 h-px w-24 bg-brand" />
 </div>

 <div className="mt-8 text-center">
 <p className="text-sm text-ink-faint">This certifies that</p>
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Your full name"
 className="mt-2 w-full max-w-md border-b-2 border-ink-soft bg-transparent text-center text-2xl font-semibold text-card outline-none placeholder:text-ink-faint focus:border-brand"
 />
 <p className="mt-4 text-sm text-ink-faint">
 achieved a typing speed of
 </p>
 <div className="mt-1 font-mono text-5xl font-bold text-brand">{wpm} WPM</div>
 <p className="mt-1 text-sm text-ink-faint">with {accuracy}% accuracy</p>
 <p className="mt-6 text-xs text-ink-faint">on {date}</p>
 </div>

 <div className="mt-8 flex items-end justify-between">
 <div className="text-xs text-ink-faint">Verified result</div>
 <div className="text-right font-mono text-xs text-ink-faint">
 kinetype.app
 <div className="mt-1 border-t border-ink-soft pt-1">Free typing speed test</div>
 </div>
 </div>
 </div>
 </div>

 <div className="mx-auto mt-6 flex max-w-2xl flex-col items-center gap-3 pb-4 print:hidden">
 <div className="w-full rounded-xl border border-brand/30 bg-card/90 px-4 py-3 text-center ">
 <p className="text-xs text-ink-soft">
 Ready to get paid? Your {wpm} WPM score is worth taking to a platform that pays
 for accuracy. GoTranscript hires transcribers in 140 languages and pays per
 audio minute.
 </p>
 <a
 href={AFFILIATE.gotranscript}
 target="_blank"
 rel="noopener noreferrer sponsored"
 className="mt-2 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-page transition hover:bg-brand-bright"
 >
 Apply to GoTranscript
 </a>
 </div>
 <div className="flex gap-3">
 <button
 type="button"
 onClick={() => window.print()}
 className="rounded-xl bg-brand px-6 py-3 font-semibold text-page transition hover:bg-brand-bright"
 >
 Print / Save PDF
 </button>
 <button
 type="button"
 onClick={onClose}
 className="rounded-xl border border-ink-faint px-6 py-3 font-medium text-ink-soft transition hover:border-ink-faint"
 >
 Close
 </button>
 </div>
 <p className="text-center text-[11px] text-ink-faint">
 Some links on this page are affiliate or referral links. If you sign up through
 them, Kinetype may earn a small commission at no extra cost to you.
 </p>
 </div>
 </div>
 );
}
