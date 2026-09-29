// Canvas renderer. Pixel art, light theme.
//
// Two rules shape this file:
//
//   1. SPRITES ARE PRE-RENDERED. Blitting ~150 fillRects per fighter per frame is
//      wasteful, so each skin is drawn once into an offscreen canvas and then
//      drawImage'd. Two draw calls per frame instead of three hundred.
//   2. NO SMOOTHING. imageSmoothingEnabled is off everywhere, so the pixel grid
//      stays hard. A blurred pixel sprite looks like a mistake.
//
// The prompt panels and HUD are DOM, not canvas: crisp text, selectable, and they
// inherit the equipped theme. This file draws the world only.

import {
  SPRITE_H,
  SPRITE_SCALE,
  SPRITE_W,
  type PixelPalette,
  type PixelSkin,
} from "./skins";
import { BLOCK_HOLD, HURTBOX, STAGE } from "./constants";
import { damageColour } from "./knockback";
import { themeById, type Theme } from "./themes";
import type { Fighter, Side } from "./types";
import type { Match } from "./match";

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Letterbox the fixed 1280x720 stage into whatever CSS box we are given. */
export function computeViewport(cssW: number, cssH: number): Viewport {
  const scale = Math.min(cssW / STAGE.width, cssH / STAGE.height);
  return {
    scale,
    offsetX: (cssW - STAGE.width * scale) / 2,
    offsetY: (cssH - STAGE.height * scale) / 2,
  };
}


// ---------------------------------------------------------------------------
// Light pixel palette. Independent of the DOM theme on purpose: the canvas is the
// art, and it should read the same whatever the page chrome does.
// ---------------------------------------------------------------------------

// Arena colours come from the equipped theme (game/themes.ts). Nothing here hardcodes a
// palette, so a new theme is data and never touches the renderer.
//
// DELIBERATELY NOT THEMED: the red lethal telegraph, the cyan parry bracket and the white
// outline behind signal text. Those are signals, not decoration, and a player must never
// have to relearn what they mean because they changed skin.

const TILE = 20;

/** Deterministic per-tile shade so blocks vary without Math.random in the loop. */
function tileShade(x: number, y: number): number {
  const n = (x * 73856093) ^ (y * 19349663);
  return 0.92 + ((n >>> 3) % 17) / 100;
}

function shade(hex: string, mul: number): string {
  const r = Math.round(Math.min(255, parseInt(hex.slice(1, 3), 16) * mul));
  const g = Math.round(Math.min(255, parseInt(hex.slice(3, 5), 16) * mul));
  const b = Math.round(Math.min(255, parseInt(hex.slice(5, 7), 16) * mul));
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Sprite cache
// ---------------------------------------------------------------------------

const cache = new Map<string, HTMLCanvasElement>();

function spriteCanvas(skin: PixelSkin): HTMLCanvasElement | null {
  const hit = cache.get(skin.id);
  if (hit) return hit;
  if (typeof document === "undefined") return null;

  const c = document.createElement("canvas");
  c.width = SPRITE_W * SPRITE_SCALE;
  c.height = SPRITE_H * SPRITE_SCALE;
  const g = c.getContext("2d");
  if (!g) return null;
  g.imageSmoothingEnabled = false;

  const rows = skin.pixels;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const col = skin.palette[ch as keyof PixelPalette];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x * SPRITE_SCALE, y * SPRITE_SCALE, SPRITE_SCALE, SPRITE_SCALE);
    }
  }
  cache.set(skin.id, c);
  return c;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

function drawSky(ctx: CanvasRenderingContext2D, theme: Theme): void {
  const bandH = STAGE.height / theme.sky.length;
  theme.sky.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, Math.floor(i * bandH), STAGE.width, Math.ceil(bandH) + 1);
  });

  // Blocky distant hills, one tile tall, stepping down to the horizon.
  ctx.fillStyle = theme.hill;
  for (let x = 0; x < STAGE.width; x += TILE) {
    const h = TILE * (2 + ((x / TILE) % 3));
    ctx.fillRect(x, STAGE.height - 220 - h, TILE, h + 220);
  }
}

