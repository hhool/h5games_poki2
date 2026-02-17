# Tools

This folder contains small utility scripts used by the project.

## purge-cloudflare.sh

Safe helper to purge Cloudflare cache for the project's `dist/` assets.

Highlights:
- Supports targeted purge of specific file URLs (`--files` or `--file-list`).
- Supports full purge (`--all`) — use with caution.
- Accepts credentials via `CF_ZONE` and `CF_TOKEN` environment variables or `--zone` / `--token` flags.
- Prints Cloudflare API JSON response and exit code for scripting.

Examples

- Targeted purge (using env vars):
```bash
export CF_ZONE="9a6678176bc61eaad08424813ad27fed"
export CF_TOKEN="<API_TOKEN>"
tools/purge-cloudflare.sh --files "https://poki2.online/css/styles.css,https://poki2.online/js/app.bundle.js"
```

- Targeted purge from a file (one URL per line):
```bash
tools/purge-cloudflare.sh --file-list tools/urls-to-purge.txt --zone 9a6678176bc61eaad08424813ad27fed --token <API_TOKEN>
```

- Full purge (use with extreme caution):
```bash
tools/purge-cloudflare.sh --all --zone 9a6678176bc61eaad08424813ad27fed --token <API_TOKEN>
```

Security notes

- The script expects an API Token with `Zone.Cache Purge` permissions. Do not paste long-lived global API keys in public places.
- Prefer targeted purges (file list) over `--all` to reduce cache churn and avoid wide traffic spikes.

Dependencies

- `curl` and `python3` (used to format JSON output). Both are commonly available on macOS and Linux.

If you want, I can also add a small example `tools/urls-to-purge.txt` listing the specific `dist/` files to purge after builds.
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

