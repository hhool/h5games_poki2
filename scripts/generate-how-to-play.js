#!/usr/bin/env node
/**
 * scripts/generate-how-to-play.js
 *
 * Batch-generates a `howToPlay` field for every game in games.json that
 * doesn't already have one.
 *
 * Strategy: clean the existing `description` by stripping generic technical
 * suffixes ("Supports keyboard and touch controls", "No download required",
 * "Best experienced on desktop", etc.), leaving only gameplay-relevant prose.
 * Then trim to ≤ 180 chars at a sentence boundary.
 *
 * Run once, review output, commit games.json.
 * Safe to re-run — skips games that already have `howToPlay`.
 *
 * Usage:
 *   node scripts/generate-how-to-play.js [--dry-run]
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const GAMES_FILE = path.join(__dirname, '..', 'games.json');
const DRY_RUN    = process.argv.includes('--dry-run');

// Patterns to strip from descriptions (order matters — most specific first)
const STRIP_PATTERNS = [
  /\.\s*Controlled entirely with your keyboard[^.]*\./gi,
  /\.\s*Supports (keyboard and touch|touch and keyboard|keyboard|touch) controls[^.]*\./gi,
  /\.\s*(Runs|Playable|Play it)\s+in\s+(any|your)\s+(modern\s+)?browser[^.]*/gi,
  /\.\s*No (download|install(ation)?)\s+(or\s+(install(ation)?|download)\s+)?required[^.]*/gi,
  /\.\s*Best experienced on desktop( browsers?)?[^.]*/gi,
  /\.\s*Instant(ly)? playable in (any|your) browser[^.]*/gi,
  /\s*Controlled entirely with your keyboard[^.]*\./gi,
  /\s*Supports (keyboard and touch|touch and keyboard|keyboard|touch) controls\./gi,
  /\s*Runs in any modern browser[^.]*/gi,
  /\s*No (download|install(ation)?) (or\s+(install(ation)?|download)\s+)?required\./gi,
  /\s*Best experienced on [^.!?]*/gi,
  /\s*Play(able)?( it)? in(stantly)?( in)? (any |your )?(modern )?browser[^.]*/gi,
  /\s*Instant(ly)? playable[^.]*/gi,
  /\s*Optimized for( mobile)? browsers[^.]*/gi,
  /\s*No download needed\.?/gi,
  /\s*with no Java,? no downloads?(,? and no plugins? required)?\.?/gi,
  /\s*Play(able)? anywhere[^.]*/gi,
  // Trailing truncated fragments (e.g. "on mo" / "on deskt" / "— pla")
  /\s+—\s+pla\w*\.?$/gi,
  /\s+on\s+(mobile and desktop|desktop and mobile|desktop or mobile)\.?$/gi,
  /\s+on\s+\w{1,8}\.?$/gi,
];

function cleanDescription(desc) {
  if (!desc) return '';
  let s = desc.trim();
  for (const re of STRIP_PATTERNS) {
    s = s.replace(re, '').trim();
  }
  // Collapse double spaces
  s = s.replace(/\s{2,}/g, ' ').trim();
  // Remove trailing period-less fragments after last real sentence
  // Ensure ends with period if non-empty
  if (s && !s.match(/[.!?]$/)) s += '.';
  return s;
}

function trimToSentence(text, maxLen = 180) {
  if (text.length <= maxLen) return text;
  // Try to cut at a sentence boundary within maxLen
  const sub = text.slice(0, maxLen);
  const lastDot = Math.max(sub.lastIndexOf('. '), sub.lastIndexOf('! '), sub.lastIndexOf('? '));
  if (lastDot > 60) return text.slice(0, lastDot + 1).trim();
  // Fallback: word boundary
  const lastSpace = sub.lastIndexOf(' ');
  return sub.slice(0, lastSpace).trim() + '…';
}

const games = JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8'));

let added = 0;
let skipped = 0;

const updated = games.map(game => {
  if (game.howToPlay) {
    skipped++;
    return game;
  }
  const cleaned = cleanDescription(game.description);
  const howToPlay = trimToSentence(cleaned, 180);
  if (!howToPlay) {
    skipped++;
    return game;
  }
  added++;
  if (DRY_RUN) {
    console.log(`[${game.title}]\n  desc:      ${game.description}\n  howToPlay: ${howToPlay}\n`);
  }
  return { ...game, howToPlay };
});

if (DRY_RUN) {
  console.log(`\nDRY RUN — would add howToPlay to ${added} games, skip ${skipped}`);
} else {
  fs.writeFileSync(GAMES_FILE, JSON.stringify(updated, null, 2), 'utf8');
  console.log(`✅  Added howToPlay to ${added} games, skipped ${skipped} (already set or no description)`);
}
