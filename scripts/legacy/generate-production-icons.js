const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

// Generates a simple maskable icon using SVG -> PNG/WebP via sharp
const outDir = path.join(__dirname, '..', 'public', 'assets', 'icon')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

function svgTemplate(size, bg, fg, label) {
  const fontSize = Math.round(size * 0.5)
  return `<?xml version="1.0" encoding="utf-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="100%" height="100%" rx="${Math.round(size*0.15)}" fill="${bg}" />
    <g transform="translate(${size/2},${size/2})">
      <text x="0" y="${Math.round(fontSize/3)}" text-anchor="middle" font-family="Inter, Roboto, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="${fg}">${label}</text>
    </g>
  </svg>`
}

async function make(size, name) {
  const svg = svgTemplate(size, '#006bb3', '#ffffff', 'G')
  const pngPath = path.join(outDir, `${name}.png`)
  const webpPath = path.join(outDir, `${name}.webp`)
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 90 })
    .toFile(pngPath)

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .webp({ quality: 90 })
    .toFile(webpPath)

  console.log('Wrote', pngPath, webpPath)
}

async function run() {
  try {
    await make(192, 'icon-192')
    await make(512, 'icon-512')
    console.log('Production icons generated.')
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
