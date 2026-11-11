// A slider with an angle axis (a knob that turns), packed and played in a real browser. Run alone (it
// starts a browser): node engine/v2/tests/browser/k1-dial-browser.mjs [name ...]
// Names: fixture (engine/v2/tests/k1-fixture, two knobs), oven (skill/2.0/examples/recipes/oven-dial) (default: all).
// For each knob, in each layout (wide and tall viewports):
// - a press on the knob, and a press on the ring outside it, do not change the value or turn it (no jump);
// - turned clockwise the value goes up, anticlockwise down; the knob follows the pointer while held;
// - from Home, a clockwise turn crosses the 180 degree line (the pointer passes due left of the pivot) with no jump;
// - turned past `to` it stays at the end, and comes back only when the pointer does; turned the other way from Home,
//   across the gap at the bottom, it stays at the start (no jump to the other end);
// - a tap on the ring at three angles gives the stop under the tap; a tap at the centre does nothing;
// - a touch turn (Chrome's touch input) turns it, and the page does not scroll;
// - arrows, Home and End; under reduced motion the knob settles on its value's angle at once.
// Playwright must already be installed (PW_PATH, or a global install). It is never a dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const { pack } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs')).href);
const { launchBrowser } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'browser.mjs')).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k1-'));

const CASES = {
  fixture: { dir: path.join(repo, 'engine', 'v2', 'tests', 'k1-fixture') },
  // 21 stops from its inputs (50 to 250 in steps of 10), and its spoken value.
  oven: { dir: path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'oven-dial'), stops: 21, texts: ['50 °C', '250 °C', '60 °C'] },
};
const LAYOUTS = { wide: { width: 960, height: 600 }, tall: { width: 540, height: 960 } };
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES).filter(n => fs.existsSync(CASES[n].dir));

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const near = (a, b, d) => Math.abs(a - b) <= d;
const rad = (a) => a * Math.PI / 180;

const browser = await launchBrowser();
async function pageFile(name) {
  const out = path.join(tmp, name);
  await pack(CASES[name].dir, out, { test: true });
  return path.join(out, fs.readdirSync(out).find(f => f.endsWith('.html')));
}

