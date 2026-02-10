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

The project includes an optional build pipeline that generates optimized assets and a `dist/` folder suitable for static hosting (Cloudflare Pages).

Prerequisites:
- Node.js (LTS)
- `npm` or `pnpm`
- `wrangler` (for direct Pages publishes) — optional

Key scripts (in `package.json`):

- `npm run build` — generate OG images, build CSS/JS, hash assets, and copy site files into `dist/`.
- `npm run publish:pages` — publish `./dist` to Cloudflare Pages using `wrangler` (requires `wrangler` and authentication).

Typical flow to build and publish from your machine:

```bash
# install dependencies (CI-friendly)
npm ci

# build assets into ./dist
npm run build

# publish to Cloudflare Pages (interactive login)
npm run publish:pages
```

Environment overrides:
- `CF_PAGES_PROJECT` — override the default Pages project name when running `npm run publish:pages`.

Notes about native image tooling:
- The OG/image generator uses `sharp` which depends on `libvips`. On macOS, if `sharp` fails to install, run:

```bash
brew install vips
```

Alternatively run the build in CI where `sharp` is available or skip OG generation.

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
