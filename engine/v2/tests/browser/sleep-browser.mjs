// Sleep (play option sleep, experimental; added in 2.0.0-next.2): an idle piece asks for no frames, a piece off the
// screen draws nothing, and the engine's time, timers, rules, outputs and diary are the same as with sleep off.
// Most parts run on a virtual clock in the page (requestAnimationFrame, setTimeout and performance.now are replaced,
// a frame every 16 ms; the IntersectionObserver is a switch the test turns), so a play with sleep and the same play
// without it can be compared exactly. The frame count, the real off-screen pause and the main-thread cost (Chrome
// DevTools Protocol Performance.getMetrics, CPU slowed 4x) run on the real clock.
// Run alone (it starts a browser):
//   PW_PATH=/opt/node-tools node engine/v2/tests/browser/sleep-browser.mjs
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { sha256 } from '../../src/members.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const PLAYS = path.join(repo, 'spec', '2.0', 'conformance', 'plays');
const BELL = path.relative(repo, path.join(here, 'sleep-fixture')).split(path.sep).join('/');
const GAME = 'docs/guide/examples/harbour';
// The replay add-on's module recorder writes the diary where its folder is here; elsewhere the diary is the moves the
// page heard (onMove) with the state fingerprint after each, as the replay suite keeps them.
const RECORDER = !process.env.SLEEP_NO_RECORDER && fs.existsSync(path.join(repo, 'replay', 'src', 'recorder.mjs'));

// A package of an experience folder: every text file, and package.json with their digests (10.8). inputs: start
// values written as the inputs' initial values (as a play's start.inputs).
function packageOf(rel, inputs = {}) {
  const folder = path.join(repo, ...rel.split('/'));
  const files = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['tests', 'evidence'].includes(e.name)) walk(p); } else if (/\.(json|svg|csv|txt|vtt)$/.test(e.name)) files[path.relative(folder, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8');
    }
  };
  walk(folder);
  const doc = JSON.parse(files['experience.json']);
  if (Object.keys(inputs).length) {
    for (const [k, v] of Object.entries(inputs)) doc.inputs[k] = { ...doc.inputs[k], initial: v };
    files['experience.json'] = JSON.stringify(doc);
  }
  const enc = new TextEncoder();
  const members = Object.fromEntries(Object.keys(files).sort().map(k => [k, sha256(enc.encode(files[k]))]));
  files['package.json'] = JSON.stringify({ format: 'hsvg/2.0', kind: 'package', id: doc.id, experience: 'experience.json', needs: doc.needs || [], members });
  return files;
}

