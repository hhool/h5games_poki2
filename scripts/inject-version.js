#!/usr/bin/env node
/**
 * inject-version.js
 * Replaces all occurrences of ?v=__CACHE_VER__ in dist/index.html
 * with the current git short commit hash (e.g. ?v=a1b2c3d).
 * Run after build:copy so dist/index.html exists.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distHtml = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(distHtml)) {
  console.error('dist/index.html not found — run build:copy first');
  process.exit(1);
}

let version;
try {
  version = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (e) {
  // Fallback to timestamp if git is unavailable
  version = Date.now().toString(36);
}

const html = fs.readFileSync(distHtml, 'utf8');
const replaced = html.replace(/__CACHE_VER__/g, version);
fs.writeFileSync(distHtml, replaced);

console.log(`✅  Cache version injected: ${version}`);
