# Redirect Worker (query → path)

This worker redirects old query-style game URLs to path-style URLs.

Usage
- Deploy `workers/redirect-query-to-path/index.js` to Cloudflare Workers and bind route `https://<your-domain>/*` (or test on a subdomain first).
- Test with: `curl -I 'https://your-domain/?play-2048'` -> should return `301 Location: https://your-domain/games/2048/`.

Tips
- Use a test subdomain before binding production.
- Monitor Worker usage in Cloudflare dashboard to ensure it stays within free quota.
