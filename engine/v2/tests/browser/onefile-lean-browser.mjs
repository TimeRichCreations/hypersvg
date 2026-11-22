// The lean one-file player (engine/v2/web/hypersvg-asset-lean.js, added for 2.0.0-next.2) in a real browser. Run alone
// (it starts a browser):
//   node engine/v2/tests/browser/onefile-lean-browser.mjs
// Checks:
// - a HyperSVG placed with integrity mounts from the lean file, and the page fetches nothing but the page, the lean file
//   and the HyperSVG (no module, no schema);
// - mountAsync from the lean file, with integrity, mounts too;
// - a HyperSVG with a made sound plays its first sound at the first press (an oscillator starts), with no request for
//   the audio code: the build loads its own audio-web.mjs, so the build's player gets the sound;
// - the same lean build made without the bundler's dynamic option cannot: its audio module is fetched beside the file
//   and gives sound to its own copy of the player, not to the build's.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { packAsset, bundle, PLAYER_NOTICE } from '../../tools/pack.mjs';
import { schemasText } from '../../tools/bundle-asset.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const engine = pw[process.env.PW_BROWSER || 'chromium'];

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'onefile-lean-'));
const sri = (text) => `sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}`;
const pack = async (dir) => fs.readFileSync((await packAsset(path.join(repo, 'engine', 'v2', 'tests', dir), temp())).svgPath, 'utf8');
const chime = await pack('sound-fixture');
const lamp = await pack('k2f-fixture');
const LEAN = '/engine/v2/web/hypersvg-asset-lean.js';
const TRIAL = '/engine/v2/web/hypersvg-asset-trial.js';
// The lean build as the bundler made it before its dynamic option: the same entry and wrapper, loads on demand left as
// they are.
function trialBuild() {
  const web = path.join(repo, 'engine', 'v2', 'web');
  const b = bundle(path.join(web, 'asset-lean.mjs'), [], { texts: { [path.join(web, 'asset-schemas.mjs')]: schemasText('lean') } });
  return [`/*! ${PLAYER_NOTICE} */`, 'const defs = {}; const cache = {};', 'const __hsvgHere = import.meta.url;',
    'function req(n) { if (n in cache) return cache[n]; const exp = cache[n] = {}; defs[n](exp); return exp; }', b.defs,
    `const __hsvg = req(${b.entry});`, 'export const { mountAsync, HyperSvgAsset, useSchemas, sharedSchemas, VERSION, elementVersion } = __hsvg;', ''].join('\n');
}
const box = '<style>hypersvg-asset,#a{display:block;width:400px;height:300px}</style>';
const page = (script, body) => ['text/html', `<!doctype html><meta charset="utf-8">${box}<script type="module" src="${script}"></script>${body}`];
const virtual = {
  '/chime.svg': ['image/svg+xml', chime],
  '/lamp.svg': ['image/svg+xml', lamp],
  [TRIAL]: ['text/javascript', trialBuild()],
  '/lamp.html': page(LEAN, `<hypersvg-asset id="x" src="/lamp.svg" integrity="${sri(lamp)}"></hypersvg-asset>`),
  '/chime.html': page(LEAN, `<hypersvg-asset id="x" src="/chime.svg" integrity="${sri(chime)}"></hypersvg-asset>`),
  '/trial.html': page(TRIAL, `<hypersvg-asset id="x" src="/chime.svg" integrity="${sri(chime)}"></hypersvg-asset>`),
  '/mount.html': ['text/html', `<!doctype html><meta charset="utf-8">${box}<div id="a"></div><script type="module">
import { mountAsync } from '${LEAN}';
const h = await mountAsync(document.getElementById('a'), await fetch('/lamp.svg').then(r => r.text()), {}, { integrity: '${sri(lamp)}' });
window.ready = !!h && typeof h.read === 'function';
</script>`],
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
const open = async (url) => {
  const tab = await browser.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 1 });
  const requests = [];
  tab.on('request', (r) => requests.push(new URL(r.url()).pathname));
  tab.on('pageerror', e => pageErrors.push(`${url}: ${e.message}`));
  await tab.addInitScript(() => {
    window.__tones = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__tones++; return start.apply(this, a); };
  });
  await tab.goto(base + url);
  return { tab, requests };
};
const ready = (tab) => tab.evaluate(async () => { await customElements.whenDefined('hypersvg-asset'); return document.getElementById('x').ready.then(() => 'ready', e => e.code || e.message); });
async function press(tab, sel) {
  const b = await (await tab.$(sel)).boundingBox();
  await tab.mouse.click(b.x + 200, b.y + 150);
  await tab.waitForTimeout(150);
  return tab.evaluate(() => window.__tones);
}
const others = (requests, allowed) => requests.filter(r => !allowed.includes(r) && r !== '/favicon.ico');

try {
  {
    const { tab, requests } = await open('/lamp.html');
    want(await ready(tab) === 'ready', 'a HyperSVG placed with integrity mounts from the lean file');
    await tab.waitForTimeout(200);
    const extra = others(requests, ['/lamp.html', LEAN, '/lamp.svg']);
    want(extra.length === 0, `it fetches nothing but the page, the lean file and the HyperSVG: ${extra.join(', ') || 'nothing else'}`);
    await tab.close();
  }
  {
    const { tab, requests } = await open('/mount.html');
    await tab.waitForFunction(() => window.ready, null, { timeout: 10000 });
    want(true, 'mountAsync from the lean file mounts a HyperSVG with integrity');
    const extra = others(requests, ['/mount.html', LEAN, '/lamp.svg']);
    want(extra.length === 0, `mountAsync fetches nothing else: ${extra.join(', ') || 'nothing else'}`);
    await tab.close();
  }
  {
    const { tab, requests } = await open('/chime.html');
    const s = await ready(tab);
    const tones = await press(tab, '#x');
    want(s === 'ready' && tones >= 1, `the lean file: the made sound plays at the first press (${s}, ${tones} tones)`);
    const extra = others(requests, ['/chime.html', LEAN, '/chime.svg']);
    want(extra.length === 0, `the lean file holds the audio code: ${extra.join(', ') || 'no other request'}`);
    await tab.close();
  }
  {
    const { tab, requests } = await open('/trial.html');
    const s = await ready(tab);
    const tones = await press(tab, '#x');
    const fetched = requests.includes('/engine/v2/web/audio-web.mjs');
    want(tones === 0 && fetched, `the build without dynamic fetches audio-web.mjs beside it and plays no sound (${s}, ${tones} tones, fetched: ${fetched})`);
    await tab.close();
  }
  want(pageErrors.length === 0, `no page errors${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problems` : 'lean one-file player browser: all checks pass');
process.exit(problems.length ? 1 : 0);
