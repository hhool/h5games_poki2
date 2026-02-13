```markdown
# Open Graph (OG) images

This project previously generated per-page OG images with `scripts/generate-og.js`. That pipeline has been removed: the site now uses the site favicon as the canonical `og:image` (https://poki2.online/favicon.png) and no longer requires generated `og/*.png` assets.

If you later want richer per-page previews, you can reintroduce a generator that outputs 1200×630 images and update page meta accordingly.

```
