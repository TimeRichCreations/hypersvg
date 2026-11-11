// K2g part C: the test page's clip hooks and painted boxes in a real browser. Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/k2g-hooks-browser.mjs
// A --test page of a small lamp (one clip, one part that shows only when the lamp is on):
// 1. hsvg.boxes() gives each part's painted box in page pixels and whether it is shown;
// 2. hsvg.play(address, clip) plays a clip as the play action does and paints: the bulb rises on the manual clock and
//    comes back; hsvg.stop(address, clip) stops it;
// 3. a press that shows a part turns its box's `shown` on;
// 4. a clip the scene does not have is the play action's own fault, and the page stops (9.2).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';

const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const browserType = pw[process.env.PW_BROWSER || 'chromium'];

const log = (m) => console.log(m);
const problems = [];
const fail = (m) => { problems.push(m); log(`  problem: ${m}`); };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k2g-'));

const LAMP = {
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'hooks', language: 'en',
    story: { start: 'lamp', scenes: { lamp: 'lamp.json' }, endless: true } },
  'lamp.json': { format: 'hsvg/2.0', kind: 'scene', id: 'lamp', drawing: 'lamp.svg',
    values: { on: { type: 'boolean', initial: false } },
    controls: { switch: { kind: 'button', target: 'switch', label: 'Switch', event: 'flip' } },
    clips: { nod: { durationMs: 400, tracks: [{ target: 'bulb', channel: 'move', axis: 'y', keys: [[0, 0], [200, -20], [400, 0]] }] } },
    on: { flip: [{ actions: [{ set: 'on', to: '!on' }] }] },
    bindings: [{ target: 'glow', visible: 'on' }] },
  'lamp.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Lamp</title>'
    + '<rect width="400" height="300" fill="#1d2b36" data-hsvg-layer="backdrop"/>'
    + '<g data-hsvg-layer="content">'
    + '<g id="bulb" data-hsvg-kind="part" data-hsvg-label="Bulb" data-hsvg-motion="move-y -20..0"><circle cx="200" cy="110" r="50" fill="#555555"/></g>'
    + '<g id="glow" data-hsvg-kind="part" data-hsvg-label="Glow"><circle cx="200" cy="110" r="20" fill="#ffd45e"/></g>'
    + '<g id="switch" data-hsvg-kind="part" data-hsvg-label="Switch"><rect x="140" y="220" width="120" height="50" rx="25" fill="#d84315"/></g>'
    + '</g></svg>',
};

let browser;
try {
  const dir = path.join(work, 'hooks');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(LAMP)) fs.writeFileSync(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body, null, 1));
  const r = await pack(dir, path.join(work, 'out'), { test: true });
  log(`packed ${r.id}: ${r.bytes} bytes`);

  browser = await browserType.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(work, 'out', `${r.id}.html`)).href + '?clock=manual');
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.hsvgError || null);
  if (err) throw new Error(`the page did not start: ${err}`);

  // 1. The boxes.
  const b0 = await page.evaluate(() => window.hsvg.boxes());
  const id = (local) => Object.keys(b0).find(k => k === local || k.endsWith(`__${local}`));
  const [bulb, glow, sw] = ['bulb', 'glow', 'switch'].map(id);
  if (!bulb || !glow || !sw) fail(`boxes should name bulb, glow and switch: ${Object.keys(b0).join(', ')}`);
  else {
    log(`boxes: bulb ${JSON.stringify(b0[bulb])}, glow shown ${b0[glow].shown}`);
    if (!(b0[bulb].width > 50 && b0[bulb].shown)) fail(`the bulb should be shown with a real size: ${JSON.stringify(b0[bulb])}`);
    if (b0[glow].shown) fail('the glow should not be shown while the lamp is off');
    if (!(b0[sw].y > b0[bulb].y)) fail('the switch is drawn below the bulb');
  }

  // 2. play and stop.
  const played = await page.evaluate(() => window.hsvg.play(null, 'nod'));
  if (!played?.ok) fail(`play should commit: ${JSON.stringify(played)}`);
  await page.evaluate(() => window.hsvg.advance(200));
  const mid = await page.evaluate(() => window.hsvg.boxes());
  const rise = b0[bulb].y - mid[bulb].y;
  log(`the bulb at 200 ms into the clip rose ${rise.toFixed(1)} px`);
  if (!(rise > 10)) fail(`the bulb should rise about 20 px at 200 ms: ${rise}`);
  await page.evaluate(() => window.hsvg.advance(300));
  const end = await page.evaluate(() => window.hsvg.boxes());
  if (Math.abs(end[bulb].y - b0[bulb].y) > 1) fail(`the bulb should be back after the clip: ${end[bulb].y} vs ${b0[bulb].y}`);
  await page.evaluate(() => window.hsvg.play(null, 'nod'));
  await page.evaluate(() => window.hsvg.advance(100));
  const stopped = await page.evaluate(() => window.hsvg.stop(null, 'nod'));
  if (!stopped?.ok) fail(`stop should commit: ${JSON.stringify(stopped)}`);

  // 3. A press that shows a part.
  await page.evaluate((s) => window.hsvg.press(window.hsvg.player.scene, 'switch'), sw);
  const lit = await page.evaluate(() => window.hsvg.boxes());
  log(`after the press the glow is shown: ${lit[glow].shown}`);
  if (!lit[glow].shown) fail('the glow should be shown after the press');

  // 4. A clip the scene does not have.
  // The fault is an Error: read its code in the page (the bridge passes only an Error's name).
  const none = await page.evaluate(() => { const r = window.hsvg.play(null, 'nothing'); return { ok: r?.ok, code: r?.fault?.code ?? null, message: String(r?.fault?.message ?? '') }; });
  log(`play of an unknown clip: ${none.code} (${none.message.slice(0, 80)})`);
  if (none.ok !== false || !none.code) fail(`an unknown clip should fault with a code: ${JSON.stringify(none)}`);
  const halted = await page.evaluate(() => window.hsvg.stopped?.code ?? null);
  if (!halted) fail('the page should stop on the fault (9.2)');
  const after = await page.evaluate(() => window.hsvg.play(null, 'nod'));
  if (after?.ignored !== 'stopped') fail(`after a stop the hooks do nothing: ${JSON.stringify(after)}`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
} catch (e) {
  fail(`${e.name}: ${e.message}`);
} finally {
  await browser?.close();
  fs.rmSync(work, { recursive: true, force: true });
}
log(problems.length ? `k2g-hooks-browser: ${problems.length} problem(s)` : 'k2g-hooks-browser: ok');
process.exit(problems.length ? 1 : 0);
