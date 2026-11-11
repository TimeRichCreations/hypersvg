// The kit ads (examples/2.0-kit-ads) in a real browser, packed, from file://. Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/kit-ads-browser.mjs
// Packs each ad with its kit, opens it at its own size, and checks: the layout for that size is chosen; the kit
// blocks show the ad's content; the 15 s story runs open, offer, close, rest and ends; the page makes no request
// beyond file:, data: and blob:. Each ad opens at true size in a large window (7.3, D3): its own size, one unit per
// CSS pixel, centred. Then each ad is packed again with the kit's second theme, and its colours change.
// Playwright must already be installed (it is never a dependency).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const EX = path.join(repo, 'examples', '2.0-kit-ads');
const ADS = [
  { id: 'ad-300x250', width: 300, height: 250, layout: 'rectangle', headline: 'Rain? Bring it on.', price: '£24' },
  { id: 'ad-728x90', width: 728, height: 90, layout: 'leaderboard', headline: 'Puddles welcome.', price: '£19' },
  { id: 'ad-160x600', width: 160, height: 600, layout: 'skyscraper', headline: 'Stay dry.', price: '£29' },
];
const log = (m) => console.log(m);
const problems = [];
const fail = (m) => { problems.push(m); log(`  problem: ${m}`); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-kit-ads-'));
const copy = (from, to) => fs.cpSync(from, to, { recursive: true });

// One ad, packed from a folder, opened at its size. Returns what the page shows.
async function run(browser, ad, folder, label) {
  const out = path.join(tmp, `${label}-out`);
  const r = await pack(folder, out, { test: true });
  const page = await browser.newPage({ viewport: { width: ad.width, height: ad.height }, deviceScaleFactor: 1 });
  const errors = []; const requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', q => requests.push(q.url()));
  await page.goto(pathToFileURL(r.htmlPath).href + '?clock=manual');
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.hsvgError || null);
  if (err) { fail(`${label}: the page did not start: ${err}`); await page.close(); return null; }
  const look = () => page.evaluate(() => {
    const h = window.hsvg;
    const scene = h.player.scene;
    const text = (id) => (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`))?.textContent ?? null;
    const shown = (id) => { const n = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)); return !!n && getComputedStyle(n).display !== 'none'; };
    const fill = (id) => (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`))?.getAttribute('fill') ?? null;
    return {
      scene, layout: h.drawing.frames[scene]?.layout,
      brand: text(`${scene}__brand`), headline: text(`${scene}__headline-use__line`), price: text(`${scene}__offer-use__price`),
      offer: shown(`${scene}__offer-area`), cta: shown(`${scene}__cta-area`), button: text(`${scene}__cta-use__caption`),
      surface: fill(`${scene}__ground`), badge: fill(`${scene}__offer-use__badge`),
      ended: h.player.state.outputs.some(o => o.name === 'ended'),
    };
  });
  const seen = [await look()];
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.hsvg.advance(5000)); seen.push(await look()); }
  const bad = requests.filter(u => !/^(file|data|blob):/.test(u));
  if (bad.length) fail(`${label}: requests beyond file:, data: and blob:: ${bad.join(', ')}`);
  if (errors.length) fail(`${label}: page errors: ${errors.join('; ')}`);
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, `${label}.png`) });
  await page.close();
  seen.htmlPath = r.htmlPath;
  return seen;
}
// A packed ad in a 1280x720 window: its drawing's box on the page and the layout shown.
async function trueSize(browser, htmlPath) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(htmlPath).href + '?clock=manual');
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const out = await page.evaluate(() => { const b = document.querySelector('#stage > svg').getBoundingClientRect(); return { box: [b.x, b.y, b.width, b.height], layout: window.hsvg.drawing.frames[window.hsvg.player.scene]?.layout }; });
  await page.close();
  return out;
}

let browser;
try {
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const day = {};
  for (const ad of ADS) {
    const seen = await run(browser, ad, path.join(EX, 'ads', ad.id), ad.id);
    if (!seen) continue;
    day[ad.id] = seen[0];
    const [open, offer, close, rest] = seen;
    log(`${ad.id}: ${seen.map(s => s.scene).join(' > ')}, layout ${open.layout}, "${open.headline}" ${open.price}, ended ${rest.ended}`);
    if (seen.map(s => s.scene).join() !== 'open,offer,close,rest') fail(`${ad.id}: scenes ${seen.map(s => s.scene).join()}`);
    if (open.layout !== ad.layout) fail(`${ad.id}: layout ${open.layout}, expected ${ad.layout}`);
    if (open.brand !== 'Rain Gear Co.') fail(`${ad.id}: brand ${open.brand}`);
    if (open.headline !== ad.headline || open.price !== ad.price) fail(`${ad.id}: content ${open.headline} ${open.price}`);
    if (open.offer || open.cta) fail(`${ad.id}: beat 1 shows only the headline`);
    if (!offer.offer || offer.cta) fail(`${ad.id}: beat 2 shows the offer, not the button`);
    if (!close.cta || close.button !== 'Shop now') fail(`${ad.id}: beat 3 shows the button "Shop now", got ${close.button}`);
    if (close.ended || !rest.ended) fail(`${ad.id}: the story ends at 15 s, not before`);
    const t = await trueSize(browser, seen.htmlPath);
    const want = [(1280 - ad.width) / 2, (720 - ad.height) / 2, ad.width, ad.height];
    log(`${ad.id} in 1280x720: box ${t.box.join(' ')}, layout ${t.layout}`);
    if (t.box.join() !== want.join() || t.layout !== ad.layout) fail(`${ad.id}: in a 1280x720 window it should show ${ad.layout} at true size, centred (${want.join(' ')})`);
  }
  // The kit's second theme: the same ad with "theme": "harbour-night", its kit beside it (the package layout).
  for (const ad of ADS) {
    const folder = path.join(tmp, `${ad.id}-night`);
    copy(path.join(EX, 'ads', ad.id), folder);
    copy(path.join(EX, 'kits', 'ad-kit'), path.join(folder, 'kits', 'ad-kit'));
    const f = path.join(folder, 'experience.json');
    fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(f, 'utf8')), theme: 'harbour-night' }, null, 2));
    const seen = await run(browser, ad, folder, `${ad.id}-night`);
    if (!seen) continue;
    const n = seen[1];
    log(`${ad.id} night: surface ${seen[0].surface} (day ${day[ad.id]?.surface}), badge ${n.badge}`);
    if (seen[0].surface !== '#10212b' || day[ad.id]?.surface !== '#fff4d8') fail(`${ad.id}: the surface does not follow the theme`);
    if (n.badge !== '#ee795f') fail(`${ad.id}: the kit block's accent does not follow the theme (${n.badge})`);
  }
} finally {
  await browser?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
if (problems.length) { log(`FAIL: ${problems.length} problems`); process.exit(1); }
log('PASS: three kit ads, packed with their kit, play their 15 s stories at their sizes, open at true size; the second theme changes all three');
