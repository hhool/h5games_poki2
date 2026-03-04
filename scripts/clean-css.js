#!/usr/bin/env node
/**
 * clean-css.js  — removes duplicate / empty rules from style.css
 * Run: node scripts/clean-css.js
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'css', 'style.css');
let css = fs.readFileSync(file, 'utf8');

// ── 1. Remove the entire "Added: game-card inset" + "Enforce final" header block
//    (lines 1–85, all redundant with the canonical rules further down)
css = css.replace(
  /\/\* ===== Added: game-card inset[\s\S]*?\/\* ============================================================\n\s*Poki2/,
  '/* ============================================================\n   Poki2'
);

// ── 2. Remove WebP no-op rules (.webp .game-card-img { } / .no-webp .game-card-img { })
css = css.replace(/\/\* WebP support detection[\s\S]*?\/\* -+\s*Sidebar/, '/* ---------- Sidebar ----------');

// ── 3. Remove the combined `.hero-card, .game-card-img { … }` block that
//    incorrectly applies clamp width/height to .game-card-img
css = css.replace(
  /\/\* Reserve layout space for hero[\s\S]*?\.game-card-img\{\s*\n\s*display:block;\s*\n\s*aspect-ratio:1 \/ 1;\s*\n\}/,
  ''
);

// ── 4. Remove the first `.section-header` block (the flex-start one)
//    The authoritative one (space-between) comes later and wins.
css = css.replace(
  /\/\* Tidy up section headers[\s\S]*?\.section-header \{\s*\n\s*display:flex;\s*\n\s*align-items:flex-start[\s\S]*?\n\}/,
  ''
);

// ── 5. Remove the first `.category-summary` block (the gradient / inline version)
//    The second block (white bg, authoritative) is kept.
css = css.replace(
  /\.category-summary\{\s*\n\s*margin:12px auto 20px;[\s\S]*?\n\}[\s\S]*?\.category-summary \.category-meta\{margin:0;font-size:0\.9rem;color:var\(--text-muted\)\}/,
  ''
);

// ── 6. Remove the duplicate empty `.category-page` / `.category-pages` first block
css = css.replace(
  /\/\* Category pages: present a single[\s\S]*?\.category-pager \{/,
  '.category-pager {'
);

// ── 7. Remove 14 empty footer-links selector blocks (the 2-line empty ones)
//    Pattern: ".site-footer .footer-inner > .footer-links,\n.site-footer > .footer-links { }"
css = css.replace(
  /(\.site-footer \.footer-inner > \.footer-links,\s*\n\.site-footer > \.footer-links \{ ?\}\s*\n)+/g,
  ''
);
// Also remove the 4-line empty blocks with a comment
css = css.replace(
  /\/\* [^\n]+ \*\/\s*\n\.site-footer \.footer-inner > \.footer-links,\s*\n\.site-footer > \.footer-links \{ ?\}\s*\n/g,
  ''
);

// ── 8. Remove the two low-specificity z-index rules immediately followed
//    by the !important overrides (keep only the !important versions)
css = css.replace(
  /\/\* Ensure cards and their titles render above the pager[\s\S]*?\.category-page \.game-card \{ position: relative; z-index: 80; \}\n\.category-page \.game-card \.game-card-info \{ position: relative; z-index: 90; \}\n/,
  ''
);

// ── 9. Remove the orphan `.game-grid{gap:14px}` / `.game-card{max-width:170px}`
//    / `.game-card-info{padding:10px 12px}` block that's a stray override
css = css.replace(
  /\n\/\* Slightly larger gaps for a more open layout \*\/\n\.game-grid\{gap:14px\}\n\.game-card\{max-width:170px\}\n\.game-card-info\{padding:10px 12px\}/,
  ''
);

// ── 10. Remove the duplicate @media(max-width:640px) + landscape padding-bottom
//     blocks that appear inside the page-grid @media (the first stray ones)
css = css.replace(
  /\/\* Add extra bottom padding on narrow[\s\S]*?@media \(orientation: landscape\) and \(max-width: 900px\) \{\s*\n\s*\/\* fallback padding for mobile landscape \*\/\s*\n\s*\.category-pages \{ padding-bottom: 160px !important; \}\s*\n\}\s*\n\s*\/\* slightly smaller row height/,
  '  /* slightly smaller row height'
);

// ── 11. Collapse multiple blank lines into two
css = css.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync(file, css.trim() + '\n');
console.log('✅  style.css cleaned');
console.log(`   Lines: ${css.split('\n').length}`);
