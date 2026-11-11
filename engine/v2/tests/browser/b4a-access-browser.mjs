// The accessibility contract in a real browser (spec 10.13), on a small fixture (b4a-fixture/files.mjs).
// Run alone (it starts a browser):
//   node engine/v2/tests/browser/b4a-access-browser.mjs
// Checks: 1. a scene entered by a link is announced once in a polite live region (its <title>); 2. the person's
// timeLimits setting, from the page option and the host's timeLimits call, multiplies a timed link or holds it off;
// 3. drag by single taps: tap to pick up, tap a drop place to drop, with the same accept and events as a drag;
// 4. reduced motion: a fade link is a cut, and a channel binding that reads elapsed holds still.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture } from './b4a-fixture/files.mjs';

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
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const open = async (query = '', options = {}) => {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, ...options });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.errors = errors;
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual${query}`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  return page;
};
const press = (page, addr, cid) => page.evaluate(([a, c]) => window.hsvg.press(a, c), [addr, cid]);
const advance = (page, ms) => page.evaluate((ms) => window.hsvg.advance(ms), ms);
const scene = (page) => page.evaluate(() => window.hsvg.player.scene);
const region = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-hsvg-announce]');
  return el && { text: el.textContent, live: el.getAttribute('aria-live'), role: el.getAttribute('role'), box: el.getBoundingClientRect().width };
});
try {
  // ---------- 1. scene changes announced ----------
  {
    const page = await open();
    const r0 = await region(page);
    want(!r0 || r0.text === '', 'the first scene is not announced');
    await press(page, 'one', 'next');
    const r1 = await region(page);
    want(await scene(page) === 'two' && r1?.text === 'Market', `a link into two announces its title (${JSON.stringify(r1)})`);
    want(r1?.live === 'polite' && r1?.role === 'status' && r1.box <= 1, 'the announcement is a polite, visually hidden live region');
    await press(page, 'two', 'back');
    want((await region(page))?.text === 'Harbour', 'going back announces the first scene');
    await press(page, 'one', 'next');
    want((await region(page))?.text.startsWith('Market'), 'the same title again is read again');
    await page.evaluate(() => window.hsvg.relayout?.());
    want(await page.evaluate(() => document.querySelectorAll('[data-hsvg-announce]').length) === 1, 'one live region after a redraw');
    want(!page.errors.length, `no page errors ${page.errors.join(' | ')}`);
    await page.close();
  }
  // ---------- 2. a setting that extends every time limit ----------
  {
    const page = await open('&timeLimits=2');
    await press(page, 'one', 'next');
    await advance(page, 9999);
    want(await scene(page) === 'two', 'timeLimits 2 from the page: the 5000 ms link still waits at 9999 ms');
    await advance(page, 1);
    want(await scene(page) === 'three', 'and fires at 10000 ms');
    await press(page, 'three', 'home'); await press(page, 'one', 'next');
    const r = await page.evaluate(() => { try { window.hsvg.host.timeLimits(0); return 'ok'; } catch (e) { return e.code || e.message; } });
    await advance(page, 60000);
    want(r === 'ok' && await scene(page) === 'two', `the host turns time limits off: no move after a minute (${r})`);
    const bad = await page.evaluate(() => { try { window.hsvg.host.timeLimits(0.5); return 'taken'; } catch (e) { return e.code; } });
    want(bad === 'E-RANGE', `a factor that shortens is refused (${bad})`);
    await page.evaluate(() => window.hsvg.host.timeLimits(1));
    await advance(page, 5000);
    want(await scene(page) === 'three', 'back to 1: the link fires after its time left');
    want(!page.errors.length, `no page errors ${page.errors.join(' | ')}`);
    await page.close();
  }
  // ---------- 3. a single-pointer path for drag ----------
  {
    const page = await open();
    const at = (x, y) => page.evaluate(([x, y]) => { const s = document.querySelector('svg'); const p = new DOMPoint(x, y).matrixTransform(s.getScreenCTM()); return { x: p.x, y: p.y }; }, [x, y]);
    const tap = async (x, y) => { const p = await at(x, y); await page.mouse.click(p.x, p.y); };
    const read = (n) => page.evaluate((n) => window.hsvg.player.read('one', n), n);
    const pressedNow = () => page.evaluate(() => document.querySelector('[id$="one__parcel"]').getAttribute('aria-pressed'));
    await tap(200, 230);
    want(await read('carried') === true && await pressedNow() === 'true' && await read('log') === '', 'a tap picks the item up and holds it (picked, aria-pressed), with no drop yet');
    await tap(340, 230);
    want(await read('log') === 'dropped:right ' && await read('carried') === false, `a tap on a drop place drops it there (${await read('log')})`);
    await tap(200, 230); await tap(60, 230);
    want((await read('log')).endsWith('missed:left '), 'accept is read as for a drag: a refused place is a miss');
    await tap(200, 230); await tap(50, 35);
    want((await read('log')).endsWith('missed: ') && await scene(page) === 'one', 'a tap on no drop place is a miss, and presses nothing under it');
    await tap(200, 230); await page.keyboard.press('Escape');
    want((await read('log')).endsWith('missed: ') && await read('carried') === false, 'Escape puts a tapped item down with no event');
    await tap(200, 230); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    want((await read('log')).endsWith('dropped:right '), 'a tapped item takes the keyboard path too');
    const a = await at(200, 230); const b = await at(340, 230);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up();
    want((await read('log')).endsWith('dropped:right dropped:right ') && await read('carried') === false, 'dragging still drops at once');
    want(!page.errors.length, `no page errors ${page.errors.join(' | ')}`);
    await page.close();
  }
  // ---------- 4. reduced motion for fade and elapsed ----------
  {
    const leaving = (page) => page.evaluate(() => { const el = document.querySelector('[data-player-leaving]'); return el ? Number(getComputedStyle(el).opacity) : null; });
    const spin = (page) => page.evaluate(() => document.querySelector('[id$="one__spinner"]').getAttribute('transform'));
    const page = await open();
    const s0 = await spin(page); await advance(page, 500);
    want(await spin(page) !== s0, 'without reduced motion the elapsed binding turns');
    await press(page, 'one', 'fade');
    const o0 = await leaving(page);
    await advance(page, 200);
    const o1 = await leaving(page);
    await advance(page, 200);
    const o2 = await leaving(page);
    const slid = await page.evaluate(() => window.hsvg.slid);
    want(await scene(page) === 'two' && o0 > 0.9 && Math.abs(o1 - 0.5) < 0.05 && o2 === null && slid?.kind === 'fade', `a fade shows the old scene fading out over the new (${o0}, ${o1}, ${o2})`);
    want((await region(page))?.text === 'Market', 'a faded-in scene is announced too');
    want(!page.errors.length, `no page errors ${page.errors.join(' | ')}`);
    await page.close();
    const calm = await open('', { reducedMotion: 'reduce' });
    const r0 = await spin(calm); await advance(calm, 1500);
    want(await spin(calm) === r0, `reduced motion: the elapsed binding holds still (${r0})`);
    await press(calm, 'one', 'fade');
    want(await scene(calm) === 'two' && await leaving(calm) === null && !(await calm.evaluate(() => window.hsvg.slide)), 'reduced motion: a fade is a cut');
    want(!calm.errors.length, `no page errors ${calm.errors.join(' | ')}`);
    await calm.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problem(s)` : 'all ok');
process.exit(problems.length ? 1 : 0);
