// Motion in a real browser: the examples in examples/2.0-motion/, packed, on a manual clock. Run alone (it
// starts a browser):  node engine/v2/tests/browser/b4c-motion-browser.mjs
// - face: a bee flying left faces left (its eye is left of its body) and its name tag reads the right way round;
// - wipe: the map shows from the left: nothing at first, its left part half way, all of it at the end (hit tests
//   follow the clip path), and under reduced motion all of it at once;
// - clock: a real click on Slow motion halves the windmill's time; a click on Hold stops its sails, and it hears it.
// Playwright must already be installed (PW_PATH; PW_CHANNEL). It is never a dependency.
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
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-b4c-'));
const problems = [];
const log = (m) => console.log(m);
const fail = (m) => { problems.push(m); log(`  problem: ${m}`); };
let browser;
// Packs one example and opens it on a manual clock; returns the page.
async function open(word, query = '') {
  const r = await pack(path.join(repo, 'examples', '2.0-motion', word), path.join(out, word), { test: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => fail(`${word}: page error ${e.message}`));
  await page.goto(pathToFileURL(r.htmlPath).href + `?clock=manual${query}`);
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.hsvgError || null);
  if (err) fail(`${word}: the page did not start: ${err}`);
  return page;
}
try {
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});

  // ---------- face ----------
  {
    const page = await open('face');
    // Where the bee's eye is against its body, and whether the tag's glyphs run left to right on screen.
    const look = () => page.evaluate(() => {
      const h = window.hsvg; const f = h.drawing.frames[h.player.scene];
      const bee = f.byLocal.get('bee').dom; const tag = f.byLocal.get('tag').dom;
      const body = bee.querySelector('ellipse:nth-of-type(2)').getBoundingClientRect();
      const eye = bee.querySelector('circle').getBoundingClientRect();
      const m = tag.getScreenCTM();
      const t = tag.getBoundingClientRect();
      return { eyeRight: eye.x + eye.width / 2 > body.x + body.width / 2, tagReads: m.a * m.d - m.b * m.c > 0, tagUnder: t.x < body.x + body.width && t.x + t.width > body.x, beeX: body.x };
    });
    const a = await look();
    log(`face, flying right: eye right ${a.eyeRight}, tag reads ${a.tagReads}`);
    if (!a.eyeRight || !a.tagReads) fail('flying right, the bee should face right as drawn');
    await page.evaluate(() => window.hsvg.advance(3000)); // half way back, flying left
    const b = await look();
    log(`face, flying left: eye right ${b.eyeRight}, tag reads ${b.tagReads}, tag under the bee ${b.tagUnder}`);
    if (b.eyeRight) fail('flying left, the bee should face left');
    if (!b.tagReads) fail('flying left, the tag should still read left to right');
    if (!b.tagUnder) fail('flying left, the tag should stay under the bee');
    if (!(b.beeX < a.beeX + 400)) fail('the bee should have moved');
    const errors = await page.evaluate(() => window.hsvg.errors.slice());
    if (errors.length) fail(`face: engine errors ${errors.join(' | ')}`);
    await page.close();
  }

  // ---------- wipe ----------
  {
    // Whether the map is hit at two points of its drawing (x 100 near its left edge, x 540 near its right edge).
    const hits = (page) => page.evaluate(() => {
      const h = window.hsvg; const chart = h.drawing.frames[h.player.scene].byLocal.get('chart').dom;
      const m = chart.getScreenCTM();
      const at = (x, y) => { const e = document.elementFromPoint(m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f); return !!e && chart.contains(e); };
      return [at(100, 100), at(540, 100)];
    });
    const page = await open('wipe');
    const a = await hits(page);
    await page.evaluate(() => window.hsvg.advance(1000));
    const b = await hits(page);
    await page.evaluate(() => window.hsvg.advance(1000));
    const c = await hits(page);
    log(`wipe: at 0 ${a}, at 1000 ${b}, at 2000 ${c}`);
    if (a[0] || a[1]) fail('wipe: at 0 the map should be hidden');
    if (!b[0] || b[1]) fail('wipe: half way the left of the map should show and the right not');
    if (!c[0] || !c[1]) fail('wipe: at the end all of the map should show');
    const ids = await page.evaluate(() => [...document.querySelectorAll('[id$="_wipe"]')].map(e => e.id));
    if (ids.length !== 1) fail(`wipe: one owned clip path expected, got ${ids.join(', ')}`);
    const errors = await page.evaluate(() => window.hsvg.errors.slice());
    if (errors.length) fail(`wipe: engine errors ${errors.join(' | ')}`);
    await page.close();
    const reduced = await browser.newContext({ reducedMotion: 'reduce' });
    const rp = await reduced.newPage();
    const r = await pack(path.join(repo, 'examples', '2.0-motion', 'wipe'), path.join(out, 'wipe-reduced'), { test: true });
    await rp.goto(pathToFileURL(r.htmlPath).href + '?clock=manual');
    await rp.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
    const d = await hits(rp);
    log(`wipe, reduced motion: at 0 ${d}`);
    if (!d[0] || !d[1]) fail('wipe: under reduced motion the map should show at once');
    await reduced.close();
  }

  // ---------- clock ----------
  {
    const page = await open('clock');
    const click = async (id) => {
      const box = await page.evaluate((x) => { const h = window.hsvg; const r = h.drawing.frames[h.player.scene].byLocal.get(x).dom.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
      await page.mouse.click(box.x, box.y);
    };
    const state = () => page.evaluate(() => { const p = window.hsvg.player; const sails = window.hsvg.drawing.frames['farm/mill'].byLocal.get('sails').dom; return { elapsed: p.eval('farm/mill', 'elapsed'), note: p.read('farm/mill', 'note'), sails: sails.getAttribute('transform') }; });
    await click('slow-button');
    await page.evaluate(() => window.hsvg.advance(2000));
    const a = await state();
    log(`clock, slow: elapsed ${a.elapsed}, sails ${a.sails}`);
    if (a.elapsed !== 1000 || !/rotate\(180\)/.test(a.sails || '')) fail('clock: slow motion should give the windmill 1000 ms in 2000');
    await click('hold-button');
    await page.evaluate(() => window.hsvg.advance(3000));
    const b = await state();
    log(`clock, held: elapsed ${b.elapsed}, note ${b.note}, sails ${b.sails}`);
    if (b.elapsed !== 1000 || b.sails !== a.sails) fail('clock: a held windmill should not turn');
    if (b.note !== 'Held (authored)') fail(`clock: the windmill should hear paused with the reason authored, got ${b.note}`);
    const errors = await page.evaluate(() => window.hsvg.errors.slice());
    if (errors.length) fail(`clock: engine errors ${errors.join(' | ')}`);
    await page.close();
  }
} catch (e) {
  fail(`crashed: ${e.stack || e}`);
} finally {
  await browser?.close();
  fs.rmSync(out, { recursive: true, force: true });
}
log(problems.length ? `${problems.length} problems` : 'b4c-motion browser: all good');
process.exit(problems.length ? 1 : 0);
