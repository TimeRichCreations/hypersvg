// Motion in a real browser, on motion-fixture/files.mjs. Run alone (it starts a browser):
//   node engine/v2/tests/browser/motion-browser.mjs
// Checks, on a manual clock, in the scene's own coordinates:
// - route: the dot's centre is on the wire at the browser's own getPointAtLength (6.7);
// - points: the chart line is drawn in the plot box, and a real click adds a point (6.8);
// - fill: the lamp's colour is the blend half way, and gold at the end (6.7);
// - stop keep: the heart keeps its pose after a real click on freeze (6.7);
// - fade: onward fades scene one out over scene two, in place (a variant of the fixture).
// - slide: onward slides scene two in from the right and scene one out to the left, the leaving copy takes no input;
//   back slides in from the left (slideFrom start); under reduced motion the link is a cut (3.2).
// Playwright must already be installed (PW_PATH; PW_CHANNEL).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture } from './motion-fixture/files.mjs';
import { files as shellFixture } from './shell-fixture/files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const files = Object.fromEntries(Object.entries(fixture).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
// The shell fixture with its link a-b as a slide: the scene slides inside the stage slot's box.
const shellFiles = Object.fromEntries(Object.entries(structuredClone(shellFixture)).map(([k, v]) => {
  if (k === 'experience.json') v.story.links = v.story.links.map(l => (l.id === 'a-b' ? { ...l, transition: 'slide', transitionMs: 400 } : l));
  return [k, typeof v === 'string' ? v : JSON.stringify(v)];
}));
// The fixture with its onward link as a fade (3.2): the old scene fades out over the new one, in place.
const fadeFiles = Object.fromEntries(Object.entries(structuredClone(fixture)).map(([k, v]) => {
  if (k === 'experience.json') v.story.links = v.story.links.map(l => (l.id === 'one-onward' ? { ...l, transition: 'fade', transitionMs: 400 } : l));
  return [k, typeof v === 'string' ? v : JSON.stringify(v)];
}));
const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/files.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(files)); }
  if (url.pathname === '/fade.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(fadeFiles)); }
  if (url.pathname === '/shell.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(shellFiles)); }
  if (url.pathname === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(schemas); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.mjs') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const problems = [];
const log = (m) => console.log(m);
const want = (cond, msg) => { if (!cond) problems.push(msg); };
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
const url = `http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`;

// A part's box in the drawing units of the scene <svg> shown now (the one not leaving).
const box = (page, id) => page.evaluate((id) => {
  const svg = [...document.querySelectorAll('#stage > svg')].find(s => !s.hasAttribute('data-player-leaving'));
  const el = (document.getElementById(id) || document.querySelector(`[id$="__${CSS.escape(id)}"]`)); if (!el) return null;
  const inv = svg.getScreenCTM().inverse(); const r = el.getBoundingClientRect();
  const a = new DOMPoint(r.left, r.top).matrixTransform(inv); const b = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
  return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
}, id);
const screenBox = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, sel);
const advance = (page, ms) => page.evaluate((ms) => window.hsvg.advance(ms), ms);
async function open(page) {
  await page.goto(url);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
}
const errorsOf = (page) => page.evaluate(() => [...window.hsvg.errors, ...window.hsvg.drawing.faults.map(f => `${f.code} ${f.message}`)]);
const click = async (page, id) => { const b = await screenBox(page, `[id$="${id}"]`); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };

try {
  {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    // ---------- route ----------
    await advance(page, 1000);
    const dot = await box(page, 'one__dot');
    const ref = await page.evaluate(() => { const w = document.querySelector('[id$="one__wire"]'); const p = w.getPointAtLength(w.getTotalLength() * 0.5); return { x: p.x, y: p.y }; });
    log(`route: dot ${dot.cx.toFixed(2)},${dot.cy.toFixed(2)}; the browser's point at half length ${ref.x.toFixed(2)},${ref.y.toFixed(2)}`);
    want(near(dot.cx, ref.x, 1) && near(dot.cy, ref.y, 1), 'the dot should sit on the wire at half its length');
    await advance(page, 500);
    const dot2 = await box(page, 'one__dot');
    const ref2 = await page.evaluate(() => { const w = document.querySelector('[id$="one__wire"]'); const p = w.getPointAtLength(w.getTotalLength() * 0.75); return { x: p.x, y: p.y }; });
    want(near(dot2.cx, ref2.x, 1) && near(dot2.cy, ref2.y, 1), `at 1.5 s the dot should be at three quarters: ${dot2.cx},${dot2.cy} against ${ref2.x},${ref2.y}`);
    // ---------- fill ----------
    const lamp = await page.evaluate(() => getComputedStyle(document.querySelector('[id$="one__lamp"]')).fill);
    log(`fill: the lamp at 1.5 s is ${lamp}`);
    want(lamp === 'rgb(230, 175, 66)', 'the lamp should be gold after its fade');
    // ---------- points ----------
    const plot = await box(page, 'one__plot');
    const line = await box(page, 'one__line');
    const pts = () => page.evaluate(() => document.querySelector('[id$="one__line"]').getAttribute('points').split(' ').length);
    log(`points: the line ${JSON.stringify(line)} in the plot ${JSON.stringify(plot)}; ${await pts()} points`);
    want(line.x >= plot.x - 2 && line.x + line.width <= plot.x + plot.width + 2 && line.y >= plot.y - 2 && line.y + line.height <= plot.y + plot.height + 2, 'the line should lie in the plot box');
    await click(page, 'one__sample');
    want(await pts() === 5, 'a real click on sample should add a point');
    // ---------- stop keep ----------
    const pulseAt = async () => (await box(page, 'one__heart')).width;
    const rest = 60; // the heart as drawn
    // the pulse is endless from entry; 250 ms into a lap the heart is at scale 1.25
    const lap = await page.evaluate(() => window.hsvg.player.state.now - window.hsvg.player.state.blocks.one.clips.pulse.startedAt);
    await advance(page, 1000 - (lap % 1000) + 250);
    const at = await pulseAt();
    await click(page, 'one__freeze');
    await advance(page, 400);
    const after = await pulseAt();
    log(`stop keep: drawn width ${rest}, at freeze ${at.toFixed(2)}, 400 ms later ${after.toFixed(2)}`);
    want(near(at / rest, 1.25, 0.02), 'the heart should be at scale 1.25 when frozen');
    want(near(after, at, 0.05), 'the frozen heart should keep its pose');
    // ---------- slide ----------
    await click(page, 'one__onward');
    const mid = async () => page.evaluate(() => {
      const svgs = [...document.querySelectorAll('#stage > svg')];
      const r = (s) => { const b = s.getBoundingClientRect(); return { x: b.x, scene: s.getAttribute('data-player-leaving') ? 'leaving' : 'shown', inert: s.hasAttribute('inert') }; };
      return { svgs: svgs.map(r), slide: window.hsvg.slide && { from: window.hsvg.slide.from, progress: window.hsvg.slide.progress }, scene: window.hsvg.player.scene };
    });
    const s0 = await mid();
    await advance(page, 200);
    const s1 = await mid();
    log(`slide at 0: ${JSON.stringify(s0)}`);
    log(`slide at 200 ms: ${JSON.stringify(s1)}`);
    const leaving = s1.svgs.find(x => x.scene === 'leaving'); const shown = s1.svgs.find(x => x.scene === 'shown');
    want(s1.scene === 'two' && s1.slide?.from === 'end', 'onward should slide scene two in from the end');
    want(leaving && near(leaving.x, -400, 2) && leaving.inert, `half way the leaving scene should be 400 px to the left and inert: ${JSON.stringify(leaving)}`);
    want(shown && near(shown.x, 400, 2), `half way the new scene should be 400 px to the right: ${JSON.stringify(shown)}`);
    // the leaving copy takes no input: a click where its onward button now is does nothing
    await page.mouse.click(700 - 400, 576);
    want((await page.evaluate(() => window.hsvg.player.scene)) === 'two', 'a click on the leaving copy does nothing');
    await advance(page, 250);
    const s2 = await mid();
    want(s2.svgs.length === 1 && !s2.slide && near(s2.svgs[0].x, 0, 1), `after 400 ms only scene two shows, in place: ${JSON.stringify(s2)}`);
    await click(page, 'two__back');
    await advance(page, 100);
    const s3 = await mid();
    log(`back at 100 ms: ${JSON.stringify(s3)}`);
    const shown3 = s3.svgs.find(x => x.scene === 'shown');
    want(s3.slide?.from === 'start' && shown3 && near(shown3.x, -600, 2), `back should slide scene one in from the left (slideFrom start): ${JSON.stringify(s3)}`);
    await advance(page, 400);
    const errs = await errorsOf(page);
    want(!errs.length && !pageErrors.length, `no errors: ${[...errs, ...pageErrors].join('; ')}`);
    await page.close();
  }
  // ---------- reduced motion: a cut ----------
  {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await click(page, 'one__onward');
    const s = await page.evaluate(() => ({ svgs: document.querySelectorAll('#stage > svg').length, slide: !!window.hsvg.slide, scene: window.hsvg.player.scene }));
    log(`reduced motion: ${JSON.stringify(s)}`);
    want(s.scene === 'two' && s.svgs === 1 && !s.slide, 'under reduced motion the slide is a cut');
    await page.close();
  }
  // ---------- fade ----------
  {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${url}&files=/fade.json`);
    await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
    await click(page, 'one__onward');
    await advance(page, 200);
    const f = await page.evaluate(() => {
      const svgs = [...document.querySelectorAll('#stage > svg')];
      return { scene: window.hsvg.player.scene, kind: window.hsvg.slide?.kind, svgs: svgs.map(x => ({ leaving: x.hasAttribute('data-player-leaving'), inert: x.hasAttribute('inert'), opacity: Number(getComputedStyle(x).opacity), x: x.getBoundingClientRect().x })) };
    });
    log(`fade at 200 ms: ${JSON.stringify(f)}`);
    const out = f.svgs.find(x => x.leaving); const inn = f.svgs.find(x => !x.leaving);
    want(f.scene === 'two' && f.kind === 'fade' && out && inn && near(out.opacity, 0.5, 0.05) && near(inn.opacity, 0.5, 0.05) && out.inert && near(out.x, inn.x, 1), `half way the fade shows both scenes in place at half opacity, the old one inert: ${JSON.stringify(f)}`);
    await advance(page, 250);
    const e = await page.evaluate(() => ({ n: document.querySelectorAll('#stage > svg').length, fade: !!window.hsvg.slide, opacity: getComputedStyle(document.querySelector('#stage > svg')).opacity }));
    want(e.n === 1 && !e.fade && e.opacity === '1', `after the fade only scene two shows, opaque: ${JSON.stringify(e)}`);
    want(!pageErrors.length, pageErrors.join('; '));
    await page.close();
  }
  // ---------- slide in a shell's stage slot ----------
  {
    const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${url}&files=/shell.json`);
    await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
    const stage = await page.evaluate(() => { const r = document.querySelector('[data-hsvg-slot="stage"]').getBoundingClientRect(); return { x: r.x, width: r.width }; });
    await page.evaluate(() => window.hsvg.press('a', 'next'));
    await advance(page, 200);
    const s = await page.evaluate(() => {
      const holder = document.querySelector('[data-player-stage]');
      const out = holder.querySelector('[data-player-leaving]'); const inn = holder.querySelector('svg[data-player-scene="b"]');
      return { clip: holder.getAttribute('clip-path'), out: out && out.getBoundingClientRect().x, inn: inn && inn.getBoundingClientRect().x, scene: window.hsvg.player.scene };
    });
    log(`shell slide at 200 ms: stage x ${stage.x.toFixed(1)} width ${stage.width.toFixed(1)}; ${JSON.stringify(s)}`);
    want(s.scene === 'b' && s.clip && near(s.out, stage.x - stage.width / 2, 2) && near(s.inn, stage.x + stage.width / 2, 2), 'in a shell, both scenes move half the stage width, clipped to the stage');
    await advance(page, 300);
    const e = await page.evaluate(() => { const holder = document.querySelector('[data-player-stage]'); return { kids: holder.children.length, clip: holder.getAttribute('clip-path') }; });
    want(e.kids === 1 && !e.clip, `after the slide the stage holds the new scene only: ${JSON.stringify(e)}`);
    want(!pageErrors.length, pageErrors.join('; '));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
for (const p of problems) console.log(`FAIL ${p}`);
console.log(problems.length ? `motion browser run: ${problems.length} problems` : 'motion browser run: pass');
process.exit(problems.length ? 1 : 0);
