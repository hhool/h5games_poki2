const fs = require('fs');
const path = require('path');

const gamesPath = path.resolve(__dirname, '..', 'games.json');
const redirectsPath = path.resolve(__dirname, '..', '_redirects');

function slugFromLink(link) {
  try {
    const u = new URL(link);
    const p = u.pathname.replace(/\/+$/,'');
    return p.split('/').pop();
  } catch (e) {
    return null;
  }
}

function firstChar(s) {
  return (s && s[0]) ? s[0].toLowerCase() : '_';
}

function main() {
  if (!fs.existsSync(gamesPath)) {
    console.error('games.json not found at', gamesPath);
    process.exit(1);
  }
  const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
  const redirects = [];
  const seen = new Set();
  for (const g of games) {
    const slug = slugFromLink(g.link || '');
    if (!slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const ch = firstChar(slug);
    redirects.push(`/games/${slug} /game/${ch}/${slug}/ 301`);
    redirects.push(`/games/${slug}/ /game/${ch}/${slug}/ 301`);
  }

  let base = '';
  if (fs.existsSync(redirectsPath)) {
    base = fs.readFileSync(redirectsPath, 'utf8');
  }

  // Insert generated redirects before the SPA fallback if present, otherwise append at top
  const spaMarker = /\/\*\s+\/index.html/;
  if (spaMarker.test(base)) {
    const parts = base.split(/\n(?=\/\*\s+\/index.html)/);
    const head = parts[0];
    const tail = parts.slice(1).join('\n');
    const out = [head.trim(), '', '# Generated per-game redirects', ...redirects, '', tail.trim()].filter(Boolean).join('\n') + '\n';
    fs.writeFileSync(redirectsPath, out, 'utf8');
    console.log('Wrote', redirects.length, 'redirect rules into', redirectsPath);
  } else {
    const out = ['# Auto-generated per-game redirects', ...redirects, '', base].filter(Boolean).join('\n') + '\n';
    fs.writeFileSync(redirectsPath, out, 'utf8');
    console.log('Wrote', redirects.length, 'redirect rules into', redirectsPath);
  }
}

if (require.main === module) main();
