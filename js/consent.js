const CONSENT_KEY = 'poki2_consent_v1';
const ADS_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6199549323873133';

function getConsent(){
  try{ return localStorage.getItem(CONSENT_KEY); }catch(e){return null}
}
function setConsent(v){
  try{ localStorage.setItem(CONSENT_KEY, v); }catch(e){}
  try{
    window.poki2Consent = window.poki2Consent || {};
    window.poki2Consent.status = v;
  }catch(e){}
  try{
    if(v === 'granted'){
      try{ initAds(); }catch(e){}
      try{ document.dispatchEvent(new CustomEvent('poki2:consent-granted')); }catch(e){}
    }else if(v === 'denied'){
      try{ document.dispatchEvent(new CustomEvent('poki2:consent-denied')); }catch(e){}
    }
  }catch(e){}
}

function removeExistingAdScripts(){
  document.querySelectorAll('script').forEach(s=>{
    try{
      if(s.src && s.src.indexOf('pagead2.googlesyndication.com') !== -1){
        s.remove();
      }
    }catch(e){}
  });
}

function initAds(){
  if(window._poki2_ads_inited) return;
  window._poki2_ads_inited = true;
  // In local/dev environments we don't want to load Google ad scripts
  // (they often fail with 400 on localhost). Use a harmless mock so
  // calls to (adsbygoogle = []).push() are no-ops during development.
  const host = (typeof location !== 'undefined' && location.hostname) ? location.hostname : '';
  const isLocalDev = host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
  if(isLocalDev){
    window.adsbygoogle = window.adsbygoogle || [];
    // ensure a push() exists so renderAdSlotElement calls are safe
    if(typeof window.adsbygoogle.push !== 'function'){
      window.adsbygoogle.push = function(){ /* noop for local testing */ };
    }
    // nothing to inject for local dev
    console.info('poki2Consent: running in local dev mode — skipping Google ads script');
    return;
  }

  // Inject Google ads script for production-like environments
  const s = document.createElement('script');
  s.src = ADS_SRC;
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.onload = ()=>{
    // Attempt to render any existing ad placeholders
    try{
      (window.adsbygoogle = window.adsbygoogle || []).forEach(()=>{});
    }catch(e){}
    document.querySelectorAll('ins.adsbygoogle').forEach(el=>{
      try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){}
    });
  };
  document.head.appendChild(s);
}

function ensureAdsLoaded(){
  return new Promise((resolve)=>{
    if(window._poki2_ads_inited && window.adsbygoogle){
      return resolve();
    }
    const check = ()=>{
      if(window._poki2_ads_inited && window.adsbygoogle){
        resolve();
      }else{
        setTimeout(check, 80);
      }
    };
    // ensure script injected
    initAds();
    check();
  });
}

function renderAdFallback(container, opts){
  container.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'ad-fallback';

  // Priority: explicit fallbackHTML > fallbackImage > fallbackEndpoint(fetch) > default message
  if(opts && opts.fallbackHTML){
    box.innerHTML = opts.fallbackHTML;
    container.appendChild(box);
    return;
  }

  if(opts && opts.fallbackImage){
    const a = document.createElement('a');
    a.href = opts.fallbackLink || '#';
    a.rel = 'noopener noreferrer';
    const img = document.createElement('img');
    img.src = opts.fallbackImage;
    img.alt = opts.fallbackAlt || 'Sponsored content';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    a.appendChild(img);
    box.appendChild(a);
    container.appendChild(box);
    return;
  }

  if(opts && opts.fallbackEndpoint){
    // fetch server-provided non-personalized ad HTML (with timeout)
    const timeout = opts.fetchTimeout || 2500;
    let done = false;
    const timer = setTimeout(()=>{
      if(done) return;
      done = true;
      box.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted)">Ads are disabled</div>';
      container.appendChild(box);
    }, timeout);

    fetch(opts.fallbackEndpoint, {credentials: 'omit', mode: 'cors'})
      .then(r=> r.ok ? r.text() : Promise.reject(new Error('bad status')))
      .then(html=>{
        if(done) return;
        done = true;
        clearTimeout(timer);
        box.innerHTML = html || '<div style="padding:12px;text-align:center;color:var(--text-muted)">Ads are disabled</div>';
        container.appendChild(box);
      }).catch(()=>{
        if(done) return;
        done = true;
        clearTimeout(timer);
        box.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted)">Ads are disabled</div>';
        container.appendChild(box);
      });
    return;
  }

  box.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted)">Ads are disabled</div>';
  container.appendChild(box);
}

