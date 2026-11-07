// Playwright screenshot matrix for the responsive UI (dev-only).
// Usage: npm run shots            (all devices)
//        npm run shots -- --only=iphone-15-pro
// Simulated safe-area insets override --sa-*; unsafe bands are hatched red in the captures.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const out = path.join(root, '.shots');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
// Insets are [top, right, bottom, left] in CSS px.
const DEVICES = [
  { name: 'iphone-se', width: 375, height: 667, dpr: 2, touch: true, portrait: [20, 0, 0, 0], landscape: [0, 0, 0, 0] },
  { name: 'iphone-15-pro', width: 393, height: 852, dpr: 3, touch: true, portrait: [59, 0, 34, 0], landscape: [0, 59, 21, 59] },
  { name: 'iphone-15-pro-max', width: 430, height: 932, dpr: 3, touch: true, portrait: [59, 0, 34, 0], landscape: [0, 59, 21, 59] },
  { name: 'ipad', width: 820, height: 1180, dpr: 2, touch: true, portrait: [24, 0, 20, 0], landscape: [24, 0, 20, 0] },
  { name: '720p', width: 1280, height: 720, dpr: 1, landscape: [0, 0, 0, 0] },
  { name: '1080p', width: 1920, height: 1080, dpr: 1, landscape: [0, 0, 0, 0] },
  { name: '1440p', width: 2560, height: 1440, dpr: 1, landscape: [0, 0, 0, 0] },
  { name: '4k', width: 3840, height: 2160, dpr: 1, landscape: [0, 0, 0, 0] }
];
const MENU_SCREENS = ['dex', 'shop', 'bag', 'gacha', 'goals', 'friends', 'rank', 'settings'];
const STATIC_SCREENS = ['scr-legal', 'scr-news', 'scr-support', 'scr-nick', 'scr-recover', 'scr-lobby', 'scr-evolution', 'scr-profile'];

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, 'localhost', () => resolve(server)));
}

const visible = (page, selector, timeout = 8000) => page.waitForSelector(selector + ':not(.hidden)', { state: 'visible', timeout });

async function step(page, dir, name, action) {
  try {
    if (action) await action();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, name + '.png') });
    console.log('  ok  ' + name);
  } catch (error) {
    console.log('  --  ' + name + ': ' + error.message.split('\n')[0]);
    await page.screenshot({ path: path.join(dir, name + '-FAIL.png') }).catch(() => {});
  }
}

async function toMenu(page) {
  await page.keyboard.press('Escape');
  await visible(page, '#scr-menu', 2000).catch(() => page.click('#town-menu').catch(() => {}));
}

// Level-ups, items and bonds appear at random during a run; pick the first card of whichever is open.
async function dismissChoices(page) {
  for (const selector of ['#cards .card', '#item-cards .card', '#bond-cards .card']) {
    const card = await page.$(selector);
    if (card && await card.isVisible()) await card.click().catch(() => {});
  }
}

async function openPause(page) {
  await dismissChoices(page);
  await page.keyboard.press('Escape');
  await visible(page, '#scr-pause', 4000).catch(async () => {
    await dismissChoices(page);
    await page.keyboard.press('Escape');
    await visible(page, '#scr-pause');
  });
}

