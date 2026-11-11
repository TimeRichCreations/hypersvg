// A press is a press in Firefox (10.13). On a packed fixture (tests/w9e4-fixture) whose
// pressed look swaps the drawn part under the pointer, and on motor part 1 step 4 (coil):
// - a mouse press on the press activates it exactly once, and a press on an option chooses it once;
// - Enter and Space activate once too; a finger's tap once (Chromium);
// - on m1 step 4, a click on "200" chooses it every time (10 tries, a slider used by keys before each).
// Runs in Firefox and in Chromium, one after the other. Run alone:
//   node engine/v2/tests/browser/w9e4-press-browser.mjs [firefox] [chromium] [--m1 <m1 experience folder>]
// Playwright must already be installed (PW_PATH, or a global install), with Firefox for the Firefox half.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const { pack } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs')).href);
const { loadPlaywright } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'browser.mjs')).href);
const args = process.argv.slice(2);
const m1At = args.indexOf('--m1');
const m1 = m1At >= 0 ? path.resolve(args.splice(m1At, 2)[1]) : path.join(repo, 'examples', '2.0-showcase', 'motors', 'm1-electricity-magnetism');
const browsers = args.length ? args : ['firefox', 'chromium'];

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const packed = async (folder) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-w9e4-'));
  await pack(folder, tmp, { test: true });
  return path.join(tmp, fs.readdirSync(tmp).find(f => f.endsWith('.html')));
};
const fixture = await packed(path.join(repo, 'engine', 'v2', 'tests', 'w9e4-fixture'));
const motor = fs.existsSync(m1) ? await packed(m1) : null;
if (!motor) console.log(`skip: no motor part 1 at ${m1}`);

const read = (page, addr, name) => page.evaluate(([a, n]) => window.hsvg.player.read(a, n), [addr, name]);
const domId = (page, addr, local) => page.evaluate(([a, l]) => window.hsvg.drawing.frames[a]?.byLocal.get(l)?.dom?.id || null, [addr, local]);
const centre = async (page, addr, local) => { const id = await domId(page, addr, local); return page.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, id); };

for (const name of browsers) {
  const pw = loadPlaywright();
  const browser = await pw[name].launch({ headless: true });
  try {
    const open = async (file, query = '', touch = false) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: touch });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(pathToFileURL(file).href + query);
      await page.waitForFunction(() => window.hsvg?.input?.items, null, { timeout: 30000 });
      await page.waitForTimeout(300);
      return { ctx, page, errors };
    };
    // ---- the fixture ----
    {
      const { ctx, page, errors } = await open(fixture);
      const [gx, gy] = await centre(page, 'one', 'go');
      for (let i = 1; i <= 5; i++) { await page.mouse.click(gx, gy); await page.waitForTimeout(150); }
      want(await read(page, 'one', 'presses') === 5, `${name}: five mouse clicks on Go press it five times (presses ${await read(page, 'one', 'presses')})`);
      // a slower click: down, a pause with the pressed look shown, up
      await page.mouse.move(gx, gy); await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(250);
      want(await read(page, 'one', 'presses') === 6, `${name}: a held click presses once (presses ${await read(page, 'one', 'presses')})`);
      // down on Go, up far away: no press
      await page.mouse.move(gx, gy); await page.mouse.down(); await page.mouse.move(gx + 200, gy + 120); await page.mouse.up(); await page.waitForTimeout(200);
      want(await read(page, 'one', 'presses') === 6, `${name}: down on Go and up elsewhere presses nothing (presses ${await read(page, 'one', 'presses')})`);
      for (const [opt, v] of [['pick-c', 3], ['pick-b', 2], ['pick-a', 1]]) {
        const before = await read(page, 'one', 'picks');
        await page.mouse.click(...await centre(page, 'one', opt)); await page.waitForTimeout(150);
        want(await read(page, 'one', 'pick') === v && await read(page, 'one', 'picks') === before + 1, `${name}: a click on ${opt} chooses it once (pick ${await read(page, 'one', 'pick')}, picks ${before} to ${await read(page, 'one', 'picks')})`);
      }
      // keys: focus Go, Enter and Space each press once
      await page.evaluate((id) => document.getElementById(id).focus(), await domId(page, 'one', 'go'));
      await page.keyboard.press('Enter'); await page.waitForTimeout(100); await page.keyboard.press('Space'); await page.waitForTimeout(150);
      want(await read(page, 'one', 'presses') === 8, `${name}: Enter and Space press Go once each (presses ${await read(page, 'one', 'presses')})`);
      want(errors.length === 0, `${name}: no page errors (${errors.join('; ')})`);
      await ctx.close();
    }
    // ---- a finger: a tap presses once (the browser's click after it is not a second press) ----
    if (name === 'chromium') {
      const { ctx, page } = await open(fixture, '', true);
      const [gx, gy] = await centre(page, 'one', 'go');
      for (let i = 0; i < 3; i++) { await page.touchscreen.tap(gx, gy); await page.waitForTimeout(150); }
      want(await read(page, 'one', 'presses') === 3, `${name}: three taps on Go press it three times (presses ${await read(page, 'one', 'presses')})`);
      await page.touchscreen.tap(...await centre(page, 'one', 'pick-c')); await page.waitForTimeout(150);
      want(await read(page, 'one', 'pick') === 3 && await read(page, 'one', 'picks') === 1, `${name}: a tap on pick-c chooses it once (picks ${await read(page, 'one', 'picks')})`);
      await ctx.close();
    }
    // ---- motor part 1, step 4 (coil): a click on 200 chooses it, 10 tries ----
    if (motor) {
      const { ctx, page, errors } = await open(motor, '?start=coil');
      const slider = await domId(page, 'coil', 'coil-amps-handle');
      let chosen = 0;
      for (let i = 0; i < 10; i++) {
        if (slider) { await page.evaluate((id) => document.getElementById(id).focus(), slider); await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight'); await page.waitForTimeout(80); }
        await page.mouse.click(...await centre(page, 'coil', 'turns-t200')); await page.waitForTimeout(200);
        if (await read(page, 'coil', 'turns') === 200) chosen++;
        await page.mouse.click(...await centre(page, 'coil', 'turns-t800')); await page.waitForTimeout(200);
      }
      want(chosen === 10, `${name}: m1 step 4, a click on 200 chooses it ${chosen} times of 10`);
      want(errors.length === 0, `${name}: m1 no page errors (${errors.join('; ')})`);
      await ctx.close();
    }
  } finally { await browser.close(); }
}
console.log(problems.length ? `${problems.length} problem(s)` : 'all passed');
process.exit(problems.length ? 1 : 0);
