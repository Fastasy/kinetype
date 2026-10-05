// Kinetype data layer — every read and write against the `kinetype` schema.
//
// All WRITES are RPCs, never table inserts. The server recomputes XP from clamped
// inputs, so the number on the leaderboard is not something a client can type in.
// Reads of other players go through SECURITY DEFINER functions too (RLS keeps the
// raw tables owner-only).

import { supabase } from "./supabase";
import type { Boss, MatchMode } from "@/game/progression";

export interface Profile {
  id: string;
  /**
   * Public, permanent profile address (the slug in /u/<handle>). Assigned once on first
   * sign-in and never reassigned, so renaming yourself does not move it. `not null` since
   * migration 0003 backfilled every row.
   */
  handle: string;
  username: string | null;
  display_name: string | null;
  /**
   * A public URL, or `""` for "this player has deliberately removed their photo".
   *
   * The empty string is not the same as `null`. `ensure_profile()` refills a NULL from the
   * OAuth metadata on every load, so a NULL here would resurrect a photo the player had
   * removed. `""` survives that, and reads as falsy everywhere it is rendered.
   */
  avatar_url: string | null;
  xp: number;
  /** Server-derived: floor(sqrt(xp/100)) + 1. Read-only. */
  level: number;
  best_wpm: number;
  best_accuracy: number;
  matches: number;
  wins: number;
  losses: number;
  current_streak: number;
  best_streak: number;
  bosses_cleared: number;
  /**
   * Consecutive UTC days with at least one honest match. Server-derived from the match history and
   * never sent by a client — it is the daily hook, so it must not be forgeable.
   */
  streak_days: number;
  /** UTC date of the last honest match. */
  last_played_on: string | null;
  /** Highest streak milestone already paid for the CURRENT chain; resets when the chain breaks. */
  streak_awarded: number;
  /** UTC date the daily first-win bonus was last paid, so it pays once a day. */
  first_win_on: string | null;
  /**
   * The account's coin balance. SERVER-OWNED: awarded inside `submit_match()` from the match
   * inputs, spent by `purchase_cosmetic()`. Nothing here can be set from the client.
   */
  coins: number;
  /** What the account is wearing. Changed only via `set_equipped()`, and only from what it owns. */
  equipped_skin: string;
  equipped_theme: string;
  /** Cosmetics the account owns. Written only by `purchase_cosmetic()` — no client write path. */
  owned_skins: string[];
  owned_themes: string[];
  show_on_leaderboard: boolean;
  created_at: string;
  updated_at: string;
}

export type LeaderWindow = "daily" | "weekly" | "overall";

export interface LeaderRow {
  rank: number;
  /** Public handle. The board no longer publishes `user_id` — that was an auth identifier. */
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  best_wpm: number;
  bosses_cleared: number;
  is_me: boolean;
}

export interface SubmitMatchInput {
  mode: MatchMode;
  bossId?: string | null;
  botWpm: number;
  won: boolean;
  wpm: number;
  accuracy: number;
  bestCombo: number;
  roundsWon: number;
  roundsLost: number;
  streak: number;
}

/** Create the profile row on first sign-in, or refresh it. Safe to call every load. */
export async function ensureProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.rpc("ensure_profile");
  if (error) throw error;
  return (data as Profile) ?? null;
}

/** The signed-in player's profile, or null when signed out / not yet created. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

/**
 * Submit a finished match. Returns the UPDATED profile, so the caller can show the
 * XP gained and the new level without a second round-trip.
 */
export async function submitMatch(input: SubmitMatchInput): Promise<Profile | null> {
  const { data, error } = await supabase.rpc("submit_match", {
    p_mode: input.mode,
    p_boss_id: input.bossId ?? null,
    p_bot_wpm: input.botWpm,
    p_won: input.won,
    p_wpm: input.wpm,
    p_accuracy: input.accuracy,
    p_best_combo: input.bestCombo,
    p_rounds_won: input.roundsWon,
    p_rounds_lost: input.roundsLost,
    p_streak: input.streak,
  });
  if (error) throw error;
  return (data as Profile) ?? null;
}

/** One leaderboard window as ranked rows. Readable signed-out (is_me is then null). */
export async function getLeaderboard(
  window: LeaderWindow,
  limit = 50,
): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc("leaderboard", {
    p_window: window,
    p_limit: limit,
  });
  if (error) throw error;
  return (data as LeaderRow[]) ?? [];
}

/** The boss ids this player has already beaten (drives the campaign lock states). */
export async function getClearedBosses(): Promise<string[]> {
  const { data, error } = await supabase.from("boss_clears").select("boss_id");
  if (error) throw error;
  return ((data as { boss_id: string }[]) ?? []).map((r) => r.boss_id);
}

