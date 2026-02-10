const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(__dirname, '..', 'og');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const pages = [
  { name: 'home', title: 'Poki2 — Free Online Games' },
  { name: 'about', title: 'About — Poki2' },
  { name: 'privacy', title: 'Privacy Policy — Poki2' },
  { name: 'terms', title: 'Terms — Poki2' },
  { name: 'dcma', title: 'DMCA Policy — Poki2' }
];

function svgTemplate(title) {
  const escaped = title.replace(/&/g, '&amp;');
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <linearGradient id="g" x1="0" x2="1">
        <stop offset="0%" stop-color="#006bb3"/>
        <stop offset="100%" stop-color="#6c3bff"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)" />
    <rect x="64" y="64" width="1072" height="502" rx="24" fill="rgba(255,255,255,0.06)" />
    <text x="120" y="220" font-family="Inter, Arial, sans-serif" font-size="48" fill="#fff" font-weight="700">${escaped}</text>
    <text x="120" y="300" font-family="Inter, Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.9)">Play free HTML5 games — no downloads</text>
    <g transform="translate(960,480)"><rect width="200" height="56" rx="12" fill="#fff"/><text x="100" y="36" font-family="Inter, Arial, sans-serif" font-size="18" fill="#006bb3" text-anchor="middle">poki2.online</text></g>
  </svg>`;
}

(async () => {
  for (const p of pages) {
    const svg = svgTemplate(p.title);
    const svgPath = path.join(outDir, `${p.name}.svg`);
    fs.writeFileSync(svgPath, svg);

    const pngOut = path.join(outDir, `${p.name}.png`);
    const webpOut = path.join(outDir, `${p.name}.webp`);

    await sharp(Buffer.from(svg)).png({ quality: 90 }).toFile(pngOut);
    await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(webpOut);

    console.log('Generated', pngOut, webpOut);
  }
})();
