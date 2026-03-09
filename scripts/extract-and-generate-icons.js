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

async function fetchUrl(url) {
  if (!url) throw new Error('empty url');
  const res = await fetchFn(url);
  if (!res || !res.ok) throw new Error('fetch failed: ' + (res && res.status));
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

function mapPoki2ToLocal(urlObj) {
  // urlObj is an instance of URL
  // map subdomain.poki2.online -> directory
  // numeric subdomain -> shard/<n>
  // otherwise -> <subdomain>/<path-without-leading-slash>
  const host = urlObj.hostname; // e.g. 2.poki2.online or mobileapp.poki2.online
  if (!host.endsWith('poki2.online')) return null;
  const parts = host.split('.');
  const sub = parts[0];
  const urlPath = urlObj.pathname.replace(/^\//, '');
  if (/^\d+$/.test(sub)) {
    return path.join('shards', sub, urlPath);
  }
  return path.join(sub, urlPath);
}

async function getSourceBuffer(srcUrl) {
  try {
    const urlObj = new URL(srcUrl);
    const mapped = mapPoki2ToLocal(urlObj);
    if (mapped) {
      const candidate = path.join(process.cwd(), mapped);
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate);
      }
    }
  } catch (e) {
    // fallthrough to HTTP fetch
  }
  // fallback to HTTP
  return await fetchUrl(srcUrl);
}

function extFromUrl(u) {
  try {
    const p = new URL(u).pathname;
    const e = path.extname(p).split('?')[0];
    return e || '.png';
  } catch (_) { return '.png'; }
}

async function processGame(g, outDirs) {
  const src = g.imgSrc;
  if (!src) return { skipped: true, reason: 'no imgSrc' };
  const slug = slugify(g.link || g.title || src);
  const ext = extFromUrl(src);
  // determine host subdir (e.g. '2' from 2.poki2.online or 'mobileapp')
  let hostSub = 'misc';
  let gameName = slug;
  try {
    const u = new URL(src);
    const hparts = u.hostname.split('.');
    hostSub = hparts[0] || 'misc';
    // derive gameName from last non-empty path segment (e.g. /2048/icon.png -> 2048 or icon)
    const segs = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (segs.length) {
      // prefer a segment that looks like a directory/game slug (no dot)
      const ignore = new Set(['mobile', 'assets', 'images', 'img', 'logo', 'icons', 'res', 'loading', 'titleScreen']);
      let chosen = null;
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i];
        if (!s) continue;
        if (s.indexOf('.') !== -1) continue; // looks like a filename
        if (ignore.has(s.toLowerCase())) continue; // skip common folder names
        chosen = s;
        break;
      }
      if (!chosen) {
        // fallback: use the last segment, stripping extension if present
        const last = segs[segs.length - 1];
        chosen = last.indexOf('.') !== -1 ? path.parse(last).name : last;
      }
      gameName = chosen || gameName;
    }
  } catch (e) {
    hostSub = 'misc';
  }
  // hostKey: if hostSub is numeric (shard) use it; otherwise use first letter of gameName
  const hostKey = (/^\d+$/.test(hostSub) ? hostSub : (gameName && gameName[0]) || 'x');
  const origDir = path.join(outDirs.orig, hostKey, gameName);
  const iconsDir = path.join(outDirs.icons, hostKey, gameName);
  mkdirp(origDir); mkdirp(iconsDir);
  // preserve original filename when present, otherwise use gameName+ext
  let origFilename = gameName + ext;
  try {
    const u = new URL(src);
    const segs = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (segs.length) {
      const lastRaw = segs[segs.length - 1];
      if (lastRaw.indexOf('.') !== -1) origFilename = lastRaw;
    }
  } catch (e) {}
  const origPath = path.join(origDir, origFilename);
  try {
    const buf = await getSourceBuffer(src);
    fs.writeFileSync(origPath, buf);
    // only generate icons (512 & 180). Do NOT generate OGs here.
    // icons stored under public/icons/<hostKey>/<gameName>/icon-*.png
    const iconDirFinal = path.join(outDirs.icons, hostKey, gameName);
    mkdirp(iconDirFinal);
    const icon512 = path.join(iconDirFinal, `icon-512.png`);
    const icon180 = path.join(iconDirFinal, `icon-180.png`);
    try {
      await sharp(buf).resize(512, 512, { fit: 'cover' }).png().toFile(icon512);
      await sharp(buf).resize(180, 180, { fit: 'cover' }).png().toFile(icon180);
    } catch (e) {
      const re = await sharp(buf).png().toBuffer();
      await sharp(re).resize(512, 512, { fit: 'cover' }).png().toFile(icon512);
      await sharp(re).resize(180, 180, { fit: 'cover' }).png().toFile(icon180);
    }
    return { skipped: false, slug, origPath, icon512, icon180 };
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
    const r = await processGame(g, outDirs);
    results.push(Object.assign({ title: g.title || '', link: g.link || '' }, r));
    await new Promise(res => setTimeout(res, 120));
  }
  const report = { generatedAt: new Date().toISOString(), count: results.length, results };
  mkdirp(path.join(process.cwd(), 'env', 'HTML-Games-V2'));
  fs.writeFileSync(path.join(process.cwd(), 'env', 'HTML-Games-V2', 'generate_icons_report.json'), JSON.stringify(report, null, 2));
  console.log('Done. wrote report -> env/HTML-Games-V2/generate_icons_report.json');
}

main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
