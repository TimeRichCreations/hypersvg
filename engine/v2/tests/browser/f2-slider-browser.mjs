// Every slider of the showcases, packed and played in a real browser, wide and tall. Run alone (it starts a
// browser): node engine/v2/tests/browser/f2-slider-browser.mjs [name ...]
// Names: solar, bee-days, bee-dance, lakes, starfall, orientation, kit-slider, forecast, orbit (default: all).
// For each slider, in each layout:
// - keys: Home gives the minimum, End the maximum, an arrow one stop (aria-valuenow follows);
// - a press on the bar at the start, the middle and the end of the travel gives the value under the pointer, and
//   focuses the slider;
// - a press on the handle does not move it or change the value; dragged towards the start the value goes down, towards
//   the end it goes up, and the handle follows the pointer while held; let go, it settles on its value's place;
// - a touch drag (Chrome's touch input) moves it too, and the page does not scroll.
// Playwright must already be installed (PW_PATH, or a global install). It is never a dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const { pack } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs')).href);
const { launchBrowser } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'browser.mjs')).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f2-'));

// The starter kit's slider (a library piece), placed in a slot drawn at 1.5 times its size: its travel is in the
// slot's units.
function kitSlider() {
  const dir = path.join(tmp, 'kit-slider');
  fs.mkdirSync(path.join(dir, 'components', 'slider'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scenes', 's'), { recursive: true });
  for (const f of ['component.json', 'slider.svg']) fs.copyFileSync(path.join(repo, 'library', '2.0', 'hsvg-starter', 'blocks', 'slider', f), path.join(dir, 'components', 'slider', f));
  fs.writeFileSync(path.join(dir, 'experience.json'), JSON.stringify({ format: 'hsvg/2.0', kind: 'experience', id: 'kit-slider', about: { title: 'The starter kit slider' }, blocks: { slider: 'components/slider/component.json' }, story: { start: 's', scenes: { s: 'scenes/s/scene.json' } } }));
  fs.writeFileSync(path.join(dir, 'scenes', 's', 'scene.json'), JSON.stringify({ format: 'hsvg/2.0', kind: 'scene', id: 's', drawing: 's.svg', uses: [{ id: 'level', use: 'slider', into: 'slot' }] }));
  fs.writeFileSync(path.join(dir, 'scenes', 's', 's.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>A slider</title><rect width="960" height="600" fill="#fff4d8" data-hsvg-layer="backdrop"/><g id="slot" data-hsvg-kind="part" data-hsvg-slot="slot" transform="translate(270 260) scale(1.5)"/></svg>');
  return dir;
}

const show = (...p) => path.join(repo, 'examples', ...p);
const CASES = {
  solar: { dir: show('2.0-showcase', 'solar-system') },
  'bee-days': { dir: show('2.0-showcase', 'honeybee'), start: 's3' },
  'bee-dance': { dir: show('2.0-showcase', 'honeybee'), start: 's6' },
  lakes: { dir: show('2.0-showcase', 'lakes-atlas') },
  starfall: { dir: show('2.0-showcase', 'starfall') },
  orientation: { dir: path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'orientation') },
  'kit-slider': { dir: null, make: kitSlider },
  forecast: { dir: show('2.0-live-dashboards', 'forecast-duel') },
  orbit: { dir: show('2.0-live-dashboards', 'orbit-spotter') },
};
const LAYOUTS = { wide: { width: 960, height: 600 }, tall: { width: 540, height: 960 } };
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES);

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const near = (a, b, d) => Math.abs(a - b) <= d;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const lerp = (p, q, f) => ({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f });

const browser = await launchBrowser();
const packed = new Map();
async function pageFile(name) {
  const c = CASES[name];
  const dir = c.dir ?? c.make();
  if (packed.has(dir)) return packed.get(dir);
  const out = path.join(tmp, `out-${packed.size}`);
  await pack(dir, out, { test: true });
  const html = fs.readdirSync(out).find(f => f.endsWith('.html'));
  packed.set(dir, path.join(out, html));
  return packed.get(dir);
}

// One slider, on one open page. id: the handle's element id.
async function playSlider(page, tag, id, touch) {
  const wait = (ms = 450) => page.waitForTimeout(ms);
  // The handle's centre on screen: its box centre (measured once, at rest) through its transform now.
  await page.evaluate((id) => { const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)); const b = el.getBBox(); window.__c = window.__c || {}; window.__c[id] = [b.x + b.width / 2, b.y + b.height / 2]; }, id);
  const place = () => page.evaluate((id) => { const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)); const [x, y] = window.__c[id]; const p = new DOMPoint(x, y).matrixTransform(el.getScreenCTM()); return { x: p.x, y: p.y }; }, id);
  const aria = () => page.evaluate((id) => { const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)); return { now: Number(el.getAttribute('aria-valuenow')), min: Number(el.getAttribute('aria-valuemin')), max: Number(el.getAttribute('aria-valuemax')) }; }, id);
  const value = async () => (await aria()).now;
  const focused = () => page.evaluate((id) => document.activeElement?.id === id, id);
  const key = async (k) => { await page.focus(`[id$="${id}"]`); await page.keyboard.press(k); await wait(); };
  const { min, max } = await aria();
  const sl = await page.evaluate((id) => window.hsvg.input.items().find(i => i.id === id), id);
  const c = await page.evaluate(([addr, cid]) => { const d = window.hsvg.player.def(addr).controls[cid]; return { positions: d.positions ?? null, axis: d.axis, range: d.range }; }, [sl.addr, sl.cid]);
  const n = c.positions;
  const step = n ? (max - min) / (n - 1) : (max - min) / 10;
  const at = (f) => { if (!n) return min + f * (max - min); const s = Math.round(f * (n - 1)) / (n - 1); return +(min + s * (max - min)).toFixed(10); };
  const close = (v, w) => (n ? v === w : near(v, w, (max - min) * 0.02));

  // Keys.
  await key('Home'); const S = await place(); const vHome = await value();
  await key('End'); const E = await place(); const vEnd = await value();
  await key('Home'); await key(c.axis === 'y' && min < max ? 'ArrowUp' : 'ArrowRight'); const vStep = await value();
  want(vHome === min && vEnd === max && near(vStep, +(min + step).toFixed(10), 1e-6), `${tag}: Home ${vHome}, End ${vEnd}, one arrow ${vStep} (from ${min} to ${max})`);
  const L = dist(S, E);
  want(L > 20, `${tag}: the handle travels ${L.toFixed(0)} px on screen`);
  if (L <= 20) return;
  const u = { x: (E.x - S.x) / L, y: (E.y - S.y) / L };
  const along = (p, px) => ({ x: p.x + u.x * px, y: p.y + u.y * px });

  // Presses on the bar: start, middle (the stop nearest it) and end; the handle starts at the other end.
  const mid = n ? Math.round((n - 1) / 2) / (n - 1) : 0.5;
  for (const [f, from] of [[0, 'End'], [mid, 'Home'], [1, 'Home']]) {
    await key(from);
    await page.evaluate(() => document.activeElement?.blur());
    const p = lerp(S, E, f);
    await page.mouse.click(p.x, p.y); await wait();
    const v = await value();
    want(close(v, at(f)), `${tag}: a press on the bar at ${Math.round(f * 100)}% of the travel gives ${v} (want ${at(f)})`);
    want(await focused(), `${tag}: the press focuses the slider`);
    const q = await place();
    want(dist(q, lerp(S, E, n ? (at(f) - min) / (max - min) : f)) < 2.5, `${tag}: the handle settles on its value's place after the press`);
  }

  // A drag of the handle, from the middle stop: no jump at the press, down towards the start, up towards the end.
  await key('Home');
  const k = n ? Math.round((n - 1) / 2) : 5;
  for (let i = 0; i < k; i++) await page.keyboard.press(c.axis === 'y' && min < max ? 'ArrowUp' : 'ArrowRight');
  await wait();
  const v0 = await value(); const C = await place();
  const stepPx = L / (n ? n - 1 : 10);
  const grab = along(C, 4);
  await page.mouse.move(grab.x, grab.y); await page.mouse.down(); await wait(150);
  const C1 = await place(); const v1 = await value();
  want(v1 === v0 && dist(C1, C) < 1.5, `${tag}: a press on the handle does not move it (value ${v0} -> ${v1}, moved ${dist(C1, C).toFixed(1)} px)`);
  const down = along(grab, -1.4 * stepPx);
  await page.mouse.move(down.x, down.y, { steps: 8 }); await wait(150);
  const vDown = await value(); const Cd = await place();
  want(vDown < v0, `${tag}: dragged towards the start, the value goes down (${v0} -> ${vDown})`);
  want(dist(Cd, along(down, -4)) < 2.5, `${tag}: the handle follows the pointer while held (${dist(Cd, along(down, -4)).toFixed(1)} px off)`);
  const upp = along(grab, 1.4 * stepPx);
  await page.mouse.move(upp.x, upp.y, { steps: 12 }); await wait(150);
  const vUp = await value();
  want(vUp > v0, `${tag}: dragged towards the end, the value goes up (${v0} -> ${vUp})`);
  await page.mouse.up(); await wait(600);
  const Cs = await place();
  want(dist(Cs, lerp(S, E, (vUp - min) / (max - min))) < 2.5, `${tag}: let go, the handle settles on its value's place`);

  // Touch: a finger drag on the handle, and the page does not scroll.
  if (touch) {
    await key('Home');
    const T0 = await place(); const scroll0 = await page.evaluate(() => [scrollX, scrollY]);
    const T1 = along(T0, 1.4 * stepPx);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: T0.x, y: T0.y }] });
    for (let i = 1; i <= 8; i++) { const p = lerp(T0, T1, i / 8); await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] }); }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait();
    const vT = await value(); const scroll1 = await page.evaluate(() => [scrollX, scrollY]);
    want(vT > min, `${tag}: a touch drag moves it (${min} -> ${vT})`);
    want(scroll1.join() === scroll0.join(), `${tag}: the touch drag does not scroll the page`);
  }
}

