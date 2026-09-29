"use client";

import type { PromptView } from "@/game/engine";
import type { Theme } from "@/game/themes";

/**
 * Tier and kind colours are FIXED, not themed.
 *
 * They encode how much a word hits for, which makes them a signal rather than decoration, in
 * the same family as the damage ramp. A player must never relearn that heavy means red
 * because they changed theme. They are drawn as filled chips with their own background
 * precisely so a fixed colour stays readable on a dark theme as well as a light one.
 */
const KIND_CHIP: Record<string, { label: string; bg: string }> = {
  light: { label: "LIGHT", bg: "#7c3aed" },
  mid: { label: "MID", bg: "#b45309" },
  heavy: { label: "HEAVY", bg: "#be123c" },
};

const CHIP_TEXT = "#ffffff";

/**
 * The word the player types.
 *
 * There is exactly one of these on screen at a time, so it can be large. That matters
 * because the player is looking at their KEYBOARD, not the screen: the text is big, the
 * committed characters are high contrast, the next character is a filled block, and a
 * mistake is called out. Audio alone is not enough feedback for a typing game, and visual
 * alone is not enough either. This is the visual half.
 */
export default function PromptCard({
  prompt,
  theme,
  compact = false,
  isGuard,
  isRecovery,
}: {
  prompt: PromptView;
  theme: Theme;
  compact?: boolean;
  isGuard: boolean;
  isRecovery: boolean;
}) {
  const active = prompt.typed > 0;
  const done = prompt.typed >= prompt.text.length;

  const chip = isGuard
    ? { label: "GUARD", bg: "#0e7490" }
    : isRecovery
      ? { label: "SAVE", bg: "#0e7490" }
      : KIND_CHIP[prompt.tier] ?? KIND_CHIP.light;

  return (
    <div
      data-testid="prompt"
      data-text={prompt.text}
      data-typed={prompt.typed}
      data-kind={prompt.kind}
      data-tier={prompt.tier}
      data-flawed={prompt.flawed ? "1" : "0"}
      className={`relative border-2 transition ${
        compact ? "px-2 py-1.5" : "px-4 py-3"
      } ${isRecovery ? "ring-2" : ""}`}
      style={{
        background: theme.promptBg,
        borderColor: active ? theme.accent : theme.promptBorder,
        ...(isRecovery ? { ["--tw-ring-color" as string]: theme.accent } : {}),
      }}
    >
      {!compact && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className="px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider"
            style={{ background: chip.bg, color: CHIP_TEXT }}
          >
            {isGuard ? "GUARD — BLOCK IT" : isRecovery ? "SAVE — TYPE IT NOW" : chip.label}
          </span>
          {prompt.flawed ? (
            <span
              className="px-2 py-0.5 font-mono text-[11px] font-bold"
              style={{ background: "#be123c", color: CHIP_TEXT }}
            >
              flawed · no bonus
            </span>
          ) : null}
        </div>
      )}

      <div
        className={`font-mono tracking-wide ${
          compact ? "text-base" : isRecovery ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"
        }`}
      >
        {prompt.text.split("").map((ch, i) => {
          const committed = i < prompt.typed;
          const next = i === prompt.typed && !done;
          return (
            <span
              key={`${prompt.id}-${i}`}
              style={{
                color: committed ? theme.accent : theme.textMuted,
                ...(next ? { background: theme.accent, color: theme.onAccent } : {}),
              }}
              className={committed || next ? "px-0.5 font-bold" : undefined}
            >
              {ch}
            </span>
          );
        })}
      </div>

      {compact && prompt.flawed ? (
        <span
          className="ml-2 px-1.5 py-0.5 font-mono text-[10px] font-bold"
          style={{ background: "#be123c", color: CHIP_TEXT }}
        >
          flawed
        </span>
      ) : null}
    </div>
  );
}
