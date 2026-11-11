// Controls in a real browser (5.11, 5.12, 10.3), with real mouse and keyboard events, on a small fixture
// (input-fixture/files.mjs). Run alone (it starts a browser):
//   node engine/v2/tests/browser/input-browser.mjs
// Checks roles, names, the disabled reason, Tab order (document order, disabled skipped, one stop per option
// control), Enter, Space and shortcut keys, held, option arrows, slider keys and pointer, drag by pointer and by
// keyboard, Escape, key events, keys with nothing focused, a shortcut key holding a held press, control looks, and
// focus moving when its target is hidden, and the focus ring that follows the part (P2).
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture } from './input-fixture/files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium']; // PW_BROWSER: chromium (default), firefox or webkit
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
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
const problems = [];
const log = (m) => console.log(m);
const want = (cond, msg) => { if (!cond) problems.push(msg); log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const v = (name) => page.evaluate((n) => window.hsvg.player.read('one', n), name);
const active = () => page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, '') || '');
const centre = (id) => page.evaluate((id) => { const b = document.querySelector(`[id$="${CSS.escape(id)}"]`).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
const drawingToClient = (x, y) => page.evaluate(([x, y]) => { const s = document.querySelector('svg'); const p = new DOMPoint(x, y).matrixTransform(s.getScreenCTM()); return { x: p.x, y: p.y }; }, [x, y]);
const shown = (id, look) => page.evaluate(([id, look]) => { const g = document.querySelector(`[id$="${id}"] [data-hsvg-variant="${look}"]`); return g && getComputedStyle(g).display !== 'none'; }, [id, look]);
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  const items = await page.evaluate(() => window.hsvg.input.items());
  const by = Object.fromEntries(items.map(i => [i.id.replace(/^hsvg\d+__/, ''), i]));
  want(by['one__b-go']?.role === 'button' && by['one__b-go'].label === 'Go', 'a press is a button named by its label');
  want(by['one__b-locked']?.disabled && by['one__b-locked'].label === 'Arm first' && by['one__b-locked'].tabindex === '-1', 'a disabled press says why and has no tab stop');
  want(['one__o-a', 'one__o-b', 'one__o-c'].every(id => by[id]?.role === 'radio') && by['one__o-a'].tabindex === '0' && by['one__o-b'].tabindex === '-1', 'options are radios with one tab stop');
  want(by['one__knob']?.role === 'slider' && by['one__parcel']?.role === 'button', 'a slider and a grabbable item');

  // Tab order: document order, disabled skipped, one stop for the options.
  const order = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); order.push(await active()); }
  want(JSON.stringify(order) === JSON.stringify(['one__b-go', 'one__b-arm', 'one__b-hide', 'one__o-a', 'one__knob', 'one__parcel']), `Tab order ${order.join(' ')}`);

  // Press: Enter, Space, the shortcut key, and held while the mouse is down.
  await page.focus('[id$="one__b-go"]');
  await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await page.keyboard.press('KeyN');
  want(await v('presses') === 3, 'Enter, Space and the shortcut key each press once');
  const go = await centre('one__b-go');
  await page.mouse.move(go.x, go.y); await page.mouse.down();
  const held = await v('holding');
  await page.mouse.up();
  want(held === true && await v('holding') === false && await v('presses') === 4, 'held while the mouse is down; the click presses');

  // Control looks: hover, then focus wins over hover.
  await page.focus('[id$="one__b-go"]');
  const arm = await centre('one__b-arm'); await page.mouse.move(arm.x, arm.y);
  want(await shown('one__b-arm', 'hover') && !(await shown('one__b-arm', 'idle')), 'the hover look shows under the pointer');
  // Keyboard focus: the focus look follows :focus-visible (E2), so a key comes first; after the mouse press above, focus
  // given by a script alone shows no focus look.
  await page.keyboard.press('Tab'); await page.focus('[id$="one__b-arm"]');
  want(await shown('one__b-arm', 'focus'), 'the focus look wins over hover');
  await page.mouse.move(5, 5);

  // Arm: the disabled press becomes usable, with its own name.
  await page.keyboard.press('Enter');
  const it2 = Object.fromEntries((await page.evaluate(() => window.hsvg.input.items())).map(i => [i.id.replace(/^hsvg\d+__/, ''), i]));
  want(!it2['one__b-locked'].disabled && it2['one__b-locked'].label === 'Locked' && it2['one__b-locked'].tabindex === '0', 'enabled: the label and the tab stop come back');

  // Options: arrows move focus and wrap, Enter selects; the shortcut key selects too.
  await page.focus('[id$="one__o-a"]');
  await page.keyboard.press('ArrowRight'); const f1 = await active();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); const f2 = await active();
  await page.keyboard.press('Enter');
  want(f1 === 'one__o-b' && f2 === 'one__o-c' && await v('choice') === 'c', 'option arrows move and wrap; Enter selects');
  const it3 = Object.fromEntries((await page.evaluate(() => window.hsvg.input.items())).map(i => [i.id.replace(/^hsvg\d+__/, ''), i]));
  want(it3['one__o-c'].tabindex === '0' && it3['one__o-a'].tabindex === '-1', 'the tab stop follows the chosen option');
  await page.focus('[id$="one__b-go"]'); await page.keyboard.press('KeyC');
  want((await v('log')).includes('picked:c'), 'an option key selects it');

  // Slider: keys by position, Home, End; the pointer along the travel.
  await page.focus('[id$="one__knob"]');
  await page.keyboard.press('ArrowRight'); const s1 = await v('speed');
  await page.keyboard.press('End'); const s2 = await v('speed');
  await page.keyboard.press('Home'); const s3 = await v('speed');
  want(s1 === 25 && s2 === 100 && s3 === 0, `slider keys ${s1} ${s2} ${s3}`);
  // The range [0, 200] is the knob's travel from where it is drawn (its centre at x 100 of the drawing, 5.11): a
  // drag of the knob's centre to x 250 is 150 of 200, 3/4 of the travel; a press on its path at x 150 is 1/4.
  const k0 = await centre('one__knob'); const k1 = await drawingToClient(250, 143);
  await page.mouse.move(k0.x, k0.y); await page.mouse.down(); await page.mouse.move(k1.x, k1.y, { steps: 5 }); await page.mouse.up();
  want(await v('speed') === 75, `slider pointer to 3/4 of the travel gives 75 (got ${await v('speed')})`);
  const k2 = await drawingToClient(150, 143);
  await page.mouse.click(k2.x, k2.y); await page.waitForTimeout(50);
  want(await v('speed') === 25 && await active() === 'one__knob', `a press on the slider's path at 1/4 of the travel gives 25 and focuses it (got ${await v('speed')})`);

  // A knob (a slider with an angle axis, K1): keys by position; a press on it does not turn it; turned 90 degrees
  // clockwise round its pivot (drawing 355 125) it goes up two stops of 45 degrees; a tap on its ring at -90 degrees
  // (due left) gives 0.
  await page.focus('[id$="one__dial"]'); await page.keyboard.press('ArrowRight');
  const d1 = await v('heat');
  const pv = await drawingToClient(355, 125); const R = (await drawingToClient(375, 125)).x - pv.x;
  const round = (deg) => ({ x: pv.x + Math.cos((deg - 90) * Math.PI / 180) * R, y: pv.y + Math.sin((deg - 90) * Math.PI / 180) * R });
  let q = round(-45); await page.mouse.move(q.x, q.y); await page.mouse.down();
  const d2 = await v('heat');
  for (let a = -40; a <= 45; a += 5) { q = round(a); await page.mouse.move(q.x, q.y); }
  await page.mouse.up(); const d3 = await v('heat');
  q = round(-90); await page.mouse.click(q.x, q.y); await page.waitForTimeout(50);
  want(d1 === 25 && d2 === 25 && d3 === 75 && await v('heat') === 0 && await active() === 'one__dial', `knob: key ${d1}, press ${d2}, turned 90 degrees ${d3}, tap at -90 degrees ${await v('heat')}`);

  // Drag by pointer: onto the basket, then elsewhere.
  const pc = await centre('one__parcel'); const bk = await centre('one__basket'); const empty = await drawingToClient(200, 250);
  await page.mouse.move(pc.x, pc.y); await page.mouse.down(); await page.mouse.move(bk.x, bk.y, { steps: 8 });
  const carried = await v('carried'); await page.mouse.up();
  await page.mouse.move(pc.x, pc.y); await page.mouse.down(); await page.mouse.move(empty.x, empty.y, { steps: 8 }); await page.mouse.up();
  want(carried === true && await v('carried') === false && (await v('log')).includes('dropped:basket missed'), 'pointer drag drops on the basket, then misses');
  const homeAgain = await page.evaluate(() => document.querySelector('[id$="one__parcel"]').getAttribute('transform'));
  want(!homeAgain, 'the item returns home after a drop');

  // Drag by keyboard: Enter picks up, an arrow moves to the drop, Enter drops; Escape cancels with no event.
  await page.focus('[id$="one__parcel"]');
  await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  const afterKeys = await v('log');
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  want(afterKeys.endsWith('dropped:basket ') && await v('log') === afterKeys && await v('carried') === false, 'keyboard drag drops; Escape cancels with no event');

  // Key events of the fixed set.
  await page.keyboard.press('KeyA');
  want((await v('log')).includes('A '), 'a key of the set reaches the blocks');

  // Keys with nothing focused reach the player (found playing a large experience: clicking the picture leaves focus on the body),
  // and a shortcut key holds a held press while it is down.
  await page.evaluate(() => document.activeElement?.blur());
  const before = await v('presses');
  await page.keyboard.down('KeyN');
  const heldByKey = await v('holding');
  await page.keyboard.up('KeyN');
  want(await page.evaluate(() => document.activeElement === document.body) && heldByKey === true && await v('holding') === false && await v('presses') === before + 1,
    'with focus on the page body, a shortcut key presses once and holds its held press while down');

  // Focus moves when its target is hidden: to the next usable control.
  await page.focus('[id$="one__b-go"]');
  await page.evaluate(() => window.hsvg.press('one', 'hide'));
  await page.waitForTimeout(50);
  want(await active() === 'one__b-locked', `focus moved to the next control (${await active()})`);

  // W3-E (E4, E5): a restart ends a keyboard drag with no event, and moves focus from the removed control to the
  // stage scene's first usable control (5.11).
  await page.focus('[id$="one__parcel"]');
  await page.keyboard.press('Enter');
  const heldBefore = await page.evaluate(() => document.querySelector('[id$="one__parcel"]').getAttribute('aria-pressed'));
  await page.evaluate(() => window.hsvg.host.restart());
  await page.waitForTimeout(50);
  const firstStop = (await page.evaluate(() => window.hsvg.input.items())).find(i => i.tabindex === '0')?.id?.replace(/^hsvg\d+__/, '');
  want(heldBefore === 'true' && await active() === firstStop, `after a restart focus is on the scene's first control (${await active()}, want ${firstStop})`);
  want(await page.evaluate(() => document.querySelector('[id$="one__parcel"]').getAttribute('aria-pressed')) === 'false', 'a restart cancels the keyboard drag');
  await page.focus('[id$="one__parcel"]');
  await page.keyboard.press('Enter'); // picks up the new run's parcel; a kept drag would drop the old one here
  const picked = await page.evaluate(() => document.querySelector('[id$="one__parcel"]').getAttribute('aria-pressed'));
  await page.keyboard.press('Escape');
  want(picked === 'true' && !(await v('log')).includes('dropped:'), `after a restart Enter picks up again, no drop event (${picked}, ${await v('log')})`);

  // P2: the focus mark follows the part. Keyboard focus draws the engine's ring filter round the part's outline,
  // with no square outline; forced colours keep the plain outline; leaving the control takes the ring away.
  const mark = () => page.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); const id = a.getAttribute('data-player-ring'); const f = id && document.querySelector(`[id$="${CSS.escape(id)}"]`);
    return { id: a.id.replace(/^hsvg\d+__/, ''), ring: id, filter: s.filter, outline: s.outlineStyle, radii: f ? [...f.querySelectorAll('feGaussianBlur')].map(m => Number(m.getAttribute('stdDeviation')) * 1.2816) : [] }; }); // each blur grows by 1.2816 sigma (E1)
  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 6 && await active() !== 'one__b-go'; i++) await page.keyboard.press('Tab');
  if (await active() !== 'one__b-go') { await page.focus('[id$="one__parcel"]'); await page.keyboard.press('Shift+Tab'); }
  let m = await mark();
  const scale = await page.evaluate(() => { const c = document.querySelector('[id$="one__b-go"]').getScreenCTM(); return Math.hypot(c.a, c.b); });
  want(m.ring && /url\(/.test(m.filter) && m.outline === 'none', `a keyboard-focused part has the ring, not the outline (${JSON.stringify(m)})`);
  want(m.radii.length === 3 && Math.abs(m.radii[1] - 3 / scale) < 0.01, `the band is 3 CSS pixels at this size (${m.radii.join(' ')}, scale ${scale.toFixed(3)})`);
  await page.emulateMedia({ forcedColors: 'active' });
  // Away and back by keyboard inside the page: go is the first tab stop, so Shift+Tab first would cross the page's
  // edge, and the browser may keep focus outside it.
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  m = await mark();
  want(m.id === 'one__b-go' && m.filter === 'none' && m.outline === 'solid', `forced colours keep the plain outline (${JSON.stringify(m)})`);
  await page.emulateMedia({ forcedColors: 'none' });
  await page.evaluate(() => document.activeElement?.blur());
  want(await page.evaluate(() => !document.querySelector('[data-player-ring]')), 'leaving the control takes the ring away');

  const errors = await page.evaluate(() => window.hsvg.errors);
  if (errors.length) problems.push(`engine errors: ${errors.join('; ')}`);
} catch (e) { problems.push(e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) log(`problem: ${p}`);
log(problems.length ? 'input browser run: FAIL' : 'input browser run: pass');
process.exit(problems.length ? 1 : 0);
