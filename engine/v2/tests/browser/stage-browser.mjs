// A stage slot whose size follows values (6.8 size, 5.10, D1) and picking by input (7.1), in a real browser, on
// stage-fixture/files.mjs. Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/stage-browser.mjs
// Checks: dragging the stage's width and height handles with the mouse resizes the stage, and the layout fixture's ad
// in it chooses its frame again (300x250, 160x600, 728x90), keeping its value; the turn button switches the harbour
// scene between its wide and tall layouts with its value kept; the colour option picks the night theme and the
// language option German, at once, with the layouts kept; no faults.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { texts as files } from './stage-fixture/files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
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
// The shell is drawn 1000x800, so one drawing unit is one CSS pixel.
const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const look = () => page.evaluate(() => {
  const h = window.hsvg; const sc = h.player.scene; const sh = h.player.shellId;
  const b = document.querySelector('[id$="frame__stage-box"]');
  return {
    scene: sc, choice: h.choices[sc], label: document.querySelector(`[id$="${sc}__label"]`)?.textContent ?? null,
    count: document.querySelector(`[id$="${sc}__count"]`)?.textContent ?? null, taps: h.player.state.blocks[sc]?.values.taps,
    w: h.player.state.blocks[sh].values.w, h: h.player.state.blocks[sh].values.h,
    box: ['width', 'height'].map(k => Number(b.getAttribute(k))),
    sceneBox: (() => { const s = document.querySelector('[data-player-scene]'); return s ? ['width', 'height'].map(k => Number(s.getAttribute(k))) : null; })(),
    backdrop: document.querySelector('[id$="frame__backdrop"]')?.getAttribute('fill'), greeting: document.querySelector('[id$="frame__greeting"]')?.textContent,
    language: h.player.state.ambient.language,
  };
});
// Drags a handle's centre to (x, y) with the mouse.
const drag = async (id, x, y) => {
  const r = await page.evaluate((id) => { const b = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, id);
  await page.mouse.move(r[0], r[1]);
  await page.mouse.down();
  await page.mouse.move((r[0] + x) / 2, (r[1] + y) / 2);
  await page.mouse.move(x, y);
  await page.mouse.up();
};
const settle = (label) => page.waitForFunction((l) => { const sc = window.hsvg.player.scene; return document.querySelector(`[id$="${sc}__label"]`)?.textContent === l; }, label, { timeout: 5000 }).catch(() => {});
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  let s = await look();
  console.log(JSON.stringify(s));
  want(s.label === '300x250' && s.choice?.why === 'size' && s.box.join() === '300,250', 'the ad starts in a 300x250 stage at its exact size');
  await page.evaluate(() => { window.hsvg.press('ad', 'tap'); window.hsvg.press('ad', 'tap'); });
  // Drag to 160x600: the right handle to x = 20 + 160, the bottom handle to y = 20 + 600.
  await drag('frame__width-handle', 180, 145);
  await drag('frame__height-handle', 165, 620);
  await settle('160x600');
  s = await look();
  console.log(JSON.stringify(s));
  want(s.w === 160 && s.h === 600 && s.box.join() === '160,600' && s.sceneBox?.join() === '160,600', 'dragging the handles writes w and h, and the stage slot follows');
  want(s.label === '160x600' && s.choice?.why === 'size', 'the ad chose its 160x600 frame again');
  want(s.taps === 2 && s.count === '2', 'the value set before the resize is kept');
  await drag('frame__width-handle', 748, 145);
  await drag('frame__height-handle', 165, 110);
  await settle('728x90');
  s = await look();
  console.log(JSON.stringify(s));
  want(s.label === '728x90' && s.box.join() === '728,90' && s.taps === 2, 'dragged to 728x90, the ad chose its leaderboard');
  await drag('frame__width-handle', 420, 145);
  await drag('frame__height-handle', 165, 320);
  await settle('300x250');
  s = await look();
  console.log(JSON.stringify(s));
  want(s.w === 400 && s.h === 300 && s.label === '300x250' && s.choice?.why === 'nearest', 'an odd size (400x300) shows the nearest aspect');
  // Orientation: the harbour scene's wide and tall layouts.
  await page.evaluate(() => { const h = window.hsvg; h.press(h.player.shellId, 'next'); });
  await page.evaluate(() => { const h = window.hsvg; h.press(h.player.shellId, 'width', 728); h.press(h.player.shellId, 'height', 450); });
  await settle('wide');
  await page.evaluate(() => { window.hsvg.press('harbour', 'tap'); window.hsvg.press('harbour', 'tap'); window.hsvg.press('harbour', 'tap'); });
  s = await look();
  want(s.scene === 'harbour' && s.label === 'wide' && s.count === '3', 'the harbour scene is wide in a 728x450 stage');
  await page.click('[id$="frame__turn-btn"]');
  await settle('tall');
  s = await look();
  console.log(JSON.stringify(s));
  want(s.w === 450 && s.h === 728 && s.box.join() === '450,728' && s.label === 'tall' && s.taps === 3 && s.count === '3', 'turn: portrait, the tall layout, every value kept');
  await page.click('[id$="frame__turn-btn"]');
  await settle('wide');
  s = await look();
  want(s.label === 'wide' && s.taps === 3 && s.box.join() === '728,450', 'turn again: landscape, the wide layout');
  // Picking by input: theme and language.
  const before = s;
  await page.click('[id$="frame__night-btn"]');
  await page.waitForFunction(() => document.querySelector('[id$="frame__backdrop"]')?.getAttribute('fill') === '#10212b', null, { timeout: 5000 }).catch(() => {});
  s = await look();
  want(s.backdrop === '#10212b' && before.backdrop === '#fff4d8', 'the colour option picks the night theme at once');
  want(s.label === 'wide' && s.taps === 3 && s.box.join() === '728,450', 'a theme pick keeps the layout and values');
  await page.click('[id$="frame__de-btn"]');
  await page.waitForFunction(() => document.querySelector('[id$="frame__greeting"]')?.textContent === 'Hallo', null, { timeout: 5000 }).catch(() => {});
  s = await look();
  want(s.greeting === 'Hallo' && s.language === 'de' && s.backdrop === '#10212b', 'the language option picks German at once, the theme kept');
  await page.click('[id$="frame__en-btn"]');
  await page.waitForFunction(() => document.querySelector('[id$="frame__greeting"]')?.textContent === 'Hello', null, { timeout: 5000 }).catch(() => {});
  want((await look()).greeting === 'Hello', 'and English again');
  // Keyboard: the width handle is a slider; an arrow moves a tenth of its range.
  await page.focus('[id$="frame__width-handle"]');
  await page.keyboard.press('ArrowLeft');
  s = await look();
  want(s.w === 643 && s.box[0] === 643, 'the width slider by keyboard resizes the stage too');
  const errors = await page.evaluate(() => [...window.hsvg.errors, ...window.hsvg.drawing.faults.map(f => `${f.code} ${f.message}`)]);
  want(!errors.length, `no faults${errors.length ? `: ${errors.join('; ')}` : ''}`);
} catch (e) { problems.push(e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) console.log(`problem: ${p}`);
console.log(problems.length ? 'stage browser run: FAIL' : 'stage browser run: pass');
process.exit(problems.length ? 1 : 0);
