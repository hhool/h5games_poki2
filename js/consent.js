const CONSENT_KEY = 'poki2_consent_v1';
const ADS_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6199549323873133';

function getConsent(){
  try{ return localStorage.getItem(CONSENT_KEY); }catch(e){return null}
}
function setConsent(v){
  try{ localStorage.setItem(CONSENT_KEY, v); }catch(e){}
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
  const banner = document.createElement('div');
  banner.id = 'consent-banner';
  banner.className = 'consent-banner';
  // Inject minimal inline CSS to guarantee styling in headless snapshots
  if(!document.getElementById('consent-inline-style')){
    const s = document.createElement('style');
    s.id = 'consent-inline-style';
    s.textContent = `
      .consent-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:1300;display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 8px 20px rgba(2,6,23,0.08);font-size:14px;color:#0b1220;max-width:1100px;margin:0 auto}
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
      document.body.classList.add('consent-visible');
    }catch(e){}
  };
  setHeight();
  window.addEventListener('resize', setHeight);
  const accept = banner.querySelector('.consent-accept');
  const decline = banner.querySelector('.consent-decline');
  accept.addEventListener('click', ()=>{
    setConsent('granted');
    banner.remove();
    // cleanup visual state then init ads
    document.body.classList.remove('consent-visible');
    document.documentElement.style.removeProperty('--consent-height');
    window.removeEventListener('resize', setHeight);
    initAds();
  });
  decline.addEventListener('click', ()=>{
    setConsent('denied');
    banner.remove();
    document.body.classList.remove('consent-visible');
    document.documentElement.style.removeProperty('--consent-height');
    window.removeEventListener('resize', setHeight);
  });
  // focus accept for keyboard users
  accept.focus();
}

function ensureConsent(){
  const status = getConsent();
  if(status === 'granted'){
    initAds();
    return;
  }
  // remove any accidental ad script tags left in templates
  removeExistingAdScripts();
  // show banner if not decided
  if(!status) createBanner();
  // setup observer to handle ad slot changes
  setupAdSlotMutationObserver();
}

// Expose API
window.poki2Consent = {
  status: getConsent(),
  grant(){ setConsent('granted'); initAds(); },
  deny(){ setConsent('denied'); }
};

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
