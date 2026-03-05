const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'https://poki2.online/';
  const browser = await puppeteer.launch({args: ['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    try {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || /Failed to execute 'replaceState'/.test(text) || /SecurityError/.test(text)) {
        errors.push({type, text});
      }
      console.log('[console]', type, text);
    } catch (e) {}
  });
  page.on('pageerror', err => {
    errors.push({type: 'pageerror', text: err && err.message ? err.message : String(err)});
    console.error('[pageerror]', err && err.message ? err.message : err);
  });

  try {
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 30000});
    await page.waitForTimeout(1000);
  } catch (e) {
    console.error('Navigation error', e && e.message ? e.message : e);
  }

  if (errors.length === 0) {
    console.log('No console errors detected');
    await browser.close();
    process.exit(0);
  }

  console.log('Detected console errors:', errors);
  await browser.close();
  process.exit(2);
})();
