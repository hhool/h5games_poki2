#!/usr/bin/env node
// Simple static file server with on-the-fly gzip/brotli compression
// Usage: node scripts/serve-compressed.js -p 8080 -d dist

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const args = process.argv.slice(2);
const portIndex = args.indexOf('-p') !== -1 ? args.indexOf('-p') + 1 : args.indexOf('--port') + 1;
const port = (portIndex && args[portIndex]) ? parseInt(args[portIndex], 10) : 8080;
const dirIndex = args.indexOf('-d') !== -1 ? args.indexOf('-d') + 1 : args.indexOf('--dir') + 1;
const baseDir = (dirIndex && args[dirIndex]) ? args[dirIndex] : 'dist';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function sendNotFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
}

function sendFile(filePath, stat, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mime[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=0');

  const accept = req.headers['accept-encoding'] || '';
  // Prefer brotli when supported and available in Node
  if (accept.includes('br') && typeof zlib.createBrotliCompress === 'function') {
    res.setHeader('Content-Encoding', 'br');
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => sendNotFound(res));
    stream.pipe(zlib.createBrotliCompress()).pipe(res);
    return;
  }

  if (accept.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => sendNotFound(res));
    stream.pipe(zlib.createGzip()).pipe(res);
    return;
  }

  // No compression
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => sendNotFound(res));
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  try {
    const parsed = url.parse(req.url || '/');
    let pathname = decodeURIComponent(parsed.pathname || '/');
    if (pathname.endsWith('/')) pathname += 'index.html';
    const safePath = path.normalize(path.join(process.cwd(), baseDir, pathname));
    if (!safePath.startsWith(path.join(process.cwd(), baseDir))) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    fs.stat(safePath, (err, stat) => {
      if (err || !stat.isFile()) return sendNotFound(res);
      sendFile(safePath, stat, req, res);
    });
  } catch (e) {
    res.statusCode = 500;
    res.end('Server error');
  }
});

server.listen(port, () => {
  console.log(`Serving ${baseDir} on http://localhost:${port} (brotli/gzip enabled)`);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
});
