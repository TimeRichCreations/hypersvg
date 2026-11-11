// Libraries and templates in a real browser (D24; spec 4.8, 4.10). Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/x7a-library-browser.mjs
// It makes each of the six starter templates with `hsvg new` (tools/library.mjs) in a temp folder, packs it, and
// packs the pick-and-use fixture (tests/x7a-fixture/picks: items picked from the starter library). Each page is opened
// from file: and played by keyboard only (Tab and Enter): it must start, raise no page or engine error, move on (the
// scene or the picture changes) and request nothing but file:, data: and blob:. The picks page must reach its picked
// layout (the quiz scene) by its picked button.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';
import { newFromTemplate } from '../../tools/library.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const problems = [];
const fail = (m) => { problems.push(m); console.log(`  problem: ${m}`); };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-x7a-'));
const PRESSES = { ad: 2, dashboard: 4, game: 4, quiz: 14, story: 6, tour: 8 };
let browser;
try {
  const pages = [];
  for (const t of Object.keys(PRESSES)) {
    const made = await newFromTemplate(`my-${t}`, t, work);
    const errs = made.diags.filter(d => d.code.startsWith('E-'));
    if (errs.length) fail(`my-${t} does not check: ${errs.map(d => d.code).join(', ')}`);
    const r = await pack(made.dir, path.join(work, 'out', t), { test: true });
    pages.push({ name: `my-${t}`, html: r.htmlPath, presses: PRESSES[t] });
  }
  const picks = await pack(path.join(repo, 'engine', 'v2', 'tests', 'x7a-fixture', 'picks'), path.join(work, 'out', 'picks'), { test: true, kits: { 'hsvg-starter': path.join(repo, 'library', '2.0', 'hsvg-starter') } });
  pages.push({ name: 'picks-demo', html: picks.htmlPath, presses: 2, reach: 'quiz' });

  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  for (const p of pages) {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
    const errors = []; const requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', q => requests.push(q.url()));
    await page.goto(pathToFileURL(p.html).href);
    await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
    const startErr = await page.evaluate(() => window.hsvgError || null);
    if (startErr) { fail(`${p.name} does not start: ${startErr}`); await page.close(); continue; }
    await page.waitForTimeout(600);
    const scene0 = await page.evaluate(() => window.hsvg.player.scene);
    const before = await page.screenshot();
    for (let i = 0; i < p.presses; i++) { await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(250); }
    await page.waitForTimeout(400);
    const scene1 = await page.evaluate(() => window.hsvg.player.scene);
    const changed = scene1 !== scene0 || !before.equals(await page.screenshot());
    const engineErrors = await page.evaluate(() => (window.hsvg.errors || []).slice());
    const outside = requests.filter(u => !/^(file|data|blob):/.test(u));
    if (!changed) fail(`${p.name}: Tab and Enter changed nothing`);
    if (p.reach && scene1 !== p.reach) fail(`${p.name}: reached ${scene1}, not ${p.reach}`);
    if (errors.length || engineErrors.length) fail(`${p.name}: errors ${JSON.stringify([...errors, ...engineErrors]).slice(0, 300)}`);
    if (outside.length) fail(`${p.name}: requests outside the page: ${outside.slice(0, 3).join(', ')}`);
    console.log(`${p.name}: ${scene0} -> ${scene1}, ${changed ? 'moved' : 'still'}, ${errors.length + engineErrors.length} errors`);
    await page.close();
  }
} catch (e) {
  fail(e.stack || String(e));
} finally {
  if (browser) await browser.close();
  fs.rmSync(work, { recursive: true, force: true });
}
console.log(problems.length ? `x7a-library-browser: ${problems.length} problems` : 'x7a-library-browser: ok');
process.exit(problems.length ? 1 : 0);
