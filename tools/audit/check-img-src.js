#!/usr/bin/env node
/**
 * tools/audit/check-img-src.js
 *
 * Validates every active game's `imgSrc` (CDN icon URL) in games.json
 * by sending HTTP HEAD requests. Reports missing / broken icons.
 *
 * Usage:
 *   node tools/audit/check-img-src.js [--concurrency=10] [--timeout=8000]
 *                                      [--json] [--only-errors]
 *
 * Exit code: 0 = all OK, 1 = one or more failures
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const { URL } = require('url');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const CONCURRENCY = parseInt(args.concurrency || '15',  10);
const TIMEOUT_MS  = parseInt(args.timeout     || '8000', 10);
const JSON_OUT    = !!args.json;
const ONLY_ERRORS = !!args['only-errors'];

// ── Load games ────────────────────────────────────────────────────────────────
const GAMES_PATH = path.join(__dirname, '../../games.json');
const games = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8'))
  .filter(g => g.active !== false);

// ── HTTP HEAD probe ───────────────────────────────────────────────────────────
function probeHead(rawUrl) {
  return new Promise(resolve => {
    if (!rawUrl) return resolve({ status: 'MISSING', url: rawUrl });
    let parsed;
    try { parsed = new URL(rawUrl); } catch(e) {
      return resolve({ status: 'INVALID_URL', url: rawUrl });
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'HEAD',
      timeout:  TIMEOUT_MS,
      headers:  { 'User-Agent': 'poki2-audit/1.0' }
    };
    const req = mod.request(options, res => {
      res.resume();
      resolve({ status: res.statusCode, url: rawUrl });
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', url: rawUrl }); });
    req.on('error',   e  => resolve({ status: 'ERROR:' + e.code, url: rawUrl }));
    req.end();
  });
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
async function runPool(items, fn, concurrency) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const noImg   = games.filter(g => !g.imgSrc);
  const hasImg  = games.filter(g =>  g.imgSrc);

  console.log(`Games with imgSrc: ${hasImg.length} / ${games.length}  (missing: ${noImg.length})`);
  if (noImg.length) {
    console.log('  Missing imgSrc:', noImg.map(g => g.title).join(', '));
  }
  console.log(`\nProbing ${hasImg.length} icon URLs  (concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms) …\n`);

  const entries = hasImg.map(g => ({ title: g.title, url: g.imgSrc }));
  const raw     = await runPool(entries, e => probeHead(e.url), CONCURRENCY);

  const results = entries.map((e, i) => ({
    title:  e.title,
    url:    e.url,
    status: raw[i].status,
    ok:     raw[i].status === 200
  }));

  const failures = results.filter(r => !r.ok);
  const ok       = results.filter(r =>  r.ok);

  if (JSON_OUT) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    if (!ONLY_ERRORS) {
      console.log(`✅  200 OK (${ok.length})`);
    }
    if (failures.length === 0) {
      console.log('✅  All icon URLs are reachable.\n');
    } else {
      console.log(`\n❌  BROKEN ICONS (${failures.length}):\n`);
      for (const f of failures) {
        console.log(`  [${String(f.status).padEnd(12)}]  ${f.title.padEnd(40)}  ${f.url}`);
      }
      console.log('');
    }
    console.log(`Total: ${results.length}  |  OK: ${ok.length}  |  Failed: ${failures.length}`);
    if (noImg.length) {
      console.log(`\n⚠️   ${noImg.length} game(s) have no imgSrc at all — add icons for: ${noImg.map(g => g.title).join(', ')}`);
    }
  }

  process.exit(failures.length > 0 || noImg.length > 0 ? 1 : 0);
})();
