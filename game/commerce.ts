// The purchase boundary.
//
// WHY THIS FILE EXISTS AND IS SO SMALL
//
// The shop ships with the game, but real-money purchases do not. Two findings
// from the research drive that:
//
//   1. Cosmetics sell to an AUDIENCE. Skins people can buy and never show to
//      anyone else do not convert. Until multiplayer exists there is nobody to
//      display a skin to, so a payment integration here would earn ~R0.
//   2. The genre leader's first revenue line is NOT skins. Nitro Type's founding
//      paid product was a low-ticket membership whose headline benefit was
//      REMOVING THE ADS, with cosmetics as the secondary hook. Ads first, then
//      ad removal, then cosmetics.
//
// So: earnable cosmetics now, one function to swap when a provider goes live.

import type { SaveData } from "./storage";

export type PurchaseProvider = "earned" | "stripe" | "paystack";

/** Flip this together with `createCheckout` when a provider actually exists. */
export const PURCHASE_PROVIDER: PurchaseProvider = "earned";

/** Real-money purchases are deliberately not enabled yet. Surfaced in the UI. */
export const REAL_MONEY_ENABLED = PURCHASE_PROVIDER !== "earned";

export const REAL_MONEY_DISABLED_REASON =
  "Every skin is earned by playing right now. Direct purchases unlock with multiplayer, so there is someone to show it off to.";

/** Reference money price, shown only when a provider is live. */
export function referencePriceCents(coins: number): number {
  return Math.max(99, Math.round(coins * 0.9));
}

export interface PurchaseResult {
  ok: boolean;
  method: "coins" | "external";
  reason?: string;
  save?: SaveData;
}

export type ItemKind = "skin" | "theme";

export function isOwned(save: SaveData, kind: ItemKind, id: string): boolean {
  return (kind === "skin" ? save.ownedSkins : save.ownedThemes).includes(id);
}

export function canAfford(save: SaveData, price: number): boolean {
  return save.coins >= price;
}

/**
 * Buy with earned coins. This is the only live path while PURCHASE_PROVIDER is
 * "earned"; it is deliberately a pure function so it is trivially testable.
 */
export function purchaseWithCoins(
  save: SaveData,
  kind: ItemKind,
  id: string,
  price: number,
): PurchaseResult {
  if (isOwned(save, kind, id)) {
    return { ok: false, method: "coins", reason: "Already owned." };
  }
  if (!canAfford(save, price)) {
    return { ok: false, method: "coins", reason: "Not enough coins yet." };
  }
  const next: SaveData = {
    ...save,
    coins: save.coins - price,
    ownedSkins: kind === "skin" ? [...save.ownedSkins, id] : save.ownedSkins,
    ownedThemes: kind === "theme" ? [...save.ownedThemes, id] : save.ownedThemes,
  };
  if (kind === "skin") next.equippedSkin = id;
  else next.equippedTheme = id;
  return { ok: true, method: "coins", save: next };
}

/**
 * External checkout. Unreachable while REAL_MONEY_ENABLED is false. The shape is
 * here so the swap is one module, not a refactor: create a Checkout session, hand
 * back the URL, let the provider webhook credit the item.
 */
export async function createCheckout(
  kind: ItemKind,
  id: string,
  price: number,
): Promise<{ ok: boolean; url?: string; reason?: string }> {
  if (!REAL_MONEY_ENABLED) {
    return {
      ok: false,
      reason: `Card checkout is not enabled. ${REAL_MONEY_DISABLED_REASON}`,
    };
  }
  // Deliberately unimplemented: no provider is wired. Fail loudly rather than
  // pretending a purchase happened.
  void kind;
  void id;
  void referencePriceCents(price);
  return { ok: false, reason: "No payment provider is wired yet." };
}

export function coinLabel(coins: number): string {
  return `${coins.toLocaleString("en-US")}`;
}
