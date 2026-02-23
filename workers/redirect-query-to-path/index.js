
addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);
  const pathname = url.pathname || "/";

  // 透明代理: /games/<slug>/ -> pickShardOrigin(slug)/<slug>/index.html
  if (request.method === "GET") {
    const m = pathname.match(/^\/games\/([^\/]+)\/?$/i);
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
    "0","1","2","3","4","5","6","7","8","9",
    "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"
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
