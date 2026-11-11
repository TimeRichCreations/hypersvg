// Release polish: the starter lamp's toggle writes its knob, and the other fixes of the release review.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { folderSource, loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { hostApi } from '../src/host.mjs';
import { pack, packAsset, PLAYER_NOTICE } from '../tools/pack.mjs';
import { checkValue } from '../src/runtime.mjs';
import { checkExperience } from '../check/index.mjs';
import { makeAsset, readAsset } from '../src/asset.mjs';
import { repo, schemas, eq, ok, mapSource } from './helpers.mjs';

const guideLamp = path.join(repo, 'docs', 'guide', 'examples', 'lamp');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'k2h-'));
const copyLamp = () => { const d = path.join(temp(), 'lamp'); fs.cpSync(guideLamp, d, { recursive: true }); return d; };

export const tests = {
  // ---------- A2. the lamp: the switch is a toggle that writes the input lit ----------
  async 'A2: the starter lamp\'s switch writes the input lit; the host and the switch agree, the latest change wins'() {
    const loaded = loadExperience(await folderSource(guideLamp), schemas());
    ok(loaded.experience, loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
    const scene = loaded.experience.scenes.lamp;
    eq(scene.doc.controls.switch.kind, 'toggle');
    eq(Object.keys(scene.doc.values || {}), [], 'no private value mirrors the knob');
    const p = new Player(loaded.experience, {});
    ok(p.start().ok);
    const host = hostApi(p);
    const heard = [];
    host.on('hsvg.changed', (e) => heard.push(e.detail));
    const sent = [];
    host.on('switched', () => sent.push('switched'));
    ok(p.activate('lamp', 'switch', undefined, 'person').ok);
    eq(host.read('lit'), true, 'the person\'s press is the knob');
    host.set('lit', false);
    eq(host.read('lit'), false);
    ok(p.activate('lamp', 'switch', undefined, 'person').ok);
    eq(host.read('lit'), true, 'the press after the host\'s change turns the knob over again');
    eq(heard.map(h => `${h.name}=${h.value}:${h.by}`), ['lit=true:person', 'lit=false:host', 'lit=true:person']);
    eq(sent.length, 2, 'each press tells the page switched');
  },

  // ---------- B. R01: the licence notice travels with the engine code ----------
  async 'R01: a packed page carries the player\'s licence notice in its script and its descriptor; a HyperSVG none'() {
    ok(/Apache License 2\.0/.test(PLAYER_NOTICE) && /LICENSE-2\.0/.test(PLAYER_NOTICE) && /Copyright/.test(PLAYER_NOTICE) && /HyperSVG/.test(PLAYER_NOTICE));
    const out = temp();
    await pack(guideLamp, out);
    const html = fs.readFileSync(path.join(out, 'lamp.html'), 'utf8');
    const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    ok(script.startsWith(`/*! ${PLAYER_NOTICE} */`), 'the script opens with the notice');
    const desc = JSON.parse(fs.readFileSync(path.join(out, 'package.json'), 'utf8'));
    ok(desc.about.credits.includes(PLAYER_NOTICE), 'the descriptor credits the player');
    const asset = fs.readFileSync((await packAsset(guideLamp, temp())).svgPath, 'utf8');
    ok(!asset.includes('Apache License'), 'a HyperSVG holds no engine code and no notice');
  },

  // ---------- B. R02: an <image> names a declared image resource ----------
  async 'R02: an undeclared <image href> is E-REF-UNKNOWN in check and at mount; a declared one is not'() {
    const dir = copyLamp();
    const svg = path.join(dir, 'lamp.svg');
    fs.writeFileSync(svg, fs.readFileSync(svg, 'utf8').replace('</svg>', '<image id="external" href="remote.png" x="0" y="0" width="10" height="10"/></svg>'));
    const codes = async () => checkExperience(await folderSource(dir), schemas()).diags.filter(d => d.code.startsWith('E-')).map(d => `${d.code} ${d.file}`);
    eq(await codes(), ['E-REF-UNKNOWN lamp.svg']);
    // mount reads with loadExperience: the same refusal, so a mounted page never asks for remote.png
    const files = Object.fromEntries(['experience.json', 'lamp.json', 'lamp.svg'].map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
    const asset = makeAsset({ id: 'lamp', drawing: 'lamp.svg', files });
    const mounted = loadExperience(mapSource(readAsset(asset).files), schemas()).diags.filter(d => d.code.startsWith('E-'));
    eq(mounted.map(d => d.code), ['E-REF-UNKNOWN']);
    let refused = null;
    try { await pack(dir, temp()); } catch (e) { refused = e; }
    ok(refused, 'pack refuses');
    // declared (a 1 px PNG beside the drawing): clean
    fs.writeFileSync(path.join(dir, 'remote.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
    const ej = path.join(dir, 'experience.json');
    const doc = JSON.parse(fs.readFileSync(ej, 'utf8'));
    const png = fs.readFileSync(path.join(dir, 'remote.png'));
    doc.resources = { remote: { kind: 'image', file: 'remote.png', width: 1, height: 1, digest: 'sha256:' + (await import('node:crypto')).createHash('sha256').update(png).digest('hex'), license: 'CC0-1.0', source: 'a test pixel' } };
    fs.writeFileSync(ej, JSON.stringify(doc));
    eq(await codes(), []);
  },

  // ---------- B. R03: a symbolic link is refused by check and pack ----------
  async 'R03: a symlinked drawing or picture is E-PATH in check, and pack and pack --asset refuse (skipped where links cannot be made)'() {
    const root = temp();
    const dir = path.join(root, 'lamp');
    fs.cpSync(guideLamp, dir, { recursive: true });
    fs.renameSync(path.join(dir, 'lamp.svg'), path.join(root, 'outside-lamp.svg'));
    try { fs.symlinkSync(path.join('..', 'outside-lamp.svg'), path.join(dir, 'lamp.svg'), 'file'); } catch (e) {
      console.log(`  skipped: this system cannot make a symbolic link (${e.code})`);
      return;
    }
    const diags = checkExperience(await folderSource(dir), schemas()).diags;
    ok(diags.some(d => d.code === 'E-PATH' && d.file === 'lamp.svg' && /symbolic link/.test(d.message)), JSON.stringify(diags));
    const out = temp();
    let html = null; let asset = null;
    try { await pack(dir, out); } catch (e) { html = e; }
    try { await packAsset(dir, temp()); } catch (e) { asset = e; }
    ok(html && asset, 'both packs refuse');
    ok(!fs.existsSync(path.join(out, 'lamp.html')), 'no page was written');
    // a picture (a binary resource) through a link: refused too
    fs.rmSync(path.join(dir, 'lamp.svg')); fs.renameSync(path.join(root, 'outside-lamp.svg'), path.join(dir, 'lamp.svg'));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    fs.writeFileSync(path.join(root, 'pixel.png'), png);
    fs.symlinkSync(path.join('..', 'pixel.png'), path.join(dir, 'pixel.png'), 'file');
    const ej = path.join(dir, 'experience.json');
    const doc = JSON.parse(fs.readFileSync(ej, 'utf8'));
    doc.resources = { pixel: { kind: 'image', file: 'pixel.png', width: 1, height: 1, digest: 'sha256:' + (await import('node:crypto')).createHash('sha256').update(png).digest('hex'), license: 'CC0-1.0', source: 'a test pixel' } };
    fs.writeFileSync(ej, JSON.stringify(doc));
    const d2 = checkExperience(await folderSource(dir), schemas()).diags;
    ok(d2.some(d => d.code === 'E-PATH' && d.file === 'pixel.png'), JSON.stringify(d2));
    let refused = null;
    try { await pack(dir, temp()); } catch (e) { refused = e; }
    ok(refused, 'pack refuses the linked picture');
  },

  // ---------- B. R08: a browser pass that cannot run is said, and fails with --browser required ----------
  'R08: test.mjs says SKIPPED and gives coverage when the browser cannot start; --browser required exits 1'() {
    const tool = path.join(repo, 'engine', 'v2', 'tools', 'test.mjs');
    const env = { ...process.env, PW_EXECUTABLE_PATH: path.join(temp(), 'no-such-browser') };
    const run = (...extra) => spawnSync(process.execPath, [tool, guideLamp, '--quick', '--no-shots', '--out', temp(), ...extra], { encoding: 'utf8', env });
    const soft = run('--json');
    eq(soft.status, 0, soft.stderr);
    // With --json the notes go to stderr and stdout is the report alone.
    ok(/^SKIPPED the browser pass did not run/m.test(soft.stderr), soft.stderr.slice(0, 300));
    const r = JSON.parse(soft.stdout);
    eq(r.coverage.ran, ['check', 'node']);
    ok(r.coverage.omitted.some(x => x.part === 'browser'), JSON.stringify(r.coverage));
    const hard = run('--browser', 'required');
    eq(hard.status, 1, hard.stdout);
    ok(/T-BROWSER-SKIPPED/.test(hard.stdout), hard.stdout.slice(0, 300));
  },

  // ---------- F. the command: help, the scoped name, the add-on tool ----------
  'F: hypersvg <command> --help prints the tool\'s usage; init\'s next steps use the full name; hypersvg addon runs the add-on tool'() {
    const bin = path.join(repo, 'bin', 'hypersvg.mjs');
    const cli = (args, cwd) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', cwd });
    for (const c of ['check', 'test', 'pack', 'unpack', 'addon']) {
      const r = cli([c, '--help'], temp());
      eq(r.status, 0, `${c}: ${r.stderr}`);
      const said = r.stdout + r.stderr;
      ok(r.stdout.startsWith(`Usage: hypersvg ${c}`) && !/E-FILE-MISSING/.test(said), `${c} --help: ${said.slice(0, 200)}`);
    }
    const here = temp();
    const made = cli(['init', 'my-lamp'], here);
    eq(made.status, 0, made.stderr);
    ok(/npx @hypersvg\/core check my-lamp/.test(made.stdout) && !/^\s+hypersvg /m.test(made.stdout), made.stdout);
    const a = cli(['addon', 'new', 'preset', 'acme.wiggle', '--in', path.join(here, 'addons')], here);
    eq(a.status, 0, a.stderr + a.stdout);
    ok(fs.existsSync(path.join(here, 'addons', 'acme.wiggle', 'manifest.json')), 'written in addons/<id>');
    ok(!fs.existsSync(path.join(here, 'addons', 'addons')), 'never addons/addons/<id>');
    eq(cli(['addon', 'check', path.join(here, 'addons', 'acme.wiggle')], here).status, 0);
  },

  // ---------- C. rounding: a bound allows a formula's rounding, and the value is stored at the bound ----------
  async 'C: a set whose formula rounds just past a bound (224.00000000000003 against 224) is stored at the bound; a real overshoot faults'() {
    const d = { type: 'number', minimum: 0, maximum: 224 };
    eq(checkValue(d, 224.00000000000003), null);
    eq(checkValue(d, -1e-12), null);
    eq(checkValue(d, 224.001)?.[0], 'E-RANGE');
    eq(checkValue({ type: 'number', minimum: 0, maximum: 1e12 }, 1e12 + 1)?.[0] ?? null, null, 'relative to the bound');
    eq(checkValue({ type: 'number', minimum: 0, maximum: 1e12 }, 1e12 + 10000)?.[0], 'E-RANGE');
    const scene = { format: 'hsvg/2.0', kind: 'scene', id: 'room', drawing: 'room.svg',
      values: { x: { type: 'number', minimum: 0, maximum: 224, initial: 0 }, far: { type: 'number', initial: 0 } },
      controls: { go: { kind: 'button', target: 'go', event: 'go' }, past: { kind: 'button', target: 'past', event: 'past' } },
      on: { go: [{ actions: [{ set: 'x', to: '22.4 * 10.000000000000002' }] }], past: [{ actions: [{ set: 'x', to: '225' }] }] } };
    const files = {
      'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'room', language: 'en', about: { title: 'Room' }, story: { start: 'room', scenes: { room: 'room.json' }, endless: true } },
      'room.json': scene,
      'room.svg': '<svg xmlns="http://www.w3.org/2000/svg" data-hsvg-version="2.0" viewBox="0 0 100 100"><title>Room</title><rect id="go" data-hsvg-kind="part" width="10" height="10"/><rect id="past" data-hsvg-kind="part" x="20" width="10" height="10"/></svg>',
    };
    const loaded = loadExperience(mapSource(files), schemas());
    ok(loaded.experience, loaded.diags.map(x => `${x.code} ${x.message}`).join('; '));
    eq(22.4 * 10.000000000000002 > 224, true, 'the formula really rounds past the bound');
    const p = new Player(loaded.experience, {});
    ok(p.start().ok);
    ok(p.activate('room', 'go', undefined, 'person').ok);
    eq(p.read('room', 'x'), 224, 'stored at the bound');
    const r = p.activate('room', 'past', undefined, 'person');
    eq(r.ok === false || !!r.fault || !!r.stopped, true, 'a real overshoot still faults');
  },

  // ---------- C. T-MOVES measures only once the page has applied reduced motion ----------
  async 'C: the motion check waits until the player has reduced motion before its first step (no false late settle)'() {
    const { motionCheck } = await import('../tools/test/browser-pass.mjs');
    const calls = [];
    const page = {
      emulateMedia: async (m) => { calls.push(`media ${m.reducedMotion}`); },
      waitForFunction: async () => { calls.push('wait'); },
      evaluate: async () => { calls.push('evaluate'); return {}; },
    };
    await motionCheck(page, 'lamp', () => {});
    eq(calls.slice(0, 3), ['media reduce', 'wait', 'evaluate'], calls.join(', '));
  },

  // ---------- C. pack refuses to replace another experience's package.json ----------
  async 'C: pack refuses an out folder that holds another experience\'s package.json, names the fix, and writes nothing'() {
    const out = temp();
    await pack(guideLamp, out);
    let e = null;
    try { await pack(path.join(repo, 'docs', 'one-page', 'example'), out); } catch (x) { e = x; }
    ok(e && /is the package file of lamp\. Pack each experience into its own folder/.test(e.message), e?.message);
    eq(fs.readdirSync(out).sort(), ['lamp.html', 'package.json']);
    await pack(guideLamp, out); // the same experience again: fine
  },
};
