const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const glob = require('glob');

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(data).digest('hex').slice(0,8);
}

function revRename(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const hash = hashFile(filePath);
  const newName = `${base}.${hash}${ext}`;
  const newPath = path.join(dir, newName);
  fs.copyFileSync(filePath, newPath);
  return { original: filePath, rev: newPath };
}

(function() {
  const dist = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(dist)) { console.error('dist not found — run build scripts first'); process.exit(1); }
  const map = {};

  // 扫描 dist 下的静态资源（排除 map、rev-manifest、.DS_Store 等）
  const patterns = [
    '**/*.{js,css,png,jpg,jpeg,webp,svg,gif,ico,json,html,woff,woff2,ttf,eot,otf}'
  ];

  let files = [];
  for (const p of patterns) {
    files = files.concat(glob.sync(p, { cwd: dist, nodir: true }));
  }

  // 过滤：不要重命名已经是 rev 格式的文件，或 rev-manifest.json 自身，或 sourcemap 文件
  files = files.filter(f => {
    if (f === 'rev-manifest.json') return false;
    if (f.endsWith('.map')) return false;
    // 如果文件名已经包含 8 位十六进制哈希（例如 name.abcdef12.ext），跳过
    const base = path.basename(f);
    if (/\.[0-9a-f]{8}\./i.test(base)) return false;
    if (base === '.DS_Store') return false;
    return true;
  });

  for (const rel of files) {
    const f = path.join(dist, rel);
    if (!fs.existsSync(f)) continue;
    try {
      const r = revRename(f);
      map[rel] = path.relative(dist, r.rev);
      console.log(`Revved: ${rel} -> ${map[rel]}`);
    } catch (err) {
      console.error(`Failed to rev ${rel}:`, err.message);
    }
  }

  fs.writeFileSync(path.join(dist, 'rev-manifest.json'), JSON.stringify(map, null, 2));
  console.log('Wrote rev-manifest.json');
})();
