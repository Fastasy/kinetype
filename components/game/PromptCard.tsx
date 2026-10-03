"use client";

import { Fragment } from "react";

import type { PromptView } from "@/game/engine";
import type { Theme } from "@/game/themes";
import type { MoveKind } from "@/game/types";

/**
 * Move colours are FIXED, not themed.
 *
 * They encode what a word does when it completes, which makes them a signal rather
 * than decoration, in the same family as the damage ramp. A player must never relearn
 * that a kick is red because they changed theme, so these are drawn as filled chips
 * and underlines with their own background, and they stay readable on a dark theme as
 * well as a light one.
 */
export const MOVE_CHIP: Record<MoveKind, { label: string; bg: string; ink: string }> = {
  block: { label: "BLOCK", bg: "#0e7490", ink: "#ffffff" },
  punch: { label: "PUNCH", bg: "#7c3aed", ink: "#ffffff" },
  kick: { label: "KICK", bg: "#be123c", ink: "#ffffff" },
};

const CHIP_TEXT = "#ffffff";

/**
 * The sentence the player types, one word at a time.
 *
 * Every word is a move and the card says which, because the player is looking at their
 * KEYBOARD, not the screen: the words are large, each word carries its move as an
 * underline in the move's colour, the committed characters are high contrast, the next
 * character is a filled block, and the live word is filled so the eye can find it after
 * every glance away. Audio alone is not enough feedback for a typing game, and visual
 * alone is not enough either. This is the visual half.
 */
