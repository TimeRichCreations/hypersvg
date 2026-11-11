// Spoken lines in a packed page (6.11, 10.1). Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/lines-browser.mjs
// It packs tests/lines-fixture (a parrot that says two lines, in English and Spanish) and opens it from file:// with a
// manual clock. A real click on "Say hello" makes the scene fire the parrot's say trigger; the parrot speaks for
// itself. Checked: the default caption box (a polite live region) shows the line, follows its words and goes away at
// its end; the parrot's own beak shows the cue looks; muted, the captions and the beak still run; in Spanish the
// Spanish text and timing; with voice on, the line's recording plays and the line follows its position; a copy with a
// shell shows the captions over the shell's captions overlay slot. No request leaves the page.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const fixture = path.join(here, '..', 'lines-fixture');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-lines-'));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };

// A copy of the fixture with a shell whose overlay slot `captions` sits at the top of the screen.
function withShell(dir) {
  fs.cpSync(fixture, dir, { recursive: true });
  const e = JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8'));
  e.needs = ['lines']; e.shell = 'shell/frame.json'; // the shell's slots are core (D31.2)
  fs.writeFileSync(path.join(dir, 'experience.json'), JSON.stringify(e, null, 2));
  fs.mkdirSync(path.join(dir, 'shell'));
  fs.writeFileSync(path.join(dir, 'shell', 'frame.json'), JSON.stringify({
    format: 'hsvg/2.0', kind: 'shell', id: 'frame', drawing: 'frame.svg',
    slots: { stage: { kind: 'stage', label: 'Stage' }, captions: { kind: 'overlay', passThrough: true } },
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'shell', 'frame.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 360" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Frame</title><rect width="400" height="360" fill="#ddd" data-hsvg-layer="backdrop"/><rect id="caption-box" x="0" y="0" width="400" height="60" fill="none" data-hsvg-slot="captions" data-hsvg-kind="part"/><rect id="stage-box" x="0" y="60" width="400" height="300" fill="none" data-hsvg-slot="stage" data-hsvg-kind="part"/></svg>');
}

const caption = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-hsvg-captions]');
  if (!el || el.hidden) return null;
  const b = el.getBoundingClientRect(); const c = document.getElementById('stage').getBoundingClientRect();
  return { text: el.textContent, line: el.getAttribute('data-hsvg-line'), word: Number(el.getAttribute('data-hsvg-word')), where: el.getAttribute('data-hsvg-captions'), live: el.getAttribute('aria-live'), top: b.top - c.top, bottom: c.bottom - b.bottom };
});
const beak = (page) => page.evaluate(() => [...document.querySelectorAll('[id$="talk__polly__beak"] > [data-hsvg-variant], [id$="beak"] > [data-hsvg-variant]')].filter(g => getComputedStyle(g).display !== 'none').map(g => g.getAttribute('data-hsvg-variant'))[0] || null);
const advance = (page, ms) => page.evaluate((m) => window.hsvg.advance(m), ms);

