// Layouts chosen by their sizes (7.3, 7.4) in a real browser, on the ad fixture (engine/v2/tests/layout-fixture): one
// scene with 300x250, 160x600, 728x90 and 320x50 layouts, each drawing its own size as its label. Run alone (it
// starts a browser):
//   node engine/v2/tests/browser/layout-browser.mjs
// Checks: the page sized to each size shows that drawing (an exact size); the fixture is made only in exact sizes, so
// in an odd window it shows the size nearest the window at true size (7.3, D3): one unit per CSS pixel, centred,
// scaled down in a smaller window, never up; a value set before a resize is kept after it; no faults. Playwright must already be installed (PW_PATH; PW_CHANNEL).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const fixture = path.resolve(here, '..', 'layout-fixture');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const files = {};
const read = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) read(p); else files[path.relative(fixture, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
read(fixture);
const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/files.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(files)); }
  if (url.pathname === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(schemas); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.mjs') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 300, height: 250 } });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); };
const log = (m) => console.log(m);
// Sizes the page, waits until the drawing shows the wanted label, and returns what shows.
const sizeTo = async (width, height, label) => {
  await page.setViewportSize({ width, height });
  try { await page.waitForFunction(([l, k]) => window.hsvg.space === k && document.querySelector('[id$="ad__label"]')?.textContent === l, [label, `${width}x${height}`], { timeout: 5000 }); } catch { /* reported below */ }
  return page.evaluate(() => {
    const svg = document.querySelector('#stage > svg'); const b = svg?.getBoundingClientRect();
    return { label: document.querySelector('[id$="ad__label"]')?.textContent, choice: window.hsvg.choices.ad, count: document.querySelector('[id$="ad__count"]')?.textContent, taps: window.hsvg.player.state.blocks.ad.values.taps, svgs: document.querySelectorAll('#stage > svg').length,
      box: b ? [b.x, b.y, b.width, b.height].map(v => Math.round(v * 10) / 10) : null, trueSize: svg?.getAttribute('data-player-true-size') };
  });
};
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  for (const [w, h] of [[300, 250], [160, 600], [728, 90], [320, 50], [300, 250]]) {
    const s = await sizeTo(w, h, `${w}x${h}`);
    log(`${w}x${h}: ${JSON.stringify(s)}`);
    want(s.label === `${w}x${h}` && s.choice?.why === 'size' && s.svgs === 1, `${w}x${h} should show its own drawing by its exact size`);
  }
  // Odd sizes: the size nearest the window (7.3), at true size and centred; a smaller window scales it down.
  for (const [w, h, near] of [[400, 300, '300x250'], [200, 700, '160x600'], [900, 100, '728x90'], [640, 100, '320x50'], [150, 125, '300x250']]) {
    const s = await sizeTo(w, h, near);
    log(`${w}x${h}: ${JSON.stringify(s)}`);
    const [nw, nh] = near.split('x').map(Number);
    const k = Math.min(1, w / nw, h / nh);
    const box = [(w - nw * k) / 2, (h - nh * k) / 2, nw * k, nh * k].map(v => Math.round(v * 10) / 10);
    want(s.label === near && s.choice?.why === 'size' && s.trueSize === near, `${w}x${h} should show the nearest size, ${near}, as its exact size`);
    want(JSON.stringify(s.box) === JSON.stringify(box), `${w}x${h}: ${near} at scale ${k}, centred: ${JSON.stringify(box)}`);
  }
  // A resize changes placement only: a value set before it is kept.
  await sizeTo(300, 250, '300x250');
  await page.evaluate(() => { window.hsvg.press('ad', 'tap'); window.hsvg.press('ad', 'tap'); });
  const s = await sizeTo(728, 90, '728x90');
  log(`after two taps and a resize: ${JSON.stringify(s)}`);
  want(s.taps === 2 && s.count === '2', 'the value set before the resize should be kept and painted');
  const errors = await page.evaluate(() => [...window.hsvg.errors, ...window.hsvg.drawing.faults.map(f => f.message)]);
  if (errors.length) problems.push(`errors: ${errors.join('; ')}`);
} catch (e) { problems.push(e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) log(`problem: ${p}`);
log(problems.length ? 'layout browser run: FAIL' : 'layout browser run: pass');
process.exit(problems.length ? 1 : 0);
