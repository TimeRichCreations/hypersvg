// Drawing in a real browser, on drawing-fixture/files.mjs. Run alone (it starts a browser):
//   node engine/v2/tests/browser/drawing-browser.mjs
// Checks, in the scene's own coordinates:
// - a component in rect slots of two sizes is fitted and centred (5.10);
// - a repeat of five items is drawn, one per row, in the region's slots and order (4.5);
// - a pivot: the pin's foot and the flag's centre sit on their <g> slots' origins (6.2.1);
// - a clip under reduced motion: the page's prefers-reduced-motion is the ambient reducedMotion; finish shows the
//   final pose and an endless loop its first key; a change is heard as changed:reducedMotion (6.7);
// - a snapped drag: a real mouse drop rests on the goal's centre, stays there after a resize, and a pick-up and a
//   miss return it home; the keyboard snaps too; a binding and a clip move the goal and the token follows (5.11);
// - a control that fills its component's viewBox shows its focus mark (ring or outline), past the viewBox (6.4, 5.11; W5-D, P2).
// Playwright must already be installed (PW_PATH; PW_CHANNEL).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture, NAMES } from './drawing-fixture/files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const files = Object.fromEntries(Object.entries(fixture).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
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
const log = (m) => console.log(m);
const want = (cond, msg) => { if (!cond) problems.push(msg); };
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
const nearBox = (a, b, tol) => a && ['x', 'y', 'width', 'height'].every(k => near(a[k], b[k], tol));
const url = `http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`;

// Boxes in the scene's drawing units (the root <svg>'s user space), and screen points of drawing points.
const BOXES = () => {
  const svg = document.querySelector('#stage > svg');
  const inv = svg.getScreenCTM().inverse();
  const box = (id) => {
    const el = document.querySelector(`[id$="${CSS.escape(id)}"]`); if (!el) return null;
    const r = el.getBoundingClientRect();
    const a = new DOMPoint(r.left, r.top).matrixTransform(inv); const b = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  };
  return box;
};
async function boxes(page, ids) {
  return page.evaluate(({ ids, f }) => { const box = eval(`(${f})`)(); return Object.fromEntries(ids.map(id => [id, box(id)])); }, { ids, f: BOXES.toString() });
}
const toScreen = (page, x, y) => page.evaluate(({ x, y }) => { const p = new DOMPoint(x, y).matrixTransform(document.querySelector('#stage > svg').getScreenCTM()); return { x: p.x, y: p.y }; }, { x, y });
const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
async function open(page) {
  await page.goto(url);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
}
const errorsOf = (page) => page.evaluate(() => [...window.hsvg.errors, ...window.hsvg.drawing.faults.map(f => `${f.code} ${f.message}`)]);