/** Convenience: the set of cleared boss ids, guarding against null data. */
export async function getClearedBossSet(): Promise<Set<string>> {
  return new Set(await getClearedBosses());
}

// ------------------------------------------------------------- public profiles

/**
 * A profile page's payload. Deliberately NOT the Profile shape: no `id` (the auth UUID is not
 * a public identifier), no `username`, no `show_on_leaderboard`, no `updated_at`.
 */
export interface PublicProfile {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  best_wpm: number;
  best_accuracy: number;
  matches: number;
  wins: number;
  losses: number;
  best_streak: number;
  /** Consecutive UTC days played. Public, deliberately: the daily hook works better when it shows. */
  streak_days: number;
  bosses_cleared: number;
  equipped_skin: string;
  equipped_theme: string;
  owned_skins: string[];
  owned_themes: string[];
  joined: string;
}

/** One day of play, for the heatmap. Days with no play are simply absent from the list. */
export interface ActivityDay {
  day: string;
  matches: number;
  wins: number;
  xp: number;
}

/**
 * Another player's public profile, by handle. Null for an unknown handle OR a player who has
 * hidden from the leaderboard — the server returns nothing for both, so the two cannot be told
 * apart from out here.
 */
export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("public_profile", { p_handle: handle });
  if (error) throw error;
  return ((data as PublicProfile[]) ?? [])[0] ?? null;
}

/** Per-day match counts for the activity heatmap. */
export async function getActivity(handle: string, days = 371): Promise<ActivityDay[]> {
  const { data, error } = await supabase.rpc("match_activity", {
    p_handle: handle,
    p_days: days,
  });
  if (error) throw error;
  return (data as ActivityDay[]) ?? [];
}

/**
 * Buy a cosmetic with the ACCOUNT's coins and return the updated profile.
 *
 * No price is sent: the server looks the real one up in its own `cosmetics` table, so a drifted
 * constant in the shop can mislead the DISPLAY but can never undercharge. The debit and the
 * balance check happen in one statement server-side, so two rapid clicks cannot both succeed and
 * the balance cannot go negative. Buying also equips, which is what the shop has always done.
 *
 * Signed-out players never reach this — their purchases stay local, in game/commerce.ts.
 */
export async function purchaseCosmetic(
  kind: "skin" | "theme",
  id: string,
): Promise<Profile | null> {
  const { data, error } = await supabase.rpc("purchase_cosmetic", { p_kind: kind, p_id: id });
  if (error) throw error;
  return (data as Profile) ?? null;
}

/**
 * Wear a cosmetic the account owns. This is the ONLY cosmetic thing a client may change:
 * ownership is server-owned, so there is no write path for an owned item from here. The server
 * ignores an id the player does not own rather than raising.
 */
export async function setEquipped(skin: string, theme: string): Promise<void> {
  const { error } = await supabase.rpc("set_equipped", { p_skin: skin, p_theme: theme });
  if (error) throw error;
}

export interface CosmeticRow {
  kind: "skin" | "theme";
  id: string;
  price: number;
}

/**
 * The server's price book. Exposed so the prices the shop RENDERS can be checked against the
 * prices the server CHARGES (scripts/probe-coins.ts), instead of trusting that game/skins.ts and
 * game/themes.ts stayed in step with the database.
 */
export async function getCosmeticCatalog(): Promise<CosmeticRow[]> {
  const { data, error } = await supabase.rpc("cosmetic_catalog");
  if (error) throw error;
  return (data as CosmeticRow[]) ?? [];
}

/**
 * Set the caller's own display name and/or avatar picture.
 *
 * Both fields are optional and a MISSING field is left untouched, so either can be saved on its
 * own. Note the difference between `{ avatarUrl: "" }` — which removes the picture — and
 * `{}` — which leaves whatever is there. The server validates both: the name is sanitised and
 * clamped to 24 characters, and the avatar must be a URL inside this player's own folder in the
 * Kinetype storage bucket (a third-party URL is refused, so a profile can never be turned into a
 * tracking pixel pointed at whoever opens it).
 *
 * Returns the UPDATED profile, so the caller can refresh its state from one round trip.
 */
export async function updateProfile(input: {
  displayName?: string;
  avatarUrl?: string;
}): Promise<Profile | null> {
  const { data, error } = await supabase.rpc("update_profile", {
    p_display_name: input.displayName ?? null,
    p_avatar_url: input.avatarUrl ?? null,
  });
  if (error) throw error;
  return (data as Profile) ?? null;
}

export type { Boss };

