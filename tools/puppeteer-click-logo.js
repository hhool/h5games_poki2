const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:9001//';
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
    } catch (e) { }
  });
  page.on('pageerror', err => {
    errors.push({type: 'pageerror', text: err && err.message ? err.message : String(err)});
    console.error('[pageerror]', err && err.message ? err.message : err);
  });

  try {
    console.log('Visiting', url);
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 30000});
    // Wait a moment for scripts to initialize
    await page.waitForTimeout(500);

    // Click the top-left logo (simulates user navigating home)
    const sel = '.topbar-logo, .sidebar-logo, a[href="/"]';
    try {
      await page.click(sel);
      console.log('Clicked logo selector:', sel);
    } catch (e) {
      console.warn('Could not click logo selector (not found or not clickable)');
    }

    // Allow time for any navigation/replaceState to run
    await page.waitForTimeout(1200);
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
