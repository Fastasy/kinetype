// The match simulation. One fixed-timestep step, no rendering, no DOM.
//
// Everything here is deterministic given a seed and an input sequence, which is
// what makes the balance table testable without a browser.

import {
  AIR_DRAG,
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
  LAUNCH_DECAY,
  PARRY_MULTIPLIER,
  PRECISION_DAMAGE_BONUS,
  RECOVERY_INVULN,
  RECOVERY_WINDOW,
  RECOVERY_WINDOW_MIN,
  RECOVERY_WINDOW_STEP,
  ROUND_END_HOLD,
  ROUND_TIME,
  SPARK_DISTANCE,
  SPAWN,
  STAGE,
  STRICT_STAGGER,
  TELEGRAPH_COMMIT_CHARS,
} from "./constants";
import { Fx } from "./fx";
import { TIER, launchFrom } from "./knockback";
import { BotController, botConfigForTier } from "./bot";
import { createRng, type Rng } from "./rng";
import { skinById, type PixelSkin } from "./skins";
import { TypingRun } from "./typing";
import type {
  Fighter,
  GameEvent,
  MatchOptions,
  MatchResult,
  Prompt,
  RoundPhase,
  Side,
  WordTier,
} from "./types";

const HH = HURTBOX.h / 2;
const HW = HURTBOX.w / 2;
/** Longest a guard offer stays live before it expires. */
const GUARD_WINDOW = 2.5;

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
    hitCooldown: 0,
    squash: 0,
    vibrate: 0,
    trail: [],
    prompts: [],
    stats: { chars: 0, correct: 0, errors: 0, words: 0, parryAttempts: 0, parries: 0 },
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
  private guardAsked: Record<Side, boolean> = { left: false, right: false };
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
    const typingOpts = { guardEnabled: true, strictMode: opts.strictMode };
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

  /** Rate at which a side has successfully parried, for the bot's yomi layer. */
  parryRate(side: Side): number {
    const t = this.typing[side];
    if (t.parryAttempts === 0) return 0;
    return t.parries / t.parryAttempts;
  }

  // ---------------------------------------------------------------- input

  /** Feed one character from a human player. Returns true if it was consumed. */
  type(side: Side, ch: string): boolean {
    if (this.phase !== "live" && this.phase !== "finish" && this.phase !== "recovery") {
      return false;
    }
    if (this.phase === "recovery" && side !== this.recoveryVictim) return false;
    const f = this.fighter(side);
    if (f.state === "hitstun" || f.state === "staggered" || f.state === "ko") {
      // Input is blocked during hitstun but progress is preserved: forgiving by
      // design, in keeping with "bonus lost, not malus applied".
      return false;
    }
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
      this.commitWord(side, outcome.commit.prompt, outcome.commit.precision);
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
        // The bot's commit goes through commitWord, the SAME door as the player's.
        // Applying damage inside the bot instead meant bots typed at full speed
        // and never landed a single hit.
        const committed = bot.update(dt, this.typing[side], f);
        if (committed) {
          this.publish({ type: "key", side, correct: true });
          this.commitWord(side, committed.prompt, committed.precision);
          if (this.phase !== "live" && this.phase !== "finish") break;
        }
      }

      this.expireGuard(side);
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

    this.telegraphs();

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

  /**
   * The telegraph. A committed heavy word offers the defender a guard word. This
   * is the defensive verb: a read available to the losing player that is not
   * "type faster".
   */
  private telegraphs(): void {
    for (const side of ["left", "right"] as Side[]) {
      const active = this.typing[side].activePrompt();
      const telegraphing =
        !!active && active.tier === "heavy" && active.typed >= TELEGRAPH_COMMIT_CHARS;
      const defender = other(side);
      if (telegraphing && !this.guardAsked[side]) {
        const offered = this.typing[defender].offerGuard();
        this.guardAsked[side] = true;
        if (offered) this.publish({ type: "guardLost", side: defender });
      }
      if (!telegraphing) this.guardAsked[side] = false;
    }
  }

  private expireGuard(side: Side): void {
    const t = this.typing[side];
    const guard = t.prompts.find((p) => p.kind === "guard");
    if (guard && guard.age > GUARD_WINDOW) t.clearGuard();
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

  // ---------------------------------------------------------------- commits

  private commitWord(side: Side, prompt: Prompt, precision: boolean): void {
    const f = this.fighter(side);
    const style = this.skins[side].trail;
    f.sinceCommit = 0;

    if (prompt.kind === "recovery") {
      this.typing[side].exitRecovery();
      f.prompts = this.typing[side].prompts;
      this.recoverSuccess(side);
      return;
    }

    if (prompt.kind === "guard") {
      // Parry: locks incoming knockback AND opens a counter window.
      f.counter = COUNTER_WINDOW;
      f.vibrate = Math.max(f.vibrate, 0.6);
      this.typing[side].clearGuard();
      f.prompts = this.typing[side].prompts;
      this.fx.emitGuard(f.x, f.y, this.skins[side].palette.t);
      this.fx.addShake(6);
      this.publish({ type: "parry", side, x: f.x, y: f.y });
      return;
    }

    this.publish({
      type: "commit",
      side,
      tier: prompt.tier,
      precision,
      x: f.x,
      y: f.y,
    });
    this.applyHit(side, prompt.tier, precision, style.colour);
  }

  private applyHit(side: Side, tier: WordTier, precision: boolean, colour: string): void {
    const atk = this.fighter(side);
    const def = this.fighter(other(side));
    const prof = TIER[tier];

    // The hit cooldown is what stops a fast typist locking the opponent out of the
    // game entirely. A word that arrives during the window is spent for nothing,
    // which is why timing beats volume here.
    if (def.invuln > 0 || def.hitCooldown > 0) return;

    const damage = prof.damage * (precision ? 1 + PRECISION_DAMAGE_BONUS : 1);

    // Situational multiplier. The parry protects; the counter cashes in.
    let r = 1;
    let cashedCounter = false;
    if (def.counter > 0) r *= PARRY_MULTIPLIER;
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
    // A completed attack consumes any guard window the defender was holding open.
    this.typing[other(side)].clearGuard();

    const stop = Math.min(HITSTOP_MAX, Math.max(HITSTOP_MIN, launch.kb * 0.0005));
    this.fx.addHitstop(stop);
    this.fx.addShake(Math.min(26, 3 + launch.kb * 0.07));
    this.fx.emitImpact(def.x, def.y, launch.kb, colour, 1 + launch.kb / 500);
    this.publish({ type: "hit", side: other(side), power: launch.kb, tier, x: def.x, y: def.y });
  }

  // ---------------------------------------------------------------- recovery

  private beginRecovery(side: Side): void {
    const f = this.fighter(side);
    this.recoveryVictim = side;
    this.recoveryTimer = Math.max(
      RECOVERY_WINDOW_MIN,
      RECOVERY_WINDOW - this.recoveries * RECOVERY_WINDOW_STEP,
    );
    this.recoveries++;
    f.state = "recovering";
    f.vx = 0;
    f.vy = 0;
    // Clamp so the falling fighter stays on screen while they type.
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
      const committed = bot.update(dt, this.typing[side], f);
      if (committed) {
        this.publish({ type: "key", side, correct: true });
        this.commitWord(side, committed.prompt, committed.precision);
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
    f.x = STAGE.platforms[0].x + (side === "left" ? 50 : STAGE.platforms[0].w - 50);
    f.y = STAGE.platforms[0].y - HH;
    f.vx = 0;
    f.vy = 0;
    f.onGround = true;
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
      f.x = SPAWN[side].x;
      f.y = SPAWN[side].y;
      f.vx = 0;
      f.vy = 0;
      f.damage = 0;
      f.state = "idle";
      f.stateTimer = 0;
      f.onGround = false;
      f.invuln = 0;
      f.counter = 0;
      f.hitCooldown = 0;
      f.squash = 0;
      f.vibrate = 0;
      f.trail = [];
      f.sinceCommit = 0;
      this.typing[side].exitRecovery();
      this.typing[side].clearGuard();
      f.prompts = this.typing[side].prompts;
      this.bots[side]?.reset();
    }
    this.recoveryVictim = null;
    this.recoveries = 0;
    this.finishSide = null;
    this.sparkFired = { left: false, right: false };
    this.guardAsked = { left: false, right: false };
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
      coins,
      streak,
    };
    if (humanWon) {
      this.fx.emitConfetti(STAGE.width, this.skins[this.humanSide].palette.t);
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
      invuln: f.invuln > 0,
      state: f.state,
      inRecovery: t.inRecovery,
    };
  }
}
