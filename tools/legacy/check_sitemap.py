#!/usr/bin/env python3
"""Cross-check sitemap.xml vs games.json and dist/ pages."""
import re, json, os
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sitemap = open(os.path.join(ROOT, 'sitemap.xml')).read()
sitemap_slugs = set(re.findall(r'/game/[^/]+/([^/]+)/', sitemap))

games = json.load(open(os.path.join(ROOT, 'games.json')))

def slug(link):
    p = urlparse(link).path.strip('/')
    return p.split('/')[-1] if p else link

game_slugs = {slug(g['link']): g for g in games if g.get('show')}

print(f"Sitemap game URLs : {len(sitemap_slugs)}")
print(f"games.json show=true: {len(game_slugs)}")
print()

not_in_sitemap = {s: g for s, g in game_slugs.items() if s not in sitemap_slugs}
not_in_games   = sitemap_slugs - set(game_slugs)
missing_pages  = []
for url in re.findall(r'<loc>(https://poki2\.online/game/[^<]+)</loc>', sitemap):
    path = url.replace('https://play.poki2.online', '').strip('/')
    page = os.path.join(ROOT, 'dist', path, 'index.html')
    if not os.path.exists(page):
        missing_pages.append(url)

if not_in_sitemap:
    print(f"❌ In games.json (show=true) but NOT in sitemap ({len(not_in_sitemap)}):")
    for s, g in sorted(not_in_sitemap.items()):
        print(f"   {s}  ({g['title']})")
else:
    print("✅ All show=true games are in sitemap")

if not_in_games:
    print(f"\n❌ In sitemap but NOT in games.json ({len(not_in_games)}):")
    for s in sorted(not_in_games):
        print(f"   {s}")
else:
    print("✅ All sitemap slugs exist in games.json")

if missing_pages:
    print(f"\n❌ Sitemap URLs with no dist page ({len(missing_pages)}):")
    for u in missing_pages:
        print(f"   {u}")
else:
    print("✅ All sitemap URLs have a dist/game/.../index.html")
