// K2f (D45): the HyperSVG in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/k2f-asset-browser.mjs [--out <folder for screenshots>]
// Checks:
// - the committed car.svg is what pack --asset makes now, and unpack then pack gives the same bytes;
// - the rest pose: car.svg in an <img> draws exactly what the car's own drawing draws (a screenshot of each);
// - the page of three cars (examples/2.0-asset-car/page): three <hypersvg-asset> elements at different knobs share
//   one player (one module, one copy of the schemas) and each plays on its own; element.inputs() lists each input's
//   name, type and bounds;
// - the latest change wins: an attribute change sets the input, a person's press on the drawn roof switch changes the
//   same knob, and the attribute set again takes effect; each change is heard as hsvg:changed with who made it;
// - the car's events reach on() and the DOM (hsvg:engineStarted);
// - a tall box shows the car's tall layout;
// - mount(element, assetSvg, inputs) with the lamp fixture: inputs checked, events heard;
// - refused assets: a tampered member (E-PACKAGE-DIGEST), an SVG with no record (E-ASSET), a resealed asset with a
//   script in its drawing (the drawing check): nothing plays and the fallback stays.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { packAsset } from '../../tools/pack.mjs';
import { unpack } from '../../tools/unpack.mjs';
import { readAsset, makeAsset } from '../../src/asset.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const engine = pw[process.env.PW_BROWSER || 'chromium'];
const oi = process.argv.indexOf('--out');
const shots = oi > 0 ? path.resolve(process.argv[oi + 1]) : fs.mkdtempSync(path.join(os.tmpdir(), 'k2f-shots-'));
fs.mkdirSync(shots, { recursive: true });

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'k2f-'));

// ---------- Node side: the committed car.svg, the round trip, and the files the pages are given ----------
// The car is a showcase (examples/, D41): the lean base has no examples/, so its checks are skipped there, with a note.
const carDir = path.join(repo, 'examples', '2.0-asset-car');
const hasCar = fs.existsSync(path.join(carDir, 'car.svg'));
if (hasCar) {
  const committed = fs.readFileSync(path.join(carDir, 'car.svg'));
  const fresh = await packAsset(path.join(carDir, 'car'), temp());
  want(fs.readFileSync(fresh.svgPath).equals(committed), 'examples/2.0-asset-car/car.svg is what pack --asset makes from car/ now');
  const back = path.join(temp(), 'car');
  unpack(path.join(carDir, 'car.svg'), back);
  const again = await packAsset(back, temp());
  want(fs.readFileSync(again.svgPath).equals(committed), 'car.svg: unpack, then pack again, gives the same bytes');
} else console.log('skip the car checks: examples/2.0-asset-car is not here (the lean base)');
const fixture = path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture');
const lamp = fs.readFileSync((await packAsset(fixture, temp())).svgPath, 'utf8');
const tampered = lamp.replace('<title>Lamp</title>', '<title>Lamb</title>'); // the drawing's title: its digest no longer matches
const plain = fs.readFileSync(path.join(fixture, 'scenes', 'lamp', 'lamp.svg'), 'utf8');
const scripted = (() => {
  const a = readAsset(lamp);
  const files = { ...a.files, [a.drawing]: a.files[a.drawing].replace('</svg>', '<script>window.hacked = true</script></svg>') };
  return makeAsset({ id: a.id, drawing: a.drawing, files });
})();

