// The host's mute (experimental, added for 2.0.0-next.2) in a real browser. Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/host-mute-browser.mjs
// A made tone (audioSynths) on a button, packed as a HyperSVG. The page's Web Audio is watched (an init script wraps
// it): the level a sound reaches the speakers with is the product of the gains on its way from its oscillator to the
// destination. Checks:
// - play() with muted: true: the first press starts no audible sound (level 0);
// - host.mute(true) while a sound plays silences it at once; host.mute(false) lets it and the next sound play;
// - the person's mute (a drawn control, player.setting) stays: host.mute(false) does not unmute it;
// - host.mute() on a piece without sound does nothing and does not throw;
// - the same through mount() of asset-web.mjs, mountAsync() of asset-lean.mjs and mountAsync() of both one-file
//   players (hypersvg-asset-lean.js, hypersvg-asset.js); muted at mount through them is checked once asset-lean.mjs
//   forwards muted to play() (until then the run says "pending").
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { packAsset } from '../../tools/pack.mjs';
import { loadSchemas } from '../../schema/load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const browserType = pw[process.env.PW_BROWSER || 'chromium'];
const log = (m) => console.log(m);
const problems = [];
const fail = (m) => { problems.push(m); log(`  problem: ${m}`); };
const check = (cond, m) => { if (cond) log(`  ok: ${m}`); else fail(m); };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-host-mute-'));

const svg = (body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Chime</title>'
  + `<rect width="300" height="100" fill="#1d2b36" data-hsvg-layer="backdrop"/><g data-hsvg-layer="content">${body}</g></svg>`;
const button = (id, x, fill) => `<g id="${id}" data-hsvg-kind="part"><rect x="${x}" y="20" width="80" height="60" rx="12" fill="${fill}"/></g>`;
const PIECES = {
  chime: {
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'chime', language: 'en',
      audioSynths: { tone: { wave: 'triangle', from: 660, to: 700, durationMs: 1500, gain: 0.5 } },
      story: { start: 'chime', scenes: { chime: 'chime.json' }, endless: true } },
    'chime.json': { format: 'hsvg/2.0', kind: 'scene', id: 'chime', drawing: 'chime.svg',
      controls: {
        ding: { kind: 'button', target: 'ding', label: 'Ding', event: 'ding' },
        hush: { kind: 'button', target: 'hush', label: 'Sound off', event: 'hush' },
        unhush: { kind: 'button', target: 'unhush', label: 'Sound on', event: 'unhush' },
      },
      on: {
        ding: [{ actions: [{ play: "'tone'", as: 'sound' }] }],
        hush: [{ actions: [{ call: 'player.setting', with: { muted: true } }] }],
        unhush: [{ actions: [{ call: 'player.setting', with: { muted: false } }] }],
      } },
    'chime.svg': svg(button('ding', 10, '#2f80ed') + button('hush', 110, '#888') + button('unhush', 210, '#3a3')),
  },
  quiet: {
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'quiet', language: 'en', story: { start: 'quiet', scenes: { quiet: 'quiet.json' }, endless: true } },
    'quiet.json': { format: 'hsvg/2.0', kind: 'scene', id: 'quiet', drawing: 'quiet.svg' },
    'quiet.svg': svg(''),
  },
};
const DING = { x: 50, y: 50 }; const HUSH = { x: 150, y: 50 }; const UNHUSH = { x: 250, y: 50 };

