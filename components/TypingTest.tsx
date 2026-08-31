"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CODE_SNIPPETS, ENGLISH_WORDS } from "@/lib/words";
import { AFFILIATE } from "@/lib/affiliate";
import Certificate from "./Certificate";
import { calculateEarnings } from "./EarningsCalculator";

type Language = "english" | "code";
type Mode = "time" | "words";
type Status = "idle" | "running" | "finished";

interface TestResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  durationSec: number;
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
  totalChars: number;
}

const TIME_OPTIONS = [15, 30, 60, 120] as const;
const WORD_OPTIONS = [10, 25, 50, 100] as const;
const LANGUAGE_OPTIONS: { id: Language; label: string }[] = [
  { id: "english", label: "English" },
  { id: "code", label: "Code" },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateWords(
  language: Language,
  count: number,
  punctuation: boolean,
  rng: () => number = Math.random
): string[] {
  if (language === "code") {
    const snippet = CODE_SNIPPETS[Math.floor(rng() * CODE_SNIPPETS.length)];
    const tokens = snippet.split(/\s+/).filter((t) => t.length > 0);
    const out: string[] = [];
    while (out.length < count) {
      for (const t of tokens) {
        out.push(t);
        if (out.length >= count) break;
      }
    }
    return out;
  }
  const source = ENGLISH_WORDS;
  const rawWords = Array.from({ length: count }, () => source[Math.floor(rng() * source.length)]);

  if (!punctuation) return rawWords;

  // Inject Monkeytype punctuation (capitalization, commas, periods, quotes, hyphens, colons, question marks)
  let sentenceStart = true;
  return rawWords.map((word, i) => {
    let w = word;

    if (sentenceStart) {
      w = w.charAt(0).toUpperCase() + w.slice(1);
      sentenceStart = false;
    }

    const roll = rng();

    // 15% chance of comma
    if (roll < 0.15 && i < rawWords.length - 1) {
      w += ",";
    }
    // 10% chance of period / end sentence
    else if (roll < 0.25 || i === rawWords.length - 1) {
      const p = rng();
      if (p < 0.7) w += ".";
      else if (p < 0.85) w += "?";
      else w += "!";
      sentenceStart = true;
    }
    // 5% chance of double quotes
    else if (roll < 0.30) {
      w = `"${w}"`;
    }
    // 3% chance of colon/semicolon
    else if (roll < 0.33) {
      w += rng() < 0.5 ? ":" : ";";
    }

    return w;
  });
}

export default function TypingTest() {
  const [language, setLanguage] = useState<Language>("english");
  const [mode, setMode] = useState<Mode>("time");
  const [punctuation, setPunctuation] = useState<boolean>(false);
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [wordCount, setWordCount] = useState<number>(25);

  const [words, setWords] = useState<string[]>(() =>
    generateWords("english", 400, false, mulberry32(20260818))
  );

  // Monkeytype word history state: array of typed strings corresponding to each word
  const [typedWords, setTypedWords] = useState<string[]>([""]);
  const [wordIndex, setWordIndex] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TestResult | null>(null);
  const [showCert, setShowCert] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);

  // Caret & scrolling positioning
  const [caretPos, setCaretPos] = useState<{ left: number; top: number; height: number } | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const wordsWrapperRef = useRef<HTMLDivElement>(null);
  const activeCharRef = useRef<HTMLSpanElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number | null>(null);

  const targetWordCount = mode === "time" ? words.length : wordCount;

  // Recalculate caret position and vertical line centering scroll
  const updateCaretAndScroll = useCallback(() => {
    const container = containerRef.current;
    const wrapper = wordsWrapperRef.current;
    const targetEl = activeCharRef.current || activeWordRef.current;
    if (!container || !wrapper || !targetEl) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const isExtraChar = activeCharRef.current && activeCharRef.current.dataset.isExtra === "true";
    const left = isExtraChar
      ? targetRect.right - wrapperRect.left
      : targetRect.left - wrapperRect.left;

    // caret top relative to the inner transformed wrapper
    const top = targetRect.top - wrapperRect.top;
    const height = targetRect.height || 32;

    setCaretPos({ left, top, height });

    // Lock active line to line 2 (centered in 3-line view)
    // One line height is approx lineTop offset relative to initial wrapper top
    const lineTop = targetRect.top - wrapperRect.top;
    // Keep 1 line space (~40px) above the active line
    const targetScroll = Math.max(0, lineTop - height * 1.1);
    setScrollOffset(targetScroll);
  }, []);

  useEffect(() => {
    updateCaretAndScroll();
    window.addEventListener("resize", updateCaretAndScroll);
    return () => window.removeEventListener("resize", updateCaretAndScroll);
  }, [wordIndex, typedWords, updateCaretAndScroll]);

  // Finish test and calculate Monkeytype metrics
  const finishTest = useCallback(() => {
    if (status === "finished") return;
    setStatus("finished");

    const duration = startTimeRef.current
      ? Math.max((Date.now() - startTimeRef.current) / 1000, 0.5)
      : timeLimit;

    let correctChars = 0;
    let incorrectChars = 0;
    let extraChars = 0;
    let missedChars = 0;
    let totalTyped = 0;

    typedWords.forEach((typed, i) => {
      const target = words[i] || "";
      if (!typed && i >= wordIndex) return;

      const minLen = Math.min(typed.length, target.length);
      for (let j = 0; j < minLen; j++) {
        totalTyped++;
        if (typed[j] === target[j]) {
          correctChars++;
        } else {
          incorrectChars++;
        }
      }

      if (typed.length > target.length) {
        const extra = typed.length - target.length;
        extraChars += extra;
        totalTyped += extra;
      } else if (typed.length < target.length && i < wordIndex) {
        missedChars += target.length - typed.length;
      }

      // Add space for completed words
      if (i < wordIndex) {
        totalTyped++;
        if (typed === target) {
          correctChars++;
        } else {
          incorrectChars++;
        }
      }
    });

    const timeInMinutes = duration / 60;
    const wpm = Math.max(0, Math.round((correctChars / 5) / timeInMinutes));
    const rawWpm = Math.max(0, Math.round((totalTyped / 5) / timeInMinutes));
    const accuracy = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 100;

    setResult({
      wpm,
      rawWpm,
      accuracy,
      durationSec: Math.round(duration),
      correctChars,
      incorrectChars,
      extraChars,
      missedChars,
      totalChars: totalTyped,
    });
  }, [status, typedWords, words, wordIndex, timeLimit]);

  // Timer countdown
  useEffect(() => {
    if (status !== "running" || mode !== "time") return;
    const interval = window.setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(Math.round(elapsedSec));
      if (elapsedSec >= timeLimit) {
        finishTest();
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [status, mode, timeLimit, finishTest]);

  // Reset test
  const resetTest = useCallback((lang: Language, m: Mode, wc: number, punc: boolean) => {
    const newWords = generateWords(lang, m === "time" ? 400 : wc, punc);
    setWords(newWords);
    setTypedWords([""]);
    setWordIndex(0);
    setStatus("idle");
    setResult(null);
    setShowCert(false);
    setCopied(false);
    setElapsed(0);
    setCaretPos(null);
    setScrollOffset(0);
    startTimeRef.current = null;
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Tab to restart test (Monkeytype style)
    if (e.key === "Tab") {
      e.preventDefault();
      resetTest(language, mode, wordCount, punctuation);
      return;
    }

    if (status === "finished") return;

    if (status === "idle" && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      startTimeRef.current = Date.now();
      setStatus("running");
    }

    const currentTyped = typedWords[wordIndex] || "";

    // Handle Space (commit word)
    if (e.key === " ") {
      e.preventDefault();
      if (currentTyped.length === 0) return; // ignore leading double spaces

      if (wordIndex + 1 >= targetWordCount) {
        finishTest();
        return;
      }

      setTypedWords((prev) => [...prev, ""]);
      setWordIndex((prev) => prev + 1);
      return;
    }

    // Handle Backspace
    if (e.key === "Backspace") {
      e.preventDefault();

      // Ctrl/Option Backspace: clear current word or step back
      if (e.ctrlKey || e.altKey) {
        if (currentTyped.length > 0) {
          setTypedWords((prev) => {
            const next = [...prev];
            next[wordIndex] = "";
            return next;
          });
        } else if (wordIndex > 0) {
          setWordIndex((prev) => prev - 1);
          setTypedWords((prev) => prev.slice(0, -1));
        }
        return;
      }

      // Normal Backspace
      if (currentTyped.length > 0) {
        setTypedWords((prev) => {
          const next = [...prev];
          next[wordIndex] = currentTyped.slice(0, -1);
          return next;
        });
      } else if (wordIndex > 0) {
        // Allow backspacing into previous word if it had errors
        const prevWord = typedWords[wordIndex - 1];
        const prevTarget = words[wordIndex - 1];
        if (prevWord !== prevTarget) {
          setWordIndex((prev) => prev - 1);
          setTypedWords((prev) => prev.slice(0, -1));
        }
      }
      return;
    }

    // Regular key typing
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      // Cap extra characters to maximum 10 past target length
      const currentTarget = words[wordIndex] || "";
      if (currentTyped.length >= currentTarget.length + 10) return;

      const newTyped = currentTyped + e.key;
      setTypedWords((prev) => {
        const next = [...prev];
        next[wordIndex] = newTyped;
        return next;
      });

      // Words mode finish check
      if (
        mode === "words" &&
        wordIndex === targetWordCount - 1 &&
        newTyped.length >= currentTarget.length
      ) {
        // Check if finished entire word
        if (newTyped === currentTarget) {
          setTimeout(finishTest, 10);
        }
      }
    }
  };

  const share = async () => {
    if (!result) return;
    const text = `I typed ${result.wpm} WPM (${result.accuracy}% accuracy) on Kinetype! Test your speed: https://kinetype.app`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kinetype Result", text });
        return;
      }
    } catch {
      // Fallback
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderWord = (targetWord: string, index: number) => {
    const isCurrent = index === wordIndex;
    const isPast = index < wordIndex;
    const typed = typedWords[index] || "";

    const baseClass =
      "relative inline-block mx-2 my-1 font-mono text-xl sm:text-2xl leading-relaxed tracking-wider select-none transition-colors duration-100";

    if (isCurrent) {
      const activeCharIndex = typed.length;
      return (
        <span key={index} ref={activeWordRef} className={`${baseClass} text-zinc-600`}>
          {targetWord.split("").map((ch, j) => {
            const isCaretHere = j === activeCharIndex;
            if (j >= typed.length) {
              return (
                <span
                  key={j}
                  ref={isCaretHere ? activeCharRef : undefined}
                  className="text-zinc-600"
                >
                  {ch}
                </span>
              );
            }
            const isCorrect = typed[j] === ch;
            return (
              <span
                key={j}
                ref={isCaretHere ? activeCharRef : undefined}
                className={
                  isCorrect
                    ? "text-emerald-400 font-medium"
                    : "text-red-400 bg-red-950/40 rounded-xs"
                }
              >
                {ch}
              </span>
            );
          })}
          {/* Extra overflow characters */}
          {typed.length > targetWord.length &&
            typed
              .slice(targetWord.length)
              .split("")
              .map((extraCh, k) => {
                const isCaretHere = targetWord.length + k === activeCharIndex;
                return (
                  <span
                    key={`extra-${k}`}
                    ref={isCaretHere ? activeCharRef : undefined}
                    data-is-extra="true"
                    className="text-red-400/90 bg-red-950/60 font-medium"
                  >
                    {extraCh}
                  </span>
                );
              })}
          {/* Caret fallback position when typed length equals word length */}
          {activeCharIndex >= targetWord.length && typed.length === targetWord.length && (
            <span ref={activeCharRef} data-is-extra="true" className="inline opacity-0">
              &#8203;
            </span>
          )}
        </span>
      );
    }

    if (isPast) {
      const isWordCorrect = typed === targetWord;
      return (
        <span
          key={index}
          className={`${baseClass} ${
            isWordCorrect ? "text-zinc-500" : "text-red-400/80 border-b border-red-500/50"
          }`}
        >
          {targetWord.split("").map((ch, j) => {
            if (j >= typed.length) {
              return (
                <span key={j} className="text-red-400/60 underline">
                  {ch}
                </span>
              );
            }
            return (
              <span key={j} className={typed[j] === ch ? "text-zinc-500" : "text-red-400"}>
                {ch}
              </span>
            );
          })}
          {typed.length > targetWord.length && (
            <span className="text-red-400/90">{typed.slice(targetWord.length)}</span>
          )}
        </span>
      );
    }

    // Future words
    return (
      <span key={index} className={`${baseClass} text-zinc-600`}>
        {targetWord}
      </span>
    );
  };

  const timeLeft = mode === "time" ? Math.max(0, timeLimit - elapsed) : null;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Settings / Top Bar */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm">
        <div className="flex items-center gap-1 rounded-xl bg-zinc-900/90 p-1.5 border border-zinc-800/60">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setLanguage(opt.id);
                resetTest(opt.id, mode, wordCount, punctuation);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                language === opt.id ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Punctuation Mode Toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-zinc-900/90 p-1.5 border border-zinc-800/60">
          <button
            type="button"
            onClick={() => {
              const nextPunc = !punctuation;
              setPunctuation(nextPunc);
              resetTest(language, mode, wordCount, nextPunc);
            }}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              punctuation ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ! punctuation
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-zinc-900/90 p-1.5 border border-zinc-800/60">
          <button
            type="button"
            onClick={() => {
              setMode("time");
              resetTest(language, "time", wordCount, punctuation);
            }}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              mode === "time" ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            time
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("words");
              resetTest(language, "words", wordCount, punctuation);
            }}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              mode === "words" ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            words
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-zinc-900/90 p-1.5 border border-zinc-800/60">
          {(mode === "time" ? TIME_OPTIONS : WORD_OPTIONS).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (mode === "time") {
                  setTimeLimit(opt);
                  resetTest(language, "time", wordCount, punctuation);
                } else {
                  setWordCount(opt);
                  resetTest(language, "words", opt, punctuation);
                }
              }}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                (mode === "time" ? timeLimit : wordCount) === opt
                  ? "bg-emerald-500 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Live Timer / Counter display */}
      <div className="mb-4 flex h-10 items-center justify-between px-2 font-mono text-3xl text-zinc-300">
        <div>
          {status === "running" && mode === "time" && (
            <span className={timeLeft && timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-emerald-400"}>
              {timeLeft}s
            </span>
          )}
          {status === "running" && mode === "words" && (
            <span className="text-emerald-400">
              {wordIndex}/{wordCount}
            </span>
          )}
          {status === "idle" && (
            <span className="text-zinc-400">
              {mode === "time" ? `${timeLimit}s` : `${wordCount} words`}
            </span>
          )}
        </div>
        {status === "running" && (
          <div className="text-sm font-sans tracking-wide text-zinc-500">
            Press <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">Tab</kbd> to restart
          </div>
        )}
      </div>

      {/* Typing Frame */}
      <div
        className="relative cursor-text overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/95 p-6 sm:p-10 shadow-2xl"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          autoFocus={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Typing test input"
          className="absolute inset-0 h-full w-full cursor-text opacity-0 z-30"
        />

        {/* Masked 3-Line Centered Display Viewport */}
        <div
          ref={containerRef}
          className="relative h-[8.5rem] overflow-hidden leading-relaxed"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
          }}
        >
          <div
            ref={wordsWrapperRef}
            className="transition-transform duration-150 ease-out"
            style={{ transform: `translateY(-${scrollOffset}px)` }}
          >
            {/* Monkeytype Smooth Gliding Caret */}
            {caretPos && status !== "finished" && (
              <div
                className={`absolute z-20 w-[2.5px] rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] transition-all duration-75 ease-out ${
                  status === "idle" ? "animate-caret-blink" : ""
                }`}
                style={{
                  left: `${caretPos.left}px`,
                  top: `${caretPos.top}px`,
                  height: `${caretPos.height}px`,
                }}
              />
            )}

            <div className={`flex flex-wrap ${status === "finished" ? "opacity-30" : ""}`}>
              {words.slice(0, targetWordCount).map((word, i) => renderWord(word, i))}
            </div>
          </div>
        </div>

        {status === "idle" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs tracking-wider uppercase text-zinc-500 font-medium">
            Start typing to begin
          </div>
        )}
      </div>

      {/* Monkeytype Authentic Results Screen */}
      {status === "finished" && result && (
        <div className="mt-8 rounded-2xl border border-zinc-800/90 bg-zinc-900/90 p-8 shadow-xl">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">wpm</div>
              <div className="text-5xl font-extrabold text-emerald-400 mt-1">{result.wpm}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">acc</div>
              <div className="text-5xl font-extrabold text-zinc-100 mt-1">{result.accuracy}%</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">raw wpm</div>
              <div className="text-3xl font-bold text-zinc-300 mt-2">{result.rawWpm}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">characters</div>
              <div className="text-xl font-mono text-zinc-300 mt-2">
                <span className="text-emerald-400">{result.correctChars}</span>/
                <span className="text-red-400">{result.incorrectChars}</span>/
                <span className="text-amber-400">{result.extraChars}</span>/
                <span className="text-zinc-500">{result.missedChars}</span>
              </div>
            </div>
          </div>

          {/* Earnings & Qualification Funnel */}
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-left">
            {result.wpm >= 35 ? (
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Earning Potential
                    </span>
                  </div>
                  <div className="font-mono text-sm text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-lg">
                    Est. ${calculateEarnings(result.wpm, 15, result.accuracy).hourlyRate}/hr ($
                    {calculateEarnings(result.wpm, 15, result.accuracy).monthlyEarnings.toLocaleString()}/mo)
                  </div>
                </div>
                <h3 className="mt-2 text-lg font-bold text-zinc-100">
                  Your speed of {result.wpm} WPM qualifies you for paid transcription jobs!
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  With {result.accuracy}% accuracy, you can finish audio tasks quickly and earn steady payouts from home. Apply directly to start claiming paid audio:
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href={AFFILIATE.gotranscript}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
                  >
                    <span>Apply to GoTranscript</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <a
                    href={AFFILIATE.rev}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
                  >
                    <span>Apply to Rev</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Target: 45+ WPM for the top of the $2-$6/hr band
                </div>
                <h3 className="mt-1 text-base font-bold text-zinc-100">
                  Practice daily to qualify for GoTranscript &amp; Rev
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  General transcription pays about $2 to $6 an hour effective. Faster,
                  more accurate typists land toward the top of that range. Just 5 minutes
                  of practice a day on Kinetype will get you there.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <a
                    href={AFFILIATE.gotranscript}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
                  >
                    Apply to GoTranscript &rarr;
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-zinc-800/80 pt-6">
            <button
              type="button"
              onClick={() => resetTest(language, mode, wordCount, punctuation)}
              className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Next test
            </button>
            <button
              type="button"
              onClick={share}
              className="rounded-xl border border-zinc-700 px-6 py-3 font-medium text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
            >
              {copied ? "Copied!" : "Share result"}
            </button>
            <button
              type="button"
              onClick={() => setShowCert(true)}
              className="rounded-xl border border-zinc-700 px-6 py-3 font-medium text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
            >
              Free certificate
            </button>
          </div>
        </div>
      )}

      {showCert && result && (
        <Certificate wpm={result.wpm} accuracy={result.accuracy} onClose={() => setShowCert(false)} />
      )}
    </div>
  );
}
