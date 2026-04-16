#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const BASE    = 'https://play.poki2.online';
const DIST    = path.join(__dirname, '..', 'dist');
const GAMES   = path.join(__dirname, '..', 'games.json');
const OUT     = path.join(DIST, 'sitemap.xml');
const SRC_OUT = path.join(__dirname, '..', 'sitemap.xml');
const TODAY   = new Date().toISOString().slice(0,10);

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function normalizeHref(link){ try{ const u=new URL(link); let p=u.pathname.replace(/\/+$/,''); if(!p)p=u.hostname.split('.')[0]; return p.split('/').pop()||link;}catch{return link;} }

function absoluteImageUrl(imgSrc){
	if(!imgSrc) return null;
	const src = String(imgSrc).trim();
	if(!src) return null;
	if(/^https?:\/\//i.test(src)) return src;
	return src.startsWith('/') ? `${BASE}${src}` : `${BASE}/${src}`;
}

function url(loc, changefreq, priority, lastmod, imgSrc, imgTitle){
	const imageUrl = absoluteImageUrl(imgSrc);
	const imageBlock = (imageUrl && imgTitle) ? ['    <image:image>', `      <image:loc>${esc(imageUrl)}</image:loc>`, `      <image:title>${esc(imgTitle)}</image:title>`, '    </image:image>'].join('\n') : null;
	return ['  <url>', `    <loc>${esc(loc)}</loc>`, `    <lastmod>${esc(lastmod)}</lastmod>`, `    <changefreq>${esc(changefreq)}</changefreq>`, `    <priority>${esc(priority)}</priority>`, ...(imageBlock ? [imageBlock] : []), '  </url>'].join('\n');
}

if(!fs.existsSync(GAMES)){ console.error('games.json not found'); process.exit(1); }

const games = JSON.parse(fs.readFileSync(GAMES,'utf8'));
const TAG_PAGES = ['puzzle','adventure','shooting','action','racing','sports','strategy','multiplayer','idle','arcade','platformer','competitive'];
const lines = ['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"','        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">','','  <!-- Site pages -->', url(`${BASE}/`,'daily','1.0',TODAY), url(`${BASE}/about.html`,'yearly','0.4',TODAY), url(`${BASE}/privacy.html`,'yearly','0.3',TODAY), url(`${BASE}/terms.html`,'yearly','0.3',TODAY), url(`${BASE}/contact.html`,'yearly','0.3',TODAY), url(`${BASE}/dmca.html`,'yearly','0.2',TODAY),'','  <!-- Tag / category pages -->', ...TAG_PAGES.map(t => url(`${BASE}/tag/${t}/`,'weekly','0.8',TODAY)),'','  <!-- Per-game pages (static, with full OG + VideoGame JSON-LD) -->'];

const seen = new Set(); let count = 0;
for(const game of games){ if(!game.show) continue; const slug = normalizeHref(game.link); if(!slug || seen.has(slug)) continue; seen.add(slug); const char = slug[0].toLowerCase(); const loc = `${BASE}/game/${char}/${slug}/`; const priority = game.featured ? '0.9' : '0.7'; lines.push(url(loc,'monthly',priority,TODAY, game.imgSrc||null, game.title||null)); count++; }
lines.push('','</urlset>','');
fs.writeFileSync(OUT, lines.join('\n'), 'utf8'); fs.writeFileSync(SRC_OUT, lines.join('\n'), 'utf8'); console.log(`\u2705  Wrote sitemap.xml with ${count} game URLs + ${TAG_PAGES.length} tag URLs \u2192 dist/ + source`);
