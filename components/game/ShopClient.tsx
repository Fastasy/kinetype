"use client";

import { useState, useSyncExternalStore } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { purchaseCosmetic, setEquipped } from "@/lib/kinetype-db";
import { coinLabel, purchaseWithCoins, REAL_MONEY_DISABLED_REASON, type ItemKind } from "@/game/commerce";
import { RARITY_LABEL, SKINS, SPRITE_H, type PixelSkin } from "@/game/skins";
import { THEMES } from "@/game/themes";
import ThemeSwatch from "./ThemeSwatch";
import SkinSprite from "./SkinSprite";
import { saveStore } from "@/game/store";
import type { SaveData } from "@/game/storage";

/**
 * The shop renders the SAME pixel matrix the canvas blits, so a skin cannot look
 * one way here and another way in a fight.
 */
function SkinPreview({ skin, size = 112 }: { skin: PixelSkin; size?: number }) {
 const scale = Math.max(3, Math.round(size / SPRITE_H));
 return (
 <div
 className="flex items-center justify-center border-2 border-line bg-page"
 style={{ width: size, height: size }}
 >
 <SkinSprite skin={skin} scale={scale} />
 </div>
 );
}

export default function ShopClient() {
 const save = useSyncExternalStore(
 saveStore.subscribe,
 saveStore.getSnapshot,
 saveStore.getServerSnapshot,
 );
 const { userId, adoptProfile, refreshProfile } = useAuth();
 const [msg, setMsg] = useState<string | null>(null);
 const [err, setErr] = useState<string | null>(null);
 /** The id of the item currently being bought or equipped, so its button can show progress. */
 const [busy, setBusy] = useState<string | null>(null);

 function commit(next: SaveData, notice: string) {
 saveStore.set(next);
 setMsg(notice);
 setErr(null);
 }

 function fail(e: unknown, fallback = "That did not work.") {
 const message =
 e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
 ? (e as { message: string }).message
 : e instanceof Error && e.message
 ? e.message
 : fallback;
 setErr(message);
 setMsg(null);
 }

 /**
 * Signed in? The ACCOUNT pays: `purchase_cosmetic()` looks the real price up server-side and does
 * the debit and the balance check in one statement, so the shop cannot undercharge it and two
 * clicks cannot both go through. `save` mirrors the account, but it is only ever a display copy —
 * it is never the thing that spends.
 */
 async function buy(kind: ItemKind, id: string, price: number, name: string) {
 setErr(null);
 setMsg(null);

 if (userId) {
 setBusy(id);
 try {
 const updated = await purchaseCosmetic(kind, id);
 if (updated) adoptProfile(updated);
 setMsg(`${name} unlocked and equipped.`);
 } catch (e) {
 fail(e);
 } finally {
 setBusy(null);
 }
 return;
 }

 // Signed out: the browser's own wallet, unchanged.
 const r = purchaseWithCoins(save, kind, id, price);
 if (!r.ok || !r.save) {
 fail(r.reason ?? "That did not work.");
 return;
 }
 commit(r.save, `${name} unlocked and equipped.`);
 }

 async function equip(kind: ItemKind, id: string, name: string) {
 setErr(null);
 setMsg(null);

 if (userId) {
 setBusy(id);
 try {
 // Both halves are sent, so the untouched one is simply re-sent unchanged.
 await setEquipped(
 kind === "skin" ? id : save.equippedSkin,
 kind === "theme" ? id : save.equippedTheme,
 );
 await refreshProfile();
 setMsg(`${name} equipped.`);
 } catch (e) {
 fail(e);
 } finally {
 setBusy(null);
 }
 return;
 }

 const next: SaveData =
 kind === "skin" ? { ...save, equippedSkin: id } : { ...save, equippedTheme: id };
 commit(next, `${name} equipped.`);
 }

 return (
 <div className="space-y-8">
 <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card/40 px-4 py-3">
 <div className="font-mono text-sm" data-testid="shop-balance">
 <span className="text-coin text-lg font-bold">
 {coinLabel(save.coins)}
 </span>{" "}
 <span className="text-ink-faint">coins</span>
 </div>
 <p className="text-xs text-ink-faint">
 Coins are earned by playing. Win rounds, type fast, and keep a streak going.{" "}
 {userId
 ? "Your balance is saved to your account, so it follows you to any device you sign in on."
 : "Sign in to keep your balance on your account rather than in this browser."}
 </p>
 </div>

 {(msg || err) && (
 <div
 role="status"
 className={`rounded-xl border px-4 py-2 text-sm ${
 err ? "border-heat bg-heat-deep text-heat" : "border-brand bg-brand-deep text-ink"
 }`}
 >
 {err ?? msg}
 </div>
 )}

 <section aria-labelledby="fighters">
 <h2 id="fighters" className="font-mono text-lg font-bold text-ink">
 Fighters
 </h2>
 <p className="mt-1 text-sm text-ink-faint">
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
 equipped ? "border-brand/60 bg-brand-deep/10" : "border-line bg-card/40"
 }`}
 >
 <div className="flex items-start justify-between gap-3">
 <div>
 <div className="font-semibold text-ink">{skin.name}</div>
 <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
 {RARITY_LABEL[skin.rarity]}
 </div>
 </div>
 <SkinPreview skin={skin} size={72} />
 </div>
 <p className="mt-3 min-h-[40px] text-xs leading-relaxed text-ink-faint">{skin.blurb}</p>
 <div className="mt-3 flex items-center justify-between gap-2">
 <span className="font-mono text-xs text-coin">
 {skin.price === 0 ? "Free" : `${coinLabel(skin.price)} coins`}
 </span>
 {equipped ? (
 <span className="rounded-lg bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand-soft">
 Equipped
 </span>
 ) : owned ? (
 <button
 type="button"
 disabled={busy === skin.id}
 onClick={() => void equip("skin", skin.id, skin.name)}
 className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand/60 hover:text-brand-bright disabled:opacity-60"
 >
 {busy === skin.id ? "Equipping…" : "Equip"}
 </button>
 ) : (
 <button
 type="button"
 onClick={() => void buy("skin", skin.id, skin.price, skin.name)}
 disabled={save.coins < skin.price || busy === skin.id}
 className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-page transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-ink-faint"
 >
 {busy === skin.id
 ? "Unlocking…"
 : save.coins < skin.price
 ? `${coinLabel(skin.price - save.coins)} short`
 : "Unlock"}
 </button>
 )}
 </div>
 </li>
 );
 })}
 </ul>
 </section>

 <section aria-labelledby="themes">
   <h2 id="themes" className="font-mono text-lg font-bold text-ink">
     Website themes
   </h2>
   <p className="mt-1 max-w-2xl text-sm text-ink-faint">
     A theme repaints the whole site: the pages, the leaderboard, the shop, your profile, and the
     fight inside them. It does not change your fighter, and it cannot change the damage colours —
     so nothing you have learned about reading a hit has to be relearned. Your arena comes from the
     boss you are fighting, not from a theme.
   </p>
   <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     {THEMES.map((t) => {
       const owned = save.ownedThemes.includes(t.id);
       const equipped = save.equippedTheme === t.id;
       return (
         <li
           key={t.id}
           data-testid="theme-card"
           data-theme={t.id}
           className={`border-2 ${equipped ? "border-brand" : "border-line"}`}
         >
           <ThemeSwatch theme={t} />
           <div className="border-t-2 border-line p-4">
             <div className="flex items-baseline justify-between gap-2">
               <span className="font-semibold text-ink">{t.name}</span>
               <span className="font-mono text-[10px] tracking-wider text-ink-faint">
                 {RARITY_LABEL[t.rarity]}
               </span>
             </div>
             <p className="mt-1 min-h-[32px] text-xs text-ink-faint">{t.blurb}</p>
             <div className="mt-3 flex items-center justify-between gap-2">
               <span className="font-mono text-xs text-coin">
                 {t.price === 0 ? "Free" : `${coinLabel(t.price)} coins`}
               </span>
               {equipped ? (
                 <span className="border border-brand px-3 py-1.5 text-xs font-semibold text-brand">
                   Equipped
                 </span>
               ) : owned ? (
                 <button
                 type="button"
                 data-testid="equip-theme"
                 disabled={busy === t.id}
                 onClick={() => void equip("theme", t.id, t.name)}
                 className="border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-60"
                 >
                 {busy === t.id ? "Equipping…" : "Wear it"}
                 </button>
               ) : (
                 <button
                 type="button"
                 data-testid="buy-theme"
                 onClick={() => void buy("theme", t.id, t.price, t.name)}
                 disabled={save.coins < t.price || busy === t.id}
                 className="bg-brand px-3 py-1.5 text-xs font-bold text-brand-deep transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-ink-faint"
                 >
                 {busy === t.id
                 ? "Unlocking…"
                 : save.coins < t.price
                 ? `${coinLabel(t.price - save.coins)} short`
                 : "Unlock"}
                 </button>
               )}
             </div>
           </div>
         </li>
       );
     })}
   </ul>
 </section>

 <section
 aria-labelledby="money"
 className="rounded-2xl border border-line bg-card/30 px-4 py-4"
 >
 <h2 id="money" className="font-mono text-sm font-bold text-ink-soft">
 About paying
 </h2>
 <p className="mt-2 text-xs leading-relaxed text-ink-faint">{REAL_MONEY_DISABLED_REASON}</p>
 <p className="mt-2 text-xs leading-relaxed text-ink-faint">
 That is deliberate, not an oversight. A cosmetic is worth buying when there is somebody to
 show it to, and right now you are fighting a bot. Card checkout goes live with
 multiplayer.
 </p>
 </section>
 </div>
 );
}
