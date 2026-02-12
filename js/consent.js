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
  // Inject Google ads script
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
  box.innerHTML = `<div class="ad-placeholder-inner">Advertisement</div>`;
  // allow quick accept button inside placeholder
  const btn = document.createElement('button');
  btn.className = 'ad-placeholder-accept';
  btn.textContent = 'Accept ads';
  btn.addEventListener('click', ()=>{
    // grant consent and render real ad
    setConsent('granted');
    initAds();
    renderAdSlotElement(container, opts);
  });
  box.appendChild(btn);
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
    return;
  }
  if(status === 'denied'){
    renderAdFallback(container, opts);
    return;
  }
  // undecided
  renderAdPlaceholder(container, opts);
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
      style: 'display:block;width:100%;height:auto;'
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
