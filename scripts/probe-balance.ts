// Kinetype balance probe.
//
// Answers two questions with numbers rather than opinion:
//   A. How often does a bot survive a ring-out, per difficulty tier?
//   B. In a full match, how do rounds actually END — KO or clock — and how many
//      ring-outs does a round need before one sticks?
//
// Run: npx tsx scripts/probe-balance.ts
//
// Nothing here touches the app. It drives the framework-free game core directly,
// so it is deterministic and needs no browser.

import {
  BOT_ACCURACY_LADDER,
  BOT_DECISION_DELAY,
  BOT_PARRY_SKILL,
  BOT_WPM_LADDER,
  RECOVERY_SLACK_CHARS,
  RECOVERY_STEP_CHARS,
  RECOVERY_WORD_LENGTH,
  recoveryWindowSeconds,
  secondsPerChar,
  STEP,
} from "../game/constants";
import { BotController, botConfigForTier } from "../game/bot";
import { Match } from "../game/match";
import { createRng, type Rng } from "../game/rng";
import { TypingRun } from "../game/typing";
import type { Fighter, Side } from "../game/types";

const other = (s: Side): Side => (s === "left" ? "right" : "left");

// ------------------------------------------------------------------ part A

/** Characters of typing time the save budget grants, before it is converted to seconds. */
export function charBudget(recoveries: number): number {
  return Math.max(0, RECOVERY_SLACK_CHARS - recoveries * RECOVERY_STEP_CHARS);
}

/** Seconds a bot needs to type the recovery word at a given WPM (ignoring mistypes). */
export function timeToType(wpm: number, chars = RECOVERY_WORD_LENGTH): number {
  return chars / ((wpm * 5) / 60);
}

interface SaveStats {
  rate: number;
  avgTime: number;
  window: number;
  needed: number;
  budget: number;
}

/**
 * Isolated save probe: hand a bot ONLY the recovery word on a fresh clock and see
 * whether it finishes inside the window. No opponent, no knockback, no round timer —
 * everything that could contaminate the measurement is absent by construction.
 */
export function recoverySaveRate(tier: number, recoveries: number, trials = 600): SaveStats {
  const win = recoveryWindowSeconds(BOT_WPM_LADDER[tier], recoveries);
  let saved = 0;
  let totalTime = 0;
  for (let i = 0; i < trials; i++) {
    const typing = new TypingRun(createRng(9000 + i * 7919), { strictMode: false, tier });
    const bot = new BotController(botConfigForTier(tier), createRng(4000 + i * 104729));
    typing.enterRecovery();
    const self = { state: "recovering" } as unknown as Fighter;
    let t = 0;
    let done = false;
    while (t < win) {
      const c = bot.update(STEP, typing, self, false);
      t += STEP;
      if (c) {
        done = true;
        break;
      }
    }
    if (done) {
      saved++;
      totalTime += t;
    }
  }
  return {
    rate: saved / trials,
    avgTime: saved ? totalTime / saved : Infinity,
    window: win,
    needed: timeToType(BOT_WPM_LADDER[tier]),
    budget: charBudget(recoveries),
  };
}

// ------------------------------------------------------------------ part B

/**
 * A scripted human. Types through `match.type()` — the REAL player path, input
 * buffer included — rather than reaching into the engine. Mirrors the bot's model:
 * a per-character budget, a per-sentence read delay, and a reflex roll.
 */
class ScriptedPlayer {
  private budget = 0;
  private wait = 0;
  private targetId: number | null = null;
  private reflexFor: number | null = null;
  private willReflex = false;

  constructor(
    private cfg: { wpm: number; accuracy: number; delay: number; parry: number },
    private rng: Rng,
    private side: Side,
  ) {}

