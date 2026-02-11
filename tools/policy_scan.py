#!/usr/bin/env python3
import os, re, sys

root='.'
IGNORE_DIRS = {'.history','dist','.venv','node_modules'}

adult_kw = ['porn','xxx','adult','sex','erotic','nude','nsfw']
copyright_kw = ['download full','full game','crack','torrent','warez','copyright']
suspicious_ext = ['.exe','.msi','.apk']

link_re = re.compile(r'href\s*=\s*"([^"]+)"', re.I)
src_re = re.compile(r'(?:src|data-src)\s*=\s*"([^"]+)"', re.I)
base64_re = re.compile(r'[A-Za-z0-9+/]{120,}={0,2}')

findings = {
    'adult': [],
    'copyright': [],
    'suspicious_links': [],
    'external_scripts': {},
    'obfuscated_strings': []
}

def is_ignored(path):
    parts = set(path.split(os.sep))
    return bool(parts & IGNORE_DIRS)

def scan_file(path):
    try:
        with open(path,'r',encoding='utf-8',errors='ignore') as fh:
            txt = fh.read().lower()
    except Exception as e:
        return
    # keywords
    for kw in adult_kw:
        if kw in txt:
            findings['adult'].append((path, kw))
    for kw in copyright_kw:
        if kw in txt:
            findings['copyright'].append((path, kw))
    # links and src
    for m in link_re.findall(txt)+src_re.findall(txt):
        link = m.split('#')[0].split('?')[0]
        if not link:
            continue
        # suspicious file extensions
        for ext in suspicious_ext:
            if link.lower().endswith(ext):
                findings['suspicious_links'].append((path, link))
        # external scripts/domains
        if link.startswith('http://') or link.startswith('https://'):
            host = re.sub(r'^https?://','',link).split('/')[0]
            findings['external_scripts'].setdefault(host,0)
            findings['external_scripts'][host]+=1
        # plain IP addresses in links
        if re.search(r'https?://\d+\.\d+\.\d+\.\d+', link):
            findings['suspicious_links'].append((path, link))
    # obfuscated/base64 long strings
    for b64 in base64_re.findall(txt):
        findings['obfuscated_strings'].append((path, b64[:120]))

def main():
    files_scanned=0
    for dirpath,dirs,files in os.walk(root):
        if is_ignored(dirpath):
            continue
        for f in files:
            if f.endswith(('.html','.htm','.js','.css')):
                p = os.path.join(dirpath,f)
                scan_file(p)
                files_scanned+=1

    out = []
    out.append(f"Scanned {files_scanned} files\n")
    out.append("Adult-keyword hits: %d\n" % len(findings['adult']))
    for p,k in findings['adult'][:50]:
        out.append(f"- {p}: '{k}'\n")
    out.append("\nCopyright/Download-related hits: %d\n" % len(findings['copyright']))
    for p,k in findings['copyright'][:50]:
        out.append(f"- {p}: '{k}'\n")
    out.append("\nSuspicious links (exe/msi/apk or IP hosts): %d\n" % len(findings['suspicious_links']))
    for p,l in findings['suspicious_links'][:50]:
        out.append(f"- {p}: {l}\n")
    out.append("\nExternal script/asset hosts (top 50):\n")
    for host,count in sorted(findings['external_scripts'].items(), key=lambda x:-x[1])[:50]:
        out.append(f"- {host}: {count}\n")
    out.append("\nPotential obfuscated/base64 strings found: %d\n" % len(findings['obfuscated_strings']))
    for p,s in findings['obfuscated_strings'][:20]:
        out.append(f"- {p}: {s}...\n")

    report = ''.join(out)
    print(report)
    with open('tools/policy-scan-report.txt','w',encoding='utf-8') as fo:
        fo.write(report)

if __name__=='__main__':
    main()
