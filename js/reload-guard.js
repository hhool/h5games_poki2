// Guard reloads so they wait for critical stylesheets to finish loading.
(function(){
  function waitForStylesheets(timeout){
    timeout = typeof timeout === 'number' ? timeout : 2000;
    return new Promise(function(resolve){
      try{
        var links = Array.from(document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="style"]'));
        if (!links.length) return resolve();
        var remaining = links.length;
        var done = false;
        var tid = setTimeout(function(){ if(!done){ done=true; resolve(); } }, timeout);
        function mark(){ if(done) return; remaining--; if(remaining<=0){ done=true; clearTimeout(tid); resolve(); } }
        links.forEach(function(l){
          // If it's already a stylesheet and sheet is available, consider loaded
          try{
            if (l.rel === 'stylesheet'){
              if (l.sheet) { mark(); return; }
            }
          }catch(e){ /* ignore */ }
          // Listen for load; for preload->stylesheet the load event fires when resource loaded
          l.addEventListener('load', function(){ mark(); });
          // Also watch for rel attribute change (preload -> stylesheet)
          var obs = new MutationObserver(function(muts){
            muts.forEach(function(m){ if(m.attributeName==='rel' && (l.rel==='stylesheet')){ mark(); obs.disconnect(); } });
          });
          try{ obs.observe(l, { attributes: true }); }catch(e){}
        });
      }catch(e){ resolve(); }
    });
  }

  try{
    if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function'){
      var _origReload = window.location.reload.bind(window.location);
      window.location.reload = function(forceGet){
        // Wait up to 2s for stylesheets to finish loading, then reload.
        waitForStylesheets(2000).finally(function(){ try{ _origReload(forceGet); }catch(e){ /* ignore */ } });
      };
    }
    // Also expose helper
    window.reloadAfterStylesLoaded = function(timeout){ return waitForStylesheets(timeout||2000).then(function(){ try{ window.location.reload(); }catch(e){} }); };
  }catch(e){}
})();
