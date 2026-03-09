#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full);
    else if (ent.isFile() && ent.name === 'index.html') await processFile(full);
  }
}

async function processFile(file) {
  let txt = await fs.readFile(file, 'utf8');
  const before = txt;
  // Remove <link ... rel="prefetch" ...> tags (any attributes/order)
  txt = txt.replace(/<link\s+[^>]*rel=(?:"|')?prefetch(?:"|')?[^>]*>\s*\n?/gi, '');
  if (txt !== before) {
    await fs.writeFile(file, txt, 'utf8');
    console.log('Updated:', file);
  }
}

async function main() {
  const base = path.resolve(__dirname, '..', 'dist', 'game');
  try {
    await walk(base);
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  }
}

main();
