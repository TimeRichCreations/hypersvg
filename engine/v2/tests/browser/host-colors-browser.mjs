// Host colours (7.7.1, 10.6, 10.14; experimental) in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/host-colors-browser.mjs [--shots <folder>]
// Checks, on the package mount (mount-web.mjs), the HyperSVG mounts (mount, mountAsync with integrity) and the
// <hypersvg-asset> element (attribute and property):
// - a passing set paints the parts that name a colour role; a part without one keeps its drawn paint;
// - a failing set paints nothing of it: the author's colours stay, and the host hears W-HOST-COLOR-CONTRAST naming the
//   pair, the theme and the ratio (onError, or hsvg:error on the element, which still plays);
// - an invalid value or an unknown role is W-HOST-COLOR-VALUE, with the author's colours;
// - with a host theme pick the theme applies first, then the colours, and only that theme is checked; without one,
//   every declared theme is checked;
// - without colours, nothing changes.
// --shots writes host-colours-pass.png and host-colours-fail.png (deviceScaleFactor 2) into the folder.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { packAsset } from '../../tools/pack.mjs';
import { readAsset, makeAsset } from '../../src/asset.mjs';
import { loadSchemas } from '../../schema/load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const engine = pw[process.env.PW_BROWSER || 'chromium'];
const shotsAt = process.argv.includes('--shots') ? path.resolve(process.argv[process.argv.indexOf('--shots') + 1]) : null;

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };

// ---------- the lamp, with roles on its text and switch, a brand part, and a night theme ----------
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'host-colors-'));
const plain = fs.readFileSync((await packAsset(path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture'), out)).svgPath, 'utf8');
fs.rmSync(out, { recursive: true, force: true });
const AUTHOR = { surface: '#f3f4f6', ink: '#111827', accent: '#2563eb', sun: '#f59e0b' };
const BRAND = '#374151'; // the lamp's foot: no colour role, so it never takes a host colour
const a = readAsset(plain);
const files = { ...a.files };
const doc = JSON.parse(files['experience.json']);
doc.themes.night = { colorRoles: { surface: '#111827', ink: '#f9fafb', accent: '#93c5fd', sun: '#b45309', sky: '#0369a1' } };
files['experience.json'] = JSON.stringify(doc);
files[a.drawing] = files[a.drawing]
  .replace('<text id="state" x="300" y="222" text-anchor="middle" font-size="24" fill="#111827">', '<text id="state" x="300" y="222" text-anchor="middle" font-size="24" fill="#111827" data-hsvg-color="ink">')
  .replace('<circle cx="268" cy="68" r="20" fill="#2563eb"/>', '<circle cx="268" cy="68" r="20" fill="#2563eb" data-hsvg-color="accent"/>')
  .replace('<rect x="70" y="226" width="100" height="16" rx="8" fill="#374151"/>', '<rect id="foot" x="70" y="226" width="100" height="16" rx="8" fill="#374151"/>');
const lamp = makeAsset({ id: a.id, drawing: a.drawing, files });
const sri = (t) => `sha256-${crypto.createHash('sha256').update(t).digest('base64')}`;
// The same files as an Experience package: package.json lists every member (sealed in the page).
const pkgRaw = { ...files, 'package.json': JSON.stringify({ format: 'hsvg/2.0', kind: 'package', id: 'lamp-package', experience: 'experience.json', needs: [], members: {} }) };

const PASS = { surface: '#0f172a', ink: '#f8fafc', accent: '#38bdf8', sun: '#facc15' };
const FAIL = { surface: '#0f172a', ink: '#334155', accent: '#38bdf8', sun: '#facc15' };
const css = (o) => Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('; ');

const page = `<!doctype html><meta charset="utf-8"><style>body{margin:0;font:13px system-ui}div.p,hypersvg-asset{display:block;width:240px;height:180px}
section{display:flex;flex-wrap:wrap;gap:8px;margin:6px}</style>
<section id="row-pass"><div class="p" id="pkgPass"></div><div class="p" id="assetPass"></div><div class="p" id="leanPass"></div><hypersvg-asset id="elPass" src="/lamp.svg" colors="${css(PASS)}"></hypersvg-asset></section>
<section id="row-fail"><div class="p" id="pkgFail"></div><div class="p" id="assetFail"></div><div class="p" id="leanFail"></div><hypersvg-asset id="elFail" src="/lamp.svg" colors="${css(FAIL)}"></hypersvg-asset></section>
<section id="row-more"><div class="p" id="none"></div><div class="p" id="nightSun"></div><div class="p" id="dayOnly"></div><div class="p" id="anyTheme"></div>
<div class="p" id="badRole"></div><hypersvg-asset id="elBad" src="/lamp.svg" colors="ink: red"></hypersvg-asset><hypersvg-asset id="elProp" src="/lamp.svg"></hypersvg-asset></section>
<script type="module">
import { mount, mountAsync, sharedSchemas } from '/engine/v2/web/asset-web.mjs';
import { mount as mountPackage } from '/engine/v2/web/mount-web.mjs';
import { sha256 } from '/engine/v2/src/members.mjs';
const heard = window.heard = {};
const errs = (id) => (d) => { (heard[id] ??= []).push({ code: d.code, message: d.message, pair: d.pair, theme: d.theme, ratio: d.ratio }); };
for (const id of ['elPass', 'elFail', 'elBad', 'elProp']) document.getElementById(id).addEventListener('hsvg:error', (e) => errs(id)(e.detail));
const lamp = await fetch('/lamp.svg').then(r => r.text());
const schemas = await sharedSchemas();
const pkgSchemas = await fetch('/schemas.json').then(r => r.json());
const enc = new TextEncoder();
const raw = ${JSON.stringify(pkgRaw)};
const bytes = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, enc.encode(v)]));
const d = JSON.parse(raw['package.json']); d.members = Object.fromEntries(Object.keys(bytes).filter(k => k !== 'package.json').map(k => [k, sha256(bytes[k])]));
bytes['package.json'] = enc.encode(JSON.stringify(d));
const el = (id) => document.getElementById(id);
const PASS = ${JSON.stringify(PASS)}; const FAIL = ${JSON.stringify(FAIL)};
window.players = {
  pkgPass: mountPackage(el('pkgPass'), bytes, { schemas: pkgSchemas, colors: PASS, onError: errs('pkgPass') }),
  pkgFail: mountPackage(el('pkgFail'), bytes, { schemas: pkgSchemas, colors: FAIL, onError: errs('pkgFail') }),
  assetPass: mount(el('assetPass'), lamp, {}, { schemas, colors: PASS, onError: errs('assetPass') }),
  assetFail: mount(el('assetFail'), lamp, {}, { schemas, colors: FAIL, onError: errs('assetFail') }),
  leanPass: await mountAsync(el('leanPass'), lamp, {}, { integrity: '${sri(lamp)}', colors: PASS, onError: errs('leanPass') }),
  leanFail: await mountAsync(el('leanFail'), lamp, {}, { integrity: '${sri(lamp)}', colors: FAIL, onError: errs('leanFail') }),
  none: mount(el('none'), lamp, {}, { schemas, onError: errs('none') }),
  nightSun: mount(el('nightSun'), lamp, {}, { schemas, theme: 'night', colors: { sun: '#fde047' }, onError: errs('nightSun') }),
  // Dark ink suits the day surface but not the night one: with the day theme picked it applies; without a pick
  // (an input could show night) it is refused.
  dayOnly: mount(el('dayOnly'), lamp, {}, { schemas, theme: 'lamp', colors: { ink: '#1f2937' }, onError: errs('dayOnly') }),
  anyTheme: mount(el('anyTheme'), lamp, {}, { schemas, colors: { ink: '#1f2937' }, onError: errs('anyTheme') }),
  badRole: mount(el('badRole'), lamp, {}, { schemas, colors: { brand: '#d84315' }, onError: errs('badRole') }),
};
await Promise.all(['elPass', 'elFail', 'elBad'].map(id => el(id).ready.catch(() => null)));
// The property sets the attribute and places the file again.
await el('elProp').ready.catch(() => null);
el('elProp').colors = PASS;
await new Promise(r => setTimeout(r, 50));
await el('elProp').ready;
window.propText = el('elProp').getAttribute('colors');
window.propBack = el('elProp').colors;
window.ready = true;
</script>`;

const S = loadSchemas(path.join(repo, 'spec', '2.0'));
const virtual = {
  '/lamp.svg': ['image/svg+xml', lamp],
  '/colors.html': ['text/html', page],
  '/schemas.json': ['application/json', JSON.stringify(S)],
};
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const v = virtual[url.pathname];
  if (v) { res.writeHead(200, { 'content-type': v[0] }); return res.end(v[1]); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await engine.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const pageErrors = [];

try {
  const tab = await browser.newPage({ viewport: { width: 1060, height: 640 }, deviceScaleFactor: shotsAt ? 2 : 1 });
  tab.on('pageerror', e => pageErrors.push(e.message));
  await tab.goto(`${base}/colors.html`);
  await tab.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const ids = ['pkgPass', 'assetPass', 'leanPass', 'elPass', 'pkgFail', 'assetFail', 'leanFail', 'elFail', 'none', 'nightSun', 'dayOnly', 'anyTheme', 'badRole', 'elBad', 'elProp'];
  const r = await tab.evaluate((ids) => Object.fromEntries(ids.map(id => {
    const root = document.getElementById(id);
    const q = (s) => root.querySelector(s);
    return [id, {
      surface: q('svg > rect[data-hsvg-color="surface"]')?.getAttribute('fill'),
      sun: q('[id$="__bulb"] circle')?.getAttribute('fill'),
      ink: q('[id$="__state"]')?.getAttribute('fill'),
      accent: q('[id$="__switch"] circle')?.getAttribute('fill'),
      foot: q('[id$="__foot"]')?.getAttribute('fill'),
      painted: q('[id$="__bulb"] circle') ? getComputedStyle(q('[id$="__bulb"] circle')).fill : null,
      refused: root.getAttribute('data-hsvg-refused'),
      heard: window.heard[id] || [],
    }];
  })), ids);
  const is = (x, set) => x.surface === set.surface && x.sun === set.sun && x.ink === set.ink && x.accent === set.accent;
  const show = (x) => `surface ${x.surface}, sun ${x.sun}, ink ${x.ink}, accent ${x.accent}, foot ${x.foot}`;
  for (const id of ['pkgPass', 'assetPass', 'leanPass', 'elPass']) {
    want(is(r[id], PASS) && r[id].heard.length === 0, `${id}: a passing set paints every role part, with no warning (${show(r[id])})`);
    want(r[id].foot === BRAND, `${id}: the brand part without a colour role keeps its drawn paint (${r[id].foot})`);
  }
  want(r.pkgPass.painted === 'rgb(250, 204, 21)', `the browser paints the host colour (${r.pkgPass.painted})`);
  for (const id of ['pkgFail', 'assetFail', 'leanFail', 'elFail']) {
    const w = r[id].heard[0] || {};
    want(is(r[id], AUTHOR) && r[id].foot === BRAND, `${id}: a failing set paints none of it; the author's colours stay (${show(r[id])})`);
    want(r[id].heard.length === 1 && w.code === 'W-HOST-COLOR-CONTRAST' && w.pair === 'ink on surface' && /ink on surface is \d\.\d\d:1 in theme lamp, under 4\.5:1/.test(w.message), `${id}: the host hears W-HOST-COLOR-CONTRAST naming the pair and its ratio (${JSON.stringify(r[id].heard)})`);
  }
  want(r.elFail.refused === null, `the element with a refused set still plays (data-hsvg-refused ${r.elFail.refused})`);
  want(is(r.none, AUTHOR) && r.none.heard.length === 0, `without colours nothing changes (${show(r.none)})`);
  want(r.nightSun.surface === '#111827' && r.nightSun.sun === '#fde047' && r.nightSun.heard.length === 0, `the host's theme first, then its colours (${show(r.nightSun)})`);
  want(r.dayOnly.ink === '#1f2937' && r.dayOnly.heard.length === 0, `with a host theme pick only that theme is checked (${show(r.dayOnly)})`);
  want(r.anyTheme.ink === AUTHOR.ink && r.anyTheme.heard[0]?.code === 'W-HOST-COLOR-CONTRAST' && r.anyTheme.heard[0]?.theme === 'night', `without a pick every declared theme is checked (${JSON.stringify(r.anyTheme.heard)})`);
  want(is(r.badRole, AUTHOR) && r.badRole.heard[0]?.code === 'W-HOST-COLOR-VALUE', `an unknown role is W-HOST-COLOR-VALUE (${JSON.stringify(r.badRole.heard)})`);
  want(is(r.elBad, AUTHOR) && r.elBad.heard[0]?.code === 'W-HOST-COLOR-VALUE' && r.elBad.refused === null, `the element: a value that is not a six-digit hex colour is W-HOST-COLOR-VALUE and it still plays (${JSON.stringify(r.elBad.heard)})`);
  const prop = await tab.evaluate(() => ({ text: window.propText, back: window.propBack }));
  want(is(r.elProp, PASS) && prop.text === Object.entries(PASS).map(([k, v]) => `${k}: ${v}`).join('; ') && JSON.stringify(prop.back) === JSON.stringify(PASS), `the element's colors property sets the attribute and places it again (${show(r.elProp)}; ${prop.text})`);
  want(pageErrors.length === 0, `no page errors (${pageErrors.join('; ') || 'none'})`);
  if (shotsAt) {
    fs.mkdirSync(shotsAt, { recursive: true });
    await tab.locator('#row-pass').screenshot({ path: path.join(shotsAt, 'host-colours-pass.png') });
    await tab.locator('#row-fail').screenshot({ path: path.join(shotsAt, 'host-colours-fail.png') });
    console.log(`screenshots in ${shotsAt}`);
  }
} catch (e) {
  problems.push(e.stack || String(e));
  console.log(e.stack || e);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problem(s)` : 'all ok');
process.exit(problems.length ? 1 : 0);
