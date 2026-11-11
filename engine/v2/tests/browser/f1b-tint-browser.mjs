// F1b item 2: the door 2 example in a real browser. Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/f1b-tint-browser.mjs
// It copies the lamp example and its outside add-ons to a temp folder outside the engine, pins them, packs the page
// with --allow example.tint, opens it from file: and presses the switch by role and name. The add-on's page part paints
// the bulb from the value its draws binding names. Every request must be file:, data: or blob:.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';
import { pin } from '../../tools/addon.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.resolve(here, '..', '..', 'addons', 'examples');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const log = (m) => console.log(m);
const problems = [];
const fail = (m) => { problems.push(m); log(`  problem: ${m}`); };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1b-'));
let browser;
try {
  fs.cpSync(path.join(examples, 'addons'), path.join(work, 'addons'), { recursive: true });
  fs.cpSync(path.join(examples, 'lamp'), path.join(work, 'lamp'), { recursive: true });
  await pin(path.join(work, 'lamp'));
  const r = await pack(path.join(work, 'lamp'), path.join(work, 'out'), { test: true, allow: ['example.tint'] });
  log(`packed ${r.id}: ${r.bytes} bytes`);
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: 500, height: 400 }, deviceScaleFactor: 1 });
  const errors = []; const requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', q => requests.push(q.url()));
  await page.goto(pathToFileURL(r.htmlPath).href + '?clock=manual');
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.hsvgError || null);
  if (err) throw new Error(`the page did not start: ${err}`);
  const fill = () => page.evaluate(() => new Promise(res => setTimeout(() => res(document.querySelector('[id$="room__bulb"]')?.style.fill || ''), 50)));
  const dark = await fill();
  log(`the bulb before: ${dark}`);
  if (!/58,\s*58,\s*72|#3a3a48/i.test(dark)) fail(`the add-on should paint the bulb dark at first: "${dark}"`);
  await page.getByRole('button', { name: 'Switch the lamp' }).click();
  await page.evaluate(() => window.hsvg.advance(20));
  const lit = await fill();
  log(`the bulb after the switch: ${lit}`);
  if (!/255,\s*204,\s*51|#ffcc33/i.test(lit)) fail(`the add-on should paint the bulb with the shade input: "${lit}"`);
  const engineErrors = await page.evaluate(() => window.hsvg.errors.slice());
  if (engineErrors.length) fail(`engine errors: ${engineErrors.join(' | ')}`);
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  const outside = requests.filter(u => !/^(file|data|blob):/.test(u));
  if (outside.length) fail(`requests outside the page: ${outside.join(', ')}`);
} catch (e) {
  fail(e.stack || String(e));
} finally {
  await browser?.close();
  fs.rmSync(work, { recursive: true, force: true });
}
log(problems.length ? `f1b-tint-browser: ${problems.length} problem(s)` : 'f1b-tint-browser: ok');
process.exit(problems.length ? 1 : 0);
