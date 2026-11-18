// Sound only when used (added after 2.0.0-next.0), in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/sound-on-demand-browser.mjs
// Checks:
// - the lean entry: a HyperSVG with no sound fetches no audio code (web/audio-web.mjs, src/mixer.mjs); one with a made
//   sound fetches it before it plays, and its first press sounds (an oscillator starts);
// - the full path of the lean entry, mountAsync and the one-file player play the sound too;
// - the synchronous mount (asset-web.mjs) still plays sound.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { packAsset } from '../../tools/pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const engine = pw[process.env.PW_BROWSER || 'chromium'];

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sound-'));
const sri = (text) => `sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}`;
const pack = async (dir) => fs.readFileSync((await packAsset(path.join(repo, 'engine', 'v2', 'tests', dir), temp())).svgPath, 'utf8');
const chime = await pack('sound-fixture');
const lamp = await pack('k2f-fixture');
const LEAN = '/engine/v2/web/asset-lean.mjs';
const box = '<style>hypersvg-asset,#a{display:block;width:400px;height:300px}</style>';
const page = (script, body) => ['text/html', `<!doctype html><meta charset="utf-8">${box}<script type="module" src="${script}"></script>${body}`];
const virtual = {
  '/chime.svg': ['image/svg+xml', chime],
  '/lamp.svg': ['image/svg+xml', lamp],
  '/quiet.html': page(LEAN, `<hypersvg-asset id="x" src="/lamp.svg" integrity="${sri(lamp)}"></hypersvg-asset>`),
  '/loud.html': page(LEAN, `<hypersvg-asset id="x" src="/chime.svg" integrity="${sri(chime)}"></hypersvg-asset>`),
  '/full.html': page(LEAN, '<hypersvg-asset id="x" src="/chime.svg"></hypersvg-asset>'),
  '/sync.html': page('/engine/v2/web/asset-web.mjs', '<hypersvg-asset id="x" src="/chime.svg"></hypersvg-asset>'),
  '/bundle.html': page('/engine/v2/web/hypersvg-asset.js', `<hypersvg-asset id="x" src="/chime.svg" integrity="${sri(chime)}"></hypersvg-asset>`),
  '/mount.html': ['text/html', `<!doctype html><meta charset="utf-8">${box}<div id="a"></div><script type="module">
import { mountAsync } from '${LEAN}';
const h = await mountAsync(document.getElementById('a'), await fetch('/chime.svg').then(r => r.text()), {}, { integrity: '${sri(chime)}' });
window.ready = !!h;
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
const AUDIO = ['/engine/v2/web/audio-web.mjs', '/engine/v2/src/mixer.mjs'];
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
// A trusted press on the button (the first gesture arms the audio), then the count of started tones.
async function press(tab, sel) {
  const b = await (await tab.$(sel)).boundingBox();
  await tab.mouse.click(b.x + 200, b.y + 150);
  await tab.waitForTimeout(150);
  return tab.evaluate(() => window.__tones);
}

try {
  {
    const { tab, requests } = await open('/quiet.html');
    want(await ready(tab) === 'ready', 'a HyperSVG with no sound plays on the lean page');
    want(!requests.some(r => AUDIO.includes(r)), `it fetches no audio code: ${requests.filter(r => AUDIO.includes(r)).join(', ') || 'none'}`);
    await tab.close();
  }
  for (const [url, what] of [['/loud.html', 'the lean page with integrity'], ['/full.html', 'the lean page without integrity'], ['/sync.html', 'asset-web.mjs (the synchronous mount)'], ['/bundle.html', 'the one-file player']]) {
    const { tab, requests } = await open(url);
    const s = await ready(tab);
    const tones = await press(tab, '#x');
    want(s === 'ready' && tones >= 1, `${what}: the made sound plays at the first press (${s}, ${tones} tones)`);
    if (url === '/bundle.html') want(!requests.some(r => AUDIO.includes(r)), 'the one-file player holds the audio code: no request for it');
    else want(AUDIO.every(r => requests.includes(r)), `the audio code was fetched: ${AUDIO.filter(r => requests.includes(r)).length} of 2`);
    await tab.close();
  }
  {
    const { tab } = await open('/mount.html');
    await tab.waitForFunction(() => window.ready);
    want(await press(tab, '#a') >= 1, 'mountAsync: the made sound plays at the first press');
    await tab.close();
  }
  want(pageErrors.length === 0, `no page errors${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problems` : 'sound on demand browser: all checks pass');
process.exit(problems.length ? 1 : 0);