async function capture(browser, base, device, orientation) {
  const portrait = orientation === 'portrait';
  const long = Math.max(device.width, device.height), short = Math.min(device.width, device.height);
  const [width, height] = portrait ? [short, long] : [long, short];
  const insets = device[orientation];
  const dir = path.join(out, `${device.name}-${orientation}`);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: device.dpr,
    isMobile: Boolean(device.touch), hasTouch: Boolean(device.touch), serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(([t, r, b, l]) => {
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      const hatch = 'position:fixed;z-index:2147483647;pointer-events:none;background:repeating-linear-gradient(45deg,rgba(255,0,80,.4) 0 6px,transparent 6px 12px)';
      style.textContent = `:root{--sa-top:${t}px;--sa-right:${r}px;--sa-bottom:${b}px;--sa-left:${l}px}`;
      document.head.append(style);
      for (const css of [t && `top:0;left:0;right:0;height:${t}px`, r && `top:0;bottom:0;right:0;width:${r}px`,
        b && `left:0;right:0;bottom:0;height:${b}px`, l && `top:0;bottom:0;left:0;width:${l}px`].filter(Boolean)) {
        const band = document.createElement('div');
        band.style.cssText = hatch + ';' + css;
        document.body.append(band);
      }
    });
  }, insets);
  console.log(`${device.name} ${orientation} (${width}x${height})`);
  await page.goto(base + '/index.html');
  await step(page, dir, '01-login', async () => {
    const tap = await page.waitForSelector('#tap-start:not(.hidden)', { timeout: 15000 }).catch(() => null);
    if (tap) await tap.click();
    await visible(page, '#scr-login', 20000);
  });
  await step(page, dir, '02-starters', async () => { await page.click('#btn-guest'); await visible(page, '#scr-starters', 20000); });
  await step(page, dir, '03-tutorial', async () => {
    await page.click('#starter-grid .starter-card');
    await page.click('#starter-ok');
    await visible(page, '#tutorial-panel', 20000);
  });
  await step(page, dir, '03-initial-build', async () => {
    await page.click('#tutorial-skip');
    await visible(page, '#scr-training', 20000);
  });
  await step(page, dir, '03-town', async () => {
    await page.click('#training-finish');
    await visible(page, '#scr-town', 20000);
  });
  await step(page, dir, '04-menu', async () => { await page.click('#town-menu'); await visible(page, '#scr-menu'); });
  if (device.touch && await page.isVisible('#topbar-more')) {
    await step(page, dir, '05-topbar-more', () => page.click('#topbar-more'));
    await page.keyboard.press('Escape');
  }
  for (const [index, go] of MENU_SCREENS.entries()) {
    await step(page, dir, `1${index}-${go}`, async () => { await page.click(`#scr-menu [data-go="${go}"]`); await page.waitForTimeout(600); });
    await toMenu(page);
  }
  await step(page, dir, '20-training', async () => { await page.click('#menu-training'); await visible(page, '#scr-training'); });
  await toMenu(page);
  for (const id of STATIC_SCREENS) {
    await step(page, dir, '30-' + id, () => page.evaluate(target => document.getElementById(target).classList.remove('hidden'), id));
    await page.evaluate(target => document.getElementById(target).classList.add('hidden'), id);
  }
  await step(page, dir, '40-play-setup', async () => { await page.click('#scr-menu [data-go="play"]'); await page.waitForTimeout(1200); });
  await step(page, dir, '41-run-hud', async () => {
    const start = await page.$('#training-play:not(.hidden)');
    if (start) await start.click();
    await page.waitForTimeout(4000);
  });
  await step(page, dir, '42-level-up', () => visible(page, '#scr-levelup', 45000));
  // With nobody steering, the partner can faint before the pause step; then go straight to the results.
  const over = () => page.isVisible('#scr-over');
  if (!(await over())) await step(page, dir, '43-pause', () => openPause(page));
  await step(page, dir, '44-results', async () => {
    if (!(await over())) await page.click('#btn-quit');
    await visible(page, '#scr-over', 15000);
  });
  await step(page, dir, '45-xp-progress', async () => { await page.click('#btn-again'); await visible(page, '#scr-progress', 15000); });
  await context.close();
}

(async () => {
  const only = (process.argv.find(arg => arg.startsWith('--only=')) || '').slice('--only='.length);
  fs.rmSync(out, { recursive: true, force: true });
  const server = await serve();
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const device of DEVICES.filter(d => !only || d.name === only)) {
      for (const orientation of ['portrait', 'landscape']) if (device[orientation]) await capture(browser, base, device, orientation);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log('Screenshots in ' + out);
})();
