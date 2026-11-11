// The format changes D27 to D29 settle. 1. optional ids (D29); 2. colour animation in the core (D28);
// 3. the SVG side closes (D28); 4. the door for built-in capabilities, with physics as the pilot (D28).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { entryKey } from '../src/entry-key.mjs';
import { Drawing } from '../src/drawing.mjs';
import { blendHex } from '../src/paint-channels.mjs';
import { checkExperience } from '../check/index.mjs';
import { pack } from '../tools/pack.mjs';
import { eq, ok, mapSource, schemas } from './helpers.mjs';
import { base } from './check-refs.test.mjs';
import '../src/capabilities/all.mjs';

export const scene = (f) => f['scenes/one/scene.json'];
export const check = (f, only = null) => checkExperience(mapSource(f), schemas(), { only }).diags.map(d => `${d.code} ${d.path}`);
export function play(f) {
  const loaded = loadExperience(mapSource(f), schemas());
  ok(loaded.experience, loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
  const p = new Player(loaded.experience, {});
  ok(p.start().ok, 'starts');
  return p;
}
export function toFolder(f) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-b1a-'));
  for (const [rel, v] of Object.entries(f)) {
    const p = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v, null, 2));
  }
  return dir;
}
// The tiny scene with no id on any action, reaction, binding or clip track.
export function noIds() {
  const f = base();
  const s = scene(f);
  const strip = (list) => { for (const a of list || []) { delete a.id; for (const k of ['actions', 'then', 'else']) strip(a[k]); } };
  for (const b of s.bindings) delete b.id;
  for (const c of Object.values(s.clips)) for (const t of c.tracks) delete t.id;
  for (const list of Object.values(s.on)) strip(list);
  return f;
}

