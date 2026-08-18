"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AFRIKAANS_WORDS, CODE_SNIPPETS, ENGLISH_WORDS } from "@/lib/words";
import Certificate from "./Certificate";

type Language = "english" | "afrikaans" | "code";
type Mode = "time" | "words";
type Status = "idle" | "running" | "finished";

interface TestResult {
  wpm: number;
  accuracy: number;
  durationSec: number;
  correctChars: number;
  totalChars: number;
  errors: number;
}

const TIME_OPTIONS = [15, 30, 60, 120] as const;
const WORD_OPTIONS = [10, 25, 50, 100] as const;
const LANGUAGE_OPTIONS: { id: Language; label: string }[] = [
  { id: "english", label: "English" },
  { id: "afrikaans", label: "Afrikaans" },
  { id: "code", label: "Code" },
];

// Deterministic PRNG so the initial word list is identical on server and
// client (avoids React hydration mismatch from Math.random).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWords(language: Language, count: number, rng: () => number = Math.random): string[] {
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
  const source = language === "afrikaans" ? AFRIKAANS_WORDS : ENGLISH_WORDS;
  return Array.from({ length: count }, () => source[Math.floor(rng() * source.length)]);
}

function wpm(correctChars: number, elapsedSec: number): number {
  const minutes = Math.max(elapsedSec, 1) / 60;
  return Math.round((correctChars / 5) / minutes);
}

function scoreWord(typedPart: string, target: string): { correct: number; errors: number } {
  let correct = 0;
  let errors = 0;
  for (let j = 0; j < typedPart.length; j++) {
    if (j < target.length && typedPart[j] === target[j]) {
      correct++;
    } else {
      errors++;
    }
  }
  if (typedPart.length > target.length) {
    errors += typedPart.length - target.length;
  }
  return { correct, errors };
}