function renderAdPlaceholder(container, opts){
  container.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'ad-placeholder';
  // ensure placeholder takes reasonable space but avoid large fixed heights
  // allow per-slot override via opts.minHeight (or data-min-height attribute)
  box.style.width = '100%';
  if(opts && opts.minHeight){
    box.style.minHeight = opts.minHeight;
  }else{
    // default to no forced min-height so CSS can collapse empty placeholders
    box.style.minHeight = '0';
  }
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Advertisement placeholder');
  // Render a visually-empty placeholder block so the layout reserves space
  // but no text is shown. Screen readers should ignore this region.
  box.innerHTML = `<div class="ad-placeholder-inner" aria-hidden="true"></div>`;
  box.setAttribute('aria-hidden', 'true');
  container.appendChild(box);
}

function renderAdSlotElement(container, opts){
  container.innerHTML = '';
  // create ins.adsbygoogle
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  if(opts['data-ad-client']) ins.setAttribute('data-ad-client', opts['data-ad-client']);
  if(opts['data-ad-slot']) ins.setAttribute('data-ad-slot', opts['data-ad-slot']);
  if(opts['data-ad-format']) ins.setAttribute('data-ad-format', opts['data-ad-format']);
  if(opts['style']) ins.setAttribute('style', opts['style']);
  container.appendChild(ins);
  try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){ }
}

// Collapse any ad-slot that appears oversized but contains no meaningful ad content
function collapseEmptyAdSlot(container){
  try{
    // give ad scripts multiple chances to populate
    const checkAndCollapse = ()=>{
      if(!container || !(container instanceof Element)) return;
      const h = container.offsetHeight || 0;
      const hasMedia = !!container.querySelector('iframe, img, video');
      const text = (container.textContent||'').trim();
      if(container.classList.contains('ad-collapsed')) return;
      // Collapse if very tall and no media, or has ins but no media and moderate height
      if(h > 300 || (h > 100 && !hasMedia && text.length === 0)){
        console.log('Collapsing ad slot, height:', h, 'hasMedia:', hasMedia);
        // Also force hide any ins.adsbygoogle if no media
        const ins = container.querySelector('ins.adsbygoogle');
        if(ins && !hasMedia){
          ins.style.display = 'none';
          ins.style.height = '0';
          ins.style.minHeight = '0';
        }
        container.style.transition = 'height .2s, opacity .2s';
        container.style.opacity = '0';
        container.style.height = '6px';
        container.style.minHeight = '6px';
        container.style.padding = '0';
        container.style.margin = '0';
        container.style.overflow = 'hidden';
        container.classList.add('ad-collapsed');
        setTimeout(()=>{ container.style.display = 'none'; }, 240);
      }
    };
    setTimeout(checkAndCollapse, 500);
    setTimeout(checkAndCollapse, 1500); // check again later
  }catch(e){}
}

// Watch for DOM changes (ad scripts or other third-party code) and
// re-run collapseEmptyAdSlot on affected ad-slot elements.
function setupAdSlotMutationObserver(){
  if(window._poki2_ad_observer_setup) return;
  window._poki2_ad_observer_setup = true;

  const scheduled = new WeakMap();
  const scheduleCollapse = (el)=>{
    if(!el) return;
    if(scheduled.has(el)) clearTimeout(scheduled.get(el));
    const t = setTimeout(()=>{
      try{ collapseEmptyAdSlot(el); }catch(e){}
      scheduled.delete(el);
    }, 180);
    scheduled.set(el, t);
  };

  const obs = new MutationObserver((mutations)=>{
    try{
      for(const m of mutations){
        // if nodes are added/removed, try to find any ad-slot parents
        if(m.addedNodes && m.addedNodes.length){
          m.addedNodes.forEach(n=>{
            if(n && n.nodeType===1){
              const s = n.classList && n.classList.contains('ad-slot') ? n : n.closest && n.closest('.ad-slot');
              if(s) scheduleCollapse(s);
            }
          });
        }
        // attribute changes on elements (style/class) may affect layout
        const tgt = m.target && (m.target.nodeType===1 ? m.target : null);
        if(tgt){
          const slot = tgt.classList && tgt.classList.contains('ad-slot') ? tgt : tgt.closest && tgt.closest('.ad-slot');
          if(slot) scheduleCollapse(slot);
        }
      }
    }catch(e){}
  });

  try{
    obs.observe(document.documentElement || document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['style','class']});
  }catch(e){
    try{ obs.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['style','class']}); }catch(e){}
  }

  // initial pass for existing slots
  setTimeout(()=>{
    try{ document.querySelectorAll('.ad-slot').forEach(el=> collapseEmptyAdSlot(el)); }catch(e){}
  }, 350);
}

