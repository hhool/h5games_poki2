addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request) {
  const url = new URL(request.url)
  const qs = url.search || ''
  const pathname = url.pathname || '/'

  // Bypass worker for privacy paths
  if (pathname === '/privacy' || pathname.startsWith('/privacy/')) return fetch(request)

  // Normalize duplicate slashes
  const collapsed = pathname.replace(/\/\/+/g, '/')
  if (collapsed !== pathname) {
    const to = `${url.protocol}//${url.host}${collapsed}${url.search || ''}`
    return Response.redirect(to, 301)
  }

  // Serve proxied shard assets under same-origin path
  if ((request.method === 'GET' || request.method === 'HEAD') && pathname.startsWith('/_shard_proxy/')) {
    try {
      const parts = pathname.split('/').filter(Boolean) // ['_shard_proxy', '<slug>', ...]
      const slug = parts[1]
      const shardOrigin = 'https://c.poki2.online'
      let rest = parts.slice(2).join('/')
      let fetchUrl
      // Support special @root marker for shard-root absolute paths
      if (parts[2] === '@root') {
        // /_shard_proxy/<slug>/@root/<path...> -> fetch https://c.poki2.online/<path...>
        rest = parts.slice(3).join('/')
        fetchUrl = `${shardOrigin}/${rest}`
      } else {
        fetchUrl = `${shardOrigin}/${encodeURIComponent(slug)}/${rest}`
      }
      const shardResp = await fetch(fetchUrl, { redirect: 'follow' })
      if (shardResp) {
        const headers = new Headers(shardResp.headers)
        headers.set('Access-Control-Allow-Origin', '*')
        if (request.method === 'HEAD') return new Response(null, { status: shardResp.status, statusText: shardResp.statusText, headers })
        return new Response(shardResp.body, { status: shardResp.status, statusText: shardResp.statusText, headers })
      }
    } catch (e) {
      return fetch(request)
    }
  }

  // Redirect query-style play links to pretty /games/<slug>/
  const m = qs.match(/play-([^&]+)/) || qs.match(/[?&](?:play|game|id)=([^&]+)/)
  if (m) {
    const slug = encodeURIComponent(m[1])
    return Response.redirect(`${url.protocol}//${url.host}/games/${slug}/`, 301)
  }

  // Normalize /games/<slug> -> /games/<slug>/
  if (request.method === 'GET') {
    const dirNoSlash = pathname.match(/^\/games\/([^\/\.?#]+)$/i)
    if (dirNoSlash) return Response.redirect(`${url.protocol}//${url.host}${pathname}/${url.search || ''}`, 301)
  }

  // Preserve certain top-level .html pages
  if (request.method === 'GET' && pathname.endsWith('.html')) {
    const preserved = ['/about.html','/contact.html','/privacy.html','/terms.html','/dmca.html']
    if (preserved.includes(pathname)) {
      try {
        const pagesOrigin = 'https://h5games-poki2.pages.dev'
        const fileResp = await fetch(pagesOrigin + pathname, { redirect: 'follow' })
        return fileResp
      } catch (e) {}
    }
  }

  // SPA fallback and game proxying
  if (request.method === 'GET') {
    const gameMatch = pathname.match(/^\/games\/([^\/]+)\/?$/i)
    if (gameMatch) {
      const slug = gameMatch[1]
      try {
        const shardOrigin = 'https://c.poki2.online'
        const shardUrl = `${shardOrigin}/${encodeURIComponent(slug)}/`
        const shardResp = await fetch(shardUrl, { redirect: 'follow' })
        if (shardResp && shardResp.status === 200) {
          const contentType = shardResp.headers.get('content-type') || ''
          if (contentType.toLowerCase().includes('text/html')) {
            let bodyText = await shardResp.text()
            // Preserve scripts; remove only service-worker registration + sw.js references
            bodyText = bodyText.replace(/navigator\.serviceWorker\.register\s*\([^;]*\);?/gi, '/* service worker registration removed by proxy */')
            bodyText = bodyText.replace(/serviceWorker\.register\s*\([^;]*\);?/gi, '/* service worker registration removed by proxy */')
            bodyText = bodyText.replace(/<script[^>]+\/sw\.js[^>]*><\/script>/gi, '')
            bodyText = bodyText.replace(/window\.C2_RegisterSW\s*=\s*function\s+C2_RegisterSW\s*\(\)\s*\{/i, 'window.C2_RegisterSW = function C2_RegisterSW() { if (location.origin !== "https://c.poki2.online") return;')
            // Inject same-origin proxy base so relative requests resolve via /_shard_proxy
            const proxyBase = `${url.protocol}//${url.host}/_shard_proxy/${encodeURIComponent(slug)}/`
            if (!/<base\s+href=/i.test(bodyText)) {
              bodyText = bodyText.replace(/<head([^>]*)>/i, `<head$1><base href="${proxyBase}" />`)
            }
            // Inject a small client-side snippet to unregister any ServiceWorker
            // and clear caches for users hitting proxied shard pages. This helps
            // when an old/incorrect SW serves cached/broken responses.
            const swUnregisterScript = `<script>if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});}if(window.caches){caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).catch(()=>{});}</script>`
            if (/\<body[^>]*>/i.test(bodyText)) {
              bodyText = bodyText.replace(/<body([^>]*)>/i, `<body$1>${swUnregisterScript}`)
            } else {
              // Fallback: append to head if no body tag found
              bodyText = bodyText.replace(/<\/head>/i, `${swUnregisterScript}</head>`)
            }
            // Rewrite script src attributes (root-relative or relative) to use proxy
            // Do not touch protocol-absolute (https:// or //) external URLs.
            bodyText = bodyText.replace(/(<script[^>]*\s+src\s*=\s*)(['"])(?!https?:|\/\/)([^'">]+)(['"])/gi, function(m, prefix, q, rel, q2){
              if (rel.charAt(0) === '/') {
                const cleaned = rel.replace(/^\/+/, '')
                return `${prefix}${q}/_shard_proxy/${encodeURIComponent(slug)}/@root/${cleaned}${q2}`
              }
              const cleaned = rel.replace(/^\.\//, '')
              return `${prefix}${q}/_shard_proxy/${encodeURIComponent(slug)}/${cleaned}${q2}`
            })
            // Rewrite other asset references (img/link/source/audio/video) similarly
            bodyText = bodyText.replace(/(<(?:img|link|source|audio|video)[^>]*(?:src|href)\s*=\s*)(['"])(?!https?:|\/\/)([^'">]+)(['"])/gi, function(m, prefix, q, rel, q2){
              if (rel.charAt(0) === '/') {
                const cleaned = rel.replace(/^\/+/, '')
                return `${prefix}${q}/_shard_proxy/${encodeURIComponent(slug)}/@root/${cleaned}${q2}`
              }
              const cleaned = rel.replace(/^\.\//, '')
              return `${prefix}${q}/_shard_proxy/${encodeURIComponent(slug)}/${cleaned}${q2}`
            })
            const headers = new Headers(shardResp.headers)
            headers.set('content-type','text/html; charset=utf-8')
            return new Response(bodyText, { status: shardResp.status, statusText: shardResp.statusText, headers })
          }
        }
      } catch (e) {}
    }
    // Fallback to Pages index for SPA
    if (!pathname.includes('.')) {
      const skipPrefixes = ['/api/','/_/','/.well-known/']
      let skip = false
      for (const p of skipPrefixes) if (pathname.startsWith(p)) { skip = true; break }
      if (!skip) {
        try {
          const pagesOrigin = 'https://h5games-poki2.pages.dev/'
          const indexResp = await fetch(pagesOrigin, { redirect: 'follow' })
          let bodyText = await indexResp.text()
          if (!/<base\s+href=/i.test(bodyText)) bodyText = bodyText.replace(/<head([^>]*)>/i, '<head$1><base href="/" />')
          const headers = new Headers(indexResp.headers)
          headers.set('content-type','text/html; charset=utf-8')
          return new Response(bodyText, { status: 200, statusText: 'OK', headers })
        } catch (e) {}
      }
    }
  }

  return fetch(request)
}
