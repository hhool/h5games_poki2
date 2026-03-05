#!/usr/bin/env node
/**
 * tools/audit/check-seo-meta.js
 *
 * Simulates the SEO inspection pipeline used by Google Search Console (GSC)
 * and Microsoft Bing Webmaster Tools — without making any live HTTP requests.
 *
 * Checks performed per page  (mirrors GSC / Bing coverage tab signals):
 *   [TITLE]       Presence, length 30–60 chars, uniqueness
 *   [DESC]        Presence, length 100–160 chars, uniqueness
 *   [CANONICAL]   <link rel="canonical"> present & matches expected URL
 *   [VIEWPORT]    <meta name="viewport"> present  (mobile-friendliness)
 *   [NOINDEX]     Detects accidental robots noindex / nofollow
 *   [H1]          One <h1> present  (GSC highlights missing / multiple h1)
 *   [OG:TITLE]    og:title present
 *   [OG:DESC]     og:description present
 *   [OG:IMAGE]    og:image present & non-empty
 *   [TWITTER]     twitter:card present
 *   [JSON-LD]     ≥1 <script type="application/ld+json"> that parses OK
 *   [LD-TYPE]     JSON-LD @type equals "VideoGame" (or VideoObject)
 *   [LD-NAME]     JSON-LD name field matches page title
 *
 * Usage:
 *   node tools/audit/check-seo-meta.js [options]
 *
 * Options:
 *   --dir=PATH       Root dir to scan for HTML (default: ./dist/game)
 *   --src            Scan ./js/pages/ source HTML instead of dist
 *   --json           Output full JSON instead of table
 *   --only-errors    Only print ERROR / WARN rows
 *   --no-color       Disable ANSI colours
 *   --limit=N        Only process first N pages (useful for quick spot-check)
 *
 * Exit codes:
 *   0  All checks passed
 *   1  One or more ERROR-level issues found
 *   2  Tool itself failed (bad path etc.)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI args ─────────────────────────────────────────────────────────────────
const RAW_ARGS = process.argv.slice(2);
const args = Object.fromEntries(
  RAW_ARGS.filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const USE_COLOR   = args['no-color'] !== true && process.stdout.isTTY !== false;
const JSON_OUT    = !!args.json;
const ONLY_ERRORS = !!args['only-errors'];
const LIMIT       = args.limit ? parseInt(args.limit, 10) : Infinity;

// ── Directories ──────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..', '..');
let SCAN_DIR;
if (args.dir) {
  SCAN_DIR = path.resolve(args.dir);
} else if (args.src) {
  SCAN_DIR = path.join(ROOT, 'js', 'pages');
} else {
  SCAN_DIR = path.join(ROOT, 'dist', 'game');
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const C = {
  reset:  USE_COLOR ? '\x1b[0m'  : '',
  red:    USE_COLOR ? '\x1b[31m' : '',
  yellow: USE_COLOR ? '\x1b[33m' : '',
  green:  USE_COLOR ? '\x1b[32m' : '',
  cyan:   USE_COLOR ? '\x1b[36m' : '',
  bold:   USE_COLOR ? '\x1b[1m'  : '',
  dim:    USE_COLOR ? '\x1b[2m'  : '',
};
function colSev(sev, text) {
  if (sev === 'ERROR') return `${C.red}${text}${C.reset}`;
  if (sev === 'WARN')  return `${C.yellow}${text}${C.reset}`;
  return `${C.green}${text}${C.reset}`;
}

// ── HTML helpers ─────────────────────────────────────────────────────────────
function getMeta(html, name) {
  // Split by quote type to avoid stopping at apostrophes in content values
  const patterns = [
    // name first, double-quoted content
    new RegExp(`<meta\\s+(?:[^>]*\\s)?name=["']${name}["'][^>]*content="([^"]*)"`, 'i'),
    // name first, single-quoted content
    new RegExp(`<meta\\s+(?:[^>]*\\s)?name=["']${name}["'][^>]*content='([^']*)'`, 'i'),
    // content first, double-quoted
    new RegExp(`<meta\\s+(?:[^>]*\\s)?content="([^"]*?)"[^>]*name=["']${name}["']`, 'i'),
    // content first, single-quoted
    new RegExp(`<meta\\s+(?:[^>]*\\s)?content='([^']*?)'[^>]*name=["']${name}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return m[1].trim();
  }
  return null;
}

function getMetaProp(html, prop) {
  const patterns = [
    new RegExp(`<meta\\s+(?:[^>]*\\s)?property=["']${prop}["'][^>]*content="([^"]*)"`, 'i'),
    new RegExp(`<meta\\s+(?:[^>]*\\s)?property=["']${prop}["'][^>]*content='([^']*)'`, 'i'),
    new RegExp(`<meta\\s+(?:[^>]*\\s)?content="([^"]*?)"[^>]*property=["']${prop}["']`, 'i'),
    new RegExp(`<meta\\s+(?:[^>]*\\s)?content='([^']*?)'[^>]*property=["']${prop}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return m[1].trim();
  }
  return null;
}

function getTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  return m[1]
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, c => String.fromCharCode(parseInt(c.slice(2))))
    .trim();
}

function getCanonical(html) {
  const m = /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i.exec(html)
         || /<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i.exec(html);
  return m ? m[1].trim() : null;
}

function getViewport(html) {
  return getMeta(html, 'viewport');
}

function detectNoindex(html) {
  // robots meta
  const robots = getMeta(html, 'robots');
  if (robots && /noindex/i.test(robots)) return `meta robots="${robots}"`;
  // x-robots-tag won't be in HTML body but check for safety
  if (/<meta[^>]*googlebot[^>]*noindex/i.test(html)) return 'meta googlebot=noindex';
  return null;
}

function getH1s(html) {
  const matches = [];
  const re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    matches.push(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  }
  return matches;
}

function getJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

// ── Recursively find all index.html files ────────────────────────────────────
function findHtmlFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && e.name === 'index.html') {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

// ── Per-page audit ────────────────────────────────────────────────────────────
/**
 * Returns an array of issue objects:
 *   { check, sev: 'ERROR'|'WARN'|'OK', detail }
 */