/**
 * Public helper to render an ad slot controlled by consent
 * selector: element selector or element
 * opts: {data-ad-client, data-ad-slot, data-ad-format, fallbackHTML}
 */
function renderAdSlot(selector, opts){
  const container = (typeof selector === 'string') ? document.querySelector(selector) : selector;
  if(!container) return;
  const status = getConsent();
  if(status === 'granted'){
    ensureAdsLoaded().then(()=> renderAdSlotElement(container, opts));
    // allow ad script to run then collapse if it left an empty large container
    collapseEmptyAdSlot(container);
    return;
  }
  if(status === 'denied'){
    renderAdFallback(container, opts);
    collapseEmptyAdSlot(container);
    return;
  }
  // undecided
  renderAdPlaceholder(container, opts);
  collapseEmptyAdSlot(container);
}

function createBanner(){
  // If document.body isn't available yet (rare in snapshots/headless),
  // defer banner creation until DOMContentLoaded so it will be appended
  // inside the document body (prevents insertion outside <body/>).
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => {
      try{ if (!document.getElementById('consent-banner')) createBanner(); }catch(e){}
    }, { once: true });
    return;
  }

  // If an element with id exists, ensure it's in the body and wired; avoid creating duplicate
  const _existingBanner = document.getElementById('consent-banner');
  if (_existingBanner) {
    // If it's already inside the body, nothing to do
    try{
      if (document.body && document.body.contains(_existingBanner)) return;
      // If the element exists in the DOM but was rendered outside <body> (exported snapshot),
      // move it into <body> and attach runtime behavior instead of creating a new one.
      if (document.body) {
        document.body.appendChild(_existingBanner);
        try{ attachExistingBanner(_existingBanner); }catch(e){}
      }
    }catch(e){}
    return;
  }
  const banner = document.createElement('div');
  banner.id = 'consent-banner';
  banner.className = 'consent-banner';
  // Inject minimal inline CSS to guarantee styling in headless snapshots
  if(!document.getElementById('consent-inline-style')){
    const s = document.createElement('style');
    s.id = 'consent-inline-style';
    s.textContent = `
      /* Inline consent styles: hidden by default, revealed when body.consent-ready is present */
      /* Raised z-index so banner sits above the game overlay (z-index 1400) */
      .consent-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:1600;display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 8px 20px rgba(2,6,23,0.08);font-size:14px;color:#0b1220;max-width:1100px;margin:0 auto;opacity:0;visibility:hidden;transform:translateY(8px);transition:opacity .25s,transform .25s,visibility .25s}
      body.consent-ready .consent-banner{opacity:1;visibility:visible;transform:none}
      .consent-banner .consent-actions{display:flex;gap:8px;margin-left:12px}
      .consent-accept{background:#1f6feb;color:#fff;padding:8px 12px;border-radius:8px;border:0}
      .consent-decline{background:transparent;color:#0b1220;padding:8px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)}
    `;
    document.head.appendChild(s);
  }
  banner.innerHTML = `
    <div class="consent-body">
      <p><strong>Poki2 uses ads</strong> — we display advertising to support the site. By clicking "Accept" you consent to loading advertising scripts and personalized ads. You can read more in our <a href="/privacy.html">Privacy Policy</a>.</p>
    </div>
    <div class="consent-actions">
      <button class="consent-decline">Decline</button>
      <button class="consent-accept">Accept</button>
    </div>
  `.trim();

  document.body.appendChild(banner);
  // expose height to CSS and prevent footer overlap
    const setHeight = ()=>{
    try{
      const h = banner.offsetHeight;
      document.documentElement.style.setProperty('--consent-height', h + 'px');
      // Add both classes to match CSS in different build outputs
      document.body.classList.add('consent-visible', 'consent-ready');
    }catch(e){}
  };
  setHeight();
  window.addEventListener('resize', setHeight);
  const accept = banner.querySelector('.consent-accept');
  const decline = banner.querySelector('.consent-decline');
  // Ensure the banner sits above other overlays (game overlay z-index = 1400)
  try{ banner.style.zIndex = '1600'; banner.style.position = 'fixed'; }catch(e){}
    accept.addEventListener('click', ()=>{
    setConsent('granted');
    banner.remove();
    // cleanup visual state then init ads
      document.body.classList.remove('consent-visible','consent-ready');
    document.documentElement.style.removeProperty('--consent-height');
    window.removeEventListener('resize', setHeight);
    initAds();
      try{ window.poki2Consent.status = 'granted'; }catch(e){}
      try{ document.dispatchEvent(new CustomEvent('poki2:consent-granted')); }catch(e){}
  });
  decline.addEventListener('click', ()=>{
    setConsent('denied');
    banner.remove();
      document.body.classList.remove('consent-visible','consent-ready');
    document.documentElement.style.removeProperty('--consent-height');
    window.removeEventListener('resize', setHeight);
      try{ window.poki2Consent.status = 'denied'; }catch(e){}
      try{ document.dispatchEvent(new CustomEvent('poki2:consent-denied')); }catch(e){}
  });
  // focus accept for keyboard users
  accept.focus();
}

