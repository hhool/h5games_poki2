#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BASE_URL = 'https://poki2.online';
const OUT_DIR = path.join(__dirname, '..', 'public', 'og');
const GAMES = path.join(__dirname, '..', 'games.json');

if (!fs.existsSync(GAMES)) {
  console.error('games.json not found');
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function normalizeHref(link) {
  try {
    const u = new URL(link);
    let p = u.pathname.replace(/\/+$/, '');
    if (!p) p = u.hostname.split('.')[0];
    return p.split('/').pop() || link;
  } catch {
    return link;
  }
}

async function fetchBuffer(src) {
  if (!src) return null;
  try {
    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }
    // Local path: try relative to project root
    const local = path.join(__dirname, '..', src.replace(/^\//, ''));
    if (fs.existsSync(local)) return fs.readFileSync(local);
    return null;
  } catch (err) {
    return null;
  }
}

function svgOverlay(title) {
  const safe = (title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const svg = `<?xml version="1.0" encoding="utf-8"?>
  <svg width="1200" height="628" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title{font-family:Inter, Roboto, Arial, sans-serif; font-weight:700; font-size:54px; fill:#ffffff}
      .site{font-family:Inter, Roboto, Arial, sans-serif; font-weight:600; font-size:22px; fill:rgba(255,255,255,0.85)}
    </style>
    <rect width="1200" height="628" fill="none" />
    <text x="620" y="270" class="title">${safe}</text>
    <text x="620" y="320" class="site">Play free on Poki2</text>
  </svg>`;
  return Buffer.from(svg);
}

async function makeOgForGame(game) {
  if (!game || !game.show) return false;
  const slug = normalizeHref(game.link);
  const char = (slug[0] || '').toLowerCase();
  const subdir = path.join(OUT_DIR, char);
  if (!fs.existsSync(subdir)) fs.mkdirSync(subdir, { recursive: true });
  const outPath = path.join(subdir, `${slug}-1200x628.png`);
  // If out exists and newer than games.json, skip
  try {
    const statG = fs.statSync(GAMES);
    if (fs.existsSync(outPath)) {
      const statO = fs.statSync(outPath);
      if (statO.mtimeMs > statG.mtimeMs) return true;
    }
  } catch {}

  const src = game.imgSrc || `${BASE_URL}/assets/icon/icon-512.png`;
  let buf = await fetchBuffer(src);
  if (!buf) {
    console.warn(`Could not load icon for ${game.title} (${src}), skipping`);
    return false;
  }

  try {
    let icon;
    try {
      icon = await sharp(buf).resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    } catch (innerErr) {
      // fallback: some PNG variants (indexed/ancillary chunks) may fail on first pass.
      // Re-encode the source to a standard RGBA PNG and retry.
      try {
        const reencoded = await sharp(buf).rotate().png().toBuffer();
        icon = await sharp(reencoded).resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        console.warn(`Re-encoded icon for ${game.title} and retried composition`);
      } catch (e2) {
        throw innerErr;
      }
    }

    // base background color — match site's accent
    const bg = { r: 7, g: 48, b: 71, alpha: 1 };
    // create canvas and composite icon + svg text
    const svg = svgOverlay(game.title);

    const canvas = sharp({ create: { width: 1200, height: 628, channels: 4, background: bg } })
      .composite([
        { input: icon, left: 72, top: Math.round((628 - 512) / 2) },
        { input: svg, left: 0, top: 0 }
      ])
      .png({ compressionLevel: 9 });

    await canvas.toFile(outPath);
    console.log('Wrote', outPath);
    return true;
  } catch (err) {
    console.error('Error generating OG for', game.title, err && err.message);
    return false;
  }
}

async function main() {
  const games = JSON.parse(fs.readFileSync(GAMES, 'utf8'));
  let made = 0;
  for (const g of games) {
    try {
      const ok = await makeOgForGame(g);
      if (ok) made++;
    } catch (err) {
      console.error('Failed', g && g.title, err && err.message);
    }
  }
  console.log(`Generated ${made} OG images to ${OUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