try {
  // ---------- placement, repeats, pivots; motion without reduced motion ----------
  {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    const b = await boxes(page, ['one__big-badge__face', 'one__small-badge__face', 'one__pin__body', 'one__flag__cloth', ...NAMES.map(n => `one__dots-${n}__disc`)]);
    log(`rect slots: big ${JSON.stringify(b['one__big-badge__face'])} small ${JSON.stringify(b['one__small-badge__face'])}`);
    want(nearBox(b['one__big-badge__face'], { x: 70, y: 20, width: 200, height: 100 }, 1), 'the badge in the 300 x 100 box should be 200 x 100, centred at x 70');
    want(nearBox(b['one__small-badge__face'], { x: 340, y: 35, width: 60, height: 30 }, 1), 'the badge in the 60 x 60 box should be 60 x 30, centred at y 35');
    const dots = NAMES.map(n => b[`one__dots-${n}__disc`]);
    log(`repeat: ${dots.map(d => d && `${centre(d).x.toFixed(1)},${centre(d).y.toFixed(1)}`).join(' ')}`);
    want(dots.every((d, i) => d && near(centre(d).x, 60 + 120 * i, 1) && near(centre(d).y, 200, 1)), 'five dots should be drawn in the five slots, in order');
    const names = await page.evaluate((ns) => ns.map(n => document.querySelector(`[id$="one__dots-${n}__name"]`)?.textContent), NAMES);
    want(JSON.stringify(names) === JSON.stringify(NAMES), `each dot should show its row: ${names}`);
    // A changed list (4.5): kept rows move to their new slots, a new row is drawn, gone rows go; then back again.
    const setNames = (list) => page.evaluate((l) => { const p = window.hsvg.player; const r = p.transaction('host', () => p.runActions('one', [{ id: 'test-names', set: 'names', to: JSON.stringify(l) }], 'test')); window.hsvg.advance(0); return r.ok; }, list);
    const changed = ['ed', 'cy', 'ann', 'fy'];
    want(await setNames(changed), 'the list changes');
    const cb = await boxes(page, [...changed, 'bo', 'di'].map(n => `one__dots-${n}__disc`));
    log(`changed list: ${changed.map(n => cb[`one__dots-${n}__disc`] && centre(cb[`one__dots-${n}__disc`]).x.toFixed(1)).join(' ')}`);
    want(changed.every((n, i) => cb[`one__dots-${n}__disc`] && near(centre(cb[`one__dots-${n}__disc`]).x, 60 + 120 * i, 1)) && !cb['one__dots-bo__disc'] && !cb['one__dots-di__disc'], 'a changed list should draw its rows in the new order, the new row too, and no gone row');
    want(await page.evaluate(() => document.querySelector('[id$="one__dots-fy__name"]')?.textContent) === 'fy', 'the new row shows its name');
    want(await setNames(NAMES), 'the list changes back');
    const pin = b['one__pin__body']; const flag = b['one__flag__cloth'];
    log(`pivots: pin ${JSON.stringify(pin)} flag ${JSON.stringify(flag)}`);
    want(pin && near(pin.x + pin.width / 2, 200) && near(pin.y + pin.height, 400) && near(pin.width, 40), 'the pin\'s foot should stand on its slot origin (200, 400)');
    want(flag && near(centre(flag).x, 400) && near(centre(flag).y, 400) && near(flag.width, 60), 'the flag\'s centre should sit on its slot origin (400, 400)');
    const amb = await page.evaluate(() => window.hsvg.player.state.ambient.reducedMotion);
    want(amb === false, 'reducedMotion should be false with no preference');
    await page.evaluate(() => window.hsvg.advance(500));
    const m = await boxes(page, ['one__slider', 'one__spinner']);
    log(`motion at 500 ms: slider x ${m['one__slider'].x.toFixed(1)} spinner x ${m['one__spinner'].x.toFixed(1)}`);
    want(near(m['one__slider'].x, 70) && near(m['one__spinner'].x, 70), 'clips should play in time without reduced motion');

    // ---------- snap by a real mouse ----------
    const token0 = (await boxes(page, ['one__token']))['one__token'];
    const goal = (await boxes(page, ['one__goal']))['one__goal'];
    const drag = async (from, to) => {
      const a = await toScreen(page, from.x, from.y); const z = await toScreen(page, to.x, to.y);
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      await page.mouse.move((a.x + z.x) / 2, (a.y + z.y) / 2, { steps: 4 }); await page.mouse.move(z.x, z.y, { steps: 4 });
      await page.mouse.up();
    };
    await drag(centre(token0), { x: goal.x + 20, y: goal.y + 20 });
    let t = (await boxes(page, ['one__token']))['one__token'];
    let drops = await page.evaluate(() => window.hsvg.player.state.blocks.one.values.drops);
    log(`snap: token centre ${centre(t).x.toFixed(1)},${centre(t).y.toFixed(1)} goal centre ${centre(goal).x},${centre(goal).y}; drops ${drops}`);
    want(drops === 1 && near(centre(t).x, centre(goal).x, 1) && near(centre(t).y, centre(goal).y, 1), 'an accepted drop should rest on the goal\'s centre');
    const rest = await page.evaluate(() => window.hsvg.player.state.blocks.one.snaps);
    want(JSON.stringify(rest) === '{"token":"goal"}', `the rest should be the control's state in its block: ${JSON.stringify(rest)}`);
    await page.setViewportSize({ width: 400, height: 300 });
    await page.waitForTimeout(300);
    t = (await boxes(page, ['one__token']))['one__token'];
    log(`after a resize to 400 x 300: token centre ${centre(t).x.toFixed(1)},${centre(t).y.toFixed(1)}`);
    want(near(centre(t).x, centre(goal).x, 1.5) && near(centre(t).y, centre(goal).y, 1.5), 'the snapped token should stay on the goal after a resize');
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(300);
    // Picked up again and dropped on nothing: home, and no longer resting.
    await drag(centre(goal), { x: 400, y: 560 });
    t = (await boxes(page, ['one__token']))['one__token'];
    const rest2 = await page.evaluate(() => window.hsvg.player.state.blocks.one.snaps);
    log(`picked up and missed: token centre ${centre(t).x.toFixed(1)},${centre(t).y.toFixed(1)}; rest ${JSON.stringify(rest2)}`);
    want(near(centre(t).x, centre(token0).x, 1) && near(centre(t).y, centre(token0).y, 1) && JSON.stringify(rest2) === '{}', 'a pick-up and a miss should return the token home');
    // The keyboard snaps too: Enter picks up, an arrow moves to the goal, Enter drops.
    await page.focus('[id$="one__token"]');
    await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    t = (await boxes(page, ['one__token']))['one__token'];
    drops = await page.evaluate(() => window.hsvg.player.state.blocks.one.values.drops);
    log(`keyboard: token centre ${centre(t).x.toFixed(1)},${centre(t).y.toFixed(1)}; drops ${drops}`);
    want(drops === 2 && near(centre(t).x, centre(goal).x, 1) && near(centre(t).y, centre(goal).y, 1), 'a keyboard drop should snap too');
    // A snapped item follows its drop: a binding moves the goal 150 left at once, then a clip 100 up over 500 ms.
    await page.evaluate(() => window.hsvg.press('one', 'shifter'));
    let g = (await boxes(page, ['one__goal']))['one__goal']; t = (await boxes(page, ['one__token']))['one__token'];
    log(`goal moved by a binding: goal centre ${centre(g).x.toFixed(1)},${centre(g).y.toFixed(1)} token centre ${centre(t).x.toFixed(1)},${centre(t).y.toFixed(1)}`);
    want(near(centre(g).x, centre(goal).x - 150, 1) && near(centre(t).x, centre(g).x, 1) && near(centre(t).y, centre(g).y, 1), 'the snapped token should follow the goal a binding moves');
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.hsvg.advance(100); });
    g = (await boxes(page, ['one__goal']))['one__goal']; t = (await boxes(page, ['one__token']))['one__token'];
    log(`goal moved by a clip: goal centre ${centre(g).x.toFixed(1)},${centre(g).y.toFixed(1)} token centre ${centre(t).x.toFixed(1)},${centre(t).y.toFixed(1)}`);
    want(near(centre(g).y, centre(goal).y - 100, 1) && near(centre(t).x, centre(g).x, 1) && near(centre(t).y, centre(g).y, 1), 'the snapped token should follow the goal a clip moves');
    const errors = await errorsOf(page);
    if (errors.length) problems.push(`errors: ${errors.join('; ')}`);
    if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
    await page.close();
  }
  // ---------- a clip under reduced motion ----------
  {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const amb = await page.evaluate(() => window.hsvg.player.state.ambient.reducedMotion);
    want(amb === true, 'reducedMotion should be true from prefers-reduced-motion: reduce');
    let m = await boxes(page, ['one__slider', 'one__spinner']);
    log(`reduced motion at 0 ms: slider x ${m['one__slider'].x.toFixed(1)} spinner x ${m['one__spinner'].x.toFixed(1)}`);
    want(near(m['one__slider'].x, 120) && near(m['one__spinner'].x, 20), 'finish should show the final pose at once, an endless loop its first key');
    await page.evaluate(() => window.hsvg.advance(1000));
    const ended = await page.evaluate(() => !window.hsvg.player.state.blocks.one.clips.slide);
    want(ended, 'the clip should still end at its normal time');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => window.hsvg.player.state.ambient.reducedMotion === false, null, { timeout: 5000 }).catch(() => {});
    const after = await page.evaluate(() => ({ amb: window.hsvg.player.state.ambient.reducedMotion, heard: window.hsvg.player.state.blocks.one.values.heard }));
    m = await boxes(page, ['one__spinner']);
    log(`preference turned off: ${JSON.stringify(after)}; spinner x ${m['one__spinner'].x.toFixed(1)}`);
    want(after.amb === false && after.heard === 1, 'a change of preference should reach the ambient value and be heard once');
    await page.evaluate(() => window.hsvg.advance(250));
    m = await boxes(page, ['one__spinner']);
    want(near(m['one__spinner'].x, 45), `the loop should move again after the change: ${m['one__spinner'].x}`);
    const errors = await errorsOf(page);
    if (errors.length) problems.push(`errors: ${errors.join('; ')}`);
    if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
    await page.close();
  }
  // ---------- a focus outline past a component's viewBox ----------
  {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    await open(page);
    for (let i = 0; i < 20 && await page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, '')) !== 'one__tile__face'; i++) await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { id: document.activeElement?.id?.replace(/^hsvg\d+__/, ''), outline: s.outlineStyle, ring: /url\(/.test(s.filter) }; });
    const r = await page.evaluate(() => { const b = document.querySelector('[id$="one__tile__face"]').getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; });
    // The mark (the ring that follows the part, P2, or the plain outline) is 3px wide, 2px off the face: look at the
    // 6px band left of the face and the band above it.
    const ring = async (clip) => {
      const png = (await page.screenshot({ clip })).toString('base64');
      return page.evaluate(async (s) => {
        const i = new Image(); await new Promise(res => { i.onload = res; i.src = `data:image/png;base64,${s}`; });
        const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext('2d'); x.drawImage(i, 0, 0);
        const d = x.getImageData(0, 0, i.width, i.height).data; let n = 0;
        for (let k = 0; k < d.length; k += 4) if (d[k] < 80 && d[k + 2] > 140) n++;
        return n;
      }, png);
    };
    const left = await ring({ x: r.left - 6, y: (r.top + r.bottom) / 2 - 4, width: 6, height: 8 });
    const top = await ring({ x: (r.left + r.right) / 2 - 4, y: r.top - 6, width: 8, height: 6 });
    log(`focus outline past the tile's viewBox: ${JSON.stringify(focused)}; ring pixels left ${left}, above ${top}`);
    want(focused.id === 'one__tile__face' && (focused.outline === 'solid' || focused.ring), 'Tab should reach the tile\'s face, with its focus mark');
    want(left > 0 && top > 0, 'the focus outline of a control that fills its component\'s viewBox should be painted');
    const errors = await errorsOf(page);
    if (errors.length) problems.push(`errors: ${errors.join('; ')}`);
    if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
    await page.close();
  }
} catch (e) { problems.push(e.stack || e.message); } finally { await browser.close(); server.close(); }
for (const p of problems) log(`problem: ${p}`);
log(problems.length ? 'drawing browser run: FAIL' : 'drawing browser run: pass');
process.exit(problems.length ? 1 : 0);
