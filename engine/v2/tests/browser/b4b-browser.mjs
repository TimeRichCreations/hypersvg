// In a real browser: a control's label defaults to its target's only <text> (11). The
// flower of FIRST-STEPS (b4b-fixture/files.mjs) has a press control with no label on a button drawn with the text
// "Grow": a screen reader announces it as the button "Grow".
// Run alone (it starts a browser):
//   node engine/v2/tests/browser/b4b-browser.mjs
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture } from './b4b-fixture/files.mjs';

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
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  const grow = page.getByRole('button', { name: 'Grow', exact: true });
  want(await grow.count() === 1, `one button is named "Grow" (${await grow.count()})`);
  const tree = await page.locator('body').ariaSnapshot();
  want(/button "Grow"/.test(tree), `the accessibility tree has the button "Grow" (${tree.split('\n').filter(l => /button/.test(l)).join(' | ')})`);
  await grow.first().focus();
  await page.keyboard.press('Enter');
  const stage = await page.evaluate(() => window.hsvg.player.read('garden', 'stage'));
  want(stage === 'bud', `pressing it by keyboard grows the seed (${stage})`);
  want(errors.length === 0, `no page errors (${errors.join('; ')})`);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `b4b browser run: ${problems.length} failed` : 'b4b browser run: pass');
process.exitCode = problems.length ? 1 : 0;