// The page: one slot of 300 x 100 px at the top left; window.start(kind, piece, opts) mounts it there.
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="slot" style="width:300px;height:100px"></div>
<script type="module">
import { play } from '/engine/v2/web/player-web.mjs';
import '/engine/v2/web/audio-web.mjs';
import { loadExperience } from '/engine/v2/src/load.mjs';
import { mount } from '/engine/v2/web/asset-web.mjs';
import { mountAsync } from '/engine/v2/web/asset-lean.mjs';
const oneFile = { 'onefile-lean': '/engine/v2/web/hypersvg-asset-lean.js', 'onefile-full': '/engine/v2/web/hypersvg-asset.js' };
const schemas = await fetch('/schemas.json').then(r => r.json());
const slot = document.getElementById('slot');
window.start = async (kind, piece, opts = {}) => {
  slot.replaceChildren(); window.errors = [];
  const onError = (d) => window.errors.push(d.code + ' ' + d.message);
  if (kind === 'play') {
    const files = await fetch('/piece/' + piece + '/files.json').then(r => r.json());
    const state = play(slot, { files, schemas, load: loadExperience, onError, ...opts });
    window.host = state.host;
  } else {
    const text = await fetch('/piece/' + piece + '.svg').then(r => r.text());
    if (oneFile[kind]) { const m = await import(oneFile[kind]); window.host = await m.mountAsync(slot, text, {}, { schemas, onError, ...opts }); }
    else window.host = kind === 'asset' ? mount(slot, text, {}, { schemas, onError, ...opts }) : await mountAsync(slot, text, {}, { schemas, onError, ...opts });
  }
  return true;
};
window.ready = true;
</script>`;

async function main() {
  const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
  const served = {};
  for (const [id, files] of Object.entries(PIECES)) {
    const dir = path.join(work, id);
    fs.mkdirSync(dir, { recursive: true });
    const text = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v, null, 1)]));
    for (const [k, v] of Object.entries(text)) fs.writeFileSync(path.join(dir, k), v);
    served[`/piece/${id}/files.json`] = JSON.stringify(text);
    const r = await packAsset(dir, path.join(work, 'out'));
    served[`/piece/${id}.svg`] = fs.readFileSync(r.svgPath, "utf8");
  }
  const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    if (url === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(schemas); return; }
    if (served[url]) { res.writeHead(200, { 'content-type': types[path.extname(url)] }); res.end(served[url]); return; }
    const file = path.join(repo, ...url.split('/').filter(Boolean));
    if (!file.startsWith(repo) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await browserType.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  try {
    const leanForwards = /\bmuted\b/.test(fs.readFileSync(path.join(repo, 'engine', 'v2', 'web', 'asset-lean.mjs'), 'utf8'));
    for (const kind of ['play', 'asset', 'lean', 'onefile-lean', 'onefile-full']) await round(browser, base, kind, leanForwards);
  } finally {
    await browser.close();
    server.close();
  }
}

// One fresh page per mount kind, so each first press is the page's first gesture.
async function fresh(browser, base) {
  const page = await browser.newPage({ viewport: { width: 300, height: 100 }, deviceScaleFactor: 1 });
  page.pageErrors = [];
  page.on('pageerror', e => page.pageErrors.push(e.message));
  await page.addInitScript(() => {
    // Every connection between audio nodes, every oscillator and whether it ended.
    const edges = new Map(); const oscs = [];
    const C = AudioNode.prototype.connect; const D = AudioNode.prototype.disconnect;
    AudioNode.prototype.connect = function (to, ...a) { if (to instanceof AudioNode) { if (!edges.has(this)) edges.set(this, new Set()); edges.get(this).add(to); } return C.call(this, to, ...a); };
    AudioNode.prototype.disconnect = function (...a) { if (!a.length) edges.delete(this); else if (a[0] instanceof AudioNode) edges.get(this)?.delete(a[0]); return D.apply(this, a); };
    const P = AudioContext.prototype; const make = P.createOscillator;
    P.createOscillator = function (...a) { const o = make.apply(this, a); const rec = { o, started: false, ended: false }; oscs.push(rec); const s = o.start; o.start = function (...b) { rec.started = true; return s.apply(this, b); }; o.addEventListener('ended', () => { rec.ended = true; }); return o; };
    // The level an oscillator reaches the destination with: the largest product of gain values over its paths.
    const reach = (n, seen = new Set()) => {
      if (n instanceof AudioDestinationNode) return 1;
      if (seen.has(n)) return 0; seen.add(n);
      const own = n instanceof GainNode ? n.gain.value : 1;
      let best = 0; for (const t of edges.get(n) || []) best = Math.max(best, reach(t, seen));
      return own * best;
    };
    window.__audio = () => ({ oscillators: oscs.length, started: oscs.filter(r => r.started).length, playing: oscs.filter(r => r.started && !r.ended).length,
      level: Math.max(0, ...oscs.filter(r => r.started && !r.ended).map(r => reach(r.o))), contexts: 0 });
  });
  await page.goto(base);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  return page;
}
const audio = (page) => page.evaluate(() => window.__audio());
const settle = (page, ms = 250) => page.waitForTimeout(ms);
const click = (page, at) => page.mouse.click(at.x, at.y);
const hostMute = (page, on) => page.evaluate((v) => { try { if (v === undefined) window.host.mute(); else window.host.mute(v); return null; } catch (e) { return `${e.code} ${e.message}`; } }, on);

async function round(browser, base, kind, leanForwards) {
  log(`${{ play: 'play()', asset: 'mount() of asset-web.mjs', lean: 'mountAsync() of asset-lean.mjs', 'onefile-lean': 'mountAsync() of the lean one-file player', 'onefile-full': 'mountAsync() of the full one-file player' }[kind]}:`);
  // 1. muted at mount: the first press is silent.
  // Both HyperSVG mounts reach play() through asset-lean.mjs (place, mountAsync).
  const mutedAtMount = kind === 'play' || leanForwards;
  if (!mutedAtMount) log('  pending: asset-lean.mjs does not forward muted to play() yet (the mounts\' option forwarding)');
  {
    const page = await fresh(browser, base);
    await page.evaluate((k) => window.start(k, 'chime', { muted: true }), kind);
    await settle(page, 300);
    await click(page, DING); await settle(page);
    const a = await audio(page);
    if (mutedAtMount) {
      check(a.playing >= 1, `muted at mount: the tone's oscillator runs (${JSON.stringify(a)})`);
      check(a.level === 0, `muted at mount: the first press makes no sound (level ${a.level})`);
      const err = await hostMute(page, false); check(err === null, `host.mute(false) does not throw (${err})`);
      // The first audio context of a browser can take a moment to start its clock; wait up to 1 s for the level.
      let b = await audio(page);
      for (let k = 0; k < 20 && !(b.level > 0.3); k++) { await settle(page, 50); b = await audio(page); }
      check(b.level > 0.3, `after host.mute(false) the playing tone is heard (level ${b.level.toFixed(3)})`);
    }
    if (page.pageErrors.length) fail(`page errors: ${page.pageErrors.join(' | ')}`);
    await page.close();
  }
  // 2. host.mute while a sound plays; unmute lets the next sound play; 3. the person's mute stays.
  {
    const page = await fresh(browser, base);
    await page.evaluate((k) => window.start(k, 'chime'), kind);
    await settle(page, 300);
    await click(page, DING); await settle(page);
    const a = await audio(page);
    check(a.playing >= 1 && a.level > 0.3, `without muted the press sounds (level ${a.level.toFixed(3)})`);
    await hostMute(page, true); await settle(page, 80);
    const b = await audio(page);
    check(b.playing >= 1 && b.level === 0, `host.mute(true) while the tone plays silences it at once (level ${b.level}, ${b.playing} playing)`);
    await click(page, DING); await settle(page);
    check((await audio(page)).level === 0, 'a press under the host mute is silent');
    await hostMute(page, false); await settle(page, 80);
    const c = await audio(page);
    check(c.level > 0.3, `host.mute(false) lets the playing tone be heard (level ${c.level.toFixed(3)})`);
    await page.waitForTimeout(1600); // the tones end
    await click(page, DING); await settle(page);
    const d = await audio(page);
    check(d.level > 0.3, `the next press sounds (level ${d.level.toFixed(3)})`);
    // The person mutes with the drawn control; the host's unmute does not undo it.
    await click(page, HUSH); await settle(page, 120);
    check((await audio(page)).level === 0, 'the person\'s mute silences the playing tone');
    await hostMute(page, false); await settle(page, 80);
    check((await audio(page)).level === 0, 'with the person\'s mute on, host.mute(false) does not unmute');
    await click(page, DING); await settle(page);
    check((await audio(page)).level === 0, 'and a new press stays silent');
    await hostMute(page, true); await click(page, UNHUSH); await settle(page, 120);
    check((await audio(page)).level === 0, 'the person unmutes while the host mutes: still silent');
    await hostMute(page, false); await settle(page, 80);
    check((await audio(page)).level > 0.3, 'neither mutes: heard again');
    const errs = await page.evaluate(() => window.errors);
    if (errs.length) fail(`onError heard: ${errs.join(' | ')}`);
    if (page.pageErrors.length) fail(`page errors: ${page.pageErrors.join(' | ')}`);
    await page.close();
  }
  // 4. A piece without sound: host.mute does nothing and does not throw.
  {
    const page = await fresh(browser, base);
    await page.evaluate((k) => window.start(k, 'quiet', { muted: true }), kind);
    const errs = [await hostMute(page, true), await hostMute(page, false), await hostMute(page)];
    check(errs.every(e => e === null), `host.mute on a piece without sound does not throw (${JSON.stringify(errs)})`);
    check((await hostMute(page, 'on'))?.startsWith('E-TYPE'), 'host.mute("on") is E-TYPE');
    const a = await audio(page);
    check(a.oscillators === 0, 'nothing sounds');
    if (page.pageErrors.length) fail(`page errors: ${page.pageErrors.join(' | ')}`);
    await page.close();
  }
}

try { await main(); } catch (e) { fail(`${e.name}: ${e.message}`); }
fs.rmSync(work, { recursive: true, force: true });
if (problems.length) { log(`host-mute-browser: ${problems.length} problem(s)`); process.exit(1); }
log('host-mute-browser: all checks pass');
