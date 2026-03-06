const puppeteer = require('puppeteer');
(async () => {
  const url = process.argv[2] || 'http://localhost:8080/tag/puzzle/?page=2';
  const browser = await puppeteer.launch({headless: true});
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
    const noscripts = await page.$$eval('noscript', nodes => nodes.map(n => n.innerHTML ? n.innerHTML.trim().slice(0,500) : ''));
    const hasFeaturedNoscript = noscripts.some(inner => inner && inner.indexOf('id="tag-featured-list"') >= 0);
    console.log(JSON.stringify({ url, noscriptCount: noscripts.length, hasFeaturedNoscript, sample: noscripts.slice(0,5) }, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.message);
    process.exitCode = 2;
  } finally {
    try { await browser.close(); } catch (e) {}
  }
})();
