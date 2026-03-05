#!/usr/bin/env node
/**
 * tools/content/enrich-descriptions.js
 *
 * Template-based SEO description enricher.
 *
 * Finds games whose description is below TARGET_LEN characters and appends
 * a natural-sounding suffix derived from game metadata (tags, input,
 * avalid, orientation) — without duplicating information already in the text.
 *
 * Strategy (priority order, first applicable wins):
 *   1. Controls clause  — "Use keyboard / tap to play."
 *   2. Platform clause  — "Runs in any browser on mobile and desktop."
 *   3. Genre play-hint  — genre-specific one-liner
 *
 * Usage:
 *   node tools/content/enrich-descriptions.js            # dry-run preview
 *   node tools/content/enrich-descriptions.js --apply    # write to games.json
 *   node tools/content/enrich-descriptions.js --min=130  # target min length
 *   node tools/content/enrich-descriptions.js --only-short  # hide already-OK rows
 *
 * Exit codes: 0 = OK, 1 = some game still short after enrichment (review manually)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────────
const ARGS       = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const TARGET_MIN = parseInt(ARGS.min   || '130', 10);
const TARGET_MAX = parseInt(ARGS.max   || '158', 10);
const APPLY      = !!ARGS.apply;
const ONLY_SHORT = !!ARGS['only-short'];

const GAMES_PATH = path.join(__dirname, '../../games.json');

// ── Suffix builders ───────────────────────────────────────────────────────────
// Genre-specific action hints (used as last-resort filler)
const GENRE_HINTS = {
  puzzle:      'Test your problem-solving skills and beat every level.',
  action:      'Fast reflexes and quick thinking are your best tools.',
  shooting:    'Aim carefully and take down every target in sight.',
  racing:      'Hit the gas, dodge obstacles, and chase the finish line.',
  sports:      'Compete against opponents and top the leaderboard.',
  idle:        'Progress even when you are away and unlock powerful upgrades.',
  strategy:    'Plan every move carefully to outthink your opponents.',
  multiplayer: 'Challenge friends or compete against players worldwide.',
  adventure:   'Explore the world, uncover secrets, and survive every challenge.',
  platformer:  'Run, jump, and dodge your way through challenging levels.',
  arcade:      'Simple controls, addictive gameplay — easy to start, hard to stop.',
  clicker:     'Tap your way to the top and unlock powerful upgrades.',
  competitive: 'Go head-to-head and prove you are the best.',
};

function buildSuffix(game, currentDesc) {
  const desc   = currentDesc.toLowerCase();
  const tags   = game.tags   || [];
  const inputs = game.input  || [];
  const avalid = game.avalid || [];

  if (TARGET_MIN - currentDesc.length <= 0) return null;

  // Build a pool of candidate clauses in priority order, then chain greedily
  // until we either reach TARGET_MIN or run out.
  const clauses = [];

  // ── 1. Controls clause ────────────────────────────────────────────────────
  const mentionsControls = /keyboard|touch|mouse|tap|click|swipe|arrow key/i.test(desc);
  if (!mentionsControls && inputs.length) {
    const hasTouchCat  = inputs.includes('touch');
    const hasKeyboard  = inputs.includes('keyboard') || inputs.includes('keys');
    const hasMouse     = inputs.includes('mouse');
    if (hasTouchCat && hasKeyboard)   clauses.push('Supports keyboard and touch controls.');
    else if (hasTouchCat && hasMouse) clauses.push('Supports mouse and touch controls.');
    else if (hasTouchCat)             clauses.push('Tap to play — works great on mobile.');
    else if (hasKeyboard && hasMouse) clauses.push('Use your mouse or keyboard to play.');
    else if (hasKeyboard)             clauses.push('Controlled entirely with your keyboard.');
    else if (hasMouse)                clauses.push('Point and click to interact.');
  }

  // ── 2. Platform clause ────────────────────────────────────────────────────
  const mentionsPlatform = /mobile|desktop|browser|device/i.test(desc);
  if (!mentionsPlatform) {
    const hasMobile  = avalid.includes('mobile');
    const hasDesktop = avalid.includes('desktop');
    if (hasMobile && hasDesktop) clauses.push('Runs in any modern browser on mobile and desktop.');
    else if (hasMobile)          clauses.push('Optimized for mobile browsers — play anywhere.');
    else if (hasDesktop)         clauses.push('Best experienced on desktop browsers.');
  }

  // ── 3. Genre hint ─────────────────────────────────────────────────────────
  const genreOrder = ['puzzle','action','shooting','racing','sports','idle',
    'strategy','multiplayer','adventure','platformer','arcade','clicker','competitive'];
  for (const genre of genreOrder) {
    if (!tags.includes(genre)) continue;
    const hint = GENRE_HINTS[genre];
    if (!hint) continue;
    const keyWord = hint.split(' ').slice(1, 3).join(' ').toLowerCase();
    if (!desc.includes(keyWord)) { clauses.push(hint); break; }
  }

  // ── 4. Free-play fallback ─────────────────────────────────────────────────
  const mentionsFree = /free|no download|browser|no install/i.test(desc);
  if (!mentionsFree) clauses.push('Free to play instantly — no download or install required.');

  // ── 5. Extra tag hints ────────────────────────────────────────────────────
  const EXTRA_HINTS = {
    social:      'Play with or against others and see who comes out on top.',
    achievement: 'Earn achievements and challenge yourself to reach the top score.',
    skill:       'Master the controls and chase a higher score every run.',
    taptap:      'Simple one-touch controls make it easy to pick up and play.',
    number:      'Push your logic and keep combining to beat your best score.',
  };
  for (const [tag, hint] of Object.entries(EXTRA_HINTS)) {
    if (!tags.includes(tag)) continue;
    const keyWord = hint.split(' ').slice(1, 3).join(' ').toLowerCase();
    if (!desc.includes(keyWord)) clauses.push(hint);
  }

  // ── Chain clauses greedily ────────────────────────────────────────────────
  let built = '';
  for (const clause of clauses) {
    const next = (built ? built + ' ' : '') + clause;
    const total = currentDesc + ' ' + next;
    if (total.length > TARGET_MAX) {
      // Try trimming this clause to fit
      const space = TARGET_MAX - currentDesc.length - (built ? built.length + 2 : 1);
      if (space >= 20) built = (built ? built + ' ' : '') + clause.slice(0, space - 1) + '.';
      break;
    }
    built = next;
    if ((currentDesc + ' ' + built).length >= TARGET_MIN) break;
  }

  return built || null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const games  = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8'));
const results = [];
let enriched = 0;
let stillShort = 0;

for (const game of games) {
  const original = game.description || '';
  const len      = original.length;

  if (len >= TARGET_MIN) {
    if (!ONLY_SHORT) results.push({ title: game.title, status: 'OK', len, original, suggested: original });
    continue;
  }

  const suffix    = buildSuffix(game, original);
  const suggested = suffix ? (original + ' ' + suffix) : original;
  const newLen    = suggested.length;

  if (newLen >= TARGET_MIN) {
    enriched++;
    results.push({ title: game.title, status: 'ENRICHED', len, newLen, original, suggested, suffix });
    if (APPLY) game.description = suggested;
  } else {
    stillShort++;
    results.push({ title: game.title, status: 'MANUAL', len, newLen, original, suggested: null, suffix: null });
  }
}

// ── Output ────────────────────────────────────────────────────────────────────
const C = process.stdout.isTTY
  ? { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', c: '\x1b[36m', b: '\x1b[1m', x: '\x1b[0m' }
  : { r:'', y:'', g:'', c:'', b:'', x:'' };

for (const r of results) {
  if (r.status === 'OK') {
    if (!ONLY_SHORT) console.log(`${C.g}OK      ${C.x}${r.len.toString().padStart(3)} chars  ${r.title}`);
  } else if (r.status === 'ENRICHED') {
    console.log(`${C.c}ENRICH  ${C.x}${r.len}→${r.newLen} chars  ${C.b}${r.title}${C.x}`);
    console.log(`        ${C.y}+ "${r.suffix}"${C.x}`);
    console.log(`        "${r.suggested}"`);
  } else {
    console.log(`${C.r}MANUAL  ${C.x}${r.len} chars  ${C.b}${r.title}${C.x}  ← needs manual edit`);
    console.log(`        "${r.original}"`);
  }
}

console.log(`\n${C.b}Summary${C.x}: ${games.length} games  |  ${C.c}${enriched} enriched${C.x}  |  ${C.r}${stillShort} still need manual edit${C.x}`);

if (APPLY && enriched > 0) {
  fs.writeFileSync(GAMES_PATH, JSON.stringify(games, null, 2) + '\n', 'utf8');
  console.log(`\n${C.g}✔ Wrote updated descriptions to games.json${C.x}`);
} else if (!APPLY && enriched > 0) {
  console.log(`\nRun with ${C.b}--apply${C.x} to write ${enriched} enriched descriptions back to games.json`);
}

process.exit(stillShort > 0 ? 1 : 0);
