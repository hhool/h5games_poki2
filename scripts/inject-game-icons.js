import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_GAME = path.join(process.cwd(), 'dist', 'game');
const ICONS_PREFIX = '/icons'; // served path

function listGameIndexFiles(base) {
  if (!fs.existsSync(base)) return [];
  const hostKeys = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  const files = [];
  for (const hk of hostKeys) {
    const hkPath = path.join(base, hk);
    const games = fs.readdirSync(hkPath, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    for (const g of games) {
      const idx = path.join(hkPath, g, 'index.html');
      if (fs.existsSync(idx)) files.push({ hostKey: hk, game: g, file: idx });
    }
  }
  return files;
}

function ensureLinkTag(html, href) {
  // if link rel=icon or apple-touch-icon already points to same href, skip
  if (html.includes(href)) return html;
  // insert into <head> after opening <head>
  const headOpen = html.match(/<head[^>]*>/i);
  if (!headOpen) return html; // can't find head
  const insert = `\n  <link rel="icon" sizes="192x192" href="${href}">\n  <link rel="apple-touch-icon" sizes="192x192" href="${href}">\n`;
  return html.replace(/<head[^>]*>/i, match => match + insert);
}

function processAll() {
  const files = listGameIndexFiles(DIST_GAME);
  console.log(`Found ${files.length} index.html files`);
  const modified = [];
  for (const f of files) {
    let html = fs.readFileSync(f.file, 'utf-8');
    const href = path.posix.join(ICONS_PREFIX, f.hostKey, f.game, 'icon-192.png');
    const newHtml = ensureLinkTag(html, href);
    if (newHtml !== html) {
      fs.writeFileSync(f.file, newHtml, 'utf-8');
      modified.push(f.file);
      console.log(`Injected icon into ${f.file}`);
    }
  }
  console.log(`Modified ${modified.length} files`);
}

processAll();
