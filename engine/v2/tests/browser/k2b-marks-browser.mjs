// What the final drawing marks need from the player, packed and played in a real browser. Run alone (it
// starts a browser): node engine/v2/tests/browser/k2b-marks-browser.mjs
// Fixture: engine/v2/tests/k2b-fixture.
// - Icons by id (6.2.2): the icon place shows the <symbol> of the icon set whose id the variant binding gives, in the
//   symbol's viewBox; an id in no icon set keeps the drawn icon.
// - Attach points are slots (6.9): player.attach puts the parcel on the bike's basket slot, and it rides with the
//   bike's moving frame; to its own home slot, or to null, it goes back where it was drawn.
// Playwright must already be installed (PW_PATH, or a global install). It is never a dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const { pack } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs')).href);
const { launchBrowser } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'browser.mjs')).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k2b-'));

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };

const out = path.join(tmp, 'fixture');
await pack(path.join(repo, 'engine', 'v2', 'tests', 'k2b-fixture'), out, { test: true });
const file = path.join(out, fs.readdirSync(out).find(f => f.endsWith('.html')));

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => document.querySelector('[id$="s__badge"]'), null, { timeout: 10000 });
  const badge = () => page.evaluate(() => { const b = document.querySelector('[id$="s__badge"]'); return { viewBox: b.getAttribute('viewBox'), kids: [...b.children].map(c => c.tagName).join(' ') }; });
  const press = async () => { await page.click('[id$="s__next"]'); await page.waitForTimeout(150); };

  let b = await badge();
  want(b.viewBox === '0 0 24 24' && b.kids === 'circle path', `the icon place shows the icon "clock" by id (got ${JSON.stringify(b)})`);
  await press();
  b = await badge();
  want(b.viewBox === '0 0 10 10' && b.kids === 'path', `a new id draws the icon "star" (got ${JSON.stringify(b)})`);
  await press();
  b = await badge();
  want(b.viewBox === '0 0 20 20' && b.kids === 'rect', `an id in no icon set keeps the drawn icon (got ${JSON.stringify(b)})`);

  // Attach. Where the parcel's placement point is on screen, and where the slots are.
  const spot = (id) => page.evaluate((id) => { const m = document.querySelector(`[id$="${CSS.escape(id)}"]`).getScreenCTM(); return [Math.round(m.e), Math.round(m.f)]; }, id);
  const parcel = () => page.evaluate(() => { const r = document.querySelector('[id$="s__parcel__box"]').getBoundingClientRect(); const p = document.querySelector('[id$="s__parcel__box"]').closest('[data-player-use]').parentElement.id; return { foot: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height)], in: p.replace(/^hsvg\d+__/, '') }; });
  const close = (a, b) => Math.abs(a[0] - b[0]) <= 2 && Math.abs(a[1] - b[1]) <= 2;
  const tap = async (id) => { await page.click(`[id$="s__${id}"]`); await page.waitForTimeout(200); };
  let p0 = await parcel();
  want(p0.in === 's__parcel-home' && close(p0.foot, await spot('s__parcel-home')), `the parcel starts on its home slot (${JSON.stringify(p0)})`);
  await tap('load');
  let p1 = await parcel();
  want(p1.in === 's__bike__basket-point' && close(p1.foot, await spot('s__bike__basket-point')), `player.attach puts it on the bike's basket slot (${JSON.stringify(p1)})`);
  await tap('ride'); await page.waitForTimeout(300);
  const p2 = await parcel(); const basket = await spot('s__bike__basket-point');
  want(close(p2.foot, basket) && p2.foot[0] - p1.foot[0] > 50, `it rides with the moving frame (${JSON.stringify(p1.foot)} -> ${JSON.stringify(p2.foot)}, basket ${JSON.stringify(basket)})`);
  await tap('home');
  const p3 = await parcel();
  want(p3.in === 's__parcel-home' && close(p3.foot, await spot('s__parcel-home')), `attached to its own home slot it goes back (${JSON.stringify(p3)})`);
  await tap('load'); await tap('off');
  const p4 = await parcel();
  want(p4.in === 's__parcel-home' && close(p4.foot, p0.foot), `attached to null it goes back too (${JSON.stringify(p4)})`);
  want(errors.length === 0, `no page errors (${errors.join('; ')})`);
} finally {
  await browser.close();
}
if (problems.length) { console.log(`${problems.length} problem(s)`); process.exit(1); }
console.log('k2b marks: all passed');
