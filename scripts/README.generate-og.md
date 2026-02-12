```markdown
# OG Image Generator

## Purpose

This script generates Open Graph (OG) preview images for key site pages so social platforms display consistent, branded thumbnails when links are shared.

## Location

`scripts/generate-og.js`

## Output

Files are written to the `og/` directory for each page:
- `*.svg` — editable vector source
- `*.png` — 1200×630 bitmap (recommended for social platforms)
- `*.webp` — modern compressed format

## Why it matters

Social platforms (Facebook, Twitter, Telegram, etc.) read `og:image` when a link is shared. Providing ready-made OG images improves click-through rates and brand recognition.

## How to run

From the repository root:

```bash
node scripts/generate-og.js
```

## Integration suggestions

- Add the script to your build pipeline so images are regenerated when page titles or content change. Example for `package.json`:

```json
"scripts": {
  "generate-og": "node scripts/generate-og.js",
  "build": "npm run generate-og && <your-build-command>"
}
```

## Notes & considerations

- Fonts: The SVG template references `Inter`. If that font is not available where `sharp` renders the SVG, rendering will fall back to system fonts. Inline fonts into the SVG for consistent rendering (increases file size).
- Long titles: The template places the title on a single text line. For long titles consider multi-line wrapping or layout logic.
- Performance: Generation is currently serial. If you have many pages, consider parallelizing the image generation.

## Possible improvements

- Automatically inject generated `og/*.png` into page meta tags during the build.
- Support per-page or per-game custom thumbnails and integrate generation into CI/CD.

If you want, I can add the script to `package.json` or implement automatic meta tag injection into your templates.

```
