const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

// Map output HTML filenames to og image base names in og/
const mappings = [
  { file: 'index.html', og: 'home' },
  { file: 'about.html', og: 'about' },
  { file: 'privacy.html', og: 'privacy' },
  { file: 'terms.html', og: 'terms' },
  { file: 'contact.html', og: 'contact' },
  { file: 'dmca.html', og: 'dmca' }
];

function upsertMeta(html, ogPath) {
  const metaBlock = [
    `<meta property="og:image" content="${ogPath}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${ogPath}">`
  ].join('\n    ');

  // Remove existing og:image / twitter:image tags to avoid duplicates
  html = html.replace(/<meta[^>]+property=(?:"|')og:image(?:"|')[^>]*>/gi, '');
  html = html.replace(/<meta[^>]+name=(?:"|')twitter:image(?:"|')[^>]*>/gi, '');
  html = html.replace(/<meta[^>]+name=(?:"|')twitter:card(?:"|')[^>]*>/gi, '');
  html = html.replace(/<meta[^>]+property=(?:"|')og:image:width(?:"|')[^>]*>/gi, '');
  html = html.replace(/<meta[^>]+property=(?:"|')og:image:height(?:"|')[^>]*>/gi, '');

  // Insert before </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `    ${metaBlock}\n</head>`);
  }
  // Fallback: append at start
  return `${metaBlock}\n${html}`;
}

(async () => {
  try {
    if (!fs.existsSync(distDir)) {
      console.warn('dist directory not found, skipping OG injection:', distDir);
      return;
    }

    for (const m of mappings) {
      const filePath = path.join(distDir, m.file);
      if (!fs.existsSync(filePath)) {
        console.warn('Skipping missing file:', m.file);
        continue;
      }

      let html = fs.readFileSync(filePath, 'utf8');
      const ogPath = `/og/${m.og}.png`;
      html = upsertMeta(html, ogPath);
      fs.writeFileSync(filePath, html, 'utf8');
      console.log('Injected OG meta into', m.file);
    }
  } catch (err) {
    console.error('inject-og failed:', err);
    process.exitCode = 1;
  }
})();
