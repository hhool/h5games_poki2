#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const argv = require('minimist')(process.argv.slice(2));

const DIR = argv.dir || '.';
const CONFIG = argv.config || 'scripts/ldconfig.json';

if (!fs.existsSync(CONFIG)) {
  console.error('ldconfig not found:', CONFIG);
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const siteUrl = cfg.siteUrl.replace(/\/$/, '');
const org = cfg.organization;

(async function main(){
  const dirPath = path.resolve(process.cwd(), DIR);
  let entries = [];
  try { entries = await fs.promises.readdir(dirPath); } catch (e) { console.error(e); process.exit(1); }
  const files = entries.filter(f => f.endsWith('.html')).map(f => path.join(dirPath, f));

  for (const fp of files) {
    const html = fs.readFileSync(fp, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    const fname = path.basename(fp);
    const slug = (fname === 'index.html' ? '' : fname.replace(/\.html$/, ''));
    const url = `${siteUrl}/${slug}` + (slug === '' ? '' : '.html');

    const title = ($('head title').first().text() || (cfg.siteName + (slug ? ` — ${slug}` : ''))).trim();

    // Build LD+JSON objects
    const orgLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": org.name,
      "url": org.url,
      "logo": org.logo,
      "contactPoint": [{
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": org.contactEmail
      }]
    };

    const siteLd = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": siteUrl,
      "name": cfg.siteName,
      "publisher": { "@type": "Organization", "name": org.name }
    };

    const pageLd = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "url": url,
      "name": title,
      "inLanguage": "en"
    };

    // BreadcrumbList for non-home pages
    let breadcrumbLd = null;
    if (slug) {
      breadcrumbLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": siteUrl },
          { "@type": "ListItem", "position": 2, "name": title, "item": url }
        ]
      };
    }

    // Attempt to load games list from DIR (dist/games.json) and detect if this page is a game page
    let gameLd = null;
    try {
      const gamesPath = path.join(dirPath, 'games.json');
      if (fs.existsSync(gamesPath)) {
        const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
        for (const g of games) {
          // derive slug from game link (last path segment)
          try {
            const urlObj = new URL(g.link);
            let p = urlObj.pathname.replace(/\/$/, '');
            const parts = p.split('/').filter(Boolean);
            const gslug = parts.length ? parts[parts.length-1] : '';
            if (gslug && gslug === slug) {
              gameLd = {
                "@context": "https://schema.org",
                "@type": "VideoGame",
                "name": g.title,
                "url": g.link,
                "image": g.imgSrc,
                "genre": Array.isArray(g.tags) ? g.tags.join(', ') : g.tags || undefined,
                "gamePlatform": "Web Browser",
                "inLanguage": "en"
              };
              break;
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      // ignore games.json parse errors
    }

    // Remove existing injected LD+JSON blocks we added earlier (by looking for our site URL or Organization name)
    $('head script[type="application/ld+json"]').each((i, el) => {
      const txt = $(el).html() || '';
      if (txt.includes(siteUrl) || txt.includes(org.name)) {
        $(el).remove();
      }
    });

    // Append new LD+JSON scripts
    const toInsert = [orgLd, siteLd, pageLd];
    if (breadcrumbLd) toInsert.push(breadcrumbLd);
    if (gameLd) toInsert.push(gameLd);

    toInsert.forEach(obj => {
      const script = `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
      $('head').append('\n' + script + '\n');
    });

    fs.writeFileSync(fp, $.html(), 'utf8');
    console.log('injected LD+JSON into', fp);
  }
})();
