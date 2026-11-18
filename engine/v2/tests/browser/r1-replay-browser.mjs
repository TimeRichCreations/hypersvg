// Record in a real page, replay in Node (9.6, 9.6.1; added after 2.0.0-next.0). Each experience is mounted through
// mount() with a clock and onMove. Real clicks, keys and waits play it; the page keeps every move and the state
// fingerprint after each one. Node then feeds the moves to the logic-only entry (src/logic.mjs) and must give the same
// fingerprint after every move. Run alone (it starts a browser):
//   PW_PATH=/opt/node-tools node engine/v2/tests/browser/r1-replay-browser.mjs
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { sha256 } from '../../src/members.mjs';
import { logic } from '../../src/logic.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const EPOCH = Date.UTC(2026, 10, 17, 9, 30, 0);
const CASES = [
  { folder: 'skill/2.0/examples/recipes/quiz', steps: 14, keys: ['Enter', 'Tab'] },
  { folder: 'examples/2.0-showcase/starfall', steps: 14, keys: ['Space', 'ArrowLeft', 'ArrowRight'] },
];

// A package of an experience folder: every text file, and package.json with their digests (10.8).
function packageOf(folder) {
  const files = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['tests', 'evidence'].includes(e.name)) walk(p); } else if (/\.(json|svg|csv|txt|vtt)$/.test(e.name)) files[path.relative(folder, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8');
    }
  };
  walk(folder);
  const doc = JSON.parse(files['experience.json']);
  const enc = new TextEncoder();
  const members = Object.fromEntries(Object.keys(files).sort().map(k => [k, sha256(enc.encode(files[k]))]));
  files['package.json'] = JSON.stringify({ format: 'hsvg/2.0', kind: 'package', id: doc.id, experience: 'experience.json', needs: doc.needs || [], members });
  return files;
}
const bytesOf = (files) => Object.fromEntries(Object.entries(files).map(([k, v]) => [k, new TextEncoder().encode(v)]));

const schemasObj = loadSchemas(path.join(repo, 'spec', '2.0'));
const schemas = JSON.stringify(schemasObj);
const page = `<!doctype html><meta charset="utf-8"><div id="stage" style="width:480px;height:480px"></div>
<script type="module">
import { mount } from '/engine/v2/web/mount-web.mjs';
import { fingerprint } from '/engine/v2/src/logic.mjs';
const schemas = await fetch('/schemas.json').then(r => r.json());
window.play = (raw, epoch) => {
  const enc = new TextEncoder();
  const pkg = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, enc.encode(v)]));
  window.moves = []; window.prints = [];
  let host = null; let due = false;
  // After a move has run (a microtask after its handler), the fingerprint of that state. Moves made in one go (the
  // size and the start at mount) share one print, on the last of them.
  const note = () => { window.prints[window.moves.length - 1] = fingerprint(host.internal); due = false; };
  host = mount(document.getElementById('stage'), pkg, { schemas, test: true, partition: 'replay-' + Math.random().toString(36).slice(2),
    clock: (t) => epoch + t,
    onMove: (m) => { window.moves.push(m); window.prints.push(null); if (!due) { due = true; queueMicrotask(() => host && note()); } } });
  note();
  window.host = host;
};
// The centre of every focusable part of the drawing, in page pixels.
window.targets = () => [...document.querySelectorAll('#stage [tabindex]')].map(el => el.getBoundingClientRect()).filter(b => b.width > 0 && b.height > 0).map(b => [b.x + b.width / 2, b.y + b.height / 2]);
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
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
try {
  for (const c of CASES) {
    const tab = await browser.newPage();
    const pageErrors = []; tab.on('pageerror', e => pageErrors.push(e.message));
    await tab.goto(`http://127.0.0.1:${server.address().port}/`);
    await tab.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
    const files = packageOf(path.join(repo, c.folder));
    await tab.evaluate(([raw, epoch]) => window.play(raw, epoch), [files, EPOCH]);
    let seed = 11;
    const next = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let i = 0; i < c.steps; i++) {
      const spots = await tab.evaluate(() => window.targets());
      if (spots.length && next(3) > 0) { const [x, y] = spots[next(spots.length)]; await tab.mouse.click(x, y); } else await tab.keyboard.press(c.keys[next(c.keys.length)]);
      await tab.waitForTimeout(150 + next(500));
    }
    await tab.evaluate(() => { window.host.pause('test'); });
    await tab.waitForTimeout(200);
    await tab.evaluate(() => { window.host.resume('test'); });
    await tab.waitForTimeout(100);
    const { moves, prints } = await tab.evaluate(() => ({ moves: window.moves, prints: window.prints }));
    await tab.close();
    if (pageErrors.length) problems.push(`${c.folder}: page errors: ${pageErrors.join('; ')}`);
    const sources = [...new Set(moves.map(m => m.source))];
    want(moves[0]?.source === 'setSize' && moves.some(m => m.source === 'start') && moves.some(m => m.source === 'activate' || m.source === 'key'), `${c.folder}: the page heard ${moves.length} moves (${sources.join(', ')})`);
    const l = logic(bytesOf(files), { schemas: schemasObj, clock: (t) => EPOCH + t });
    let compared = 0; let first = null;
    moves.forEach((m, i) => {
      l.feed(m);
      if (prints[i] == null) return;
      compared++;
      const got = l.fingerprint();
      if (got !== prints[i] && first === null) first = { i, move: m, got, want: prints[i] };
    });
    want(first === null && compared > 5, `${c.folder}: Node gives the page's fingerprint after each of ${compared} moves${first ? `; first difference after move ${first.i} ${JSON.stringify(first.move).slice(0, 160)}` : ''}`);
  }
} catch (e) { problems.push(e.stack || e.message); } finally { await browser.close(); server.close(); }
for (const p of problems) console.log(`problem: ${p}`);
console.log(problems.length ? 'replay browser run: FAIL' : 'replay browser run: pass');
process.exit(problems.length ? 1 : 0);
