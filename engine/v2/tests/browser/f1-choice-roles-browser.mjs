// Choice options keep their role while a clip plays (5.11), in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/f1-choice-roles-browser.mjs
// The lamp's two shade options are labelled parts (data-hsvg-label). A press on the switch plays a clip on another
// part (the glow). While it runs, the drawing paints every frame with no new revision; the options must stay radios
// with their names, and the switch a checkbox. Before the fix, each paint named the options as pictures (role img).
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { packAsset } from '../../tools/pack.mjs';
import { readAsset, makeAsset } from '../../src/asset.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const engine = pw[process.env.PW_BROWSER || 'chromium'];

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-roles-'));
const lamp = fs.readFileSync((await packAsset(path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture'), out)).svgPath, 'utf8');
fs.rmSync(out, { recursive: true, force: true });
const a = readAsset(lamp);
const scene = JSON.parse(a.files['scenes/lamp/scene.json']);
// A long clip on the glow, played by a press on the switch. The glow's binding is dropped so the clip owns it.
scene.bindings = scene.bindings.filter(b => b.target !== 'glow');
scene.clips = { pulse: { durationMs: 4000, tracks: [{ target: 'glow', channel: 'opacity', keys: [[0, 0], [2000, 1], [4000, 0]] }] } };
scene.on.flipped = [{ actions: [{ emit: 'clicked' }, { play: 'pulse' }] }];
const pulsing = makeAsset({ id: a.id, drawing: a.drawing, files: { ...a.files, 'scenes/lamp/scene.json': JSON.stringify(scene) } });

const page = `<!doctype html><meta charset="utf-8"><style>div{width:400px;height:300px}</style><div id="a"></div>
<script type="module">
import { mount, sharedSchemas } from '/engine/v2/web/asset-web.mjs';
const svg = await fetch('/pulsing.svg').then(r => r.text());
window.player = mount(document.getElementById('a'), svg, {}, { schemas: await sharedSchemas() });
window.ready = true;
</script>`;
const virtual = { '/pulsing.svg': ['image/svg+xml', pulsing], '/roles.html': ['text/html', page] };
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
  const tab = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  tab.on('pageerror', e => pageErrors.push(e.message));
  await tab.goto(`${base}/roles.html`);
  await tab.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const roles = () => tab.evaluate(() => {
    const q = (id) => document.querySelector(`#a [id$="__${id}"]`);
    return { sun: q('pick-sun')?.getAttribute('role'), sky: q('pick-sky')?.getAttribute('role'), sunName: q('pick-sun')?.getAttribute('aria-label'), power: q('switch')?.getAttribute('role'), bulb: q('bulb')?.getAttribute('role'), glow: q('glow')?.getAttribute('opacity') };
  });
  const before = await roles();
  want(before.sun === 'radio' && before.sky === 'radio' && before.power === 'checkbox', `before the clip: options ${before.sun}, ${before.sky}; switch ${before.power}`);
  const b = await tab.locator('#a [id$="__switch"]').boundingBox();
  await tab.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  // Read several times while the clip runs (it lasts 4 s).
  const during = [];
  for (let i = 0; i < 5; i++) { await tab.waitForTimeout(250); during.push(await roles()); }
  const moving = new Set(during.map(r => r.glow)).size > 1;
  want(moving, `the clip runs: the glow's opacity changes (${during.map(r => r.glow).join(', ')})`);
  const kept = during.every(r => r.sun === 'radio' && r.sky === 'radio' && r.sunName === 'Sun' && r.power === 'checkbox');
  want(kept, `while the clip plays, the options stay radios with their names (${during.map(r => `${r.sun}/${r.sky}/${r.sunName}`).join(', ')})`);
  want(during.every(r => r.bulb === 'img'), `a labelled part that is no control is still a picture (${during.map(r => r.bulb).join(', ')})`);
  want(pageErrors.length === 0, `no page errors (${pageErrors.join('; ') || 'none'})`);
} catch (e) {
  problems.push(e.stack || String(e));
  console.log(e.stack || e);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problem(s)` : 'all ok');
process.exit(problems.length ? 1 : 0);
