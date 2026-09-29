"use client";

import type { PromptView } from "@/game/engine";
import type { Overlay } from "@/game/skins";

const TIER_LABEL: Record<string, string> = {
  light: "LIGHT",
  mid: "MID",
  heavy: "HEAVY",
};

const TIER_CLASS: Record<string, string> = {
  light: "text-brand-bright border-brand/40",
  mid: "text-coin border-coin/40",
  heavy: "text-heat border-heat/40",
};

/**
 * The word the player types.
 *
 * There is exactly one of these on screen at a time, so it can be large. That matters
 * because the player is looking at their KEYBOARD, not the screen: the text is big, the
 * committed characters are high contrast, the next character is boxed and underlined, and
 * a mistake flashes the word red. Audio alone is not enough feedback for a typing game,
 * and visual alone is not enough either. This is the visual half.
 */
export default function PromptCard({
  prompt,
  overlay,
  compact = false,
  isGuard,
  isRecovery,
}: {
  prompt: PromptView;
  overlay: Overlay;
  compact?: boolean;
  isGuard: boolean;
  isRecovery: boolean;
}) {
  const active = prompt.typed > 0;
  const done = prompt.typed >= prompt.text.length;

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
      } ${isRecovery ? "ring-2 ring-coin/70" : ""}`}
      style={{
        background: overlay.promptBg,
        borderColor: active ? overlay.promptActive : overlay.border,
      }}
    >
      {!compact && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={`border px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider ${
              TIER_CLASS[prompt.tier]
            }`}
          >
            {isGuard ? "GUARD — BLOCK IT" : isRecovery ? "SAVE — TYPE IT NOW" : TIER_LABEL[prompt.tier]}
          </span>
          {prompt.flawed ? (
            <span className="font-mono text-[11px] font-bold text-heat">
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
              className={
                committed
                  ? "font-bold text-brand-bright"
                  : next
                    ? "bg-brand-deep px-0.5 font-bold text-ink underline decoration-brand decoration-4 underline-offset-4"
                    : "text-ink-faint"
              }
            >
              {ch}
            </span>
          );
        })}
      </div>

      {compact && prompt.flawed ? (
        <span className="ml-2 font-mono text-[10px] text-heat">flawed</span>
      ) : null}
    </div>
  );
}
