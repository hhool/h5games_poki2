(function(){
  try{
    // If a <base href="..."> exists, prefer its pathname as deploy base
    const baseEl = document.querySelector('base[href]');
    const basePath = baseEl ? (new URL(baseEl.getAttribute('href'), location.href)).pathname : null;

    const segs = location.pathname.split('/').filter(Boolean);
    // If path has two or more segments (e.g. /repo/page.html), use first segment as inferred base
    const inferredBase = (segs.length >= 2) ? ('/' + segs[0]) : '';
    const siteBase = basePath || inferredBase || '';

    // normalise: ensure leading slash and no trailing slash (except root '')
    const normalizedBase = siteBase === '' ? '' : ('/' + siteBase.replace(/^\/+|\/+$/g, ''));

    const makeUrl = (path)=> {
      // path expected to start with '/'
      const p = path.replace(/^\/+/, '/');
      // join origin + normalizedBase + p, avoiding double slashes
      return location.origin + (normalizedBase || '') + p;
    };

    // Utility: should we skip rewriting this href?
    const shouldSkip = (h) => {
      if(!h) return true;
      if(h.startsWith('#')) return true; // anchor on same page
      if(h.startsWith('mailto:') || h.startsWith('tel:')) return true;
      if(h.startsWith('http:') || h.startsWith('https:') || h.startsWith('//')) return true;
      return false;
    };

    // rewrite exact root links to point to deployed root
    document.querySelectorAll('a[href="/"]').forEach(a=> a.href = makeUrl('/'));
    document.querySelectorAll('a[href="/index.html"]').forEach(a=> a.href = makeUrl('/index.html'));

    // rewrite other root-relative links (/privacy.html -> origin + base + /privacy.html)
    document.querySelectorAll('a[href^="/"]').forEach(a=>{
      const h = a.getAttribute('href');
      if(shouldSkip(h)) return;
      // keep '/','/index.html' handled above
      if(h === '/' || h === '/index.html') return;
      a.href = makeUrl(h);
    });
  }catch(e){
    console && console.warn && console.warn('fix-root-href error', e);
  }
})();
