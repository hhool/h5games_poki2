#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'games.json');
if (!fs.existsSync(FILE)) {
  console.error('games.json not found');
  process.exit(1);
}

function slugify(title) {
  return title.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function firstCharOfSlug(slug) {
  const m = slug.match(/[a-z0-9]/);
  return m ? m[0] : '_';
}

const sizes = [180, 192, 512];

const raw = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(raw);
let changed = 0;

for (let i = 0; i < data.length; i++) {
  const g = data[i];
  if (!g.title) continue;
  const slug = slugify(g.title);
  const first = firstCharOfSlug(slug);
  const base = `https://play.poki2.online/icons/${first}/${slug}`;
  const img512 = `${base}/icon-512.png`;
  if (g.imgSrc !== img512) {
    g.imgSrc = img512;
    changed++;
  }
  const icons = {};
  for (const s of sizes) icons[String(s)] = `${base}/icon-${s}.png`;
  // shallow compare
  const oldIcons = g.icons || {};
  const keys = Object.keys(icons);
  let iconsDiffer = false;
  for (const k of keys) if (oldIcons[k] !== icons[k]) iconsDiffer = true;
  if (iconsDiffer) {
    g.icons = icons;
    changed++;
  }
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Applied icon template to ${data.length} entries, ${changed} field changes.`);
