#!/usr/bin/env node
/**
 * tools/audit/check-sitemap-urls.js
 *
 * Parses sitemap.xml, sends HTTP GET to each <loc> URL, and reports
 * any URL that does not return HTTP 200.
 *
 * Usage:
 *   node tools/audit/check-sitemap-urls.js [--sitemap=PATH_OR_URL]
 *                                           [--concurrency=10]
 *                                           [--timeout=8000]
 *                                           [--json]
 *                                           [--only-errors]
 *
 * Options:
 *   --sitemap=     Path to local sitemap.xml or https:// URL (default: ./sitemap.xml)
 *   --concurrency= Parallel requests (default: 10)
 *   --timeout=     Per-request timeout ms (default: 8000)
 *   --json         Output full result array as JSON
 *   --only-errors  Only print non-200 lines
 *
 * Exit code: 0 = all 200, 1 = one or more non-200
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
const SITEMAP_SRC  = args.sitemap      || path.join(__dirname, '../../sitemap.xml');
const CONCURRENCY  = parseInt(args.concurrency || '10',  10);
const TIMEOUT_MS   = parseInt(args.timeout     || '8000', 10);
const JSON_OUT     = !!args.json;
const ONLY_ERRORS  = !!args['only-errors'];

// ── Load sitemap ─────────────────────────────────────────────────────────────
function fetchText(rawUrl) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(rawUrl);
    const mod = parsed.protocol === 'https:' ? https : http;
    mod.get(rawUrl, { headers: { 'User-Agent': 'poki2-audit/1.0' } }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

async function loadSitemap() {
  if (SITEMAP_SRC.startsWith('http://') || SITEMAP_SRC.startsWith('https://')) {
    return fetchText(SITEMAP_SRC);
  }
  return fs.readFileSync(SITEMAP_SRC, 'utf8');
}

function extractLocs(xml) {
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/gs)];
  return matches.map(m => m[1].trim()).filter(Boolean);
}

// ── HTTP probe ────────────────────────────────────────────────────────────────
function probeGet(rawUrl) {
  return new Promise(resolve => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch(e) {
      return resolve({ status: 'INVALID_URL', url: rawUrl });
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
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
  let xml;
  try {
    xml = await loadSitemap();
  } catch(e) {
    console.error('Failed to load sitemap:', e.message);
    process.exit(2);
  }

  const urls = extractLocs(xml);
  if (urls.length === 0) {
    console.error('No <loc> entries found in sitemap.');
    process.exit(2);
  }

  console.log(`Checking ${urls.length} sitemap URLs  (concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms) …\n`);

  const raw     = await runPool(urls, probeGet, CONCURRENCY);
  const results = raw.map(r => ({
    url:    r.url,
    status: r.status,
    ok:     r.status === 200
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
      console.log('✅  All sitemap URLs returned 200.\n');
    } else {
      console.log(`\n❌  NON-200 (${failures.length}):\n`);
      for (const f of failures) {
        console.log(`  [${String(f.status).padEnd(12)}]  ${f.url}`);
      }
      console.log('');
    }
    console.log(`Total: ${results.length}  |  200 OK: ${ok.length}  |  Non-200: ${failures.length}`);
  }

  process.exit(failures.length > 0 ? 1 : 0);
})();