try {
  for (const name of names) {
    const c = CASES[name];
    if (!c) { want(false, `no case ${name}`); continue; }
    const file = await pageFile(name);
    for (const [layout, viewport] of Object.entries(LAYOUTS)) {
      const ctx = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(pathToFileURL(file).href + (c.start ? `?start=${c.start}` : ''));
      await page.waitForFunction(() => window.hsvg?.input?.items, null, { timeout: 20000 });
      await page.waitForTimeout(600);
      const ids = await page.evaluate(() => window.hsvg.input.items().filter(i => i.role === 'slider' && !i.disabled).map(i => i.id).filter(id => { const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)); const b = el?.getBoundingClientRect(); return b && b.width > 0 && b.height > 0; }));
      want(ids.length > 0, `${name} ${layout}: shows ${ids.length} slider(s): ${ids.join(', ')}`);
      const touch = await ctx.newCDPSession(page);
      for (const id of ids) await playSlider(page, `${name} ${layout} ${id}`, id, touch);
      want(!errors.length && !(await page.evaluate(() => window.hsvg.errors?.length || 0)), `${name} ${layout}: no page or engine error ${errors.join(' | ')}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
if (problems.length) { console.log(`f2-slider-browser: ${problems.length} problem(s)`); process.exit(1); }
console.log('f2-slider-browser: ok');
