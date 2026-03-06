const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
(async () => {
  const url = process.argv[2] || 'http://localhost:8080/tag/puzzle/';
  const tag = (new URL(url, 'http://localhost')).pathname.split('/').filter(Boolean)[1] || 'puzzle';
  const outDir = path.join(__dirname, 'screenshots');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch(e){}

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 900 });
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // unregister service workers + clear caches
    await page.evaluate(async () => {
      try { if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) try { await r.unregister(); } catch(e){} } } catch(e){}
      try { if ('caches' in window) { const keys = await caches.keys(); for (const k of keys) try { await caches.delete(k); } catch(e){} } } catch(e){}
    });

    // reload to ensure fresh
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });

    const times = [0, 50, 200, 500, 1000, 2000];
    const results = [];
    for (const t of times) {
      await page.waitForTimeout(t === 0 ? 10 : t);
      const info = await page.evaluate(() => {
        const cssReady = document.documentElement.classList.contains('css-ready');
        const hasJs = document.documentElement.classList.contains('has-js');
        const intro = document.querySelector('.tag-intro');
        const noscripts = Array.from(document.querySelectorAll('noscript')).map(n => (n.innerHTML||'').slice(0,200));
        const introExists = !!intro;
        let introVisible = false;
        if (intro) {
          try { const s = getComputedStyle(intro); introVisible = s && s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity || '1') > 0; } catch(e){}
        }
        const bodyVisible = (function(){try{const s = getComputedStyle(document.body); return s && s.visibility !== 'hidden' && parseFloat(s.opacity || '1') > 0;}catch(e){return null}})();
        return { cssReady, hasJs, introExists, introVisible, noscriptsCount: noscripts.length, noscriptsSample: noscripts.slice(0,3), bodyVisible };
      });
      const shot = path.join(outDir, `${tag}_t${t}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      info.screenshot = `tools/screenshots/${tag}_t${t}.png`;
      info.time = t;
      results.push(info);
    }

    console.log(JSON.stringify({ url, results }, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.message);
    process.exitCode = 2;
  } finally {
    try { await browser.close(); } catch (e) {}
  }
})();
