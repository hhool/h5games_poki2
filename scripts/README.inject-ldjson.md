
LD+JSON injection flow
======================

Purpose
-------
Insert structured data (JSON-LD) into site HTML files in bulk. The script injects Organization, WebSite, WebPage, BreadcrumbList, and adds a VideoGame (or Article) extension for game pages.

How it works (overview)
-----------------------
- Reads site settings from `scripts/ldconfig.json` for organization/site-wide fields (name, logo, baseUrl, etc.).
- Walks a target directory (for example the repository root or `dist/`) and parses each HTML file with Cheerio.
- Injects or updates a `<script type="application/ld+json">` block containing Organization, WebSite, WebPage, and BreadcrumbList for the page.
- Detects game pages by matching page slugs against `dist/games.json` (a build artifact). For matches, it appends a VideoGame schema with `name`, `url`, `image`, `genre`, `platform`, etc.
- The injection is idempotent: the script detects an existing injected JSON-LD block and replaces it to avoid duplicates.

Configuration points
--------------------
- Site/organization data: `scripts/ldconfig.json`. Edit this to change site-wide Organization/WebSite fields.
- Game detection: `dist/games.json` (produced by the build) is used to decide whether a page is a game page and to populate VideoGame fields.

Usage
-----
Run the injector against the source or the build output:

```bash
# Inject into source HTML files in the repo root
node scripts/inject-ldjson.js --dir=. --config=scripts/ldconfig.json

# Inject into built output (dist/) — recommended in local build or CI
node scripts/inject-ldjson.js --dir=dist --config=scripts/ldconfig.json
```

CI / deployment recommendation
----------------------------
- Do NOT commit `dist/` to the repository. Run the injection step as part of your build/deploy pipeline: build the site (generate `dist/` and `dist/games.json`), run the injector, then deploy the resulting `dist/` to your static host (GitHub Pages, Netlify, Cloudflare Pages, etc.).
- Recommended pipeline stage order: `build -> inject-ldjson -> deploy` so production pages always include up-to-date structured data without tracking `dist/` in the repo.

Extending the injector
----------------------
- To change which fields are injected or to add more properties for game pages, edit `scripts/inject-ldjson.js` and update the mapping logic. For site-global changes update `scripts/ldconfig.json`.
- To insert an Article schema for non-game content, add path-based or meta-based detection in the injector and output the Article JSON-LD instead of (or in addition to) VideoGame.

Debugging & validation
----------------------
- Local check: after running the injector, open an HTML file and look for `<script type="application/ld+json">` to confirm the JSON-LD block exists and contains expected fields.
- Online validation: use Google Rich Results Test, Schema.org tools, or Facebook/Twitter debuggers to verify the structured data is recognized.

Quick command summary
---------------------
```bash
# Run against source files
node scripts/inject-ldjson.js --dir=. --config=scripts/ldconfig.json

# Run against built output (CI/local build)
node scripts/inject-ldjson.js --dir=dist --config=scripts/ldconfig.json
```

Files referenced
----------------
- README: [scripts/README.inject-ldjson.md](scripts/README.inject-ldjson.md)
- Config: [scripts/ldconfig.json](scripts/ldconfig.json)
- Injector: [scripts/inject-ldjson.js](scripts/inject-ldjson.js)
- Game source (build artifact): `dist/games.json`

Local build integration
-----------------------
You can run the injector locally after building `dist/`. The project includes npm scripts to help:

```bash
# build into dist/ then inject JSON-LD (recommended local command)
npm run build:with-inject

# inject only (useful for testing)
npm run inject-ldjson

# inject into source files (not recommended for deploy)
npm run inject-ldjson:src
```

Notes:
- `npm run build:with-inject` runs the existing `build` pipeline then injects LD+JSON into `dist/`.
- Keep `dist/` in `.gitignore` and run these commands locally or in CI; avoid committing `dist/` to the repository.