export default function PromptCard({
  prompt,
  theme,
  compact = false,
  isRecovery,
}: {
  prompt: PromptView;
  theme: Theme;
  compact?: boolean;
  isRecovery: boolean;
}) {
  const live = prompt.words[prompt.index];
  const done = prompt.index >= prompt.words.length;
  const chip = isRecovery
    ? { label: "SAVE", bg: "#0e7490", ink: CHIP_TEXT }
    : live
      ? MOVE_CHIP[live.move]
      : MOVE_CHIP.punch;

  return (
    <div
      data-testid="prompt"
      data-text={prompt.text}
      data-typed={prompt.typed}
      data-kind={prompt.kind}
      data-move={live?.move ?? ""}
      data-index={prompt.index}
      data-flawed={prompt.flawed ? "1" : "0"}
      data-pending-space={prompt.pendingSpace ? "1" : "0"}
      data-next-key={prompt.nextKey ?? ""}
      className={`relative border-2 transition ${compact ? "px-2 py-1.5" : "px-4 py-3"} ${
        isRecovery ? "ring-2" : ""
      }`}
      style={{
        background: theme.promptBg,
        borderColor: done || prompt.typed > 0 ? theme.accent : theme.promptBorder,
        ...(isRecovery ? { ["--tw-ring-color" as string]: theme.accent } : {}),
      }}
    >
      {!compact && (
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          {/*
            The header follows `nextKey`, not the live word's move, because the live word can
            already be FINISHED while its separator is still outstanding. Announcing "PUNCH —
            TYPE THE HIGHLIGHTED WORD" over a word that is already typed out is how a player
            ends up stuck on a space they were never told about.
          */}
          <span
            className="px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider"
            style={{
              background: prompt.pendingSpace ? theme.accent : chip.bg,
              color: prompt.pendingSpace ? theme.onAccent : chip.ink,
            }}
          >
            {isRecovery
              ? "SAVE — TYPE IT NOW"
              : prompt.pendingSpace
                ? "HIT SPACE FOR THE NEXT WORD"
                : `${chip.label} — TYPE THE HIGHLIGHTED WORD`}
          </span>
          {/* The legend rides on the card header rather than a row of its own: the arena,
              the bot panel and the prompts all have to fit one screenful, and a separate
              line cost ~14px of the budget the prompts need. */}
          {!isRecovery && (
            <span
              className="flex flex-wrap items-center gap-x-2 font-mono text-[9px] leading-none"
              style={{ color: theme.textMuted }}
            >
              {(["block", "punch", "kick"] as const).map((m) => (
                <span key={m} className="flex items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-3"
                    style={{ background: MOVE_CHIP[m].bg }}
                  />
                  {m === "block" ? "SMALL" : m === "punch" ? "NORMAL" : "LONG"} ={" "}
                  {MOVE_CHIP[m].label}
                </span>
              ))}
            </span>
          )}
          {prompt.flawed ? (
            <span
              className="px-2 py-0.5 font-mono text-[11px] font-bold"
              style={{ background: "#be123c", color: CHIP_TEXT }}
            >
              flawed word · no bonus
            </span>
          ) : null}
        </div>
      )}

      <div
        data-testid="sentence"
        className={`flex flex-wrap items-baseline gap-x-[0.6ch] gap-y-1 font-mono tracking-wide ${
          compact ? "text-sm sm:text-base" : isRecovery ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"
        }`}
      >
        {prompt.words.map((word, i) => {
          const isLive = i === prompt.index;
          const finished = word.typed >= word.text.length;
          const chipStyle = MOVE_CHIP[word.move];
          // The live word is DONE while its separator is outstanding, so it reads as done.
          const spent = finished && (!isLive || prompt.pendingSpace);
          return (
            <Fragment key={`${prompt.id}-${i}`}>
            <span
              data-word={word.text}
              data-move={word.move}
              data-typed={word.typed}
              data-live={isLive ? "1" : "0"}
              className="whitespace-nowrap"
              style={{
                // The underline IS the move: teal blocks, purple punches, red kicks.
                borderBottom: `3px solid ${chipStyle.bg}`,
                opacity: spent ? 0.55 : 1,
                ...(isLive && !compact && !prompt.pendingSpace
                  ? { background: `${theme.accent}1f`, padding: "0 0.25rem", margin: "0 -0.25rem" }
                  : {}),
              }}
            >
              {word.text.split("").map((ch, j) => {
                const committed = j < word.typed;
                const next = isLive && j === word.typed;
                return (
                  <span
                    key={`${prompt.id}-${i}-${j}`}
                    style={{
                      color: committed ? theme.accent : theme.textMuted,
                      ...(next ? { background: theme.accent, color: theme.onAccent } : {}),
                    }}
                    // NO PADDING HERE, deliberately. This used to be "px-0.5 font-bold", which
                    // added 4px of real width to every character the moment it became committed
                    // or next. The sentence is a wrapping flex row, so the text physically grew
                    // about 4px per keystroke: over a long sentence that is 200px of growth,
                    // enough to push a word onto the next line, which changed the card's height
                    // and shoved the whole page up and down while the player typed. Ruan
                    // reported exactly that: "the website shifts up and down when I type."
                    //
                    // Font weight is safe because the sentence is monospace (bold and regular
                    // share an advance width), so bold is kept for the design and the padding is
                    // not. Anything that changes a character's BOX as the player types will
                    // reflow the sentence and reintroduce the shift.
                    className={committed || next ? "font-bold" : undefined}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
            {/*
              THE SEPARATOR, MADE VISIBLE. Typing a sentence has an invisible key in it — the
              space — and a player who does not know one is due simply stops, because the
              sentence has gone quiet with no cursor anywhere. This pill IS the cursor while a
              separator is pending, and it pulses so the eye finds it after a glance at the
              keyboard. It sits in the flex row at exactly the word gap it replaces.
            */}
            {prompt.pendingSpace && isLive ? (
              <span
                data-testid="space-cursor"
                className="animate-pulse px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider"
                style={{ background: theme.accent, color: theme.onAccent }}
              >
                SPACE
              </span>
            ) : null}
            </Fragment>
          );
        })}
      </div>

      {/*
        ALWAYS RENDERED, hidden rather than removed. This chip sits in the normal flow, so
        adding and removing it changed its panel's height — and because the chips come and go as
        a fighter makes and recovers from mistakes, the page shifted up and down repeatedly
        during play. Reserving the space permanently costs a few pixels of layout and removes the
        movement entirely. Do not go back to conditionally rendering it.
      */}
      {compact ? (
        <span
          className="ml-2 px-1.5 py-0.5 font-mono text-[10px] font-bold"
          style={{
            background: "#be123c",
            color: CHIP_TEXT,
            visibility: prompt.flawed ? "visible" : "hidden",
          }}
          aria-hidden={prompt.flawed ? undefined : true}
        >
          flawed
        </span>
      ) : null}
    </div>
  );
}
