#!/usr/bin/env node
/**
 * tools/audit/check-game-links.js
 *
 * Validates every active game's `link` field in games.json by sending an
 * HTTP HEAD request (falls back to GET on 405). Reports non-200 results.
 *
 * Usage:
 *   node tools/audit/check-game-links.js [--concurrency=10] [--timeout=8000] [--json]
 *
 * Options:
 *   --concurrency=N   Parallel requests at a time (default: 10)
 *   --timeout=N       Per-request timeout in ms (default: 8000)
 *   --json            Output full results as JSON instead of table
 *   --only-errors     Only print failures (default: also prints summary)
 *
 * Exit code: 0 = all OK, 1 = one or more failures
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const { URL } = require('url');

// ── CLI args ────────────────────────────────────────────────────────────────
const args        = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const CONCURRENCY = parseInt(args.concurrency || '10', 10);
const TIMEOUT_MS  = parseInt(args.timeout     || '8000', 10);
const JSON_OUT    = !!args.json;
const ONLY_ERRORS = !!args['only-errors'];

// ── Load games ───────────────────────────────────────────────────────────────
const GAMES_PATH = path.join(__dirname, '../../games.json');
const games = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8'))
  .filter(g => g.active !== false && g.link);

// ── HTTP probe ───────────────────────────────────────────────────────────────
function probe(rawUrl, method = 'HEAD') {
  return new Promise(resolve => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch(e) {
      return resolve({ status: 'INVALID_URL', method, url: rawUrl });
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      timeout:  TIMEOUT_MS,
      headers:  { 'User-Agent': 'poki2-audit/1.0' }
    };
    const req = mod.request(options, res => {
      res.resume(); // drain
      resolve({ status: res.statusCode, method, url: rawUrl });
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', method, url: rawUrl }); });
    req.on('error',   e  => resolve({ status: 'ERROR:' + e.code, method, url: rawUrl }));
    req.end();
  });
}

async function checkUrl(url) {
  let r = await probe(url, 'HEAD');
  // Some servers reject HEAD — retry with GET
  if (r.status === 405 || r.status === 'ERROR:ECONNRESET') {
    r = await probe(url, 'GET');
  }
  return r;
}

// ── Concurrency pool ─────────────────────────────────────────────────────────
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

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Checking ${games.length} game links  (concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms) …\n`);

  const entries = games.map(g => ({ slug: g.slug || g.link, url: g.link, title: g.title }));
  const raw     = await runPool(entries, e => checkUrl(e.url), CONCURRENCY);

  const results = entries.map((e, i) => ({
    slug:   e.slug,
    title:  e.title,
    url:    e.url,
    status: raw[i].status,
    method: raw[i].method,
    ok:     typeof raw[i].status === 'number' && raw[i].status < 400
  }));

  const failures = results.filter(r => !r.ok);
  const ok       = results.filter(r =>  r.ok);

  if (JSON_OUT) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    if (!ONLY_ERRORS) {
      console.log(`✅  OK (${ok.length})`);
    }
    if (failures.length === 0) {
      console.log('✅  All game links are reachable.\n');
    } else {
      console.log(`\n❌  FAILURES (${failures.length}):\n`);
      for (const f of failures) {
        console.log(`  [${String(f.status).padEnd(12)}]  ${f.title.padEnd(40)}  ${f.url}`);
      }
      console.log('');
    }
    console.log(`Total: ${results.length}  |  OK: ${ok.length}  |  Failed: ${failures.length}`);
  }

  process.exit(failures.length > 0 ? 1 : 0);
})();
