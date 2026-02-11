# 🎮 Poki2 — Free Online Games Portal

A lightweight, Poki-style HTML5 game portal. No frameworks, no build step — pure HTML / CSS / JS.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Sidebar Navigation** | Dark-themed category menu with emoji icons, pill-shaped active states |
| **Hero Banner** | Gradient header with call-to-action |
| **Category Sections** | Games auto-grouped by tag (Action, Puzzle, Racing…), "See all" to expand |
| **Game Cards** | Rounded thumbnails, hover lift animation, lazy-loaded images |
| **Instant Play** | Full-screen iframe overlay with back button & fullscreen toggle |
| **Search** | Real-time debounced filtering by title / tag |
| **Deep Linking** | Hash-based routes: `#action`, `#puzzle`, `#play-gamename` |
| **Responsive** | Sidebar → hamburger on ≤ 900 px; grid adapts at ≤ 600 px |
| **Keyboard** | `Esc` closes overlay / sidebar |

## 📁 Project Structure

```
h5games_poki2/
├── index.html        # Main entry page
├── games.json        # Game catalogue (145 games, 9 tags)
├── css/
│   └── style.css     # All styles (sidebar, cards, overlay, responsive)
├── js/
│   └── app.js        # App logic (data loading, rendering, routing)
└── README.md
```

## 🚀 Quick Start

```bash
# Serve locally (any static server works)
cd h5games_poki2
python3 -m http.server 8899

# Open in browser
open http://localhost:8899
```

No `npm install`, no build — just open and play.

## 🏷️ Game Categories

| Tag | Emoji | Count |
|-----|-------|-------|
| Action | 💥 | varies |
| Puzzle | 🧩 | varies |
| Racing | 🏎️ | varies |
| Shooting | 🔫 | varies |
| Sports | ⚽ | varies |
| Competitive | 🏆 | varies |
| Strategy | ♟️ | varies |
| Idle | 🕹️ | varies |
| Other | 🎲 | varies |

## 🔧 Customisation

### Adding games

Edit `games.json` — each entry:

```json
{
  "link": "https://example.com/game/",
  "imgSrc": "https://example.com/game/icon.png",
  "title": "My Game",
  "tags": ["action", "puzzle"]
}
```

### Changing categories

Edit `TAG_META` and `TAG_ORDER` in `js/app.js`.

````markdown
# 🎮 Poki2 — Free Online Games Portal

A lightweight, Poki-style HTML5 game portal. No frameworks, no build step — pure HTML / CSS / JS.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Sidebar Navigation** | Dark-themed category menu with emoji icons, pill-shaped active states |
| **Hero Banner** | Gradient header with call-to-action |
| **Category Sections** | Games auto-grouped by tag (Action, Puzzle, Racing…), "See all" to expand |
| **Game Cards** | Rounded thumbnails, hover lift animation, lazy-loaded images |
| **Instant Play** | Full-screen iframe overlay with back button & fullscreen toggle |
| **Search** | Real-time debounced filtering by title / tag |
| **Deep Linking** | Hash-based routes: `#action`, `#puzzle`, `#play-gamename` |
| **Responsive** | Sidebar → hamburger on ≤ 900 px; grid adapts at ≤ 600 px |
| **Keyboard** | `Esc` closes overlay / sidebar |

## 📁 Project Structure

```
h5games_poki2/
├── index.html        # Main entry page
├── games.json        # Game catalogue
├── css/
│   └── style.css     # All styles (sidebar, cards, overlay, responsive)
├── js/
│   └── app.js        # App logic (data loading, rendering, routing)
├── scripts/          # build helpers (OG generation, hashing)
└── README.md
```

## 🚀 Quick Start (Development)

```bash
# Serve locally (any static server works)
cd h5games_poki2
python3 -m http.server 8899

# Open in browser
open http://localhost:8899
```

No `npm install` is required for simple local viewing.

## 🛠 Build & Deploy (optional)

This project can be used as a zero-build static site (open `index.html`), or you can run an optional build pipeline to produce an optimized `dist/` folder for deployment.

Prerequisites
- Node.js (LTS)
- `npm` or `pnpm`
- Optional: `wrangler` (for Cloudflare Pages)

Common scripts (see `package.json`)
- `npm run build` — generate OG images, build CSS/JS, hash assets, and copy site files into `dist/`.
- `npm run publish:pages` — publish `./dist` to Cloudflare Pages using `wrangler`.

Local build example
```bash
cd h5games_poki2
# install dependencies (use npm ci in CI)
npm ci

# run full build -> ./dist
npm run build
```

Deploy examples
- Cloudflare Pages (recommended)
```bash
# ensure you are logged in with wrangler
npm run publish:pages
# optionally override project name
CF_PAGES_PROJECT=my-pages-project npm run publish:pages
```
- Rsync to a remote server (example)
```bash
# sync local ./dist to remote host (replace user@host and /var/www/site)
rsync -azh --delete ./dist/ user@host:/var/www/site/
```
- Netlify: upload `dist/` via the Netlify UI, or configure CI to run `npm ci && npm run build` and publish `dist/`.

macOS notes
- The OG generator uses `sharp`, which depends on the `libvips` system library. If `sharp` fails to install on macOS, install `vips` with:
```bash
brew install vips
```
- If native dependency issues persist, run the build in CI (many CI images include required native libs), or skip OG generation and run only the asset build steps:
```bash
npm run build:css && npm run build:js
```

Troubleshooting
- If `npm run build` fails, run `npm run build:css` and `npm run build:js` separately to isolate the failing step.
- To prepare a deployable copy without image generation/hashing, run `npm run build:copy` after building assets.

Note: This README includes both the simple "open and play" usage (no build) and the optional build/deploy workflow above.

## 🔧 Customisation

### Adding games

Edit `games.json` — each entry:

```json
{
  "link": "https://example.com/game/",
  "imgSrc": "https://example.com/game/icon.png",
  "title": "My Game",
  "tags": ["action", "puzzle"]
}
```

### Changing categories

Edit `TAG_META` and `TAG_ORDER` in `js/app.js`.

### Adjusting home page grid size

Change `SECTION_LIMIT` in `js/app.js` (default: 12 games per category).

## 📄 License

MIT

````
