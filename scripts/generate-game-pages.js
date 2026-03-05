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
// Read games from source root (always up to date) rather than dist/ copy,
// so running this script standalone after editing games.json works correctly.
const GAMES     = path.join(__dirname, '..', 'games.json');

// Read the full <body> from dist/index.html so static game pages have all
// the DOM elements that app.js expects (search input, game grid, overlays, etc.)
function extractBody(htmlFile) {
  const src = fs.readFileSync(htmlFile, 'utf8');
  const m = src.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!m) throw new Error(`Could not extract <body> from ${htmlFile}`);
  return { open: src.match(/<body([^>]*)>/i)[0], inner: m[1] };
}

// Tags that have a static /tag/* page (matches TAG_CONFIG in generate-tag-pages.js)
const TAG_PAGES = [
  ['action',      'Action'],
  ['puzzle',      'Puzzle'],
  ['adventure',   'Adventure'],
  ['racing',      'Racing'],
  ['shooting',    'Shooting'],
  ['multiplayer', 'Multiplayer'],
  ['competitive', 'Competitive'],
  ['strategy',    'Strategy'],
  ['idle',        'Idle'],
  ['arcade',      'Arcade'],
  ['sports',      'Sports'],
  ['platformer',  'Platformer'],
];

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

function buildPage(game, bodyTag, bodyInner, relatedGames) {
  const slug     = normalizeHref(game.link);
  const tags     = game.tags || [];
  const genres   = tags.filter(t => TAG_LABELS[t]).map(t => TAG_LABELS[t]);

  // For short game names the raw title "X — Play Free on Poki2" can be < 30 chars,
  // which GSC flags. Append the primary genre label to bring it into the 30–60 range.
  const rawTitle = `${game.title} \u2014 Play Free on ${SITE_NAME}`;
  const title = rawTitle.length < 30 && genres.length
    ? `${game.title} ${genres[0]} \u2014 Play Free on ${SITE_NAME}`
    : rawTitle;

  const desc     = game.description ||
    `Play ${game.title} for free online on ${SITE_NAME} \u2014 no downloads required.`;
  const img      = game.imgSrc || `${BASE_URL}/assets/icon/icon-512.png`;
  const char     = slug[0].toLowerCase();
  const pageUrl  = `${BASE_URL}/game/${char}/${slug}/`;
  const playMode = tags.includes('multiplayer') ? 'MultiPlayer' : 'SinglePlayer';
  const inputs   = game.input || [];

  // ── VideoGame JSON-LD ────────────────────────────────────────────────────
  const numberOfPlayers = tags.includes('multiplayer')
    ? { '@type': 'QuantitativeValue', minValue: 2, maxValue: 8 }
    : { '@type': 'QuantitativeValue', minValue: 1, maxValue: 1 };

  const accessibilityFeatures = [
    ...(inputs.includes('touch')    ? ['touchControl']    : []),
    ...(inputs.includes('keyboard') ? ['keyboardControl'] : []),
    ...(inputs.includes('mouse')    ? ['mouseControl']    : []),
  ];

  const ldObj = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name:                game.title,
    url:                 pageUrl,
    inLanguage:          'en',
    image:               img,
    thumbnailUrl:        img,
    ...(img ? { screenshot: { '@type': 'ImageObject', url: img, width: 512, height: 512 } } : {}),
    description:         desc,
    genre:               genres.length ? genres : ['Game'],
    applicationCategory: 'Game',
    playMode:            playMode,
    numberOfPlayers,
    operatingSystem:     'Web Browser',
    ...(accessibilityFeatures.length ? { accessibilityFeature: accessibilityFeatures } : {}),
    offers:    { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${BASE_URL}/` },
    ...(game.blog ? { sameAs: [game.blog] } : {}),
  };
  const ld = JSON.stringify(ldObj);

  // ── BreadcrumbList JSON-LD ───────────────────────────────────────────────
  const genreTagKeys = tags.filter(t => TAG_LABELS[t]);
  const primaryTagKey  = genreTagKeys[0] || null;
  const primaryGenre   = primaryTagKey ? TAG_LABELS[primaryTagKey] : 'Games';
  const genreTagUrl    = primaryTagKey ? `${BASE_URL}/tag/${primaryTagKey}/` : `${BASE_URL}/`;
  const breadcrumbLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',       item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: primaryGenre, item: genreTagUrl },
      { '@type': 'ListItem', position: 3, name: game.title,   item: pageUrl },
    ],
  });

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
  <!-- Preload game icon — likely LCP element on game pages -->
  <link rel="preload" as="image" href="${esc(img)}" fetchpriority="high">

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

  <!-- Structured data: VideoGame + BreadcrumbList -->
  <script type="application/ld+json">${ld}</script>
  <script type="application/ld+json">${breadcrumbLd}</script>

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
    <nav aria-label="Breadcrumb">
      <ol>
        <li><a href="/">${SITE_NAME}</a></li>
        ${primaryTagKey ? `<li><a href="/tag/${primaryTagKey}/">${esc(primaryGenre)}</a></li>` : `<li>${esc(primaryGenre)}</li>`}
        <li>${esc(game.title)}</li>
      </ol>
    </nav>
    <h1>${esc(game.title)}</h1>
    <p>${esc(desc)}</p>
    ${genres.length ? `<p><strong>Genre:</strong> ${genreTagKeys.map(k => `<a href="/tag/${k}/">${esc(TAG_LABELS[k])}</a>`).join(', ')}</p>` : ''}
    ${inputs.length ? `<p><strong>Controls:</strong> ${inputs.map(esc).join(', ')}</p>` : ''}
    ${(relatedGames && relatedGames.length) ? `<p><strong>More games:</strong> ${relatedGames.map(r => {
      const rs = normalizeHref(r.link);
      const rc = rs[0].toLowerCase();
      return `<a href="/game/${rc}/${rs}/">${esc(r.title)}</a>`;
    }).join(', ')}</p>` : ''}
    <nav aria-label="Game Categories">
      <ul>
        ${TAG_PAGES.map(([k, l]) => `<li><a href="/tag/${k}/">${esc(l)} Games</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <p><a href="/">&#8592; All games</a></p>
  </noscript>
${bodyInner}
</body>
</html>`;
}

// ── main ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(GAMES)) {
  console.error('games.json not found');
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

// Pre-build tag → game list index for related-game lookups
const tagIndex = {};
for (const g of games) {
  if (!g.show) continue;
  for (const t of (g.tags || [])) {
    if (!TAG_LABELS[t]) continue; // only genre tags
    if (!tagIndex[t]) tagIndex[t] = [];
    tagIndex[t].push(g);
  }
}

function getRelated(game, n = 4) {
  const slug = normalizeHref(game.link);
  const tags = (game.tags || []).filter(t => TAG_LABELS[t]);
  const scores = {};
  for (const t of tags) {
    for (const g of (tagIndex[t] || [])) {
      const gs = normalizeHref(g.link);
      if (gs === slug) continue;
      scores[gs] = (scores[gs] || 0) + 1;
    }
  }
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([s]) => games.find(g => normalizeHref(g.link) === s))
    .filter(Boolean);
}

for (const game of games) {
  if (!game.show) continue;
  const slug = normalizeHref(game.link);
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);

  const related = getRelated(game);
  const char = slug[0].toLowerCase();
  const dir = path.join(DIST, 'game', char, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPage(game, bodyTag, gameBodyContent, related), 'utf8');
  count++;
}

console.log(`\u2705  Generated ${count} game pages in dist/game/`);
