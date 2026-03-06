const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST = process.argv[2] || 'dist';
const TEXT_EXTS = new Set(['.html','.js','.css','.json','.svg','.txt','.xml','.webmanifest','.map']);

function walk(dir) {
  const items = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      items.push(...walk(full));
    } else if (stat.isFile()) {
      items.push(full);
    }
  }
  return items;
}

function compressFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (!TEXT_EXTS.has(ext)) return; // skip images and other binary blobs
  if (file.endsWith('.br') || file.endsWith('.gz')) return;

  const data = fs.readFileSync(file);
  try {
    // gzip
    const gz = zlib.gzipSync(data, { level: zlib.constants.Z_BEST_COMPRESSION });
    fs.writeFileSync(file + '.gz', gz);
    fs.utimesSync(file + '.gz', fs.statSync(file).atime, fs.statSync(file).mtime);
    console.log('Wrote', path.relative(process.cwd(), file + '.gz'));
  } catch (e) {
    console.error('gzip failed', file, e.message);
  }

  try {
    // brotli
    const br = zlib.brotliCompressSync(data, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      }
    });
    fs.writeFileSync(file + '.br', br);
    fs.utimesSync(file + '.br', fs.statSync(file).atime, fs.statSync(file).mtime);
    console.log('Wrote', path.relative(process.cwd(), file + '.br'));
  } catch (e) {
    console.error('brotli failed', file, e.message);
  }
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('dist not found:', DIST);
    process.exit(1);
  }
  const files = walk(DIST);
  for (const f of files) {
    compressFile(f);
  }
  console.log('Precompression complete');
}

if (require.main === module) main();
