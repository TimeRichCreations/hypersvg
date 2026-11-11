// K2d: the doors of D39 and D40 in a real browser. Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/k2d-doors-browser.mjs
// 1. D39: the doors example (two outside add-ons) is copied outside the engine, pinned and packed with --allow. The
//    wind stepper (an add-on control kind) is found by its role and name, read by its value text and stepped with the
//    arrow key; the flag (an add-on channel in a binding) and the pennant (the same channel in a clip track) turn.
// 2. D40: a small page with a picture place is packed; the host hands in a real PNG with player.picture, and the
//    place shows it (the browser decodes it). An SVG is refused. Every request must be file:, data: or blob:.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';
import { pin } from '../../tools/addon.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.resolve(here, '..', '..', 'addons', 'examples');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const browserType = pw[process.env.PW_BROWSER || 'chromium'];

const log = (m) => console.log(m);
const problems = [];
const fail = (m) => { problems.push(m); log(`  problem: ${m}`); };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k2d-'));

// A real PNG of w x h pixels, all one colour.
function png(w, h, [r, g, b]) {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = table[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.concat([Buffer.from(type, 'ascii'), data]); const out = Buffer.alloc(8 + data.length + 4); out.writeUInt32BE(data.length, 0); t.copy(out, 4); out.writeUInt32BE(crc(t), 8 + data.length); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rows.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const FRAME = {
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'frame', language: 'en',
    inputs: { photo: { kind: 'content', type: 'string', contentType: 'picture', maxLength: 48, initial: 'drawn' } },
    story: { start: 'wall', scenes: { wall: 'scenes/wall/scene.json' }, ends: ['wall'] } },
  'scenes/wall/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'wall', drawing: 'wall.svg', bindings: [{ target: 'photo', variant: 'photo', as: 'picture' }, { target: 'photo', label: 'A photo the host hands in' }] },
  'scenes/wall/wall.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Frame</title><rect width="200" height="200" fill="#eeeeee" data-hsvg-layer="backdrop"/><image id="photo" data-hsvg-kind="part" x="20" y="20" width="160" height="120" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,iVBORw0KGgo="/></svg>',
};

async function open(browser, htmlPath) {
  const page = await browser.newPage({ viewport: { width: 500, height: 400 }, deviceScaleFactor: 1 });
  const errors = []; const requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', q => requests.push(q.url()));
  await page.goto(pathToFileURL(htmlPath).href + '?clock=manual');
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.hsvgError || null);
  if (err) throw new Error(`the page did not start: ${err}`);
  return { page, errors, requests };
}
const after = async ({ page, errors, requests }, what) => {
  const engineErrors = await page.evaluate(() => window.hsvg.errors.slice());
  if (engineErrors.length) fail(`${what}: engine errors: ${engineErrors.join(' | ')}`);
  if (errors.length) fail(`${what}: page errors: ${errors.join(' | ')}`);
  const outside = requests.filter(u => !/^(file|data|blob):/.test(u));
  if (outside.length) fail(`${what}: requests outside the page: ${outside.join(', ')}`);
};

