// The focus ring and the cursor, on a packed page (tests/e2-fixture) played in a real browser. Run alone:
//   node engine/v2/tests/browser/e2-pointer-browser.mjs [ring] [cursor]
// - ring (item 2): the focus ring and the `focus` look follow the :focus-visible rule. A mouse click on Next, and a
//   finger tap on it, move focus to the next step's first control with no ring and no focus look; a click on a control
//   shows none either; Tab then shows them again; Enter on Next (keys) shows the ring on the next step's control.
// - cursor (item 3): an enabled control shows the pointer on its target and its hit area (the slider's band, the angle
//   slider's disc); a disabled one shows the default cursor there, and on the drag's drop.
// Playwright must already be installed (PW_PATH, or a global install). It is never a dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const { pack } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs')).href);
const { launchBrowser } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'browser.mjs')).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-e2-'));
const PARTS = ['ring', 'cursor'];
const parts = process.argv.slice(2).length ? process.argv.slice(2) : PARTS;

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
await pack(path.join(repo, 'engine', 'v2', 'tests', 'e2-fixture'), tmp, { test: true });
const file = path.join(tmp, fs.readdirSync(tmp).find(f => f.endsWith('.html')));
const browser = await launchBrowser();

async function open({ touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 }, hasTouch: touch });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => window.hsvg?.input?.items, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  return { ctx, page, errors, wait: (ms = 400) => page.waitForTimeout(ms) };
}
// The element of a control target, by scene and local id.
const idOf = (page, addr, local) => page.evaluate(([a, l]) => window.hsvg.drawing.frames[a]?.byLocal.get(l)?.dom?.id || null, [addr, local]);
const centre = (page, id) => page.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
// What the focused element shows: its id, whether a ring is drawn (the ring filter or the plain outline) and whether its
// `focus` look is the one shown.
const focusNow = (page) => page.evaluate(() => {
  const a = document.activeElement; const s = getComputedStyle(a);
  const look = a.querySelector?.(':scope > [data-hsvg-variant="focus"]');
  return { id: a.id, ring: (s.filter && s.filter !== 'none') || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0), filter: s.filter, outline: `${s.outlineStyle} ${s.outlineWidth}`,
    look: look ? getComputedStyle(look).display !== 'none' : null };
});

