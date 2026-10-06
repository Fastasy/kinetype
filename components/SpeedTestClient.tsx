"use client";

import { useEffect, useRef, useState } from "react";

const DURATIONS = [15, 30, 60] as const;
type DurationSeconds = (typeof DURATIONS)[number];

/**
 * A plain typing speed test.
 *
 * Deliberately NOT the game engine: this page answers "what is my words per minute",
 * which is a measuring question, not a playing one. It shares the game's sentence pool
 * so the text is the same school-safe content, but there is no opponent, no knockback
 * and nothing to lose, which is exactly the difference the copy points out.
 *
 * Counting rules, stated on the page so the number is not a mystery:
 *   - WPM = (correctly typed characters / 5) / minutes elapsed
 *   - accuracy = correct characters / every character ever typed, so backspacing to fix
 *     a mistake scores the fix but not the mistake
 */
export default function SpeedTestClient({ sentences }: { sentences: string[] }) {
  const [duration, setDuration] = useState<DurationSeconds>(60);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [correct, setCorrect] = useState(0);
  const [errors, setErrors] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [focused, setFocused] = useState(false);

  const startedAt = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const target = sentences.length > 0 ? sentences[index % sentences.length] : "";

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (startedAt.current === null) return;
      const seconds = (Date.now() - startedAt.current) / 1000;
      if (seconds >= duration) {
        setElapsed(duration);
        setRunning(false);
        setFinished(true);
        inputRef.current?.blur();
      } else {
        setElapsed(seconds);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running, duration]);

  const minutes = elapsed / 60;
  const wpm = minutes > 0 ? Math.round(correct / 5 / minutes) : 0;
  const total = correct + errors;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 100;
  const timeLeft = Math.max(0, Math.ceil(duration - elapsed));

  function reset(nextDuration: DurationSeconds = duration) {
    setDuration(nextDuration);
    setIndex(0);
    setTyped("");
    setCorrect(0);
    setErrors(0);
    setElapsed(0);
    setRunning(false);
    setFinished(false);
    startedAt.current = null;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleChange(raw: string) {
    if (finished || !target) return;

    if (startedAt.current === null) {
      startedAt.current = Date.now();
      setRunning(true);
    }

    let value = raw;
    let gained = 0;
    let lost = 0;

    // 1. Count the newly appended characters the moment they arrive. Deletions do not
    //    refund them, so a corrected typo still shows up in the accuracy figure.
    if (value.length > typed.length && value.startsWith(typed)) {
      for (let i = typed.length; i < Math.min(value.length, target.length); i += 1) {
        if (value[i] === target[i]) gained += 1;
        else lost += 1;
      }
    }

    // 2. If the sentence is finished, bank it and carry any overshoot into the next
    //    sentence. Without the carry, a keystroke arriving in the same input event as the
    //    final character of a sentence would be dropped or counted against the wrong text.
    let nextIndex = index;
    if (value.length >= target.length && value.slice(0, target.length) === target) {
      nextIndex = index + 1;
      const next = sentences[nextIndex % sentences.length] ?? "";
      let carry = value.slice(target.length);
      if (carry.length > next.length) {
        lost += carry.length - next.length;
        carry = carry.slice(0, next.length);
      }
      for (let i = 0; i < carry.length; i += 1) {
        if (carry[i] === next[i]) gained += 1;
        else lost += 1;
      }
      value = carry;
    } else if (value.length > target.length) {
      // Characters typed past the end of an unfinished sentence.
      lost += value.length - target.length;
      value = value.slice(0, target.length);
    }

    if (gained > 0) setCorrect((c) => c + gained);
    if (lost > 0) setErrors((e) => e + lost);
    setIndex(nextIndex);
    setTyped(value);
  }

  function bandLabel(): string {
    if (wpm === 0) return "No characters typed yet.";
    if (wpm < 30) return "Below the general adult range of about 40 to 52 words per minute.";
    if (wpm < 40) return "Just under the general adult range of about 40 to 52 words per minute.";
    if (wpm <= 52) return "Inside the general adult range of about 40 to 52 words per minute.";
    if (wpm <= 70) return "Above the general adult range of about 40 to 52 words per minute.";
    if (wpm <= 90) return "Fast. Comfortably above the general adult range.";
    return "Very fast, and into enthusiast territory.";
  }

  return (
    <section
      aria-labelledby="test"
      className="mt-8 rounded-2xl border border-line bg-card/40 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="test" className="font-mono text-lg font-bold text-ink">
          Test
        </h2>
        <div className="flex items-center gap-2" role="group" aria-label="Test length">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => reset(d)}
              aria-pressed={duration === d}
              className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
                duration === d
                  ? "border-brand/60 bg-brand/15 text-ink"
                  : "border-line text-ink-faint hover:border-brand/40 hover:text-ink-soft"
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 font-mono text-sm">
        <span className="text-ink" data-test-wpm>
          {wpm} wpm
        </span>
        <span className="text-ink-soft" data-test-accuracy>
          accuracy {accuracy}%
        </span>
        <span className="text-ink-faint" data-test-time>
          {timeLeft}s left
        </span>
      </div>

      <p
        className="mt-5 select-none font-mono text-lg leading-relaxed sm:text-xl"
        aria-hidden="true"
        data-test-passage
      >
        {target.split("").map((ch, i) => {
          const state = i < typed.length ? (typed[i] === ch ? "done" : "bad") : i === typed.length ? "next" : "todo";
          const cls =
            state === "done"
              ? "text-aqua"
              : state === "bad"
                ? "bg-heat/30 text-heat"
                : state === "next"
                  ? "rounded bg-brand/25 text-ink"
                  : "text-ink-faint";
          return (
            <span key={i} className={cls}>
              {ch === " " ? "\u00a0" : ch}
            </span>
          );
        })}
      </p>

      {finished ? (
        <div className="mt-5 rounded-2xl border border-line bg-page p-5" data-test-result>
          <p className="font-mono text-3xl font-black text-ink">{wpm} wpm</p>
          <p className="mt-1 text-sm text-ink-soft">Accuracy {accuracy}% over {duration} seconds.</p>
          <p className="mt-2 text-sm text-ink-faint">{bandLabel()}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-4 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand/50 hover:text-ink"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <label htmlFor="speedtest-input" className="text-xs text-ink-faint">
            Type the passage above. This box keeps your typing, the passage is what you read.
          </label>
          <input
            id="speedtest-input"
            ref={inputRef}
            value={typed}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onPaste={(e) => e.preventDefault()}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-label="Type the passage"
            className="mt-2 w-full rounded-xl border border-line bg-page px-4 py-3 font-mono text-base text-ink outline-none transition focus:border-brand/60"
          />
          {!focused && !running && (
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-deep transition hover:bg-brand-bright"
            >
              Click here to start typing
            </button>
          )}
        </div>
      )}
    </section>
  );
}
