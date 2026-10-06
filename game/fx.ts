// Particles, screen shake, hitstop and flash.
//
// Deliberately NOT a particle engine. The "Juice It or Lose It" talk calls
// building one a programmer trap ("you get stuck making one, and you're making it
// the very best one and then you never use it"). This is a fixed-size pool with
// four behaviours, and that is all it will ever be.

import { SHAKE_DECAY, SHAKE_MAX } from "./constants";

export type ParticleKind = "impact" | "trail" | "confetti" | "guard";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  colour: string;
  kind: ParticleKind;
  spin: number;
}

const MAX_PARTICLES = 260;

export class Fx {
  particles: Particle[] = [];
  /** Seconds of freeze remaining. Both fighters freeze for the same duration. */
  hitstop = 0;
  shakeMag = 0;
  shakeX = 0;
  shakeY = 0;
  /** 0..1 white flash, decays. */
  flash = 0;
  /** Render-only camera zoom. 1 = normal. */
  zoom = 1;
  private shakeDir = 1;

  addShake(mag: number): void {
    this.shakeMag = Math.min(SHAKE_MAX, Math.max(this.shakeMag, mag));
  }

  addHitstop(seconds: number): void {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  addFlash(amount: number): void {
    this.flash = Math.min(1, this.flash + amount);
  }

  private push(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
  }

  emitImpact(x: number, y: number, power: number, colour: string, scale = 1): void {
    const count = Math.min(18, 5 + Math.round(power / 22));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 60 + Math.random() * (60 + power * 0.7);
      this.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.34 + Math.random() * 0.26,
        maxLife: 0.6,
        size: (2 + Math.random() * 3.5) * scale,
        colour,
        kind: "impact",
        spin: 0,
      });
    }
  }

  emitTrail(x: number, y: number, colour: string, scale: number, spark: boolean): void {
    const count = spark ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 26,
        vy: (Math.random() - 0.5) * 26,
        life: 0.22 + Math.random() * 0.2,
        maxLife: 0.42,
        size: (2 + Math.random() * 3) * scale,
        colour,
        kind: "trail",
        spin: 0,
      });
    }
  }

  emitGuard(x: number, y: number, colour: string): void {
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const speed = 110 + Math.random() * 90;
      this.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.22,
        maxLife: 0.52,
        size: 2 + Math.random() * 2.5,
        colour,
        kind: "guard",
        spin: 0,
      });
    }
  }

  /**
   * The confetti a decided match gets.
   *
   * This used to be 60 small squares in three hardcoded colours, which read as drizzle rather
   * than as a celebration — and a win had no other reward feedback in the arena at all. Three
   * changes make it land:
   *
   *   * `colours` is a list, so a win looks like the FIGHTER that won (the winner's skin trim,
   *     plus gold, which is already the game's "this is worth something" colour).
   *   * The pieces start up to 140px ABOVE the stage and at mixed speeds, so they arrive as a
   *     curtain with depth rather than one flat sheet crossing the screen together.
   *   * Every fourth piece is large and slow. Mixing sizes is what stops a burst reading as noise.
   */
  emitConfetti(width: number, colours: readonly string[], perColour = 34): void {
    for (const colour of colours.length ? colours : ["#facc15"]) {
      for (let i = 0; i < perColour; i++) {
        const big = i % 4 === 0;
        this.push({
          x: Math.random() * width,
          y: -10 - Math.random() * 140,
          vx: (Math.random() - 0.5) * 150,
          vy: 70 + Math.random() * 210,
          life: 1.5 + Math.random() * 1.2,
          maxLife: 2.7,
          size: big ? 9 + Math.random() * 5 : 3 + Math.random() * 3,
          colour,
          kind: "confetti",
          spin: (Math.random() - 0.5) * 16,
        });
      }
    }
  }

  update(dt: number): void {
    // Screen shake: alternating diagonal one-frame offsets, decaying.
    if (this.shakeMag > 0.1) {
      this.shakeDir *= -1;
      this.shakeX = this.shakeMag * this.shakeDir;
      this.shakeY = this.shakeMag * 0.55 * this.shakeDir;
      this.shakeMag *= Math.max(0, 1 - SHAKE_DECAY * dt);
    } else {
      this.shakeMag = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);
    if (this.zoom < 1) this.zoom = Math.min(1, this.zoom + dt * 0.9);

    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "confetti") {
        p.vy += 240 * dt;
        p.vx *= 0.99;
      } else {
        p.vx *= 1 - 2.4 * dt;
        p.vy *= 1 - 2.4 * dt;
        p.vy += 210 * dt;
      }
      alive.push(p);
    }
    this.particles = alive;
  }

  reset(): void {
    this.particles = [];
    this.hitstop = 0;
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.flash = 0;
    this.zoom = 1;
  }
}
