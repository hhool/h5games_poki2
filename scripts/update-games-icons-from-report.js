#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'env', 'HTML-Games-V2', 'generate_icons_report.json');
const gamesPath = path.join(process.cwd(), 'games.json');

if (!fs.existsSync(reportPath)) {
  console.error('Report not found:', reportPath);
  process.exit(2);
}
if (!fs.existsSync(gamesPath)) {
  console.error('games.json not found:', gamesPath);
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));

const byLink = new Map(report.results.map(r => [r.link, r]));
let updated = 0;

function toPublicPath(abs) {
  if (!abs) return '';
  const rel = path.relative(path.join(process.cwd(), 'public'), abs).replace(/\\/g, '/');
  return '/' + rel;
}

for (let i = 0; i < games.length; i++) {
  const g = games[i];
  const r = byLink.get(g.link) || byLink.get((g.link || '').replace(/\/+$/, ''));
  if (!r || r.skipped) continue;

  const icon512 = toPublicPath(r.icon512);
  const icon180 = toPublicPath(r.icon180);
  if (!icon512 || !icon180) continue;

  if (!g.icons) g.icons = {};
  if (g.icons.icon512 !== icon512 || g.icons.icon180 !== icon180) {
    g.icons.icon512 = icon512;
    g.icons.icon180 = icon180;
    updated++;
  }
}

if (updated === 0) {
  console.log('No changes required.');
  process.exit(0);
}

fs.writeFileSync(gamesPath, JSON.stringify(games, null, 2) + '\n');
console.log('Updated games.json with icons for', updated, 'games');
