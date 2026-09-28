// Canvas renderer. Draws the world: background, platforms, fighters, trails,
// particles, damage readouts, flash.
//
// The prompt panels and HUD deliberately live in the DOM, not here: crisp text,
// real accessibility, and themable overlays. The canvas owns the fight.
//
// One rule from the research is enforced visually here: vibration and squash are
// applied to the DRAWING only. Hurtboxes stay static (game/constants.ts HURTBOX),
// because a moving hurtbox makes attacks that should connect start missing.

import { HURTBOX, STAGE } from "./constants";
import { damageColour } from "./knockback";
import type { Match } from "./match";
import type { Skin } from "./skins";
import type { Fighter, Side } from "./types";

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Letterbox the 1280x720 stage into whatever CSS box the canvas was given. */
export function computeViewport(cssW: number, cssH: number): Viewport {
  const scale = Math.min(cssW / STAGE.width, cssH / STAGE.height);
  return {
    scale,
    offsetX: (cssW - STAGE.width * scale) / 2,
    offsetY: (cssH - STAGE.height * scale) / 2,
  };
}

export interface RenderOptions {
  elapsed: number;
  /** The fighter who is one hit from the blast line, if any. */
  sparkSide: Side | null;
  humanSide: Side;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, STAGE.height);
  sky.addColorStop(0, "#08080b");
  sky.addColorStop(0.55, "#0d0d12");
  sky.addColorStop(1, "#15151b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);

  // Grid: gives the launch arcs a reference so speed reads as speed.
  ctx.strokeStyle = "rgba(255,255,255,0.032)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= STAGE.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, STAGE.height);
    ctx.stroke();
  }
  for (let y = 0; y <= STAGE.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(STAGE.width, y);
    ctx.stroke();
  }

  // Horizon glow between the blast lines.
  const glow = ctx.createRadialGradient(
    STAGE.width / 2,
    STAGE.platforms[0].y,
    40,
    STAGE.width / 2,
    STAGE.platforms[0].y,
    620,
  );
  glow.addColorStop(0, "rgba(52,211,153,0.07)");
  glow.addColorStop(1, "rgba(52,211,153,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
}

function drawBlastLines(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = "rgba(239,68,68,0.28)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  for (const x of [STAGE.blast.left, STAGE.blast.right]) {
    ctx.beginPath();
    ctx.moveTo(x, 80);
    ctx.lineTo(x, STAGE.blast.bottom - 40);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(239,68,68,0.18)";
  ctx.beginPath();
  ctx.moveTo(STAGE.blast.left, STAGE.blast.bottom - 40);
  ctx.lineTo(STAGE.blast.right, STAGE.blast.bottom - 40);
  ctx.stroke();
  ctx.restore();
}

