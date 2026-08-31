"use client";

import { useId, useState } from "react";
import { AFFILIATE } from "@/lib/affiliate";

interface CalculatorProps {
  initialWpm?: number;
}

export function calculateEarnings(wpm: number, hoursPerWeek: number, accuracy: number = 98) {
  // Honest model anchored to verified figures (2026-08-31):
  // - Real effective earnings for general transcription run $2-$6/hour
  //   (published per-audio-minute rates ÷ 2-4x real work time).
  // - The site's salary guide uses $4/hr effective as its anchor
  //   ($160/month at 10 hrs/week).
  // - Faster typists earn toward the top of the band; accuracy adjusts within it.
  const baseEffectiveHourly = 4; // verified mid-band anchor
  const speedFactor = Math.min(1.5, wpm / 45); // 45 WPM = 1.0x, 67+ WPM = 1.5x cap
  const accuracyFactor = Math.min(1, Math.max(0.7, accuracy / 100));
  const hourlyRate = Math.round(baseEffectiveHourly * speedFactor * accuracyFactor);

  const weeklyEarnings = Math.round(hourlyRate * hoursPerWeek);
  const monthlyEarnings = Math.round(weeklyEarnings * 4.33);
  const annualEarnings = Math.round(weeklyEarnings * 52);

  return {
    hourlyRate,
    weeklyEarnings,
    monthlyEarnings,
    annualEarnings,
    hoursPerAudioHour: "2 to 4",
  };
}

export default function EarningsCalculator({ initialWpm = 60 }: CalculatorProps) {
  const [wpm, setWpm] = useState<number>(initialWpm);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(15);

  const wpmInputId = useId();
  const hoursInputId = useId();

  const { hourlyRate, weeklyEarnings, monthlyEarnings } = calculateEarnings(wpm, hoursPerWeek);

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-950 p-6 sm:p-8 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            Transcription Income Estimator
          </div>
          <h3 className="mt-2 text-2xl font-bold text-zinc-50">
            How much can you earn typing from home?
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Adjust your typing speed and available hours to estimate your remote earnings.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Sliders Area (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* WPM Slider */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <label htmlFor={wpmInputId} className="text-sm font-medium text-zinc-300">
                Your Typing Speed
              </label>
              <span className="font-mono text-xl font-bold text-emerald-400">
                {wpm} <span className="text-xs text-zinc-500 font-normal">WPM</span>
              </span>
            </div>
            <input
              id={wpmInputId}
              type="range"
              min={30}
              max={130}
              step={5}
              value={wpm}
              onChange={(e) => setWpm(Number(e.target.value))}
              aria-label="Typing speed in words per minute"
              className="mt-4 w-full h-2 rounded-lg bg-zinc-800 accent-emerald-500 cursor-pointer"
            />
            <div className="mt-2 flex justify-between text-xs text-zinc-500 font-mono">
              <span>30 WPM (Beginner)</span>
              <span>70 WPM (Fast)</span>
              <span>120+ WPM (Pro)</span>
            </div>
          </div>

          {/* Hours per week Slider */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <label htmlFor={hoursInputId} className="text-sm font-medium text-zinc-300">
                Weekly Working Hours
              </label>
              <span className="font-mono text-xl font-bold text-zinc-100">
                {hoursPerWeek} <span className="text-xs text-zinc-500 font-normal">hrs/week</span>
              </span>
            </div>
            <input
              id={hoursInputId}
              type="range"
              min={5}
              max={40}
              step={5}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value))}
              aria-label="Weekly working hours"
              className="mt-4 w-full h-2 rounded-lg bg-zinc-800 accent-emerald-500 cursor-pointer"
            />
            <div className="mt-2 flex justify-between text-xs text-zinc-500 font-mono">
              <span>5 hrs (Side Gig)</span>
              <span>20 hrs (Part-time)</span>
              <span>40 hrs (Full-time)</span>
            </div>
          </div>
        </div>

        {/* Output & Conversion Card (5 cols) */}
        <div className="rounded-2xl border border-emerald-500/40 bg-zinc-900/90 p-6 text-center lg:col-span-5 shadow-xl">
          <div className="text-xs uppercase font-semibold tracking-wider text-zinc-400">
            Estimated Earnings
          </div>

          <div className="mt-3 flex items-baseline justify-center gap-1">
            <span className="text-4xl sm:text-5xl font-extrabold text-emerald-400 font-mono">
              ${hourlyRate}
            </span>
            <span className="text-zinc-400 font-medium">/ hour</span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 text-left font-mono">
            <div className="rounded-xl bg-zinc-950/60 p-3">
              <div className="text-[11px] text-zinc-500 uppercase">Monthly</div>
              <div className="text-lg font-bold text-zinc-100 mt-0.5">
                ${monthlyEarnings.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-950/60 p-3">
              <div className="text-[11px] text-zinc-500 uppercase">Weekly</div>
              <div className="text-lg font-bold text-zinc-100 mt-0.5">
                ${weeklyEarnings.toLocaleString()}
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-zinc-400 text-left leading-relaxed">
            Estimate based on verified effective earnings of $2 to $6 an hour for general
            transcription (published rates divided by real work time of 2 to 4x the audio
            length). Faster typists land toward the top of the band.
          </p>

          <div className="mt-6 space-y-2">
            <a
              href={AFFILIATE.gotranscript}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              <span>Apply to GoTranscript</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
            <a
              href={AFFILIATE.rev}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
            >
              <span>Apply to Rev</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
