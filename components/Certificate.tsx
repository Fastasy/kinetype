"use client";

import { useState } from "react";

interface CertificateProps {
  wpm: number;
  accuracy: number;
  onClose: () => void;
}

export default function Certificate({ wpm, accuracy, onClose }: CertificateProps) {
  const [name, setName] = useState("");
  const date = new Date().toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        id="cert-area"
        className="w-full max-w-2xl rounded-2xl border-4 border-zinc-300 bg-white p-8 text-zinc-900 shadow-2xl sm:p-10"
      >
        <div className="text-center">
          <div className="font-mono text-sm uppercase tracking-[0.3em] text-zinc-400">
            Kinetype
          </div>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Certificate of Typing Speed</h2>
          <div className="mx-auto mt-4 h-px w-24 bg-emerald-500" />
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-500">This certifies that</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="mt-2 w-full max-w-md border-b-2 border-zinc-300 bg-transparent text-center text-2xl font-semibold text-zinc-900 outline-none placeholder:text-zinc-300 focus:border-emerald-500"
          />
          <p className="mt-4 text-sm text-zinc-500">
            achieved a typing speed of
          </p>
          <div className="mt-1 font-mono text-5xl font-bold text-emerald-600">{wpm} WPM</div>
          <p className="mt-1 text-sm text-zinc-500">with {accuracy}% accuracy</p>
          <p className="mt-6 text-xs text-zinc-400">on {date}</p>
        </div>

        <div className="mt-8 flex items-end justify-between">
          <div className="text-xs text-zinc-400">Verified result</div>
          <div className="text-right font-mono text-xs text-zinc-400">
            kinetype.com
            <div className="mt-1 border-t border-zinc-300 pt-1">Free typing speed test</div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          Print / Save PDF
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-600 px-6 py-3 font-medium text-zinc-200 transition hover:border-zinc-400"
        >
          Close
        </button>
      </div>
    </div>
  );
}
