#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ICON_DIR = path.join(__dirname, '..', 'public', 'assets', 'icon');
const ICONS = [
  { src: 'icon-192.svg', sizes: 192 },
  { src: 'icon-512.svg', sizes: 512 },
];

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function convert() {
  await ensureDir(ICON_DIR);
  for (const icon of ICONS) {
    const inPath = path.join(ICON_DIR, icon.src);
    if (!fs.existsSync(inPath)) {
      console.warn(`Skipping missing source: ${inPath}`);
      continue;
    }

    const pngOut = path.join(ICON_DIR, `icon-${icon.sizes}.png`);
    const webpOut = path.join(ICON_DIR, `icon-${icon.sizes}.webp`);

    // Render SVG at requested pixel size and produce maskable-friendly output.
    // Add transparent padding to avoid tight corners when used as maskable.
    const canvasSize = icon.sizes;
    const svgBuffer = fs.readFileSync(inPath);
    try {
      await sharp(svgBuffer)
        .resize(canvasSize, canvasSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ quality: 90 })
        .toFile(pngOut);

      await sharp(svgBuffer)
        .resize(canvasSize, canvasSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90 })
        .toFile(webpOut);

      console.log(`Wrote ${pngOut} and ${webpOut}`);
    } catch (err) {
      console.error(`Error converting ${inPath}:`, err);
    }
  }
}

convert();
