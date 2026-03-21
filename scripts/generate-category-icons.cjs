const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, '..', 'js', 'app.js');
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons', 'categories');

// Map tag keys to emoji glyphs (used instead of single-letter initials)
const EMOJI_MAP = {
  puzzle: '🧩',
  shooting: '🔫',
  action: '🎮',
  adventure: '🗺️',
  racing: '🏎️',
  multiplayer: '👥',
  competitive: '🏆',
  strategy: '♟️',
  idle: '💤',
  arcade: '🕹️',
  sports: '🏅',
  platformer: '🪂'
};

function readAppJs() {
  return fs.readFileSync(APP_JS, 'utf8');
}

function extractBetween(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s === -1) return null;
  const start = s + startMarker.length;
  const end = src.indexOf(endMarker, start);
  if (end === -1) return null;
  return src.slice(start, end + (endMarker === '];' ? 1 : 0));
}

function parseJsObject(text) {
  // Wrap in parentheses and use Function to evaluate safely in this script context
  const wrapped = '(' + text + ')';
  try {
    // eslint-disable-next-line no-new-func
    return new Function('return ' + wrapped)();
  } catch (e) {
    console.error('Failed to parse JS object:', e.message);
    return null;
  }
}

function hashColor(str) {
  // simple deterministic hash -> HSL
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i) | 0;
  h = Math.abs(h) % 360;
  return `hsl(${h}deg 70% 50%)`;
}

function makeSvg(tag, label, bg) {
  const size = 64;
  const emoji = EMOJI_MAP[tag];
  const initial = (label && label[0]) ? label[0].toUpperCase() : tag[0].toUpperCase();
  const glyph = emoji || initial;
  // Use emoji-capable font stack for colorful emoji where available
  const fontFamily = "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, 'Segoe UI', Inter, system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial";
  const fontSize = emoji ? 34 : 28;
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}">\n` +
    `  <title>${label}</title>\n` +
    `  <rect rx="12" ry="12" width="${size}" height="${size}" fill="${bg}" />\n` +
    `  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="${fontFamily}" font-size="${fontSize}" font-weight="700" fill="#ffffff">${glyph}</text>\n` +
    `</svg>\n`;
}

function ensureOut() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function run() {
  const src = readAppJs();
  if (!src) { console.error('Cannot read app.js'); process.exit(1); }

  // Extract TAG_META object using regex
  const metaMatch = src.match(/const\s+TAG_META\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!metaMatch) { console.error('TAG_META not found'); process.exit(1); }
  const metaObj = parseJsObject(metaMatch[1]);

  // Extract TAG_ORDER array using regex
  const orderMatch = src.match(/const\s+TAG_ORDER\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!orderMatch) { console.error('TAG_ORDER not found'); process.exit(1); }
  const orderArr = parseJsObject(orderMatch[1]);

  ensureOut();

  orderArr.forEach(tag => {
    const meta = (metaObj && metaObj[tag]) || {};
    const label = meta.label || tag;
    const bg = hashColor(tag);
    const svg = makeSvg(tag, label, bg);
    const filename = path.join(OUT_DIR, `${tag}.svg`);
    fs.writeFileSync(filename, svg, 'utf8');
    console.log('Wrote', filename);
  });

  console.log('Generated', orderArr.length, 'category SVGs to', OUT_DIR);
}

if (require.main === module) run();
