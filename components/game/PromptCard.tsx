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
  mid: "text-flag border-flag/40",
  heavy: "text-heat border-heat/40",
};

/**
 * One prompt slot.
 *
 * Rendering rule that matters: the player is looking at their KEYBOARD, not the
 * screen. So the text is large, the committed characters are high contrast, the
 * next character is boxed, and a mistake flashes red. Audio alone is not enough
 * feedback for a typing game, and visual alone is not enough either; this is the
 * visual half.
 */
export default function PromptCard({
  prompt,
  overlay,
  compact = false,
  slot,
  isGuard,
  isRecovery,
}: {
  prompt: PromptView;
  overlay: Overlay;
  compact?: boolean;
  slot: number;
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
      className={`relative rounded-xl border transition ${
        compact ? "px-2 py-1.5" : "px-3 py-2.5"
      } ${isRecovery ? "ring-2 ring-flag/70" : ""}`}
      style={{
        background: overlay.promptBg,
        borderColor: active ? overlay.promptActive : overlay.border,
      }}
    >
      {!compact && (
        <div className="mb-1 flex items-center justify-between gap-2">
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
              TIER_CLASS[prompt.tier]
            }`}
          >
            {isGuard ? "GUARD" : isRecovery ? "SAVE" : TIER_LABEL[prompt.tier]}
          </span>
          <span className="font-mono text-[10px] text-muted">
            {slot + 1}
            {prompt.flawed ? <span className="ml-1 text-heat">flawed</span> : null}
          </span>
        </div>
      )}

      <div
        className={`font-mono tracking-wide ${
          compact ? "text-sm" : isRecovery ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"
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
                    ? "rounded bg-white/15 px-0.5 font-bold text-strong underline decoration-brand-bright decoration-2 underline-offset-4"
                    : "text-muted"
              }
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}
