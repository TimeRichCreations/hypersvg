// Consumer checks and repeated mount measurements against the npm tarball, not source imports.
// PW_PATH: a folder with node_modules/playwright; PW_EXECUTABLE_PATH: optional system Chromium.
// --root <checkout> --benchmark-only --output <json> allow the same harness to measure the base.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const root = path.resolve(arg('--root') || fileURLToPath(new URL('../', import.meta.url)));
const measureOnly = process.argv.includes('--benchmark-only');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules/playwright') : 'playwright');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-consumer-'));
const run = (file, args, cwd = temp) => execFileSync(file, args, { cwd, env: { ...process.env, npm_config_cache: path.join(temp, 'npm-cache') }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
let browser, server;
try {
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', temp], root));
  const installed = path.join(temp, 'node_modules/@hypersvg/core');
  fs.mkdirSync(installed, { recursive: true });
  run('tar', ['-xzf', path.join(temp, packed.filename), '--strip-components=1', '-C', installed]);
  const bin = path.join(installed, 'bin/hypersvg.mjs');
  const cli = (...args) => run(process.execPath, [bin, ...args]);
  cli('init', 'lamp');
  cli('check', 'lamp');
  cli('pack', 'lamp', 'page');
  // Use identical authoring bytes on both revisions when comparing performance.
  const fixtureRoot = path.resolve(arg('--fixture-root') || installed);
  fs.cpSync(path.join(fixtureRoot, 'docs/guide/examples/lamp'), path.join(temp, 'benchmark'), { recursive: true });
  const fixtureHash = crypto.createHash('sha256');
  for (const name of ['experience.json', 'lamp.json', 'lamp.svg']) fixtureHash.update(name).update(fs.readFileSync(path.join(temp, 'benchmark', name)));
  const fixtureDigest = fixtureHash.digest('hex');
  cli('pack', '--asset', 'benchmark', 'out-benchmark');
  for (const [name, color] of [['red', '#ff0000'], ['blue', '#0000ff']]) {
    fs.cpSync(path.join(temp, 'lamp'), path.join(temp, name), { recursive: true });
    const svg = path.join(temp, name, 'lamp.svg');
    fs.writeFileSync(svg, fs.readFileSync(svg, 'utf8').replace('<title>', `<defs><linearGradient id="shade"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}"/></linearGradient><clipPath id="crop"><rect width="400" height="300"/></clipPath></defs><title>`).replace('fill="#555555"', 'fill="url(#shade)" clip-path="url(#crop)"'));
    cli('pack', '--asset', name, `out-${name}`);
  }
  if (!measureOnly) {
    for (const rel of ['spec/2.0/01-model.md', 'docs/guide/examples/harbour/experience.json', 'docs/browser-embedding.md']) assert.ok(fs.existsSync(path.join(installed, rel)), `tarball missing ${rel}`);
    // A story with a shell and scenes, from the installed package's own guide example.
    cli('check', path.join(installed, 'docs', 'guide', 'examples', 'harbour'));
    cli('pack', path.join(installed, 'docs', 'guide', 'examples', 'harbour'), 'story');
    // The packed page carries the player's licence notice (Apache-2.0 travels with the code).
    assert.match(fs.readFileSync(path.join(temp, 'page', 'lamp.html'), 'utf8'), /<script>\/\*! HyperSVG player, licensed under the Apache License 2\.0/);
  }
  const html = '<style>body{margin:0;display:flex}.slot,hypersvg-asset{width:400px;height:300px;flex:none}</style><div id="a" class="slot"></div><div id="b" class="slot"></div>';
  const types = { '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.html': 'text/html' };
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
    const file = path.resolve(temp, '.' + pathname);
    if (!file.startsWith(temp + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain'); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin);
  await page.evaluate(async () => {
    window.asset = await import('/node_modules/@hypersvg/core/engine/v2/web/asset-web.mjs');
    window.schemas = await asset.sharedSchemas();
    window.svgs = await Promise.all(['red', 'blue'].map(n => fetch(`/out-${n}/lamp.svg`).then(r => r.text())));
  });
  if (!measureOnly) {
    const result = await page.evaluate(() => {
      let missingSchemas = false;
      try { asset.mount(document.querySelector('#a'), svgs[0]); } catch (e) { missingSchemas = /schemas/.test(e.message); }
      window.players = ['a', 'b'].map((id, i) => asset.mount(document.getElementById(id), svgs[i], {}, { schemas }));
      const ids = [...document.querySelectorAll('[id]')].map(n => n.id);
      const refsLocal = [...document.querySelectorAll('circle[clip-path]')].every(n => ['fill', 'clip-path'].every(k => {
        const id = /#([^)]*)/.exec(n.getAttribute(k))[1];
        return n.closest('.slot').contains(document.getElementById(id));
      }));
      window.changed = [];
      players[0].on('hsvg.changed', e => changed.push(e.detail));
      return { missingSchemas, unique: new Set(ids).size === ids.length, refsLocal };
    });
    assert.deepEqual(result, { missingSchemas: true, unique: true, refsLocal: true });
    await page.locator('#a [role="checkbox"]').click();
    assert.deepEqual(await page.evaluate(() => players.map(p => p.read('lit'))), [true, false]);
    assert.ok((await page.evaluate(() => changed)).some(e => e.name === 'lit' && e.value === true));
    await page.evaluate(() => players[0].set('lit', false));
    await page.waitForFunction(() => document.querySelector('#a [role="checkbox"]')?.getAttribute('aria-checked') === 'false');
    await page.locator('#a [role="checkbox"]').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => players[0].read('lit')), true);
    await page.waitForFunction(() => {
      const control = document.querySelector('#a [role="checkbox"]');
      const ring = control.getAttribute('data-player-ring');
      return !!ring && ring.startsWith(control.id.split('__')[0] + '__') && !!document.getElementById(ring);
    });
    await page.setViewportSize({ width: 800, height: 600 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(n => n.id); return new Set(ids).size === ids.length; }), true);
    await page.evaluate(() => { for (const p of players) { p.destroy(); p.destroy(); } document.querySelectorAll('.slot').forEach(n => n.replaceChildren()); });
    // A host reusing a checked definition must not inherit another player's start override.
    const starts = await page.evaluate(async () => {
      const { loadExperience } = await import('/node_modules/@hypersvg/core/engine/v2/src/load.mjs');
      const { play } = await import('/node_modules/@hypersvg/core/engine/v2/web/player-web.mjs');
      const files = Object.fromEntries(await Promise.all(['experience.json', 'lamp.json', 'lamp.svg'].map(async name => [name, await fetch('/lamp/' + name).then(r => r.text())])));
      const doc = JSON.parse(files['experience.json']);
      doc.story.scenes.other = 'other.json';
      files['experience.json'] = JSON.stringify(doc);
      files['other.json'] = JSON.stringify({ ...JSON.parse(files['lamp.json']), id: 'other' });
      const loaded = loadExperience({ read: p => files[p] ?? null }, schemas);
      const freeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } };
      freeze(loaded);
      const a = play(document.querySelector('#a'), { files, load: () => loaded, start: 'other', manualClock: true });
      const b = play(document.querySelector('#b'), { files, load: () => loaded, manualClock: true });
      const result = [a.player.scene, b.player.scene, loaded.experience.doc.story.start];
      a.host.destroy(); b.host.destroy();
      document.querySelectorAll('.slot').forEach(n => n.replaceChildren());
      return result;
    });
    assert.deepEqual(starts, ['other', 'lamp', 'lamp']);
    // Exercise the documented plain-browser element, its attribute changes and removal.
    await page.evaluate(async () => {
      const el = document.createElement('hypersvg-asset'); el.id = 'element'; el.setAttribute('src', '/out-red/lamp.svg'); document.body.append(el); await el.ready;
      el.setAttribute('lit', 'true');
    });
    await page.waitForFunction(() => document.querySelector('#element').read('lit') === true);
    await page.evaluate(() => document.querySelector('#element').remove());
    await page.goto(origin + '/page/lamp.html');
    await page.locator('[role="checkbox"]').click();
    await page.waitForFunction(() => document.querySelector('[role="checkbox"]')?.getAttribute('aria-checked') === 'true');
    await page.goto(origin + '/story/harbour.html');
    await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.hsvgError || null), null);
    assert.ok(await page.getByRole('button').count() >= 1, 'the harbour story shows its controls');
    await page.goto(origin);
    await page.evaluate(async () => {
      window.asset = await import('/node_modules/@hypersvg/core/engine/v2/web/asset-web.mjs'); window.schemas = await asset.sharedSchemas();
      window.svgs = [await fetch('/out-red/lamp.svg').then(r => r.text())];
    });
  }
  await page.evaluate(async () => { window.svgs = [await fetch('/out-benchmark/lamp.svg').then(r => r.text())]; });
  const timings = await page.evaluate(() => {
    const output = {};
    // Warm the checker and player equally, regardless of whether the smoke checks ran first.
    for (let i = 0; i < 30; i++) {
      const n = document.createElement('div'); n.style.cssText = 'width:400px;height:300px'; document.body.append(n);
      const p = asset.mount(n, svgs[0], {}, { schemas }); p.destroy(); n.remove();
    }
    for (const count of [1, 10, 100]) {
      const samples = [];
      for (let repeat = 0; repeat < 9; repeat++) {
        const containers = Array.from({ length: count }, () => { const n = document.createElement('div'); n.style.cssText = 'width:400px;height:300px'; document.body.append(n); return n; });
        const start = performance.now();
        const players = containers.map(n => asset.mount(n, svgs[0], {}, { schemas }));
        const elapsed = performance.now() - start;
        players.forEach(p => p.destroy()); containers.forEach(n => n.remove());
        if (repeat > 1) samples.push(elapsed); // two warmups, seven measured batches
      }
      const sorted = [...samples].sort((a, b) => a - b);
      output[count] = { samplesMs: samples, medianMs: sorted[3], p95Ms: sorted[6] };
    }
    return output;
  });
  assert.deepEqual(errors, []);
  const result = { node: process.version, chromium: browser.version(), platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model, fixtureDigest, package: { files: packed.entryCount, bytes: packed.size, unpackedBytes: packed.unpackedSize }, mount: timings, checks: measureOnly ? 'benchmark only' : 'consumer smoke passed' };
  if (arg('--output')) fs.writeFileSync(path.resolve(arg('--output')), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(temp, { recursive: true, force: true });
}
