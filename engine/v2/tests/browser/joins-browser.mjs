// The player tries every layout that applies unreduced before any give-way step (7.1, 8.4), and gives the
// ladder's read-out on the page state and the host API (state.ladder(), host.ladder()). The ladder fixture
// (engine/v2/tests/ladder-fixture), changed in memory: the scene gets two layouts by shape, "tight" first (its
// headline box is too narrow for one line) and "roomy" (the 970x250 drawing), and the content tier is short.
// Run alone (it starts a browser):
//   node engine/v2/tests/browser/joins-browser.mjs
// Checks:
// - at 970x250 the tight layout needs steps and the roomy one fits unreduced: the roomy one shows, with no steps;
// - with the roomy layout's headline box narrowed too, none fits unreduced: the first layout (tight) shows, reduced;
// - state.ladder() and the host API's ladder() give the same read-out, with the tier and the texts;
// - rich text under a give-way rule (the rich text fixture, tests/richtext-fixture, changed in memory): `remove` leaves
//   the optional was-price run out first, and an optional headline field that still does not fit goes as a whole.
// Playwright must already be installed (PW_PATH; PW_CHANNEL).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as richFixture } from '../richtext-fixture/files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const fixture = path.resolve(here, '..', 'ladder-fixture');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const base = {};
const read = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) read(p); else base[path.relative(fixture, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
read(fixture);
// The changed fixture. narrowBoth: the roomy layout's headline box is narrow too.
function filesFor(narrowBoth) {
  const f = { ...base };
  const exp = JSON.parse(f['experience.json']);
  exp.axes = exp.axes.map(a => (a.axis === 'content' ? { ...a, tiers: [{ tier: 'short' }] } : a.axis === 'shape' ? { axis: 'shape', select: 'space' } : a));
  f['experience.json'] = JSON.stringify(exp);
  const sc = JSON.parse(f['scenes/ad/scene.json']);
  sc.layouts = [{ id: 'tight', shape: { minWidth: 1 }, drawing: 'tight.svg' }, { id: 'roomy', shape: { minWidth: 1 }, drawing: 'roomy.svg' }];
  f['scenes/ad/scene.json'] = JSON.stringify(sc);
  const big = f['scenes/ad/ad-970x250.svg'];
  const narrow = big.replace('id="headline-box" data-hsvg-kind="part" data-hsvg-fit="" x="20" y="95" width="640"', 'id="headline-box" data-hsvg-kind="part" data-hsvg-fit="" x="20" y="95" width="160"');
  if (narrow === big) throw new Error('the fixture drawing changed: no headline box to narrow');
  f['scenes/ad/tight.svg'] = narrow;
  f['scenes/ad/roomy.svg'] = narrowBoth ? narrow : big;
  for (const k of Object.keys(f)) if (/ad-\d+x\d+\.svg$/.test(k)) delete f[k];
  return f;
}
// The rich text fixture: needs fit; the price fit has no steps of its own and a give-way rule shrinks then removes;
// the headline is optional, under a remove rule, in a box too small for any size.
function richFiles() {
  const f = structuredClone(richFixture);
  const exp = f['experience.json'];
  exp.needs = ['fit', 'ladder', 'rich-text'];
  exp.inputs.headline.required = false;
  const sc = f['scenes/ad/scene.json'];
  const price = sc.bindings.find(b => b.id === 'price-runs'); delete price.fit.steps;
  sc.rules = [
    { id: 'price-gives', kind: 'fits', subject: 'part:price', strength: 'give-way', priority: 0.3, steps: ['shrink', 'remove'], floor: { minTextPx: 18 } },
    { id: 'head-gives', kind: 'fits', subject: 'field:headline', strength: 'give-way', priority: 0.2, steps: ['remove'] },
  ];
  const tall = f['scenes/ad/tall.svg'];
  f['scenes/ad/tall.svg'] = tall
    .replace('id="price-box" data-hsvg-kind="part" data-hsvg-fit="" x="20" y="360" width="260"', 'id="price-box" data-hsvg-kind="part" data-hsvg-fit="" x="20" y="360" width="120"')
    .replace('id="head-1-box" data-hsvg-kind="part" data-hsvg-fit="" x="20" y="20" width="260" height="120"', 'id="head-1-box" data-hsvg-kind="part" data-hsvg-fit="" x="20" y="20" width="20" height="8"')
    .replace('id="head-2-box" data-hsvg-kind="part" data-hsvg-fit="" x="20" y="160" width="260" height="160"', 'id="head-2-box" data-hsvg-kind="part" data-hsvg-fit="" x="20" y="160" width="20" height="8"');
  if (f['scenes/ad/tall.svg'].split('width="20" height="8"').length !== 3 || !f['scenes/ad/tall.svg'].includes('width="120"')) throw new Error('the rich text fixture drawing changed');
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
}
const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
let files = filesFor(false);
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
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); };
const log = (m) => console.log(m);
const pageErrors = [];
const url = () => `http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`;

