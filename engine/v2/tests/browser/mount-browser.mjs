// The host API in a real browser (10.6): mount(container, package, options) with the package as bytes, then the
// face-only calls. Run alone (it starts a browser):
//   node engine/v2/tests/browser/mount-browser.mjs
// Checks: mount checks the package first (an hsvg/0.1 file is E-HEADER and names the upgrade tool; an unknown key is
// E-KEY-UNKNOWN; no schemas, no play), read and set of an input, a refused read of a body value, on('entered'), pause stopping a timed link and
// resume letting it fire, restart, and destroy emptying the stage. Playwright must already be installed (PW_PATH;
// PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium']; // PW_BROWSER: chromium (default), firefox or webkit
const svg = (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect id="${id}-bg" width="100" height="100" fill="#ddd" data-hsvg-layer="backdrop"/></svg>`;
const pkg = {
  'package.json': { format: 'hsvg/2.0', kind: 'package', id: 'mount-run', experience: 'experience.json', needs: [], members: {} },
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'mount-run',
    inputs: { visitorName: { kind: 'content', type: 'string', maxLength: 20, initial: 'friend' } },
    values: { secret: { type: 'number', initial: 7, minimum: 0, maximum: 9 } },
    story: { start: 'a', scenes: { a: 'scenes/a/scene.json', b: 'scenes/b/scene.json' }, ends: ['b'],
      links: [{ id: 'a-b', from: 'a', afterMs: 500, to: 'b' }] } },
  'scenes/a/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' },
  'scenes/a/a.svg': svg('a'),
  'scenes/b/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'b', drawing: 'b.svg' },
  'scenes/b/b.svg': svg('b'),
};
const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
const page = `<!doctype html><meta charset="utf-8"><div id="stage" style="width:400px;height:400px"></div>
<script type="module">
import { mount } from '/engine/v2/web/mount-web.mjs';
import { sha256 } from '/engine/v2/src/members.mjs';
const raw = ${JSON.stringify(Object.fromEntries(Object.entries(pkg).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])))};
const enc = new TextEncoder();
// package.json lists every member with its digest (10.8), as mount checks.
const sealed = (b) => { const d = JSON.parse(raw['package.json']); d.members = Object.fromEntries(Object.keys(b).filter(k => k !== 'package.json').map(k => [k, sha256(b[k])])); return { ...b, 'package.json': enc.encode(JSON.stringify(d)) }; };
const bytes = sealed(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, enc.encode(v)])));
const schemas = await fetch('/schemas.json').then(r => r.json());
const refused = (change, opts = { schemas }, seal = true) => {
  let b = { ...bytes };
  for (const [k, edit] of Object.entries(change)) { const d = JSON.parse(raw[k]); edit(d); b[k] = enc.encode(JSON.stringify(d)); }
  if (seal) b = sealed(b);
  try { mount(document.getElementById('stage'), b, opts); return null; } catch (e) { return { code: e.code ?? e.name, message: e.message }; }
};
window.refusals = {
  old: refused({ 'experience.json': (d) => { d.format = 'hsvg/0.1'; } }),
  key: refused({ 'scenes/a/scene.json': (d) => { d.script = 'x'; } }),
  none: refused({}, {}),
  digest: refused({ 'scenes/a/scene.json': (d) => { d.drawing = 'b.svg'; } }, { schemas }, false),
  stage: document.getElementById('stage').children.length,
};
window.entered = [];
window.host = mount(document.getElementById('stage'), bytes, { partition: 'mount-test', schemas });
window.host.on('entered', (e) => window.entered.push(e.detail.scene));
window.ready = true;
</script>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(schemas); }
  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/javascript' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const tab = await browser.newPage();
const pageErrors = []; tab.on('pageerror', e => pageErrors.push(e.message));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
try {
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const f = await tab.evaluate(() => window.refusals);
  want(f.old?.code === 'E-HEADER' && /the upgrade tool \(A13\.3/.test(f.old.message) && /a13-migration\.md/.test(f.old.message), `an hsvg/0.1 package is refused with E-HEADER naming the upgrade tool (${JSON.stringify(f.old)})`);
  want(f.key?.code === 'E-KEY-UNKNOWN', `an unknown key is refused at mount (${JSON.stringify(f.key)})`);
  want(f.none?.code === 'TypeError' && f.stage === 0, `no schemas: refused, and nothing was drawn (${JSON.stringify(f)})`);
  want(f.digest?.code === 'E-PACKAGE-DIGEST', `a changed member is refused with E-PACKAGE-DIGEST (${JSON.stringify(f.digest)})`);
  const r = await tab.evaluate(() => {
    const h = window.host; const out = { name: h.read('visitorName') };
    h.set('visitorName', 'Robin'); out.after = h.read('visitorName');
    try { h.read('secret'); out.secret = 'read'; } catch (e) { out.secret = e.code; }
    try { h.set('visitorName', 42); out.bad = 'set'; } catch (e) { out.bad = e.code; }
    out.internal = h.internal === undefined;
    h.pause('test');
    return out;
  });
  want(r.name === 'friend' && r.after === 'Robin', 'read and set an input');
  want(r.secret === 'E-HOST-PRIVATE' && r.bad === 'E-TYPE' && r.internal, 'a body value is private; a wrong type is refused; no internals outside test mode');
  await tab.waitForTimeout(900);
  want(await tab.evaluate(() => window.host.scene()) === 'a', 'paused: the timed link waits');
  await tab.evaluate(() => window.host.resume('test'));
  await tab.waitForFunction(() => window.host.scene() === 'b', null, { timeout: 3000 }).catch(() => {});
  want(await tab.evaluate(() => window.host.scene()) === 'b', 'resumed: the timed link fires');
  await tab.evaluate(() => window.host.restart());
  await tab.waitForTimeout(50);
  const s = await tab.evaluate(() => ({ scene: window.host.scene(), entered: window.entered.slice(), name: window.host.read('visitorName'), svg: !!document.querySelector('#stage svg [id$="a__a-bg"]') }));
  want(s.scene === 'a' && s.entered.includes('a') && s.name === 'Robin' && s.svg, `restart starts a new run, keeps the inputs and shows its scene (${JSON.stringify(s)})`);
  const gone = await tab.evaluate(() => { window.host.destroy(); return document.getElementById('stage').children.length; });
  want(gone === 0, 'destroy empties the stage');
} catch (e) { problems.push(e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) console.log(`problem: ${p}`);
console.log(problems.length ? 'mount browser run: FAIL' : 'mount browser run: pass');
process.exit(problems.length ? 1 : 0);