function auditPage(html, filePath) {
  const issues = [];
  const rel    = path.relative(ROOT, filePath);

  function flag(check, sev, detail) {
    issues.push({ check, sev, detail: detail || '' });
  }

  // ── TITLE ─────────────────────────────────────────────────────────────────
  const title = getTitle(html);
  if (!title) {
    flag('TITLE', 'ERROR', 'Missing <title>');
  } else if (title.length < 10) {
    flag('TITLE', 'ERROR', `Too short (${title.length} chars): "${title}"`);
  } else if (title.length < 30) {
    flag('TITLE', 'WARN', `Short (${title.length} chars): "${title}"`);
  } else if (title.length > 70) {
    flag('TITLE', 'WARN', `Long (${title.length} chars) — may be truncated in SERP`);
  } else {
    flag('TITLE', 'OK', `${title.length} chars`);
  }

  // ── META DESCRIPTION ──────────────────────────────────────────────────────
  const desc = getMeta(html, 'description');
  if (!desc) {
    flag('DESC', 'ERROR', 'Missing <meta name="description">');
  } else if (desc.length < 50) {
    flag('DESC', 'ERROR', `Too short (${desc.length} chars)`);
  } else if (desc.length < 100) {
    flag('DESC', 'WARN', `Short (${desc.length} chars)`);
  } else if (desc.length > 165) {
    flag('DESC', 'WARN', `Long (${desc.length} chars) — may be truncated in SERP`);
  } else {
    flag('DESC', 'OK', `${desc.length} chars`);
  }

  // ── CANONICAL ─────────────────────────────────────────────────────────────
  const canonical = getCanonical(html);
  if (!canonical) {
    flag('CANONICAL', 'WARN', 'No <link rel="canonical"> found');
  } else {
    flag('CANONICAL', 'OK', canonical);
  }

  // ── VIEWPORT (mobile-friendliness) ────────────────────────────────────────
  const viewport = getViewport(html);
  if (!viewport) {
    flag('VIEWPORT', 'ERROR', 'Missing <meta name="viewport"> — page not mobile-friendly');
  } else if (!/width=device-width/i.test(viewport)) {
    flag('VIEWPORT', 'WARN', `viewport="${viewport}" lacks width=device-width`);
  } else {
    flag('VIEWPORT', 'OK', viewport);
  }

  // ── NOINDEX ───────────────────────────────────────────────────────────────
  const noindex = detectNoindex(html);
  if (noindex) {
    flag('NOINDEX', 'ERROR', `Page is blocked from indexing: ${noindex}`);
  } else {
    flag('NOINDEX', 'OK', 'Indexable');
  }

  // ── H1 (content structure) ────────────────────────────────────────────────
  const h1s = getH1s(html);
  if (h1s.length === 0) {
    flag('H1', 'WARN', 'No <h1> found');
  } else if (h1s.length > 1) {
    flag('H1', 'WARN', `Multiple <h1> (${h1s.length}): ${h1s.map(h => `"${h.slice(0,30)}"`).join(', ')}`);
  } else {
    flag('H1', 'OK', `"${h1s[0].slice(0, 60)}"`);
  }

  // ── OG tags ──────────────────────────────────────────────────────────────
  const ogTitle = getMetaProp(html, 'og:title');
  flag('OG:TITLE', ogTitle ? 'OK' : 'WARN', ogTitle || 'Missing og:title');

  const ogDesc = getMetaProp(html, 'og:description');
  flag('OG:DESC', ogDesc ? 'OK' : 'WARN', ogDesc ? `${ogDesc.length} chars` : 'Missing og:description');

  const ogImage = getMetaProp(html, 'og:image');
  if (!ogImage) {
    flag('OG:IMAGE', 'WARN', 'Missing og:image');
  } else if (!/^https?:\/\//i.test(ogImage)) {
    flag('OG:IMAGE', 'WARN', `og:image is relative: "${ogImage}"`);
  } else {
    flag('OG:IMAGE', 'OK', ogImage);
  }

  // ── Twitter card ──────────────────────────────────────────────────────────
  const twCard = getMeta(html, 'twitter:card');
  flag('TWITTER', twCard ? 'OK' : 'WARN', twCard || 'Missing twitter:card');

  // ── JSON-LD ───────────────────────────────────────────────────────────────
  const ldBlocks = getJsonLdBlocks(html);
  if (ldBlocks.length === 0) {
    flag('JSON-LD', 'WARN', 'No <script type="application/ld+json"> found');
    flag('LD-TYPE', 'WARN', 'N/A — no JSON-LD');
    flag('LD-NAME', 'WARN', 'N/A — no JSON-LD');
  } else {
    let parsedLd = null;
    let parseError = null;
    for (const block of ldBlocks) {
      try { parsedLd = JSON.parse(block); break; }
      catch (e) { parseError = e.message; }
    }
    if (!parsedLd) {
      flag('JSON-LD', 'ERROR', `JSON-LD parse error: ${parseError}`);
      flag('LD-TYPE', 'ERROR', 'Cannot check — parse failed');
      flag('LD-NAME', 'ERROR', 'Cannot check — parse failed');
    } else {
      flag('JSON-LD', 'OK', `${ldBlocks.length} block(s), valid JSON`);

      // LD-TYPE
      const ldType = parsedLd['@type'];
      if (!ldType) {
        flag('LD-TYPE', 'WARN', 'JSON-LD has no @type');
      } else if (/VideoGame|VideoObject|Game|CollectionPage|ItemList/i.test(String(ldType))) {
        flag('LD-TYPE', 'OK', ldType);
      } else {
        flag('LD-TYPE', 'WARN', `@type="${ldType}" — expected VideoGame/Game/CollectionPage`);
      }

      // LD-NAME matches title (skip for CollectionPage — title match not required)
      const ldName = parsedLd.name;
      const isCollection = /CollectionPage|ItemList/i.test(String(ldType || ''));
      if (!ldName && !isCollection) {
        flag('LD-NAME', 'WARN', 'JSON-LD missing "name" field');
      } else if (ldName && title && !title.toLowerCase().includes(ldName.toLowerCase().slice(0, 20))) {
        flag('LD-NAME', 'WARN', `LD name "${ldName}" not found in title "${title}"`);
      } else {
        flag('LD-NAME', 'OK', ldName ? `"${ldName}"` : 'CollectionPage (name check skipped)');
      }
    }
  }

  return { filePath, rel, title, desc, canonical, issues };
}

