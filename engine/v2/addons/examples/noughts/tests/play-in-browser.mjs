// Noughts against Bolt (examples/noughts) packed and played in a real browser, from file://. Run alone:
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/addons/examples/noughts/tests/play-in-browser.mjs
// It plays the packed page: a whole game by keyboard (the level picker, then the board with Tab, arrows and Enter) and
// one by pointer at each of the three levels; a win on each of the eight lines, checked in the drawing (the winning line
// is drawn and only it); reduced motion (marks at once, Bolt's wait stays); and the tall layout. Every request must be
// for file: or data:. Playwright is never a dependency. Heavy: the packed page runs on the real clock, one game at a time.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../../../tools/pack.mjs';
import { pin } from '../../../../tools/addon.mjs';
import { LINES, ORDERS, DEFAULT_ORDER, find, moduleTurn } from '../../../../tests/x9-noughts.test.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const EX = path.join(repo, 'engine', 'v2', 'addons', 'examples');
const log = (m) => console.log(m);
const problems = [];
const fail = (m) => { problems.push(m); log(`  problem: ${m}`); };

// The example copied to a folder outside the engine (as a person uses it), the module's order list optionally changed,
// pinned, then packed with the add-ons allowed.
async function build(order) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-x9b-'));
  fs.cpSync(path.join(EX, 'addons'), path.join(dir, 'addons'), { recursive: true });
  fs.cpSync(path.join(EX, 'noughts'), path.join(dir, 'noughts'), { recursive: true });
  if (order) { const f = path.join(dir, 'addons', 'example.noughts', 'index.mjs'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(`const ORDER = ${DEFAULT_ORDER}`, `const ORDER = ${order}`)); }
  await pin(path.join(dir, 'noughts'));
  const r = await pack(path.join(dir, 'noughts'), path.join(dir, 'out'), { test: true, allow: ['example.glow', 'example.noughts'] });
  log(`packed ${r.id} (${order ? 'edges first' : 'default'}): ${r.bytes} bytes`);
  return r;
}

let browser;
const errors = []; const requests = [];
async function openPage(r, { viewport = { width: 960, height: 600 }, reducedMotion = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: reducedMotion ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', q => requests.push(q.url()));
  await page.goto(pathToFileURL(r.htmlPath).href);
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.hsvgError || null);
  if (err) throw new Error(`the page did not start: ${err}`);
  return { page, context };
}
const val = (page, name) => page.evaluate((n) => window.hsvg.player.read('game', n), name);
const scene = (page) => page.evaluate(() => window.hsvg.player.scene);
const dash = (page, id) => page.evaluate((i) => document.getElementById(`game__${i}`)?.getAttribute('stroke-dasharray') ?? null, id);
const shown = (d) => { if (d == null) return false; const [a] = d.trim().split(/\s+/).map(Number); return a > 0.5; };
// A mark (the draw channel) is drawn when its dash offset has run down to 0; a win line (the dash channel) when its share is up.
const drawn = (page, id) => page.evaluate((i) => Number(document.getElementById(`game__${i}`)?.getAttribute('stroke-dashoffset') ?? 1) < 0.5, id);
// Bolt is done when the status says it is our turn again, or the game is over.
const settled = (page, ms = 9000) => page.waitForFunction(() => { const p = window.hsvg.player; const t = p.read('game', 'thinkingNow'); return t === false; }, null, { timeout: ms });
const cell = (page, n) => page.getByRole('radio', { name: new RegExp(`^Cell ${n},`) });

async function pickAndPlay(page, name, by) {
  if (by === 'keyboard') {
    await page.keyboard.press('Tab'); // the level group
    const want = { Easy: 0, Fair: 1, Hard: 2 }[name];
    // The group starts on Fair (the middle); arrows move between the options.
    for (let k = 1; k !== want; k += (want > 1 ? 1 : -1)) await page.keyboard.press(want > 1 ? 'ArrowRight' : 'ArrowLeft');
    if (want !== 1) { /* one more step reaches it */ }
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); // Play
  } else {
    await page.getByRole('radio', { name }).click();
    await page.getByRole('button', { name: 'Play' }).click();
  }
  await page.waitForFunction(() => window.hsvg.player.scene === 'game', null, { timeout: 5000 });
  await page.waitForTimeout(700); // the slide
}