export const tests = {
  // ---------- 1. optional ids (D29) ----------
  'D29: a scene with no id on its actions, reactions, bindings and tracks checks as the same scene with ids'() {
    eq(check(noIds()), check(base()));
  },
  'D29: a scene with no ids plays as the same scene with ids: its reactions run their actions'() {
    const run = (f) => {
      const p = play(f);
      const r = p.send('one', 'press:go');
      ok(r.ok, JSON.stringify(r.fault));
      return [p.scope('one').name('score'), p.scope('experience').name('flag'), p.state.deliveries.map(d => d.kind)];
    };
    const got = run(noIds());
    eq(got[0], 1);
    eq(got, run(base()));
  },
  async 'D29: a scene with no ids packs'() {
    const dir = toFolder(noIds()); const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-b1a-out-'));
    try {
      const r = await pack(dir, out, { date: '2026-11-08T00:00:00Z' });
      ok(fs.existsSync(r.htmlPath));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); }
  },
  'D29: an entry without an id is keyed by its position inside its owner'() {
    const f = noIds(); const s = scene(f);
    eq(entryKey(s, s.bindings[0]), 'bindings[0]');
    eq(entryKey(s, s.clips.wave.tracks[0]), 'clips.wave.tracks[0]');
    eq(entryKey(s, s.on['press:go'][0]), 'on.press:go[0]');
    eq(entryKey(s, s.on['press:go'][0].actions[2]), 'on.press:go[0].actions[2]');
    eq(entryKey(base()['scenes/one/scene.json'], base()['scenes/one/scene.json'].bindings[0]), 'mouth-look');
  },
  'D29: a finding about an entry without an id names its position, never undefined'() {
    const f = noIds(); scene(f).bindings[0].target = 'nowhere'; scene(f).clips.wave.tracks[0].target = 'nowhere';
    const msgs = checkExperience(mapSource(f), schemas(), { only: ['refs'] }).diags.map(d => d.message);
    ok(msgs.some(m => m.startsWith('binding #0: target')), msgs.join('; '));
    ok(msgs.some(m => m.startsWith('clip wave, track #0: target')), msgs.join('; '));
    ok(!msgs.some(m => m.includes('undefined')), msgs.join('; '));
  },
  'D29: an engine fault in a binding without an id names its position'() {
    const f = noIds(); scene(f).bindings[0].variant = 'nosuch + 1';
    const loaded = loadExperience(mapSource(f), schemas());
    const r = new Player(loaded.experience, {}).start();
    ok(!r.ok && /binding bindings\[0\]/.test(r.fault?.message), JSON.stringify(r.fault));
  },

  // ---------- 2. colour animation joins the core (D28) ----------
  'D28: a core-only experience (no needs) animates fill and dash'() {
    const f = colourScene();
    eq(f['experience.json'].needs, undefined);
    eq(check(f), []);
    const p = play(f);
    const d = new Drawing(p); d.mountScene('one'); d.paint();
    const n = (id) => d.frames.one.byLocal.get(id);
    eq(n('lamp').attrs.fill, '#000000');
    eq(n('ring').attrs['stroke-dasharray'], '0 1');
    p.advance(500); d.paint();
    eq(n('lamp').attrs.fill, blendHex('#000000', '#ffffff', 0.5));
    eq(n('ring').attrs['stroke-dasharray'], '0.5 0.5');
    eq(n('ring').attrs['stroke-dashoffset'], '-0.25');
  },
  'D28: route and morph still belong to motion (E-NEEDS-MISSING without it)'() {
    const f = colourScene();
    scene(f).clips.glow.tracks.push({ target: 'lamp', channel: 'motion.morph', to: 'lamp', keys: [[0, 0], [1000, 1]] });
    ok(check(f).some(x => x.startsWith('E-NEEDS-MISSING')), check(f).join('; '));
  },

  // ---------- 3. the SVG side closes (D28) ----------
  'D28: a drawing with an unused route checks with W-PLACE-UNUSED and plays; no needs is asked for'() {
    const f = noIds();
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', '<path id="lane" data-hsvg-kind="part" data-hsvg-route="track" d="M0 0 H100" fill="none"/></svg>');
    eq(check(f), ['W-PLACE-UNUSED lane']);
    const p = play(f);
    const d = new Drawing(p); d.mountScene('one'); d.paint();
    eq(d.faults, []);
    ok(p.send('one', 'press:go').ok);
  },
  'D28: a video region with no media in needs is core drawing: unused, it warns; it is no E-NEEDS-MISSING'() {
    const f = noIds();
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', '<rect id="screen" data-hsvg-kind="part" data-hsvg-fit="video" x="0" y="0" width="40" height="30" fill="none"/></svg>');
    eq(check(f), ['W-PLACE-UNUSED screen']);
    play(f);
  },
  'D28: a route the content names is used: no warning'() {
    const f = noIds();
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', '<path id="lane" data-hsvg-kind="part" data-hsvg-route="track" d="M0 0 H100" fill="none"/></svg>');
    scene(f).places = { lane: { kind: 'route' } };
    eq(check(f), []);
  },

  // ---------- 4. the door for built-in capabilities: physics (D28) ----------
  'D28: physics through the door: addons.physics and physics.throw check clean and play'() {
    const f = physicsScene();
    eq(check(f), []);
    const p = play(f);
    ok(p.send('one', 'press:go').ok);
    p.advance(200);
    ok(p.state.blocks.one.physics.bodies.ball.y < 0, 'the ball rises');
  },
  'D28: an unknown key in the physics pocket names the capability and where its words are listed'() {
    const f = physicsScene(); scene(f).addons.physics.gravity = [0, 1];
    const d = checkExperience(mapSource(f), schemas()).diags.filter(x => x.code === 'E-KEY-UNKNOWN');
    eq(d.length, 1);
    ok(/physics capability/.test(d[0].message) && d[0].message.includes('spec/2.0/capabilities/physics.json'), d[0].message);
  },
  'D28: the pocket without physics in needs is E-NEEDS-MISSING, in the checker and at play'() {
    const f = physicsScene(); delete f['experience.json'].needs;
    ok(check(f).includes('E-NEEDS-MISSING addons.physics'), check(f).join('; '));
    const loaded = loadExperience(mapSource(f), schemas());
    ok(loaded.diags.some(x => x.code === 'E-NEEDS-MISSING'), 'the loader refuses it');
    eq(new Player(loaded.experience, {}).start().fault?.code, 'E-NEEDS-MISSING', 'and so does the engine');
  },
  'D28: a call is checked against the manifest: verb, inputs, literals, the body it names'() {
    const go = (edit) => { const f = physicsScene(); edit(scene(f).on['press:go'][0].actions[0]); return check(f); };
    eq(go(a => { a.call = 'physics.jump'; }), ['E-ADDON on.press:go[0].actions[0]']);
    eq(go(a => { a.with.spin = 1; }), ['E-ADDON on.press:go[0].actions[0]']);
    eq(go(a => { delete a.with.vy; }), ['E-ADDON on.press:go[0].actions[0]']);
    eq(go(a => { a.with.body = "'nobody'"; }), ['E-REF-UNKNOWN on.press:go[0].actions[0].with.body']);
    ok(go(a => { a.with.vx = 20000; }).some(x => x.startsWith('E-RANGE')), 'a literal over its range');
    ok(go(a => { a.with.vx = 'score * 100000'; }).some(x => x.startsWith('E-RANGE')), 'a formula proven over its range');
    eq(go(a => { a.with.vx = 'score * 10'; }), []);
  },
  'D28: physics controls are keyed by a drag control of the block'() {
    const f = physicsScene();
    scene(f).addons.physics.controls = { go: { releaseVelocity: true } };
    eq(check(f), ['E-REF-UNKNOWN addons.physics.controls.go']);
  },
  'D28: the old words are gone from the core: physics, physicsThrow, releaseVelocity'() {
    const f = physicsScene(); const s = scene(f);
    s.physics = s.addons.physics; delete s.addons;
    ok(check(f).some(x => x.startsWith('E-KEY-UNKNOWN') && x.endsWith('physics')), check(f).join('; '));
    const g = physicsScene();
    scene(g).on['press:go'][0].actions[0] = { physicsThrow: 'ball', velocity: [0, -500] };
    ok(check(g).some(x => x.startsWith('E-KEY-UNKNOWN')), check(g).join('; '));
  },
  'D28: physics.throw without physics in needs faults E-NEEDS-MISSING at play'() {
    const f = physicsScene(); delete f['experience.json'].needs; delete scene(f).addons;
    const p = play(f);
    eq(p.send('one', 'press:go').fault?.code, 'E-NEEDS-MISSING');
  },
};

