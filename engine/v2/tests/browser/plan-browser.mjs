// Layout plans (7.5, A7.1) in a real browser, on the plan fixture (engine/v2/tests/plan-fixture): an ad scene with
// an offer compound (a title, a photo share 30 to 70, copy). Run alone (it starts a browser):
//   node engine/v2/tests/browser/plan-browser.mjs
// Checks, at 300x250, 728x90, 160x600, 320x50 and 970x250:
// - live: the dev page with fit in needs solves the plans, and solves again on each resize;
// - baked: the packed page of the fixture without fit shows its derived frames and carries no solver;
// - the items' boxes on screen (the photo cut to its clip) are the same live and baked, within 1 CSS pixel, and the
//   items lie inside the page and do not overlap; no faults.
// Playwright must already be installed (PW_PATH; PW_CHANNEL).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { pack } from '../../tools/pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const fixture = path.resolve(here, '..', 'plan-fixture');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const SIZES = [[300, 250], [728, 90], [160, 600], [320, 50], [970, 250]];
const ITEMS = ['ad__offer__offer-title', 'ad__offer__offer-copy', 'ad__offer__photo'];

// The live variant: the fixture with fit in the experience's needs.
const files = {};
const read = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) read(p); else files[path.relative(fixture, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
read(fixture);
const exp = JSON.parse(files['experience.json']); exp.needs = ['fit']; files['experience.json'] = JSON.stringify(exp, null, 2);
const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/files.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(files)); }
  if (url.pathname === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(schemas); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.mjs') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-plan-'));
const packed = await pack(fixture, tmp, { date: '2026-11-07T00:00:00Z', test: true });

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); };
const log = (m) => console.log(m);
// The screen boxes of the items; a part under a plan clip is cut to the clip's rectangle.
const boxes = (page, ids) => page.evaluate((list) => list.map((id) => {
  const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  let b = { x: r.x, y: r.y, width: r.width, height: r.height };
  for (let x = el.parentElement; x; x = x.parentElement) {
    const ref = /url\(#([^)]+)\)/.exec(x.getAttribute('clip-path') || '')?.[1];
    const rect = ref && document.getElementById(ref)?.querySelector('rect');
    if (!rect) continue;
    const m = x.getScreenCTM(); const bb = rect.getBBox();
    const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y + bb.height]].map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
    const c = { x: Math.min(pts[0][0], pts[1][0]), y: Math.min(pts[0][1], pts[1][1]), width: Math.abs(pts[1][0] - pts[0][0]), height: Math.abs(pts[1][1] - pts[0][1]) };
    const x0 = Math.max(b.x, c.x); const y0 = Math.max(b.y, c.y);
    b = { x: x0, y: y0, width: Math.max(0, Math.min(b.x + b.width, c.x + c.width) - x0), height: Math.max(0, Math.min(b.y + b.height, c.y + c.height) - y0) };
  }
  return b;
}), ids);
const sized = async (page, w, h) => {
  await page.setViewportSize({ width: w, height: h });
  try { await page.waitForFunction((k) => window.hsvg?.space === k, `${w}x${h}`, { timeout: 5000 }); } catch { problems.push(`${w}x${h}: the page did not take the size`); }
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
};
const faults = (page) => page.evaluate(() => [...(window.hsvg.errors || []), ...(window.hsvg.drawing?.faults || []).map(f => `${f.code} ${f.message}`)]);
try {
  const live = {};
  const lp = await browser.newPage({ viewport: { width: 300, height: 250 } });
  const liveErrors = []; lp.on('pageerror', e => liveErrors.push(e.message));
  await lp.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await lp.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  want(await lp.evaluate(() => typeof window.hsvg.player.planSolver?.solve === 'function'), 'live: the fit capability is installed');
  let lastKey = null;
  for (const [w, h] of SIZES) {
    await sized(lp, w, h);
    const s = await lp.evaluate(() => ({ plans: Object.fromEntries(Object.entries(window.hsvg.drawing.plans || {}).map(([a, p]) => [a, { layout: p.layout, status: p.status, key: p.key }])) }));
    const offer = s.plans['ad/offer'];
    log(`live ${w}x${h}: ${JSON.stringify(Object.fromEntries(Object.entries(s.plans).map(([a, p]) => [a, `${p.layout} ${p.status}`])))}`);
    want(offer?.status === 'complete' && s.plans.ad?.status === 'complete', `live ${w}x${h}: both plans complete`);
    want(offer && offer.key !== lastKey, `live ${w}x${h}: the plan is solved again for the new space`);
    lastKey = offer?.key;
    live[`${w}x${h}`] = await boxes(lp, ITEMS);
  }
  for (const f of await faults(lp)) problems.push(`live: ${f}`);
  if (liveErrors.length) problems.push(`live page errors: ${liveErrors.join('; ')}`);
  await lp.close();

  const bp = await browser.newPage({ viewport: { width: 300, height: 250 } });
  const bakedErrors = []; bp.on('pageerror', e => bakedErrors.push(e.message));
  await bp.goto(pathToFileURL(packed.htmlPath).href);
  await bp.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  want(await bp.evaluate(() => !window.hsvg.player.planSolver), 'baked: the packed page carries no solver');
  for (const [w, h] of SIZES) {
    await sized(bp, w, h);
    const s = await bp.evaluate(() => ({ choice: window.hsvg.choices.ad, derived: (() => { const m = document.querySelector('[data-player-use="ad__offer"] > metadata') ?? document.querySelector('#stage svg > metadata'); try { return JSON.parse(m.textContent).derived; } catch { return null; } })() }));
    want(s.choice?.why === 'size' && /-\d+x\d+$/.test(s.choice.id), `baked ${w}x${h}: the derived frame is chosen by its size (${JSON.stringify(s.choice)})`);
    const b = await boxes(bp, ITEMS);
    const l = live[`${w}x${h}`];
    let worst = 0;
    ITEMS.forEach((id, i) => {
      if (!b[i] || !l[i]) { problems.push(`${w}x${h}: ${id} not drawn`); return; }
      for (const k of ['x', 'y', 'width', 'height']) worst = Math.max(worst, Math.abs(b[i][k] - l[i][k]));
      want(b[i].x >= -1 && b[i].y >= -1 && b[i].x + b[i].width <= w + 1 && b[i].y + b[i].height <= h + 1, `${w}x${h}: ${id} inside the page ${JSON.stringify(b[i])}`);
    });
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const p = b[i]; const q = b[j];
      if (p && q) want(p.x + p.width <= q.x + 1 || q.x + q.width <= p.x + 1 || p.y + p.height <= q.y + 1 || q.y + q.height <= p.y + 1, `${w}x${h}: ${ITEMS[i]} and ${ITEMS[j]} overlap`);
    }
    log(`baked ${w}x${h}: ${s.choice?.id}, largest difference from live ${worst.toFixed(3)} px`);
    want(worst <= 1, `${w}x${h}: live and baked differ by ${worst.toFixed(3)} px`);
  }
  for (const f of await faults(bp)) problems.push(`baked: ${f}`);
  if (bakedErrors.length) problems.push(`baked page errors: ${bakedErrors.join('; ')}`);
} catch (e) { problems.push(e.stack || e.message); } finally { await browser.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
for (const p of problems) log(`problem: ${p}`);
log(problems.length ? 'plan browser run: FAIL' : 'plan browser run: pass');
process.exit(problems.length ? 1 : 0);