// If the page already contains a static `#consent-banner` (exported snapshot),
// attach runtime behavior (listeners, sizing) so the buttons work and the
// visual state is consistent with the dynamic banner created by createBanner().
function attachExistingBanner(banner){
  if(!banner) return;
  try{
    // ensure inline style exists for consistent visuals (createBanner would do this)
    if(!document.getElementById('consent-inline-style')){
      const s = document.createElement('style');
      s.id = 'consent-inline-style';
      s.textContent = `
        /* Raised z-index so banner sits above the game overlay (z-index 1400) */
        .consent-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:1600;display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 8px 20px rgba(2,6,23,0.08);font-size:14px;color:#0b1220;max-width:1100px;margin:0 auto;}
        .consent-banner .consent-actions{display:flex;gap:8px;margin-left:12px}
        .consent-accept{background:#1f6feb;color:#fff;padding:8px 12px;border-radius:8px;border:0}
        .consent-decline{background:transparent;color:#0b1220;padding:8px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)}
      `;
      try{ document.head.appendChild(s); }catch(e){}
    }

    const setHeight = ()=>{
      try{
        const h = banner.offsetHeight || 0;
        document.documentElement.style.setProperty('--consent-height', h + 'px');
        document.body.classList.add('consent-visible','consent-ready');
      }catch(e){}
    };
    setHeight();
    window.addEventListener('resize', setHeight);

    const accept = banner.querySelector('.consent-accept');
    const decline = banner.querySelector('.consent-decline');

    const cleanup = ()=>{
      try{
        document.body.classList.remove('consent-visible','consent-ready');
        document.documentElement.style.removeProperty('--consent-height');
        window.removeEventListener('resize', setHeight);
      }catch(e){}
    };

    if(accept){
      accept.addEventListener('click', ()=>{
        try{ setConsent('granted'); }catch(e){}
        try{ banner.remove(); }catch(e){}
        cleanup();
        try{ initAds(); }catch(e){}
        try{ window.poki2Consent.status = 'granted'; }catch(e){}
        try{ document.dispatchEvent(new CustomEvent('poki2:consent-granted')); }catch(e){}
      });
    }
    if(decline){
      decline.addEventListener('click', ()=>{
        try{ setConsent('denied'); }catch(e){}
        try{ banner.remove(); }catch(e){}
        cleanup();
        try{ window.poki2Consent.status = 'denied'; }catch(e){}
        try{ document.dispatchEvent(new CustomEvent('poki2:consent-denied')); }catch(e){}
      });
    }
    // focus accept for keyboard users
    try{ if(accept && typeof accept.focus === 'function') accept.focus(); }catch(e){}
  }catch(e){}
}

// Fallback delegated click handler: ensures Accept/Decline work even if
// individual buttons are not wired (e.g. due to script ordering or DOM swaps).
(function ensureConsentDelegation(){
  if(window._poki2_consent_delegation) return;
  window._poki2_consent_delegation = true;
  document.addEventListener('click', function(ev){
    try{
      const a = ev.target && ev.target.closest && ev.target.closest('.consent-accept');
      const d = ev.target && ev.target.closest && ev.target.closest('.consent-decline');
      if(a){
        try{ setConsent('granted'); }catch(e){}
        const b = document.getElementById('consent-banner'); if(b) try{ b.remove(); }catch(e){}
        try{ document.body.classList.remove('consent-visible','consent-ready'); }catch(e){}
        try{ document.documentElement.style.removeProperty('--consent-height'); }catch(e){}
        try{ initAds(); }catch(e){}
        try{ window.poki2Consent.status = 'granted'; }catch(e){}
        try{ document.dispatchEvent(new CustomEvent('poki2:consent-granted')); }catch(e){}
        ev.stopPropagation(); ev.preventDefault();
      } else if(d){
        try{ setConsent('denied'); }catch(e){}
        const b = document.getElementById('consent-banner'); if(b) try{ b.remove(); }catch(e){}
        try{ document.body.classList.remove('consent-visible','consent-ready'); }catch(e){}
        try{ document.documentElement.style.removeProperty('--consent-height'); }catch(e){}
        try{ window.poki2Consent.status = 'denied'; }catch(e){}
        try{ document.dispatchEvent(new CustomEvent('poki2:consent-denied')); }catch(e){}
        ev.stopPropagation(); ev.preventDefault();
      }
    }catch(e){}
  }, true);
})();

