const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:8080/tag/puzzle/?page=2';
  console.log('Opening', url);
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for pagination nav or game grid to appear
    await page.waitForSelector('#game-sections', { timeout: 15000 });
    // wait for pagination or at least one game card to render
    await page.waitForFunction(() => {
      return document.querySelector('.pagination-nav') || document.querySelector('.game-card');
    }, { timeout: 15000 });

    // Extract pagination info and rendered game cards, then compare with noscript list
    const result = await page.evaluate(() => {
      const pag = document.querySelector('.pagination-nav');
      const paginationText = pag ? pag.innerText.trim() : null;
      const pageCurrent = pag ? (pag.querySelector('.page-num.active') ? pag.querySelector('.page-num.active').innerText : null) : null;
      const pageNums = pag ? Array.from(pag.querySelectorAll('.page-num')).map(n => n.innerText) : [];
      const renderedLinks = Array.from(document.querySelectorAll('.game-card')).map(el => {
        const link = el.dataset.link || el.getAttribute('data-link') || el.getAttribute('data-href') || '';
        try {
          const u = new URL(link, location.origin);
          const parts = u.pathname.replace(/\/+$/,'').split('/');
          const slug = parts.pop() || '';
          const char = slug ? slug[0] : '';
          return `/game/${char}/${slug}/`;
        } catch (e) { return link; }
      });
      const cardCount = renderedLinks.length;
      const intro = document.querySelector('.tag-intro-count');
      const introText = intro ? intro.innerText : null;

      // Parse noscript content (static full list) to get canonical ordering
      let nsLinks = [];
      try {
        const nosList = Array.from(document.querySelectorAll('noscript'));
        const dp = new DOMParser();
        for (const nos of nosList) {
          const html = nos.innerHTML || nos.textContent || '';
          if (!html || html.indexOf('/game/') === -1) continue;
          const doc = dp.parseFromString(html, 'text/html');
          nsLinks = Array.from(doc.querySelectorAll('ul li a[href^="/game/"]')).map(a => a.getAttribute('href'));
          if (nsLinks.length) break;
        }
      } catch (e) { nsLinks = []; }

      // Determine expected slice for page 2 (0-based): pageSize = 24
      const PAGE_SIZE = 24;
      const expectedPage = nsLinks.slice(PAGE_SIZE, PAGE_SIZE * 2);
      const missing = expectedPage.filter(h => !renderedLinks.includes(h));

      const sectionsHtml = document.getElementById('game-sections') ? document.getElementById('game-sections').outerHTML.slice(0,2000) : null;
      return { paginationText, pageCurrent, pageNums, cardCount, introText, expectedPage, renderedLinks, missing, sectionsHtml };
    });

    console.log('Result:', JSON.stringify(result, null, 2));
      // Also compute which games from the raw manifest are considered visible by the app's canShow logic
      const visibility = await page.evaluate(() => {
        const raw = window.__RAW_GAMES || [];
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (('ontouchstart' in window) && window.innerWidth <= 1024);
        function canShowLocal(g) {
          if (g.show === undefined || g.show === null || g.show === false) return false;
          if (g.avalid === undefined || g.avalid === null) return false;
          if (Array.isArray(g.avalid)) return g.avalid.includes(isMobile ? 'mobile' : 'desktop');
          if (isMobile) {
            const input = g.input || ['keyboard'];
            return input.includes('touch');
          }
          return true;
        }
        const allVisible = raw.filter(canShowLocal).map(g => ({ title: g.title, link: g.link, tags: g.tags }));
        // list visible puzzle-tagged games
        const visiblePuzzle = allVisible.filter(g => Array.isArray(g.tags) && g.tags.includes('puzzle'));
        // return the titles and links for inspection
        return { visibleCount: visiblePuzzle.length, visiblePuzzle };
      });

      console.log('Visibility check:', JSON.stringify(visibility, null, 2));
        // Determine runtime positions (index/page) for expected slugs
        const positions = await page.evaluate(() => {
          const raw = window.__RAW_GAMES || [];
          const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (('ontouchstart' in window) && window.innerWidth <= 1024);
          function canShowLocal(g) {
            if (g.show === undefined || g.show === null || g.show === false) return false;
            if (g.avalid === undefined || g.avalid === null) return false;
            if (Array.isArray(g.avalid)) return g.avalid.includes(isMobile ? 'mobile' : 'desktop');
            if (isMobile) {
              const input = g.input || ['keyboard'];
              return input.includes('touch');
            }
            return true;
          }
          const visible = raw.filter(canShowLocal).filter(g => Array.isArray(g.tags) && g.tags.includes('puzzle'));
          const slugs = visible.map(g => (g.link || '').replace(/\/$/, '').split('/').pop());
          const nosList = Array.from(document.querySelectorAll('noscript'));
          let nsLinks = [];
          for (const nos of nosList) {
            const html = nos.innerHTML || nos.textContent || '';
            if (!html || html.indexOf('/game/') === -1) continue;
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('ul li a[href^="/game/"]')).map(a => a.getAttribute('href'));
            if (links.length) { nsLinks = links; break; }
          }
          const PAGE_SIZE = 24;
          const expectedPage = nsLinks.slice(PAGE_SIZE, PAGE_SIZE * 2).map(h => h.replace(/\/game\//,'').replace(/\/$/,'').split('/').pop());
          const map = {};
          expectedPage.forEach(slug => {
            const idx = slugs.indexOf(slug);
            map[slug] = { index: idx, page: idx >= 0 ? Math.floor(idx / PAGE_SIZE) + 1 : null };
          });
          const nsOnly = nsLinks.map(h => h.replace(/\/game\//,'').replace(/\/$/,'').split('/').pop()).filter(s => !slugs.includes(s));
          return { slugs, expectedPage, map, nsOnly };
          return { slugs, expectedPage, map };
        });

        console.log('Runtime positions:', JSON.stringify(positions, null, 2));
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('Test failed:', e && e.message ? e.message : e);
    try { await browser.close(); } catch (e) {}
    process.exit(2);
  }
})();
