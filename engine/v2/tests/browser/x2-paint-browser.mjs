// In a real browser: the page paints only what changed. Run alone (it starts a browser):
//   node engine/v2/tests/browser/x2-paint-browser.mjs
// A valid 60-row live dashboard is mounted with mount-web.mjs and fed. Checks: with nothing changing, a second of
// frames writes no attribute and no text; a host change committed while the page is paused is painted at once
// (R2 code 13); a change of one row writes only a few attributes. Playwright must already be installed (PW_PATH).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { sha256 } from '../../src/members.mjs';
import { dashboardFiles, rows } from '../x2-dashboard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const N = 60;
const files = dashboardFiles(N);
const exp = JSON.parse(files['experience.json']);
files['package.json'] = JSON.stringify({ format: 'hsvg/2.0', kind: 'package', id: exp.id, experience: 'experience.json', needs: exp.needs,
  members: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, sha256(new TextEncoder().encode(v))])) }); // every member's digest (10.8)
const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
const page = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="stage" style="width:1000px;height:800px"></div>
<script type="module">
import '/engine/v2/src/capabilities/all.mjs';
import { mount } from '/engine/v2/web/mount-web.mjs';
const enc = new TextEncoder();
const raw = ${JSON.stringify(files)};
const bytes = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, enc.encode(v)]));
const schemas = await fetch('/schemas.json').then(r => r.json());
window.errors = [];
window.host = mount(document.getElementById('stage'), bytes, { schemas, onError: (e) => window.errors.push(e) });
window.texts = () => [...document.querySelectorAll('#stage text')].map(t => t.textContent).join('|');
window.ready = true;
</script>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(schemas); }
  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
  const f = path.join(repo, ...url.pathname.split('/').filter(Boolean));
  if (!f.startsWith(repo) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };
try {
  const pg = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await pg.addInitScript(() => {
    window.writes = { attr: 0, text: 0 };
    const sa = Element.prototype.setAttribute; Element.prototype.setAttribute = function (...a) { window.writes.attr++; return sa.apply(this, a); };
    const ra = Element.prototype.removeAttribute; Element.prototype.removeAttribute = function (...a) { window.writes.attr++; return ra.apply(this, a); };
    const tc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    Object.defineProperty(Node.prototype, 'textContent', { get() { return tc.get.call(this); }, set(v) { window.writes.text++; tc.set.call(this, v); } });
  });
  pg.on('pageerror', e => failures.push(`page error: ${e.message}`));
  await pg.goto(`http://127.0.0.1:${server.address().port}/`);
  await pg.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const feed = (list) => pg.evaluate((list) => { try { window.host.set('readings', list); return 'ok'; } catch (e) { return `${e.code} ${e.message}`; } }, list);
  check(await feed(rows(N, 1)) === 'ok', `a feed of ${N} rows is taken`);
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { window.writes = { attr: 0, text: 0 }; });
  await pg.waitForTimeout(1000);
  const idle = await pg.evaluate(() => window.writes);
  check(idle.attr === 0 && idle.text === 0, `idle for a second: no attribute or text written (${JSON.stringify(idle)})`);
  // Paused: a committed host change is painted all the same.
  await pg.evaluate(() => window.host.pause('test'));
  const before = await pg.evaluate(() => window.texts());
  const next = rows(N, 1); next[3] = { ...next[3], temp: 44, rain: 3.9 };
  // The counts start in the same task as the feed, so no frame paints between them.
  const fed = await pg.evaluate((list) => { window.writes = { attr: 0, text: 0 }; try { window.host.set('readings', list); return 'ok'; } catch (e) { return `${e.code} ${e.message}`; } }, next);
  check(fed === 'ok', 'a feed while paused is taken');
  await pg.waitForTimeout(300);
  const after = await pg.evaluate(() => window.texts());
  check(after !== before && after.includes('44 °C'), 'the change committed while paused is painted');
  const one = await pg.evaluate(() => window.writes);
  check(one.attr + one.text > 0 && one.attr + one.text < 20, `one changed row writes a few nodes only (${JSON.stringify(one)})`);
  check((await pg.evaluate(() => window.errors.length)) === 0, 'no errors');
} finally { await browser.close(); server.close(); }
console.log(failures.length ? `x2 paint browser run: ${failures.length} failed` : 'x2 paint browser run: pass');
process.exit(failures.length ? 1 : 0);