async function open() {
  const page = await browser.newPage({ viewport: { width: 970, height: 250 } });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(url());
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.hsvg.drawing?.ladderAll && document.querySelector('[id$="ad__headline"]')?.getAttribute('data-hsvg-fitted'), null, { timeout: 8000 });
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => {
    const h = window.hsvg;
    const l = h.ladder();
    return { layout: h.drawing.frames.ad?.layout, why: h.choices?.ad?.why, outcome: h.drawing.ladderAll?.outcome, ladder: l, same: JSON.stringify(l) === JSON.stringify(h.host.ladder()),
      copy: (() => { const a = h.ladder(); if (a.ad) a.ad.tier = 'x'; return h.ladder().ad?.tier !== 'x'; })(), errors: [...h.errors, ...h.drawing.faults.map(f => f.message)] };
  });
  await page.close();
  return s;
}

try {
  const a = await open();
  log(`one fits unreduced: ${JSON.stringify(a)}`);
  want(a.layout === 'roomy', `the roomy layout fits unreduced and should show, not ${a.layout} (${a.why})`);
  want(a.outcome === 'unchanged', `no give-way step should run, outcome ${a.outcome}`);
  want(a.ladder.ad?.tier === 'short' && Array.isArray(a.ladder.ad?.texts) && a.ladder.ad.texts.some(t => t.field === 'headline' && t.text === 'Fresh sourdough'), `the read-out should give the tier and the headline text: ${JSON.stringify(a.ladder)}`);
  want(a.same && a.copy, 'state.ladder() and host.ladder() should give the same copy');
  want(!a.errors.length, `errors: ${a.errors.join('; ')}`);
  files = filesFor(true);
  const b = await open();
  log(`none fits unreduced: ${JSON.stringify(b)}`);
  want(b.layout === 'tight', `none fits unreduced, so the first layout should take the steps, not ${b.layout}`);
  want(b.why === 'reduced', `the choice should say reduced, not ${b.why}`);
  want(b.outcome === 'reduced' && (b.ladder.ad?.steps || []).length > 0, `the steps should run: ${JSON.stringify(b.ladder)}`);
  want(!b.errors.length, `errors: ${b.errors.join('; ')}`);
  // Rich text under give-way rules (item 5).
  files = richFiles();
  const page = await browser.newPage({ viewport: { width: 300, height: 600 } });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(url());
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('[id$="ad__price"]')?.getAttribute('data-hsvg-fitted'), null, { timeout: 8000 });
  await page.waitForTimeout(200);
  const c = await page.evaluate(() => {
    const h = window.hsvg; const el = (id) => document.querySelector(`[id$="ad__${id}"]`);
    const shown = (id) => getComputedStyle(el(id)).display !== 'none';
    return { layout: h.drawing.frames.ad?.layout, price: el('price').textContent, priceFit: el('price').getAttribute('data-hsvg-fitted'), head1: shown('head-1'), head2: shown('head-2'), headFit: el('head-1').getAttribute('data-hsvg-fitted'),
      label: el('price').getAttribute('aria-label'), ladder: h.ladder(), errors: [...h.errors, ...h.drawing.faults.map(f => f.message)] };
  });
  await page.close();
  log(`rich text: ${JSON.stringify(c)}`);
  const t = (id) => (c.ladder.ad?.texts || []).find(x => x.binding === id);
  want(c.layout === 'tall', `the tall frame should show, not ${c.layout}`);
  want(c.price.replace(/\s+/g, ' ').trim() === 'now $29' && c.priceFit === 'given-way', `remove should leave the optional was-price run out first: "${c.price}" (${c.priceFit})`);
  want(t('price-runs')?.runsLeftOut === 1 && !t('price-runs')?.removed, `the read-out should give one run left out: ${JSON.stringify(t('price-runs'))}`);
  want(!c.head1 && !c.head2 && c.headFit === 'given-way', `the optional headline that cannot fit should go as a whole (${c.headFit})`);
  want(t('headline-runs')?.removed === true, `the read-out should say the headline was removed: ${JSON.stringify(t('headline-runs'))}`);
  want(!c.errors.length, `errors: ${c.errors.join('; ')}`);
} catch (e) { problems.push(e.stack || e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) log(`problem: ${p}`);
log(problems.length ? 'joins browser run: FAIL' : 'joins browser run: pass');
process.exit(problems.length ? 1 : 0);
