#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const args = require('minimist')(process.argv.slice(2));

const BASE = (args.base || process.env.BASE_URL || 'https://poki2.online').replace(/\/$/, '');
const INCLUDE_HASH = args.hash !== undefined ? !!args.hash : true;
const OUT = args.out || path.join(process.cwd(), 'sitemap.xml');

function iso(d){ return new Date(d).toISOString(); }

function normalizeHref(h){
  // remove protocol and domain
  try{ const u = new URL(h); h = u.pathname + (u.search||''); }catch(e){}
  return h.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g,'').toLowerCase();
}

(async function(){
  const files = glob.sync('**/*.html', { ignore: ['**/node_modules/**','**/.git/**','**/tools/**'] });
  const entries = [];

  for(const f of files){
    const stat = fs.statSync(f);
    const loc = BASE + '/' + f.replace(/\\\\/g,'/');
    entries.push({ loc, lastmod: iso(stat.mtime), changefreq: 'weekly', priority: 0.6 });
  }

  // Add index explicitly
  if (!files.includes('index.html')){
    entries.unshift({ loc: BASE + '/', lastmod: iso(Date.now()), changefreq: 'daily', priority: 1.0 });
  }

  // Add games from games.json if present
  const gamesJsonPath = path.join(process.cwd(),'games.json');
  if (fs.existsSync(gamesJsonPath)){
    try{
      const games = JSON.parse(fs.readFileSync(gamesJsonPath,'utf8'));
      for(const g of games){
        const slug = normalizeHref(g.link || g.imgSrc || g.title || 'game');
        let loc;
        if (INCLUDE_HASH) loc = `${BASE}/#play-${slug}`;
        else loc = `${BASE}/?play=${slug}`;
        entries.push({ loc, lastmod: iso(Date.now()), changefreq: 'monthly', priority: 0.5 });
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
