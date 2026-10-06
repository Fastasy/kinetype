// The match simulation. One fixed-timestep step, no rendering, no DOM.
//
// Everything here is deterministic given a seed and an input sequence, which is
// what makes the balance table testable without a browser.

import {
  AIR_DRAG,
  BLOCK_DAMAGE_MULTIPLIER,
  BLOCK_HOLD,
  BLOCK_KB_MULTIPLIER,
  COIN_ACCURACY_FACTOR,
  COIN_BASE_LOSS,
  COIN_BASE_WIN,
  COIN_PER_ROUND,
  COIN_STREAK_CAP,
  COIN_STREAK_STEP,
  COIN_WPM_FACTOR,
  COUNTDOWN_TIME,
  COUNTER_MULTIPLIER,
  COUNTER_WINDOW,
  FINISH_DAMAGE_HINT,
  FINISH_MAX_TIME,
  GRAVITY,
  GROUND_FRICTION,
  HIT_COOLDOWN,
  HITSTOP_MAX,
  HITSTOP_MIN,
  HURTBOX,
  INPUT_BUFFER_MAX,
  LAUNCH_DECAY,
  PARRY_MULTIPLIER,
  PRECISION_DAMAGE_BONUS,
  RECOVERY_INVULN,
  recoveryWindowSeconds,
  ROUND_END_HOLD,
  ROUND_TIME,
  SPARK_DISTANCE,
  SPAWN,
  STAGE,
  STRICT_STAGGER,
} from "./constants";
import { Fx } from "./fx";
import { CELEBRATION_GOLD } from "./hud";
import { comboIntensity, comboMultiplier } from "./combo";
import { MOVE, launchFrom } from "./knockback";
import { BotController, botConfigForTier } from "./bot";
import { createRng, type Rng } from "./rng";
import { skinById, type PixelSkin } from "./skins";
import { TypingRun, type CommitResult } from "./typing";
import type {
  AttackMove,
  Fighter,
  GameEvent,
  MatchOptions,
  MatchResult,
  RoundPhase,
  Side,
} from "./types";

const HH = HURTBOX.h / 2;
const HW = HURTBOX.w / 2;

function other(side: Side): Side {
  return side === "left" ? "right" : "left";
}

function createFighter(side: Side): Fighter {
  return {
    side,
    x: SPAWN[side].x,
    y: SPAWN[side].y,
    vx: 0,
    vy: 0,
    facing: side === "left" ? 1 : -1,
    damage: 0,
    weight: 100,
    state: "idle",
    stateTimer: 0,
    onGround: false,
    invuln: 0,
    counter: 0,
    guard: 0,
    hitCooldown: 0,
    squash: 0,
    vibrate: 0,
    trail: [],
    prompts: [],
    stats: { chars: 0, correct: 0, errors: 0, words: 0, blocks: 0, parried: 0 },
    sinceCommit: 0,
  };
}

export interface MatchHooks {
  /** Called for every game event, in order. Audio and FX subscribe here. */
  onEvent?: (event: GameEvent) => void;
}

export class Match {
  readonly stage = STAGE;
  readonly opts: MatchOptions;
  readonly humanSide: Side;

  left: Fighter;
  right: Fighter;
  skins: Record<Side, PixelSkin>;
  typing: Record<Side, TypingRun>;
  bots: Record<Side, BotController | null>;
  fx = new Fx();

  phase: RoundPhase = "countdown";
  round = 1;
  wins: Record<Side, number> = { left: 0, right: 0 };
  phaseTimer = COUNTDOWN_TIME;
  roundTimer = ROUND_TIME;
  recoveryVictim: Side | null = null;
  recoveryTimer = 0;
  /** Saves already made this round. Each one shortens the next window. */
  private recoveries = 0;
  finishSide: Side | null = null;
  /** True once the "spark" telegraph has fired for a side this round. */
  private sparkFired: Record<Side, boolean> = { left: false, right: false };
  private rng: Rng;

  result: MatchResult | null = null;
  /** Set by the caller so the coin payout can credit a streak. */
  streakBefore = 0;