function drawPlatforms(ctx: CanvasRenderingContext2D, theme: Theme): void {
  for (const p of STAGE.platforms) {
    const cols = Math.ceil(p.w / TILE);

    // Dirt body, three tiles deep.
    for (let c = 0; c < cols; c++) {
      for (let r = 1; r <= 3; r++) {
        const x = p.x + c * TILE;
        const y = p.y + r * TILE;
        const m = tileShade(c, r);
        ctx.fillStyle = shade(r === 1 ? theme.dirt : theme.dirtDark, m);
        ctx.fillRect(x, y, TILE, TILE);
      }
    }

    // Grass cap with a darker lip, so the surface reads as solid.
    for (let c = 0; c < cols; c++) {
      const x = p.x + c * TILE;
      ctx.fillStyle = shade(theme.grass, tileShade(c, 0));
      ctx.fillRect(x, p.y, TILE, TILE - 6);
      ctx.fillStyle = theme.grassLip;
      ctx.fillRect(x, p.y + TILE - 6, TILE, 6);
    }

    // Hard block edges.
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, TILE * 4 - 2);
  }
}

function drawBlastLines(ctx: CanvasRenderingContext2D, theme: Theme): void {
  ctx.save();
  ctx.strokeStyle = theme.blast;
  ctx.lineWidth = 3;
  ctx.setLineDash([TILE, TILE]);
  for (const x of [STAGE.blast.left, STAGE.blast.right]) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, STAGE.height - 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDamageBar(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  blocksX: number,
  y: number,
  theme: Theme,
): void {
  const filled = Math.max(0, Math.min(blocksX, Math.round((f.damage / 180) * blocksX)));
  const cellW = 6;
  const cellH = 8;
  for (let i = 0; i < blocksX; i++) {
    const x = f.x - (blocksX * cellW) / 2 + i * cellW;
    // Empty cells are the theme's ink at low alpha, so the track stays visible on a dark
    // theme instead of disappearing into a dark platform.
    ctx.globalAlpha = i < filled ? 1 : 0.18;
    ctx.fillStyle = i < filled ? damageColour(f.damage) : theme.ink;
    ctx.fillRect(Math.round(x), Math.round(y), cellW - 1, cellH);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    Math.round(f.x - (blocksX * cellW) / 2) - 2,
    Math.round(y) - 2,
    blocksX * cellW + 2,
    cellH + 2,
  );
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  skin: PixelSkin,
  time: number,
  theme: Theme,
): void {
  const sc = spriteCanvas(skin);
  if (!sc) return;

  const w = SPRITE_W * SPRITE_SCALE;
  const h = SPRITE_H * SPRITE_SCALE;
  // Bottom-align the sprite to the hurtbox, so the feet stand on the platform and
  // the hair (which is never a hurtbox) rides above it.
  const bottom = f.y + HURTBOX.h / 2;

  ctx.save();
  ctx.translate(f.x, bottom);

  // Vibration is VISUAL ONLY. The hurtbox is fixed and never moves: if the body
  // vibrated physically, attacks that should connect would start missing.
  if (f.vibrate > 0.01) {
    const amp = 3.4 * f.vibrate;
    const phase = Math.sin(time * 90);
    if (f.onGround) ctx.translate(phase * amp, 0);
    else ctx.translate(0, phase * amp);
  }

  const squash = f.squash;
  ctx.scale(1 + squash * 0.26, 1 - squash * 0.26);
  ctx.scale(f.facing, 1);
  ctx.imageSmoothingEnabled = false;

  // Invulnerable frames read as a flicker, the genre shorthand for "cannot be hit".
  const flicker = f.invuln > 0 && Math.floor(time * 14) % 2 === 0;
  ctx.globalAlpha = flicker ? 0.45 : 1;
  ctx.drawImage(sc, -w / 2, -h, w, h);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Guard: a raised block. A solid slab with a bright lip, deliberately NOT the
  // parry's corner brackets, so "I am blocking" and "I have a read" cannot be
  // confused at a glance. Fades as the guard runs out.
  if (f.guard > 0) {
    ctx.save();
    const remaining = Math.min(1, f.guard / BLOCK_HOLD);
    const gw = HURTBOX.w + 26;
    const gh = HURTBOX.h + 22;
    const gx = f.x - gw / 2;
    const gy = bottom - h * 0.72 - gh / 2;
    ctx.globalAlpha = 0.2 + remaining * 0.4;
    ctx.fillStyle = "#0e7490";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    ctx.strokeRect(gx, gy, gw, gh);
    ctx.restore();
  }

  // Parry window: a chunky bracket, not a smooth ring.
  if (f.counter > 0) {
    ctx.save();
    ctx.strokeStyle = "#0e7490";
    ctx.lineWidth = 4;
    const bw = HURTBOX.w + 20;
    const bh = HURTBOX.h + 16;
    const x = f.x - bw / 2;
    const y = bottom - h * 0.72 - bh / 2;
    const seg = 12;
    const corners: [number, number, number, number][] = [
      [x, y, seg, 0],
      [x, y, 0, seg],
      [x + bw, y, -seg, 0],
      [x + bw, y, 0, seg],
      [x, y + bh, seg, 0],
      [x, y + bh, 0, -seg],
      [x + bw, y + bh, -seg, 0],
      [x + bw, y + bh, 0, -seg],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Damage readout, outlined so every ramp colour reads on a light sky.
  ctx.save();
  ctx.font = "700 26px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  const ly = bottom - h - 16;
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.strokeText(`${Math.round(f.damage)}%`, f.x, ly);
  ctx.fillStyle = damageColour(f.damage);
  ctx.fillText(`${Math.round(f.damage)}%`, f.x, ly);
  ctx.restore();

  drawDamageBar(ctx, f, 12, bottom + 10, theme);
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

export interface RenderOptions {
  humanSide: Side;
  themeId: string;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  match: Match,
  vp: Viewport,
  opts: RenderOptions,
  time: number,
): void {
  const theme = themeById(opts.themeId);
  const fx = match.fx;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();

  ctx.save();
  ctx.translate(vp.offsetX, vp.offsetY);
  ctx.scale(vp.scale, vp.scale);

  // Screen shake, applied to the whole world.
  if (fx.shakeX !== 0 || fx.shakeY !== 0) ctx.translate(fx.shakeX, fx.shakeY);

  // Finish zoom: push in on the fighter who is about to die.
  if (fx.zoom > 1.001) {
    const victim = match.finishSide === "left" ? match.left : match.right;
    ctx.translate(victim.x, victim.y);
    ctx.scale(fx.zoom, fx.zoom);
    ctx.translate(-victim.x, -victim.y);
  }

  drawSky(ctx, theme);

  // Trails behind the fighters.
  ctx.save();
  for (const f of [match.left, match.right]) {
    const skin = match.skinFor(f.side);
    for (const t of f.trail) {
      const s = 6 * skin.trail.scale * t.life;
      ctx.globalAlpha = t.life * 0.6;
      ctx.fillStyle = skin.trail.colour;
      ctx.fillRect(Math.round(t.x - s / 2), Math.round(t.y - s / 2), s, s);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawBlastLines(ctx, theme);
  drawPlatforms(ctx, theme);

  for (const f of [match.left, match.right]) {
    drawFighter(ctx, f, match.skinFor(f.side), time, theme);
  }

  // Impact particles, square by design.
  ctx.save();
  for (const p of fx.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.colour;
    const s = Math.max(2, Math.round(p.size * (p.life / p.maxLife)));
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // The lethal-hit telegraph. Distance to the blast line, never move power.
  if (match.finishSide) {
    const f = match.finishSide === "left" ? match.left : match.right;
    ctx.save();
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(f.x, f.y, 62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "700 22px ui-monospace, monospace";
    ctx.textAlign = "center";
    const label = f.side === opts.humanSide ? "FINISH THEM" : "ONE HIT FROM OUT";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.strokeText(label, f.x, f.y - 84);
    ctx.fillStyle = "#be123c";
    ctx.fillText(label, f.x, f.y - 84);
    ctx.restore();
  }

  // Impact flash. Warm, not white: a white flash is invisible on a light sky.
  if (fx.flash > 0.01) {
    ctx.fillStyle = `rgba(255,120,90,${fx.flash * 0.4})`;
    ctx.fillRect(-200, -200, STAGE.width + 400, STAGE.height + 400);
  }

  ctx.restore();

  // Letterbox bars outside the stage are filled with the theme's page colour, so the arena
  // sits inside the theme rather than inside a black box.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = theme.page;
  if (vp.offsetX > 0.5) {
    ctx.fillRect(0, 0, vp.offsetX, ctx.canvas.height);
    ctx.fillRect(vp.offsetX + STAGE.width * vp.scale, 0, vp.offsetX + 2, ctx.canvas.height);
  }
  ctx.restore();
}
