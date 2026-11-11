// Made sounds (audioSynths, D31.2) really play in a browser. Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/k2g-sound-browser.mjs
// A packed page with one button that plays a made tone and one that plays made noise. The page's Web Audio is watched
// (an init script wraps AudioContext): before any gesture nothing sounds; after a real click on each button, each
// sound's node is started and its stop is scheduled after its start. A made sound used to stay silent because its
// stop() came before its start(), which Web Audio refuses.
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
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-sound-'));

const FILES = {
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'chimes', language: 'en',
    audioSynths: { tone: { wave: 'triangle', from: 660, to: 880, durationMs: 120, gain: 0.4 }, hiss: { wave: 'noise', from: 100, to: 100, durationMs: 150, gain: 0.2 } },
    story: { start: 'chimes', scenes: { chimes: 'chimes.json' }, endless: true } },
  'chimes.json': { format: 'hsvg/2.0', kind: 'scene', id: 'chimes', drawing: 'chimes.svg',
    controls: { ding: { kind: 'button', target: 'ding', label: 'Ding', event: 'ding' }, shh: { kind: 'button', target: 'shh', label: 'Hiss', event: 'shh' } },
    on: { ding: [{ actions: [{ play: "'tone'", as: 'sound' }] }], shh: [{ actions: [{ play: "'hiss'", as: 'sound' }] }] } },
  'chimes.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Chimes</title>'
    + '<rect width="400" height="200" fill="#1d2b36" data-hsvg-layer="backdrop"/>'
    + '<g data-hsvg-layer="content"><g id="ding" data-hsvg-kind="part"><rect x="40" y="60" width="140" height="80" rx="20" fill="#2f80ed"/></g>'
    + '<g id="shh" data-hsvg-kind="part"><rect x="220" y="60" width="140" height="80" rx="20" fill="#d84315"/></g></g></svg>',
};

let browser;
try {
  const dir = path.join(work, 'chimes');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(FILES)) fs.writeFileSync(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body, null, 1));
  const r = await pack(dir, path.join(work, 'out'));
  log(`packed ${r.id}: ${r.bytes} bytes`);
  browser = await browserType.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: 400, height: 200 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const seen = window.__sound = { tones: 0, tonesStarted: 0, noises: 0, noisesStarted: 0, stopBeforeStart: 0 };
    const watch = (proto, made, started) => {
      const start = proto.start, stop = proto.stop;
      proto.start = function (...a) { this.__started = true; seen[started]++; return start.apply(this, a); };
      proto.stop = function (...a) { if (!this.__started) seen.stopBeforeStart++; return stop.apply(this, a); };
    };
    watch(OscillatorNode.prototype, 'tones', 'tonesStarted');
    watch(AudioBufferSourceNode.prototype, 'noises', 'noisesStarted');
    const P = (window.AudioContext || window.webkitAudioContext).prototype;
    const osc = P.createOscillator, src = P.createBufferSource;
    P.createOscillator = function (...a) { seen.tones++; return osc.apply(this, a); };
    P.createBufferSource = function (...a) { seen.noises++; return src.apply(this, a); };
  });
  await page.goto(pathToFileURL(path.join(work, 'out', `${r.id}.html`)).href);
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.hsvgError || null);
  if (err) throw new Error(`the page did not start: ${err}`);

  const before = await page.evaluate(() => ({ ...window.__sound }));
  if (before.tonesStarted || before.noisesStarted) fail(`nothing sounds before a gesture: ${JSON.stringify(before)}`);
  await page.mouse.click(110, 100); // Ding: a trusted gesture
  await page.waitForTimeout(400);
  await page.mouse.click(290, 100); // Hiss
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ ...window.__sound }));
  log(`after two clicks: ${JSON.stringify(after)}`);
  if (!(after.tones >= 1 && after.tonesStarted >= 1)) fail(`the made tone should start its oscillator: ${JSON.stringify(after)}`);
  if (!(after.noises >= 1 && after.noisesStarted >= 1)) fail(`the made noise should start its buffer source: ${JSON.stringify(after)}`);
  if (after.stopBeforeStart) fail(`a sound's stop came before its start ${after.stopBeforeStart} time(s): it stays silent`);
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
} catch (e) {
  fail(`${e.name}: ${e.message}`);
} finally {
  await browser?.close();
  fs.rmSync(work, { recursive: true, force: true });
}
log(problems.length ? `k2g-sound-browser: ${problems.length} problem(s)` : 'k2g-sound-browser: ok');
process.exit(problems.length ? 1 : 0);
