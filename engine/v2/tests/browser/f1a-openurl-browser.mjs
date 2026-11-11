// A link button with no host (10.5; F1a item 1). Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/f1a-openurl-browser.mjs
// 1. A published page packed with no host profile: a press on Order opens nothing, and the page logs one plain line
//    "openUrl refused: this page has no host; a host would open https://example.com/order".
// 2. The same page packed with a host profile that grants openUrl, heard by window.hsvg.on('openUrl'): no such line.
// 3. The dev player (web/index.html, the author is the host): the press shows the line as a notice on the page.
// Fixture: tests/host-fixture. Playwright must already be installed (it is never a dependency).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';
import { loadSchemas } from '../../schema/load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const fixture = path.join(here, '..', 'host-fixture');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1a-openurl-'));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const LINE = 'openUrl refused: this page has no host; a host would open https://example.com/order';
let browser; let server;
// Opens url; returns the page and the console lines that start with "openUrl".
async function open(url) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const lines = []; const errors = []; const requests = [];
  page.on('console', m => { if (m.text().startsWith('openUrl')) lines.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', q => requests.push(q.url()));
  await page.goto(url);
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  return { page, lines, errors, requests };
}
try {
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});

  // 1. Alone: no host profile.
  const alone = await pack(fixture, path.join(tmp, 'alone'), {});
  let p = await open(pathToFileURL(alone.htmlPath).href);
  await p.page.click('[id$="one__button"]');
  await p.page.waitForTimeout(300);
  want(p.lines.length === 1 && p.lines[0] === LINE, `a page alone logs one plain line: ${JSON.stringify(p.lines)}`);
  want(p.requests.every(u => /^(file|data|blob):/i.test(u)), 'a page alone opens no address');
  want(!p.errors.length, `no page errors (${p.errors.join(' | ')})`);
  await p.page.close();

  // 2. With a host that grants openUrl and listens: the host takes it, no line.
  const profile = JSON.stringify({ format: 'hsvg/2.0', kind: 'host-profile', id: 'f1a-host', grants: { openUrl: true } });
  const hosted = await pack(fixture, path.join(tmp, 'hosted'), { host: profile });
  p = await open(pathToFileURL(hosted.htmlPath).href);
  await p.page.evaluate(() => { window.heard = []; window.hsvg.on('openUrl', (e) => window.heard.push(JSON.parse(JSON.stringify(e)))); });
  await p.page.click('[id$="one__button"]');
  await p.page.waitForTimeout(300);
  const heard = await p.page.evaluate(() => window.heard);
  want(heard.length === 1 && heard[0].detail.field === 'clickUrl', `the host hears openUrl: ${JSON.stringify(heard)}`);
  want(p.lines.length === 0, `a host that listens gets no line: ${JSON.stringify(p.lines)}`);
  await p.page.close();

  // 3. The dev player: the same line as a notice.
  const files = {};
  const walk = (dir, rel = '') => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(dir, e.name), r); else files[r] = fs.readFileSync(path.join(dir, e.name), 'utf8'); } };
  walk(fixture);
  const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/files.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(files)); }
    if (url.pathname === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(schemas); }
    const f = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
    if (!f.startsWith(repo) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': f.endsWith('.mjs') ? 'text/javascript' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  p = await open(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html`);
  await p.page.click('[id$="one__button"]');
  await p.page.waitForTimeout(300);
  const notice = await p.page.evaluate(() => { const b = document.querySelector('[data-hsvg-notice="openUrl"]'); return b && b.getBoundingClientRect().height > 0 ? b.textContent : null; });
  const devLine = 'openUrl refused: the dev player opens no link; a host would open https://example.com/order';
  want(notice === devLine, `the dev player shows a notice: ${notice}`);
  want(p.lines.length === 1 && p.lines[0] === devLine, `the dev player logs the same line: ${JSON.stringify(p.lines)}`);
  want(!p.errors.length, `no page errors (${p.errors.join(' | ')})`);
} catch (e) {
  problems.push(String(e?.stack || e));
  console.log(e);
} finally {
  await browser?.close();
  server?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(problems.length ? `f1a-openurl-browser: FAIL (${problems.length})` : 'f1a-openurl-browser: ok');
process.exit(problems.length ? 1 : 0);