function drawPlatforms(ctx: CanvasRenderingContext2D): void {
  STAGE.platforms.forEach((p, i) => {
    const main = i === 0;
    ctx.fillStyle = main ? "#1b1b22" : "#17171d";
    roundRect(ctx, p.x, p.y, p.w, main ? 20 : 14, 6);
    ctx.fill();
    ctx.strokeStyle = main ? "rgba(52,211,153,0.55)" : "rgba(161,161,170,0.35)";
    ctx.lineWidth = main ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(p.x + 4, p.y + 1.5);
    ctx.lineTo(p.x + p.w - 4, p.y + 1.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    roundRect(ctx, p.x, p.y, p.w, main ? 20 : 14, 6);
    ctx.stroke();
  });
}

function drawTrail(ctx: CanvasRenderingContext2D, f: Fighter, skin: Skin): void {
  if (f.trail.length < 2) return;
  ctx.save();
  for (let i = 0; i < f.trail.length; i++) {
    const p = f.trail[i];
    const t = i / f.trail.length;
    ctx.globalAlpha = Math.max(0, p.life / 0.28) * 0.4 * t;
    ctx.fillStyle = skin.trail.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + 7 * t * skin.trail.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  skin: Skin,
  elapsed: number,
): void {
  const s = skin.silhouette;
  const headR = s.w * 0.46;
  const headY = -s.h / 2 - headR * 0.75;

  ctx.save();
  ctx.translate(f.x, f.y);

  // Visual vibration. Hurtbox never moves.
  if (f.vibrate > 0.01) {
    const amp = 3.4 * f.vibrate;
    const phase = Math.sin(elapsed * 140);
    if (f.onGround) ctx.translate(phase * amp, 0);
    else ctx.translate(0, phase * amp);
  }

  // Squash and stretch on launch.
  ctx.scale(1 + f.squash * 0.26, 1 - f.squash * 0.26);

  // Ground shadow.
  if (f.onGround) {
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, s.h / 2 + 3, s.w * 0.62, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Back fins.
  if (s.fins > 0) {
    ctx.fillStyle = skin.palette.trim;
    for (let i = 0; i < s.fins; i++) {
      const y = -s.h / 2 + 8 + i * ((s.h - 16) / Math.max(1, s.fins));
      const dir = -f.facing;
      ctx.beginPath();
      ctx.moveTo(dir * (s.w / 2 - 2), y);
      ctx.lineTo(dir * (s.w / 2 + 10), y + 6);
      ctx.lineTo(dir * (s.w / 2 - 2), y + 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Body.
  const radius = (1 - s.edge) * (Math.min(s.w, s.h) / 2);
  const body = ctx.createLinearGradient(-s.w / 2, -s.h / 2, s.w / 2, s.h / 2);
  body.addColorStop(0, skin.palette.body);
  body.addColorStop(1, skin.palette.trim);
  ctx.fillStyle = body;
  roundRect(ctx, -s.w / 2, -s.h / 2, s.w, s.h, radius);
  ctx.fill();

  // Mass: extra shoulder bulk for heavy silhouettes.
  if (s.mass > 0.4) {
    ctx.fillStyle = skin.palette.body;
    ctx.beginPath();
    ctx.ellipse(0, -s.h / 2 + 10, s.w * (0.42 + s.mass * 0.28), 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head.
  ctx.fillStyle = skin.palette.body;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.palette.accent;
  ctx.beginPath();
  ctx.arc(0, headY, headR * 0.62, 0, Math.PI * 2);
  ctx.fill();

  // Eyes, looking at the opponent.
  ctx.fillStyle = "#09090b";
  const eyeX = f.facing * headR * 0.34;
  ctx.beginPath();
  ctx.arc(eyeX - 3.4, headY - 1, 1.9, 0, Math.PI * 2);
  ctx.arc(eyeX + 3.4, headY - 1, 1.9, 0, Math.PI * 2);
  ctx.fill();

  // Damage rim: the legible damage meter, no numbers required.
  ctx.strokeStyle = damageColour(f.damage);
  ctx.lineWidth = f.damage >= 100 ? 3.4 : 2.2;
  roundRect(ctx, -s.w / 2, -s.h / 2, s.w, s.h, radius);
  ctx.stroke();

  // Parry counter window.
  if (f.counter > 0) {
    ctx.strokeStyle = skin.palette.glow;
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(elapsed * 18);
    ctx.beginPath();
    ctx.arc(0, 0, s.h * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Post-recovery invulnerability.
  if (f.invuln > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s.h * 0.68, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // Damage percentage above the head.
  ctx.save();
  ctx.font = "700 26px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = damageColour(f.damage);
  ctx.globalAlpha = 0.95;
  ctx.fillText(`${Math.round(f.damage)}%`, f.x, f.y - s.h / 2 - headR * 2.5);
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, match: Match): void {
  ctx.save();
  for (const p of match.fx.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.fillStyle = p.colour;
    if (p.kind === "confetti") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin * p.life * 4);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Red-and-black lightning ring: Smash's Deadly Blow, distance-derived. */
function drawSpark(ctx: CanvasRenderingContext2D, f: Fighter, elapsed: number): void {
  ctx.save();
  ctx.translate(f.x, f.y);
  const pulse = 0.6 + 0.4 * Math.sin(elapsed * 26);
  ctx.globalAlpha = 0.75 * pulse;
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 54 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + elapsed * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 44, Math.sin(a) * 44);
    ctx.lineTo(Math.cos(a) * (62 + pulse * 8), Math.sin(a) * (62 + pulse * 8));
    ctx.stroke();
  }
  ctx.restore();
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  match: Match,
  vp: Viewport,
  opts: RenderOptions,
): void {
  const { elapsed } = opts;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.offsetX, vp.offsetY);

  // Screen shake.
  ctx.translate(match.fx.shakeX, match.fx.shakeY);

  drawBackground(ctx);

  // Finish zoom: one slow push-in per match, centred on the fighter about to die.
  if (match.fx.zoom < 1 && opts.sparkSide) {
    const f = match.fighter(opts.sparkSide);
    const z = match.fx.zoom;
    ctx.translate(f.x, f.y);
    ctx.scale(z, z);
    ctx.translate(-f.x, -f.y);
  }

  drawBlastLines(ctx);
  drawPlatforms(ctx);

  // Trails sit under the fighters.
  for (const side of ["left", "right"] as Side[]) {
    drawTrail(ctx, match.fighter(side), match.skins[side]);
  }

  for (const side of ["left", "right"] as Side[]) {
    const f = match.fighter(side);
    if (f.state === "recovering" || f.state === "ko") {
      ctx.save();
      ctx.globalAlpha = f.state === "ko" ? 0.35 : 1;
      drawFighter(ctx, f, match.skins[side], elapsed);
      ctx.restore();
    } else {
      drawFighter(ctx, f, match.skins[side], elapsed);
    }
    if (opts.sparkSide === side && match.phase !== "matchOver") {
      drawSpark(ctx, f, elapsed);
    }
  }

  drawParticles(ctx, match);

  ctx.restore();

  // White flash on heavy impacts and KOs.
  if (match.fx.flash > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(0.62, match.fx.flash);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
}

export { HURTBOX };
