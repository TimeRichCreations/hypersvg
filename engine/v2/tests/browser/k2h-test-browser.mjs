// The test tool's new browser checks, each on a fixture. Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/k2h-test-browser.mjs
// - T-TEXT-CLIPPED: a text that leaves its drawing's view box is found on the wide and the phone pass; the lamp as it
//   is gives none.
// - T-SOUND-SILENT: a press that plays a made sound whose node never starts is found (the page's start() is made to
//   do nothing, as the old stop-before-start bug did); the same page, working, gives none.
// - T-MOVES waits for the page to apply reduced motion: the lamp's measured drawing does not change after it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const { testOne } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'test.mjs')).href);
const B = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'test', 'browser-pass.mjs')).href);
const pw = B.playwright();
if (!pw) { console.log('k2h-test-browser: Playwright not found (PW_PATH)'); process.exit(1); }
const problems = [];
const fail = (m) => { problems.push(m); console.log(`  problem: ${m}`); };
const okay = (m) => console.log(`ok   ${m}`);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k2h-test-'));
const opts = (extra = {}) => ({ kits: {}, allow: [], thresholds: {}, browsers: ['chromium'], shots: false, out: path.join(work, 'out'), ...extra });
const codes = (rep, code) => rep.findings.filter(f => f.code === code);

let browser;
try {
  browser = await B.launch(pw, 'chromium');
  // ---------- T-TEXT-CLIPPED ----------
  const lamp = path.join(work, 'lamp');
  fs.cpSync(path.join(repo, 'docs', 'guide', 'examples', 'lamp'), lamp, { recursive: true });
  const clean = await testOne(lamp, opts({ quick: true, minWidth: 390 }), { chromium: browser });
  if (codes(clean, 'T-TEXT-CLIPPED').length) fail(`the lamp as it is: ${JSON.stringify(codes(clean, 'T-TEXT-CLIPPED'))}`); else okay('the lamp has no clipped text');
  const svg = path.join(lamp, 'lamp.svg');
  const viewBox = /viewBox="([^"]+)"/.exec(fs.readFileSync(svg, 'utf8'))[1].split(/\s+/).map(Number);
  fs.writeFileSync(svg, fs.readFileSync(svg, 'utf8').replace('</svg>', `<text x="${viewBox[0] + viewBox[2] - 20}" y="${viewBox[1] + 30}" font-size="24">A note that runs off the edge</text></svg>`));
  const cut = await testOne(lamp, opts({ quick: true, minWidth: 390 }), { chromium: browser });
  const found = codes(cut, 'T-TEXT-CLIPPED');
  for (const layout of ['wide', 'phone']) {
    if (!found.some(f => f.layout === layout && f.severity === 'error')) fail(`T-TEXT-CLIPPED on the ${layout} pass: ${JSON.stringify(found)}`);
    else okay(`T-TEXT-CLIPPED on the ${layout} pass`);
  }
  // ---------- T-SOUND-SILENT ----------
  const chimes = path.join(work, 'chimes');
  fs.mkdirSync(chimes);
  const FILES = {
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'chimes', language: 'en', about: { title: 'Chimes' },
      audioSynths: { tone: { wave: 'triangle', from: 660, to: 880, durationMs: 120, gain: 0.4 } },
      story: { start: 'chimes', scenes: { chimes: 'chimes.json' }, endless: true } },
    'chimes.json': { format: 'hsvg/2.0', kind: 'scene', id: 'chimes', drawing: 'chimes.svg',
      controls: { ding: { kind: 'button', target: 'ding', label: 'Ding', event: 'ding' } },
      on: { ding: [{ actions: [{ play: "'tone'", as: 'sound' }] }] } },
    'chimes.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Chimes</title>'
      + '<rect width="400" height="200" fill="#1d2b36" data-hsvg-layer="backdrop"/>'
      + '<g data-hsvg-layer="content"><g id="ding" data-hsvg-kind="part"><rect x="120" y="40" width="160" height="120" rx="20" fill="#2f80ed"/></g></g></svg>',
  };
  for (const [n, b] of Object.entries(FILES)) fs.writeFileSync(path.join(chimes, n), typeof b === 'string' ? b : JSON.stringify(b, null, 1));
  const working = await testOne(chimes, opts(), { chromium: browser });
  if (codes(working, 'T-SOUND-SILENT').length) fail(`the working chimes: ${JSON.stringify(codes(working, 'T-SOUND-SILENT'))}`); else okay('a sound that starts gives no T-SOUND-SILENT');
  const k = await pack(chimes, path.join(work, 'packed'), { test: true });
  // A browser whose pages never start an oscillator (its start does nothing), as a player bug would leave it.
  const broken = { newContext: async (o) => { const ctx = await browser.newContext(o); await ctx.addInitScript(() => { OscillatorNode.prototype.start = function () {}; }); return ctx; } };
  const r = await B.layoutPass(broken, 'chromium', k.htmlPath, [{ id: 'chimes', actions: [] }], 'wide', { thresholds: {}, quickOnly: false, shots: null, name: 'chimes' });
  const silent = r.findings.filter(f => f.code === 'T-SOUND-SILENT');
  if (!silent.length || silent[0].severity !== 'error') fail(`T-SOUND-SILENT when the node never starts: ${JSON.stringify(r.findings.map(f => f.code))}`); else okay(`T-SOUND-SILENT: ${silent[0].message}`);
  // ---------- T-MOVES: no late settle on a still lamp ----------
  fs.cpSync(path.join(repo, 'docs', 'guide', 'examples', 'lamp'), path.join(work, 'lamp2'), { recursive: true });
  const still = await testOne(path.join(work, 'lamp2'), opts(), { chromium: browser });
  if (codes(still, 'T-MOVES').length) fail(`the lamp under reduced motion: ${JSON.stringify(codes(still, 'T-MOVES'))}`); else okay('the lamp under reduced motion: no T-MOVES');
} catch (e) {
  fail(`${e.name}: ${e.message}`);
} finally {
  await browser?.close();
  fs.rmSync(work, { recursive: true, force: true });
}
console.log(problems.length ? `k2h-test-browser: ${problems.length} problem(s)` : 'k2h-test-browser: all checks pass');
process.exit(problems.length ? 1 : 0);