const virtual = {
  '/lamp.svg': ['image/svg+xml', lamp],
  '/tampered.svg': ['image/svg+xml', tampered],
  '/plain.svg': ['image/svg+xml', plain],
  '/scripted.svg': ['image/svg+xml', scripted],
  '/rest.html': ['text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff}img{display:block;width:800px;height:400px}</style>
<img id="smart" src="/examples/2.0-asset-car/car.svg" alt=""><img id="drawn" src="/examples/2.0-asset-car/car/scenes/drive/car.svg" alt="">`],
  '/tall.html': ['text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0}hypersvg-asset{width:390px;height:680px}</style>
<script type="module" src="/engine/v2/web/asset-web.mjs"></script><hypersvg-asset id="tall" src="/examples/2.0-asset-car/car.svg"></hypersvg-asset>`],
  '/refuse.html': ['text/html', `<!doctype html><meta charset="utf-8"><style>hypersvg-asset{width:400px;height:200px}</style>
<script type="module" src="/engine/v2/web/asset-web.mjs"></script>
<hypersvg-asset id="tampered" src="/tampered.svg"><img src="/lamp.svg" alt="fallback"></hypersvg-asset>
<hypersvg-asset id="plain" src="/plain.svg"><img src="/lamp.svg" alt="fallback"></hypersvg-asset>
<hypersvg-asset id="scripted" src="/scripted.svg"><img src="/lamp.svg" alt="fallback"></hypersvg-asset>`],
  '/mount.html': ['text/html', `<!doctype html><meta charset="utf-8"><div id="a" style="width:400px;height:300px"></div><div id="b" style="width:400px;height:300px"></div>
<script type="module">
import { mount, sharedSchemas } from '/engine/v2/web/asset-web.mjs';
const svg = await fetch('/lamp.svg').then(r => r.text());
const schemas = await sharedSchemas();
const code = (fn) => { try { fn(); return null; } catch (e) { return e.code || e.name; } };
window.refused = {
  range: code(() => mount(document.getElementById('b'), svg, { bright: 2 }, { schemas })),
  unknown: code(() => mount(document.getElementById('b'), svg, { colour: 'red' }, { schemas })),
  noSchemas: code(() => mount(document.getElementById('b'), svg, {})),
  tampered: code(() => mount(document.getElementById('b'), svg.replace('Brightness\\\\"', 'Dimmer\\\\"'), {}, { schemas })),
  empty: document.getElementById('b').children.length,
};
const lamp = mount(document.getElementById('a'), svg, { on: true, bright: 1, shade: 'sky' }, { schemas });
window.heard = [];
lamp.on('clicked', (e) => window.heard.push(e.name));
lamp.on('hsvg.changed', (e) => window.heard.push(e.detail.name + '=' + e.detail.value + ':' + e.detail.by));
window.lamp = lamp;
window.ready = true;
</script>`],
};

const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
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
const open = async (url, viewport = { width: 1280, height: 900 }) => {
  const tab = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  tab.on('pageerror', e => pageErrors.push(`${url}: ${e.message}`));
  await tab.goto(base + url);
  return tab;
};
const readyAll = (tab, ids) => tab.evaluate(async (ids) => {
  await customElements.whenDefined('hypersvg-asset');
  return Promise.all(ids.map(id => (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).ready.then(() => 'ready', e => e.code || e.message)));
}, ids);

