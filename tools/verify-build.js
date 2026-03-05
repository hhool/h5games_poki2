// Quick post-build verification script
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '../dist');

function check(label, val) {
  console.log((val ? '✅' : '❌') + ' ' + label);
  if (!val) process.exitCode = 1;
}

// P3 – share buttons in index.html
const idx = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
check('P3 share-tw in index.html',       idx.includes('id="share-tw"'));
check('P3 share-fb in index.html',       idx.includes('id="share-fb"'));
check('P3 share-copy in index.html',     idx.includes('id="share-copy"'));

// P5 – blog row
check('P5 detail-blog-row in index.html', idx.includes('id="detail-blog-row"'));

// P7 – app.js checks
const app = fs.readFileSync(path.join(dist, 'js/app.js'), 'utf8');
const noWidthHeight = !(/img\.width\s*=\s*160/.test(app)) && !(/img\.height\s*=\s*160/.test(app));
check('P7 card img.width/height NOT present (reverted)', noWidthHeight);
check('P7 aria-label on card',   app.includes("aria-label"));
check('P7 eager loading present', app.includes('"eager"'));
check('P7 __cardCount reset in showHome', app.includes('__cardCount'));

// P4 – screenshot in static game page JSON-LD
const gamePage = fs.readFileSync(path.join(dist, 'game/s/snakebird/index.html'), 'utf8');
const ldMatch = gamePage.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/);
if (ldMatch) {
  const ld = JSON.parse(ldMatch[1]);
  check('P4 screenshot ImageObject in JSON-LD', !!ld.screenshot && ld.screenshot['@type'] === 'ImageObject');
  check('P4 thumbnailUrl in JSON-LD',           !!ld.thumbnailUrl);
} else {
  check('P4 JSON-LD script found', false);
}

// P7 – _headers security + cache
const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
check('P7 X-Content-Type-Options header', headers.includes('X-Content-Type-Options'));
check('P7 Referrer-Policy header',        headers.includes('Referrer-Policy'));
check('P7 X-Frame-Options header',        headers.includes('X-Frame-Options'));
check('P7 7-day CSS/JS cache',            headers.includes('604800'));
check('P7 30-day immutable assets',       headers.includes('immutable'));
