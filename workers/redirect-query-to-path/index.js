addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);
  const pathname = url.pathname || "/";

  // 301 redirect: /games/<slug> → /game/{char}/{slug}/ (canonical SEO page)
  if (request.method === "GET") {
    // get slug
    // check slug with extension, if has ext, pass through
    if (pathname.match(/^\/games\/[^\/]+\.[^\/]+$/)) {
      return fetch(request);
    }
    // normalize /games/<slug>/ to /games/<slug>
    const normalizedPath = pathname.replace(/\/$/, "");
    // 特殊映射：/games/mobileapp_mobile/<slug>  -> https://mobileapp.poki2.online/mobile/<slug>/
    const mMobile = normalizedPath.match(
      /^\/games\/mobileapp_mobile\/([^\/]+)(\/.*)?$/i,
    );
    // mMobile[0] is the full match, mMobile[1] is slug, mMobile[2] is ignored (canonical page has no sub-paths)
    if (mMobile) {
      const slug = mMobile[1];
      const char = slug[0].toLowerCase();
      // 301 redirect to the canonical per-game SEO page
      return Response.redirect(`https://poki2.online/game/${char}/${slug}/`, 301);
    }

    const m = normalizedPath.match(/^\/games\/([^\/]+)\/?$/i);
    if (m) {
      const slug = m[1];
      const char  = slug[0].toLowerCase();
      // 301 redirect to the canonical per-game SEO page (replaces the old shard proxy)
      return Response.redirect(`https://poki2.online/game/${char}/${slug}/`, 301);
    }
  }

  // 默认 pass-through
  return fetch(request);
}
