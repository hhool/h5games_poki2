#!/usr/bin/env python3
"""
Generate sample SEO landing pages, sitemap.xml and robots.txt for a games folder.

Usage:
  python3 tools/generate_seo.py --input shards/c --domain https://c.poki2.online --output dist_seo_c

This scans immediate subdirectories for `index.html` and creates a small
landing HTML (with meta, OG, JSON-LD) into the output folder, plus a
sitemap.xml and robots.txt referencing the sitemap.
"""
import argparse
import os
import re
import sys
from datetime import date
from urllib.parse import urljoin


def read_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception:
        return ''


def slugify(name):
    return re.sub(r'[^a-z0-9\-]', '-', name.lower())


def extract_title(html, fallback):
    m = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1).strip()
    return fallback


def find_preview_image(dirpath):
    # common locations
    candidates = ['thumbnail.jpg', 'thumbnail.png', 'preview.jpg', 'preview.png', 'images/thumbnail.jpg']
    for c in candidates:
        p = os.path.join(dirpath, c)
        if os.path.exists(p):
            return c
    # try any image in images/
    imgs = []
    imgdir = os.path.join(dirpath, 'images')
    if os.path.isdir(imgdir):
        for f in os.listdir(imgdir):
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                imgs.append(os.path.join('images', f))
    if imgs:
        return imgs[0]
    return None


def make_landing(domain, rel_url, title, description, image):
    full_url = urljoin(domain.rstrip('/') + '/', rel_url.lstrip('/'))
    image_url = urljoin(full_url, image) if image else ''
    desc = description or f"Play {title} free on {domain}"
    ld = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": title,
        "description": desc,
        "url": full_url,
        "image": image_url,
        "operatingSystem": "Web",
        "applicationCategory": "Game"
    }
    ld_json = str(ld).replace("'", '"')

    head = f"""<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{full_url}">
  <meta property="og:type" content="game">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{full_url}">
  {('<meta property="og:image" content="%s">' % image_url) if image_url else ''}
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{ld_json}</script>
</head>"""

    body = f"""<body>
  <h1>{title}</h1>
  <p>{desc}</p>
  <p><a href="{full_url}" target="_blank" rel="noopener">Open game page</a></p>
</body>"""

    return f"<!doctype html>\n<html lang=\"en\">\n{head}\n{body}\n</html>\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, help='Input folder (e.g., shards/c)')
    parser.add_argument('--domain', required=True, help='Base domain (e.g., https://c.poki2.online)')
    parser.add_argument('--output', required=True, help='Output folder to write generated files')
    args = parser.parse_args()

    inp = args.input
    domain = args.domain.rstrip('/')
    out = args.output
    os.makedirs(out, exist_ok=True)

    urls = []

    for name in sorted(os.listdir(inp)):
        path = os.path.join(inp, name)
        if not os.path.isdir(path):
            continue
        index = os.path.join(path, 'index.html')
        if not os.path.exists(index):
            continue
        html = read_file(index)
        title = extract_title(html, name)
        desc = ''
        m = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
        if m:
            desc = m.group(1).strip()
        image = find_preview_image(path)
        rel_url = f"/{name}/"
        landing = make_landing(domain, rel_url, title, desc, image)
        out_dir = os.path.join(out, name)
        os.makedirs(out_dir, exist_ok=True)
        landing_path = os.path.join(out_dir, 'index.html')
        with open(landing_path, 'w', encoding='utf-8') as f:
            f.write(landing)
        urls.append((rel_url, title))

    # sitemap
    sitemap_path = os.path.join(out, 'sitemap.xml')
    today = date.today().isoformat()
    with open(sitemap_path, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for rel, title in urls:
            loc = domain + rel
            f.write('  <url>\n')
            f.write(f'    <loc>{loc}</loc>\n')
            f.write(f'    <lastmod>{today}</lastmod>\n')
            f.write('    <changefreq>monthly</changefreq>\n')
            f.write('    <priority>0.7</priority>\n')
            f.write('  </url>\n')
        f.write('</urlset>\n')

    # robots.txt
    robots_path = os.path.join(out, 'robots.txt')
    with open(robots_path, 'w', encoding='utf-8') as f:
        f.write('User-agent: *\n')
        f.write('Allow: /\n')
        f.write(f'Sitemap: {domain}/sitemap.xml\n')

    print(f'Wrote {len(urls)} landing pages to {out} (sitemap+robots included)')


if __name__ == '__main__':
    main()