let browser;
try {
  browser = await browserType.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});

  // ---- 1. D39: the doors example ----
  fs.cpSync(path.join(examples, 'addons'), path.join(work, 'addons'), { recursive: true });
  fs.cpSync(path.join(examples, 'doors'), path.join(work, 'doors'), { recursive: true });
  await pin(path.join(work, 'doors'));
  const r = await pack(path.join(work, 'doors'), path.join(work, 'out-doors'), { test: true, allow: ['example.steps', 'example.sway'] });
  log(`packed ${r.id}: ${r.bytes} bytes`);
  const doors = await open(browser, r.htmlPath);
  const { page } = doors;
  const turn = (id) => page.evaluate((x) => { const m = /rotate\(([-\d.e]+)\)/.exec((document.getElementById(x) || document.querySelector(`[id$="__${x}"]`))?.getAttribute('transform') || ''); return m ? Number(m[1]) : 0; }, id);
  const wind = page.getByRole('spinbutton', { name: 'Wind' });
  if (await wind.count() !== 1) fail('the add-on control should be one spinbutton named Wind');
  const text0 = await wind.getAttribute('aria-valuetext');
  log(`the stepper says: ${text0}; aria-valuenow ${await wind.getAttribute('aria-valuenow')} of ${await wind.getAttribute('aria-valuemax')}`);
  if (text0 !== '1 of 5') fail(`the access hook's value text should be "1 of 5": "${text0}"`);
  if (await wind.getAttribute('tabindex') !== '0') fail('the add-on control should take a tab stop');
  const flag0 = await turn('yard__flag');
  if (Math.abs(flag0 - 4) > 1e-6) fail(`the flag should turn 4 degrees at wind 1: ${flag0}`);
  await wind.focus();
  await page.keyboard.press('ArrowUp');
  await page.evaluate(() => window.hsvg.advance(20));
  const text1 = await wind.getAttribute('aria-valuetext');
  const flag1 = await turn('yard__flag');
  log(`after ArrowUp: ${text1}; the flag turns ${flag1}`);
  if (text1 !== '2 of 5') fail(`ArrowUp should step the wind to 2: "${text1}"`);
  if (Math.abs(flag1 - 8) > 1e-6) fail(`the flag should turn 8 degrees at wind 2: ${flag1}`);
  await wind.click();
  await page.evaluate(() => window.hsvg.advance(20));
  if (await wind.getAttribute('aria-valuetext') !== '3 of 5') fail('a click should step the wind up');
  await page.getByRole('button', { name: 'Gust' }).click();
  await page.evaluate(() => window.hsvg.advance(300));
  const pennant = await turn('yard__pennant');
  log(`the pennant at 300 ms into the gust: ${pennant}`);
  if (Math.abs(pennant - 20) > 1e-6) fail(`the clip track should swing the pennant to 20 degrees: ${pennant}`);
  await after(doors, 'doors');
  await page.close();

  // ---- 2. D40: a host picture ----
  const dir = path.join(work, 'frame');
  for (const [f, v] of Object.entries(FRAME)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v, null, 2)); }
  const f = await pack(dir, path.join(work, 'out-frame'), { test: true });
  const framed = await open(browser, f.htmlPath);
  const bytes = [...png(4, 3, [214, 69, 61])];
  const res = await framed.page.evaluate(async (list) => {
    const href = () => document.querySelector('[id$="wall__photo"]').getAttribute('href');
    const before = href();
    window.hsvg.host.picture('photo', new Uint8Array(list), 'image/png');
    window.hsvg.advance(20);
    await new Promise(r => setTimeout(r, 50));
    const now = href();
    const img = new Image(); img.src = now;
    let size = null; try { await img.decode(); size = [img.naturalWidth, img.naturalHeight]; } catch (e) { size = String(e); }
    let svg = 'taken';
    try { window.hsvg.host.picture('photo', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml'); } catch (e) { svg = e.code; }
    return { before: before.slice(0, 40), now: now.slice(0, 40), changed: before !== now, size, svg, read: window.hsvg.host.read('photo') };
  }, bytes);
  log(`the picture place: ${JSON.stringify(res)}`);
  if (!res.changed || !res.now.startsWith('data:image/png;base64,')) fail('the picture place should show the handed-in PNG');
  if (JSON.stringify(res.size) !== '[4,3]') fail(`the browser should decode the picture as 4 x 3: ${res.size}`);
  if (res.svg !== 'E-HOST-PICTURE') fail(`an SVG should be refused with E-HOST-PICTURE: ${res.svg}`);
  if (res.read !== 'host:photo') fail(`the input should name the host picture: ${res.read}`);
  await after(framed, 'frame');
} catch (e) {
  fail(e.stack || String(e));
} finally {
  await browser?.close();
  fs.rmSync(work, { recursive: true, force: true });
}
log(problems.length ? `k2d-doors-browser: ${problems.length} problem(s)` : 'k2d-doors-browser: ok');
process.exit(problems.length ? 1 : 0);
