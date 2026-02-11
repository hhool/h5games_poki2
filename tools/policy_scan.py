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

img_re = re.compile(r'<img[^>]+>', re.I)
src_attr_re = re.compile(r'src\s*=\s*["\']([^"\']+)["\']', re.I)
alt_attr_re = re.compile(r'alt\s*=\s*["\']([^"\']*)["\']', re.I)
from difflib import SequenceMatcher

page_texts = {}
duplicate_groups = {}
image_hosts = {}
images_missing_alt = []

known_stock_hosts = ['unsplash.com','images.unsplash.com','pexels.com','pixabay.com','shutterstock.com']

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
    # images: find <img> tags
    for tag in img_re.findall(txt):
        srcm = src_attr_re.search(tag)
        altm = alt_attr_re.search(tag)
        if srcm:
            src = srcm.group(1)
            if src.startswith('http://') or src.startswith('https://'):
                host = re.sub(r'^https?://','',src).split('/')[0]
                image_hosts.setdefault(host,0)
                image_hosts[host]+=1
                # flag known stock hosts
                for kh in known_stock_hosts:
                    if kh in host:
                        findings.setdefault('stock_images',[]).append((path,src))
        # missing alt
        if not altm:
            images_missing_alt.append((path, tag[:120]))
    # capture normalized page text for duplicate detection
    text_only = re.sub(r'<script[^>]*>.*?</script>','',txt,flags=re.S)
    text_only = re.sub(r'<style[^>]*>.*?</style>','',text_only,flags=re.S)
    text_only = re.sub(r'<[^>]+>',' ',text_only)
    text_only = re.sub(r'\s+',' ',text_only).strip()
    page_texts[path] = text_only

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

    # report image findings
    out.append(f"\nImages missing alt attribute: {len(images_missing_alt)}\n")
    for p,t in images_missing_alt[:50]:
        out.append(f"- {p}: {t}\n")
    out.append(f"\nImage hosts (top 50):\n")
    for host,count in sorted(image_hosts.items(), key=lambda x:-x[1])[:50]:
        out.append(f"- {host}: {count}\n")
    if findings.get('stock_images'):
        out.append(f"\nDetected stock image hosts (examples): {len(findings['stock_images'])}\n")
        for p,src in findings['stock_images'][:50]:
            out.append(f"- {p}: {src}\n")

    # duplicate/near-duplicate detection
    hashes = {}
    for p,t in page_texts.items():
        h = hash(t)
        hashes.setdefault(h,[]).append(p)
    # exact duplicates
    dup_count = 0
    for h,files in hashes.items():
        if len(files)>1:
            dup_count += len(files)
            out.append(f"\nExact duplicate pages (content hash): {len(files)}\n")
            for f in files:
                out.append(f"- {f}\n")
    # near duplicates via SequenceMatcher
    near_dups = []
    paths = list(page_texts.keys())
    for i in range(len(paths)):
        for j in range(i+1,len(paths)):
            a = page_texts[paths[i]]
            b = page_texts[paths[j]]
            if not a or not b:
                continue
            ratio = SequenceMatcher(None,a,b).ratio()
            if ratio>0.90 and (paths[i],paths[j],ratio) not in near_dups:
                near_dups.append((paths[i],paths[j],ratio))
    out.append(f"\nNear-duplicate page pairs (>0.90): {len(near_dups)}\n")
    for a,b,r in near_dups[:100]:
        out.append(f"- {a} <=> {b}: similarity={r:.2f}\n")

    report = ''.join(out)
    print(report)
    with open('tools/policy-scan-report.txt','w',encoding='utf-8') as fo:
        fo.write(report)

if __name__=='__main__':
    main()
