#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import subprocess
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITEMAP = ROOT / 'sitemap.xml'
OUT_CSV = ROOT / 'tools' / 'sitemap_html_report.csv'

if not SITEMAP.exists():
    print('sitemap.xml not found at', SITEMAP)
    raise SystemExit(1)

ns = {'ns0': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

tree = ET.parse(SITEMAP)
root = tree.getroot()

urls = []
for loc in root.findall('.//ns0:loc', ns):
    text = (loc.text or '').strip()
    if '.html' in text:
        urls.append(text)

print(f'Found {len(urls)} .html URLs in sitemap.xml')

results = []
for u in urls:
    # Use curl to follow redirects and report final code + effective URL
    cmd = ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code} %{url_effective}', '-L', u]
    try:
        out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL).strip()
    except subprocess.CalledProcessError as e:
        out = f'000 {u}'
    if out:
        parts = out.split(' ', 1)
        code = parts[0]
        eff = parts[1] if len(parts) > 1 else ''
    else:
        code = '000'
        eff = ''
    results.append((u, code, eff))
    print(u, code, '->', eff)

# write CSV
OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
with OUT_CSV.open('w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['url', 'http_code', 'effective_url'])
    w.writerows(results)

# summary
counts = {}
for _, code, _ in results:
    counts[code] = counts.get(code, 0) + 1

print('\nSummary:')
for code, cnt in sorted(counts.items(), key=lambda x: x[0]):
    print(code, cnt)

print('\nCSV report written to', OUT_CSV)
