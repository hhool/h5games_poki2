#!/usr/bin/env node
/**
 * generate-game-pages.js
 *
 * For each game in dist/games.json, generates:
 *   dist/game/{slug}/index.html
 *
 * Each page has game-specific <head> (title, description, OG, Twitter card,
 * VideoGame JSON-LD) pre-rendered as static HTML so that Twitter/Facebook/
 * Google bots can read rich-media data without executing JavaScript.
 *
 * The SPA (app.js) detects /game/{slug}/ at runtime and auto-opens the
 * game detail modal so users get the interactive experience.
 *
 * Run after build:copy so dist/games.json exists.
 */

const fs   = require('fs');
const path = require('path');

const BASE_URL  = 'https://poki2.online';
const SITE_NAME = 'Poki2';
const DIST      = path.join(__dirname, '..', 'dist');
const GAMES     = path.join(DIST, 'games.json');

// Mirror of TAG_META in app.js — used to map tag keys → genre labels
const TAG_LABELS = {
  action:      'Action',
  competitive: 'Competitive',
  idle:        'Idle',
  puzzle:      'Puzzle',
  racing:      'Racing',
  shooting:    'Shooting',
  sports:      'Sports',
  strategy:    'Strategy',
  multiplayer: 'Multiplayer',
  singleplayer:'Single Player',
  arcade:      'Arcade',
  adventure:   'Adventure',
  platformer:  'Platformer',
  clicker:     'Clicker',
  other:       'Other',
};

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

function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildPage(game) {
  const slug     = normalizeHref(game.link);
  const title    = `${game.title} \u2014 Play Free on ${SITE_NAME}`;
  const desc     = game.description ||
    `Play ${game.title} for free online on ${SITE_NAME} \u2014 no downloads required.`;
  const img      = game.imgSrc || `${BASE_URL}/assets/icon/icon-512.png`;
  const pageUrl  = `${BASE_URL}/game/${slug}/`;
  const tags     = game.tags || [];
  const genres   = tags.map(t => TAG_LABELS[t] || t).filter(Boolean);
  const playMode = tags.includes('multiplayer') ? 'MultiPlayer' : 'SinglePlayer';

  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name:                game.title,
    url:                 pageUrl,
    image:               img,
    thumbnailUrl:        img,
    description:         desc,
    genre:               genres.length ? genres : ['Game'],
    applicationCategory: 'Game',
    playMode:            playMode,
    operatingSystem:     'Web Browser',
    offers:    { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${BASE_URL}/` },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${pageUrl}">

  <!-- Open Graph -->
  <meta property="og:type"         content="website">
  <meta property="og:title"        content="${esc(title)}">
  <meta property="og:description"  content="${esc(desc)}">
  <meta property="og:image"        content="${esc(img)}">
  <meta property="og:image:width"  content="512">
  <meta property="og:image:height" content="512">
  <meta property="og:url"          content="${pageUrl}">
  <meta property="og:site_name"    content="${SITE_NAME}">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image"       content="${esc(img)}">
  <meta name="twitter:url"         content="${pageUrl}">

  <!-- VideoGame JSON-LD -->
  <script type="application/ld+json">${ld}</script>

  <!-- Assets (version token replaced by inject-version.js) -->
  <link rel="preload" href="/css/style.css?v=__CACHE_VER__" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/css/style.css?v=__CACHE_VER__"></noscript>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#006bb3">
</head>
<body>
  <!-- Static fallback for no-JS crawlers -->
  <noscript>
    <h1>${esc(game.title)}</h1>
    <p>${esc(desc)}</p>
    <p><a href="/">&#8592; Back to ${SITE_NAME}</a></p>
  </noscript>
  <!-- SPA entry: app.js detects /game/{slug}/ and auto-opens the game detail modal -->
  <script defer src="/js/app.js?v=__CACHE_VER__"></script>
</body>
</html>`;
}

// ── main ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(GAMES)) {
  console.error('dist/games.json not found — run build:copy first');
  process.exit(1);
}

const games = JSON.parse(fs.readFileSync(GAMES, 'utf8'));
let count = 0;
const seen = new Set();

for (const game of games) {
  if (!game.show) continue;
  const slug = normalizeHref(game.link);
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);

  const dir = path.join(DIST, 'game', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPage(game), 'utf8');
  count++;
}

console.log(`\u2705  Generated ${count} game pages in dist/game/`);
