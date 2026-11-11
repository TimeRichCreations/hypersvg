// The ai fixture in a real browser (A5.2, A6.1): the Ask dialog's form shows the seat's quick replies as buttons and
// the answer under them; typed text is matched by the built-in source; nothing reaches the network.
// Run alone: node engine/v2/tests/browser/ai-browser.mjs
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const fixture = path.join(repo, 'engine', 'v2', 'tests', 'ai-fixture');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const files = {};
for (const rel of ['experience.json', 'shell/frame.json', 'shell/frame.svg', 'scenes/desk/scene.json', 'scenes/desk/desk.svg']) files[rel] = fs.readFileSync(path.join(fixture, ...rel.split('/')), 'utf8');
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
const requests = []; page.on('request', r => { if (!r.url().startsWith(`http://127.0.0.1:${server.address().port}/`)) requests.push(r.url()); });
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const form = '[data-player-widget="ask"]'; // a widget's id is its slot's (addons.widgets)
// The fixture's scene binds the answer into a drawn line, so the drawing owns it and the form prints none (Q1 item 4).
const answer = () => page.evaluate(() => document.querySelector('[id$="answer-line"]')?.textContent?.trim(), null);
const formAnswer = () => page.evaluate((f) => document.querySelector(`${f} [data-player-answer]`), form);
const step = () => page.evaluate(() => window.hsvg.advance(0));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  await page.evaluate(() => window.hsvg.press('desk', 'ask-btn'));
  await page.waitForTimeout(50);
  const buttons = await page.evaluate((f) => [...document.querySelectorAll(`${f} [data-quick-reply]`)].map(b => b.textContent), form);
  want(JSON.stringify(buttons) === JSON.stringify(['Why oil the chain?', 'How hard should tyres be?']), `the dialog's form shows the quick replies (${buttons.join(' | ')})`);
  const sizes = await page.evaluate((f) => [...document.querySelectorAll(`${f} [data-quick-reply]`)].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }), form);
  want(sizes.length > 0 && sizes.every(([w, h]) => w >= 44 && h >= 44), `quick replies are at least 44 by 44 CSS pixels (${sizes.map(s => s.join('x')).join(', ')})`);
  const ask = await page.evaluate((f) => { const r = document.querySelector(`${f} button[type=submit]`).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }, form);
  want(ask[0] >= 44 && ask[1] >= 44, `the Ask button is at least 44 by 44 CSS pixels (${ask.join('x')})`);
  await page.click(`${form} [data-quick-reply="oil"]`); await step();
  want(await answer() === 'Oil keeps the chain smooth and quiet.', 'a quick reply shows its written answer in the drawn line');
  want(await formAnswer() === null, 'the form prints no answer, because a binding shows it');
  await page.fill(`${form} input[type=text]`, 'My brakes squeak!');
  await page.click(`${form} button[type=submit]`); await step();
  want(await answer() === 'Brakes squeeze the wheel to slow it.', 'typed text is matched to an intent');
  await page.fill(`${form} input[type=text]`, 'What is the weather?');
  await page.keyboard.press('Enter'); await step();
  want(await answer() === 'Let us look at the bike together.', 'no match gives the fallback');
  want(await page.evaluate(() => window.hsvg.player.read('desk', 'answerFrom')) === 'fallback', 'the event says where the answer came from');
  want(requests.length === 0, `no network requests (${requests.join(', ')})`);
  const errors = await page.evaluate(() => window.hsvg.errors);
  if (errors.length) problems.push(`engine errors: ${errors.join('; ')}`);
} catch (e) { problems.push(e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) console.log(`problem: ${p}`);
console.log(problems.length ? 'ai browser run: FAIL' : 'ai browser run: pass');
process.exit(problems.length ? 1 : 0);
