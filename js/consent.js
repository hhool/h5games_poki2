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
  const accept = banner.querySelector('.consent-accept');
  const decline = banner.querySelector('.consent-decline');
  accept.addEventListener('click', ()=>{
    setConsent('granted');
    banner.remove();
    initAds();
  });
  decline.addEventListener('click', ()=>{
    setConsent('denied');
    banner.remove();
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