  update(dt: number, m: Match): void {
    const t = m.typing[this.side];
    const live = t.prompts[0];
    if (!live) return;

    if (live.id !== this.targetId) {
      this.targetId = live.id;
      this.wait = t.inRecovery ? 0 : (this.cfg.delay / 1000) * (0.7 + this.rng.next() * 0.6);
    }
    this.wait -= dt;
    if (this.wait > 0) return;

    const word = t.activeWord();
    const threat = m.typing[other(this.side)].telegraphing();
    if (threat && word && word.move === "block" && word.typed < word.text.length) {
      if (this.reflexFor !== live.id) {
        this.reflexFor = live.id;
        this.willReflex = this.rng.chance(this.cfg.parry);
      }
      if (this.willReflex) this.budget = word.text.length - word.typed;
    }

    this.budget += ((this.cfg.wpm * 5) / 60) * dt;
    let guard = 0;
    while (this.budget >= 1 && guard++ < 12) {
      this.budget -= 1;
      const cur = t.prompts[0];
      if (!cur || cur.id !== this.targetId) break;
      const expected = t.nextKey();
      if (expected === null) break;
      const alphabet = "abcdefghijklmnopqrstuvwxyz";
      let ch = expected;
      if (this.rng.next() >= this.cfg.accuracy) {
        let g = 0;
        do {
          ch = alphabet[this.rng.int(26)];
        } while (ch === expected && g++ < 8);
      }
      m.type(this.side, ch);
      if (t.prompts[0]?.id !== this.targetId) {
        this.targetId = null;
        this.wait = (this.cfg.delay / 1000) * 0.5;
        break;
      }
    }
  }
}

interface MatchOutcome {
  tier: number;
  botWpm: number;
  playerWpm: number;
  durationS: number;
  rounds: number;
  kos: number;
  timeouts: number;
  botSavesTried: number;
  botSavesMade: number;
  playerSavesTried: number;
  playerSavesMade: number;
  botDamageEnd: number;
  playerDamageEnd: number;
  humanWon: boolean;
}

function runMatch(tier: number, playerWpm: number, seed: number): MatchOutcome {
  let kills = 0;
  let roundEnds = 0;
  const saves = {
    bot: { tried: 0, made: 0 },
    player: { tried: 0, made: 0 },
  };

  const m = new Match(
    {
      botWpm: BOT_WPM_LADDER[tier],
      playerWpmHint: playerWpm,
      strictMode: false,
      bestOf: 3,
      skins: { left: "spark", right: "ember" },
    },
    seed,
    {
      onEvent: (e) => {
        if (e.type === "kill") kills++;
        if (e.type === "roundEnd") roundEnds++;
        if (e.type === "recoverPrompt") saves[e.side === "right" ? "bot" : "player"].tried++;
        if (e.type === "recover" && e.ok) saves[e.side === "right" ? "bot" : "player"].made++;
      },
    },
    "left",
  );
  const player = new ScriptedPlayer(
    { wpm: playerWpm, accuracy: 0.97, delay: 330, parry: 0.5 },
    createRng(seed ^ 0x5bf03635),
    "left",
  );

  let steps = 0;
  const MAX = 60 * 60 * 12; // 12 minutes of sim time, hard stop
  while (!m.result && steps++ < MAX) {
    player.update(STEP, m);
    m.step(STEP);
  }

  const durationS = steps * STEP - 3 * 2.2; // subtract the three countdowns
  return {
    tier,
    botWpm: BOT_WPM_LADDER[tier],
    playerWpm,
    durationS: Math.max(0, durationS),
    rounds: roundEnds,
    kos: kills,
    timeouts: roundEnds - kills,
    botSavesTried: saves.bot.tried,
    botSavesMade: saves.bot.made,
    playerSavesTried: saves.player.tried,
    playerSavesMade: saves.player.made,
    botDamageEnd: m.right.damage,
    playerDamageEnd: m.left.damage,
    humanWon: !!m.result?.humanWon,
  };
}

// ------------------------------------------------------------------ report

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const f1 = (n: number) => n.toFixed(1);

