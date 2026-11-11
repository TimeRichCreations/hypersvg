// A tap is a tap in Firefox (10.13). A phone layout (390 x 844, hasTouch; isMobile where the
// browser has it), on the packed fixture tests/w9e4-fixture (a press and three options whose `pressed` look replaces
// the whole drawn part) and on motor part 1 step 4 (coil):
// - a finger's tap on each option chooses it exactly once, also while another control has focus (Firefox fired no
//   touch events and no click for these taps on the old code);
// - three taps on Go press it three times (no double press where the browser also fires a click);
// - a touch that moves 30 px between down and up activates nothing, on Go and on an option;
// - on m1 step 4, a key on the Current slider, then a tap on "200", then a tap on "800", 10 times: "200" is chosen
//   10 times.
// Runs in Firefox, Chromium and WebKit, one after the other. Run alone:
//   node engine/v2/tests/browser/w9e6-touch-browser.mjs [firefox] [chromium] [webkit] [--m1 <m1 experience folder>]
// Playwright must already be installed (PW_PATH, or a global install), with the browsers named.
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
const browsers = args.length ? args : ['firefox', 'chromium', 'webkit'];

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const packed = async (folder) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-w9e6-'));
  await pack(folder, tmp, { test: true });
  return path.join(tmp, fs.readdirSync(tmp).find(f => f.endsWith('.html')));
};
const fixture = await packed(path.join(repo, 'engine', 'v2', 'tests', 'w9e4-fixture'));
const motor = fs.existsSync(m1) ? await packed(m1) : null;
if (!motor) console.log(`skip: no motor part 1 at ${m1}`);

const read = (page, addr, name) => page.evaluate(([a, n]) => window.hsvg.player.read(a, n), [addr, name]);
const domId = (page, addr, local) => page.evaluate(([a, l]) => window.hsvg.drawing.frames[a]?.byLocal.get(l)?.dom?.id || null, [addr, local]);
const centre = async (page, addr, local) => { const id = await domId(page, addr, local); return page.evaluate((id) => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, id); };
// A finger that goes down at (x, y) and comes up 30 px to the right (Playwright has only tap for touch): pointer
// events as a browser sends them, with no touch events and no click.
const slip = (page, x, y) => page.evaluate(([x, y]) => {
  const at = (t, cx) => { const el = document.elementFromPoint(cx, y) || document.body; el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: t === 'pointermove' ? -1 : 0, buttons: t === 'pointerup' ? 0 : 1, clientX: cx, clientY: y })); };
  at('pointerdown', x); at('pointermove', x + 15); at('pointermove', x + 30); at('pointerup', x + 30);
}, [x, y]);

for (const name of browsers) {
  const pw = loadPlaywright();
  const browser = await pw[name].launch({ headless: true });
  try {
    const open = async (file, query = '') => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name !== 'firefox' });
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
      for (const [opt, v] of [['pick-c', 3], ['pick-b', 2], ['pick-a', 1], ['pick-c', 3]]) {
        const before = await read(page, 'one', 'picks');
        await page.touchscreen.tap(...await centre(page, 'one', opt)); await page.waitForTimeout(1200);
        const pick = await read(page, 'one', 'pick'); const picks = await read(page, 'one', 'picks');
        want(pick === v && picks === before + 1, `${name}: a tap on ${opt} chooses it once (pick ${pick}, picks ${before} to ${picks})`);
      }
      // Go, while an option has focus: three taps, three presses
      const go = await centre(page, 'one', 'go');
      await page.evaluate((id) => document.getElementById(id).focus(), await domId(page, 'one', 'pick-c'));
      for (let i = 0; i < 3; i++) { await page.touchscreen.tap(...go); await page.waitForTimeout(400); }
      await page.waitForTimeout(1000);
      want(await read(page, 'one', 'presses') === 3, `${name}: three taps on Go press it three times (presses ${await read(page, 'one', 'presses')})`);
      // an option tapped while Go has focus (the case Firefox lost)
      await page.evaluate((id) => document.getElementById(id).focus(), await domId(page, 'one', 'go'));
      const p0 = await read(page, 'one', 'picks');
      await page.touchscreen.tap(...await centre(page, 'one', 'pick-b')); await page.waitForTimeout(1200);
      want(await read(page, 'one', 'pick') === 2 && await read(page, 'one', 'picks') === p0 + 1, `${name}: a tap on pick-b while Go has focus chooses it once (picks ${p0} to ${await read(page, 'one', 'picks')})`);
      // a touch that moves 30 px: nothing
      const [pr, pk] = [await read(page, 'one', 'presses'), await read(page, 'one', 'picks')];
      await slip(page, ...go); await slip(page, ...await centre(page, 'one', 'pick-a')); await page.waitForTimeout(1200);
      want(await read(page, 'one', 'presses') === pr, `${name}: a touch that moves 30 px on Go presses nothing (presses ${pr} to ${await read(page, 'one', 'presses')})`);
      want(await read(page, 'one', 'picks') === pk && await read(page, 'one', 'pick') === 2, `${name}: a touch that moves 30 px on pick-a chooses nothing (picks ${pk} to ${await read(page, 'one', 'picks')})`);
      want(errors.length === 0, `${name}: no page errors (${errors.join('; ')})`);
      await ctx.close();
    }
    // ---- motor part 1, step 4 (coil): a tap on 200 chooses it, 10 tries ----
    if (motor) {
      const { ctx, page, errors } = await open(motor, '?start=coil');
      const slider = await domId(page, 'coil', 'coil-amps-handle');
      let chosen = 0; let back = 0;
      for (let i = 0; i < 10; i++) {
        if (slider) { await page.evaluate((id) => document.getElementById(id).focus(), slider); await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight'); await page.waitForTimeout(80); }
        await page.touchscreen.tap(...await centre(page, 'coil', 'turns-t200')); await page.waitForTimeout(400);
        if (await read(page, 'coil', 'turns') === 200) chosen++;
        await page.touchscreen.tap(...await centre(page, 'coil', 'turns-t800')); await page.waitForTimeout(400);
        if (await read(page, 'coil', 'turns') === 800) back++;
      }
      want(chosen === 10 && back === 10, `${name}: m1 step 4, a tap on 200 chooses it ${chosen} times of 10 (800: ${back} of 10)`);
      want(errors.length === 0, `${name}: m1 no page errors (${errors.join('; ')})`);
      await ctx.close();
    }
  } finally { await browser.close(); }
}
console.log(problems.length ? `${problems.length} problem(s)` : 'all passed');
process.exit(problems.length ? 1 : 0);
