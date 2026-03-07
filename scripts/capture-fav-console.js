const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => {
    const text = `[console:${msg.type()}] ${msg.text()}`;
    console.log(text);
    out.push(text);
  });
  page.on('pageerror', err => {
    const text = `[pageerror] ${err.toString()}`;
    console.log(text);
    out.push(text);
  });

  const base = 'http://localhost:8090';

  // Helper to wait for network/idle
  const nav = async (path) => {
    console.log('NAV', path);
    out.push('NAV ' + path);
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
  };

  // Flow 1: root -> sidebar favorites
  await nav('/');
  try {
    await page.click('#menu-btn');
    await page.waitForSelector('[data-tag="__favs"]', { timeout: 2000 });
    await page.click('[data-tag="__favs"]');
    await page.waitForTimeout(300);
  } catch (e) { console.log('flow1 error', e); }

  // Flow 2: root -> game-area favorites (tag-chips)
  await nav('/');
  try {
    await page.waitForSelector('[data-chip="__favs"]', { timeout: 2000 });
    await page.click('[data-chip="__favs"]');
    await page.waitForTimeout(300);
  } catch (e) { console.log('flow2 error', e); }

  // Flow 3: /tag/shooting/ -> sidebar favorites
  await nav('/tag/shooting/');
  try {
    await page.click('#menu-btn');
    await page.waitForSelector('[data-tag="__favs"]', { timeout: 2000 });
    await page.click('[data-tag="__favs"]');
    await page.waitForTimeout(300);
  } catch (e) { console.log('flow3 error', e); }

  // Flow 4: /tag/shooting/ -> game-area favorites
  await nav('/tag/shooting/');
  try {
    await page.waitForSelector('[data-chip="__favs"]', { timeout: 2000 });
    await page.click('[data-chip="__favs"]');
    await page.waitForTimeout(300);
  } catch (e) { console.log('flow4 error', e); }

  // Flow 5: game-area All click -> click All chip
  await nav('/');
  try {
    await page.waitForSelector('[data-chip="__all"]', { timeout: 2000 });
    await page.click('[data-chip="__all"]');
    await page.waitForTimeout(300);
  } catch (e) { console.log('flow5 error', e); }

  // Flow 6: sidebar Home click (note: this navigates to external canonical domain)
  await nav('/');
  try {
    await page.click('#menu-btn');
    await page.waitForSelector('[data-tag="__home"]', { timeout: 2000 });
    // Intercept navigation so we can capture console before leaving
    page.on('framenavigated', frame => {
      const text = '[nav] navigated to ' + frame.url();
      console.log(text);
      out.push(text);
    });
    await page.click('[data-tag="__home"]');
    await page.waitForTimeout(300);
  } catch (e) { console.log('flow6 error', e); }

  // Save logs
  fs.writeFileSync('/tmp/poki2_console_log.txt', out.join('\n'));
  console.log('WROTE /tmp/poki2_console_log.txt');
  await browser.close();
})();
