const fs = require('fs');
const path = require('path');
try {
  const g = JSON.parse(fs.readFileSync(path.join(__dirname, '../../games.json'), 'utf8'));
  const total = g.length;
  const withIcons = g.filter(x => x.icons && (x.icons.og || x.icons.icon512 || x.icons.icon180)).length;
  const missingTitle = g.filter(x => !x.title || !String(x.title).trim()).map(x => ({ link: x.link || '', imgSrc: x.imgSrc || '' }));
  const missingIcons = g.filter(x => !(x.icons && (x.icons.og || x.icons.icon512 || x.icons.icon180))).map(x => ({ title: x.title || '', link: x.link || '', imgSrc: x.imgSrc || '' }));
  const domains = {};
  function dom(u) { try { return new URL(u).hostname } catch (e) { return 'invalid' } }
  g.forEach(x => {
    const u = (x.icons && (x.icons.og || x.icons.icon512 || x.icons.icon180)) || x.imgSrc;
    if (u) { const d = dom(u); domains[d] = (domains[d] || 0) + 1; }
  });
  const externalOg = g.filter(x => x.icons && x.icons.og && (x.icons.og.indexOf('://') !== -1) && !x.icons.og.includes('poki2.online')).map(x => ({ title: x.title || '', og: x.icons.og }));
  const dupLinks = {};
  g.forEach(x => { const k = (x.link || '').toString().replace(/\/?$/, '').toLowerCase(); if (k) { dupLinks[k] = (dupLinks[k] || 0) + 1 } });
  const duplicates = Object.entries(dupLinks).filter(([k, v]) => v > 1).map(([k, v]) => ({ link: k, count: v }));
  const report = {
    generatedAt: new Date().toISOString(),
    total,
    withIcons,
    missingTitleCount: missingTitle.length,
    missingIconsCount: missingIcons.length,
    domains,
    externalOgCount: externalOg.length,
    externalOg: externalOg.slice(0, 30),
    duplicates: duplicates.slice(0, 30),
    missingTitle: missingTitle.slice(0, 20),
    missingIcons: missingIcons.slice(0, 20),
  };
  const out = path.join(__dirname, 'games_normalize_report.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('WROTE ' + out);
} catch (e) {
  console.error('ERROR', e && e.stack || e);
  process.exit(1);
}
