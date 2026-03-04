#!/usr/bin/env node
/**
 * generate-sitemap.js
 *
 * Generates dist/sitemap.xml using canonical /game/{char}/{slug}/ URLs.
 * Replaces the old /games/{slug}/ worker-proxy URLs.
 *
 * Run after build:copy (needs dist/games.json).
 */

const fs   = require('fs');
const path = require('path');

const BASE    = 'https://poki2.online';
const DIST    = path.join(__dirname, '..', 'dist');
const GAMES   = path.join(DIST, 'games.json');
const OUT      = path.join(DIST, 'sitemap.xml');
const SRC_OUT  = path.join(__dirname, '..', 'sitemap.xml');  // source copy, kept in sync
const TODAY   = new Date().toISOString().slice(0, 10);

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeHref(link) {
  try {
    const u = new URL(link);
    let p = u.pathname.replace(/\/+$/, '');
    if (!p) p = u.hostname.split('.')[0];
    return p.split('/').pop() || link;
  } catch { return link; }
}

function url(loc, changefreq, priority, lastmod) {
  return [
    '  <url>',
    `    <loc>${esc(loc)}</loc>`,
    `    <lastmod>${esc(lastmod)}</lastmod>`,
    `    <changefreq>${esc(changefreq)}</changefreq>`,
    `    <priority>${esc(priority)}</priority>`,
    '  </url>',
  ].join('\n');
}

if (!fs.existsSync(GAMES)) {
  console.error('dist/games.json not found — run build:copy first');
  process.exit(1);
}

const games = JSON.parse(fs.readFileSync(GAMES, 'utf8'));

const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '',
  '  <!-- Site pages -->',
  url(`${BASE}/`,             'daily',   '1.0', TODAY),
  url(`${BASE}/about.html`,   'yearly',  '0.4', TODAY),
  url(`${BASE}/privacy.html`, 'yearly',  '0.3', TODAY),
  url(`${BASE}/terms.html`,   'yearly',  '0.3', TODAY),
  url(`${BASE}/contact.html`, 'yearly',  '0.3', TODAY),
  url(`${BASE}/dmca.html`,    'yearly',  '0.2', TODAY),
  '',
  '  <!-- Per-game pages (static, with full OG + VideoGame JSON-LD) -->',
];

const seen = new Set();
let count = 0;

for (const game of games) {
  if (!game.show) continue;
  const slug = normalizeHref(game.link);
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);

  const char = slug[0].toLowerCase();
  const loc  = `${BASE}/game/${char}/${slug}/`;

  // Featured games get higher priority
  const priority = game.featured ? '0.9' : '0.7';
  lines.push(url(loc, 'monthly', priority, TODAY));
  count++;
}

lines.push('');
lines.push('</urlset>');
lines.push('');

fs.writeFileSync(OUT,     lines.join('\n'), 'utf8');
fs.writeFileSync(SRC_OUT, lines.join('\n'), 'utf8');
console.log(`✅  Wrote sitemap.xml with ${count} game URLs → dist/ + source`);
