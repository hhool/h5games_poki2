#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function safeJoin(...parts) { return parts.join('/').replace(/\\/g, '/').replace(/\/\/+/g, '/'); }

const projectRoot = path.join(__dirname, '..');
const dist = path.join(projectRoot, 'dist');
const revPath = path.join(dist, 'rev-manifest.json');
const templateSw = path.join(projectRoot, 'sw.js');

if (!fs.existsSync(dist)) { console.error('dist not found — run build scripts first'); process.exit(1); }
if (!fs.existsSync(revPath)) { console.error('rev-manifest.json not found in dist — run hash:assets first'); process.exit(1); }

const manifest = JSON.parse(fs.readFileSync(revPath, 'utf8'));
const precache = new Set(); precache.add('/');
function addIfExists(rel) { const key = rel.startsWith('/') ? rel.slice(1) : rel; if (manifest[key]) { precache.add('/' + manifest[key].replace(/\\/g,'/')); return true; } if (fs.existsSync(path.join(dist, key))) { precache.add('/' + key); return true; } return false; }

['/index.html','/manifest.json','/css/style.css','/css/pages.css','/js/app.js'].forEach(addIfExists);
for (const k of Object.keys(manifest)) { if (/^(css\/|js\/|assets\/)/.test(k) || k === 'manifest.json') precache.add('/' + manifest[k].replace(/\\/g,'/')); }
const entries = Array.from(precache);
let swTemplate = '';
if (fs.existsSync(templateSw)) swTemplate = fs.readFileSync(templateSw,'utf8'); else { console.error('Template sw.js not found at project root — aborting'); process.exit(1); }
const manifestHash = crypto.createHash('sha1').update(JSON.stringify(manifest)).digest('hex').slice(0,8);
swTemplate = swTemplate.replace(/const\s+CACHE_NAME\s*=\s*['"].*?['"];?/, `const CACHE_NAME = 'poki2-${manifestHash}';`);
const entriesStr = '[' + entries.map(s => "'" + s + "'").join(', ') + ']';
swTemplate = swTemplate.replace(/cache\.addAll\(\s*\[[\s\S]*?\]\s*\)/, `cache.addAll(${entriesStr})`);
const outPath = path.join(dist, 'sw.js'); fs.writeFileSync(outPath, swTemplate, 'utf8'); console.log(`Wrote ${path.relative(projectRoot, outPath)} with ${entries.length} precache entries`);
