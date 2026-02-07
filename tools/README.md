Sitemap generator
=================

This small tool generates `sitemap.xml` for the project by scanning local HTML files and the `games.json` list.

Usage
-----

1. Install dependencies (only required once):

```bash
npm install minimist glob
```

2. Run the generator:

```bash
node tools/generate-sitemap.js --base https://poki2.online --hash
```

Options
-------

- `--base` : Base URL for the site (default: `https://poki2.online`).
- `--hash` : Include game URLs as hash routes (default: true). Use `--no-hash` to disable.
- `--out`  : Output file path (default: `./sitemap.xml`).

Notes
-----

- The script scans `**/*.html` (ignores `tools/` and node modules) and appends one entry per game in `games.json`.
- You can customize the script if you want different priorities, changefreq, or to exclude certain pages.

