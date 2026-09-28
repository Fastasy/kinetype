// Kinetype — shared types.
// Framework-free: nothing in game/ may import from react or next.

export type Side = "left" | "right";

export type WordTier = "light" | "mid" | "heavy";

export type PromptKind = "attack" | "guard" | "recovery";

export interface Prompt {
  /** Stable id so the UI can animate a specific prompt slot. */
  id: number;
  text: string;
  tier: WordTier;
  kind: PromptKind;
  /** Characters committed correctly so far. Fires when === text.length. */
  typed: number;
  /** A mistake was made on this word, so the precision bonus is forfeit. */
  flawed: boolean;
  /** Ms the prompt has been live, for the bot's decision delay. */
  age: number;
}

export type FighterState =
  | "idle"
  | "hitstun"
  | "recovering"
  | "staggered"
  | "ko";

export interface TrailPoint {
  x: number;
  y: number;
  /** Seconds remaining. */
  life: number;
}

export interface FighterStats {
  chars: number;
  correct: number;
  errors: number;
  words: number;
  /** Errors made while a guard prompt was live. */
  parryAttempts: number;
  parries: number;
}

export interface Fighter {
  side: Side;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  damage: number;
  weight: number;
  state: FighterState;
  /** Seconds remaining in the current state. */
  stateTimer: number;
  onGround: boolean;
  /** Seconds of invulnerability remaining (post-recovery). */
  invuln: number;
  /** Seconds of counter window remaining. */
  counter: number;
  /** Seconds before this fighter can be hit again. Guarantees a turn. */
  hitCooldown: number;
  /** 0..1 squash impulse, decays. */
  squash: number;
  /** 0..1 vibration impulse, decays. */
  vibrate: number;
  trail: TrailPoint[];
  prompts: Prompt[];
  stats: FighterStats;
  /** Ms since this fighter last completed a word. */
  sinceCommit: number;
}

export interface StagePlatform {
  x: number;
  y: number;
  w: number;
}

export interface BlastLines {
  left: number;
  right: number;
  bottom: number;
}

export interface Stage {
  width: number;
  height: number;
  platforms: StagePlatform[];
  blast: BlastLines;
}

export type GameEvent =
  | { type: "key"; side: Side; correct: boolean }
  | { type: "commit"; side: Side; tier: WordTier; precision: boolean; x: number; y: number }
  | { type: "hit"; side: Side; power: number; tier: WordTier; x: number; y: number }
  | { type: "parry"; side: Side; x: number; y: number }
  | { type: "guardLost"; side: Side }
  | { type: "recoverPrompt"; side: Side }
  | { type: "recover"; side: Side; ok: boolean }
  | { type: "spark"; side: Side }
  | { type: "kill"; side: Side }
  | { type: "roundEnd"; winner: Side; round: number }
  | { type: "matchEnd"; winner: Side };

export type RoundPhase = "countdown" | "live" | "finish" | "recovery" | "roundOver" | "matchOver";

export interface MatchResult {
  winner: Side;
  humanWon: boolean;
  roundsWon: number;
  roundsLost: number;
  wpm: number;
  accuracy: number;
  bestWpm: number;
  coins: number;
  /** Set when the player is on a winning streak after this match. */
  streak: number;
}

export interface MatchOptions {
  /** Bot's steady-state speed. */
  botWpm: number;
  /** Player's difficulty preset (their own words scale, not the bot's). */
  playerWpmHint: number;
  /** Opt-in penalty for mistyping. */
  strictMode: boolean;
  /** Rounds needed to win. */
  bestOf: number;
  /** Cosmetic skin ids by side. */
  skins: { left: string; right: string };
}