let browser;
try {
  const r = await pack(fixture, path.join(out, 'plain'), { test: true });
  const shellDir = path.join(out, 'shell-src'); withShell(shellDir);
  const r2 = await pack(shellDir, path.join(out, 'shell'), { test: true });
  browser = await chromium.launch({ ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), args: ['--autoplay-policy=no-user-gesture-required'] });
  const open = async (htmlPath) => {
    const page = await browser.newPage({ viewport: { width: 600, height: 500 }, deviceScaleFactor: 1 });
    const errs = []; const requests = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('request', q => requests.push(q.url()));
    await page.goto(pathToFileURL(htmlPath).href + '?clock=manual');
    await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
    const err = await page.evaluate(() => window.hsvgError || null);
    want(!err, `the packed page starts${err ? `: ${err}` : ''}`);
    return { page, errs, requests };
  };

  // ---- silent timing, the default caption box, the mouth ----
  const { page, errs, requests } = await open(r.htmlPath);
  want(await caption(page) === null, 'no caption before a line');
  await page.click('[id$="hello-btn"]');
  await advance(page, 0);
  let c = await caption(page);
  want(c && c.text === 'Hello there, friend!' && c.line === 'hello' && c.word === 0, `the caption shows the line and its first word (${JSON.stringify(c)})`);
  want(c && c.where === 'default' && c.live === 'polite' && Math.abs(c.bottom) < 1, 'with no shell, the default box sits on the bottom edge as a polite live region');
  await advance(page, 100);
  want(await beak(page) === 'wide', `the parrot's own beak shows the cue look (C: wide), got ${await beak(page)}`);
  await advance(page, 350);
  c = await caption(page);
  want(c && c.word === 1, `the caption follows the words (word ${c?.word})`);
  await advance(page, 200); // 650 + 20 lead: E
  want(await beak(page) === 'round', 'the beak follows the cues (E: round)');
  await advance(page, 700);
  want(await caption(page) === null, 'the caption goes when the line ends');
  want(await beak(page) === 'shut', 'the beak returns to its drawn rest look');
  const stresses = await page.evaluate(() => window.hsvg.player.state.blocks.talk.values.stresses);
  want(stresses === 1, `the word event reached the scene (${stresses})`);

  // ---- muted ----
  await page.evaluate(() => { const p = window.hsvg.player; p.applySettings([['muted', true]], 'widget'); });
  await page.click('[id$="bye-btn"]');
  await advance(page, 10);
  c = await caption(page);
  want(c && c.text === 'See you soon.', 'muted, the captions still show');
  want(await beak(page) === 'shut', 'a line with no cues holds the rest look');
  await advance(page, 1000);
  want(await caption(page) === null, 'muted, the line still ends on time');

  // ---- another language ----
  await page.evaluate(() => { const p = window.hsvg.player; p.transaction('host', () => { p.state.ambient.language = 'es'; p.queueAll('changed:language'); }); p.applySettings([['muted', false]], 'widget'); });
  await page.click('[id$="hello-btn"]');
  await advance(page, 0);
  c = await caption(page);
  want(c && c.text === '¡Hola, amigo mío!', `in Spanish the Spanish caption (${c?.text})`);
  await advance(page, 1550);
  want(!!(await caption(page)), 'the Spanish voice times the line (1600 ms)');
  await advance(page, 100);
  want(await caption(page) === null, 'and it ends after them');

  // ---- voice on: the recording plays and the line follows it ----
  await page.evaluate(() => { const p = window.hsvg.player; p.transaction('host', () => { p.state.ambient.language = 'en'; p.queueAll('changed:language'); }); p.applySettings([['voice', true]], 'widget'); });
  await page.click('[id$="hello-btn"]');
  await page.waitForFunction(() => window.hsvg.audio.lines.some(l => l.state === 'playing'), null, { timeout: 5000 }).catch(() => {});
  // The manual engine clock does not move; the recording does. Wait (up to 3 s of real time) for it to pass word 1's
  // start (400 ms): a slow machine can take a while to start the audio.
  for (let k = 0; k < 20; k++) {
    await page.waitForTimeout(150);
    await advance(page, 0);
    if ((await caption(page))?.word >= 1) break;
  }
  const lines = await page.evaluate(() => window.hsvg.audio.lines.slice());
  c = await caption(page);
  want(lines.length === 1 && ['playing', 'ended'].includes(lines[0].state), `with voice on, the recording plays (${JSON.stringify(lines)})`);
  want(c && c.word >= 1, `the line follows the recording's position, not the stopped clock (word ${c?.word})`);
  await page.waitForFunction(() => window.hsvg.audio.lines.every(l => l.state === 'ended'), null, { timeout: 5000 }).catch(() => {});
  await advance(page, 0);
  want(await caption(page) === null, 'the line ends with its recording');

  want(requests.every(u => /^(file|data|blob):/i.test(u)), 'no request outside file:, data: and blob:');
  want(!errs.length, `no page errors (${errs.join(' | ')})`);
  const errors = await page.evaluate(() => window.hsvg.errors.slice());
  want(!errors.length, `no engine errors (${errors.join(' | ')})`);
  await page.close();

  // ---- a shell with a captions overlay slot ----
  const s = await open(r2.htmlPath);
  await s.page.click('[id$="hello-btn"]');
  await advance(s.page, 0);
  c = await caption(s.page);
  want(c && c.where === 'slot' && c.text === 'Hello there, friend!', `the shell's captions overlay slot shows the caption (${JSON.stringify(c)})`);
  const slotTop = await s.page.evaluate(() => { const a = document.querySelector('[data-hsvg-slot="captions"]').getBoundingClientRect(); const b = document.querySelector('[data-hsvg-captions]').getBoundingClientRect(); return Math.abs(a.top - b.top) + Math.abs(a.height - b.height); });
  want(slotTop < 1, `the caption covers the slot's drawn box (off by ${slotTop})`);
  want(!s.errs.length, `no page errors in the shell copy (${s.errs.join(' | ')})`);
} catch (e) {
  problems.push(String(e?.stack || e));
  console.log(e);
} finally {
  await browser?.close();
  fs.rmSync(out, { recursive: true, force: true });
}
console.log(problems.length ? `lines browser run: FAIL (${problems.length})` : 'lines browser run: pass');
process.exit(problems.length ? 1 : 0);
