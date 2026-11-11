// The shell and its widgets in a real browser (10.1, 10.3, A6.1), on shell-fixture/files.mjs. Run alone:
//   node engine/v2/tests/browser/shell-browser.mjs
// Checks: the scene sits in the stage slot; the shell's DOM stays while scenes change; a scene hides a hideable slot;
// a shell link replaces the stage's scene; the gear opens the settings dialog, which takes focus and makes the stage
// inert; a pausing dialog holds the stage's timed link; the form's Apply, Cancel, Reset and Escape; the table widget.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture } from './shell-fixture/files.mjs';

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
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const scene = () => page.evaluate(() => window.hsvg.player.scene);
const shown = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; for (let n = e; n; n = n.parentElement) if (getComputedStyle(n).display === 'none' || n.hidden) return false; return true; }, sel);
const knob = (k) => page.evaluate((k) => window.hsvg.player.state.blocks.experience.inputs[k], k);
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  want(await page.evaluate(() => !!document.querySelector('[data-player-stage] [id$="a__next"]')), 'the scene sits in the stage slot');
  want(await page.evaluate(() => document.querySelectorAll('[data-player-widget="scores"] tbody tr').length) === 2, 'the table widget shows its rows');
  await page.evaluate(() => { window.gearBefore = document.querySelector('[id$="frame__gear"]'); });

  // A scene change keeps the shell; scene b hides the top bar; the shell's link brings a back.
  await page.click('[id$="a__next"]');
  want(await scene() === 'b' && await page.evaluate(() => document.querySelector('[id$="frame__gear"]') === window.gearBefore), 'a new scene keeps the shell\'s own DOM');
  want(!(await shown('[id$="frame__bar"]')), 'scene b hides the hideable top bar');
  await page.evaluate(() => window.hsvg.press('frame', 'home'));
  want(await scene() === 'a' && await shown('[id$="frame__bar"]'), 'a shell link replaces the stage scene; the top bar comes back');

  // The gear opens the dialog: focus moves into its form, the stage is inert, its time waits.
  await page.focus('[id$="frame__gear"]'); await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  want(await shown('[data-player-widget="settings"]'), 'the settings form shows over its dialog slot');
  want(await page.evaluate(() => !!document.activeElement?.closest('[data-player-widget="settings"]')), 'the dialog takes focus');
  const bars = await page.evaluate(() => [...document.querySelectorAll('[data-player-widget="settings"] [data-player-button]')].map(b => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.width), Math.round(r.height)]; }));
  want(bars.length === 3 && bars.every(([, w, h]) => w >= 44 && h >= 44), `Apply, Cancel and Reset are at least 44 by 44 CSS pixels (${bars.map(b => `${b[0]} ${b[1]}x${b[2]}`).join(', ')})`);
  want(await page.evaluate(() => document.querySelector('[id$="a__next"]').getAttribute('tabindex')) === '-1', 'the stage is inert while the dialog is open');
  await page.evaluate(() => window.hsvg.advance(4000));
  want(await scene() === 'a', 'the pausing dialog holds the stage\'s timed link');

  // Apply sends the change and closes; focus returns to the gear.
  await page.evaluate(() => { const r = document.querySelector('[data-player-widget="settings"] input[type=range]'); r.value = '0.8'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('[data-player-widget="settings"] button:nth-of-type(1)');
  await page.waitForTimeout(50);
  want(await knob('musicVolume') === 0.8 && !(await shown('[data-player-widget="settings"]')), 'Apply writes the knob and closes the dialog');
  want(await page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, '')) === 'frame__gear', 'focus returns to the gear');

  // Cancel discards; Reset sets the draft to the initial values; Escape closes.
  await page.keyboard.press('Enter'); await page.waitForTimeout(50);
  await page.evaluate(() => { const r = document.querySelector('[data-player-widget="settings"] input[type=range]'); r.value = '0.1'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('[data-player-widget="settings"] button:nth-of-type(2)'); await page.waitForTimeout(50);
  want(await knob('musicVolume') === 0.8, 'Cancel discards the draft');
  await page.focus('[id$="frame__gear"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(50);
  await page.click('[data-player-widget="settings"] button:nth-of-type(3)');
  const drafted = await page.evaluate(() => document.querySelector('[data-player-widget="settings"] input[type=range]').value);
  await page.keyboard.press('Escape'); await page.waitForTimeout(50);
  want(drafted === '0.5' && await knob('musicVolume') === 0.8 && !(await shown('[data-player-widget="settings"]')), 'Reset shows the initial value in the draft; Escape closes without applying');
  await page.evaluate(() => window.hsvg.advance(3100));
  want(await scene() === 'b', 'closed: the stage\'s time moves again');
  const errors = await page.evaluate(() => window.hsvg.errors);
  if (errors.length) problems.push(`engine errors: ${errors.join('; ')}`);
} catch (e) { problems.push(e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) console.log(`problem: ${p}`);
console.log(problems.length ? 'shell browser run: FAIL' : 'shell browser run: pass');
process.exit(problems.length ? 1 : 0);
