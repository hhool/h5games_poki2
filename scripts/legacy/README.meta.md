**Meta injection helper**

This project includes a small utility to standardize and inject SEO meta into your static HTML pages.

- File: `scripts/meta.json` — per-page metadata (title and description). Keys are page slugs (e.g. `home`, `privacy`, `about`, `terms`, `contact`, `dmca`).
- File: `scripts/update-meta.js` — Node script that reads `meta.json` and updates HTML files in a target directory (defaults to project root or `dist`). It safely upserts the following into each page's `<head>`:
	- `<title>`
	- `<meta name="description">`
	- `<meta property="og:description">`
	- `<meta name="twitter:description">`
	- `<meta property="og:title">` and `<meta name="twitter:title">`
	- `<meta property="og:image">` (points to `https://poki2.online/favicon.png`)
	- `<meta property="og:url">` (absolute URL derived from slug)

Usage

1. Edit `scripts/meta.json` to tune titles and descriptions for each page. Keep descriptions concise (50–200 characters) and plain English.

2. Run the updater against your `dist` or workspace root:

```bash
node scripts/update-meta.js --dir=dist --meta=scripts/meta.json
```

Notes

- The script uses `cheerio` to parse and modify HTML; it replaces duplicate meta tags to avoid collisions.
- If you prefer automation, add the updater to your build pipeline before publishing.
- For social previews, after deployment use Facebook Sharing Debugger and Twitter Card Validator to refresh caches.

