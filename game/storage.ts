// Local save. No accounts in MVP, so everything lives in localStorage.
// Every read is defensive: a corrupt or partial save must never break the game.

import { BOT_WPM_LADDER, STORAGE_KEY } from "./constants";
import { DEFAULT_SKIN_ID } from "./skins";
import { DEFAULT_THEME_ID } from "./themes";

/**
 * v1 saves stored HUD overlays, which were prompt-panel restyles. Themes replaced them by
 * recolouring the entire fight. Ownership is migrated rather than dropped, so nobody loses
 * something they paid for.
 */
const LEGACY_OVERLAY_TO_THEME: Record<string, string> = {
  terminal: "paper",
  amber: "sunset",
  cryo: "frost",
};

export interface SaveData {
  version: 1;
  coins: number;
  ownedSkins: string[];
  ownedThemes: string[];
  equippedSkin: string;
  equippedTheme: string;
  bestWpm: number;
  bestAccuracy: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  matches: number;
  botWpm: number;
  strictMode: boolean;
  muted: boolean;
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  coins: 0,
  ownedSkins: [DEFAULT_SKIN_ID],
  ownedThemes: [DEFAULT_THEME_ID],
  equippedSkin: DEFAULT_SKIN_ID,
  equippedTheme: DEFAULT_THEME_ID,
  bestWpm: 0,
  bestAccuracy: 0,
  wins: 0,
  losses: 0,
  streak: 0,
  bestStreak: 0,
  matches: 0,
  botWpm: 40,
  strictMode: false,
  muted: false,
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function strList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return [...fallback];
  const out = v.filter((x): x is string => typeof x === "string");
  return out.length ? out : [...fallback];
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length ? v : fallback;
}

/**
 * Theme ownership for a save that predates themes: the default, plus whatever the old HUD
 * overlays mapped onto. Deduped, because the default is also a legacy mapping target.
 */
function migratedThemes(p: Record<string, unknown>): string[] {
  const legacy = Array.isArray(p.ownedOverlays) ? p.ownedOverlays : [];
  const mapped = legacy
    .filter((x): x is string => typeof x === "string")
    .map((id) => LEGACY_OVERLAY_TO_THEME[id])
    .filter((id): id is string => Boolean(id));
  return [...new Set([...DEFAULT_SAVE.ownedThemes, ...mapped])];
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return { ...DEFAULT_SAVE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SAVE };
    const p = parsed as Record<string, unknown>;
    const ladder: readonly number[] = BOT_WPM_LADDER;
    const botWpm = num(p.botWpm, DEFAULT_SAVE.botWpm);
    return {
      version: 1,
      coins: Math.max(0, Math.floor(num(p.coins, 0))),
      ownedSkins: strList(p.ownedSkins, DEFAULT_SAVE.ownedSkins),
      ownedThemes: strList(p.ownedThemes, migratedThemes(p)),
      equippedSkin: str(p.equippedSkin, DEFAULT_SAVE.equippedSkin),
      equippedTheme: str(
        p.equippedTheme ?? LEGACY_OVERLAY_TO_THEME[str(p.equippedOverlay, "")],
        DEFAULT_SAVE.equippedTheme,
      ),
      bestWpm: Math.max(0, num(p.bestWpm, 0)),
      bestAccuracy: Math.max(0, num(p.bestAccuracy, 0)),
      wins: Math.max(0, Math.floor(num(p.wins, 0))),
      losses: Math.max(0, Math.floor(num(p.losses, 0))),
      streak: Math.max(0, Math.floor(num(p.streak, 0))),
      bestStreak: Math.max(0, Math.floor(num(p.bestStreak, 0))),
      matches: Math.max(0, Math.floor(num(p.matches, 0))),
      botWpm: ladder.includes(botWpm) ? botWpm : DEFAULT_SAVE.botWpm,
      strictMode: bool(p.strictMode, false),
      muted: bool(p.muted, false),
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(data: SaveData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can throw in private mode or when the quota is exhausted. The game
    // must keep playing, so a failed save is swallowed rather than surfaced.
  }
}

export function clearSave(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface MatchOutcome {
  coins: number;
  wpm: number;
  accuracy: number;
  humanWon: boolean;
  streak: number;
}

/**
 * Apply a finished match to the save. Pure: returns the new save and does NOT
 * persist it. Persistence belongs to the store (game/store.ts), so there is one
 * place that writes and one place that notifies subscribers.
 */
export function applyOutcome(save: SaveData, o: MatchOutcome): SaveData {
  return {
    ...save,
    coins: save.coins + o.coins,
    matches: save.matches + 1,
    bestWpm: Math.max(save.bestWpm, o.wpm),
    bestAccuracy: Math.max(save.bestAccuracy, o.accuracy),
    wins: save.wins + (o.humanWon ? 1 : 0),
    losses: save.losses + (o.humanWon ? 0 : 1),
    streak: o.streak,
    bestStreak: Math.max(save.bestStreak, o.streak),
  };
}
