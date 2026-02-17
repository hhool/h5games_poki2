// Measure the footer and expose CSS variables so static pages reserve space
(function () {
  function setFooterVars() {
    try {
      const footer = document.querySelector('.site-footer');
      if (!footer) return;
      const h = Math.max(0, footer.offsetHeight || 0);
      const measured = h + 'px';
      try { document.documentElement.style.setProperty('--measured-footer', measured); } catch (e) {}
      try { document.documentElement.style.setProperty('--footer-h', 'calc(' + measured + ' + env(safe-area-inset-bottom, 0px))'); } catch (e) {}
      // Apply padding to the main content as a defensive fallback, but
      // avoid doing this for pages that use the `full-bleed-footer` helper
      // (index/category views) since we use a spacer there to control layout.
      try {
        const body = document.body || document.documentElement;
        if (body && body.classList && body.classList.contains('full-bleed-footer')) {
          // skip padding on index/category views
        } else {
          const content = document.querySelector('.page-content') || document.getElementById('content') || document.querySelector('.page-wrap');
          if (content) content.style.paddingBottom = 'calc(' + measured + ' + env(safe-area-inset-bottom, 0px))';
        }
      } catch (e) {}
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(setFooterVars, 30);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(setFooterVars, 30));
  }

  // Re-measure when window resizes or safe-area changes
  try {
    window.addEventListener('resize', function () { setTimeout(setFooterVars, 120); }, { passive: true });
    window.addEventListener('orientationchange', function () { setTimeout(setFooterVars, 150); });
  } catch (e) {}
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
        const measured = h + 'px';
        try { document.documentElement.style.setProperty('--measured-footer', measured); } catch (e) {}
        try { document.documentElement.style.setProperty('--footer-h', 'calc(' + measured + ' + env(safe-area-inset-bottom, 0px))'); } catch (e) {}

        // Keep fallback padding in sync for non-full-bleed pages
        try {
          const body = document.body || document.documentElement;
          if (body && body.classList && !body.classList.contains('full-bleed-footer')) {
            const content = document.querySelector('.page-content') || document.getElementById('content') || document.querySelector('.page-wrap');
            if (content) content.style.paddingBottom = 'calc(' + measured + ' + env(safe-area-inset-bottom, 0px))';
          }
        } catch (e) {}
      } catch (e) { /* ignore */ }
    };
  } catch (e) {}
})();
