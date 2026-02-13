#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
// use native fs readdir instead of globby to avoid ESM-only package issues
const argv = require('minimist')(process.argv.slice(2));

const DIR = argv.dir || 'dist';
const META_FILE = argv.meta || 'scripts/meta.json';
const SITE_TITLE = 'Poki2 — Free Online Games';
const DEFAULT_DESC = 'Play the best free browser games: action, puzzle, racing and more — instant play on desktop and mobile.';

if (!fs.existsSync(META_FILE)) {
  console.error('meta file not found:', META_FILE);
  process.exit(1);
}

const metaMap = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));

(async () => {
  const dirPath = path.resolve(process.cwd(), DIR);
  let entries = [];
  try {
    entries = await fs.promises.readdir(dirPath);
  } catch (err) {
    console.error('failed to read dir', dirPath, err);
    process.exit(1);
  }
  const files = entries.filter(f => f.endsWith('.html')).map(f => path.join(dirPath, f));
  for (const fp of files) {
    let html = fs.readFileSync(fp, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    const fname = path.basename(fp);
    const slug = (fname === 'index.html' ? 'home' : fname.replace(/\.html$/, ''));

    const pageMeta = metaMap[slug] || {};
    const title = pageMeta.title || (slug === 'home' ? SITE_TITLE : `${SITE_TITLE} — ${slug}`);
    const desc = (pageMeta.description || DEFAULT_DESC).trim().replace(/\s+/g, ' ').slice(0, 300);

    // ensure title
    if ($('head title').length) {
      $('head title').first().text(title);
    } else {
      $('head').prepend(`<title>${title}</title>`);
    }

    // upsert helper
    function upsert(selector, attrs) {
      const existing = $('head').find(selector);
      if (existing.length) existing.remove();
      const el = $('<meta/>');
      Object.entries(attrs).forEach(([k, v]) => el.attr(k, v));
      $('head').append(el);
    }

    upsert('meta[name="description"]', { name: 'description', content: desc });
    upsert('meta[property="og:description"]', { property: 'og:description', content: desc });
    upsert('meta[name="twitter:description"]', { name: 'twitter:description', content: desc });

    upsert('meta[property="og:title"]', { property: 'og:title', content: title });
    upsert('meta[name="twitter:title"]', { name: 'twitter:title', content: title });

    // ensure og:image points to favicon
    upsert('meta[property="og:image"]', { property: 'og:image', content: 'https://poki2.online/favicon.png' });

    // ensure og:url is absolute
    const url = `https://poki2.online/${slug === 'home' ? '' : slug + '.html'}`;
    upsert('meta[property="og:url"]', { property: 'og:url', content: url });

    // write back
    fs.writeFileSync(fp, $.html(), 'utf8');
    console.log('updated', fp);
  }
})();
