// Faults in a real browser (9.2): a fault from a control or a timer stops the experience with a visible message
// naming the code and the owner's address, by every path: a real mouse click, a real shortcut key, the test hook
// press, and the clock. After a stop, input and the clock do nothing. A sound the browser cannot decode is reported
// (6.10). A packed page whose module or capability is missing stops with its code (fault-fixture/missing.mjs).
// Fixture: fault-fixture/files.mjs. Run alone (it starts a browser):
//   node engine/v2/tests/browser/fault-browser.mjs
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture, badSound } from './fault-fixture/files.mjs';
import { missingCases } from './fault-fixture/missing.mjs';

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
  if (url.pathname === '/assets/sounds/bad.ogg') { res.writeHead(200, { 'content-type': 'audio/ogg' }); return res.end(badSound); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.mjs') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
const warnings = []; page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('hsvg:')) warnings.push(m.text()); });
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const n = () => page.evaluate(() => window.hsvg.player.read('one', 'n'));
const stopped = () => page.evaluate(() => window.hsvg.stopped);
const notice = () => page.evaluate(() => { const b = document.querySelector('[role="alert"][data-hsvg-fault]'); return b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height > 0 ? { code: b.getAttribute('data-hsvg-fault'), text: b.textContent } : null; });
// The message without its numbers: the value differs with what was pressed before.
const shape = (t) => t?.replace(/\d+/g, '#');
const centre = (id) => page.evaluate((id) => { const b = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
const fresh = async () => {
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
};
try {
  // A real mouse click on a faulting press.
  await fresh();
  let p = await centre('one__b-go'); await page.mouse.click(p.x, p.y);
  want(await n() === 1 && !(await stopped()) && !(await notice()), 'a good press counts and shows nothing');
  p = await centre('one__b-bad'); await page.mouse.click(p.x, p.y);
  const real = await notice();
  const s1 = await stopped();
  want(real?.code === 'E-RANGE' && real.text.includes('E-RANGE') && real.text.includes('one'), `a real click on a faulting press shows the fault: ${real?.text}`);
  want(s1?.source === 'control' && s1.code === 'E-RANGE' && s1.address === 'one', 'the player is stopped by the control');
  want(await n() === 1, 'the faulting step rolled back');
  p = await centre('one__b-go'); await page.mouse.click(p.x, p.y);
  await page.focus('[id$="one__b-go"]'); await page.keyboard.press('Enter'); await page.keyboard.press('KeyG');
  want(await n() === 1, 'after the stop, clicks and keys do nothing');
  await page.evaluate(() => window.hsvg.advance(2000));
  want((await stopped()).source === 'control' && await page.evaluate(() => document.querySelectorAll('[data-hsvg-fault]').length) === 1, 'after the stop, the clock does nothing');

  // The test hook press: the same stop, the same message.
  await fresh();
  const r = await page.evaluate(() => { const r = window.hsvg.press('one', 'bad'); return { ok: r.ok, code: r.fault?.code }; });
  const hook = await notice();
  want(!r.ok && r.code === 'E-RANGE' && shape(hook?.text) === shape(real?.text), 'the test hook press stops the same way, with the same message');
  want((await stopped())?.source === 'control', 'the test hook press is a control source');
  const again = await page.evaluate(() => window.hsvg.press('one', 'go').ignored);
  want(again === 'stopped' && await n() === 0, 'after the stop, the test hook press does nothing');

  // A real shortcut key.
  await fresh();
  await page.mouse.click(5, 5);
  await page.keyboard.press('KeyX');
  want(shape((await notice())?.text) === shape(real?.text), 'a real shortcut key on a faulting press stops the same way');

  // A timer: the clock path.
  await fresh();
  await page.evaluate(() => window.hsvg.advance(1000));
  const t = await notice();
  want(t?.code === 'E-RANGE' && (await stopped())?.source === 'timer', `a faulting timer stops with a message: ${t?.text}`);

  // A sound the browser cannot decode: reported, once to the console.
  await fresh();
  p = await centre('one__b-beep'); await page.mouse.click(p.x, p.y); await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => window.hsvg.errors.some(m => m.includes('cannot play the sound')), null, { timeout: 10000 }).catch(() => {});
  const errs = await page.evaluate(() => window.hsvg.errors);
  want(errs.filter(m => m.includes('cannot play the sound sounds/bad.ogg')).length === 1, `an undecodable sound is reported once: ${JSON.stringify(errs)}`);
  want(warnings.length === 1, `and warned once in the console: ${warnings.length}`);
  want(!(await stopped()), 'a sound that cannot play does not stop the experience');
  want(!pageErrors.length, `no page errors ${pageErrors.join('; ')}`);

  // A packed page whose module or capability is missing stops with its code, never a type error.
  await missingCases(browser, want);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problems` : 'fault-browser: all ok');
process.exit(problems.length ? 1 : 0);
