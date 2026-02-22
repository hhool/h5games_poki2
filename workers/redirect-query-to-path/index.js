addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request) {
  const url = new URL(request.url)
  const qs = url.search || ''
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
  // For SPA-style paths (no file extension) serve the site root so the client
  // router can handle the route. This avoids relying on Pages returning index
  // for every path and prevents a 404 reaching the client.
  const pathname = url.pathname || '/'
  // Only attempt SPA fallback for GET requests
  if (request.method === 'GET') {
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
          if (!/<base\s+href=/i.test(bodyText)) {
            bodyText = bodyText.replace(/<head([^>]*)>/i, '<head$1><base href="/" />')
          }
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