  constructor(opts: MatchOptions, seed: number, hooks: MatchHooks = {}, humanSide: Side = "left") {
    this.opts = opts;
    this.humanSide = humanSide;
    this.rng = createRng(seed);
    this.skins = { left: skinById(opts.skins.left), right: skinById(opts.skins.right) };
    this.left = createFighter("left");
    this.right = createFighter("right");
    // Both fighters type the same sentence bands: the tier follows the chosen bot
    // speed, and a player facing a slow bot should not be handed 55-character
    // sentences they cannot finish.
    const typingOpts = { strictMode: opts.strictMode, tier: this.botTier };
    this.typing = {
      left: new TypingRun(createRng(seed ^ 0x9e3779b9), typingOpts),
      right: new TypingRun(createRng(seed ^ 0x85ebca6b), typingOpts),
    };
    this.bots = {
      left: humanSide === "left" ? null : new BotController(botConfigForTier(this.botTier), createRng(seed ^ 1)),
      right: humanSide === "right" ? null : new BotController(botConfigForTier(this.botTier), createRng(seed ^ 2)),
    };
    this.hooks = hooks;
    this.left.prompts = this.typing.left.prompts;
    this.right.prompts = this.typing.right.prompts;
  }

  private hooks: MatchHooks;

  private get botTier(): number {
    let best = 0;
    let gap = Infinity;
    const ladder = [20, 30, 40, 50, 60, 70, 85, 100, 120];
    ladder.forEach((v, i) => {
      const d = Math.abs(v - this.opts.botWpm);
      if (d < gap) {
        gap = d;
        best = i;
      }
    });
    return best;
  }

  private publish(e: GameEvent): void {
    this.hooks.onEvent?.(e);
  }

  /** The skin a side is wearing. The renderer reads this rather than being handed it. */
  skinFor(side: Side): PixelSkin {
    return this.skins[side];
  }

  fighter(side: Side): Fighter {
    return side === "left" ? this.left : this.right;
  }

  // ---------------------------------------------------------------- input

  /**
   * Whether a keystroke from `side` can be applied right now.
   *
   * Split out of `type()` because the input buffer needs the IDENTICAL test: one rule
   * decides both whether a keystroke lands and whether it is held for later. Two copies
   * of this condition would drift and a keystroke would fall down the gap between them.
   */
  private canAcceptInput(side: Side): boolean {
    if (this.phase !== "live" && this.phase !== "finish" && this.phase !== "recovery") {
      return false;
    }
    if (this.phase === "recovery" && side !== this.recoveryVictim) return false;
    const f = this.fighter(side);
    return f.state !== "hitstun" && f.state !== "staggered" && f.state !== "ko";
  }

  /** Keystrokes pressed while input was blocked, oldest first. */
  private pending: Record<Side, string[]> = { left: [], right: [] };

  /** How many keystrokes are waiting. The HUD shows this, so a wait is never silent. */
  queuedFor(side: Side): number {
    return this.pending[side].length;
  }

  private clearPending(): void {
    this.pending.left.length = 0;
    this.pending.right.length = 0;
  }

  /**
   * Hold a keystroke that cannot be applied yet.
   *
   * FIRST IN, FIRST KEPT, not last: the characters the player pressed first are the ones
   * they meant next, so the queue preserves the order their fingers were already in.
   * Past INPUT_BUFFER_MAX the excess is dropped — a fighter must not be able to bank a
   * whole word while stunned.
   */
  private bufferInput(side: Side, ch: string): void {
    const q = this.pending[side];
    if (q.length < INPUT_BUFFER_MAX) q.push(ch);
  }

  /**
   * Deliver held keystrokes, in order, as soon as they are legal.
   *
   * Runs once per step, so a keystroke pressed on the frame a hit lands is applied within
   * one frame of the hitstun ending. This is the fix for Ruan's report: "when he hits me
   * and I type a letter at the same time, it does not register." Being hit still costs the
   * player time, which is the point of hitstun, but it no longer costs them keystrokes.
   */
  private flushPending(): void {
    for (const side of ["left", "right"] as Side[]) {
      const q = this.pending[side];
      // Re-tested every iteration: applying a character can commit a word, which can end
      // the sentence, the round or the match and make the next queued character illegal.
      while (q.length > 0 && this.canAcceptInput(side)) {
        this.type(side, q.shift() as string);
      }
    }
  }