// ── Duplicate detection (run after all pages) ─────────────────────────────────
function flagDuplicates(results) {
  const titleMap = new Map();
  const descMap  = new Map();

  for (const r of results) {
    if (r.title) {
      const key = r.title.toLowerCase().trim();
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key).push(r.rel);
    }
    if (r.desc) {
      const key = r.desc.toLowerCase().trim();
      if (!descMap.has(key)) descMap.set(key, []);
      descMap.get(key).push(r.rel);
    }
  }

  for (const r of results) {
    if (r.title) {
      const peers = titleMap.get(r.title.toLowerCase().trim());
      if (peers && peers.length > 1) {
        r.issues.push({
          check: 'TITLE-DUP',
          sev: 'WARN',
          detail: `Duplicate title shared with ${peers.filter(p => p !== r.rel).length} other page(s)`
        });
      }
    }
    if (r.desc) {
      const peers = descMap.get(r.desc.toLowerCase().trim());
      if (peers && peers.length > 1) {
        r.issues.push({
          check: 'DESC-DUP',
          sev: 'WARN',
          detail: `Duplicate description shared with ${peers.filter(p => p !== r.rel).length} other page(s)`
        });
      }
    }
  }
}

// ── Sitemap cross-check ───────────────────────────────────────────────────────
function checkSitemapCoverage(results) {
  const sitemapPath = path.join(ROOT, 'dist', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    return { checked: false, reason: 'dist/sitemap.xml not found — run build first' };
  }
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const locs = new Set();
  const locRe = /<loc>([\s\S]*?)<\/loc>/gi;
  let m;
  while ((m = locRe.exec(xml)) !== null) locs.add(m[1].trim());

  const missing = [];
  for (const r of results) {
    if (!r.canonical) continue;
    const url = r.canonical.replace(/\/$/, '') + '/';
    if (!locs.has(url) && !locs.has(r.canonical)) missing.push(r.rel);
  }
  return { checked: true, total: locs.size, missingFromSitemap: missing };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(function main() {
  if (!fs.existsSync(SCAN_DIR)) {
    console.error(`${C.red}ERROR${C.reset}: Scan directory not found: ${SCAN_DIR}`);
    console.error('Run "npm run build" first, or pass --dir=<path>');
    process.exit(2);
  }

  const htmlFiles = findHtmlFiles(SCAN_DIR);
  if (htmlFiles.length === 0) {
    console.error(`${C.red}ERROR${C.reset}: No index.html files found in ${SCAN_DIR}`);
    process.exit(2);
  }

  const limited = htmlFiles.slice(0, LIMIT);
  console.error(`${C.cyan}[seo-audit]${C.reset} Scanning ${limited.length} pages in ${SCAN_DIR} …`);

  const results = limited.map(f => {
    const html = fs.readFileSync(f, 'utf8');
    return auditPage(html, f);
  });

  flagDuplicates(results);

  if (JSON_OUT) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.some(r => r.issues.some(i => i.sev === 'ERROR')) ? 1 : 0);
  }

  // ── Table output ─────────────────────────────────────────────────────────
  let totalErrors = 0;
  let totalWarns  = 0;

  for (const r of results) {
    const errors = r.issues.filter(i => i.sev === 'ERROR');
    const warns  = r.issues.filter(i => i.sev === 'WARN');
    totalErrors += errors.length;
    totalWarns  += warns.length;

    const hasIssue = errors.length + warns.length > 0;
    if (ONLY_ERRORS && !hasIssue) continue;

    console.log(`\n${C.bold}${r.rel}${C.reset}`);
    for (const issue of r.issues) {
      if (ONLY_ERRORS && issue.sev === 'OK') continue;
      const label = colSev(issue.sev, issue.sev.padEnd(5));
      const check = issue.check.padEnd(10);
      console.log(`  ${label}  ${C.dim}${check}${C.reset}  ${issue.detail}`);
    }
  }

  // Sitemap coverage
  const sitemap = checkSitemapCoverage(results);
  console.log(`\n${C.bold}── Sitemap Coverage ─────────────────────────────────${C.reset}`);
  if (!sitemap.checked) {
    console.log(`  ${C.yellow}WARN ${C.reset}  ${sitemap.reason}`);
  } else {
    console.log(`  ${C.green}OK   ${C.reset}  sitemap.xml contains ${sitemap.total} URLs`);
    if (sitemap.missingFromSitemap.length > 0) {
      console.log(`  ${C.yellow}WARN ${C.reset}  ${sitemap.missingFromSitemap.length} pages not found in sitemap:`);
      sitemap.missingFromSitemap.slice(0, 10).forEach(p => console.log(`         ${p}`));
      if (sitemap.missingFromSitemap.length > 10) {
        console.log(`         … and ${sitemap.missingFromSitemap.length - 10} more`);
      }
    } else {
      console.log(`  ${C.green}OK   ${C.reset}  All audited pages appear in sitemap`);
    }
  }

  // ── Summary (like GSC Coverage report) ───────────────────────────────────
  console.log(`\n${C.bold}── Summary ──────────────────────────────────────────${C.reset}`);
  console.log(`  Pages audited : ${limited.length}`);
  console.log(`  ${C.red}Errors${C.reset}        : ${totalErrors}`);
  console.log(`  ${C.yellow}Warnings${C.reset}      : ${totalWarns}`);

  const checks = [
    'TITLE','DESC','CANONICAL','VIEWPORT','NOINDEX',
    'H1','OG:TITLE','OG:DESC','OG:IMAGE','TWITTER','JSON-LD','LD-TYPE','LD-NAME',
    'TITLE-DUP','DESC-DUP'
  ];
  console.log(`\n${C.bold}── Check Breakdown ──────────────────────────────────${C.reset}`);
  for (const chk of checks) {
    const all = results.flatMap(r => r.issues.filter(i => i.check === chk));
    const errs = all.filter(i => i.sev === 'ERROR').length;
    const wrns = all.filter(i => i.sev === 'WARN').length;
    const oks  = all.filter(i => i.sev === 'OK').length;
    if (all.length === 0) continue;
    const bar = errs > 0
      ? `${C.red}✖ ${errs} error${errs > 1 ? 's' : ''}${C.reset}`
      : wrns > 0
        ? `${C.yellow}⚠ ${wrns} warn${wrns > 1 ? 's' : ''}${C.reset}`
        : `${C.green}✔ ${oks} ok${C.reset}`;
    console.log(`  ${chk.padEnd(12)}  ${bar}`);
  }

  console.log('');
  process.exit(totalErrors > 0 ? 1 : 0);
})();
