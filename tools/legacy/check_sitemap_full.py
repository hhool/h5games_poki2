#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import subprocess
import csv
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITEMAP = ROOT / 'sitemap.xml'
OUT_CSV = ROOT / 'tools' / 'sitemap_full_report.csv'
LOCAL_INDEX = ROOT / 'index.html'

if not SITEMAP.exists():
    print('sitemap.xml not found at', SITEMAP)
    raise SystemExit(1)
if not LOCAL_INDEX.exists():
    print('Local index.html not found at', LOCAL_INDEX)
    raise SystemExit(1)

with LOCAL_INDEX.open('rb') as f:
    local_index_hash = hashlib.sha256(f.read()).hexdigest()

ns = {'ns0': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

tree = ET.parse(SITEMAP)
root = tree.getroot()

urls = []
for loc in root.findall('.//ns0:loc', ns):
    text = (loc.text or '').strip()
    if text:
        urls.append(text)

print(f'Found {len(urls)} URLs in sitemap.xml')

results = []
for u in urls:
    # get final http code and effective url
    cmd_code = ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code} %{url_effective}', '-L', u]
    try:
        out = subprocess.check_output(cmd_code, text=True, stderr=subprocess.DEVNULL).strip()
    except subprocess.CalledProcessError:
        out = '000 '
    parts = out.split(' ', 1)
    code = parts[0]
    eff = parts[1] if len(parts) > 1 else ''

    # fetch body
    cmd_body = ['curl', '-s', '-L', u]
    try:
        body = subprocess.check_output(cmd_body)
    except subprocess.CalledProcessError:
        body = b''
    body_hash = hashlib.sha256(body).hexdigest()
    is_index = (body_hash == local_index_hash)
    note = ''
    if is_index:
        note = 'served_index'
    elif code.startswith('3'):
        note = 'redirect'
    elif code == '200':
        note = 'ok'
    else:
        note = 'other'

    results.append((u, code, eff, body_hash, str(is_index), note))
    print(u, code, eff, 'index=', is_index)

# write CSV
OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
with OUT_CSV.open('w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['url', 'http_code', 'effective_url', 'body_sha256', 'is_index', 'note'])
    w.writerows(results)

# summary
counts = {}
for _, code, _, _, is_index, _ in results:
    counts['code_'+code] = counts.get('code_'+code, 0) + 1
    counts['index_'+is_index] = counts.get('index_'+is_index, 0) + 1

print('\nSummary:')
for k, v in sorted(counts.items()):
    print(k, v)

print('\nCSV report written to', OUT_CSV)