console.log("\n=== A. Isolated save rate (bot handed only the recovery word) ===\n");
console.log(
  `Budget is a CHARACTER count (slack ${RECOVERY_SLACK_CHARS}, -${RECOVERY_STEP_CHARS} per prior save), converted to seconds at each rung's own WPM.\n` +
    `Recovery word = ${RECOVERY_WORD_LENGTH} chars, so a save succeeds while the budget stays above ${RECOVERY_WORD_LENGTH}.\n`,
);
const saveIdx = [0, 1, 2, 3, 4, 8];
console.log(
  [
    "WPM",
    "win #1 (s)",
    "win #9 (s)",
    "budget #1",
    "budget #9",
    ...saveIdx.map((i) => `save#${i + 1}`),
  ].join(" | "),
);
console.log(["-", "-", "-", "-", "-", ...saveIdx.map(() => "-")].join(" | "));
for (let tier = 0; tier < BOT_WPM_LADDER.length; tier++) {
  const wpm = BOT_WPM_LADDER[tier];
  const w1 = recoveryWindowSeconds(wpm, 0);
  const w9 = recoveryWindowSeconds(wpm, 8);
  const cells = saveIdx.map((i) => pct(recoverySaveRate(tier, i).rate));
  console.log(
    [
      `${wpm}`,
      f1(w1),
      f1(w9),
      f1(charBudget(0)),
      f1(charBudget(8)),
      ...cells,
    ].join(" | "),
  );
}
console.log(
  `\nseconds/char at each rung: ${BOT_WPM_LADDER.map((w) => `${w}->${secondsPerChar(w).toFixed(3)}`).join("  ")}`,
);

console.log("\nBot ladder parameters\n");
console.log(["WPM", "accuracy", "decision ms", "parry"].join(" | "));
console.log(["-", "-", "-", "-"].join(" | "));
for (let tier = 0; tier < BOT_WPM_LADDER.length; tier++) {
  console.log(
    [BOT_WPM_LADDER[tier], BOT_ACCURACY_LADDER[tier], BOT_DECISION_DELAY[tier], BOT_PARRY_SKILL[tier]].join(" | "),
  );
}

const seeds = Number(process.argv[3] ?? 6);
const playerWpms = (process.argv[2] ?? "30,50,70,100,120").split(",").map(Number);

console.log(`\n=== B. Full match matrix (${seeds} seeds per cell) ===\n`);
console.log(
  "Player WPM | Bot WPM | win% | KO/timeout | bot saves made/tried | bot save% | player saves made/tried | player save% | avg len(s)",
);
console.log(["-", "-", "-", "-", "-", "-", "-", "-", "-"].join(" | "));
for (const pw of playerWpms) {
  for (let tier = 0; tier < BOT_WPM_LADDER.length; tier++) {
    const rows: MatchOutcome[] = [];
    for (let s = 0; s < seeds; s++) rows.push(runMatch(tier, pw, 1000 + s * 7771 + tier * 31));
    const wins = rows.filter((r) => r.humanWon).length;
    const kos = rows.reduce((a, r) => a + r.kos, 0);
    const touts = rows.reduce((a, r) => a + r.timeouts, 0);
    const bt = rows.reduce((a, r) => a + r.botSavesTried, 0);
    const bm = rows.reduce((a, r) => a + r.botSavesMade, 0);
    const pt = rows.reduce((a, r) => a + r.playerSavesTried, 0);
    const pm = rows.reduce((a, r) => a + r.playerSavesMade, 0);
    const len = rows.reduce((a, r) => a + r.durationS, 0) / rows.length;
    console.log(
      [
        pw,
        BOT_WPM_LADDER[tier],
        pct(wins / rows.length),
        `${kos}/${touts}`,
        `${bm}/${bt}`,
        bt ? pct(bm / bt) : "-",
        `${pm}/${pt}`,
        pt ? pct(pm / pt) : "-",
        f1(len),
      ].join(" | "),
    );
  }
  console.log("");
}
