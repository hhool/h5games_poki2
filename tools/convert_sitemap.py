#!/usr/bin/env python3
"""
Convert existing sitemap.xml entries that use query-style game links
to path-style /games/<slug>/ and emit a redirect map for review.

Usage:
  python3 tools/convert_sitemap.py

Outputs:
  - sitemap.new.xml   (updated sitemap)
  - redirects-old-query.txt (list of old -> new)
"""
import re
import sys
from xml.etree import ElementTree as ET

IN = 'sitemap.xml'
OUT = 'sitemap.new.xml'
REDIR = 'redirects-old-query.txt'

def main():
    try:
        tree = ET.parse(IN)
    except Exception as e:
        print('Error reading', IN, e)
        sys.exit(1)
    root = tree.getroot()
    ns = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

    redirects = []
    for url in root.findall('ns:url', ns):
        loc = url.find('ns:loc', ns)
        if loc is None or not loc.text:
            continue
        text = loc.text
        m = re.search(r'[?&](?:play-|play=|game=|id=)([A-Za-z0-9\-_]+)', text)
        if m:
            slug = m.group(1)
            new = f'https://{get_host()}/games/{slug}/'
            loc.text = new
            redirects.append((text, new))

    tree.write(OUT, encoding='utf-8', xml_declaration=True)
    with open(REDIR, 'w', encoding='utf-8') as f:
        for old, new in redirects:
            f.write(f"{old} -> {new}\n")
    print('Wrote', OUT, 'and', REDIR)

def get_host():
    # default host — replace if necessary
    return 'poki2.online'

if __name__ == '__main__':
    main()