const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
const page = `<!doctype html><meta charset="utf-8">
<style>body{margin:0} .stage{width:400px;height:300px;position:relative} #spacer{height:4000px}</style>
<div id="wrap"></div><div id="spacer"></div>
<script>
if (location.search.includes('virtual')) {
  // The virtual clock: a frame every 16 ms while one is asked for; timers in time order; microtasks run after each.
  const vt = window.vt = { now: 1008, frames: [], timers: [], seq: 0, frameCount: 0 };
  window.requestAnimationFrame = (fn) => { vt.frames.push(fn); return ++vt.seq; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (fn, ms = 0, ...a) => { const id = ++vt.seq; vt.timers.push({ id, at: vt.now + Math.max(0, +ms || 0), fn: () => fn(...a) }); return id; };
  window.clearTimeout = (id) => { vt.timers = vt.timers.filter(t => t.id !== id); };
  Object.defineProperty(performance, 'now', { value: () => vt.now, configurable: true });
  const flush = async () => { for (let k = 0; k < 6; k++) await null; };
  vt.runTo = async (end) => {
    for (;;) {
      const nf = vt.frames.length ? (Math.floor(vt.now / 16) + 1) * 16 : Infinity;
      vt.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const nt = vt.timers.length ? vt.timers[0].at : Infinity;
      const n = Math.min(nf, nt);
      if (n > end) break;
      vt.now = Math.max(vt.now, n);
      if (nt <= nf) vt.timers.shift().fn();
      else { const fs = vt.frames.splice(0); vt.frameCount += fs.length; for (const f of fs) f(vt.now); }
      await flush();
    }
    vt.now = Math.max(vt.now, end);
    await flush();
  };
  vt.run = (ms) => vt.runTo(vt.now + ms);
  // The observer: off(on) puts every piece off the screen or back.
  const seen = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; seen.push(this); } observe(el) { this.cb([{ isIntersecting: !window.allOff, target: el }]); } disconnect() { seen.splice(seen.indexOf(this), 1); } };
  window.off = (on) => { window.allOff = on; for (const o of [...seen]) o.cb([{ isIntersecting: !on }]); };
} else {
  // The real clock: count the frame callbacks the players get.
  const raf = window.requestAnimationFrame.bind(window);
  window.rafCalls = 0;
  window.requestAnimationFrame = (fn) => raf((t) => { window.rafCalls++; fn(t); });
}
</script>
<script type="module">
import { play } from '/engine/v2/web/player-web.mjs';
import { fingerprint } from '/engine/v2/src/logic.mjs';
import { loadExperience } from '/engine/v2/src/load.mjs';
const schemas = await fetch('/schemas.json').then(r => r.json());
const { recorder } = ${RECORDER} ? await import('/replay/src/recorder.mjs') : { recorder: null };
const EPOCH = Date.UTC(2026, 10, 22, 9, 0, 0);
const BUILT_IN = ['entered', 'ended'];
window.mounts = [];
// Without the recorder: a diary of the moves heard and the fingerprint after each (a microtask after its move).
const movesOnly = () => {
  const steps = []; let target = null;
  return { clock: (t) => EPOCH + t, onMove: (m) => { const s = { ...m, print: null }; steps.push(s); queueMicrotask(() => { if (target) s.print = fingerprint(target.internal); }); }, watch: (h) => { target = h; }, finish: () => ({ steps, end: { t: target.internal.state.now, print: fingerprint(target.internal) } }) };
};
// Mounts a package (text files) with play(). record: a watched recorder (replay/src/recorder.mjs) writes the diary.
window.start = (pkgText, { sleep = false, record = false } = {}) => {
  const el = document.createElement('div'); el.className = 'stage'; document.getElementById('wrap').appendChild(el);
  const enc = new TextEncoder();
  const pkg = Object.fromEntries(Object.entries(pkgText).map(([k, v]) => [k, enc.encode(v)]));
  const rec = record && recorder ? recorder({ source: { package: pkg }, schemas, start: { epochMs: EPOCH }, watch: true }) : record ? movesOnly() : null;
  const heard = [];
  const files = { ...pkgText }; delete files['package.json'];
  const state = play(el, { files, schemas, load: loadExperience, test: true, sleep, partition: 'p' + Math.random().toString(36).slice(2), clock: rec ? rec.clock : (t) => EPOCH + t, ...(rec ? { onMove: rec.onMove } : {}) });
  if (rec) rec.watch(state.host);
  const doc = JSON.parse(files['experience.json']);
  const outs = Object.entries(doc.outputs || {}).filter(([, o]) => o.kind === 'event' || o.kind === 'record').map(([n]) => n);
  for (const n of [...BUILT_IN, ...outs]) state.host.on(n, (e) => heard.push([n, state.player.state.now, JSON.stringify(e.detail)]));
  window.mounts.push({ state, heard, rec, el });
  return window.mounts.length - 1;
};
window.info = (i) => { const m = window.mounts[i]; return { now: m.state.player.state.now, ...(m.state.sleeping?.() ?? {}), heard: m.heard, frames: window.vt?.frameCount ?? window.rafCalls, text: m.el.querySelector('[id$="count-words"]')?.textContent ?? null, lit: [...m.el.querySelectorAll('[data-hsvg-variant="on"]')].some(g => g.getAttribute('display') !== 'none') }; };
// Feeds a play file's moves (all but start) at their engine times through the page's clock: the virtual clock runs
// to the move's time, the rest of the step is one advance (a move lands between frames), then the move runs as the
// page runs it. Returns the fingerprint after each move and what the host heard.
window.feed = async (i, steps, end) => {
  const m = window.mounts[i]; const p = m.state.player; const base = vt.now; const prints = [];
  for (const s of steps) {
    const { t, source, payload } = s.move;
    if (source === 'start') { prints.push(null); continue; }
    await vt.runTo(base + t);
    m.state.wake?.(); // a sleeping page catches up first, as at any input
    if (t > p.state.now) p.advance(t - p.state.now);
    const args = payload.map(x => (x === null ? undefined : structuredClone(x)));
    const r = p[source](...args);
    m.state.after?.();
    prints.push([p.state.now, fingerprint(p), r?.ok === false ? r.fault?.code : null]);
  }
  await vt.runTo(base + end);
  p.advance(0);
  prints.push([p.state.now, fingerprint(p)]);
  return { prints, heard: m.heard, frames: vt.frameCount };
};
window.ready = true;
</script>`;

const pkgCache = new Map();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(schemas); }
  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.json') ? 'application/json' : 'text/javascript' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let failures = 0; let passes = 0;
