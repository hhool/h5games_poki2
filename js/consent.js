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

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ensureConsent);
}else{
  ensureConsent();
}