// One knob on one open page. id: the turning part's element id.
async function playKnob(page, tag, id, touch, reduced, kase) {
  const wait = (ms = 450) => page.waitForTimeout(ms);
  // The pivot and the disc on screen (the engine's circle under the knob), the knob's turn now (degrees from where it
  // is drawn), its control and its accessible value.
  const geo = () => page.evaluate((id) => {
    const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`));
    const disc = [...el.parentNode.children].find(x => x.hasAttribute('data-hsvg-band') && x.nextElementSibling === el);
    const m = disc.getScreenCTM(); const c = new DOMPoint(+disc.getAttribute('cx'), +disc.getAttribute('cy')).matrixTransform(m);
    const em = el.getScreenCTM(); const pm = el.parentNode.getScreenCTM(); const rel = pm.inverse().multiply(em);
    return { x: c.x, y: c.y, r: +disc.getAttribute('r') * Math.hypot(m.a, m.b), turn: Math.atan2(rel.b, rel.a) * 180 / Math.PI };
  }, id);
  const aria = () => page.evaluate((id) => { const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)); return { now: Number(el.getAttribute('aria-valuenow')), min: Number(el.getAttribute('aria-valuemin')), max: Number(el.getAttribute('aria-valuemax')), text: el.getAttribute('aria-valuetext'), orientation: el.getAttribute('aria-orientation') }; }, id);
  const value = async () => (await aria()).now;
  const key = async (k) => { await page.focus(`[id$="${id}"]`); await page.keyboard.press(k); await wait(); };
  const sl = await page.evaluate((id) => window.hsvg.input.items().find(i => (i.id === id || i.id.endsWith('__' + id))), id);
  const c = await page.evaluate(([addr, cid]) => { const p = window.hsvg.player; const d = p.def(addr).controls[cid]; return { positions: p.controlPositions ? p.controlPositions(addr, cid) : d.positions, range: d.range }; }, [sl.addr, sl.cid]);
  const { min, max } = await aria();
  const [from, to] = c.range; const span = to - from;
  const n = c.positions;
  const turnOf = (v) => from + (v - min) / (max - min) * span;
  const stop = (turn) => { const f = Math.max(0, Math.min(1, (turn - from) / span)); const s = n ? Math.round(f * (n - 1)) / (n - 1) : f; return +(min + s * (max - min)).toFixed(10); };
  const same = (a, b) => near(a, b, (max - min) * 1e-6);
  // A point on screen at a turn (degrees from the knob's drawn angle, which points up) and a share of the radius.
  const G = await geo();
  const at = (turn, f) => ({ x: G.x + Math.cos(rad(turn - 90)) * G.r * f, y: G.y + Math.sin(rad(turn - 90)) * G.r * f });
  // Moves the held pointer round the pivot from one turn to another, in small steps.
  const sweep = async (a, b, f = 0.7) => { const k = Math.max(2, Math.ceil(Math.abs(b - a) / 4)); for (let i = 1; i <= k; i++) { const p = at(a + (b - a) * i / k, f); await page.mouse.move(p.x, p.y); } await wait(120); };

  // Keys.
  await key('Home'); const vHome = await value(); const tHome = (await geo()).turn;
  await key('End'); const vEnd = await value(); const tEnd = (await geo()).turn;
  await key('Home'); await key('ArrowRight'); const vStep = await value();
  await key('ArrowUp'); const vStep2 = await value(); await key('ArrowDown'); const vBack = await value();
  const step = (max - min) / (n ? n - 1 : 10);
  want(vHome === min && vEnd === max && same(vStep, min + step) && same(vStep2, min + 2 * step) && same(vBack, vStep), `${tag}: Home ${vHome}, End ${vEnd}, ArrowRight ${vStep}, ArrowUp ${vStep2}, ArrowDown ${vBack}`);
  want(near(tHome, from, 0.5) && near(tEnd, to, 0.5), `${tag}: the knob rests at ${tHome.toFixed(1)} and ${tEnd.toFixed(1)} degrees (its range ${from}..${to})`);
  want((await aria()).orientation === null, `${tag}: no aria-orientation on a knob`);
  if (kase.stops) want(n === kase.stops, `${tag}: ${n} stops from its inputs (want ${kase.stops})`);
  if (kase.texts) {
    const said = [];
    for (const k of ['Home', 'End', 'Home', 'ArrowRight']) { await key(k); said.push((await aria()).text); }
    want(JSON.stringify([said[0], said[1], said[3]]) === JSON.stringify(kase.texts), `${tag}: aria-valuetext is the formatted value (${said.join(', ')})`);
  }

  // A press on the knob, then on the ring outside it: no change, no jump.
  for (const [where, f] of [['knob', 0.45], ['ring', 0.93]]) {
    await key('Home'); for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight'); await wait();
    const v0 = await value(); const t0 = (await geo()).turn;
    const p = at(turnOf(v0) + 20, f);
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await wait(150);
    want(same(await value(), v0) && near((await geo()).turn, t0, 0.5), `${tag}: a press on the ${where} does not change it (value ${v0}, turn ${t0.toFixed(1)} -> ${(await geo()).turn.toFixed(1)})`);
    await sweep(turnOf(v0) + 20, turnOf(v0) + 80, f);
    const vUp = await value(); const tUp = (await geo()).turn;
    want(vUp > v0, `${tag}: from the ${where}, turned clockwise the value goes up (${v0} -> ${vUp})`);
    want(near(tUp, t0 + 60, 1), `${tag}: the knob follows the pointer while held (${tUp.toFixed(1)}, want ${(t0 + 60).toFixed(1)})`);
    await sweep(turnOf(v0) + 80, turnOf(v0) - 30, f);
    const vDown = await value();
    want(vDown < v0, `${tag}: turned anticlockwise the value goes down (${v0} -> ${vDown})`);
    await page.mouse.up(); await wait(reduced ? 40 : 600);
    want(near((await geo()).turn, turnOf(vDown), 0.5), `${tag}: let go, it settles on its value's angle${reduced ? ' at once (reduced motion)' : ''} (${(await geo()).turn.toFixed(1)}, want ${turnOf(vDown).toFixed(1)})`);
  }

  // From Home, clockwise across the 180 degree line: the pointer passes due left of the pivot.
  await key('Home');
  let p = at(from, 0.7); await page.mouse.move(p.x, p.y); await page.mouse.down(); await wait(100);
  const trail = [];
  for (let t = from; t <= from + 90; t += 5) { const q = at(t, 0.7); await page.mouse.move(q.x, q.y); trail.push((await geo()).turn); }
  await wait(100);
  const jumps = trail.slice(1).map((x, i) => Math.abs(x - trail[i]));
  want(Math.max(...jumps) < 8 && near(trail.at(-1), from + 90, 1), `${tag}: across the 180 degree line the knob turns smoothly (largest step ${Math.max(...jumps).toFixed(1)} degrees, ends at ${trail.at(-1).toFixed(1)})`);
  want(same(await value(), stop(from + 90)), `${tag}: there the value is ${await value()} (want ${stop(from + 90)})`);
  await page.mouse.up(); await wait();

  // Past `to` and back; then from Home the other way, across the gap at the bottom.
  await key('End');
  p = at(to, 0.7); await page.mouse.move(p.x, p.y); await page.mouse.down(); await wait(100);
  await sweep(to, to + 60);
  const vPast = await value(); const tPast = (await geo()).turn;
  await sweep(to + 60, to + 10);
  const vBack1 = await value();
  await sweep(to + 10, to - 40);
  const vBack2 = await value();
  await page.mouse.up(); await wait();
  want(vPast === max && near(tPast, to, 0.5), `${tag}: turned past the end it stays at the end (${vPast}, ${tPast.toFixed(1)} degrees)`);
  want(vBack1 === max && vBack2 < max, `${tag}: it comes back only when the pointer does (${vBack1}, then ${vBack2})`);
  await key('Home');
  p = at(from, 0.7); await page.mouse.move(p.x, p.y); await page.mouse.down(); await wait(100);
  await sweep(from, from - (360 - span) - 20);
  const vGap = await value(); const tGap = (await geo()).turn;
  await page.mouse.up(); await wait();
  want(vGap === min && near(tGap, from, 0.5), `${tag}: across the gap at the bottom it stays at the start (${vGap}, ${tGap.toFixed(1)} degrees), no jump to the other end`);

  // Taps on the ring at three angles; a tap at the centre.
  for (const f of [0.2, 0.5, 0.8]) {
    await key(f < 0.5 ? 'End' : 'Home');
    await page.evaluate(() => document.activeElement?.blur());
    const t = from + f * span;
    const q = at(t, 0.85);
    await page.mouse.click(q.x, q.y); await wait(reduced ? 40 : 600);
    want(same(await value(), stop(t)), `${tag}: a tap at ${t.toFixed(0)} degrees gives ${await value()} (want ${stop(t)})`);
    want(await page.evaluate((id) => document.activeElement?.id?.endsWith(id), id), `${tag}: the tap focuses the knob`);
    want(near((await geo()).turn, turnOf(await value()), 0.5), `${tag}: after the tap the knob rests on its value's angle`);
  }
  await key('Home');
  await page.mouse.click(G.x + 2, G.y + 2); await wait();
  want(await value() === min, `${tag}: a tap at the centre does nothing (${await value()})`);

  // Touch: a finger turns the knob, and the page does not scroll.
  if (touch) {
    await key('Home');
    const scroll0 = await page.evaluate(() => [scrollX, scrollY]);
    const pts = []; for (let t = from; t <= from + 120; t += 8) pts.push(at(t, 0.75));
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
    for (const q of pts.slice(1)) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [q] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait();
    const vT = await value(); const scroll1 = await page.evaluate(() => [scrollX, scrollY]);
    want(same(vT, stop(from + 120)), `${tag}: a touch turn of 120 degrees gives ${vT} (want ${stop(from + 120)})`);
    want(scroll1.join() === scroll0.join(), `${tag}: the touch turn does not scroll the page`);
  }
}

// The fixture's other controls (items 2 to 7 of the brief), on one open page.
async function playExtras(page, tag) {
  const wait = (ms = 300) => page.waitForTimeout(ms);
  const read = (addr, name) => page.evaluate(([a, n]) => window.hsvg.player.read(a, n), [addr, name]);
  const attr = (id, a) => page.evaluate(([id, a]) => (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`))?.getAttribute(a), [id, a]);
  const shown = (id) => page.evaluate((id) => { const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)); return !!el && getComputedStyle(el).display !== 'none'; }, id);
  // A line slider with stops from an input (6) and a spoken value; held while dragged, never from keys.
  const H = 's__level__handle';
  await page.focus(`[id="${H}"], [id$="__${H}"]`); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await wait();
  want(await read('s/level', 'share') === 0.2 && await attr(H, 'aria-valuetext') === '20 percent', `${tag}: a line slider with 6 stops from its input: one arrow gives ${await read('s/level', 'share')}, said "${await attr(H, 'aria-valuetext')}"`);
  await page.keyboard.down('ArrowRight'); await wait(100);
  const keyHeld = await read('s/level', 'holding'); await page.keyboard.up('ArrowRight'); await wait();
  const b = await page.evaluate((id) => { const r = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, H);
  await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.mouse.move(b.x + 30, b.y, { steps: 4 }); await wait();
  const dragHeld = await read('s/level', 'holding'); const bubble = await shown('s__level__bubble');
  await page.mouse.up(); await wait();
  want(!keyHeld && dragHeld && bubble && !(await read('s/level', 'holding')) && !(await shown('s__level__bubble')), `${tag}: held only while dragged (keys ${keyHeld}, drag ${dragHeld}, bubble ${bubble}, after ${await read('s/level', 'holding')})`);
  // The knob's held too.
  const K = await page.evaluate(() => { const r = document.querySelector('[id$="s__oven__knob"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 4 }; });
  await page.mouse.move(K.x, K.y); await page.mouse.down(); await wait();
  const knobHeld = await read('s/oven', 'holding'); await page.mouse.up(); await wait();
  want(knobHeld && !(await read('s/oven', 'holding')), `${tag}: a knob is held while pressed (${knobHeld}), not after`);
  // A press with checked: a checkbox; aria-checked flips by a click, Enter and Space; the selected look shows.
  const L = 's__lamp';
  const look = () => page.evaluate((id) => [...(document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).children].find(x => x.getAttribute('data-hsvg-variant') && getComputedStyle(x).display !== 'none')?.getAttribute('data-hsvg-variant'), L);
  const role = await attr(L, 'role');
  const flips = [await attr(L, 'aria-checked')];
  const lc = await page.evaluate((id) => { const r = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, L);
  await page.mouse.click(lc.x, lc.y); await wait(); flips.push(await attr(L, 'aria-checked'));
  await page.mouse.move(5, 5); await page.evaluate(() => document.activeElement?.blur()); await wait();
  const lookOn = await look();
  await page.focus(`[id="${L}"], [id$="__${L}"]`); await page.keyboard.press('Enter'); await wait(); flips.push(await attr(L, 'aria-checked'));
  await page.keyboard.press('Space'); await wait(); flips.push(await attr(L, 'aria-checked'));
  await page.evaluate(() => document.activeElement?.blur()); await wait();
  const lookOn2 = await look();
  want(role === 'checkbox' && flips.join() === 'false,true,false,true' && await read('s', 'toggles') === 3, `${tag}: a press with checked is a checkbox (${role}); aria-checked ${flips.join(' ')}; ${await read('s', 'toggles')} events`);
  want(lookOn === 'selected' && lookOn2 === 'selected', `${tag}: the selected look shows while checked (${lookOn}, ${lookOn2})`);
  await page.focus(`[id="${L}"], [id$="__${L}"]`); await page.keyboard.press('Space'); await wait();
  // An option group is one tab stop (the option group's sequence): Tab into the group, End, ArrowRight (wraps, no select), Tab: the
  // next control, not the group's checked option again. Focus left the group, so its stop went back to the checked
  // option: Shift+Tab comes back there.
  await page.focus('[id$="s__level__handle"]'); await page.keyboard.press('Tab'); await wait(100);
  const first = await page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, ''));
  await page.keyboard.press('End'); await page.keyboard.press('ArrowRight'); await wait(100);
  const moved = await page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, ''));
  await page.keyboard.press('Tab'); await wait(100);
  const next = await page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, ''));
  await page.keyboard.press('Shift+Tab'); await wait(100);
  const back = await page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, ''));
    want(first === 's__size-m' && moved === 's__size-s' && next === 's__lamp', `${tag}: Tab lands on the checked option (${first}); End, ArrowRight wrap to ${moved}; Tab goes on to ${next}`);
  want(back === 's__size-m' && await read('s', 'pick') === 'm', `${tag}: Shift+Tab comes back to ${back}; nothing selected by the arrows (${await read('s', 'pick')})`);
  await page.keyboard.press('ArrowLeft'); await wait(100);
  const inside = await page.evaluate(() => ['s__size-s', 's__size-m', 's__size-l'].map(id => (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).getAttribute('tabindex')).join(','));
  await page.keyboard.press('Shift+Tab'); await wait(100);
  const out = await page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, ''));
  const after = await page.evaluate(() => ['s__size-s', 's__size-m', 's__size-l'].map(id => (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).getAttribute('tabindex')).join(','));
  want(inside === '0,-1,-1' && out === 's__level__handle' && after === '-1,0,-1', `${tag}: inside, the focused option holds the stop (${inside}); Shift+Tab leaves to ${out}, and the stop goes back to the checked option (${after})`);
  // A hidden option (item 7): End skips it, and the page and the player agree it cannot activate.
  await page.evaluate(() => { const p = window.hsvg.player; p.transaction('person', () => p.runActions('s', [{ id: 'hide-l', set: 'large', to: 'false' }], 'control')); p.afterCommit?.(); });
  await page.waitForTimeout(300);
  await page.focus('[id$="s__size-m"]'); await page.keyboard.press('End'); await wait(100);
  const end = await page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, ''));
  const en = await page.evaluate(() => window.hsvg.player.controlEnabled('s', 'size', 'l'));
  want(end === 's__size-m' && en === false, `${tag}: a hidden option is skipped (End on ${end}) and refused by the player (${en})`);
}

try {
  for (const name of names) {
    const file = await pageFile(name);
    for (const [layout, viewport] of Object.entries(LAYOUTS)) {
      for (const reduced of [false, true]) {
        if (reduced && layout === 'tall') continue; // reduced motion: once, wide
        const ctx = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(pathToFileURL(file).href);
        await page.waitForFunction(() => window.hsvg?.input?.items, null, { timeout: 20000 });
        await page.waitForTimeout(600);
        const ids = await page.evaluate(() => window.hsvg.input.items().filter(i => i.role === 'slider' && !i.disabled).map(i => i.id).filter(id => { const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)); return [...el.parentNode.children].some(x => x.localName === 'circle' && x.hasAttribute('data-hsvg-band')); }));
        const tag0 = `${name} ${layout}${reduced ? ' reduced' : ''}`;
        want(ids.length > 0, `${tag0}: shows ${ids.length} knob(s): ${ids.join(', ')}`);
        const touch = await ctx.newCDPSession(page);
        for (const id of ids) await playKnob(page, `${tag0} ${id}`, id, touch, reduced, CASES[name]);
        if (name === 'fixture') await playExtras(page, tag0);
        want(!errors.length && !(await page.evaluate(() => window.hsvg.errors?.length || 0)), `${tag0}: no page or engine error ${errors.join(' | ')}`);
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
if (problems.length) { console.log(`k1-dial-browser: ${problems.length} problem(s)`); process.exit(1); }
console.log('k1-dial-browser: ok');
