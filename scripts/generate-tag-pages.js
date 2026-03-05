#!/usr/bin/env node
/**
 * scripts/generate-tag-pages.js
 *
 * Generates a static HTML page for each genre tag:
 *   dist/tag/{tag}/index.html
 *
 * Each page is crawler-accessible (static game list, full meta, JSON-LD)
 * AND SPA-compatible (same body as index.html so app.js loads normally).
 *
 * Generates pages only for tags with >= MIN_GAMES games.
 *
 * Run after build:copy (needs dist/index.html for body template).
 * Reads games.json from source root (always fresh).
 *
 * Usage:
 *   node scripts/generate-tag-pages.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const BASE_URL  = 'https://poki2.online';
const SITE_NAME = 'Poki2';
const DIST      = path.join(__dirname, '..', 'dist');
const GAMES     = path.join(__dirname, '..', 'games.json');
const MIN_GAMES = 5;  // minimum games in a tag to warrant a page

// ── Tag configuration ─────────────────────────────────────────────────────────
// Only meaningful genre tags get pages. Internal/utility tags are excluded.
const TAG_CONFIG = {
  puzzle:      {
    label:    'Puzzle',
    headline: 'Free Online Puzzle Games',
    desc:     'Challenge your brain with the best free puzzle games online. Solve riddles, match tiles, and test your logic — all playable instantly in your browser.',
  },
  adventure:   {
    label:    'Adventure',
    headline: 'Free Online Adventure Games',
    desc:     'Embark on epic quests and explore unknown worlds in the best free adventure games online. Play instantly in your browser — no download or install required.',
  },
  shooting:    {
    label:    'Shooting',
    headline: 'Free Online Shooting Games',
    desc:     'Lock and load with the best free shooting games online. Aim, fire, and take down enemies in fast-paced action — playable in any browser on desktop and mobile.',
  },
  action:      {
    label:    'Action',
    headline: 'Free Online Action Games',
    desc:     'Dive into non-stop thrills with the best free action games online. Fast reflexes and epic battles await — all available to play instantly in your browser.',
  },
  racing:      {
    label:    'Racing',
    headline: 'Free Online Racing Games',
    desc:     'Hit the gas with the best free racing games online. Speed through challenging tracks, dodge rivals, and chase first place — playable instantly in your browser.',
  },
  sports:      {
    label:    'Sports',
    headline: 'Free Online Sports Games',
    desc:     'Compete in the best free online sports games — from basketball to soccer. Play solo or challenge opponents and climb the leaderboard. No download needed.',
  },
  strategy:    {
    label:    'Strategy',
    headline: 'Free Online Strategy Games',
    desc:     'Outthink your opponents with the best free strategy games online. Plan every move, manage resources, and dominate the battlefield. Play instantly in your browser.',
  },
  multiplayer: {
    label:    'Multiplayer',
    headline: 'Free Online Multiplayer Games',
    desc:     'Play with or against friends in the best free multiplayer games online. Challenge real players worldwide in real-time — no download, no install, just play instantly.',
  },
  idle:        {
    label:    'Idle',
    headline: 'Free Online Idle & Clicker Games',
    desc:     'Sit back and let the numbers grow in the best free idle games online. Upgrade, automate, and unlock powerful boosts — instant play, no download required.',
  },
  arcade:      {
    label:    'Arcade',
    headline: 'Free Online Arcade Games',
    desc:     'Relive the golden age of gaming with the best free arcade games online. Simple controls, addictive gameplay, and high scores to chase. Play instantly in any browser.',
  },
  platformer:  {
    label:    'Platformer',
    headline: 'Free Online Platformer Games',
    desc:     'Jump, run, and dodge through dangerous levels in the best free platformer games online. Classic side-scrolling action playable instantly in your browser.',
  },
  competitive: {
    label:    'Competitive',
    headline: 'Free Online Competitive Games',
    desc:     'Rise to the top in the best free competitive games online. Go head-to-head, prove your skills, and claim the number one spot. Play now in your browser.',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeHref(link) {
  try {
    const u = new URL(link);
    let p = u.pathname.replace(/\/+$/, '');
    if (!p) p = u.hostname.split('.')[0];
    return p.split('/').pop() || link;
  } catch { return link; }
}

function extractBody(htmlFile) {
  const src = fs.readFileSync(htmlFile, 'utf8');
  const m   = src.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!m) throw new Error(`Could not extract <body> from ${htmlFile}`);
  return { open: src.match(/<body([^>]*)>/i)[0], inner: m[1] };
}

// ── Page builder ──────────────────────────────────────────────────────────────
function buildTagPage(tag, cfg, games, bodyTag, bodyInner, allTags) {
  const pageUrl  = `${BASE_URL}/tag/${tag}/`;
  const title    = `${cfg.headline} — ${SITE_NAME}`;
  const ogImg    = `${BASE_URL}/assets/icon/icon-512.png`;

  // BreadcrumbList JSON-LD
  const breadcrumbLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',             item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: cfg.headline,       item: pageUrl },
    ],
  });

  // CollectionPage + ItemList JSON-LD
  const itemListLd = JSON.stringify({
    '@context':  'https://schema.org',
    '@type':     'CollectionPage',
    name:        cfg.headline,
    url:         pageUrl,
    description: cfg.desc,
    publisher:   { '@type': 'Organization', name: SITE_NAME, url: `${BASE_URL}/` },
    hasPart:     games.map((g, i) => {
      const slug  = normalizeHref(g.link);
      const char  = slug[0].toLowerCase();
      return {
        '@type':    'VideoGame',
        position:   i + 1,
        name:       g.title,
        url:        `${BASE_URL}/game/${char}/${slug}/`,
        image:      g.imgSrc || ogImg,
        description: g.description || '',
      };
    }),
  });

  // Static game list (visible to crawlers + no-JS users)
  const gameListHtml = games.map(g => {
    const slug = normalizeHref(g.link);
    const char = slug[0].toLowerCase();
    const href = `/game/${char}/${slug}/`;
    return `      <li><a href="${esc(href)}">${esc(g.title)}</a></li>`;
  }).join('\n');

  // Related categories (all other tags)
  const relatedTags = Object.entries(allTags).filter(([t]) => t !== tag);
  const relatedLinksHtml = relatedTags
    .map(([t, c]) => `<li><a href="/tag/${t}/">${esc(c.label)} Games</a></li>`)
    .join('\n        ');
  const relatedSectionHtml = `<section id="related-tags" class="related-tags-section">
  <h2>More Game Categories</h2>
  <ul class="related-tags-list">
    ${relatedTags.map(([t, c]) => `<li><a href="/tag/${t}/">${esc(c.label)}</a></li>`).join('\n    ')}
  </ul>
</section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(cfg.desc)}">
  <link rel="canonical" href="${pageUrl}">

  <!-- Open Graph -->
  <meta property="og:type"         content="website">
  <meta property="og:title"        content="${esc(title)}">
  <meta property="og:description"  content="${esc(cfg.desc)}">
  <meta property="og:image"        content="${esc(ogImg)}">
  <meta property="og:url"          content="${pageUrl}">
  <meta property="og:site_name"    content="${SITE_NAME}">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${esc(title)}">
  <meta name="twitter:description" content="${esc(cfg.desc)}">
  <meta name="twitter:image"       content="${esc(ogImg)}">

  <!-- Structured Data: CollectionPage first (auditors read first block) -->
  <script type="application/ld+json">${itemListLd}</script>
  <script type="application/ld+json">${breadcrumbLd}</script>

  <!-- Assets -->
  <link rel="preload" href="/css/style.css?v=__CACHE_VER__" as="style" onload="this.onload=null;this.rel='stylesheet';">
  <noscript><link rel="stylesheet" href="/css/style.css?v=__CACHE_VER__"></noscript>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#006bb3">
  <base href="/">
</head>
${bodyTag}
  <!-- Static content for crawlers / no-JS users -->
  <noscript>
    <h1>${esc(cfg.headline)}</h1>
    <p>${esc(cfg.desc)}</p>
    <p>${games.length} games in this category:</p>
    <ul>
${gameListHtml}
    </ul>
    <nav aria-label="Other Categories">
      <p>Other Categories:</p>
      <ul>
        ${relatedLinksHtml}
      </ul>
    </nav>
    <p><a href="/">&#8592; Back to ${esc(SITE_NAME)}</a></p>
  </noscript>
${bodyInner}
${relatedSectionHtml}
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
if (!fs.existsSync(GAMES)) {
  console.error('games.json not found');
  process.exit(1);
}
const indexHtml = path.join(DIST, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('dist/index.html not found — run build:copy first');
  process.exit(1);
}

const allGames = JSON.parse(fs.readFileSync(GAMES, 'utf8'))
  .filter(g => g.show !== false);

const { open: bodyTag, inner: bodyInner } = extractBody(indexHtml);
const gameBodyContent = bodyInner
  .replace(/<\/body>\s*$/i, '')
  .replace(/<h1(\s[^>]*)?>What are you playing today\?<\/h1>/i, '<p$1>What are you playing today?</p>');

let count = 0;

for (const [tag, cfg] of Object.entries(TAG_CONFIG)) {
  const tagGames = allGames.filter(g => (g.tags || []).includes(tag));
  if (tagGames.length < MIN_GAMES) continue;

  const dir = path.join(DIST, 'tag', tag);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    buildTagPage(tag, cfg, tagGames, bodyTag, gameBodyContent, TAG_CONFIG),
    'utf8'
  );
  console.log(`  /tag/${tag}/  (${tagGames.length} games)`);
  count++;
}

console.log(`\u2705  Generated ${count} tag pages in dist/tag/`);