const check = (cond, msg) => { if (cond) { passes++; console.log(`ok   ${msg}`); } else { failures++; console.log(`FAIL ${msg}`); } };
// SLEEP_PARTS=3,4 runs only those parts (for work on one).
const part = (n) => !process.env.SLEEP_PARTS || process.env.SLEEP_PARTS.split(',').includes(String(n));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pkgOf = (rel, inputs) => { const k = rel + JSON.stringify(inputs || {}); if (!pkgCache.has(k)) pkgCache.set(k, packageOf(rel, inputs)); return pkgCache.get(k); };

async function open(virtual) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', e => errors.push(String(e)));
  await pg.goto(`${origin}/${virtual ? '?virtual' : ''}`);
  for (let k = 0; k < 200 && !(await pg.evaluate(() => window.ready === true)); k++) await wait(25);
  return { pg, ctx, errors };
}

try {
  // 1. Real clock: an idle piece with sleep asks for no frames for a second; with sleep off it asks for every frame.
  if (part(1)) {
    const counts = {};
    for (const sleep of [false, true]) {
      const { pg, ctx, errors } = await open(false);
      await pg.evaluate(([p, s]) => window.start(p, { sleep: s }), [pkgOf(BELL), sleep]);
      await wait(600);
      const a = await pg.evaluate(() => window.rafCalls);
      await wait(1000);
      counts[sleep] = (await pg.evaluate(() => window.rafCalls)) - a;
      check(!errors.length, `no page errors (sleep ${sleep}) ${errors.join('; ')}`);
      await ctx.close();
    }
    check(counts.true === 0, `an idle piece with sleep makes no frame callbacks in a second (${counts.true})`);
    check(counts.false >= 20, `without sleep it makes one a frame (${counts.false})`);
  }

  // 2. Virtual clock: the bell's chime (a 1500 ms deadline) and its outputs fire at the same engine times with sleep
  // off, with sleep on the screen, and with sleep off the screen; set and emit while asleep and off the screen apply at
  // once, read gives the new value, emit resolves, and the picture catches up when the piece comes back.
  if (part(2)) {
    const runs = {};
    for (const [label, sleep, away] of [['off', false, false], ['on', true, false], ['on, off screen', true, true]]) {
      const { pg, ctx, errors } = await open(true);
      const r = await pg.evaluate(async ([p, sleep, away]) => {
        const i = window.start(p, { sleep }); const h = window.mounts[i].state.host; const out = {};
        await vt.run(500);
        out.asleepIdle = window.info(i).asleep;
        const f0 = vt.frameCount; await vt.run(1000); out.idleFrames = vt.frameCount - f0;
        if (away) window.off(true);
        await vt.run(37);
        h.set('lit', true); out.readLit = h.read('lit');
        let resolved = false; h.emit('ring').then(() => { resolved = true; });
        out.readCount = h.read('count');
        await vt.run(5); out.resolved = resolved;
        await vt.run(40); out.drawnSoon = window.info(i);
        await vt.run(700); out.asleepWaiting = window.info(i).asleep;
        h.emit('ring'); // a second ring while the chime runs: counted, no new chime
        await vt.run(2000);
        out.before = window.info(i);
        if (away) window.off(false);
        out.after = window.info(i);
        await vt.run(3000);
        window.mounts[i].state.wake?.(); // a sleeping piece catches up, as at any input
        out.end = window.info(i);
        return out;
      }, [pkgOf(BELL), sleep, away]);
      check(!errors.length, `bell ${label}: no page errors ${errors.join('; ')}`);
      runs[label] = r;
      await ctx.close();
    }
    const off = runs.off; const on = runs.on; const away = runs['on, off screen'];
    check(off.end.heard.some(h => h[0] === 'rung'), `the chime is heard (${JSON.stringify(off.end.heard)})`);
    check(same(on.end.heard, off.end.heard) && same(away.end.heard, off.end.heard), `outputs and their engine times are the same: sleep off, on, off screen (${JSON.stringify(on.end.heard)} / ${JSON.stringify(away.end.heard)})`);
    check(on.end.now === off.end.now && away.end.now === off.end.now, `engine time agrees once a sleeping piece is woken: ${off.end.now} ${on.end.now} ${away.end.now}`);
    check(on.asleepIdle && away.asleepIdle && !off.asleepIdle, 'with sleep, the idle bell is asleep after half a second');
    check(on.idleFrames === 0 && off.idleFrames >= 60, `frames in an idle second: sleep ${on.idleFrames}, no sleep ${off.idleFrames}`);
    check(on.asleepWaiting && away.asleepWaiting, 'with sleep, the bell sleeps while its chime is 700 ms away (a timer wakes it)');
    for (const [label, r] of Object.entries(runs)) check(r.readLit === true && r.readCount === 1 && r.resolved, `${label}: read gives the set value and the emitted count at once; emit resolves`);
    check(on.drawnSoon.lit && on.drawnSoon.text === 'Rung 1', 'on the screen, the picture shows the change within a frame of waking');
    check(!away.drawnSoon.lit && away.drawnSoon.text === 'Rung 0' && !away.before.lit && away.before.text === 'Rung 0', 'off the screen, nothing is drawn');
    check(away.after.lit && away.after.text === 'Rung 2', 'back on the screen, the current state is drawn at once');
    check(off.before.text === 'Rung 2' && on.before.text === 'Rung 2', 'the pictures agree');
  }

  // 3. Virtual clock: a recorded game (the watched module recorder of replay/src) with presses, scrolled away in the
  // middle and back, gives the same diary as the same play never scrolled, with sleep on and off.
  if (part(3)) {
    const diaries = {};
    for (const [label, sleep, away] of [['off', false, false], ['off, scrolled', false, true], ['on', true, false], ['on, scrolled', true, true]]) {
      const { pg, ctx, errors } = await open(true);
      const i = await pg.evaluate(([p, s]) => window.start(p, { sleep: s, record: true }), [pkgOf(GAME), sleep]);
      const run = (ms) => pg.evaluate((ms) => vt.run(ms), ms);
      const press = async () => { await pg.evaluate(() => document.querySelector('#wrap [tabindex]')?.focus({ preventScroll: true })); await pg.keyboard.press('Space'); };
      await run(700); await press(); await run(1311); await press(); await run(1999);
      if (away) await pg.evaluate(() => window.off(true));
      await run(905); await press(); await run(2603); await press(); await run(1517);
      if (away) await pg.evaluate(() => window.off(false));
      await run(1001); await press(); await run(7000);
      const r = await pg.evaluate((i) => { const m = window.mounts[i]; m.state.player.advance(0); const d = m.rec.finish(); return { d, info: window.info(i), frames: vt.frameCount }; }, i);
      check(!errors.length, `game ${label}: no page errors ${errors.join('; ')}`);
      diaries[label] = r;
      await ctx.close();
    }
    const base = diaries.off;
    const moves = base.d.steps.filter(s => ['activate', 'key'].includes(s.source)).length;
    check(moves >= 5 && base.info.heard.length >= 2, `the play has its presses (${moves}) and outputs (${JSON.stringify(base.info.heard).slice(0, 300)}); diary by ${RECORDER ? 'the module recorder' : 'the moves and fingerprints'}`);
    for (const label of ['off, scrolled', 'on', 'on, scrolled']) {
      const d = diaries[label];
      if (process.env.SLEEP_DEBUG && !same(d.d, base.d)) { const k = d.d.steps.findIndex((x, j) => !same(x, base.d.steps[j])); console.log(label, k, JSON.stringify(base.d.steps[k]).slice(0, 600), '\n', JSON.stringify(d.d.steps[k]).slice(0, 600), JSON.stringify(base.d.steps.map(s => s.move?.source))); }
      check(same(d.d, base.d), `diary ${label} equals the diary never scrolled with sleep off (${d.d.steps.length} steps; frames ${d.frames} vs ${base.frames})`);
      check(same(d.info.heard, base.info.heard), `outputs ${label} equal, with their engine times`);
    }
    check(diaries['on, scrolled'].frames < diaries.off.frames && diaries.on.frames < diaries.off.frames, 'sleep runs fewer frames');
  }

  // 4. Virtual clock: every play file of spec/2.0/conformance/plays/ that runs in a page (no add-on, no stored value)
  // gives the same fingerprints and outputs after every move with sleep on as off.
  if (part(4)) {
    let files = 0; let moves = 0; let slept = 0; const wrong = [];
    for (const f of fs.readdirSync(PLAYS).filter(x => x.endsWith('.json')).sort()) {
      const doc = JSON.parse(fs.readFileSync(path.join(PLAYS, f), 'utf8'));
      if (Object.keys(doc.package.addons).length || doc.start.stored) continue;
      const res = {};
      for (const sleep of [false, true]) {
        const { pg, ctx, errors } = await open(true);
        const i = await pg.evaluate(([p, s]) => window.start(p, { sleep: s }), [pkgOf(doc.package.folder, doc.start.inputs), sleep]);
        res[sleep] = await pg.evaluate(([i, steps, end]) => window.feed(i, steps, end), [i, doc.steps, doc.end.t]);
        if (errors.length) wrong.push(`${f} sleep ${sleep}: ${errors.join('; ')}`);
        await ctx.close();
      }
      files++; moves += doc.steps.length;
      if (!same(res.true.prints, res.false.prints)) { wrong.push(`${f}: fingerprints differ`); if (process.env.SLEEP_DEBUG) { const k = res.true.prints.findIndex((x, j) => !same(x, res.false.prints[j])); console.log(f, k, doc.steps[k]?.move?.source, doc.steps[k]?.move?.t, JSON.stringify(res.false.prints[k]), JSON.stringify(res.true.prints[k])); } }
      if (!same(res.true.heard, res.false.heard)) wrong.push(`${f}: outputs differ`);
      if (res.true.frames < res.false.frames) slept++;
    }
    check(!wrong.length && files >= 12, `${files} play files (${moves} moves) give the same fingerprints and outputs with sleep on and off; sleep saved frames in ${slept} ${wrong.join('; ')}`);
  }

  // 5. Real clock, real scrolling: off the screen the bell's chime still fires on time and nothing is drawn; back on
  // the screen the picture is current at once.
  if (part(5)) {
    const { pg, ctx, errors } = await open(false);
    await pg.evaluate((p) => window.start(p, { sleep: true }), pkgOf(BELL));
    await wait(500);
    await pg.evaluate(() => window.scrollTo(0, 2000));
    await wait(300);
    const t0 = await pg.evaluate(() => { const m = window.mounts[0]; m.state.host.emit('ring'); return m.state.player.state.now; });
    // Wait for the chime by reading the page only (no call that would wake the piece), up to 10 s: on a machine that
    // slows a later window's frames, engine time runs as an awake page's does at that frame rate.
    for (let k = 0; k < 100 && !(await pg.evaluate(() => window.info(0).heard.some(h => h[0] === 'rung'))); k++) await wait(100);
    const away = await pg.evaluate(() => { window.mounts[0].state.player.advance(0); return window.info(0); });
    await pg.evaluate(() => window.scrollTo(0, 0));
    await wait(200);
    const back = await pg.evaluate(() => window.info(0));
    const rung = away.heard.find(h => h[0] === 'rung');
    check(away.offscreen && rung && rung[1] === t0 + 1500, `off the screen the chime fires 1500 ms of engine time after the ring (${t0} -> ${rung?.[1]})`);
    check(away.text === 'Rung 0' && back.text === 'Rung 1' && !back.offscreen, `nothing is drawn off the screen (${away.text}); back, it is drawn (${back.text})`);
    check(!errors.length, `no page errors ${errors.join('; ')}`);
    await ctx.close();
  }

  // 6. Real clock, CPU slowed 4x: main-thread work per second (TaskDuration, ScriptDuration) of idle bells, 1 and 6,
  // on and off the screen, sleep off and on.
  if (part(6)) {
    const rows = [];
    for (const n of [1, 6]) {
      for (const scrolled of [false, true]) {
        for (const sleep of [false, true]) {
          const { pg, ctx } = await open(false);
          const cdp = await ctx.newCDPSession(pg);
          await cdp.send('Performance.enable');
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
          for (let k = 0; k < n; k++) await pg.evaluate(([p, s]) => window.start(p, { sleep: s }), [pkgOf(BELL), sleep]);
          if (scrolled) await pg.evaluate(() => window.scrollTo(0, 3000));
          await wait(1000);
          const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
          const a = await m(); await wait(3000); const b = await m();
          const per = (k) => Math.round((b[k] - a[k]) * 1000 / ((b.Timestamp - a.Timestamp)));
          rows.push({ pieces: n, screen: scrolled ? 'off' : 'on', sleep, taskMs: per('TaskDuration'), scriptMs: per('ScriptDuration') });
          await ctx.close();
        }
      }
    }
    console.log('main-thread ms per second (CPU 4x):');
    for (const r of rows) console.log(`  ${r.pieces} piece(s), ${r.screen} screen, sleep ${r.sleep ? 'on ' : 'off'}: task ${r.taskMs} ms, script ${r.scriptMs} ms`);
    for (const n of [1, 6]) for (const screen of ['on', 'off']) {
      const offR = rows.find(r => r.pieces === n && r.screen === screen && !r.sleep);
      const onR = rows.find(r => r.pieces === n && r.screen === screen && r.sleep);
      check(onR.scriptMs * 2 <= offR.scriptMs && onR.taskMs * 2 <= offR.taskMs, `${n} piece(s) ${screen} screen: main-thread work at least halves with sleep (${offR.scriptMs} -> ${onR.scriptMs} ms/s)`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
