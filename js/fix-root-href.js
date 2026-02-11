(function(){
  try{
    const segs = location.pathname.split('/').filter(Boolean);
    // If path has two or more segments (e.g. /repo/page.html or /org/repo/page), use first segment as base
    const siteBase = (segs.length >= 2) ? ('/' + segs[0]) : '';
    const rootHref = location.origin + (siteBase || '') + '/index.html';

    // rewrite exact root links
    document.querySelectorAll('a[href="/"]').forEach(a=> a.href = rootHref);
    document.querySelectorAll('a[href="/index.html"]').forEach(a=> a.href = rootHref);

    // rewrite other root-relative links (/privacy.html -> origin + base + /privacy.html)
    document.querySelectorAll('a[href^="/"]').forEach(a=>{
      const h = a.getAttribute('href');
      if(h === '/' || h === '/index.html') return;
      // keep protocol-relative or absolute URLs unchanged
      if(h.startsWith('http:') || h.startsWith('https:') || h.startsWith('//')) return;
      a.href = location.origin + (siteBase || '') + h;
    });
  }catch(e){
    console && console.warn && console.warn('fix-root-href error', e);
  }
})();
