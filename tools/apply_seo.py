#!/usr/bin/env python3
"""
Apply generated SEO head content from `dist_seo_*` into real game `index.html` files.

Usage:
  python3 tools/apply_seo.py --source dist_seo_c --target /path/to/shards/c

This will, for each directory present in `--source`, extract the <head>...</head>
from the generated landing page and replace the <head> in the target's
`index.html`. A backup is created at `index.html.seo.bak`.
"""
import argparse
import os
import re
import shutil
from glob import glob


def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def write(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(data)


def extract_head(html):
    m = re.search(r'<head[\s\S]*?>[\s\S]*?</head>', html, re.IGNORECASE)
    if m:
        return m.group(0)
    return None


def replace_head(target_html, new_head):
    if re.search(r'<head[\s\S]*?>[\s\S]*?</head>', target_html, re.IGNORECASE):
        return re.sub(r'<head[\s\S]*?>[\s\S]*?</head>', new_head, target_html, flags=re.IGNORECASE)
    # if no head, insert before <body>
    if '<body' in target_html.lower():
        return re.sub(r'(<body[\s\S]*?>)', new_head + '\n\1', target_html, count=1, flags=re.IGNORECASE)
    # fallback: prepend
    return new_head + '\n' + target_html


def ensure_ad_placeholder_and_inject(html, name):
    """Ensure a top ad placeholder exists and inject a small ad-loader script into the head.
    The ad loader is intentionally generic; replace the URL with your real ad vendor snippet.
    """
    # inject simple ad placeholder after opening <body>
    body_open = re.search(r'<body[\s\S]*?>', html, re.IGNORECASE)
    if body_open:
        insert_pos = body_open.end()
        if 'id="ad-slot-top"' not in html:
            placeholder = '\n  <div id="ad-slot-top" class="ad-slot" aria-hidden="true"></div>\n'
            html = html[:insert_pos] + placeholder + html[insert_pos:]

    # ensure ad loader script in head
    head_open = re.search(r'<head[\s\S]*?>', html, re.IGNORECASE)
    if head_open and 'data-seo-ad-loader' not in html:
        # lightweight generic loader; swap src to your real ad library (e.g., AdSense) and add publisher id
        ad_loader = ('\n  <script data-seo-ad-loader>\n'
                     "    (function(){\n"
                     "      try{\n"
                     "        var s=document.createElement('script');\n"
                     "        s.src='https://cdn.example-ads/publisher.js';\n"
                     "        s.async=true;\n"
                     "        document.head.appendChild(s);\n"
                     "      }catch(e){}\n"
                     "    })();\n"
                     '  </script>\n')
        insert_pos = head_open.end()
        html = html[:insert_pos] + ad_loader + html[insert_pos:]

    return html


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, help='Generated SEO folder (e.g., dist_seo_c)')
    parser.add_argument('--target', required=True, help='Real shards folder (e.g., /path/to/shards/c)')
    parser.add_argument('--commit', action='store_true', help='Commit changes to git')
    args = parser.parse_args()

    src = args.source
    tgt = args.target

    # canonical target on the main site (adjust if your main-site path differs)
    MAIN_CANONICAL_PREFIX = 'https://poki2.online/games/'

    if not os.path.isdir(src):
        print('source not found:', src)
        return
    if not os.path.isdir(tgt):
        print('target not found:', tgt)
        return

    modified = []

    for name in sorted(os.listdir(src)):
        src_index = os.path.join(src, name, 'index.html')
        tgt_index = os.path.join(tgt, name, 'index.html')
        if not os.path.exists(src_index):
            continue
        if not os.path.exists(tgt_index):
            print('target index.html missing, skipping:', tgt_index)
            continue

        gen_html = read(src_index)
        new_head = extract_head(gen_html)
        if not new_head:
            print('no head in generated for', name)
            continue

        # rewrite canonical to point to the main site so search engines prefer the canonical origin
        try:
            canonical_href = MAIN_CANONICAL_PREFIX + name + '/'
            # replace existing canonical if present
            if re.search(r'<link[^>]+rel=["\']canonical["\'][^>]*>', new_head, re.IGNORECASE):
                new_head = re.sub(r'<link[^>]+rel=["\']canonical["\'][^>]*>', f'<link rel="canonical" href="{canonical_href}">', new_head, flags=re.IGNORECASE)
            else:
                # inject before </head>
                new_head = new_head.replace('</head>', f'  <link rel="canonical" href="{canonical_href}">\n</head>')
        except Exception:
            pass

        orig_html = read(tgt_index)
        new_html = replace_head(orig_html, new_head)

        # ensure ad placeholder and lightweight ad loader are present
        new_html = ensure_ad_placeholder_and_inject(new_html, name)

        # backup
        bak = tgt_index + '.seo.bak'
        if not os.path.exists(bak):
            shutil.copy2(tgt_index, bak)

        write(tgt_index, new_html)
        modified.append(tgt_index)
        print('patched', tgt_index)

    print(f'Patched {len(modified)} files')

    if args.commit and modified:
        import subprocess
        subprocess.run(['git', 'add'] + modified)
        subprocess.run(['git', 'commit', '-m', 'chore(seo): inject meta/og/json-ld into game pages'])
        print('Committed changes')


if __name__ == '__main__':
    main()
