const puppeteer = require('puppeteer');
(async () => {
  const url = process.argv[2] || 'http://localhost:8080/tag/puzzle/';
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Unregister service workers and clear caches
    await page.evaluate(async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) try { await r.unregister(); } catch (e) {}
        }
      } catch (e) {}
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          for (const k of keys) try { await caches.delete(k); } catch (e) {}
        }
      } catch (e) {}
    });
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(500);
    const intro = await page.$eval('body', b => {
      const el = b.querySelector('.tag-intro');
      if (!el) return { exists: false };
      return { exists: true, html: el.outerHTML.slice(0, 800) };
    }).catch(() => ({ exists: false }));
    console.log(JSON.stringify({ url, tagIntro: intro }, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.message);
    process.exitCode = 2;
  } finally {
    try { await browser.close(); } catch (e) {}
  }
})();
