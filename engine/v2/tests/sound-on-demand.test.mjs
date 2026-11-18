// Sound only when used (added after 2.0.0-next.0): the audio code (web/audio-web.mjs and src/mixer.mjs) is not in the
// core. A packed page carries it only when its experience declares a sound resource or a made sound; a HyperSVG page
// loads it (a dynamic import) only for such a file; the synchronous mounts keep it. No browser: the page side is in
// browser/sound-on-demand-browser.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { usesSound, assetUsesSound } from '../src/on-demand.mjs';
import { pack, engineSizes, bundle } from '../tools/pack.mjs';
import { FORMAT } from '../src/limits.mjs';
import { repo, eq, ok } from './helpers.mjs';

const v2 = path.join(repo, 'engine', 'v2');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sound-'));
// The static imports a module reaches (dynamic imports are not followed).
function graph(file) {
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return; seen.add(f);
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/^\s*(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)) { const s = m[1] || m[2]; if (s.startsWith('.')) walk(path.resolve(path.dirname(f), s)); }
  };
  walk(path.join(v2, ...file.split('/')));
  return [...seen].map(f => path.relative(v2, f).split(path.sep).join('/'));
}

export const tests = {
  'sound: a document asks for sound with a sound resource or a made sound, and nothing else'() {
    eq(usesSound([{ resources: { pic: { kind: 'image', file: 'a.png' } } }, { audio: { fadeMs: 10 } }]), false);
    eq(usesSound([{}, { resources: { boom: { kind: 'sound', file: 'boom.mp3' } } }]), true, 'a block\'s sound resource');
    eq(usesSound([{ audioSynths: { tone: { wave: 'sine', from: 1, to: 2, durationMs: 9, gain: 1 } } }]), true, 'a made sound');
    eq(usesSound([{ audioSynths: {} }]), false, 'an empty audioSynths');
    eq(assetUsesSound({ 'experience.json': '{"audioSynths":{"t":{}}}', 'a.svg': '<svg/>' }), true);
    eq(assetUsesSound({ 'experience.json': '{}', 'scenes/a/scene.json': '{"resources":{"s":{"kind":"sound","file":"s.mp3"}}}' }), true);
  },
  'sound: the core carries no audio code; the audio code is its own row under the capability limit, and the core stays under the core limit (D62 2.2)'() {
    const s = engineSizes();
    const none = bundle(path.join(v2, 'web', 'packed-entry.mjs')).files;
    ok(!none.includes('engine/v2/web/audio-web.mjs') && !none.includes('engine/v2/src/mixer.mjs'), 'no audio code in the core');
    ok(s.sound && s.sound.gzip9 > 2000 && s.sound.gzip9 <= FORMAT.capabilityBundleBytes, `the audio row: ${JSON.stringify(s.sound)}`);
    // D62 2.2: the core is measured without sound, and sound has its own row like a capability. Core and sound are no
    // longer added together against coreBundleBytes.
    ok(s.core.gzip9 <= FORMAT.coreBundleBytes, `core ${s.core.gzip9} is over coreBundleBytes`);
    eq(engineSizes([], [], { sound: false }).sound, undefined, 'no row for a page without sound');
  },
  async 'sound: a packed page carries the audio code only when its experience uses sound'() {
    const quiet = await pack(path.join(v2, 'tests', 'k2f-fixture'), temp());
    const loud = await pack(path.join(v2, 'tests', 'sound-fixture'), temp());
    eq([quiet.sound, loud.sound], [false, true]);
    ok(!quiet.files.includes('engine/v2/web/audio-web.mjs') && loud.files.includes('engine/v2/web/audio-web.mjs') && loud.files.includes('engine/v2/src/mixer.mjs'), 'the module lists');
    const html = (r) => fs.readFileSync(r.htmlPath ?? r.path ?? r.out, 'utf8');
    const qh = html(quiet); const lh = html(loud);
    ok(!qh.includes('createMixer') && lh.includes('createMixer'), 'the page script');
    ok(lh.length > qh.length, 'the sound page is bigger');
  },
  'sound: the player imports no audio code; the synchronous mounts do; the lean entry loads it only by a dynamic import'() {
    ok(!graph('web/player-web.mjs').includes('web/audio-web.mjs'), 'player-web.mjs');
    ok(!graph('web/mount-checked.mjs').includes('web/audio-web.mjs'), 'mount-checked.mjs (shared by the HyperSVG full path)');
    ok(!graph('web/asset-lean.mjs').includes('web/audio-web.mjs'), 'asset-lean.mjs');
    ok(graph('web/mount-web.mjs').includes('web/audio-web.mjs'), 'mount-web.mjs keeps sound for the synchronous mount');
    ok(graph('web/asset-web.mjs').includes('web/audio-web.mjs'), 'asset-web.mjs keeps sound for the synchronous mount');
    ok(/import\('\.\/audio-web\.mjs'\)/.test(fs.readFileSync(path.join(v2, 'web', 'asset-lean.mjs'), 'utf8')), 'asset-lean.mjs imports it on demand');
    ok(/import\('\.\/audio-web\.mjs'\)/.test(fs.readFileSync(path.join(v2, 'web', 'player-web.mjs'), 'utf8')), 'the dev player (boot, unchecked) loads it');
  },
};