// The tiny scene with a ball body; press:go throws it upwards through the door.
export function physicsScene() {
  const f = noIds();
  f['experience.json'].needs = ['physics'];
  f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', '<circle id="ball" data-hsvg-kind="part" data-hsvg-motion="move-x -100..100; move-y -400..0" cx="50" cy="300" r="10" fill="#000000"/></svg>');
  scene(f).addons = { physics: { bodies: { ball: { target: 'ball', shape: { kind: 'circle', radius: 10 }, rest: [0, 0], floor: 310, origin: [50, 300] } } } };
  scene(f).on['press:go'] = [{ actions: [{ call: 'physics.throw', with: { body: "'ball'", vx: 0, vy: -500 } }] }];
  return f;
}

// The tiny scene with a lamp whose fill fades from black to white and a ring that draws on, played on entry.
export function colourScene() {
  const f = noIds();
  f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', '<circle id="lamp" data-hsvg-kind="part" cx="50" cy="50" r="10" fill="#000000"/><circle id="ring" data-hsvg-kind="part" data-hsvg-motion="draw 0..1" cx="50" cy="50" r="20" fill="none" stroke="#000000" pathLength="1"/></svg>');
  scene(f).clips.glow = { durationMs: 1000, tracks: [
    { target: 'lamp', channel: 'color', as: 'fill', keys: [[0, '\'#000000\''], [1000, '\'#ffffff\'']] },
    { target: 'ring', channel: 'draw', start: 0.25, keys: [[0, 0], [1000, 1]] },
  ] };
  scene(f).entry = [{ play: 'glow' }];
  return f;
}
