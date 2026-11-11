// Content tiers (7.9) and the give-way ladder at play (8.4, D2), on the ladder fixture
// (engine/v2/tests/ladder-fixture): one ad at 970x250, 728x90, 300x250 and 320x50 with a headline in three tiers,
// optional legal text with `remove` and a floor of 13 px, and a logo kept with `simplify` and `mark-only`.
// Run alone (it starts a browser):
//   node engine/v2/tests/browser/ladder-browser.mjs
// Checks, at each size:
// - the tier the space picks, and the steps each rule used, lowest priority first (the drawing's `ladder` read-out);
// - what shows: the wording, the floor never passed, legal text removed, the logo's name hidden and its sparkle gone;
// - live and baked are the same: one page resized through every size (live) gives exactly what a fresh page opened at
//   that size gives (baked: the steps run once for that space, as a baking tool runs them).
// Playwright must already be installed (PW_PATH; PW_CHANNEL).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const fixture = path.resolve(here, '..', 'ladder-fixture');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const files = {};
const read = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) read(p); else files[path.relative(fixture, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
read(fixture);
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
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); };
const log = (m) => console.log(m);
const pageErrors = [];
const url = () => `http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`;

// What the page shows now: the drawing's read-out and the drawn state of each text.
const snapshot = (page) => page.evaluate(() => {
  const d = window.hsvg.drawing;
  const el = (id) => document.querySelector(`[id$="ad__${id}"]`);
  const text = (id) => { const t = el(id); return { text: [...t.querySelectorAll('tspan[x]')].map(s => s.textContent).join(' / ') || t.textContent, px: parseFloat(t.style.fontSize) || null, shown: getComputedStyle(t).display !== 'none', fit: t.getAttribute('data-hsvg-fitted') }; };
  const r = d.ladder?.ad;
  return {
    space: window.hsvg.space, layout: d.frames.ad?.layout,
    tier: r?.tier, tierWhy: r?.tierWhy, steps: (r?.steps || []).map(s => `${s.rule}:${s.step}x${s.times}`), outcome: d.ladderAll?.outcome,
    headline: text('headline'), legal: text('legal'), brand: text('brand'),
    sparkle: getComputedStyle(el('sparkle')).display !== 'none',
    errors: [...window.hsvg.errors, ...d.faults.map(f => f.message)],
  };
});
const ready = (page, w, h) => page.waitForFunction((k) => window.hsvg?.space === k && window.hsvg.drawing?.ladderAll && document.querySelector('[id$="ad__headline"]')?.getAttribute('data-hsvg-fitted'), `${w}x${h}`, { timeout: 8000 });

const SIZES = [[970, 250], [728, 90], [300, 250], [320, 50]];
// The expected tier and steps at each size (the number of shrink steps depends on the font, so it is a pattern).
const EXPECT = {
  '970x250': { tier: 'rich', steps: [/^headline-fits:wrapx1$/], legal: true, brandShown: true, sparkle: true },
  '728x90': { tier: 'short', steps: [/^legal-fits:shrinkx1$/, /^legal-fits:removex1$/, /^logo-kept:simplifyx1$/, /^logo-kept:mark-onlyx1$/], legal: false, brandShown: false, sparkle: false },
  '300x250': { tier: 'medium', steps: [/^legal-fits:shortx1$/, /^headline-fits:wrapx1$/], legal: true, brandShown: true, sparkle: true },
  '320x50': { tier: 'short', steps: [/^legal-fits:shrinkx1$/, /^legal-fits:removex1$/, /^logo-kept:simplifyx1$/, /^logo-kept:mark-onlyx1$/, /^headline-fits:wrapx1$/, /^headline-fits:shrinkx\d+$/], legal: false, brandShown: false, sparkle: false },
};
const WORDING = { rich: 'Fresh sourdough, baked at dawn and delivered warm', medium: 'Fresh sourdough, delivered warm', short: 'Fresh sourdough' };

try {
  // Live: one page, resized through every size and back.
  const live = {};
  const page = await browser.newPage({ viewport: { width: 970, height: 250 } });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(url());
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  for (const [w, h] of [...SIZES, [970, 250]]) {
    await page.setViewportSize({ width: w, height: h });
    try { await ready(page, w, h); } catch { problems.push(`${w}x${h}: the ladder did not run`); }
    const s = await snapshot(page);
    log(`live ${w}x${h}: ${JSON.stringify(s)}`);
    if (!live[`${w}x${h}`]) live[`${w}x${h}`] = s; else want(JSON.stringify(s) === JSON.stringify(live[`${w}x${h}`]), `${w}x${h}: coming back to it should give the same output`);
  }
  await page.close();
  // Baked: a fresh page opened at each size.
  for (const [w, h] of SIZES) {
    const key = `${w}x${h}`;
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => pageErrors.push(e.message));
    await p.goto(url());
    await p.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
    try { await ready(p, w, h); } catch { problems.push(`${key}: the ladder did not run on a fresh page`); }
    const baked = await snapshot(p);
    await p.close();
    want(JSON.stringify(baked) === JSON.stringify(live[key]), `${key}: live and baked differ\n  live  ${JSON.stringify(live[key])}\n  baked ${JSON.stringify(baked)}`);
    // The expected tier, steps and output.
    const s = live[key]; const x = EXPECT[key];
    want(s.layout && s.tier === x.tier && s.tierWhy === 'space', `${key}: the tier should be ${x.tier} by space, not ${s.tier} (${s.tierWhy})`);
    want(s.steps.length === x.steps.length && x.steps.every((re, i) => re.test(s.steps[i])), `${key}: the steps should be ${x.steps.map(String).join(', ')}, not ${s.steps.join(', ')}`);
    want(s.outcome === 'reduced', `${key}: every rule should hold after the steps (outcome ${s.outcome})`);
    const head = s.headline.text.replace(/ \/ /g, ' ');
    const tierWords = WORDING[x.tier];
    want(head === tierWords, `${key}: the headline should show the ${x.tier} wording, not "${head}"`);
    want(s.headline.px >= 14 || s.headline.fit === 'drawn', `${key}: the headline went below its floor (${s.headline.px})`);
    want(s.legal.shown === x.legal, `${key}: the legal text should be ${x.legal ? 'shown' : 'removed'}`);
    if (x.legal) want(s.legal.px === null || s.legal.px >= 13, `${key}: the legal text went below its 13 px floor (${s.legal.px})`);
    want(s.brand.shown === x.brandShown, `${key}: the logo's name should be ${x.brandShown ? 'shown' : 'hidden (mark-only)'}`);
    want(x.brandShown || s.brand.fit === 'given-way', `${key}: the hidden name should be marked given-way, not ${s.brand.fit}`);
    want(s.sparkle === x.sparkle, `${key}: the logo's sparkle should be ${x.sparkle ? 'shown' : 'gone (simplify)'}`);
    want(!s.errors.length, `${key}: errors ${s.errors.join('; ')}`);
  }
} catch (e) { problems.push(e.stack || e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) log(`problem: ${p}`);
log(problems.length ? 'ladder browser run: FAIL' : 'ladder browser run: pass');
process.exit(problems.length ? 1 : 0);
