#!/usr/bin/env node
/*
  tools/generate-assets.js
  Usage: node tools/generate-assets.js --input games.json --out ./assets --concurrency 4

  Install:
    npm install puppeteer sharp p-limit yargs fs-extra
*/
const path = require('path');
const fse = require('fs-extra');
const sharp = require('sharp');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
// puppeteer can be an ESM-only package; import dynamically in main()

const argv = yargs(hideBin(process.argv))
  .option('input', { type: 'string', default: 'games.json', describe: 'Input games.json' })
  .option('out', { type: 'string', default: 'assets', describe: 'Output directory' })
  .option('concurrency', { type: 'number', default: 4 })
  .option('timeout', { type: 'number', default: 15000 })
  .option('base', { type: 'string', describe: 'Base URL to resolve relative paths (e.g. http://localhost:8000)' })
  .option('wait', { type: 'number', default: 9, describe: 'Seconds to wait after navigation before screenshot (default 9)' })
  .option('selector', { type: 'string', describe: 'CSS selector to screenshot (e.g. #game or canvas)' })
  .option('limit', { type: 'number', describe: 'Limit number of games to process (for testing)' })
  .option('force', { type: 'boolean', default: false, describe: 'Overwrite existing outputs' })
  .help()
  .argv;

const ICON_SIZES = [512, 256, 180, 32];
const COVER_SIZES = [{w:1920,h:1080},{w:1280,h:720},{w:800,h:450}];

function slugify(s){
  return s.toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^[-]+|[-]+$/g,'')
}

async function readGames(input){
  const data = await fse.readJson(input);
  if (!Array.isArray(data)) throw new Error('games.json must be an array');
  return data.map(g => ({ id: g.id || slugify(g.title||g.link||g.url||g.path||'game'), title: g.title||'', url: g.link || g.url || g.path || '', metadata: g }));
}

async function ensureDir(dir){ await fse.ensureDir(dir); }

async function captureAndProcess(browser, game, opts){
  const outBase = path.join(opts.out, game.id);
  await ensureDir(outBase);
  const meta = { id: game.id, title: game.title, url: game.url, start: new Date().toISOString() };

  const page = await browser.newPage();
  try{
    await page.setViewport({ width: 1280, height: 720 });
    // Resolve and validate target URL
    let targetUrl = (game.url || '').trim();
    if (!targetUrl && game.metadata && game.metadata.path) targetUrl = game.metadata.path;
    if (!targetUrl){
      throw new Error('Missing URL');
    }
    // If URL is relative (no scheme), try to resolve against opts.base
    try{
      // will throw if invalid
      new URL(targetUrl);
    }catch(e){
      if (opts.base){
        try{ targetUrl = new URL(targetUrl, opts.base).toString(); }catch(e2){ /* fallthrough */ }
      }
    }
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: opts.timeout });
    meta.attemptedUrl = targetUrl;
    meta.status = response && response.status ? response.status() : 200;
    // wait additional time for game to initialize (seconds)
    const waitSeconds = Number(opts.wait || 9);
    if (waitSeconds > 0){
      await page.waitForTimeout(waitSeconds * 1000);
    }

    let screenshotBuffer;
    if (opts.selector){
      const el = await page.$(opts.selector);
      if (el){
        screenshotBuffer = await el.screenshot({ type: 'png' });
      } else {
        screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
      }
    } else {
      screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
    }

    await fse.writeFile(path.join(outBase,'capture.png'), screenshotBuffer);

    // Icons: center-crop to square then resize
    const img = sharp(screenshotBuffer);
    const metadata = await img.metadata();
    const size = Math.min(metadata.width||1280, metadata.height||720);
    const square = img.resize({ width: size, height: size, fit: 'cover', position: 'centre' });
    for (const s of ICON_SIZES){
      const out = path.join(outBase, `icon-${s}.png`);
      if (!opts.force && await fse.pathExists(out)) continue;
      await square.clone().resize(s, s).png().toFile(out);
    }

    // Covers: generate landscape sizes using cover fit
    for (const sz of COVER_SIZES){
      const out = path.join(outBase, `cover-${sz.w}x${sz.h}.png`);
      if (!opts.force && await fse.pathExists(out)) continue;
      await sharp(screenshotBuffer).resize(sz.w, sz.h, { fit: 'cover', position: 'centre' }).png().toFile(out);
    }

    meta.end = new Date().toISOString();
    meta.success = true;
  }catch(err){
    meta.end = new Date().toISOString();
    meta.success = false;
    meta.error = err && err.message;
  }finally{
    try{ await page.close(); }catch(e){/* ignore */}
    await fse.writeJson(path.join(outBase,'meta.json'), meta, { spaces: 2 });
  }
  return meta;
}

async function main(){
  const games = await readGames(argv.input);
  const list = argv.limit ? games.slice(0, argv.limit) : games;
  await ensureDir(argv.out);

  // dynamically import Puppeteer (ESM) or fallback to Playwright Chromium
  let puppeteer;
  try{
    const mod = await import('puppeteer');
    puppeteer = mod.default || mod;
  }catch(e){
    try{
      // try Playwright Chromium as a fallback
      const mod = await import('playwright-chromium');
      puppeteer = {
        launch: opts => mod.chromium.launch(opts)
      };
    }catch(e2){
      throw new Error('Missing browser automation library. Install puppeteer or playwright-chromium: npm install puppeteer OR npm install playwright-chromium');
    }
  }

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  // p-limit is an ES module in newer versions; import dynamically to support CommonJS runtime
  const pLimitMod = await import('p-limit');
  const pLimit = pLimitMod.default || pLimitMod;
  const limit = pLimit(argv.concurrency);
  const tasks = list.map(game => limit(() => captureAndProcess(browser, game, { out: argv.out, selector: argv.selector, timeout: argv.timeout, force: argv.force, base: argv.base, wait: argv.wait })));

  const results = await Promise.all(tasks);
  await browser.close();
  const report = { generatedAt: new Date().toISOString(), total: results.length, results };
  await fse.writeJson(path.join(argv.out,'report.json'), report, { spaces: 2 });
  console.log('Done. Report written to', path.join(argv.out,'report.json'));
}

main().catch(err=>{ console.error(err); process.exitCode=1 });