  /** Feed one character from a human player. Returns true if it was consumed. */
  type(side: Side, ch: string): boolean {
    // Validated before anything else, so junk can never enter the buffer. Space is a real
    // key now — the separator between words — so it is accepted here like any letter.
    if (!/^[a-z ]$/.test(ch)) return false;
    if (!this.canAcceptInput(side)) {
      // Consumed, not ignored: the keystroke is held and will land. Returning false here
      // would also tell the caller the press was worthless, which is exactly the
      // impression this buffer exists to remove.
      this.bufferInput(side, ch);
      return true;
    }
    const f = this.fighter(side);
    const t = this.typing[side];
    if (t.inRecovery !== (this.phase === "recovery")) {
      if (this.phase === "recovery" && !t.inRecovery) t.enterRecovery();
    }
    const outcome = t.handleChar(ch);
    if (outcome.kind === "none") return false;
    this.publish({ type: "key", side, correct: outcome.kind !== "wrong" });
    if (outcome.kind === "wrong") {
      f.vibrate = Math.max(f.vibrate, 0.35);
      if (outcome.penalise) {
        f.state = "staggered";
        f.stateTimer = STRICT_STAGGER;
      }
      return true;
    }
    if (outcome.kind === "commit" && outcome.commit) {
      this.commitMove(side, outcome.commit);
    }
    return true;
  }

  // ---------------------------------------------------------------- step

  step(dt: number): void {
    // Hitstop: both fighters freeze for the identical duration.
    if (this.fx.hitstop > 0) {
      this.fx.hitstop -= dt;
      this.fx.update(dt);
      return;
    }
    this.fx.update(dt);

    switch (this.phase) {
      case "countdown":
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.phase = "live";
        break;
      case "live":
      case "finish":
        this.simulate(dt);
        break;
      case "recovery":
        this.recoveryStep(dt);
        break;
      case "roundOver":
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.advance();
        break;
      case "matchOver":
        break;
    }

    // Last, so it sees the STATES THIS STEP PRODUCED rather than the ones it started
    // with: the frame hitstun expires is the frame the held keystrokes land, and a
    // round that just went live accepts the characters typed during the countdown.
    this.flushPending();
  }

