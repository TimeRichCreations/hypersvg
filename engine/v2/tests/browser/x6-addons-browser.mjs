// The add-on door in a real browser (D23, spec chapter 12). Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> PW_CHANNEL=chrome node engine/v2/tests/browser/x6-addons-browser.mjs
// It copies the noughts example and its three outside add-ons (a module, a capability and a preset) to a temp folder
// outside the engine, pins them there, packs the page with --allow for the capability, opens it from file:, and plays
// it by role and name (the level picker, Play, the cells), with the manual clock past Bolt's thinking wait: the module answers each move, a taken cell shakes the board (the preset's clip), a win makes the
// board glow (the capability's page part) and its event arrives (the game scene sets cheered true). Every request must be file:, data: or blob:.
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
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-x6-'));
let browser;
try {
  fs.cpSync(path.join(examples, 'addons'), path.join(work, 'addons'), { recursive: true });
  fs.cpSync(path.join(examples, 'noughts'), path.join(work, 'noughts'), { recursive: true });
  await pin(path.join(work, 'noughts'));
  const r = await pack(path.join(work, 'noughts'), path.join(work, 'out'), { test: true, allow: ['example.glow', 'example.noughts'] });
  log(`packed ${r.id} from ${work}: ${r.bytes} bytes`);
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: 500, height: 700 }, deviceScaleFactor: 1 });
  const errors = []; const requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', q => requests.push(q.url()));
  await page.goto(pathToFileURL(r.htmlPath).href + '?clock=manual');
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.hsvgError || null);
  if (err) throw new Error(`the page did not start: ${err}`);
  const read = (name) => page.evaluate((n) => window.hsvg.player.read('game', n), name);
  const marks = async () => (await read('board')).map(x => x || '-').join('');
  const adv = (ms) => page.evaluate((n) => window.hsvg.advance(n), ms);
  const settle = async () => { for (let i = 0; i < 12; i++) { await adv(400); if (await read('thinkingNow') === false) return; } };
  const cell = (n) => page.getByRole('radio', { name: new RegExp(`^Cell ${n},`) });
  const clickCell = async (n) => { await cell(n).click(); await adv(20); };
  const boardState = () => page.evaluate(() => { const b = document.querySelector('[id$="game__board"]'); return { filter: b?.style.filter || '', transform: b?.getAttribute('transform') || getComputedStyle(b).transform }; });
  // The picker scene: choose Easy (level 1), press Play, let the slide finish.
  await page.getByRole('radio', { name: 'Easy' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await adv(20);
  await page.waitForFunction(() => window.hsvg.player.scene === 'game', null, { timeout: 5000 });
  await adv(1500);
  if (await read('level') !== 1) fail(`the level picker did not set level 1: ${await read('level')}`);
  await clickCell(1);
  // Bolt thinks, reaches and inks: the manual clock runs it.
  await settle();
  log(`after X in cell 1: ${await marks()}`);
  if (await marks() !== 'X---O----') fail(`the module should answer in the centre: ${await marks()}`);
  // A taken cell plays the preset's clip: the board moves sideways for a moment.
  await clickCell(1);
  await adv(100);
  const moved = (await boardState()).transform;
  log(`the board while shaking: ${moved}`);
  if (!moved || moved === 'none' || /^translate\(0[ ,]+0\)$/.test(moved)) fail(`a taken cell should shake the board: ${moved}`);
  await adv(1000);
  await clickCell(4);
  await settle();
  await clickCell(7);
  await adv(20);
  log(`after the win: ${await marks()}, winner ${await read('winner')}`);
  if (await read('winner') !== 'X') fail(`X should win down the left: ${await marks()}`);
  await adv(200);
  await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
  const glow = (await boardState()).filter;
  log(`the glow: ${glow}`);
  if (!/drop-shadow/.test(glow)) fail(`a win should make the board glow: filter "${glow}"`);
  await adv(4000);
  await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
  const after = (await boardState()).filter;
  if (after) fail(`the glow should fade: filter "${after}"`);
  if (await read('cheered') !== true) fail('the glow faded event did not arrive (cheered is not true)');
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
log(problems.length ? `x6-addons-browser: ${problems.length} problem(s)` : 'x6-addons-browser: ok');
process.exit(problems.length ? 1 : 0);