function ensureConsent(){
  const status = getConsent();
  if(status === 'granted'){
    initAds();
    return;
  }
  // remove any accidental ad script tags left in templates
  removeExistingAdScripts();
  // show banner if not decided
  if(!status){
    // Defer banner creation until after the page `load` event and an idle window
    // so it won't be selected as the Largest Contentful Paint (LCP).
    const scheduleCreate = ()=>{
      const show = ()=>{
        try{ createBanner(); }catch(e){ createBanner(); }
      };
      if('requestIdleCallback' in window){
        requestIdleCallback(show, {timeout: 1500});
      }else{
        // fallback: slight delay after load to avoid racing with initial paint
        setTimeout(show, 1200);
      }
    };

    // If a static banner already exists in the HTML (exported snapshot),
    // wire it up immediately so the buttons are responsive instead of
    // creating a duplicate banner. Otherwise schedule a dynamic banner.
    const existing = document.getElementById('consent-banner');
    if(existing){
      if(document.readyState === 'complete' || document.body){
        attachExistingBanner(existing);
      }else{
        document.addEventListener('DOMContentLoaded', ()=> attachExistingBanner(document.getElementById('consent-banner')),{once:true});
      }
    }else{
      if(document.readyState === 'complete'){
        scheduleCreate();
      }else{
        window.addEventListener('load', scheduleCreate, {once: true});
      }
    }
  }
  // setup observer to handle ad slot changes
  setupAdSlotMutationObserver();
}

// Ensure site footer is inside document.body. Some exported snapshots
// or headless renderers may place the footer outside <body>; fix that
// early so layout scripts and measurements behave consistently.
(function ensureFooterInBody(){
  try{
    const fix = ()=>{
      try{
        const footer = document.querySelector('footer.site-footer');
        if(footer && document.body && !document.body.contains(footer)){
          document.body.appendChild(footer);
        }
      }catch(e){}
    };
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', fix, {once:true});
    }else{
      fix();
    }
  }catch(e){}
})();

// Expose API
window.poki2Consent = {
  status: getConsent(),
  grant(){ setConsent('granted'); initAds(); },
  deny(){ setConsent('denied'); }
};

// On startup remove any static banner if consent already stored so the UI
// doesn't reappear on subsequent visits. Also ensure stored consent triggers
// ad initialization when appropriate.
(function enforceStoredConsent(){
  try{
    const status = getConsent();
    if(status === 'granted'){
      try{ initAds(); }catch(e){}
    }
    const cleanup = ()=>{
      try{
        const b = document.getElementById('consent-banner');
        if(b && (status === 'granted' || status === 'denied')){
          try{ b.remove(); }catch(e){}
        }
        if(status){
          try{ document.body.classList.remove('consent-visible','consent-ready'); }catch(e){}
          try{ document.documentElement.style.removeProperty('--consent-height'); }catch(e){}
        }
        try{ window.poki2Consent = window.poki2Consent || {}; window.poki2Consent.status = status; }catch(e){}
      }catch(e){}
    };
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', cleanup, {once:true});
    }else{
      cleanup();
    }
  }catch(e){}
})();

// Expose ad-slot helper
window.poki2RenderAd = {
  render(selectorOrEl){
    const el = (typeof selectorOrEl === 'string') ? document.querySelector(selectorOrEl) : selectorOrEl;
    if(!el) return;
    const opts = {
      'data-ad-client': el.getAttribute('data-ad-client'),
      'data-ad-slot': el.getAttribute('data-ad-slot'),
      'data-ad-format': el.getAttribute('data-ad-format') || 'auto',
      style: 'display:block;width:100%;height:auto;',
      // enhanced fallback config
      fallbackHTML: el.getAttribute('data-fallback-html') || null,
      fallbackImage: el.getAttribute('data-fallback-image') || null,
      fallbackLink: el.getAttribute('data-fallback-link') || null,
      fallbackAlt: el.getAttribute('data-fallback-alt') || null,
      fallbackEndpoint: el.getAttribute('data-fallback-endpoint') || null,
      fetchTimeout: el.getAttribute('data-fallback-timeout') ? parseInt(el.getAttribute('data-fallback-timeout'),10) : undefined
    };
    renderAdSlot(el, opts);
  }
};

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ensureConsent);
}else{
  ensureConsent();
}
