// The preview page (engine/v2/tools/preview.mjs) in a real browser, from file://. Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/preview-browser.mjs
// Checks: the kit ads' family page shows each ad at its own size, side by side, each with its own layout; the layout
// fixture's page shows its four sizes; its free slot, resized by dragging the handle with the mouse, makes the ad
// choose its frame again (160x600, 728x90) and keeps its value; the arrow keys resize the slot too; no request
// beyond file:, data:, blob: and about:; no faults.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { preview } from '../../tools/preview.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-preview-run-'));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const ads = ['ad-300x250', 'ad-728x90', 'ad-160x600'].map(a => path.join(repo, 'examples', '2.0-kit-ads', 'ads', a));
const family = await preview(ads, path.join(tmp, 'family'));
const layout = await preview([path.join(repo, 'engine', 'v2', 'tests', 'layout-fixture')], path.join(tmp, 'layout'));
want(family.members.map(m => m.sizes.map(s => `${s.width}x${s.height}`).join()).join(' ') === '300x250 728x90 160x600', 'the family page lists each ad at its size');

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
// Opens a preview page; returns the page and its frames once every player is ready.
async function open(htmlPath, count) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1900 }, deviceScaleFactor: 1 });
  const requests = []; const errors = [];
  page.on('request', q => requests.push(q.url()));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(htmlPath).href);
  const deadline = Date.now() + 60000;
  let ready = [];
  while (Date.now() < deadline) {
    ready = [];
    for (const f of page.frames().slice(1)) { try { if (await f.evaluate(() => window.hsvgReady === true || !!window.hsvgError)) ready.push(f); } catch { /* loading */ } }
    if (ready.length >= count) break;
    await page.waitForTimeout(200);
  }
  return { page, requests, errors, frames: ready };
}
const state = (f) => f.evaluate(() => { const h = window.hsvg; const sc = h.player.scene; return { error: window.hsvgError || null, layout: h.drawing.frames[sc]?.layout, why: h.choices[sc]?.why, w: innerWidth, h: innerHeight, label: document.querySelector(`[id$="${sc}__label"]`)?.textContent ?? null, taps: h.player.state.blocks[sc]?.values.taps, faults: [...h.errors, ...h.drawing.faults.map(x => x.message)] }; });
try {
  {
    const { page, requests, errors, frames } = await open(family.htmlPath, 4);
    const seen = [];
    for (const f of frames) { const el = await f.frameElement(); seen.push({ size: await el.getAttribute('data-size'), free: (await el.getAttribute('id')) === 'free', ...(await state(f)) }); }
    console.log(JSON.stringify(seen));
    const fixed = seen.filter(s => !s.free);
    want(fixed.length === 3, 'three frames, one per ad');
    for (const [size, layoutId] of [['300x250', 'rectangle'], ['728x90', 'leaderboard'], ['160x600', 'skyscraper']]) {
      const s = fixed.find(x => x.size === size);
      want(s && s.layout === layoutId && `${s.w}x${s.h}` === size && !s.error, `the ${size} ad shows ${layoutId} in a ${size} frame`);
    }
    const boxes = await page.evaluate(() => [...document.querySelectorAll('iframe[data-size]')].map(f => { const b = f.getBoundingClientRect(); return [b.width, b.height, Math.round(b.top)]; }));
    want(boxes[0][2] === boxes[1][2], 'the members sit side by side');
    want(!seen.some(s => s.faults.length) && !errors.length, 'no faults on the family page');
    const bad = requests.filter(u => !/^(file|data|blob|about):/.test(u));
    want(!bad.length, `no network requests${bad.length ? `: ${bad.join(', ')}` : ''}`);
    await page.close();
  }
  {
    const { page, requests, errors, frames } = await open(layout.htmlPath, 5);
    want(frames.length === 5, 'the layout fixture: four sizes and the free slot');
    const sizes = [];
    let free = null;
    for (const f of frames) { const el = await f.frameElement(); if ((await el.getAttribute('id')) === 'free') free = f; else { const s = await state(f); sizes.push(`${s.label}/${s.why}`); } }
    want(sizes.join() === '300x250/size,160x600/size,728x90/size,320x50/size', `each size shows its own drawing: ${sizes.join()}`);
    let s = await state(free);
    want(s.label === '300x250' && s.why === 'size', 'the free slot starts at 300x250');
    await free.evaluate(() => { window.hsvg.press('ad', 'tap'); });
    // Drag the handle: from 300x250 to 160x600, then to 728x90.
    const dragTo = async (w, h) => {
      await page.locator('#handle').scrollIntoViewIfNeeded();
      const b = await page.evaluate(() => { const r = document.getElementById('handle').getBoundingClientRect(); const s = document.getElementById('slot').getBoundingClientRect(); return { hx: r.x + r.width / 2, hy: r.y + r.height / 2, sw: s.width, sh: s.height }; });
      await page.mouse.move(b.hx, b.hy); await page.mouse.down();
      await page.mouse.move(b.hx + (w - b.sw) / 2, b.hy + (h - b.sh) / 2);
      await page.mouse.move(b.hx + w - b.sw, b.hy + h - b.sh); await page.mouse.up();
      await free.waitForFunction(([w2, h2]) => innerWidth === w2 && innerHeight === h2, [w, h], { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(100);
      return state(free);
    };
    s = await dragTo(160, 600);
    console.log(JSON.stringify(s));
    want(s.w === 160 && s.h === 600 && s.label === '160x600' && s.why === 'size' && s.taps === 1, 'dragged to 160x600: the ad chooses its skyscraper, its value kept');
    s = await dragTo(728, 90);
    want(s.label === '728x90' && s.why === 'size' && s.taps === 1, 'dragged to 728x90: the leaderboard');
    s = await dragTo(400, 300);
    want(s.label === '300x250' && s.why === 'nearest', 'an odd slot (400x300) shows the nearest aspect, scaled');
    await page.locator('#handle').scrollIntoViewIfNeeded();
    await page.focus('#handle');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    const readout = await page.evaluate(() => document.getElementById('readout').textContent);
    want(readout === '390 × 290', `the arrow keys resize the slot (${readout})`);
    await page.click('[data-preset="160x600"]');
    await free.waitForFunction(() => innerWidth === 160 && innerHeight === 600, null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(100);
    want((await state(free)).label === '160x600', 'a preset button sizes the slot');
    const bad = requests.filter(u => !/^(file|data|blob|about):/.test(u));
    want(!bad.length && !errors.length && !(await state(free)).faults.length, 'no requests, no faults');
    await page.close();
  }
} catch (e) { problems.push(e.message); } finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
for (const p of problems) console.log(`problem: ${p}`);
console.log(problems.length ? 'preview browser run: FAIL' : 'preview browser run: pass');
process.exit(problems.length ? 1 : 0);
