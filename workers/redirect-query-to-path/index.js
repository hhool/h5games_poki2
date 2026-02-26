addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);
  const pathname = url.pathname || "/";

  // 透明代理: /games/<slug> -> pickShardOrigin(slug)/<slug>/index.html
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
    // mMobile[0] is the full match, mMobile[1] is slug, mMobile[2] is optional extra path (like /index.html), we should preserve it when redirecting
    if (mMobile) {
      const game = mMobile[1];
      const extraPath = mMobile[2] || "/";
      const targetGame = game;
      const fetchUrl = `https://mobileapp.poki2.online/mobile/${encodeURIComponent(targetGame)}${extraPath}`;
      // preserve query
      const finalUrl = url.search ? fetchUrl + url.search : fetchUrl;
      return fetch(finalUrl, { redirect: "follow" });
    }

    const m = normalizedPath.match(/^\/games\/([^\/]+)\/?$/i);
    if (m) {
      const slug = m[1];
      const shardOrigin = pickShardOrigin(slug);
      const fetchUrl = `${shardOrigin}/${encodeURIComponent(slug)}/index.html`;
      const resp = await fetch(fetchUrl, { redirect: "follow" });
      return resp;
    }
  }

  // 默认 pass-through
  return fetch(request);
}

function pickShardOrigin(slug) {
  const shardPrefixes = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
  ];
  const lower = String(slug).toLowerCase();
  let shard = "c";
  for (const prefix of shardPrefixes) {
    if (lower.startsWith(prefix)) {
      shard = prefix;
      break;
    }
  }
  return `https://${shard}.poki2.online`;
}
