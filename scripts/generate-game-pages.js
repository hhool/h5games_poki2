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

// Read the full <body> from dist/index.html so static game pages have all
// the DOM elements that app.js expects (search input, game grid, overlays, etc.)
function extractBody(htmlFile) {
  const src = fs.readFileSync(htmlFile, 'utf8');
  const m = src.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!m) throw new Error(`Could not extract <body> from ${htmlFile}`);
  return { open: src.match(/<body([^>]*)>/i)[0], inner: m[1] };
}

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

function buildPage(game, bodyTag, bodyInner) {
  const slug     = normalizeHref(game.link);
  const title    = `${game.title} \u2014 Play Free on ${SITE_NAME}`;
  const desc     = game.description ||
    `Play ${game.title} for free online on ${SITE_NAME} \u2014 no downloads required.`;
  const img      = game.imgSrc || `${BASE_URL}/assets/icon/icon-512.png`;
  const char     = slug[0].toLowerCase();
  const pageUrl  = `${BASE_URL}/game/${char}/${slug}/`;
  const tags     = game.tags || [];
  const genres   = tags.filter(t => TAG_LABELS[t]).map(t => TAG_LABELS[t]);
  const playMode = tags.includes('multiplayer') ? 'MultiPlayer' : 'SinglePlayer';

  const ldObj = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name:                game.title,
    url:                 pageUrl,
    image:               img,
    thumbnailUrl:        img,
    ...(img ? { screenshot: { '@type': 'ImageObject', url: img, width: 512, height: 512 } } : {}),
    description:         desc,
    genre:               genres.length ? genres : ['Game'],
    applicationCategory: 'Game',
    playMode:            playMode,
    operatingSystem:     'Web Browser',
    offers:    { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${BASE_URL}/` },
    ...(game.blog ? { sameAs: [game.blog] } : {}),
  };
  const ld = JSON.stringify(ldObj);

  return `<!DOCTYPE html>
<html lang="en" class="preload-hide">
<head>
  <style id="preload-style">.preload-hide,.preload-hide *{visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;opacity:0!important}</style>
  <script id="preload-unhide">(function(){var done=false;function unhide(){if(done)return;done=true;document.documentElement.classList.remove('preload-hide');var s=document.getElementById('preload-style');if(s&&s.parentNode)s.parentNode.removeChild(s);var sc=document.getElementById('preload-unhide');if(sc&&sc.parentNode)sc.parentNode.removeChild(sc);}window.__tryU=function(){if((window.__cssN||0)>=(window.__cssT||1))unhide();};if(document.readyState==='complete'){window.__tryU();return;}window.addEventListener('load',window.__tryU,{once:true});setTimeout(unhide,2500);})();<\/script>
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
  <link rel="preload" href="/css/style.css?v=__CACHE_VER__" as="style" onload="this.onload=null;this.rel='stylesheet';window.__cssN=(window.__cssN||0)+1;typeof window.__tryU==='function'&&window.__tryU();">
  <noscript><link rel="stylesheet" href="/css/style.css?v=__CACHE_VER__"></noscript>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#006bb3">
  <!-- Base href ensures all relative paths in the SPA body resolve from root -->
  <base href="/">
</head>
${bodyTag}
  <!-- Static fallback for no-JS crawlers -->
  <noscript>
    <h1>${esc(game.title)}</h1>
    <p>${esc(desc)}</p>
    <p><a href="/">&#8592; Back to ${SITE_NAME}</a></p>
  </noscript>
${bodyInner}
</body>
</html>`;
}

// ── main ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(GAMES)) {
  console.error('dist/games.json not found — run build:copy first');
  process.exit(1);
}

const indexHtml = path.join(DIST, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('dist/index.html not found — run build:copy first');
  process.exit(1);
}

// Extract full body from dist/index.html so all DOM elements app.js needs are present
const { open: bodyTag, inner: bodyInner } = extractBody(indexHtml);
// Strip the trailing </body> that may be included in 'inner' (it shouldn't be, but guard)
const bodyContent = bodyInner.replace(/<\/body>\s*$/i, '');
// On game pages the <h1> is the game title — demote the homepage hero heading
// to <p> so each page has exactly one canonical H1 (avoids GSC "multiple H1" signal)
const gameBodyContent = bodyContent.replace(
  /<h1(\s[^>]*)?>What are you playing today\?<\/h1>/i,
  '<p$1>What are you playing today?</p>'
);

const games = JSON.parse(fs.readFileSync(GAMES, 'utf8'));
let count = 0;
const seen = new Set();

for (const game of games) {
  if (!game.show) continue;
  const slug = normalizeHref(game.link);
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);

  const char = slug[0].toLowerCase();
  const dir = path.join(DIST, 'game', char, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPage(game, bodyTag, gameBodyContent), 'utf8');
  count++;
}

console.log(`\u2705  Generated ${count} game pages in dist/game/`);