try {
  // ---------- the rest pose in an <img> ----------
  if (hasCar) {
    const tab = await open('/rest.html');
    await tab.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
    const smart = await tab.locator('#smart').screenshot({ path: path.join(shots, 'asset-rest.png') });
    const drawn = await tab.locator('#drawn').screenshot({ path: path.join(shots, 'drawing-rest.png') });
    // Decoded on a canvas: the share of pixels that differ by more than 8 in any channel (PNG encoders differ by bytes).
    const diff = await tab.evaluate(() => {
      const data = (img) => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 800, 400); return g.getImageData(0, 0, 800, 400).data; };
      const a = data(document.getElementById('smart')); const b = data(document.getElementById('drawn'));
      let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) n++;
      return n / (a.length / 4);
    });
    want(smart.length > 10000 && drawn.length > 10000 && diff < 0.001, `the rest pose: car.svg in an <img> draws what the car's own drawing draws (${(diff * 100).toFixed(3)}% of pixels differ; screenshots asset-rest.png and drawing-rest.png)`);
    await tab.close();
  }

  // ---------- the page of three cars ----------
  if (hasCar) {
  const tab = await open('/examples/2.0-asset-car/page/index.html');
  const states = await readyAll(tab, ['car-1', 'car-2', 'car-3']);
  want(states.every(s => s === 'ready'), `three <hypersvg-asset> elements play (${states.join(', ')})`);
  const view = await tab.evaluate(() => {
    const cars = ['car-1', 'car-2', 'car-3'].map(id => (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)));
    const res = performance.getEntriesByType('resource').map(r => new URL(r.name).pathname);
    return {
      inputs: cars[0].inputs().map(i => ({ name: i.name, kind: i.kind, type: i.type, minimum: i.minimum, maximum: i.maximum, enum: i.enum })),
      knobs: cars.map(c => [c.read('length'), c.read('colour'), c.read('roofOpen')]),
      midScale: cars.map(c => c.querySelector('[id$="__body-mid"]')?.getAttribute('transform') || ''),
      paint: cars.map(c => getComputedStyle(c.querySelector('[id$="__car-body"] [data-hsvg-color="cherry"]') || c).fill),
      topShown: cars.map(c => Number(getComputedStyle(c.querySelector('[id$="__top-stack"]')).opacity)),
      drawings: cars.map(c => c.querySelectorAll('svg[viewBox="0 0 800 400"]').length),
      players: res.filter(p => p.endsWith('/asset-web.mjs')).length,
      runtimes: res.filter(p => p.endsWith('/src/runtime.mjs')).length,
      schemas: res.filter(p => p.endsWith('/scene.schema.json')).length,
      fallbacks: cars.map(c => c.querySelectorAll('img').length),
    };
  });
  want(JSON.stringify(view.inputs) === JSON.stringify([
    { name: 'length', kind: 'knob', type: 'number', minimum: 1, maximum: 1.8 },
    { name: 'roofOpen', kind: 'knob', type: 'boolean' },
    { name: 'colour', kind: 'knob', type: 'string', enum: ['cherry', 'ocean', 'mint', 'sunny', 'graphite'] },
  ]), `element.inputs() lists each input's name, kind, type and bounds: ${JSON.stringify(view.inputs)}`);
  want(JSON.stringify(view.knobs) === JSON.stringify([[1, 'cherry', false], [1.4, 'ocean', true], [1.8, 'mint', false]]), `the attributes set each car's knobs: ${JSON.stringify(view.knobs)}`);
  want(new Set(view.midScale).size === 3, `each car draws its own length (body-mid: ${view.midScale.join(' | ')})`);
  want(new Set(view.paint).size === 3, `each car draws its own paint (${view.paint.join(', ')})`);
  want(view.drawings.every(n => n === 1) && view.fallbacks.every(n => n === 0), 'each car shows its drawing in place of its <img> fallback');
  want(view.players === 1 && view.runtimes === 1 && view.schemas === 1, `three assets share one player: the module, the engine and the schemas load once (${view.players}, ${view.runtimes}, ${view.schemas})`);
  await tab.waitForTimeout(1200); // the glides settle
  await tab.screenshot({ path: path.join(shots, 'three-cars.png'), fullPage: true });
  const settled = await tab.evaluate(() => ['car-1', 'car-2', 'car-3'].map(id => Number(getComputedStyle((document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).querySelector('[id$="__top-stack"]')).opacity)));
  want(settled[0] < 0.05 && settled[1] > 0.95 && settled[2] < 0.05, `the roof is folded only on car 2, open at the start without a glide from closed (${settled.join(', ')}; screenshot three-cars.png)`);

  // ---------- the latest change wins ----------
  await tab.evaluate(() => {
    window.changes = [];
    for (const id of ['car-1', 'car-2']) (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).addEventListener('hsvg:changed', (e) => window.changes.push(`${id} ${e.detail.name}=${e.detail.value}:${e.detail.by}`));
  });
  await tab.evaluate(() => document.getElementById('car-1').setAttribute('colour', 'sunny'));
  await tab.waitForFunction(() => window.changes.length >= 1);
  const press = async (id, part) => {
    const box = await tab.locator(`[id$="${id}"] [id$="__${part}"]`).boundingBox();
    await tab.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  await press('car-1', 'roof-switch');
  await tab.waitForFunction(() => window.changes.length >= 2);
  await tab.evaluate(() => document.getElementById('car-1').setAttribute('roof-open', 'false'));
  await tab.waitForFunction(() => window.changes.length >= 3);
  await press('car-1', 'roof-switch');
  await tab.waitForFunction(() => window.changes.length >= 4);
  await tab.evaluate(() => document.getElementById('car-1').setAttribute('roof-open', 'false')); // the same attribute value again
  await tab.waitForFunction(() => window.changes.length >= 5);
  await press('car-1', 'swatch-graphite');
  await tab.waitForFunction(() => window.changes.length >= 6);
  await tab.evaluate(() => document.getElementById('car-1').set('colour', 'sunny'));
  await tab.waitForFunction(() => window.changes.length >= 7);
  const changes = await tab.evaluate(() => window.changes);
  want(JSON.stringify(changes) === JSON.stringify(['car-1 colour=sunny:host', 'car-1 roofOpen=true:person', 'car-1 roofOpen=false:host', 'car-1 roofOpen=true:person', 'car-1 roofOpen=false:host', 'car-1 colour=graphite:person', 'car-1 colour=sunny:host']),
    `the latest change wins, the attribute's, the drawn control's or the setter's, and each is heard: ${changes.join('; ')}`);
  const others = await tab.evaluate(() => [document.getElementById('car-2').read('colour'), document.getElementById('car-3').read('roofOpen')]);
  want(others[0] === 'ocean' && others[1] === false, 'the other cars did not change');

  // ---------- the car's events ----------
  await tab.evaluate(() => {
    window.events = [];
    const c = document.getElementById('car-2');
    c.on('engineStarted', (e) => window.events.push(`on ${e.name}`));
    c.addEventListener('hsvg:engineStarted', () => window.events.push('dom engineStarted'));
    c.addEventListener('hsvg:engineStopped', () => window.events.push('dom engineStopped'));
  });
  await press('car-2', 'ignition');
  await press('car-2', 'start');
  await tab.waitForFunction(() => window.events.length >= 2, null, { timeout: 10000 });
  await press('car-2', 'start');
  await tab.waitForFunction(() => window.events.length >= 3, null, { timeout: 10000 });
  const events = await tab.evaluate(() => window.events);
  want(JSON.stringify([...events].sort()) === JSON.stringify(['dom engineStarted', 'dom engineStopped', 'on engineStarted']), `the car's events reach on() and the DOM: ${events.join(', ')}`);
  await tab.close();
  }

  // ---------- the tall layout in a tall box ----------
  if (hasCar) {
    const t = await open('/tall.html', { width: 390, height: 844 });
    const s = await readyAll(t, ['tall']);
    const vb = await t.evaluate(() => [...document.getElementById('tall').querySelectorAll('svg')].map(x => x.getAttribute('viewBox')));
    want(s[0] === 'ready' && vb.includes('0 0 400 690'), `a tall box shows the car's tall layout (${vb.join(', ')})`);
    await t.screenshot({ path: path.join(shots, 'tall.png') });
    await t.close();
  }

  // ---------- mount() with the lamp ----------
  {
    const t = await open('/mount.html');
    await t.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
    const r = await t.evaluate(() => ({ refused: window.refused, inputs: window.lamp.inputs().map(i => `${i.name}:${i.type}=${JSON.stringify(i.value)}`) }));
    want(JSON.stringify(r.refused) === JSON.stringify({ range: 'E-RANGE', unknown: 'E-REF-UNKNOWN', noSchemas: 'TypeError', tampered: 'E-PACKAGE-DIGEST', empty: 0 }), `mount checks the inputs and the asset before anything plays: ${JSON.stringify(r.refused)}`);
    want(JSON.stringify(r.inputs) === JSON.stringify(['on:boolean=true', 'bright:number=1', 'shade:string="sky"']), `mount's inputs are the values at the start: ${r.inputs.join(', ')}`);
    const box = await t.locator('#a [id$="__switch"]').boundingBox();
    await t.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await t.waitForFunction(() => window.heard.length >= 2);
    const heard = await t.evaluate(() => window.heard);
    want(JSON.stringify([...heard].sort()) === JSON.stringify(['clicked', 'on=false:person']), `on() hears the asset's events and its input changes: ${heard.join(', ')}`);
    await t.close();
  }

  // ---------- refused assets ----------
  {
    const t = await open('/refuse.html');
    const s = await readyAll(t, ['tampered', 'plain', 'scripted']);
    const r = await t.evaluate(() => ({
      marks: ['tampered', 'plain', 'scripted'].map(id => (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).getAttribute('data-hsvg-refused')),
      fallbacks: ['tampered', 'plain', 'scripted'].map(id => (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).querySelectorAll('img').length),
      players: document.querySelectorAll('hypersvg-asset svg').length,
      hacked: window.hacked === true,
    }));
    want(s[0] === 'E-PACKAGE-DIGEST' && r.marks[0] === 'E-PACKAGE-DIGEST', `a tampered asset is refused (${s[0]})`);
    want(s[1] === 'E-ASSET' && r.marks[1] === 'E-ASSET', `an SVG with no asset record is refused (${s[1]})`);
    want(/^E-SVG/.test(s[2]) && /^E-SVG/.test(r.marks[2] || ''), `a resealed asset with a script in its drawing is refused by the drawing check (${s[2]})`);
    want(r.fallbacks.every(n => n === 1) && r.players === 0 && !r.hacked, 'a refused asset plays nothing and keeps its fallback; no script ran');
    await t.close();
  }
  want(pageErrors.length === 0, `no page errors${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.close();
}
console.log(`screenshots: ${shots}`);
console.log(problems.length ? `${problems.length} problems` : 'k2f asset browser: all checks pass');
process.exit(problems.length ? 1 : 0);
