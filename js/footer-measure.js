// Measure the footer and expose CSS variables so static pages reserve space
(function () {
  function setFooterVars() {
    try {
      const footer = document.querySelector('.site-footer');
      if (!footer) return;
      const body = document.body || document.documentElement;
      // If this is an informational page (about/privacy/terms/contact/dmca or
      // the legacy `static-page`) and we don't have a persisted index height,
      // do not overwrite the CSS default `--measured-footer` here. This keeps
      // informational pages visually identical to the index on first paint.
      let indexPref = null; try{ indexPref = localStorage.getItem('pokiFooterIndexHeight'); }catch(e){}
      const h = Math.max(0, footer.offsetHeight || 0);
      const isInfoPage = body && body.classList && (
        body.classList.contains('static-page') ||
        body.classList.contains('about-page') ||
        body.classList.contains('privacy-page') ||
        body.classList.contains('terms-page') ||
        body.classList.contains('contact-page') ||
        body.classList.contains('dmca-page')
      );
      // If informational page and there's no stored index measurement, skip writing vars
      if (isInfoPage && !indexPref) {
        return;
      }
      const measured = h + 'px';
      try { document.documentElement.style.setProperty('--measured-footer', measured); } catch (e) {}
      try { document.documentElement.style.setProperty('--footer-h', 'calc(' + measured + ' + env(safe-area-inset-bottom, 0px))'); } catch (e) {}
      // NOTE: do NOT write inline padding to content/body here — rely on
      // CSS vars (`--measured-footer` / `--footer-h`) and page-level spacer when
      // needed. Writing `style.paddingBottom` can create layout feedback loops
      // (especially on mobile) and was removed for stability.
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(setFooterVars, 30);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(setFooterVars, 30));
  }
  // Small helper to detect Android browsers where measurements are flaky
  const _isAndroid = function() { try { return /android/i.test(navigator.userAgent || ''); } catch (e) { return false; } };

  // If this is a static informational page and the index has previously
  // stored a footer height, apply it immediately so static pages match
  // the index footer sizing on first paint. On Android browsers, which
  // sometimes produce very small transient measurements, prefer a
  // conservative canonical fallback so informational pages render like
  // the index on first paint.
  function applyIndexHeightToStatic(){
    try{
      const body = document.body || document.documentElement;
      const isInfo = body && body.classList && (
        body.classList.contains('static-page') ||
        body.classList.contains('about-page') ||
        body.classList.contains('privacy-page') ||
        body.classList.contains('terms-page') ||
        body.classList.contains('contact-page') ||
        body.classList.contains('dmca-page')
      );
      if (!isInfo) return;
      let idx = null; try{ idx = localStorage.getItem('pokiFooterIndexHeight'); }catch(e){}
      // If there's no stored index measurement and we're NOT on Android,
      // bail out early to let CSS provide the fallback. On Android, prefer
      // a conservative canonical value even if nothing is stored because
      // measurements there are often unreliable on first paint.
      const CAP_INDEX_PX = 114;
      const MIN_ACCEPTABLE = 90;
      if (!idx && !_isAndroid()) return;
      // Cap applied index height to a sensible default used by the index UI
      // (375px width device measured value = 114px). This avoids older
      // saved values (e.g. 122px) from making informational pages taller
      // than the index while still allowing JS to correct later if needed.
      let px = parseInt(idx,10) || 0;
      // If there's no stored value but we're on Android, use the cap.
      if (!px && _isAndroid()) px = CAP_INDEX_PX;
      // If the stored index height is clearly too small (likely from a
      // transient measurement), remove it and fall back to the canonical
      // index size so informational pages render like the index on first paint.
      if (px < MIN_ACCEPTABLE) {
        try{ localStorage.removeItem('pokiFooterIndexHeight'); }catch(e){}
        px = CAP_INDEX_PX;
      } else if (px > CAP_INDEX_PX) px = CAP_INDEX_PX;
      const measured = px + 'px';
      try{ document.documentElement.style.setProperty('--measured-footer', measured); }catch(e){}
      try{ document.documentElement.style.setProperty('--footer-h', 'calc(' + measured + ' + env(safe-area-inset-bottom, 0px))'); }catch(e){}
      const f = document.querySelector('.site-footer');
      if (f) {
        try{
          const inner = f.querySelector('.footer-inner') || f;
          // The measured value comes from the footer's offsetHeight (includes
          // padding). Apply it to the outer footer, and set the inner height to
          // measured minus the outer vertical padding so the total visual
          // footprint matches the original measurement.
          // apply to outer and inner with !important so runtime guards win
          f.style.setProperty('height', measured, 'important');
          f.style.setProperty('max-height', measured, 'important');
          const cs = getComputedStyle(f);
          const padTop = parseFloat(cs.paddingTop) || 0;
          const padBottom = parseFloat(cs.paddingBottom) || 0;
          const innerPx = Math.max(0, (parseInt(measured, 10) || 0) - padTop - padBottom) + 'px';
          inner.style.setProperty('height', innerPx, 'important');
          inner.style.setProperty('max-height', innerPx, 'important');
          f.style.overflow = 'hidden';
          // ensure rounded corners remain on the outer footer element
          f.style.borderTopLeftRadius = getComputedStyle(document.documentElement).getPropertyValue('--footer-radius') || '12px';
          f.style.borderTopRightRadius = getComputedStyle(document.documentElement).getPropertyValue('--footer-radius') || '12px';
        }catch(e){}
      }
    }catch(e){}
  }
  try{ if (document.readyState === 'complete' || document.readyState === 'interactive') { applyIndexHeightToStatic(); } else { document.addEventListener('DOMContentLoaded', applyIndexHeightToStatic); } }catch(e){}

  // Re-measure when window resizes or safe-area changes
  try {
    window.addEventListener('resize', function () { setTimeout(setFooterVars, 120); }, { passive: true });
    window.addEventListener('orientationchange', function () { setTimeout(setFooterVars, 150); });
  } catch (e) {}
})();

