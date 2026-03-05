const puppeteer = require('puppeteer');

async function run() {
  const url = process.argv[2] || 'https://poki2.online/games/2048/';
  console.log('Visiting', url);

  const browser = await puppeteer.launch({args: ['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();

  try {
    await page.setViewport({width: 1280, height: 800});
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 30000});

    // Wait for any iframe to appear (game iframe) — tolerant selector
    const iframeHandle = await page.waitForSelector('iframe', {timeout: 15000});
    if (!iframeHandle) {
      console.error('No iframe found on the page.');
      await browser.close();
      process.exit(2);
    }

    const src = await page.$eval('iframe', el => el.src || el.getAttribute('src') || '');
    console.log('Found iframe src:', src || '(empty)');

    // Optionally check overlay/modal presence (best-effort)
    const overlayExists = await page.evaluate(() => {
      const selectors = ['#game-overlay', '.game-overlay', '#game-modal', '.game-modal', '#game-wrap', '.game-wrap'];
      return selectors.some(s => !!document.querySelector(s));
    });
    console.log('Overlay-like element present:', overlayExists);

    // Try to ensure iframe has started loading by checking its contentFrame() if same-origin
    const frames = page.frames();
    const found = frames.find(f => f.url() && f.url() !== 'about:blank');
    console.log('Number of frames on page:', frames.length, 'first non-blank frame url:', found ? found.url() : '(none)');

    await browser.close();
    console.log('TEST PASSED');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err && err.message ? err.message : err);
    try { await browser.close(); } catch(e) {}
    process.exit(3);
  }
}

run();
