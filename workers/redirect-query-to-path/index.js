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
  // pass through for other requests
  return fetch(request)
}
