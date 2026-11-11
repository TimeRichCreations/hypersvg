// The motion words the spec promises, built: the face binding (6.8, 9.3), the wipe channel (6.7),
// an authored clock's speed and paused (3.10, 5.12). The examples in examples/2.0-motion/ are the fixtures.
import fs from 'node:fs';
import path from 'node:path';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { loadExperience } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { eq, ok, mapSource, schemas, repo } from './helpers.mjs';

const example = (word) => {
  const dir = path.join(repo, 'examples', '2.0-motion', word);
  const out = {};
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else out[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
  walk(dir);
  return out;
};
const json = (files, k, edit) => { const d = JSON.parse(files[k]); edit(d); files[k] = JSON.stringify(d); };
function setup(word, edit, opts = {}) {
  const f = example(word);
  edit?.(f);
  const loaded = loadExperience(mapSource(f), schemas());
  ok(loaded.experience, loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
  const { reduced, ...rest } = opts;
  const p = new Player(loaded.experience, rest);
  if (reduced) p.state.ambient.reducedMotion = true;
  ok(p.start().ok);
  const d = new Drawing(p);
  d.mountScene(p.scene);
  d.paint();
  return { p, d, n: (id) => d.frames[p.scene].byLocal.get(id) };
}
const codes = (f) => checkExperience(mapSource(f), schemas()).diags.map(d => d.code);

export const tests = {
  // ---------- 1. face (6.8, 9.3) ----------
  'face: the example checks clean'() { eq(codes(example('face')), []); },
  'face: right is as drawn; left mirrors about the pivot, inside the channels, and the text reads the right way'() {
    const { p, d, n } = setup('face');
    eq(n('bee').attrs.transform, undefined, 'at rest, facing right as drawn');
    eq(n('tag').attrs.transform, undefined);
    p.advance(1000); d.paint();
    eq(n('bee').attrs.transform, 'translate(200 0)', 'flying right: only the channel');
    p.advance(1000); d.paint(); // at 2000 it turns
    eq(n('bee').attrs.transform, 'translate(400 0) translate(120 180) scale(-1 1) translate(-120 -180)', 'the mirror is about the pivot, after the move');
    eq([n('tag').attrs.transform, n('tag').attrs['text-anchor']], ['translate(200 0) scale(-1 1)', 'end'], 'the tag is turned back about its x, anchored at its end');
    p.advance(2000); d.paint(); // back at the start: facing right again
    eq(n('bee').attrs.transform, undefined);
    eq([n('tag').attrs.transform, n('tag').attrs['text-anchor']], [undefined, undefined], 'the tag is as drawn again');
  },
  'face: a mirrored part in a mirrored part leaves its text as drawn (two mirrors cancel)'() {
    const { d, n } = setup('face', (f) => {
      f['scenes/meadow/meadow.svg'] = f['scenes/meadow/meadow.svg'].replace('<text id="tag"', '<g id="inner" data-hsvg-kind="part" data-hsvg-pivot="110 226"><text id="tag"').replace('Bea</text>', 'Bea</text></g>');
      json(f, 'scenes/meadow/scene.json', (s) => { s.bindings = [{ id: 'bee-face', target: 'bee', scale: -1, axis: 'x' }, { id: 'inner-face', target: 'inner', scale: -1, axis: 'x' }]; });
    });
    ok(n('bee').attrs.transform.includes('scale(-1 1)') && n('inner').attrs.transform.includes('scale(-1 1)'));
    eq(n('tag').attrs.transform, undefined);
  },
  'face: a facing scale is a number: a word faults at paint (E-TYPE), and the checker refuses a literal one'() {
    const { d } = setup('face', (f) => json(f, 'scenes/meadow/scene.json', (s) => { s.values = {}; s.values.side = { type: 'string', maxLength: 8, initial: 'up' }; s.bindings[0].scale = 'side'; }));
    ok(d.faults.some(x => x.code === 'E-TYPE'), JSON.stringify(d.faults));
    const f = example('face');
    json(f, 'scenes/meadow/scene.json', (s) => { s.bindings[0].scale = "elapsed > 0 ? 'west' : 1"; });
    eq(codes(f).length, 1, 'one finding: a word is no mirror, and no scale range is drawn');
  },
  'face: under reduced motion the face still follows its value (a choice, not motion)'() {
    const { p, d, n } = setup('face', null, { reduced: true });
    p.advance(2000); d.paint();
    ok(n('bee').attrs.transform?.includes('scale(-1 1)'), String(n('bee').attrs.transform));
  },
  // ---------- 2. wipe (6.7) ----------
  'wipe: the example checks clean'() { eq(codes(example('wipe')), []); },
  'wipe: the part owns one clip path; its rectangle grows from the box\'s left edge with the share shown'() {
    const { p, d, n } = setup('wipe');
    const chart = n('chart');
    const id = `${chart.attrs.id}_wipe`;
    eq(chart.attrs['clip-path'], `url(#${id})`);
    const cp = chart.parent.children.find(c => c.name === 'clipPath');
    eq(cp.attrs.id, id);
    eq(cp.children[0].attrs, { x: '74', y: '54', width: '0', height: '252' }, 'the box 80..560 x 60..300, with the widest stroke (6) either side');
    p.advance(2000); d.paint();
    eq(cp.children[0].attrs.width, '492', 'all of it at the end');
    // one new id in the page, and the same clip path on every paint
    const ids = []; const walk = (x) => { if (!x.name) return; if (x.attrs.id) ids.push(x.attrs.id); x.children.forEach(walk); };
    walk(d.frames.map.root);
    eq(ids.filter(x => x.endsWith('_wipe')), [id]);
    eq(new Set(ids).size, ids.length, 'no id twice');
  },
  'wipe: half way through an ease-out key, the share is the eased value'() {
    const { p, d, n } = setup('wipe');
    p.advance(1000); d.paint();
    const w = Number(n('chart').parent.children.find(c => c.name === 'clipPath').children[0].attrs.width);
    ok(w > 492 * 0.5 && w < 492, `eased past the middle: ${w}`);
  },
  'wipe: under reduced motion the wipe ends at its last key at once'() {
    const { n } = setup('wipe', null, { reduced: true });
    eq(n('chart').parent.children.find(c => c.name === 'clipPath').children[0].attrs.width, '492');
  },
  'wipe: a binding drives it, with a glide'() {
    const { p, d, n } = setup('wipe', (f) => json(f, 'scenes/map/scene.json', (s) => {
      delete s.entry; delete s.clips;
      s.values = { shown: { type: 'number', minimum: 0, maximum: 1, initial: 0.25 }, on: { type: 'boolean', initial: true } };
      s.bindings = [{ id: 'map-shown', target: 'chart', as: 'wipe', draw: 'on ? shown : 1', glide: { durationMs: 100 } }];
    }));
    const rect = () => n('chart').parent.children.find(c => c.name === 'clipPath').children[0];
    eq(rect().attrs.width, '123');
    p.state.blocks.map.values.shown = 0.75; d.paint();
    p.advance(50); d.paint();
    eq(rect().attrs.width, '246', 'half way through the glide');
    p.advance(50); d.paint();
    eq(rect().attrs.width, '369');
    p.state.blocks.map.values.on = false; d.paint();
    p.advance(100); d.paint();
    eq(rect().attrs.width, '492');
    eq(d.faults, []);
  },
  'wipe: a stopped clip puts the drawn clip-path back'() {
    const { p, d, n } = setup('wipe', (f) => json(f, 'scenes/map/scene.json', (s) => { s.clips.unroll.loopMode = 'once'; }));
    p.advance(2100); d.paint();
    eq(n('chart').attrs['clip-path'], undefined);
  },
  'wipe: the checker refuses a wipe on a part that draws its own clip-path (E-WRITER)'() {
    const f = example('wipe');
    f['scenes/map/map.svg'] = f['scenes/map/map.svg'].replace('<g id="chart"', '<defs><clipPath id="round"><circle cx="320" cy="180" r="100"/></clipPath></defs><g id="chart" clip-path="url(#round)"');
    eq(codes(f), ['E-WRITER']);
  },
  // ---------- 3. authored clocks: speed and paused (3.10, 5.12) ----------
  'clock: the example checks clean'() { eq(codes(example('clock')), []); },
  'clock: at speed 0.5 the use\'s clip, timer and elapsed run at half speed; the scene runs at its own'() {
    const { p, d, n } = setup('clock');
    ok(p.send('farm', 'slowed').ok);
    p.advance(2000); d.paint();
    eq([p.eval('farm/mill', 'elapsed'), p.read('farm/mill', 'turns'), p.eval('farm', 'elapsed')], [1000, 0, 2000]);
    eq(rotation(d, 'sails'), 180, 'half a turn of the sails in 2 s');
    p.advance(2000); d.paint();
    eq([p.eval('farm/mill', 'elapsed'), p.read('farm/mill', 'turns')], [2000, 1], 'the 2 s timer fires after 4 s');
  },
  'clock: at speed 2 the use runs twice as fast'() {
    const { p, d, n } = setup('clock', (f) => json(f, 'scenes/farm/scene.json', (s) => { s.uses[0].clock.speed = 'slow ? 0.5 : 2'; }));
    p.advance(500); d.paint();
    eq([p.eval('farm/mill', 'elapsed'), rotation(d, 'sails')], [1000, 180]);
    p.advance(500);
    eq(p.read('farm/mill', 'turns'), 1, 'the 2 s timer fires after 1 s');
    p.advance(4000);
    eq(p.read('farm/mill', 'turns'), 5);
  },
  'clock: a speed change keeps the remaining local time of each deadline'() {
    const { p } = setup('clock');
    p.advance(1000); // 1000 of 2000 local ms run
    ok(p.send('farm', 'slowed').ok);
    p.advance(1999); eq(p.read('farm/mill', 'turns'), 0);
    p.advance(1); eq(p.read('farm/mill', 'turns'), 1, 'the last 1000 local ms take 2000 ms');
    eq(p.eval('farm/mill', 'elapsed'), 2000);
  },
  'clock: split and whole advances give the same events at speed 0.5'() {
    const whole = setup('clock').p; whole.send('farm', 'slowed'); whole.advance(9000);
    const split = setup('clock').p; split.send('farm', 'slowed'); for (let i = 0; i < 90; i++) split.advance(100);
    eq([split.read('farm/mill', 'turns'), split.eval('farm/mill', 'elapsed')], [whole.read('farm/mill', 'turns'), whole.eval('farm/mill', 'elapsed')]);
    eq(whole.read('farm/mill', 'turns'), 2);
  },
  'clock: paused holds the use and the blocks under it; it hears paused and resumed with the reason authored'() {
    const { p, d, n } = setup('clock');
    p.advance(500);
    ok(p.send('farm', 'holding').ok);
    eq(p.read('farm/mill', 'note'), 'Held (authored)');
    p.advance(5000); d.paint();
    eq([p.eval('farm/mill', 'elapsed'), p.read('farm/mill', 'turns'), rotation(d, 'sails'), p.eval('farm', 'elapsed')], [500, 0, 90, 5500], 'held at 500 ms; the scene goes on');
    ok(p.clockHeld('farm/mill') && !p.clockHeld('farm'));
    ok(p.send('farm', 'holding').ok);
    eq(p.read('farm/mill', 'note'), 'Turning');
    p.advance(1500);
    eq(p.read('farm/mill', 'turns'), 1);
  },
  'clock: the host pause holds a use at speed 0.5 on top of its speed'() {
    const { p } = setup('clock');
    p.send('farm', 'slowed');
    p.advance(1000);
    p.setPause('host', true); p.advance(10000); p.setPause('host', false);
    eq([p.eval('farm/mill', 'elapsed'), p.read('farm/mill', 'note')], [500, 'Turning']);
    p.advance(3000);
    eq(p.read('farm/mill', 'turns'), 1);
  },
  'clock: an authored pause and a dialog pause add up; resumed comes when the last clears, with its reason'() {
    const p = shellPlayer(); ok(p.start().ok);
    p.send('a', 'hold');                       // authored
    p.send('frame', 'gear');                   // and the dialog
    p.advance(1000); eq(p.scene, 'a', 'the timed link waits');
    p.send('a', 'letGo');                      // the dialog still holds it
    p.advance(1000); eq(p.scene, 'a');
    p.send('a', 'closeIt');
    eq(p.read('a', 'heard'), 'paused:authored resumed:dialog ');
    p.advance(499); eq(p.scene, 'a');
    p.advance(1); eq(p.scene, 'b', '500 ms of the scene\'s time after entry');
    const q = shellPlayer(); q.start();
    q.send('frame', 'gear'); q.send('a', 'hold'); q.send('a', 'closeIt'); q.advance(5000); eq(q.scene, 'a');
    q.send('a', 'letGo');
    eq(q.read('a', 'heard'), 'paused:dialog resumed:authored ');
    q.advance(500); eq(q.scene, 'b');
  },
  'clock: the checker proves a scene clock\'s speed (E-CLOCK-SPEED) and that paused is a boolean'() {
    const f = example('clock');
    json(f, 'scenes/farm/scene.json', (s) => { s.values.rate = { type: 'number', minimum: 0, maximum: 200, initial: 1 }; s.clock = { speed: 'rate', paused: 'rate' }; });
    eq(codes(f).sort(), ['E-CLOCK-SPEED', 'E-TYPE']);
  },
  // ---------- 4. the scroll source: a 2.1 draft (3.10) ----------
  'scroll: a clock\'s source and spanMs are refused as a 2.1 draft (E-DRAFT), on a scene and on a use'() {
    const f = example('clock');
    json(f, 'scenes/farm/scene.json', (s) => { s.clock = { source: 'scroll', spanMs: 12000 }; s.uses[0].clock = { source: 'scroll', spanMs: 500 }; });
    const d = checkExperience(mapSource(f), schemas()).diags;
    eq(d.map(x => [x.code, x.path]).sort(), [['E-DRAFT', 'clock.source'], ['E-DRAFT', 'clock.spanMs'], ['E-DRAFT', 'uses[0].clock.source'], ['E-DRAFT', 'uses[0].clock.spanMs']]);
    ok(d.every(x => x.message.includes('spec/2.0/drafts/scroll-clock-2.1.json')), d.map(x => x.message).join('; '));
  },
  'scroll: the draft is valid JSON and has its row in the status table'() {
    const draft = JSON.parse(fs.readFileSync(path.join(repo, 'spec', '2.0', 'drafts', 'scroll-clock-2.1.json'), 'utf8'));
    eq([draft.format, draft.id], ['hsvg/2.1-draft', 'scroll-clock']);
    ok(fs.readFileSync(path.join(repo, 'spec', '2.0', 'README.md'), 'utf8').includes('| 3.10 | draft (2.1) | `spec/2.0/drafts/scroll-clock-2.1.json` |'));
  },
};
// The rotation of a part of the windmill, in degrees, from its transform (0 when it has none).
function rotation(d, id) { const m = /rotate\(([-\d.e]+)\)/.exec(d.frames['farm/mill'].byLocal.get(id).attrs.transform || ''); return m ? Math.round(Number(m[1]) * 1e6) / 1e6 : 0; }
// A shell whose settings dialog pauses the stage (10.1), and scene a, which may hold its own clock (3.10) and logs
// what it hears; a timed link leaves a for b after 500 ms of a's time.
function shellPlayer() {
  const shell = { format: 'hsvg/2.0', kind: 'shell', id: 'frame', needs: ['shell'], drawing: 'frame.svg',
    slots: { stage: { kind: 'stage', label: 'Stage' }, settings: { kind: 'dialog', label: 'Settings', openValue: 'settingsOpen', pauses: true } },
    values: { settingsOpen: { type: 'boolean', initial: false } },
    on: { gear: [{ id: 'o', actions: [{ id: 'o1', open: 'settings' }] }] } };
  const scene = (id, extra = {}) => ({ file: `${id}.json`, doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, ...extra }, drawings: {}, words: {} });
  const log = (name) => [{ id: name, actions: [{ id: `${name}1`, set: 'heard', to: `heard + '${name}:' + event.reason + ' '` }] }];
  return new Player({
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['shell'], shell: 'frame.json',
      story: { start: 'a', scenes: { a: 'a.json', b: 'b.json' }, ends: ['b'], links: [{ id: 'a-b', from: 'a', afterMs: 500, to: 'b' }] } },
    words: { en: {} }, data: {}, blocks: {}, shell: { file: 'frame.json', doc: shell, drawings: {}, words: {} },
    scenes: { a: scene('a', { values: { held: { type: 'boolean', initial: false }, heard: { type: 'string', initial: '' } }, clock: { paused: 'held' },
      on: { paused: log('paused'), resumed: log('resumed'),
        hold: [{ id: 'h', actions: [{ id: 'h1', set: 'held', to: 'true' }] }], letGo: [{ id: 'l', actions: [{ id: 'l1', set: 'held', to: 'false' }] }],
        closeIt: [{ id: 'c', actions: [{ id: 'c1', close: 'settings' }] }] } }), b: scene('b') },
  });
}
