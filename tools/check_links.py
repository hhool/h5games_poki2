#!/usr/bin/env python3
import re,os
root='.'
IGNORE_DIRS = {'.history','dist','.venv','node_modules'}
html_files=[]
for dirpath,dirs,files in os.walk(root):
    # skip ignored directories
    parts = set(dirpath.split(os.sep))
    if parts & IGNORE_DIRS:
        continue
    for f in files:
        if f.endswith('.html'):
            html_files.append(os.path.join(dirpath,f))

link_re=re.compile(r'href\s*=\s*"([^"]+)"')
missing=[]
external_count=0
for hf in html_files:
    with open(hf,'r',encoding='utf-8',errors='ignore') as fh:
        txt=fh.read()
    for m in link_re.findall(txt):
        # strip fragments and query strings
        link=m.split('#')[0].split('?')[0]
        if link.startswith('http') or link.startswith('mailto:'):
            external_count+=1
            continue
        if link=='' or link.startswith('javascript:'):
            continue
        # treat root-relative paths (starting with '/') as repo-root relative
        if link.startswith('/'):
            rel = link.lstrip('/')
            # map '/' to 'index.html'
            if rel == '':
                rel = 'index.html'
            path = os.path.normpath(os.path.join(root, rel))
            # normalize repeated slashes (avoid index.html/index.html cases)
            if path.endswith(os.path.join('index.html','index.html')):
                path = path.rsplit(os.path.join('index.html','index.html'),1)[0] + os.path.join('index.html')
        else:
            path=os.path.normpath(os.path.join(os.path.dirname(hf),link))
        # if link points to directory (ends with /) check index.html
        # but don't double-append for the special root '/' which we map to index.html already
        if link.endswith('/') and link != '/':
            path=os.path.join(path,'index.html')
        if not os.path.exists(path):
            missing.append((hf,link,path))

print('Checked',len(html_files),'HTML files; found',len(missing),'missing local links; skipped',external_count,'external links')
if missing:
    print('\nMissing links:')
    for hf,link,path in missing:
        print(f'- In {hf}: "{link}" -> {path} (MISSING)')