async function main() {
  const builds = [await build(null), await build(ORDERS[1])];
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});

  // 1. A whole game by pointer at each level; hard never loses.
  for (const [name, level] of [['Easy', 1], ['Fair', 2], ['Hard', 3]]) {
    const { page, context } = await openPage(builds[0]);
    await pickAndPlay(page, name, 'pointer');
    if ((await val(page, 'level')) !== level) fail(`${name}: the level value is ${await val(page, 'level')}`);
    for (let k = 0; k < 9 && !(await val(page, 'winner')); k++) {
      const board = await val(page, 'board');
      const c = board.findIndex(x => !x);
      await cell(page, c + 1).click();
      await settled(page);
    }
    const w = await val(page, 'winner');
    log(`pointer game at ${name}: ${w}`);
    if (!['X', 'O', 'draw'].includes(w)) fail(`${name}: the game did not end (${w})`);
    if (level === 3 && w === 'X') fail('hard lost');
    const status = await page.evaluate(() => document.getElementById('game__status')?.textContent);
    if (!/win|draw/i.test(status || '')) fail(`${name}: the status says "${status}" at the end`);
    await context.close();
  }

  // 2. A game by keyboard: the picker (arrows, Enter, Tab to Play), then Tab into the board, arrows and Enter.
  {
    const { page, context } = await openPage(builds[0]);
    await pickAndPlay(page, 'Easy', 'keyboard');
    if ((await val(page, 'level')) !== 1) fail(`keyboard: the level is ${await val(page, 'level')}, wanted 1`);
    // After a scene change the focus is on the new scene's first control: the board.
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.id);
    log(`keyboard: first focus on the board: ${focused}`);
    await page.keyboard.press('Enter'); // cell 1
    await settled(page);
    const b = await val(page, 'board');
    if (b[0] !== 'X' || b[4] !== 'O') fail(`keyboard: after Enter on the first cell the board is ${b.join('|')}`);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); // cell 2
    await settled(page);
    if ((await val(page, 'board'))[1] !== 'X') fail('keyboard: arrow then Enter did not place an X on cell 2');
    await context.close();
  }

  // 3. A win on each of the eight lines, by pointer; the drawing shows that line and only it.
  const turns = await Promise.all(ORDERS.map(moduleTurn));
  for (const line of Object.keys(LINES)) {
    const k = turns.findIndex(t => find(t, 1, line));
    const moves = find(turns[k], 1, line);
    const { page, context } = await openPage(builds[k]);
    await pickAndPlay(page, 'Easy', 'pointer');
    for (let i = 0; i < moves.length; i++) { await cell(page, moves[i] + 1).click(); if (i < moves.length - 1) await settled(page); }
    await page.waitForTimeout(900); // the line draws on
    const visible = [];
    for (const id of Object.keys(LINES)) if (shown(await dash(page, `win-${id}`))) visible.push(id);
    log(`line ${line}: drawn ${visible.join(',') || '(none)'}`);
    if (visible.length !== 1 || visible[0] !== line) fail(`${line}: the drawing shows ${visible.join(',') || 'no line'}`);
    if ((await val(page, 'winner')) !== 'X') fail(`${line}: X did not win`);
    await context.close();
  }

  // 4. Reduced motion: marks appear at once, and Bolt's wait stays.
  {
    const { page, context } = await openPage(builds[0], { reducedMotion: true });
    await pickAndPlay(page, 'Easy', 'pointer');
    await cell(page, 1).click();
    await page.waitForTimeout(150);
    if (!await drawn(page, 'x-0')) fail('reduced: the X is not drawn at once');
    if (await drawn(page, 'o-4')) fail('reduced: Bolt\'s O is drawn before Bolt has finished thinking');
    const st = await page.evaluate(() => document.getElementById('game__status')?.textContent);
    if (!/thinking/i.test(st || '')) fail(`reduced: the status says "${st}" while Bolt thinks`);
    await settled(page);
    await page.waitForTimeout(200);
    if (!await drawn(page, 'o-4')) fail('reduced: the O never appears');
    await context.close();
  }

  // 5. The tall layout: a move by pointer.
  {
    const { page, context } = await openPage(builds[0], { viewport: { width: 540, height: 960 } });
    await pickAndPlay(page, 'Fair', 'pointer');
    await cell(page, 5).click();
    await page.waitForTimeout(150);
    if ((await val(page, 'board'))[4] !== 'X') fail('tall: the pointer move did not place an X');
    await settled(page);
    await context.close();
  }

  const outside = requests.filter(u => !/^(file:|data:|blob:|about:)/.test(u));
  if (outside.length) fail(`requests outside the file: ${outside.join(' ')}`);
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
}
try { await main(); } catch (e) { fail(e.stack || String(e)); } finally { await browser?.close(); }
log(problems.length ? `${problems.length} problems` : 'all passed');
process.exit(problems.length ? 1 : 0);
