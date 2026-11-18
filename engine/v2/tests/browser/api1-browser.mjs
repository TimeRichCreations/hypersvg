// D63's fixes in a real browser (added after 2.0.0-next.0). Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/api1-browser.mjs
// 1. firstInput (10.4) on a packed page: a press on the click area is heard as firstInput, then openUrl; the next
//    press only openUrl; an untrusted pointerdown sends nothing; after restart the next press sends it again.
// 2. firstInput on the package mount (mount-web.mjs): the first key press sends it.
// 3. firstInput on the HyperSVG element: a pointer-down on the drawing, on no control, sends it.
// 4. hsvg:error always has code and message: a listener that throws a plain Error is E-HOST-ERROR; a file that
//    cannot be loaded is E-ASSET.
// 5. The element's experimental partition attribute reaches the player: a partition that is not 1 to 128 of
//    A-Z a-z 0-9 . _ - is refused (E-RANGE); a good one plays.
// Fixtures: tests/host-fixture (a button with openUrl), tests/k2f-fixture (a lamp HyperSVG). Playwright must already be
// installed (it is never a dependency).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack, packAsset } from '../../tools/pack.mjs';
import { loadSchemas } from '../../schema/load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-api1-'));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const filesOf = (dir) => {
  const out = {};
  const walk = (d, rel = '') => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else out[r] = fs.readFileSync(path.join(d, e.name), 'utf8'); } };
  walk(dir);
  return out;
};

