#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const dist = path.join(__dirname, '..', 'dist');
const distHtml = path.join(dist, 'index.html');

if (!fs.existsSync(distHtml)) { console.error('dist/index.html not found — run build:copy first'); process.exit(1); }

function hashFile(filePath) { if (!fs.existsSync(filePath)) return null; const data = fs.readFileSync(filePath); return crypto.createHash('sha1').update(data).digest('hex'); }

const assetFiles = [ path.join(dist, 'css', 'style.css'), path.join(dist, 'js', 'app.js') ];
const hashes = assetFiles.map(hashFile).filter(Boolean);
let version;
if (hashes.length>0){ const combined = crypto.createHash('sha1').update(hashes.join('')).digest('hex'); version = combined.slice(0,8); console.log(`✅  Cache version from file hash: ${version}`);} else { try { version = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); console.log(`⚠️   No asset files found — using git hash: ${version}`); } catch (e) { version = Date.now().toString(36); console.log(`⚠️   No git — using timestamp: ${version}`);} }

const html = fs.readFileSync(distHtml,'utf8'); const replaced = html.replace(/__CACHE_VER__/g, version); fs.writeFileSync(distHtml, replaced);

const gamePageGlob = path.join(dist, 'game'); if (fs.existsSync(gamePageGlob)) { let patched = 0; const charDirs = fs.readdirSync(gamePageGlob); for (const charDir of charDirs) { const charPath = path.join(gamePageGlob, charDir); if (!fs.statSync(charPath).isDirectory()) continue; const slugDirs = fs.readdirSync(charPath); for (const slug of slugDirs) { const p = path.join(charPath, slug, 'index.html'); if (fs.existsSync(p)) { const content = fs.readFileSync(p,'utf8'); if (content.includes('__CACHE_VER__')) { fs.writeFileSync(p, content.replace(/__CACHE_VER__/g, version)); patched++; } } } } if (patched>0) console.log(`✅  Patched __CACHE_VER__ in ${patched} game pages`); }
