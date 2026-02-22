addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request) {
  const url = new URL(request.url)
  const qs = url.search || ''
  const pathname = url.pathname || '/'
  // Bypass worker for privacy paths: let Pages handle /privacy and /privacy/* directly.
  if (pathname === '/privacy' || pathname.startsWith('/privacy/')) {
    return fetch(request)
  }
  // Normalize duplicate slashes in the pathname (e.g. // -> /, /a//b -> /a/b)
  const collapsed = pathname.replace(/\/\/{2,}/g, '/')
  if (collapsed !== pathname) {
    const to = `${url.protocol}//${url.host}${collapsed}${url.search || ''}`
    return Response.redirect(to, 301)
  }
  // match ?play-xxx or ?play=xxx or ?game=xxx or ?id=123
  const m = qs.match(/play-([^&]+)/) || qs.match(/[?&](?:play|game|id)=([^&]+)/)
  if (m) {
    const slug = encodeURIComponent(m[1])
    const to = `${url.protocol}//${url.host}/games/${slug}/`
    return Response.redirect(to, 301)
  }
  // Normalize directory-style paths without trailing slash to include trailing slash
  // e.g. /games/2048  -> /games/2048/
  if (request.method === 'GET') {
    const dirNoSlash = pathname.match(/^\/games\/([^\/\.?#]+)$/i)
    if (dirNoSlash) {
      const to = `${url.protocol}//${url.host}${pathname}/${url.search || ''}`
      return Response.redirect(to, 301)
    }
  }

  // Preserve certain top-level .html pages: fetch the real .html from Pages origin
  // so that requests to /about.html, /contact.html, etc. return the standalone
  // HTML file instead of being redirected or rewritten to the SPA root.
  if (request.method === 'GET' && pathname.endsWith('.html')) {
    const preserved = ['/about.html', '/contact.html', '/privacy.html', '/terms.html', '/dmca.html']
    if (preserved.includes(pathname)) {
      try {
        const pagesOrigin = 'https://h5games-poki2.pages.dev'
        const fileResp = await fetch(pagesOrigin + pathname, { redirect: 'follow' })
        // Return the file response as-is (headers/status preserved)
        return fileResp
      } catch (e) {
        // If fetching the specific file fails, fall through to normal handling
      }
    }
  }

  // If the requested path ends with a 'privacy' segment (e.g. /privacy/zcj2/privacy
  // or /privacy/zcj2/privacy/), try to serve a real privacy HTML page by
  // attempting `{path}.html` and then `{path}/index.html` from the Pages origin.
  if (request.method === 'GET' && /\/privacy\/?$/.test(pathname)) {
    try {
      const pagesOrigin = 'https://h5games-poki2.pages.dev'
      // Try path.html first
      const tryHtml = await fetch(pagesOrigin + pathname + '.html', { redirect: 'follow' })
      if (tryHtml && tryHtml.status === 200) return tryHtml
      // Then try path/index.html
      const suffix = pathname.endsWith('/') ? 'index.html' : '/index.html'
      const tryIndex = await fetch(pagesOrigin + pathname + suffix, { redirect: 'follow' })
      if (tryIndex && tryIndex.status === 200) return tryIndex
    } catch (e) {
      // fall through to SPA fallback
    }
  }
  // For SPA-style paths (no file extension) serve the site root so the client
  // router can handle the route. This avoids relying on Pages returning index
  // for every path and prevents a 404 reaching the client.
  // Only attempt SPA fallback for GET requests
  if (request.method === 'GET') {
    // If this is a canonical game path like `/games/<slug>/`, try to proxy
    // the shard host `c.poki2.online/<slug>/` and return its `index.html`
    // when available. This lets the canonical page load the shard content
    // without a client-side redirect.
    const gameMatch = pathname.match(/^\/games\/([^\/]+)\/?$/i)
    if (gameMatch) {
      const slug = gameMatch[1]
      try {
        const shardOrigin = 'https://c.poki2.online'
        const shardUrl = `${shardOrigin}/${encodeURIComponent(slug)}/`
        const shardResp = await fetch(shardUrl, { redirect: 'follow' })
        if (shardResp && shardResp.status === 200) {
          // Ensure we return HTML and inject a base href so relative
          // assets resolve against the shard origin/slug.
          const contentType = shardResp.headers.get('content-type') || ''
          if (contentType.toLowerCase().includes('text/html')) {
            let bodyText = await shardResp.text()
            if (!/<base\s+href=/i.test(bodyText)) {
              bodyText = bodyText.replace(/<head([^>]*)>/i, `<head$1><base href="${shardUrl}" />`)
            }
            const headers = new Headers(shardResp.headers)
            headers.set('content-type', 'text/html; charset=utf-8')
            return new Response(bodyText, { status: shardResp.status, statusText: shardResp.statusText, headers })
          }
        }
      } catch (e) {
        // If shard fetch fails, fall through to normal SPA handling
      }
    }
    // If the path looks like a static asset (has an extension), don't fallback
    if (!pathname.includes('.')) {
      // Avoid rewriting special files/folders (api, static-assets etc.)
      const skipPrefixes = ['/api/', '/_/', '/.well-known/']
      let skip = false
      for (const p of skipPrefixes) {
        if (pathname.startsWith(p)) { skip = true; break }
      }
      if (!skip) {
        try {
          // Fetch the Pages origin directly (avoid re-invoking this worker by using the
          // Pages subdomain). This ensures we get the static `index.html`/`404.html` served
          // by Pages rather than looping to this worker.
          const pagesOrigin = 'https://h5games-poki2.pages.dev/'
          const indexResp = await fetch(pagesOrigin, { redirect: 'follow' })
          let bodyText = await indexResp.text()
          // If the document doesn't declare a <base>, inject one pointing to the site root.
          // This makes relative asset paths like `css/style.css` resolve to `/css/...` when
          // the page is served at nested paths such as `/games/2048`.
          // Inject a <base> if missing so relative assets resolve correctly when
          // the index is returned at nested paths. Also inject a small client-side
          // normalizer that collapses duplicate slashes in the address bar.
          if (!/<base\s+href=/i.test(bodyText)) {
            bodyText = bodyText.replace(/<head([^>]*)>/i, '<head$1><base href="/" />')
          }
          // The client already contains an inline collapse-slashes normalizer in
          // `index.html`. Do not inject a duplicate normalizer from the Worker
          // to avoid duplicate execution and script-id collisions.
          const headers = new Headers(indexResp.headers)
          headers.set('content-type', 'text/html; charset=utf-8')
          return new Response(bodyText, { status: 200, statusText: 'OK', headers })
        } catch (e) {
          // if fetching index fails, fall through to proxying the original request
        }
      }
    }
  }

  // Otherwise proxy the request to origin/pages
  return fetch(request)
}
