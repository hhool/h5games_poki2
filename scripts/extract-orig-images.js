#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const child = require('child_process');
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
  const host = urlObj.hostname;
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
  } catch (e) {}
  return await fetchUrl(srcUrl);
}

function extFromUrl(u) {
  try {
    const p = new URL(u).pathname;
    const e = path.extname(p).split('?')[0];
    return e || '.png';
  } catch (_) { return '.png'; }
}

async function processGame(g, outBase) {
  const src = g.imgSrc;
  if (!src) return { skipped: true, reason: 'no imgSrc' };
  const slug = slugify(g.link || g.title || src);
  const ext = extFromUrl(src);
  let hostSub = 'misc';
  let gameName = slug;
  try {
    const u = new URL(src);
    const hparts = u.hostname.split('.');
    hostSub = hparts[0] || 'misc';
    const segs = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (segs.length) {
      const ignore = new Set(['mobile', 'assets', 'images', 'img', 'logo', 'icons', 'res', 'loading', 'titleScreen']);
      let chosen = null;
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i];
        if (!s) continue;
        if (s.indexOf('.') !== -1) continue;
        if (ignore.has(s.toLowerCase())) continue;
        chosen = s;
        break;
      }
      if (!chosen) {
        const last = segs[segs.length - 1];
        chosen = last.indexOf('.') !== -1 ? path.parse(last).name : last;
      }
      gameName = chosen || gameName;
    }
  } catch (e) { hostSub = 'misc'; }
  const hostKey = (/^\d+$/.test(hostSub) ? hostSub : (gameName && gameName[0]) || 'x');
  const origDir = path.join(outBase, hostKey, gameName);
  mkdirp(origDir);
  let origPath;
  try {
    const u = new URL(src);
    const segs = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    // try to preserve the path after the gameName segment
    let rest = [];
    const idx = segs.findIndex(s => String(s).toLowerCase() === String(gameName).toLowerCase());
    if (idx !== -1) {
      rest = segs.slice(idx + 1);
    } else if (segs.length) {
      // fallback: use last segment
      rest = [segs[segs.length - 1]];
    }
    if (!rest.length) rest = [gameName + ext];
    // collapse any intermediate directories, keep only the final filename
    const filename = rest[rest.length - 1];
    const destPath = path.join(origDir, filename);
    mkdirp(path.dirname(destPath));
    origPath = destPath;
  } catch (e) {
    origPath = path.join(origDir, gameName + ext);
  }
  try {
    const buf = await getSourceBuffer(src);
    fs.writeFileSync(origPath, buf);
    return { skipped: false, slug, origPath };
  } catch (e) {
    return { skipped: true, reason: String(e), src };
  }
}

async function main() {
  const games = getPreviousGamesJson();
  const outBase = path.join(process.cwd(), 'public', 'orig');
  mkdirp(outBase);
  const results = [];
  for (const g of games) {
    const r = await processGame(g, outBase);
    results.push(Object.assign({ title: g.title || '', link: g.link || '' }, r));
    await new Promise(res => setTimeout(res, 60));
  }
  const report = { generatedAt: new Date().toISOString(), count: results.length, results };
  mkdirp(path.join(process.cwd(), 'env', 'HTML-Games-V2'));
  fs.writeFileSync(path.join(process.cwd(), 'env', 'HTML-Games-V2', 'extract_orig_report.json'), JSON.stringify(report, null, 2));
  console.log('Done. wrote report -> env/HTML-Games-V2/extract_orig_report.json');
}

main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