export default function TypingTest() {
  const [language, setLanguage] = useState<Language>("english");
  const [mode, setMode] = useState<Mode>("time");
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [wordCount, setWordCount] = useState<number>(25);
  const [words, setWords] = useState<string[]>(() =>
    pickWords("english", 400, mulberry32(20260818)),
  );
  const [wordIndex, setWordIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [wrongFlags, setWrongFlags] = useState<boolean[]>([]);
  const [result, setResult] = useState<TestResult | null>(null);
  const [showCert, setShowCert] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const startedAtRef = useRef(0);
  const correctCharsRef = useRef(0);
  const totalCharsRef = useRef(0);
  const errorsRef = useRef(0);
  const wordIndexRef = useRef(0);
  const typedRef = useRef("");

  const visibleCount = mode === "time" ? Math.min(words.length, 400) : wordCount;

  const resetRefs = useCallback(() => {
    startedAtRef.current = 0;
    correctCharsRef.current = 0;
    totalCharsRef.current = 0;
    errorsRef.current = 0;
    wordIndexRef.current = 0;
    typedRef.current = "";
  }, []);

  const finish = useCallback(() => {
    // score whatever is still in the current word (timer stopped mid-word)
    const pending = typedRef.current;
    const target = words[wordIndexRef.current] ?? "";
    if (pending.length > 0) {
      const scored = scoreWord(pending, target);
      correctCharsRef.current += scored.correct;
      errorsRef.current += scored.errors;
      // totalCharsRef already counted these keystrokes via input deltas
    }

    const elapsedSec = Math.max((Date.now() - startedAtRef.current) / 1000, 0.1);
    setElapsed(Math.round(elapsedSec));
    const correct = correctCharsRef.current;
    const total = totalCharsRef.current;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 100;
    setResult({
      wpm: wpm(correct, elapsedSec),
      accuracy,
      durationSec: Math.round(elapsedSec),
      correctChars: correct,
      totalChars: total,
      errors: errorsRef.current,
    });
    setStatus("finished");
  }, [words]);

  const resetTest = useCallback((lang: Language, m: Mode, wc: number) => {
    setWords(pickWords(lang, m === "time" ? 400 : wc));
    setWordIndex(0);
    wordIndexRef.current = 0;
    setTyped("");
    typedRef.current = "";
    setStatus("idle");
    setResult(null);
    setShowCert(false);
    setCopied(false);
    setElapsed(0);
    resetRefs();
    inputRef.current?.focus();
  }, [resetRefs]);

  const restart = useCallback(() => {
    resetTest(language, mode, wordCount);
  }, [language, mode, wordCount, resetTest]);

  const changeLanguage = (lang: Language) => {
    if (lang !== language) {
      setLanguage(lang);
      resetTest(lang, mode, wordCount);
    }
  };

  const changeMode = (m: Mode) => {
    if (m !== mode) {
      setMode(m);
      resetTest(language, m, wordCount);
    }
  };

  const changeTimeLimit = (tl: number) => {
    if (tl !== timeLimit) {
      setTimeLimit(tl);
      resetTest(language, mode, wordCount);
    }
  };

  const changeWordCount = (wc: number) => {
    if (wc !== wordCount) {
      setWordCount(wc);
      resetTest(language, mode, wc);
    }
  };

  // time mode countdown
  useEffect(() => {
    if (status !== "running" || mode !== "time") return;
    const id = window.setInterval(() => {
      const secs = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(Math.round(secs));
      if (secs >= timeLimit) {
        window.clearInterval(id);
        finish();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [status, mode, timeLimit, finish]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (status === "finished") return;
    const value = e.target.value;
    typedRef.current = value;

    if (status === "idle" && value.length > 0) {
      startedAtRef.current = Date.now();
      setStatus("running");
    }

    const prev = typed;
    totalCharsRef.current += Math.max(0, value.length - prev.length);

    const lastCharIsSpace = value.length > 0 && value.endsWith(" ");
    const currentWord = words[wordIndexRef.current] ?? "";
    const typedPart = lastCharIsSpace ? value.slice(0, -1) : value;

    const isLastWord = wordIndexRef.current >= words.length - 1;
    const shouldCommit =
      lastCharIsSpace || (isLastWord && typedPart.length >= currentWord.length);

    if (shouldCommit) {
      const scored = scoreWord(typedPart, currentWord);
      correctCharsRef.current += scored.correct;
      errorsRef.current += scored.errors;
      // the separator space: correct when the word was right, an error otherwise.
      // Only when a space was actually typed (the last word can commit without one).
      if (lastCharIsSpace) {
        if (typedPart === currentWord) {
          correctCharsRef.current += 1;
        } else {
          errorsRef.current += 1;
        }
      }

      const wrong = typedPart !== currentWord;
      setWrongFlags((prevFlags) => {
        const next = [...prevFlags];
        next[wordIndexRef.current] = wrong;
        return next;
      });

      const nextIndex = wordIndexRef.current + 1;
      if (nextIndex >= words.length) {
        setTyped("");
        typedRef.current = "";
        finish();
        return;
      }
      wordIndexRef.current = nextIndex;
      setWordIndex(nextIndex);
      setTyped("");
      typedRef.current = "";
      return;
    }

    setTyped(value);
  };

  const timeLeft = mode === "time" ? Math.max(0, timeLimit - elapsed) : null;

  const share = async () => {
    if (!result) return;
    const text = `I type ${result.wpm} WPM with ${result.accuracy}% accuracy on Kinetype. Test your speed: https://kinetype.com`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kinetype", text });
        return;
      }
    } catch {
      // share sheet cancelled, fall through to clipboard
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderActiveWord = (word: string, index: number) => {
    const isActive = index === wordIndex;
    const isDone = index < wordIndex;
    const isWrong = wrongFlags[index];
    const base = "px-1 py-0.5 rounded font-mono text-lg sm:text-xl leading-relaxed";
    if (isDone) {
      return (
        <span key={index} className={`${base} ${isWrong ? "text-red-400" : "text-emerald-400"}`}>
          {word}
        </span>
      );
    }
    if (isActive) {
      return (
        <span key={index} className={`${base} bg-zinc-800 text-zinc-100`}>
          {word.split("").map((ch, j) => {
            if (j >= typed.length) return <span key={j} className="text-zinc-400">{ch}</span>;
            return (
              <span key={j} className={typed[j] === ch ? "text-emerald-400" : "text-red-400"}>
                {ch}
              </span>
            );
          })}
          {typed.length > word.length && (
            <span className="text-red-400">{typed.slice(word.length)}</span>
          )}
        </span>
      );
    }
    return (
      <span key={index} className={`${base} text-zinc-500`}>
        {word}
      </span>
    );
  };

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-sm">
        <div className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => changeLanguage(opt.id)}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                language === opt.id ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => changeMode("time")}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              mode === "time" ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            time
          </button>
          <button
            type="button"
            onClick={() => changeMode("words")}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              mode === "words" ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            words
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1">
          {(mode === "time" ? TIME_OPTIONS : WORD_OPTIONS).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => (mode === "time" ? changeTimeLimit(opt) : changeWordCount(opt))}
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

      {/* Timer / status */}
      <div className="mb-4 flex h-8 items-center justify-center font-mono text-2xl text-zinc-600">
        {status === "finished" && result ? (
          <span className="text-emerald-400">{result.wpm} WPM</span>
        ) : timeLeft !== null && status === "running" ? (
          <span className={timeLeft <= 5 ? "text-red-400" : ""}>{timeLeft}s</span>
        ) : mode === "time" ? (
          <span>{timeLimit}s</span>
        ) : (
          <span>{wordIndex}/{visibleCount}</span>
        )}
      </div>

      {/* Test area */}
      <div
        className="relative cursor-text rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          value={typed}
          onChange={handleChange}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Typing input"
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
        <div
          className={`max-h-56 overflow-hidden leading-relaxed ${
            status === "finished" ? "opacity-40" : ""
          }`}
          aria-live="polite"
        >
          {words.slice(0, visibleCount).map((word, i) => renderActiveWord(word, i))}
        </div>
        {status === "idle" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-zinc-500">
            Click here and start typing to begin
          </div>
        )}
      </div>

      {/* Results */}
      {status === "finished" && result && (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{result.wpm}</div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">WPM</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-zinc-100">{result.accuracy}%</div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-zinc-100">{result.durationSec}s</div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-zinc-100">{result.errors}</div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">errors</div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={restart}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Retake test
            </button>
            <button
              type="button"
              onClick={share}
              className="rounded-xl border border-zinc-700 px-5 py-2.5 font-medium text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
            >
              {copied ? "Copied!" : "Share result"}
            </button>
            <button
              type="button"
              onClick={() => setShowCert(true)}
              className="rounded-xl border border-zinc-700 px-5 py-2.5 font-medium text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-400"
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