  private simulate(dt: number): void {
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.endRound(this.left.damage <= this.right.damage ? "left" : "right");
      return;
    }
    // FINISH is a bounded state: a decided match may not run long.
    if (this.phase === "finish") {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.endRound(this.left.damage <= this.right.damage ? "left" : "right");
        return;
      }
    }

    for (const side of ["left", "right"] as Side[]) {
      const f = this.fighter(side);
      this.stepTimers(f, dt);
      this.typing[side].tick(dt);
      f.prompts = this.typing[side].prompts;
      f.sinceCommit += dt;

      const bot = this.bots[side];
      if (bot && this.phase !== "recovery") {
        // The bot's commit goes through commitMove, the SAME door as the player's.
        // Applying damage inside the bot instead meant bots typed at full speed
        // and never landed a single hit.
        // `threat` is the opponent's kick telegraph. A bot with the reflexes for it
        // finishes the block word it is already on instead of eating the kick.
        const threat = this.typing[other(side)].telegraphing();
        const committed = bot.update(dt, this.typing[side], f, threat);
        if (committed) {
          this.publish({ type: "key", side, correct: true });
          this.commitMove(side, committed);
          if (this.phase !== "live" && this.phase !== "finish") break;
        }
      }

      this.armedFinish(f);
      this.physics(f, dt);

      if (f.squash > 0) f.squash = Math.max(0, f.squash - dt * 5.5);
      if (f.vibrate > 0) f.vibrate = Math.max(0, f.vibrate - dt * 6);

      if (this.trailWorthy(f)) {
        f.trail.push({ x: f.x, y: f.y, life: 0.28 });
        if (f.trail.length > 14) f.trail.shift();
        const style = this.skins[side].trail;
        if (Math.abs(f.vx) > 420) this.fx.emitTrail(f.x, f.y, style.colour, style.scale, style.spark);
      }
      for (const p of f.trail) p.life -= dt;
      f.trail = f.trail.filter((p) => p.life > 0);
    }

    // Blast line check -> recovery phase, not instant death.
    for (const side of ["left", "right"] as Side[]) {
      const f = this.fighter(side);
      const pastX = side === "left" ? f.x < STAGE.blast.left : f.x > STAGE.blast.right;
      if (pastX || f.y > STAGE.blast.bottom) {
        this.beginRecovery(side);
        return;
      }
    }
  }

  private stepTimers(f: Fighter, dt: number): void {
    if (f.invuln > 0) f.invuln -= dt;
    if (f.counter > 0) f.counter -= dt;
    // Clamped at zero, not merely counted down: a timer left at -1e-15 makes
    // `guard > 0` false but `guard === 0` false too, and the test suite reads both.
    if (f.guard > 0) f.guard = Math.max(0, f.guard - dt);
    if (f.hitCooldown > 0) f.hitCooldown -= dt;
    if (f.stateTimer > 0) {
      f.stateTimer -= dt;
      if (f.stateTimer <= 0 && (f.state === "hitstun" || f.state === "staggered")) {
        f.state = "idle";
      }
    }
  }

  /**
   * Kill spark and FINISH state. Smash's Deadly Blow is triggered by distance to
   * the blast line, not by move power, which is the right model here: we can
   * compute exactly whether a hit might end the match.
   */
  private armedFinish(f: Fighter): void {
    const side = f.side;
    const distance =
      side === "left" ? f.x - STAGE.blast.left : STAGE.blast.right - f.x;
    if (distance <= SPARK_DISTANCE || f.damage >= FINISH_DAMAGE_HINT) {
      if (!this.sparkFired[side]) {
        this.sparkFired[side] = true;
        this.finishSide = side;
        this.publish({ type: "spark", side });
        this.fx.addFlash(0.32);
      }
      if (this.phase === "live" && this.finishSide) {
        this.phase = "finish";
        this.phaseTimer = FINISH_MAX_TIME;
        this.finishZoom();
      }
    }
  }

  /** One slow-motion zoom per match, on the match-deciding hit. */
  private finishZoom(): void {
    this.fx.zoom = 0.9;
    this.fx.addHitstop(HITSTOP_MAX);
  }

  private trailWorthy(f: Fighter): boolean {
    return Math.abs(f.vx) > 420 || Math.abs(f.vy) > 520;
  }

  // ---------------------------------------------------------------- physics

  private physics(f: Fighter, dt: number): void {
    const prevBottom = f.y + HH;
    f.vy += GRAVITY * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    const airborne = f.state === "hitstun" || !f.onGround;
    if (airborne) {
      f.vx *= Math.exp(-LAUNCH_DECAY * dt * (f.state === "hitstun" ? 1 : 0.5));
    } else {
      f.vx *= Math.pow(GROUND_FRICTION, dt * 60);
      if (Math.abs(f.vx) < 6) f.vx = 0;
    }
    if (Math.abs(f.vx) > 4000) f.vx = Math.sign(f.vx) * 4000;
    f.vx *= Math.pow(AIR_DRAG, dt);

    let landed = false;
    if (f.vy >= 0) {
      for (const p of STAGE.platforms) {
        const withinX = f.x > p.x - HW && f.x < p.x + p.w + HW;
        const crossing = prevBottom <= p.y + 1 && f.y + HH >= p.y - 1;
        if (withinX && crossing) {
          f.y = p.y - HH;
          f.vy = 0;
          f.onGround = true;
          landed = true;
          break;
        }
      }
    }
    if (!landed) f.onGround = false;

    // Keep fighters inside the horizontal bounds unless they are being launched
    // through a blast line, which the caller handles.
    if (f.y > STAGE.height + 200) f.y = STAGE.height + 200;
  }

  // ---------------------------------------------------------------- moves

  /**
   * A word completed. Every word in a sentence is a move, so this is where a block, a
   * punch and a kick part company.
   */
  private commitMove(side: Side, commit: CommitResult): void {
    const f = this.fighter(side);
    const style = this.skins[side].trail;
    f.sinceCommit = 0;
    f.stats.words++;

    if (commit.prompt.kind === "recovery") {
      this.typing[side].exitRecovery();
      f.prompts = this.typing[side].prompts;
      this.recoverSuccess(side);
      return;
    }

    const move = commit.word.move;
    this.publish({
      type: "commit",
      side,
      move,
      precision: commit.precision,
      x: f.x,
      y: f.y,
    });

    if (move === "block") {
      this.raiseGuard(side);
      return;
    }
    this.applyHit(side, move, commit.precision, style.colour);
  }

  /**
   * A block word went through, so the guard goes up for BLOCK_HOLD seconds.
   *
   * A block is not an attack and never damages. It buys the next second, which is what
   * makes a sentence containing a small word a defensive option and one without it an
   * all-in. The guard does not stack: a second block inside the window just refreshes
   * the timer.
   */
  private raiseGuard(side: Side): void {
    const f = this.fighter(side);
    f.guard = BLOCK_HOLD;
    f.stats.blocks++;
    f.squash = Math.max(f.squash, 0.35);
    this.fx.emitGuard(f.x, f.y, this.skins[side].palette.t);
    this.fx.addShake(3);
    this.publish({ type: "block", side, x: f.x, y: f.y });
  }

  /**
   * Land a hit.
   *
   * The hit cooldown is what stops a fast typist locking the opponent out of the game
   * entirely. A move that arrives during the window is spent for nothing, which is why
   * timing beats volume here.
   */
  private applyHit(side: Side, move: AttackMove, precision: boolean, colour: string): void {
    const atk = this.fighter(side);
    const def = this.fighter(other(side));
    const prof = MOVE[move];

    if (def.invuln > 0 || def.hitCooldown > 0) return;

    // The combo is applied HERE and nowhere else, so every move that lands — the player's and
    // the bot's — is scaled by the same single rule. The chain has already counted the word
    // that is committing right now, so a player's third clean word is the one that hits harder.
    const chain = this.typing[side].combo;
    const combo = comboMultiplier(chain);
    const heat = comboIntensity(chain);

    let damage = prof.damage * (precision ? 1 + PRECISION_DAMAGE_BONUS : 1) * combo;

    // Situational multiplier, in the order the fight actually resolves: a raised guard
    // smothers what is coming, a parried kick turns it back, and a counter cashes in.
    let r = 1;
    const guarded = def.guard > 0;
    let parried = false;
    if (def.counter > 0) r *= PARRY_MULTIPLIER;
    if (guarded) {
      damage *= BLOCK_DAMAGE_MULTIPLIER;
      if (move === "kick") {
        // The read the defensive layer exists for: block the kick and you get the
        // counter window, which is the answer to "type faster or lose".
        r *= PARRY_MULTIPLIER;
        parried = true;
      } else {
        r *= BLOCK_KB_MULTIPLIER;
      }
    }
    let cashedCounter = false;
    if (atk.counter > 0) {
      r *= COUNTER_MULTIPLIER;
      cashedCounter = true;
    }

    const launch = launchFrom(
      {
        targetDamage: def.damage,
        damage,
        weight: def.weight,
        scaling: prof.scaling,
        base: prof.base,
        situational: r,
      },
      prof.angle,
      atk.facing,
    );

    def.damage += damage;
    def.hitCooldown = HIT_COOLDOWN;
    def.vx = launch.vx;
    def.vy = launch.vy;
    def.state = "hitstun";
    def.stateTimer = launch.hitstun;
    def.onGround = false;
    def.vibrate = 1;
    def.squash = Math.min(1, 0.5 + launch.kb / 400);
    atk.squash = 0.5;
    if (cashedCounter) atk.counter = 0;
    if (parried) {
      def.stats.parried++;
      def.counter = COUNTER_WINDOW;
      def.squash = Math.max(def.squash, 0.6);
      this.fx.addFlash(0.12);
      this.publish({ type: "parry", side: other(side), x: def.x, y: def.y });
    }

    // Impact escalates with the chain. A player on a run gets a heavier, louder, longer
    // hit — same move, more of it. This is the whole point of the combo: the fight should
    // LOOK like it is going better, not just have a bigger number in the corner.
    const stop = Math.min(HITSTOP_MAX, Math.max(HITSTOP_MIN, launch.kb * 0.0005) * (1 + heat * 0.6));
    this.fx.addHitstop(stop);
    this.fx.addShake(Math.min(26, (3 + launch.kb * 0.07) * (1 + heat * 0.7)));
    if (heat > 0) this.fx.addFlash(0.09 * heat);
    this.fx.emitImpact(def.x, def.y, launch.kb, colour, (1 + launch.kb / 500) * (1 + heat * 0.9));
    this.publish({
      type: "hit",
      side: other(side),
      power: launch.kb,
      move,
      guarded,
      combo: chain,
      x: def.x,
      y: def.y,
    });
  }

  // ---------------------------------------------------------------- recovery

  /**
   * The save window for a given side, in seconds.
   *
   * The rung — not the fighter's own WPM — sets the yardstick, because the window is a
   * character budget converted to seconds (see constants.recoveryWindowSeconds). The
   * player's number comes from `playerWpmHint`, so a future build that measures the
   * player's real speed instead of echoing the difficulty needs no change here.
   */
  private recoveryWindowFor(side: Side): number {
    const rungWpm = side === this.humanSide ? this.opts.playerWpmHint : this.opts.botWpm;
    return recoveryWindowSeconds(rungWpm, this.recoveries);
  }

  private beginRecovery(side: Side): void {
    const f = this.fighter(side);
    this.recoveryVictim = side;
    this.recoveryTimer = this.recoveryWindowFor(side);
    this.recoveries++;
    f.state = "recovering";
    f.vx = 0;
    f.vy = 0;
    // Clamp so the falling fighter stays on screen while they type.
    // Deliberately NOT the centre spawn: this is the fighter mid-fall, held at the edge so the
    // player can see what they are saving. The centre spawn applies when the save SUCCEEDS
    // (recoverSuccess) or when a round restarts (resetRound). Do not "fix" this line to SPAWN.
    f.x = side === "left" ? STAGE.blast.left + 56 : STAGE.blast.right - 56;
    f.y = Math.min(f.y, STAGE.blast.bottom - 90);
    this.typing[side].enterRecovery();
    f.prompts = this.typing[side].prompts;
    this.phase = "recovery";
    this.fx.addFlash(0.18);
    this.publish({ type: "recoverPrompt", side });
  }

  private recoveryStep(dt: number): void {
    const side = this.recoveryVictim;
    if (!side) {
      this.phase = "live";
      return;
    }
    this.recoveryTimer -= dt;
    const f = this.fighter(side);
    this.typing[side].tick(dt);
    f.prompts = this.typing[side].prompts;

    // A bot victim must be able to save itself, or every bot death is automatic.
    const bot = this.bots[side];
    if (bot) {
      // No kick telegraph matters while falling: the save word is the only move left.
      const committed = bot.update(dt, this.typing[side], f, false);
      if (committed) {
        this.publish({ type: "key", side, correct: true });
        this.commitMove(side, committed);
        if (this.phase !== "recovery") return;
      }
    }

    f.y += 30 * dt; // drifts down while the clock runs
    if (this.recoveryTimer <= 0) {
      this.recoverFail(side);
    }
  }

  private recoverSuccess(side: Side): void {
    const f = this.fighter(side);
    // Ruan's call, and it was a real bug: a save returns BOTH fighters to the middle of the
    // stage, not just the one who was knocked off.
    //
    // This used to land the recovering player at platforms[0].x +- 50 (x 390 / 890), the wide
    // marks. A ring-out therefore ended with the fight shoved into a corner: the player who had
    // just been launched came back out at the edge while their opponent stayed wherever they
    // happened to be. Resetting both to centre keeps a save positionally neutral, because the
    // distance to each fighter's own blast line is then the same for both.
    this.placeAtSpawn(side);
    this.placeAtSpawn(other(side));
    f.state = "idle";
    f.stateTimer = 0;
    f.invuln = RECOVERY_INVULN;
    f.squash = 0.7;
    this.recoveryVictim = null;
    this.phase = "live";
    this.fx.addFlash(0.2);
    this.fx.emitGuard(f.x, f.y, this.skins[side].palette.t);
    this.publish({ type: "recover", side, ok: true });
  }

  /**
   * Put a fighter back on the centre spawn, still and upright.
   *
   * THIS IS THE ONLY PLACE THAT POSITIONS A FIGHTER AT SPAWN, and it exists because it was not
   * always the only place. Position logic had drifted into three sites (round restart, save
   * success, and the mid-fall clamp) and one of them still used the old wide marks after the
   * spawn moved to the centre, so saves came back in the corner while rounds started in the
   * middle. Anything that wants a fighter at spawn calls this.
   *
   * The trail is cleared because the renderer strokes a line between trail points, so a
   * teleport with the old trail intact draws a streak right across the stage.
   */
  private placeAtSpawn(side: Side): void {
    const f = this.fighter(side);
    f.x = SPAWN[side].x;
    f.y = SPAWN[side].y;
    f.vx = 0;
    f.vy = 0;
    f.onGround = false; // they settle onto the platform rather than snapping to it
    f.trail = [];
  }

  private recoverFail(side: Side): void {
    this.typing[side].exitRecovery();
    this.fighter(side).prompts = this.typing[side].prompts;
    this.publish({ type: "recover", side, ok: false });
    this.recoveryVictim = null;
    this.knockOut(side);
  }

  private knockOut(side: Side): void {
    const f = this.fighter(side);
    f.state = "ko";
    this.publish({ type: "kill", side });
    this.fx.addShake(26);
    this.fx.addFlash(0.7);
    this.endRound(other(side));
  }

  // ---------------------------------------------------------------- rounds

  private endRound(winner: Side): void {
    if (this.phase === "roundOver" || this.phase === "matchOver") return;
    // Keystrokes held from the round that just ended belong to that round. Carrying them
    // into the next one would hand the player a head start they did not type.
    this.clearPending();
    this.wins[winner]++;
    this.publish({ type: "roundEnd", winner, round: this.round });
    const needed = Math.ceil((this.opts.bestOf + 1) / 2);
    if (this.wins[winner] >= needed) {
      this.phase = "matchOver";
      this.finish(winner);
      return;
    }
    this.phase = "roundOver";
    this.phaseTimer = ROUND_END_HOLD;
  }

  private advance(): void {
    // Adaptive correction is applied HERE and only here, never mid-round.
    for (const side of ["left", "right"] as Side[]) {
      const bot = this.bots[side];
      if (bot) bot.observeRound(this.fighter(side).damage, this.fighter(other(side)).damage);
    }
    this.round++;
    this.resetRound();
  }

  private resetRound(): void {
    for (const side of ["left", "right"] as Side[]) {
      const f = this.fighter(side);
      this.placeAtSpawn(side);
      f.damage = 0;
      f.state = "idle";
      f.stateTimer = 0;
      f.invuln = 0;
      f.counter = 0;
      f.guard = 0;
      f.hitCooldown = 0;
      f.squash = 0;
      f.vibrate = 0;
      f.sinceCommit = 0;
      this.typing[side].exitRecovery();
      // Fresh round, fresh climb: see TypingRun.resetCombo. bestCombo deliberately survives.
      this.typing[side].resetCombo();
      f.prompts = this.typing[side].prompts;
      this.bots[side]?.reset();
    }
    this.recoveryVictim = null;
    this.recoveries = 0;
    this.finishSide = null;
    this.sparkFired = { left: false, right: false };
    this.roundTimer = ROUND_TIME;
    this.phase = "countdown";
    this.phaseTimer = COUNTDOWN_TIME;
    this.fx.reset();
  }

  private finish(winner: Side): void {
    const human = this.typing[this.humanSide];
    const humanWon = winner === this.humanSide;
    const wpm = human.bestWpm;
    const accuracy = human.accuracy();
    const roundsWon = this.wins[this.humanSide];
    const roundsLost = this.wins[other(this.humanSide)];

    let coins = humanWon ? COIN_BASE_WIN : COIN_BASE_LOSS;
    coins += roundsWon * COIN_PER_ROUND;
    coins += Math.round(wpm * COIN_WPM_FACTOR);
    coins += Math.round((accuracy / 100) * COIN_ACCURACY_FACTOR);
    const streak = humanWon ? this.streakBefore + 1 : 0;
    coins += Math.min(COIN_STREAK_CAP, streak) * COIN_STREAK_STEP;

    this.result = {
      winner,
      humanWon,
      roundsWon,
      roundsLost,
      wpm,
      accuracy,
      bestWpm: human.bestWpm,
      bestCombo: human.bestCombo,
      coins,
      streak,
    };
    if (humanWon) {
      // Gold first, because gold is the game's "worth something" and a win is the payoff, then the
      // winner's own skin trim so the celebration looks like the fighter that delivered it.
      this.fx.emitConfetti(STAGE.width, [CELEBRATION_GOLD, this.skins[this.humanSide].palette.t, "#ffffff"]);
    }
    this.publish({ type: "matchEnd", winner });
  }

  /** Live readout for the HUD. */
  hud(side: Side) {
    const f = this.fighter(side);
    const t = this.typing[side];
    return {
      damage: f.damage,
      wpm: t.wpm(),
      accuracy: t.accuracy(),
      counter: f.counter > 0,
      guard: f.guard > 0,
      invuln: f.invuln > 0,
      state: f.state,
      inRecovery: t.inRecovery,
    };
  }
}
