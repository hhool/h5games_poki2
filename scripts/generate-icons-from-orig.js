import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ORIG_DIR = path.join(__dirname, '..', 'orig');
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

function walkDir(dir) {
  const results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}

function isImage(file) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(file);
}

function chooseBestImage(files) {
  // Prefer filenames containing icon, logo, apple-touch, or *_512
  const prefer = files.find(f => /icon|logo|apple-touch|_512|512/i.test(path.basename(f)));
  if (prefer) return prefer;
  // else pick largest file by size
  let best = files[0];
  let bestSize = fs.statSync(best).size;
  for (const f of files.slice(1)) {
    const s = fs.statSync(f).size;
    if (s > bestSize) {
      best = f; bestSize = s;
    }
  }
  return best;
}

function listGameDirs(origRoot) {
  // expect structure orig/<firstchar>/<game>/...
  if (!fs.existsSync(origRoot)) return [];
  const firstchars = fs.readdirSync(origRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  const gameDirs = [];
  for (const fc of firstchars) {
    const fcPath = path.join(origRoot, fc);
    const games = fs.readdirSync(fcPath, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    for (const g of games) gameDirs.push({ firstChar: fc, game: g, dir: path.join(fcPath, g) });
  }
  return gameDirs;
}

async function generateForGame(entry) {
  const files = walkDir(entry.dir).filter(isImage);
  if (files.length === 0) return null;
  const best = chooseBestImage(files);
  const outBase = path.join(OUT_DIR, entry.firstChar, entry.game);
  fs.mkdirSync(outBase, { recursive: true });

  const sizes = [512, 192, 180];
  for (const s of sizes) {
    const outFile = path.join(outBase, `icon-${s}.png`);
    try {
      await sharp(best)
        .resize(s, s, { fit: 'cover', position: 'centre' })
        .png({ quality: 90 })
        .toFile(outFile);
      console.log(`Wrote ${outFile}`);
    } catch (err) {
      console.error(`Failed to create ${outFile} from ${best}:`, err.message);
    }
  }
  return { game: entry.game, best };
}

async function main() {
  const games = listGameDirs(ORIG_DIR);
  console.log(`Found ${games.length} games to process`);
  const results = [];
  for (const g of games) {
    const res = await generateForGame(g);
    if (res) results.push(res);
  }
  console.log(`Processed ${results.length} games`);
}

main().catch(err => { console.error(err); process.exit(1); });
