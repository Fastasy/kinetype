// Generate the brand icons from the same matrix the header logo uses.
//
//   npx tsx scripts/make-brand-assets.ts
//
// Writes app/icon.svg, app/apple-icon.png and app/favicon.ico. Nothing here is hand-drawn, so
// editing components/brand/mark.ts and re-running this is all a logo change takes.
//
// The old app/icon.png (the pre-game branding, an Aug 18 leftover) is deleted rather than
// overwritten: Next.js treats icon.svg and icon.png as rival declarations of the same icon, so
// keeping both risks the browser picking the wrong one.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import sharp from "sharp";

import { markSvgString } from "../components/brand/mark";

const APP = "app";

/** The matrix is 16x16, so rasterise at the exact target size and let crispEdges keep it sharp. */
function svgAt(size: number): Buffer {
  const svg = markSvgString().replace(
    `width="16" height="16"`,
    `width="${size}" height="${size}"`,
  );
  return Buffer.from(svg, "utf8");
}

/** An ICO container holding PNG frames. Small enough to write by hand, and avoids a dependency. */
function ico(frames: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(frames.length, 4);

  const entries: Buffer[] = [];
  let offset = 6 + frames.length * 16;
  for (const f of frames) {
    const e = Buffer.alloc(16);
    e.writeUInt8(f.size >= 256 ? 0 : f.size, 0); // 0 means 256
    e.writeUInt8(f.size >= 256 ? 0 : f.size, 1);
    e.writeUInt8(0, 2); // palette size
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(f.data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += f.data.length;
  }

  return Buffer.concat([header, ...entries, ...frames.map((f) => f.data)]);
}

const png = (size: number) => sharp(svgAt(size)).png().toBuffer();

async function main(): Promise<void> {
  mkdirSync(APP, { recursive: true });

  // Modern browsers, and the one Next.js prefers.
  writeFileSync(`${APP}/icon.svg`, markSvgString() + "\n");

  // iOS home screen.
  writeFileSync(`${APP}/apple-icon.png`, await png(180));

  // 16 for the tab strip, 32 for everything else, and 48/96/192 because Google's
  // favicon crawler only accepts raster formats (BMP, GIF, ICO, PNG, JPEG, PPM,
  // TIFF) and recommends an icon larger than 48x48 so it survives every surface.
  // The SVG we also ship is crisp in browsers but is NOT on Google's supported
  // list, so it cannot be the only thing on offer: without the big ICO frames the
  // only Google-readable source above 48px would be the 180px apple-touch-icon.
  const frames = [
    { size: 16, data: await png(16) },
    { size: 32, data: await png(32) },
    { size: 48, data: await png(48) },
    { size: 96, data: await png(96) },
    { size: 192, data: await png(192) },
  ];
  writeFileSync(`${APP}/favicon.ico`, ico(frames));

  const stale = `${APP}/icon.png`;
  try {
    rmSync(stale);
    console.log(`removed ${stale} (superseded by icon.svg)`);
  } catch {
    // Already gone, which is the normal case on a second run.
  }

  console.log("wrote app/icon.svg, app/apple-icon.png, app/favicon.ico");
  for (const f of frames) console.log(`  favicon frame ${f.size}x${f.size}: ${f.data.length} bytes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
