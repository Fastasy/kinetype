"use client";

import { useState, useSyncExternalStore } from "react";

import { coinLabel, purchaseWithCoins, REAL_MONEY_DISABLED_REASON, type ItemKind } from "@/game/commerce";
import { OVERLAYS, RARITY_LABEL, SKINS, type Skin } from "@/game/skins";
import { saveStore } from "@/game/store";
import type { SaveData } from "@/game/storage";

/** Procedural preview: drawn from the skin data, exactly like the fighter is. */
function SkinPreview({ skin, size = 96 }: { skin: Skin; size?: number }) {
  const s = skin.silhouette;
  const scale = size / 110;
  const w = s.w * scale;
  const h = s.h * scale;
  const headR = w * 0.46;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const rad = (1 - s.edge) * (Math.min(w, h) / 2);
  const id = `g-${skin.id}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${skin.name} preview`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={skin.palette.body} />
          <stop offset="100%" stopColor={skin.palette.trim} />
        </linearGradient>
      </defs>
      {s.fins > 0 &&
        Array.from({ length: s.fins }).map((_, i) => {
          const y = cy - h / 2 + 8 + i * ((h - 16) / Math.max(1, s.fins));
          return (
            <polygon
              key={i}
              points={`${cx + w / 2 - 2},${y} ${cx + w / 2 + 10 * scale},${y + 6 * scale} ${cx + w / 2 - 2},${y + 12 * scale}`}
              fill={skin.palette.trim}
            />
          );
        })}
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={rad}
        fill={`url(#${id})`}
        stroke={skin.palette.glow}
        strokeWidth={1.5}
      />
      {s.mass > 0.4 && (
        <ellipse cx={cx} cy={cy - h / 2 + 10 * scale} rx={w * (0.42 + s.mass * 0.28)} ry={7 * scale} fill={skin.palette.body} />
      )}
      <circle cx={cx} cy={cy - h / 2 - headR * 0.75} r={headR} fill={skin.palette.body} />
      <circle cx={cx} cy={cy - h / 2 - headR * 0.75} r={headR * 0.62} fill={skin.palette.accent} />
      <circle cx={cx - 3 * scale} cy={cy - h / 2 - headR * 0.75 - 1} r={1.6 * scale} fill="#09090b" />
      <circle cx={cx + 3 * scale} cy={cy - h / 2 - headR * 0.75 - 1} r={1.6 * scale} fill="#09090b" />
    </svg>
  );
}

export default function ShopClient() {
  const save = useSyncExternalStore(
    saveStore.subscribe,
    saveStore.getSnapshot,
    saveStore.getServerSnapshot,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function commit(next: SaveData, notice: string) {
    saveStore.set(next);
    setMsg(notice);
    setErr(null);
  }

  function buy(kind: ItemKind, id: string, price: number, name: string) {
    const r = purchaseWithCoins(save, kind, id, price);
    if (!r.ok || !r.save) {
      setErr(r.reason ?? "That did not work.");
      setMsg(null);
      return;
    }
    commit(r.save, `${name} unlocked and equipped.`);
  }

  function equip(kind: ItemKind, id: string, name: string) {
    const next: SaveData =
      kind === "skin" ? { ...save, equippedSkin: id } : { ...save, equippedOverlay: id };
    commit(next, `${name} equipped.`);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <div className="font-mono text-sm">
          <span className="text-amber-400 text-lg font-bold">
            {coinLabel(save.coins)}
          </span>{" "}
          <span className="text-zinc-400">coins</span>
        </div>
        <p className="text-xs text-zinc-500">
          Coins are earned by playing. Win rounds, type fast, and keep a streak going.
        </p>
      </div>

      {(msg || err) && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-2 text-sm ${
            err ? "border-rose-500/40 bg-rose-950/30 text-rose-300" : "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
          }`}
        >
          {err ?? msg}
        </div>
      )}

      <section aria-labelledby="fighters">
        <h2 id="fighters" className="font-mono text-lg font-bold text-zinc-100">
          Fighters
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Every fighter is drawn from data, not artwork, so each one loads instantly and costs the
          site nothing to serve.
        </p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKINS.map((skin) => {
            const owned = save.ownedSkins.includes(skin.id);
            const equipped = save.equippedSkin === skin.id;
            return (
              <li
                key={skin.id}
                className={`rounded-2xl border p-4 transition ${
                  equipped ? "border-emerald-500/60 bg-emerald-950/10" : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-100">{skin.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {RARITY_LABEL[skin.rarity]}
                    </div>
                  </div>
                  <SkinPreview skin={skin} size={72} />
                </div>
                <p className="mt-3 min-h-[40px] text-xs leading-relaxed text-zinc-400">{skin.blurb}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-amber-400">
                    {skin.price === 0 ? "Free" : `${skin.price} coins`}
                  </span>
                  {equipped ? (
                    <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                      Equipped
                    </span>
                  ) : owned ? (
                    <button
                      type="button"
                      onClick={() => equip("skin", skin.id, skin.name)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-emerald-500/60 hover:text-emerald-400"
                    >
                      Equip
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buy("skin", skin.id, skin.price, skin.name)}
                      disabled={save.coins < skin.price}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                      {save.coins < skin.price ? `${skin.price - save.coins} short` : "Unlock"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="overlays">
        <h2 id="overlays" className="font-mono text-lg font-bold text-zinc-100">
          HUD overlays
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Restyle the prompt panels and damage readout without changing how the fight plays.
        </p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {OVERLAYS.map((o) => {
            const owned = save.ownedOverlays.includes(o.id);
            const equipped = save.equippedOverlay === o.id;
            return (
              <li
                key={o.id}
                className={`rounded-2xl border p-4 ${
                  equipped ? "border-emerald-500/60 bg-emerald-950/10" : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="font-semibold text-zinc-100">{o.name}</div>
                <p className="mt-1 min-h-[32px] text-xs text-zinc-400">{o.blurb}</p>
                <div className="mt-3 flex gap-1.5">
                  {[o.panel, o.border, o.promptActive].map((c, i) => (
                    <span
                      key={i}
                      className="h-6 flex-1 rounded border border-zinc-700"
                      style={{ background: c }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-amber-400">
                    {o.price === 0 ? "Free" : `${o.price} coins`}
                  </span>
                  {equipped ? (
                    <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                      Equipped
                    </span>
                  ) : owned ? (
                    <button
                      type="button"
                      onClick={() => equip("overlay", o.id, o.name)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-emerald-500/60 hover:text-emerald-400"
                    >
                      Equip
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buy("overlay", o.id, o.price, o.name)}
                      disabled={save.coins < o.price}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                      {save.coins < o.price ? `${o.price - save.coins} short` : "Unlock"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="money"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-4"
      >
        <h2 id="money" className="font-mono text-sm font-bold text-zinc-200">
          About paying
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{REAL_MONEY_DISABLED_REASON}</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          That is deliberate, not an oversight. A cosmetic is worth buying when there is somebody to
          show it to, and right now you are fighting a bot. Card checkout goes live with
          multiplayer.
        </p>
      </section>
    </div>
  );
}