try {
  if (parts.includes('ring')) {
    const o = await open();
    const next = await idOf(o.page, 'one', 'next');
    // A mouse click on Next: the next step's first control (Back) takes focus, with no ring and no focus look.
    await o.page.mouse.click(...Object.values(await centre(o.page, next))); await o.wait();
    const back = await idOf(o.page, 'two', 'back');
    let f = await focusNow(o.page);
    console.log(`after a click on Next: ${JSON.stringify(f)}`);
    want(f.id === back, `a click on Next moves focus to Back (focus on ${f.id})`);
    want(!f.ring, `no ring on Back after a mouse click (filter ${f.filter}, outline ${f.outline})`);
    want(f.look === false, 'no focus look on Back after a mouse click');
    // Tab after the mouse press: the ring shows again (Shift+Tab and Tab come back to Back, the only control).
    await o.page.keyboard.press('Shift+Tab'); await o.page.keyboard.press('Tab'); await o.wait(200);
    f = await focusNow(o.page);
    console.log(`after Tab: ${JSON.stringify(f)}`);
    want(f.id === back && f.ring && f.look === true, `Tab after a click shows the ring and the focus look on Back (${f.id}, ring ${f.ring}, look ${f.look})`);
    // A mouse click on Back, then keys: Enter on Next shows the ring on Back (focus moved by the engine after a key).
    await o.page.mouse.click(...Object.values(await centre(o.page, back))); await o.wait();
    f = await focusNow(o.page);
    const nextAgain = await idOf(o.page, 'one', 'next');
    want(!f.ring, `no ring after a mouse click on Back, back in step one (focus on ${f.id})`);
    // A click on an enabled control: no ring and no focus look on it; Tab then shows the ring on the next control.
    const act = await idOf(o.page, 'one', 'act');
    await o.page.mouse.click(...Object.values(await centre(o.page, act))); await o.wait();
    f = await focusNow(o.page);
    console.log(`after a click on Act: ${JSON.stringify(f)}`);
    want(f.id === act && !f.ring && f.look === false, `a click on Act focuses it with no ring and no focus look (${f.id}, ring ${f.ring}, look ${f.look})`);
    await o.page.keyboard.press('Tab'); await o.wait(200);
    f = await focusNow(o.page);
    const lev = await idOf(o.page, 'one', 'lev');
    want(f.id === lev && f.ring, `Tab after the click moves to the Level slider and shows the ring (${f.id}, ring ${f.ring})`);
    await o.page.keyboard.press('Shift+Tab'); await o.wait(200);
    f = await focusNow(o.page);
    want(f.id === act && f.ring && f.look === true, `Shift+Tab back to Act shows the ring and its focus look (ring ${f.ring}, look ${f.look})`);
    // A press on the slider's band: focus goes to the slider, with no ring.
    const band = await o.page.evaluate(() => { const b = document.querySelector('rect[data-hsvg-band]').getBoundingClientRect(); return { x: b.x + b.width * 0.8, y: b.y + b.height / 2 }; });
    await o.page.mouse.click(band.x, band.y); await o.wait();
    f = await focusNow(o.page);
    want(f.id === lev && !f.ring, `a press on the slider's band focuses it with no ring (${f.id}, ring ${f.ring})`);
    await o.page.keyboard.press('ArrowRight'); await o.wait(200);
    f = await focusNow(o.page);
    want(f.id === lev && f.ring, `an arrow key on the slider then shows the ring (ring ${f.ring})`);
    // Keys all the way: focus Next by keys and press Enter; the engine moves focus to Back with the ring on.
    await o.page.evaluate((id) => document.getElementById(id).focus(), nextAgain);
    await o.page.keyboard.press('Enter'); await o.wait();
    f = await focusNow(o.page);
    console.log(`after Enter on Next: ${JSON.stringify(f)}`);
    want(f.id === back && f.ring && f.look === true, `Enter on Next moves focus to Back with the ring and the focus look (${f.id}, ring ${f.ring}, look ${f.look})`);
    want(!o.errors.length, `ring (mouse): no page error ${o.errors.join(' | ')}`);
    await o.ctx.close();

    // A finger tap on Next: no ring on Back; Tab shows it.
    const t = await open({ touch: true });
    await t.page.touchscreen.tap(...Object.values(await centre(t.page, await idOf(t.page, 'one', 'next')))); await t.wait();
    f = await focusNow(t.page);
    console.log(`after a tap on Next: ${JSON.stringify(f)}`);
    want(f.id === await idOf(t.page, 'two', 'back') && !f.ring && f.look === false, `a tap on Next moves focus to Back with no ring and no focus look (${f.id}, ring ${f.ring}, look ${f.look})`);
    await t.page.keyboard.press('Shift+Tab'); await t.page.keyboard.press('Tab'); await t.wait(200);
    f = await focusNow(t.page);
    want(f.ring && f.look === true, `Tab after the tap shows the ring and the focus look (ring ${f.ring}, look ${f.look})`);
    want(!t.errors.length, `ring (touch): no page error ${t.errors.join(' | ')}`);
    await t.ctx.close();
  }

  if (parts.includes('cursor')) {
    const o = await open();
    // The cursor at a point of the page: that of the topmost element there.
    const cursorAt = (p) => o.page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return { cursor: e ? getComputedStyle(e).cursor : null, el: e ? `${e.localName}${e.id ? '#' + e.id : ''}${e.hasAttribute('data-hsvg-band') ? '[band]' : ''}` : null }; }, p);
    const points = async () => {
      const ids = Object.fromEntries(await Promise.all(['act', 'lev', 'knob', 'chip', 'slot'].map(async k => [k, await idOf(o.page, 'one', k)])));
      const at = async (id, fx, fy) => o.page.evaluate(([id, fx, fy]) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x + b.width * fx, y: b.y + b.height * fy }; }, [id, fx, fy]);
      const leftOf = await at(ids.lev, 0.5, 0.5);
      return {
        'Act (its label text)': await at(ids.act, 0.5, 0.62),
        'Act (its body)': await at(ids.act, 0.1, 0.2),
        'Level handle': leftOf,
        "Level's band (the bar, away from the handle)": { x: leftOf.x + 150, y: leftOf.y },
        'Knob': await at(ids.knob, 0.5, 0.75),
        // The disc is the circle the knob sweeps (the farthest corner of its box): left of the pivot, past the knob.
        "Knob's disc (outside the knob)": await o.page.evaluate((id) => { const k = document.getElementById(id); const c = window.hsvg.drawing.frames.one.byLocal.get('knob').dom.getScreenCTM(); const p = new DOMPoint(140 - 54, 220).matrixTransform(c); return { x: p.x, y: p.y }; }, ids.knob),
        'Chip': await at(ids.chip, 0.2, 0.5),
        "Chip's drop (Slot)": await at(ids.slot, 0.5, 0.5),
      };
    };
    let pts = await points();
    for (const [name, p] of Object.entries(pts)) {
      if (name.startsWith("Chip's drop")) continue; // a drop shows no pointer of its own
      const c = await cursorAt(p);
      want(c.cursor === 'pointer', `enabled: ${name} shows the pointer (${c.cursor} on ${c.el})`);
    }
    await o.page.mouse.click(...Object.values(await centre(o.page, await idOf(o.page, 'one', 'flip')))); await o.wait();
    const off = await o.page.evaluate(() => window.hsvg.player.read('one', 'on'));
    want(off === false, `the toggle turns the controls off (on = ${off})`);
    pts = await points();
    for (const [name, p] of Object.entries(pts)) {
      const c = await cursorAt(p);
      want(c.cursor !== 'pointer' && c.cursor !== 'text', `disabled: ${name} shows the default cursor (${c.cursor} on ${c.el})`);
    }
    // Hovering a disabled target with the mouse keeps the default cursor (what the page computes under the pointer).
    const disabledFlags = await o.page.evaluate(() => window.hsvg.input.items().filter(i => ['act', 'lev', 'knob', 'chip'].includes(i.cid)).map(i => `${i.cid}:${i.disabled}`));
    want(disabledFlags.every(x => x.endsWith(':true')), `the four controls are disabled (${disabledFlags.join(', ')})`);
    want(!o.errors.length, `cursor: no page error ${o.errors.join(' | ')}`);
    await o.ctx.close();
  }
} catch (e) { problems.push(e.stack || e.message); console.log(e.stack || e.message); } finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
if (problems.length) { console.log(`e2-pointer-browser: ${problems.length} problem(s)`); process.exit(1); }
console.log('e2-pointer-browser: all passed');
