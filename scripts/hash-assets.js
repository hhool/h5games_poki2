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
  const files = [
    path.join(dist, 'js', 'app.bundle.js'),
    path.join(dist, 'css', 'styles.css'),
    // Include PWA files
    path.join(dist, 'sw.js'),
    path.join(dist, 'manifest.json'),
    // 包含图像文件
    ...glob.sync('**/*.{png,jpg,jpeg,webp}', { cwd: dist }).map(f => path.join(dist, f))
  ];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const r = revRename(f);
    map[path.relative(dist, r.original)] = path.relative(dist, r.rev);
  }
  fs.writeFileSync(path.join(dist, 'rev-manifest.json'), JSON.stringify(map, null, 2));
  console.log('Wrote rev-manifest.json');
})();