const hostFixture = path.join(here, '..', 'host-fixture');
const lamp = await packAsset(path.join(here, '..', 'k2f-fixture'), path.join(tmp, 'lamp'));
const PAGES = {
  '/mount.html': `<!doctype html><meta charset="utf-8"><div id="stage" style="width:400px;height:300px"></div>
<script type="module">
import { mount } from '/engine/v2/web/mount-web.mjs';
import { sha256 } from '/engine/v2/src/members.mjs';
const files = await fetch('/files.json').then(r => r.json());
const schemas = await fetch('/schemas.json').then(r => r.json());
const enc = new TextEncoder();
const bytes = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, enc.encode(v)]));
bytes['package.json'] = enc.encode(JSON.stringify({ format: 'hsvg/2.0', kind: 'package', id: 'host-fixture', experience: 'experience.json', needs: [], members: Object.fromEntries(Object.keys(files).map(k => [k, sha256(bytes[k])])) }));
window.heard = [];
const host = mount(document.getElementById('stage'), bytes, { schemas });
host.on('firstInput', (e) => window.heard.push(e.name));
window.hsvgReady = true;
</script>`,
  '/asset.html': `<!doctype html><meta charset="utf-8">
<script type="module" src="/engine/v2/web/asset-web.mjs"></script>
<hypersvg-asset id="lamp" src="/lamp.svg" style="width:300px;height:300px"></hypersvg-asset>
<hypersvg-asset id="missing" src="/no-such.svg" style="width:100px;height:100px"></hypersvg-asset>
<hypersvg-asset id="bad-partition" src="/lamp.svg" partition="no spaces!" style="width:100px;height:100px"></hypersvg-asset>
<hypersvg-asset id="good-partition" src="/lamp.svg" partition="learner-42" style="width:100px;height:100px"></hypersvg-asset>
<script>
window.errors = {};
for (const el of document.querySelectorAll('hypersvg-asset')) el.addEventListener('hsvg:error', (e) => (window.errors[el.id] ??= []).push(e.detail));
</script>`,
};
let browser; let server;
try {
  const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
  const files = JSON.stringify(filesOf(hostFixture));
  const lampSvg = fs.readFileSync(lamp.svgPath);
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (type, body) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
    if (url.pathname === '/files.json') return send('application/json', files);
    if (url.pathname === '/schemas.json') return send('application/json', schemas);
    if (url.pathname === '/lamp.svg') return send('image/svg+xml', lampSvg);
    if (PAGES[url.pathname]) return send('text/html', PAGES[url.pathname]);
    const f = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
    if (!f.startsWith(repo) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    const type = /\.(mjs|js)$/.test(f) ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/plain';
    send(type, fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const open = async (url, ready = () => window.hsvgReady === true || window.hsvgError) => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(ready, null, { timeout: 60000 });
    return { page, errors };
  };

  // 1. A packed page with a host that grants openUrl.
  const profile = JSON.stringify({ format: 'hsvg/2.0', kind: 'host-profile', id: 'api1-host', grants: { openUrl: true } });
  const packed = await pack(hostFixture, path.join(tmp, 'packed'), { host: profile });
  let { page, errors } = await open(pathToFileURL(packed.htmlPath).href);
  await page.evaluate(() => { window.heard = []; for (const n of ['firstInput', 'openUrl']) window.hsvg.on(n, (e) => window.heard.push(e.name)); });
  await page.evaluate(() => document.querySelector('#stage').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(100);
  want((await page.evaluate(() => window.heard)).length === 0, 'an untrusted pointerdown sends no firstInput');
  await page.click('[id$="one__button"]');
  await page.waitForTimeout(200);
  want(JSON.stringify(await page.evaluate(() => window.heard)) === '["firstInput","openUrl"]', `a press on the click area: firstInput, then openUrl (${JSON.stringify(await page.evaluate(() => window.heard))})`);
  await page.click('[id$="one__button"]');
  await page.waitForTimeout(200);
  want(JSON.stringify(await page.evaluate(() => window.heard)) === '["firstInput","openUrl","openUrl"]', 'the next press: openUrl only (once per run)');
  await page.evaluate(() => window.hsvg.restart());
  await page.click('[id$="one__button"]');
  await page.waitForTimeout(200);
  want(JSON.stringify(await page.evaluate(() => window.heard)).endsWith('"firstInput","openUrl"]'), 'after restart (a new run) the next press sends firstInput again');
  want(!errors.length, `no page errors (${errors.join(' | ')})`);
  await page.close();

  // 2. The package mount: the first key press.
  ({ page, errors } = await open(`${base}/mount.html`));
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(150);
  want(JSON.stringify(await page.evaluate(() => window.heard)) === '["firstInput"]', `the package mount: a key press sends firstInput once (${JSON.stringify(await page.evaluate(() => window.heard))})`);
  want(!errors.length, `no page errors (${errors.join(' | ')})`);
  await page.close();

  // 3 to 5. The HyperSVG element.
  ({ page, errors } = await open(`${base}/asset.html`, () => document.getElementById('lamp')?.ready));
  await page.evaluate(async () => {
    const el = document.getElementById('lamp');
    await el.ready;
    window.firsts = [];
    el.on('firstInput', (e) => window.firsts.push(e.name));
    el.on('clicked', () => { throw new Error('host code broke'); });
    await Promise.allSettled([...document.querySelectorAll('hypersvg-asset')].map(x => x.ready));
  });
  const box = await page.locator('#lamp').boundingBox();
  await page.mouse.click(box.x + 3, box.y + 3); // a corner of the drawing: no control there
  await page.waitForTimeout(150);
  want(JSON.stringify(await page.evaluate(() => window.firsts)) === '["firstInput"]', `the element: a pointer-down on no control sends firstInput (${JSON.stringify(await page.evaluate(() => window.firsts))})`);
  await page.click('#lamp [id$="switch"]');
  await page.waitForTimeout(200);
  const errs = await page.evaluate(() => window.errors);
  const thrown = (errs.lamp || []).find(d => d.message === 'host code broke');
  want(thrown?.code === 'E-HOST-ERROR' && thrown.source === 'listener', `hsvg:error for a listener that throws: ${JSON.stringify(errs.lamp)}`);
  const missing = errs.missing?.[0];
  want(missing?.code === 'E-ASSET' && typeof missing.message === 'string' && missing.message.length > 0, `hsvg:error for a file that cannot load: ${JSON.stringify(missing)}`);
  want(Object.values(errs).flat().every(d => typeof d.code === 'string' && d.code && typeof d.message === 'string'), 'every hsvg:error has a code and a message');
  const bad = await page.evaluate(() => document.getElementById('bad-partition').getAttribute('data-hsvg-refused'));
  want(bad === 'E-RANGE' && errs['bad-partition']?.[0]?.code === 'E-RANGE', `partition="no spaces!" is refused: ${bad} ${JSON.stringify(errs['bad-partition'])}`);
  const good = await page.evaluate(async () => { const el = document.getElementById('good-partition'); const h = await el.ready; return { refused: el.getAttribute('data-hsvg-refused'), on: h.read('on') }; });
  want(good.refused === null && good.on === false, `partition="learner-42" plays: ${JSON.stringify(good)}`);
  want(!errors.length, `no page errors (${errors.join(' | ')})`);
  await page.close();
} catch (e) {
  problems.push(String(e?.stack || e));
  console.log(e);
} finally {
  await browser?.close();
  server?.close();
}
console.log(problems.length ? `${problems.length} problem(s)` : 'api1-browser: all ok');
process.exit(problems.length ? 1 : 0);
