// Small host additions in a real browser (added after 2.0.0-next.0). Run alone (it starts a browser):
//   node engine/v2/tests/browser/n5-host-browser.mjs
// Checks:
// - the host picks one of a HyperSVG's themes: mount's theme option and the element's theme attribute; a theme it does
//   not declare is refused (E-AXIS-INPUT);
// - a strict Content-Security-Policy page (no 'unsafe-inline' styles) plays the lamp with the nonce option and with
//   the element's nonce, with no violation; without the nonce the same page reports violations;
// - faultBox: false (and fault-box="hidden") shows no fault message; the fault still reaches onError and hsvg:error;
// - place(name): a scene's listed place in page coordinates; an unlisted name is refused;
// - host words: a language the HyperSVG lacks, shown in the drawn labels;
// - the one-file player (engine/v2/web/hypersvg-asset.js, made by tools/bundle-asset.mjs) plays the lamp with one
//   module request and no schema request.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { packAsset } from '../../tools/pack.mjs';
import { readAsset, makeAsset } from '../../src/asset.mjs';
import crypto from 'node:crypto';
import { bundleAsset, BUNDLE } from '../../tools/bundle-asset.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const engine = pw[process.env.PW_BROWSER || 'chromium'];

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'n5-'));

// ---------- the lamp and its variants ----------
const lamp = fs.readFileSync((await packAsset(path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture'), temp())).svgPath, 'utf8');
const variant = (change) => {
  const a = readAsset(lamp);
  const files = { ...a.files };
  const doc = JSON.parse(files['experience.json']);
  const scene = JSON.parse(files['scenes/lamp/scene.json']);
  change({ doc, scene, files });
  files['experience.json'] = JSON.stringify(doc);
  files['scenes/lamp/scene.json'] = JSON.stringify(scene);
  return makeAsset({ id: a.id, drawing: a.drawing, files });
};
const NIGHT_SUN = '#b45309';
const night = variant(({ doc }) => { doc.themes.night = { colorRoles: { surface: '#111827', ink: '#f9fafb', accent: '#93c5fd', sun: NIGHT_SUN, sky: '#0369a1' } }; });
// A press on the switch makes a write the engine refuses: the experience stops with a fault.
const faulty = variant(({ scene }) => { scene.on.flipped = [{ actions: [{ set: 'bright', to: '5' }] }]; });
// The scene lists the switch as a place a host may ask for (4.3).
const placed = variant(({ scene }) => { scene.places = { switch: { kind: 'part' } }; });
const placedIntegrity = `sha256-${crypto.createHash('sha256').update(placed).digest('base64')}`;
// The lamp with English words for its switch label and its state text.
const EN = 'id,text\npower,Lamp on\non,On\noff,Off\n';
const worded = variant(({ doc, scene, files }) => {
  files['words/en.csv'] = EN;
  doc.resources = { 'words-en': { kind: 'words', file: 'words/en.csv', language: 'en', digest: `sha256:${crypto.createHash('sha256').update(EN).digest('hex')}` } };
  scene.controls.power.label = '{{ words.power }}';
  scene.bindings = scene.bindings.map(b => (b.target === 'state' ? { ...b, text: "{{ on ? words.on : words.off }}" } : b));
});
// The one-file player, made now (the committed file may lag behind an engine change; it is reported, not failed).
const oneFile = bundleAsset().text;
const committedCurrent = fs.existsSync(BUNDLE) && fs.readFileSync(BUNDLE, 'utf8') === oneFile;
const NONCE = 'n5nonce';
const CSP = `default-src 'none'; script-src 'self' 'nonce-${NONCE}'; style-src 'self' 'nonce-${NONCE}'; img-src 'self' data: blob:; connect-src 'self'`;
const cspPage = (withNonce) => `<!doctype html><meta charset="utf-8"><style nonce="${NONCE}">#a,#el{display:block;width:400px;height:300px}</style><div id="a"></div>
<hypersvg-asset id="el" src="/lamp.svg" ${withNonce ? `nonce="${NONCE}"` : ''}></hypersvg-asset>
<script nonce="${NONCE}">window.violations = []; document.addEventListener('securitypolicyviolation', (e) => window.violations.push(e.violatedDirective + ' ' + (e.sample || e.blockedURI) + ' ' + e.sourceFile + ':' + e.lineNumber + ':' + e.columnNumber));</script>
<script type="module" nonce="${NONCE}">
import { mount, sharedSchemas } from '/engine/v2/web/asset-web.mjs';
const svg = await fetch('/lamp.svg').then(r => r.text());
const lamp = mount(document.getElementById('a'), svg, { on: true }, { schemas: await sharedSchemas()${withNonce ? `, nonce: '${NONCE}'` : ''} });
await customElements.whenDefined('hypersvg-asset');
await document.getElementById('el').ready;
document.querySelector('#a [id$="__switch"]').focus();
await new Promise(r => setTimeout(r, 300));
window.ready = true;
</script>`;

const virtual = {
  '/lamp.svg': ['image/svg+xml', lamp],
  '/night.svg': ['image/svg+xml', night],
  '/faulty.svg': ['image/svg+xml', faulty],
  '/placed.svg': ['image/svg+xml', placed],
  '/place.html': ['text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0}#top{height:900px}div.p{width:400px;height:300px}</style>
<div id="top"></div><div class="p" id="checked"></div><div class="p" id="lean"></div>
<script type="module">
import { mount, mountAsync, sharedSchemas } from '/engine/v2/web/asset-web.mjs';
const svg = await fetch('/placed.svg').then(r => r.text());
window.players = { checked: mount(document.getElementById('checked'), svg, {}, { schemas: await sharedSchemas() }), lean: await mountAsync(document.getElementById('lean'), svg, {}, { integrity: '${placedIntegrity}' }) };
window.scrollTo(0, 500);
window.ready = true;
</script>`],
  '/worded.svg': ['image/svg+xml', worded],
  '/words.html': ['text/html', `<!doctype html><meta charset="utf-8"><style>div{width:400px;height:300px}</style><div id="en"></div><div id="fr"></div><div id="lean"></div>
<script type="module">
import { mount, mountAsync, sharedSchemas } from '/engine/v2/web/asset-web.mjs';
const svg = await fetch('/worded.svg').then(r => r.text());
const schemas = await sharedSchemas();
const fr = { language: 'fr', words: { power: 'Lampe allumée', on: 'Allumée' } };
mount(document.getElementById('en'), svg, { on: true }, { schemas });
mount(document.getElementById('fr'), svg, { on: true }, { schemas, hostWords: fr });
await mountAsync(document.getElementById('lean'), svg, { on: true }, { integrity: '${`sha256-${crypto.createHash('sha256').update(worded).digest('base64')}`}', hostWords: fr });
const code = (w) => { const el = document.createElement('div'); try { mount(el, svg, {}, { schemas, hostWords: w }); return 'none'; } catch (e) { return e.code + ':' + el.children.length; } };
window.refused = [code({ language: 'en', words: {} }), code({ language: 'fr', words: { nope: 'x' } }), code({ language: 'fr', words: { on: 'x'.repeat(500) } })];
window.ready = true;
</script>`],
  '/cdn/hypersvg-asset.js': ['text/javascript', oneFile],
  '/cdn.html': ['text/html', `<!doctype html><meta charset="utf-8"><style>hypersvg-asset,div{display:block;width:400px;height:300px}</style>
<script type="module" src="/cdn/hypersvg-asset.js"></script>
<hypersvg-asset id="lamp" src="/lamp.svg" on="true"></hypersvg-asset>
<hypersvg-asset id="checked" src="/placed.svg" integrity="${placedIntegrity}"></hypersvg-asset>
<div id="m"></div>
<script type="module">
import { mount, sharedSchemas, VERSION } from '/cdn/hypersvg-asset.js';
await customElements.whenDefined('hypersvg-asset');
window.states = await Promise.all(['lamp', 'checked'].map(id => document.getElementById(id).ready.then(() => 'ready', e => e.code || e.message)));
const svg = await fetch('/lamp.svg').then(r => r.text());
window.mounted = mount(document.getElementById('m'), svg, { shade: 'sky' }, { schemas: await sharedSchemas() });
window.version = VERSION;
window.ready = true;
</script>`],
  '/csp.html': ['text/html', cspPage(true), CSP],
  '/csp-none.html': ['text/html', cspPage(false), CSP],
  '/theme.html': ['text/html', `<!doctype html><meta charset="utf-8"><style>hypersvg-asset,div{display:block;width:400px;height:300px}</style>
<script type="module" src="/engine/v2/web/asset-web.mjs"></script>
<hypersvg-asset id="day" src="/night.svg"></hypersvg-asset>
<hypersvg-asset id="night" src="/night.svg" theme="night"></hypersvg-asset>
<hypersvg-asset id="nope" src="/night.svg" theme="dusk"></hypersvg-asset>
<div id="m"></div>
<script type="module">
import { mount, sharedSchemas } from '/engine/v2/web/asset-web.mjs';
const svg = await fetch('/night.svg').then(r => r.text());
const schemas = await sharedSchemas();
mount(document.getElementById('m'), svg, {}, { schemas, theme: 'night' });
try { mount(document.createElement('div'), svg, {}, { schemas, theme: 'dusk' }); window.refused = 'none'; } catch (e) { window.refused = e.code; }
window.ready = true;
</script>`],
  '/fault.html': ['text/html', `<!doctype html><meta charset="utf-8"><style>div,hypersvg-asset{display:block;width:400px;height:300px}</style>
<div id="shown"></div><div id="hidden"></div>
<hypersvg-asset id="el" src="/faulty.svg" fault-box="hidden"></hypersvg-asset>
<script type="module">
import { mount, sharedSchemas } from '/engine/v2/web/asset-web.mjs';
const svg = await fetch('/faulty.svg').then(r => r.text());
const schemas = await sharedSchemas();
window.errors = { shown: [], hidden: [], el: [] };
mount(document.getElementById('shown'), svg, {}, { schemas, onError: (d) => window.errors.shown.push(d.code) });
mount(document.getElementById('hidden'), svg, {}, { schemas, faultBox: false, onError: (d) => window.errors.hidden.push(d.code) });
const el = document.getElementById('el');
el.addEventListener('hsvg:error', (e) => window.errors.el.push(e.detail.code));
await el.ready;
window.ready = true;
</script>`],
};

const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const requests = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  requests.push(url.pathname);
  const v = virtual[url.pathname];
  if (v) { res.writeHead(200, { 'content-type': v[0], ...(v[2] ? { 'content-security-policy': v[2] } : {}) }); return res.end(v[1]); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await engine.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const pageErrors = [];
const open = async (url) => {
  const tab = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 1 });
  tab.on('pageerror', e => pageErrors.push(`${url}: ${e.message}`));
  await tab.goto(base + url);
  await tab.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  return tab;
};
const press = async (tab, sel) => { const b = await tab.locator(sel).boundingBox(); await tab.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };

try {
  // ---------- the host picks a theme ----------
  {
    const t = await open('/theme.html');
    const r = await t.evaluate(async () => {
      const fill = (root) => root.querySelector('[id$="__bulb"] circle')?.getAttribute('fill');
      const nope = document.getElementById('nope');
      const refusedEl = await nope.ready.then(() => 'none', (e) => e.code);
      return { day: fill(document.getElementById('day')), night: fill(document.getElementById('night')), mounted: fill(document.getElementById('m')), refusedEl, mark: nope.getAttribute('data-hsvg-refused'), refused: window.refused };
    });
    want(r.day === '#f59e0b' && r.night === NIGHT_SUN && r.mounted === NIGHT_SUN, `the host's theme: the author's theme without it (${r.day}); theme="night" and mount's theme give the night colours (${r.night}, ${r.mounted})`);
    want(r.refused === 'E-AXIS-INPUT' && r.refusedEl === 'E-AXIS-INPUT' && r.mark === 'E-AXIS-INPUT', `a theme the HyperSVG does not declare is refused: mount ${r.refused}, element ${r.refusedEl}`);
    await t.evaluate(() => document.getElementById('night').setAttribute('theme', 'lamp'));
    const back = await t.evaluate(async () => { const el = document.getElementById('night'); await new Promise(r => setTimeout(r, 50)); await el.ready; return el.querySelector('[id$="__bulb"] circle')?.getAttribute('fill'); });
    want(back === '#f59e0b', `a change of the theme attribute places the HyperSVG again in that theme (${back})`);
    await t.close();
  }

  // ---------- a strict Content-Security-Policy page ----------
  {
    const t = await open('/csp.html');
    const r = await t.evaluate(() => ({ violations: window.violations, styles: [...document.querySelectorAll('style')].map(s => s.nonce === 'n5nonce'), svgs: document.querySelectorAll('svg').length }));
    want(r.violations.length === 0 && r.svgs >= 2 && r.styles.length >= 1 && r.styles.every(Boolean), `with the nonce, a strict CSP page plays the lamp twice (mount and element) with no violation (${r.violations.length}: ${r.violations.slice(0, 3).join(' | ')}); ${r.styles.length} player <style> elements carry the nonce`);
    await t.close();
    const u = await open('/csp-none.html');
    const v = await u.evaluate(() => window.violations);
    want(v.length > 0, `without the nonce the same page reports violations (${v.length}), so the option is what makes it work`);
    await u.close();
  }

  // ---------- hide the fault box ----------
  {
    const t = await open('/fault.html');
    for (const sel of ['#shown [id$="__switch"]', '#hidden [id$="__switch"]', '#el [id$="__switch"]']) await press(t, sel);
    await t.waitForFunction(() => window.errors.shown.length && window.errors.hidden.length && window.errors.el.length, null, { timeout: 10000 });
    const r = await t.evaluate(() => ({ errors: window.errors, boxes: ['shown', 'hidden', 'el'].map(id => document.getElementById(id).querySelectorAll('[data-hsvg-fault]').length) }));
    want(JSON.stringify(r.boxes) === '[1,0,0]', `the fault box shows by default and not with faultBox: false or fault-box="hidden" (${r.boxes.join(', ')})`);
    const c = r.errors.shown[0];
    want(/^E-/.test(c) && r.errors.hidden[0] === c && r.errors.el.includes(c), `the fault still reaches onError and hsvg:error (${JSON.stringify(r.errors)})`);
    await t.close();
  }
  // ---------- host words ----------
  {
    const t = await open('/words.html');
    const r = await t.evaluate(() => {
      const seen = (id) => ({ text: document.querySelector(`#${id} [id$="__state"]`)?.textContent, label: document.querySelector(`#${id} [id$="__switch"]`)?.getAttribute('aria-label') });
      return { en: seen('en'), fr: seen('fr'), lean: seen('lean'), refused: window.refused };
    });
    want(r.en.text === 'On' && r.en.label === 'Lamp on', `without host words the lamp shows its own words (${r.en.text}, ${r.en.label})`);
    want(r.fr.text === 'Allumée' && r.fr.label === 'Lampe allumée' && r.lean.text === 'Allumée' && r.lean.label === 'Lampe allumée', `host words in French show in the drawing and the control's name, on both paths (${r.fr.text}, ${r.fr.label}; ${r.lean.text})`);
    want(JSON.stringify(r.refused) === JSON.stringify(['E-WORDS:0', 'E-WORDS:0', 'E-WORDS:0']), `bad host words are refused before anything plays (${r.refused.join(', ')})`);
    await t.close();
  }

  // ---------- the one-file player ----------
  {
    const from = requests.length;
    const t = await open('/cdn.html');
    const asked = requests.slice(from);
    const r = await t.evaluate(() => ({ states: window.states, version: window.version, shade: window.mounted.read('shade'), text: document.querySelector('#lamp [id$="__state"]')?.textContent }));
    want(JSON.stringify(r.states) === '["ready","ready"]' && r.text === 'On' && r.shade === 'sky', `the one-file player plays the lamp from its attributes, a file with integrity, and mount() (${r.states.join(', ')}; ${r.text})`);
    const engineAsked = asked.filter(u => u.startsWith('/engine/') || u.startsWith('/spec/'));
    want(engineAsked.length === 0 && asked.filter(u => u.endsWith('.js')).length === 1, `one module request and no schema request (${asked.join(', ')})`);
    await press(t, '#lamp [id$="__switch"]');
    await t.waitForFunction(() => document.querySelector('#lamp [id$="__state"]')?.textContent === 'Off', null, { timeout: 5000 }).catch(() => {});
    want(await t.evaluate(() => document.querySelector('#lamp [id$="__state"]')?.textContent) === 'Off', 'a press on the drawn switch works in the one-file player');
    console.log(`note: ${committedCurrent ? 'the committed engine/v2/web/hypersvg-asset.js is current' : 'the committed engine/v2/web/hypersvg-asset.js is not current: run node engine/v2/tools/bundle-asset.mjs'} (${Buffer.byteLength(oneFile)} bytes, version ${r.version})`);
    await t.close();
  }

  // ---------- place(name) ----------
  {
    const t = await open('/place.html');
    const r = await t.evaluate(() => {
      const code = (fn) => { try { fn(); return 'none'; } catch (e) { return e.code; } };
      const out = {};
      for (const [k, p] of Object.entries(window.players)) {
        const b = document.querySelector(`#${k} [id$="__switch"]`).getBoundingClientRect();
        const got = p.place('switch');
        out[k] = { got, want: { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height }, unlisted: code(() => p.place('bulb')) };
      }
      window.players.checked.destroy();
      out.closed = code(() => window.players.checked.place('switch'));
      out.scrollY = scrollY;
      return out;
    });
    const same = (a, b) => a && b && ['x', 'y', 'width', 'height'].every(k => Math.abs(a[k] - b[k]) < 0.01);
    want(r.scrollY > 0 && same(r.checked.got, r.checked.want) && same(r.lean.got, r.lean.want) && r.checked.got.width > 0, `place('switch') gives the listed place's box in page coordinates, on the checked and the integrity path (${JSON.stringify(r.checked.got)})`);
    want(r.checked.unlisted === 'E-REF-UNKNOWN' && r.lean.unlisted === 'E-REF-UNKNOWN' && r.closed === 'E-HOST-CLOSED', `a place the scene does not list is refused (${r.checked.unlisted}); after destroy, ${r.closed}`);
    await t.close();
  }
  want(pageErrors.length === 0, `no page errors${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problems` : 'n5 host browser: all checks pass');
process.exit(problems.length ? 1 : 0);
