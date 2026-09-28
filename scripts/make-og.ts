// Generates public/og.png at 1200x630 from the REAL roster data.
//
// Run: npx tsx scripts/make-og.ts
//
// It imports the same pixel matrices the game blits, so the share card can never
// drift from the fighters that are actually in the game. Written as .ts rather than
// .mjs precisely so it can import game/skins instead of duplicating the sprites.

import { chromium } from "playwright";
import { SKINS, SPRITE_H, SPRITE_W } from "../game/skins";

function spriteSvg(id: string, scale: number): string {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin) throw new Error(`no such skin: ${id}`);
  const rects: string[] = [];
  skin.pixels.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const fill = skin.palette[ch as keyof typeof skin.palette];
      if (!fill) continue;
      rects.push(
        `<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="${fill}"/>`,
      );
    }
  });
  return `<svg width="${SPRITE_W * scale}" height="${SPRITE_H * scale}" viewBox="0 0 ${SPRITE_W * scale} ${SPRITE_H * scale}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects.join("")}</svg>`;
}

const PIXEL_FONT =
  "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="${PIXEL_FONT}">
<style>
  * { margin:0; padding:0; box-sizing:border-box; border-radius:0; }
  body {
    width:1200px; height:630px; overflow:hidden; position:relative;
    background:#f2ede3; color:#1e1a14;
    font-family:'Press Start 2P', ui-monospace, monospace;
    background-image:
      linear-gradient(rgba(30,26,20,.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(30,26,20,.05) 1px, transparent 1px);
    background-size:20px 20px;
  }
  /* Z layers: sky 0, ground 1, content 2. Nothing overlaps by accident. */
  .sky { position:absolute; inset:0 0 auto 0; height:200px; background:#bfe0f2; z-index:0; }
  .ground { position:absolute; left:0; right:0; bottom:0; height:120px;
            background:#b07a4e; border-top:8px solid #6fbf5f; z-index:1; }
  .blast { position:absolute; top:0; bottom:120px; width:6px; z-index:1;
           background:repeating-linear-gradient(#be123c 0 12px, transparent 12px 26px); opacity:.45; }

  /* Content sits in a 510px band above the ground, split into two columns so text
     and fighters never share horizontal space. */
  .stage { position:relative; z-index:2; height:510px; display:flex;
           justify-content:space-between; align-items:stretch; padding:0 60px; }
  .left { width:640px; padding-top:48px; }
  .right { display:flex; align-items:flex-end; }

  .wordmark { font-size:22px; color:#6d28d9; }
  h1 { margin-top:24px; font-size:38px; line-height:1.55; }
  .sub { margin-top:26px; font-family:Inter, system-ui, sans-serif; font-size:22px;
         line-height:1.5; font-weight:600; color:#4a4238; max-width:560px; }
  .strip { margin-top:28px; display:flex; gap:12px; }
  .chip { font-family:ui-monospace, monospace; font-size:19px; font-weight:700;
          padding:10px 14px; background:#fffdf7; border:4px solid #1e1a14; }
  .chip b { color:#6d28d9; }
  .fighters { display:flex; align-items:flex-end; gap:14px; }
  .vs { font-size:24px; color:#be123c; padding-bottom:78px; }
  .url { position:absolute; right:60px; bottom:44px; z-index:2;
         font-family:ui-monospace, monospace; font-size:20px; color:#f7efe4; }
</style></head>
<body>
  <div class="sky"></div>
  <div class="blast" style="left:30px"></div>
  <div class="blast" style="right:30px"></div>
  <div class="ground"></div>

  <div class="stage">
    <div class="left">
      <div class="wordmark">kinetype</div>
      <h1>TYPE. HIT.<br>KNOCK THEM OFF<br>THE STAGE.</h1>
      <div class="sub">A free typing fighting game in your browser. No download, no account.</div>
      <div class="strip">
        <div class="chip">LIGHT <b>dash</b></div>
        <div class="chip">MID <b>planet</b></div>
        <div class="chip">HEAVY <b>keyboard</b></div>
      </div>
    </div>
    <div class="right">
      <div class="fighters">
        ${spriteSvg("spark", 12)}
        <div class="vs">VS</div>
        ${spriteSvg("ember", 12)}
      </div>
    </div>
  </div>
  <div class="url">kinetype.app</div>
</body></html>`;

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  // The pixel font loads over the network; without waiting, the card renders in
  // a fallback face and the whole look is wrong.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "public/og.png" });
  await browser.close();
  console.log("wrote public/og.png (1200x630)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
