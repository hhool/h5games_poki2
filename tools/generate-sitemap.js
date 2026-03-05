#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const args = require('minimist')(process.argv.slice(2));

const BASE = (args.base || process.env.BASE_URL || 'https://poki2.online').replace(/\/$/, '');
const OUT = args.out || path.join(process.cwd(), 'sitemap.xml');

function iso(d){ return new Date(d).toISOString(); }

function getSlug(g){
  return (g.link || '').replace(/\/+$/, '').split('/').pop() || '';
}

(async function(){
  const NOW = iso(Date.now());
  const entries = [];

  // 1. Static pages (exclude dist/, tools/, node_modules, privacy, public/)
  const IGNORE = ['**/node_modules/**','**/.git/**','**/tools/**','**/dist/**','**/privacy/**','**/public/**'];
  const files = glob.sync('**/*.html', { ignore: IGNORE });
  const SKIP_FILES = new Set(['404.html','google65c93755d768ab97.html','BingSiteAuth.xml']);
  for(const f of files){
    if (SKIP_FILES.has(path.basename(f))) continue;
    const stat = fs.statSync(f);
    const cleanPath = f.replace(/\\/g, '/');
    let loc, priority = '0.6';
    if (cleanPath === 'index.html') {
      loc = BASE + '/';
      priority = '1.0';
    } else {
      // Use clean URL: strip .html, add trailing slash
      const noExt = cleanPath.replace(/\.html$/, '');
      loc = BASE + '/' + noExt + '/';
    }
    entries.push({ loc, lastmod: iso(stat.mtime), changefreq: 'weekly', priority });
  }

  // 2. Game pages from games.json → https://poki2.online/game/{char}/{slug}/
  const gamesJsonPath = path.join(process.cwd(), 'games.json');
  if (fs.existsSync(gamesJsonPath)){
    try{
      const games = JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8'));
      for(const g of games){
        if (!g.avalid || g.show === false) continue;
        const sl = getSlug(g);
        if (!sl) continue;
        const char = sl[0].toLowerCase();
        const loc = `${BASE}/game/${char}/${sl}/`;
        entries.push({ loc, lastmod: NOW, changefreq: 'weekly', priority: '0.8' });
      }
    }catch(e){ console.error('Failed to parse games.json:', e.message); }
  }

  // Build XML
  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  const footer = '</urlset>\n';
  const body = entries.map(e => {
    return `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`;
  }).join('\n');

  fs.writeFileSync(OUT, header + body + '\n' + footer, 'utf8');
  console.log('Sitemap written to', OUT, 'with', entries.length, 'entries');
})();
