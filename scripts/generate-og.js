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
  { name: 'contact', title: 'Contact Us — Poki2' },
  { name: 'dmca', title: 'DMCA Policy — Poki2' }
];

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function svgTemplate(title) {
  const w = 1200, h = 630;
  const escaped = escapeXml(title);
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `\n  <defs>` +
    `\n    <linearGradient id="g" x1="0" x2="1">` +
    `\n      <stop offset="0%" stop-color="#006bb3"/>` +
    `\n      <stop offset="100%" stop-color="#6c3bff"/>` +
    `\n    </linearGradient>` +
    `\n  </defs>` +
    `\n  <rect width="100%" height="100%" fill="url(#g)" />` +
    `\n  <rect x="64" y="64" width="1072" height="502" rx="24" fill="rgba(255,255,255,0.06)" />` +
    `\n  <text x="120" y="220" font-family="Inter, Arial, sans-serif" font-size="48" fill="#fff" font-weight="700">${escaped}</text>` +
    `\n  <text x="120" y="300" font-family="Inter, Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.9)">Play free HTML5 games — no downloads</text>` +
    `\n  <g transform="translate(960,480)"><rect width="200" height="56" rx="12" fill="#fff"/><text x="100" y="36" font-family="Inter, Arial, sans-serif" font-size="18" fill="#006bb3" text-anchor="middle">poki2.online</text></g>` +
    `\n</svg>`;
}

(async () => {
  try {
    for (const p of pages) {
      const svg = svgTemplate(p.title);
      const svgPath = path.join(outDir, `${p.name}.svg`);
      fs.writeFileSync(svgPath, svg, 'utf8');

      const pngOut = path.join(outDir, `${p.name}.png`);
      const webpOut = path.join(outDir, `${p.name}.webp`);

      const svgBuffer = Buffer.from(svg, 'utf8');
      await sharp(svgBuffer).png({ quality: 90 }).toFile(pngOut);
      await sharp(svgBuffer).webp({ quality: 80 }).toFile(webpOut);

      console.log('Generated', pngOut, webpOut);
    }
  } catch (err) {
    console.error('OG generation failed:', err);
    process.exitCode = 1;
  }
})();
