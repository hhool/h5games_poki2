#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const child = require('child_process');
const sharp = require('sharp');
let fetchFn = global.fetch;
try { fetchFn = fetchFn || require('node-fetch'); } catch (e) {}

function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}

function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }

function getPreviousGamesJson() {
  try {
    const out = child.execSync('git show HEAD~1:games.json', { encoding: 'utf8' });
    return JSON.parse(out);
  } catch (err) {
    console.warn('Could not read HEAD~1:games.json, falling back to current games.json');
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'games.json'), 'utf8'));
  }
}

async function download(url) {
  if (!url) throw new Error('empty url');
  try {
    const res = await fetchFn(url);
    if (!res || !res.ok) throw new Error('fetch failed: ' + (res && res.status));
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  } catch (e) {
    throw e;
  }
}

async function processGame(g, outDirs) {
  const src = g.imgSrc;
  if (!src) return { skipped: true, reason: 'no imgSrc' };
  const slug = slugify(g.link || g.title || src);
  // determine extension from url
  const ext = (path.extname(new URL(src, 'http://example.com').pathname) || '').toLowerCase().replace(/\?.*$/, '') || '.png';
  const origPath = path.join(outDirs.orig, slug + ext);
  try {
    const buf = await download(src);
    fs.writeFileSync(origPath, buf);
    // generate og 1200x628
    const ogPath = path.join(outDirs.og, `${slug}-1200x628.png`);
    await sharp(buf).resize(1200, 628, { fit: 'cover' }).toFile(ogPath);
    // icon 512
    const icon512 = path.join(outDirs.icons, `${slug}-icon-512.png`);
    await sharp(buf).resize(512, 512, { fit: 'cover' }).toFile(icon512);
    // icon 180
    const icon180 = path.join(outDirs.icons, `${slug}-icon-180.png`);
    await sharp(buf).resize(180, 180, { fit: 'cover' }).toFile(icon180);
    return { skipped: false, slug, origPath, ogPath, icon512, icon180 };
  } catch (e) {
    return { skipped: true, reason: String(e), src };
  }
}

async function main() {
  const games = getPreviousGamesJson();
  const outDirs = {
    orig: path.join(process.cwd(), 'public', 'orig'),
    icons: path.join(process.cwd(), 'public', 'icons'),
    og: path.join(process.cwd(), 'public', 'og'),
  };
  mkdirp(outDirs.orig); mkdirp(outDirs.icons); mkdirp(outDirs.og);

  const results = [];
  for (const g of games) {
    // process sequentially to avoid flooding remote hosts
    // small delay between requests
    const r = await processGame(g, outDirs);
    results.push(Object.assign({ title: g.title || '', link: g.link || '' }, r));
    await new Promise(res => setTimeout(res, 120));
  }
  const report = { generatedAt: new Date().toISOString(), count: results.length, results };
  fs.writeFileSync(path.join(process.cwd(), 'env', 'HTML-Games-V2', 'generate_icons_report.json'), JSON.stringify(report, null, 2));
  console.log('Done. wrote report -> env/HTML-Games-V2/generate_icons_report.json');
}

main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
