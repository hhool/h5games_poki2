const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

function readSwPrecache(swPath) {
  const sw = fs.readFileSync(swPath, 'utf8');
  const m = sw.match(/cache\.addAll\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!m) return null;
  const listSrc = m[1];
  const entries = [];
  const re = /(['"])(.*?)\1/g;
  let r;
  while ((r = re.exec(listSrc)) !== null) entries.push(r[2]);
  return entries;
}

function loadRevManifest(dist) {
  const rev = path.join(dist, 'rev-manifest.json');
  if (!fs.existsSync(rev)) return null;
  try { return JSON.parse(fs.readFileSync(rev, 'utf8')); } catch (e) { return null; }
}

function fileExists(dist, rel) {
  const p = path.join(dist, rel);
  return fs.existsSync(p);
}

function normalizeRel(s) {
  if (s === '/') return '/';
  return s.replace(/^\//, '');
}

function httpRequest(url, method = 'HEAD', timeout = 8000, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects < 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.request(url, { method, timeout }, res => {
      // follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        return resolve(httpRequest(next, method, timeout, redirects - 1));
      }
      resolve({ statusCode: res.statusCode, headers: res.headers });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', err => reject(err));
    req.end();
  });
}

async function checkHttp(baseUrl, entry) {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = (entry === '/') ? cleanBase + '/' : cleanBase + entry;
  try {
    const r = await httpRequest(url, 'HEAD');
    if (r.statusCode >= 200 && r.statusCode < 400) return true;
    // some servers don't allow HEAD — try GET
    if (r.statusCode === 405 || r.statusCode === 501) {
      const g = await httpRequest(url, 'GET');
      return (g.statusCode >= 200 && g.statusCode < 400);
    }
    return false;
  } catch (err) {
    // on network errors, return false
    return false;
  }
}

async function main() {
  const raw = process.argv.slice(2);
  let dist = raw[0] || path.join(__dirname, '..', 'dist');
  let httpBase = null;
  // parse flags: --http <baseUrl>
  for (let i = 1; i < raw.length; i++) {
    if (raw[i] === '--http' && raw[i+1]) { httpBase = raw[i+1]; i++; }
  }

  const swPath = path.join(dist, 'sw.js');
  if (!fs.existsSync(swPath)) {
    console.error('dist/sw.js not found at', swPath);
    process.exit(2);
  }

  const entries = readSwPrecache(swPath);
  if (!entries) {
    console.error('Failed to parse cache.addAll(...) from', swPath);
    process.exit(2);
  }

  const manifest = loadRevManifest(dist) || {};
  const missing = [];
  const unreachable = [];

  for (const e of entries) {
    if (e === '/') {
      if (manifest['index.html'] || fileExists(dist, 'index.html') || fs.readdirSync(dist).some(f => /^index\.[0-9a-f]{8}\.html$/.test(f))) {
        // OK
      } else {
        missing.push(e);
      }
      if (httpBase) {
        const ok = await checkHttp(httpBase, e);
        if (!ok) unreachable.push(e);
      }
      continue;
    }

    const rel = normalizeRel(e);
    if (!(fileExists(dist, rel) || (manifest[rel] && fileExists(dist, manifest[rel])))) {
      missing.push(e);
    }
    if (httpBase) {
      const ok = await checkHttp(httpBase, e);
      if (!ok) unreachable.push(e);
    }
  }

  if (missing.length) {
    console.error('Missing precache files on disk:');
    missing.forEach(m => console.error('  -', m));
  }
  if (httpBase) {
    if (unreachable.length) {
      console.error(`Unreachable over HTTP at ${httpBase}:`);
      unreachable.forEach(u => console.error('  -', u));
    }
  }

  if (missing.length || (httpBase && unreachable.length)) {
    process.exit(2);
  }

  console.log('All precache entries exist in', dist, httpBase ? ('and are reachable at ' + httpBase) : '');
  process.exit(0);
}

if (require.main === module) main();