// Protection + diagnostics: observe the footer for unexpected changes that
// cause its height to grow (often triggered by layout thrashing on mobile
// when users drag). This adds lightweight logging and applies a soft cap
// to prevent runaway growth. Enabled by default in development.
(function footerDiagnostics(){
  try{
    const footer = () => document.querySelector('.site-footer');
    if (!footer()) return;

    // local Android detection for this diagnostics scope
    const _isAndroid = function() { try { return /android/i.test(navigator.userAgent || ''); } catch (e) { return false; } };
    let lastMeasured = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--measured-footer')) || (footer().offsetHeight || 0);
    let lastLogTime = 0;
    const LOG_THROTTLE_MS = 800;
    const CAP_PX = 600; // generous cap to avoid clipping normal footer
    const CAP_INDEX_PX = 114; // prefer this as canonical index footer height for static pages
    const MIN_ACCEPTABLE = 90; // reject persisted values smaller than this

    function measureAndGuard(label){
      try{
        const f = footer(); if(!f) return;
        const h = Math.max(0, f.offsetHeight || 0);
        // write measured vars (capped)
        // If an index-measured height exists in localStorage, prefer it
        // for informational/static pages to keep heights consistent.
        let indexPref = null;
        try{ indexPref = localStorage.getItem('pokiFooterIndexHeight'); }catch(e){}
        const rawMeasured = h;
        // If this is a static informational page and we don't yet have an
        // index-stored height, do not overwrite the CSS variable (leave the
        // default provided by CSS). This avoids the static page measuring
        // itself and producing a smaller value (e.g. 40px) that would differ
        // from the index. On Android, prefer a conservative fallback instead
        // of returning early since measurements there are often unreliable.
        const isInfo = document.body && document.body.classList && (
          document.body.classList.contains('static-page') ||
          document.body.classList.contains('about-page') ||
          document.body.classList.contains('privacy-page') ||
          document.body.classList.contains('terms-page') ||
          document.body.classList.contains('contact-page') ||
          document.body.classList.contains('dmca-page')
        );
        if (isInfo && !indexPref && !_isAndroid()) {
          // don't change CSS vars here; keep defaults from CSS
          return;
        }
        let used = rawMeasured;
        if (indexPref && document.body && document.body.classList && (
          document.body.classList.contains('static-page') ||
          document.body.classList.contains('about-page') ||
          document.body.classList.contains('privacy-page') ||
          document.body.classList.contains('terms-page') ||
          document.body.classList.contains('contact-page') ||
          document.body.classList.contains('dmca-page')
        )) {
          // prefer the stored index value but cap it to the canonical index size
          // If the stored value is implausibly small (likely a bad transient
          // measurement), fall back to the canonical index size so informational
          // pages render correctly.
          const prefPx = parseInt(indexPref, 10) || 0;
          if (prefPx < MIN_ACCEPTABLE) {
            used = CAP_INDEX_PX;
          } else {
            used = Math.min(prefPx, CAP_INDEX_PX);
          }
        } else if (indexPref) {
          used = parseInt(indexPref, 10) || rawMeasured;
        }
        const capped = Math.min(used, CAP_PX);
        const measured = capped + 'px';
        document.documentElement.style.setProperty('--measured-footer', measured);
        document.documentElement.style.setProperty('--footer-h', 'calc(' + measured + ' + env(safe-area-inset-bottom, 0px))');

        // if actual height jumped unexpectedly above previous by a large amount,
        // log and apply a soft limit to the footer element to stop runaway growth.
        if (h > lastMeasured + 40 && h > 180) {
          const now = Date.now();
          if (now - lastLogTime > LOG_THROTTLE_MS) {
            console.warn('[pokiFooterDiag] unexpected footer growth', {label, previous: lastMeasured, current: h});
            lastLogTime = now;
          }
          try{
            // apply soft maxHeight to the inner container to prevent further growth
            const inner = f.querySelector('.footer-inner') || f;
            inner.style.setProperty('max-height', (Math.max(lastMeasured, 180)) + 'px', 'important');
            f.style.overflow = 'hidden';
          }catch(e){}
        } else {
          // if footer relaxed back to normal, remove guard
          try{ const inner = f.querySelector('.footer-inner') || f; if (inner.style.maxHeight) { inner.style.removeProperty('max-height'); f.style.overflow = ''; } }catch(e){}
        }

        // push diagnostic event into localStorage for remote retrieval
        try{
          const ev = { t: Date.now(), label: label||null, height: h, capped: capped, prev: lastMeasured };
          try{
            const key = 'pokiFooterLogs';
            const raw = localStorage.getItem(key);
            const arr = raw ? JSON.parse(raw) : [];
            arr.push(ev);
            if (arr.length > 200) arr.splice(0, arr.length - 200);
            localStorage.setItem(key, JSON.stringify(arr));
          }catch(e){}
        }catch(e){}
        lastMeasured = h;
      }catch(e){/* ignore */}
    }

    // Initial measurement
    setTimeout(()=> measureAndGuard('init'), 100);

    // Re-measure periodically and on resize/orientation
    try{ window.addEventListener('resize', ()=> setTimeout(()=> measureAndGuard('resize'), 120), {passive:true}); }catch(e){}
    try{ window.addEventListener('orientationchange', ()=> setTimeout(()=> measureAndGuard('orient'), 180)); }catch(e){}

    // Observe mutations under footer to detect scripts adding nodes or styles
    try{
      const obs = new MutationObserver((mutations)=>{
        // if many mutations happen, run measurement and guard
        measureAndGuard('mutation');
        // also print a compact summarised log when mutations are significant
          const added = mutations.reduce((a,m)=> a + (m.addedNodes?m.addedNodes.length:0), 0);
          const removed = mutations.reduce((a,m)=> a + (m.removedNodes?m.removedNodes.length:0), 0);
          const attrChanges = mutations.reduce((a,m)=> a + (m.type==='attributes'?1:0), 0);
        const now = Date.now();
        if ((added+removed+attrChanges) > 0 && now - lastLogTime > LOG_THROTTLE_MS) {
          console.log('[pokiFooterDiag] footer mutations', {added, removed, attrChanges, total: mutations.length});
          lastLogTime = now;
        }
          // also store a compact mutation summary in localStorage for later retrieval
          try{
            const key = 'pokiFooterLogs';
            const raw = localStorage.getItem(key);
            const arr = raw ? JSON.parse(raw) : [];
            arr.push({ t: Date.now(), mutationSummary: { added, removed, attrChanges, total: mutations.length } });
            if (arr.length > 200) arr.splice(0, arr.length - 200);
            localStorage.setItem(key, JSON.stringify(arr));
          }catch(e){}
      });
      obs.observe(footer(), { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    }catch(e){}

    // Expose a small helper for manual invocation from console
    try{ window.footerMeasure = window.footerMeasure || {}; window.footerMeasure.guard = measureAndGuard; }catch(e){}
  }catch(e){/* ignore attach errors */}
})();

// Small helper: center page content vertically on short static pages
(function contentCentering(){
  try{
    function updateCentering(){
      try{
        const body = document.body || document.documentElement;
        if (!body) return;
        // Only apply to informational/static pages
        if (!(body.classList && (body.classList.contains('static-page') || body.classList.contains('about-page') || body.classList.contains('privacy-page') || body.classList.contains('terms-page') || body.classList.contains('contact-page') || body.classList.contains('dmca-page')))) {
          // remove class if present
          const pcOld = document.querySelector('.page-content.page-content--center');
          if (pcOld) pcOld.classList.remove('page-content--center');
          return;
        }

        const header = document.querySelector('.page-header');
        const footer = document.querySelector('.site-footer');
        const content = document.querySelector('.page-content');
        if (!content) return;

        const headerH = header ? header.offsetHeight : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--page-header-height')) || 72;
        const footerH = footer ? (footer.offsetHeight || parseInt(getComputedStyle(document.documentElement).getPropertyValue('--measured-footer')) || 0) : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--measured-footer')) || 0;
        const avail = (window.innerHeight || document.documentElement.clientHeight) - headerH - footerH;
        const contentH = content.scrollHeight || content.getBoundingClientRect().height || 0;

        // If content height is significantly less than available space, center it
        if (contentH + 40 < avail) {
          content.classList.add('page-content--center');
        } else {
          content.classList.remove('page-content--center');
        }
      }catch(e){}
    }

    // Run on resize/orientation and after measurement updates
    try{ window.addEventListener('resize', __center_debounce(()=> setTimeout(updateCentering,80),120), { passive:true }); }catch(e){}
    try{ window.addEventListener('orientationchange', ()=> setTimeout(updateCentering,120)); }catch(e){}

    // debounce helper used here (safe to recreate)
    function __center_debounce(fn, ms){ let t=null; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

    // expose to global measurement API so app can call after DOM updates
    try{ window.footerMeasure = window.footerMeasure || {}; window.footerMeasure.centerContent = updateCentering; }catch(e){}

    // initial call
    try{ setTimeout(updateCentering, 60); }catch(e){}
  }catch(e){}
})();

// Diagnostic helper: run `pokiFooterDiag()` in the console to print footer/layout info
(function attachDiag(){
  try {
    window.pokiFooterDiag = function pokiFooterDiag() {
      try {
        const footer = document.querySelector('.site-footer');
        const pageWrap = document.querySelector('.page-wrap') || document.getElementById('content');
        const info = { footer: !!footer, pageWrap: !!pageWrap, htmlDataFooterBlocker: document.documentElement.getAttribute('data-footer-blocker') };
        console.log('[pokiFooterDiag] presence:', info);
        if (footer) console.log('[pokiFooterDiag] footerRect:', footer.getBoundingClientRect());
        if (pageWrap) console.log('[pokiFooterDiag] pageWrapRect:', pageWrap.getBoundingClientRect());

        const footerStyle = footer ? getComputedStyle(footer) : null;
        const pageStyle = pageWrap ? getComputedStyle(pageWrap) : null;
        console.log('[pokiFooterDiag] footerStyles:', footerStyle);
        console.log('[pokiFooterDiag] pageWrapStyles:', pageStyle);

        const ancestors = [];
        if (footer) {
          for (let n = footer.parentElement; n; n = n.parentElement) {
            try {
              const s = getComputedStyle(n);
              ancestors.push({ tag: n.tagName, id: n.id || null, cls: n.className || null, position: s.position, transform: s.transform, willChange: s.willChange, contain: s.contain });
            } catch (e) { /* ignore */ }
          }
        }
        console.log('[pokiFooterDiag] ancestorStyles:', ancestors);

        // Also report current CSS variable values used for footer spacing
        try {
          const root = getComputedStyle(document.documentElement);
          console.log('[pokiFooterDiag] cssVars:', {
            footer_h: root.getPropertyValue('--footer-h'),
            measured_footer: root.getPropertyValue('--measured-footer'),
            footer_base: root.getPropertyValue('--footer-base')
          });
        } catch (e) {}

        return { info, footerRect: footer && footer.getBoundingClientRect(), pageWrapRect: pageWrap && pageWrap.getBoundingClientRect(), ancestors };
      } catch (err) {
        console.error('pokiFooterDiag error', err);
        return null;
      }
    };
  } catch (e) { /* ignore attach errors */ }
})();

// Expose a simple footerMeasure API for runtime callers (app.js expects this)
(function exposeFooterMeasure(){
  try {
    window.footerMeasure = window.footerMeasure || {};
    window.footerMeasure.update = function() {
      try {
        const footer = document.querySelector('.site-footer');
        if (!footer) return;
        const h = Math.max(0, footer.offsetHeight || 0);
        // If this is the index (non-static) page, persist the measured height
        // so informational pages can match it exactly.
        try{
          const isStatic = document.body && document.body.classList && document.body.classList.contains('static-page');
          const MIN_ACCEPTABLE = 90; // do not persist very small transient measurements
          if (!isStatic) {
            if ((h || 0) >= MIN_ACCEPTABLE) {
              try{ localStorage.setItem('pokiFooterIndexHeight', String(h)); }catch(e){}
            } else {
              try{ console.warn('[pokiFooterDiag] skipping persist small footer height', h); }catch(e){}
            }
          }
        }catch(e){}

        // Prefer index-stored height for static pages (set in measureAndGuard),
        // but still compute a local measured value to keep vars in sync.
        const measured = h + 'px';
        try { document.documentElement.style.setProperty('--measured-footer', measured); } catch (e) {}
        try { document.documentElement.style.setProperty('--footer-h', 'calc(' + measured + ' + env(safe-area-inset-bottom, 0px))'); } catch (e) {}
        try { document.documentElement.style.setProperty('--footer-base', measured); } catch (e) {}

        // Also apply an explicit inline height to the footer element to guard
        // against layout thrashing that would cause its visual height to grow
        // on some mobile browsers during overscroll/drag interactions.
        try{
          // set the sizing on the outer footer and inner container so the total
          // height equals the measured value (which includes outer padding).
          const inner = footer.querySelector('.footer-inner') || footer;
          footer.style.setProperty('height', measured, 'important');
          footer.style.setProperty('max-height', measured, 'important');
          const cs = getComputedStyle(footer);
          const padTop = parseFloat(cs.paddingTop) || 0;
          const padBottom = parseFloat(cs.paddingBottom) || 0;
          const innerPx = Math.max(0, (parseInt(measured, 10) || 0) - padTop - padBottom) + 'px';
          inner.style.setProperty('height', innerPx, 'important');
          inner.style.setProperty('max-height', innerPx, 'important');
          footer.style.overflow = 'hidden';
        }catch(e){}
      } catch (e) { /* ignore */ }
    };
  } catch (e) {}
})();
