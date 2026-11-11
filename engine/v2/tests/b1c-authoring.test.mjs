// The authoring surface people write (D31). Item 1: words and formulas, decided by the slot's declaration.
// Item 2: motion ranges with two dots. Item 3: three inferences (an event a link hears, ends, grants from use).
// Item 4: optional ids on story links. Item 5: words that looked built: built, or refused as 2.1 drafts.
// Item 6: the cuts with engine or content effect (compound into component, the earlier page marks, one content selector).
// Item 7: messages (one cause, one finding; rules in words; the valid words; the author's key; file:line:col).
import { textSlot, slotFormula, isTextDecl } from '../src/formula.mjs';
import { withForm } from '../tools/change/targets.mjs';
import { motionEntries, parseMotion, motionDots } from '../src/physics.mjs';
import { parseMotion as checkerMotion } from '../check/formula/motion.mjs';
import { eq, ok, throwsCode, mapSource, schemas } from './helpers.mjs';
import { checkExperience } from '../check/index.mjs';
import { Drawing } from '../src/drawing.mjs';
import { stageFocus } from '../web/input-web.mjs';
import { marksOf } from '../src/host.mjs';
import { usedGrants, withUsedGrants } from '../src/grants-asked.mjs';
import { endsOf } from '../src/ends.mjs';
import { pack } from '../tools/pack.mjs';
import { toFolder } from './b1a-format.test.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { describe } from '../check/diagnostics.mjs';
import { base } from './check-refs.test.mjs';
import { scene, check, play } from './b1a-format.test.mjs';

const errors = (f) => check(f).filter(x => x.startsWith('E-'));

// A scene with a text value, a number value and an option control that writes the text value.
function words() {
  const f = base();
  const s = scene(f);
  s.values.label = { type: 'string', maxLength: 20, initial: '' };
  s.values.mood = { type: 'string', maxLength: 8, enum: ['calm', 'glad'], initial: 'calm' };
  s.on['press:go'][0].actions.push(
    { id: 'name-it', set: 'label', to: "'Fox at dawn'" },
    { id: 'cheer-up', set: 'mood', to: "score > 0 ? 'glad' : 'calm'" },
  );
  return f;
}


// Two scenes: one sends done (a control's press, then emit) and a link takes it to two.
function twoScenes() {
  const f = base();
  const e = f['experience.json'];
  e.story = { start: 'one', scenes: { one: 'scenes/one/scene.json', two: 'scenes/two/scene.json' }, links: [{ id: 'on', from: 'one', on: 'done', to: 'two' }], ends: ['two'] };
  f['scenes/two/scene.json'] = { format: 'hsvg/2.0', kind: 'scene', id: 'two', drawing: 'two.svg' };
  f['scenes/two/two.svg'] = f['scenes/one/one.svg'];
  return f;
}

// Findings with file, line, column and pointer, as the check tool prints them.
function described(f) { const src = mapSource(f); return describe(checkExperience(src, schemas()).diags, src); }

export const tests = {
  // ---------- 1. words and formulas (D31.1) ----------
  'item 1 (D36): every value slot holds a formula, whatever its declaration'() {
    eq(slotFormula({ type: 'string' }, "'It\\'s here'"), "'It\\'s here'");
    eq(slotFormula({ type: 'string' }, 'cta'), 'cta');
    eq(slotFormula({ type: 'number' }, 'score + 1'), 'score + 1', 'a number slot keeps its formula');
    eq(textSlot('Hi {{ name }}!'), { template: 'Hi {{ name }}!' }, 'templates are for words a person reads');
    ok(isTextDecl({ type: 'string' }) && !isTextDecl({ type: 'number' }) && !isTextDecl(undefined));
  },
  'item 1 (D36): a set into a text value takes a formula, text in single quotes'() {
    const f = words();
    eq(errors(f), []);
    const p = play(f);
    ok(p.send('one', 'press:go').ok);
    eq([p.scope('one').name('label'), p.scope('one').name('mood'), p.scope('one').name('score')], ['Fox at dawn', 'glad', 1]);
  },
  'item 1 (D36): text and values join with +, and a number beside text is printed'() {
    const f = words();
    scene(f).on['press:go'][0].actions.push({ id: 'say-score', set: 'label', to: "'Score ' + score + ' of 9'" });
    eq(errors(f), []);
    const p = play(f);
    ok(p.send('one', 'press:go').ok);
    eq(p.scope('one').name('label'), 'Score 1 of 9');
  },
  'item 1 (D36): a use passes a formula to a text input of the block: quoted text, one name, or a join'() {
    for (const [given, shown] of [["'Hello there'", 'Hello there'], ['words.go', 'Go'], ["'Tap ' + words.go", 'Tap Go']]) {
      const f = base();
      scene(f).uses[0].with.title = given;
      eq(errors(f), [], given);
      const p = play(f);
      eq(p.scope('one/badge').name('title'), shown, given);
    }
  },
  'item 1 (D36): a choice writes its option value, a formula, into a text value'() {
    const f = words();
    scene(f).controls.pick = { kind: 'choice', value: 'mood', options: { calm: { target: 'go', value: "'calm'" }, glad: { target: 'badge-spot', value: "'glad'" } } };
    eq(errors(f), []);
    const p = play(f);
    ok(p.activate('one', 'pick', 'glad').ok);
    eq(p.scope('one').name('mood'), 'glad');
    eq(p.optionValue('one', scene(f).controls.pick, scene(f).controls.pick.options.calm), 'calm');
  },
  'item 1 (D36): the checker and the engine agree: a value slot is a formula, never words'() {
    // A text value: text outside its enum, a number formula, unquoted words and a template are refused.
    const out = (to) => { const f = words(); scene(f).on['press:go'][0].actions[7].to = to; return errors(f); };
    eq(out("'sad'"), ['E-RANGE /on/press:go/0/actions/7/to']);
    eq(out('score'), ['E-TYPE /on/press:go/0/actions/7/to']);
    eq(out('Fox at dawn'), ['E-FORMULA /on/press:go/0/actions/7/to']);
    eq(out('{{ score }}'), ['E-FORMULA /on/press:go/0/actions/7/to']);
    // A number value: the same words are a formula.
    const f = words();
    scene(f).on['press:go'][0].actions.push({ id: 'bad', set: 'score', to: "'Fox at dawn'" });
    eq(errors(f), ['E-TYPE /on/press:go/0/actions/8/to']);
    // {{ }} in a number slot says the slot holds a formula.
    const g = words();
    scene(g).on['press:go'][0].actions.push({ id: 'bad', set: 'score', to: '{{ score + 1 }}' });
    const d = check(g);
    ok(d.includes('E-FORMULA /on/press:go/0/actions/8/to'), d);
  },
  'item 1 (D36): the change tool writes a string into with quoted'() {
    eq(withForm('Rain? Go!', { type: 'string' }), "'Rain? Go!'");
    eq(withForm('x', { type: 'array' }), "'x'");
    eq(withForm(3, { type: 'number' }), 3);
  },

  // ---------- 2. motion ranges with two dots (D31.3) ----------
  'item 2: a motion range is a channel, then min..max; entries are split by semicolons; rotate * turns freely'() {
    eq(motionEntries('scale 1..1.2; rotate -6..6; move-y -60..0'), [{ channel: 'scale', lo: 1, hi: 1.2 }, { channel: 'rotate', lo: -6, hi: 6 }, { channel: 'move-y', lo: -60, hi: 0 }]);
    eq(motionEntries('rotate *;'), [{ channel: 'rotate', free: true }], 'a last semicolon is allowed');
    eq(motionEntries('scale(1 1.2)'), null, 'the old spelling is not read');
    eq(parseMotion('move-x -40..40; move-y -40..40; opacity 0.2..1'), { 'translate-x': [-40, 40], 'translate-y': [-40, 40], opacity: [0.2, 1] });
    eq(checkerMotion('scale 0.5..2; rotate *'), { scale: { lo: 0.5, hi: 2 }, rotate: 'free', 'scale-x': { lo: 0.5, hi: 2 }, 'scale-y': { lo: 0.5, hi: 2 } });
    eq(motionDots('scale(1 1.2) rotate(-6 6) translate(60) rotate(*)'), 'scale 1..1.2; rotate -6..6; translate -60..60; rotate *');
    eq(motionDots('scale 1..1.2'), null, 'the new spelling has no old form');
  },
  'item 2: the old spelling is refused, and the message shows the new form'() {
    const f = base();
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('data-hsvg-motion="rotate -90..90"', 'data-hsvg-motion="rotate(-90 90)"');
    const src = mapSource(f);
    const d = describe(checkExperience(src, schemas()).diags, src).filter(x => x.code === 'E-MARK-VALUE');
    eq(d.length, 1);
    ok(/old spelling; write "rotate -90\.\.90"/.test(d[0].message), d[0].message);
    ok(d[0].line > 0 && d[0].column > 0, `with its line and column: ${JSON.stringify(d[0])}`);
  },
  'item 2: a part with the new spelling plays inside its range: a clip key at the edge is clean, past it is E-MOTION-RANGE'() {
    const f = base();
    eq(errors(f), []);
    scene(f).clips.wave.tracks[0].keys = [[0, 0], [500, 90]];
    eq(errors(f), []);
    scene(f).clips.wave.tracks[0].keys = [[0, 0], [500, 91]];
    eq(errors(f), ['E-MOTION-RANGE /clips/wave/tracks/0/keys/1/1']);
    const p = play(base());
    ok(p.send('one', 'press:go').ok);
  },

  // ---------- 3. three inferences (D31.4) ----------
  'item 3: an event a scene sends and a link hears needs no outputs entry; the link plays'() {
    const f = twoScenes();
    delete scene(f).outputs;
    eq(errors(f), []);
    const p = play(f);
    ok(p.send('one', 'press:go').ok);
    eq(p.scene, 'two');
    // A link on an event nothing sends still says how to send it.
    const g = twoScenes();
    g['experience.json'].story.links[0].on = 'gone';
    const d = checkExperience(mapSource(g), schemas()).diags.filter(x => x.code === 'E-REF-UNKNOWN');
    ok(d.length === 1 && /send it from one with a control's "event" or an emit action \(\{"emit": "gone"\}\)/.test(d[0].message), d.map(x => x.message));
  },
  'item 3: ends is optional: a scene with no way out is an ending, for the checker and the player'() {
    const f = twoScenes();
    delete f['experience.json'].story.ends;
    eq(endsOf(f['experience.json'].story), ['two']);
    eq(check(f), []);
    const p = play(f);
    ok(p.send('one', 'press:go').ok);
    ok(p.outputsLog.some(o => o.name === 'ended' && o.scene === 'two'), 'two ends the story');
    // Every scene with a way out and no ends: no ending.
    f['scenes/two/scene.json'].controls = { go: { kind: 'button', target: 'go', event: 'back', label: 'Back' } };
    f['experience.json'].story.links.push({ id: 'back', from: 'two', on: 'back', to: 'one' });
    ok(check(f).includes('E-STORY-NO-END story.ends'), check(f));
    // With ends written, a dead end is still refused, and the message says ends may be left out.
    const g = twoScenes();
    g['experience.json'].story.ends = ['one'];
    const d = checkExperience(mapSource(g), schemas()).diags.find(x => x.code === 'E-STORY-DEAD-END');
    ok(d && /leave ends out/.test(d.message), d?.message);
  },
  'item 3: an ending (no ends written) that sends an event no link hears warns W-STORY-UNHEARD'() {
    const f = twoScenes();
    delete f['experience.json'].story.ends;
    f['scenes/two/scene.json'].controls = { go: { kind: 'button', target: 'go', event: 'next', label: 'Next' } };
    eq(check(f).filter(x => x.startsWith('W-')), ['W-STORY-UNHEARD story.scenes.two']);
    f['scenes/two/scene.json'].on = { next: [{ actions: [{ set: 'flag', to: "'!flag'" }] }] };
    eq(check(f).filter(x => x.startsWith('W-')), [], 'the scene hears it itself');
  },
  'item 3: openUrl and storage are asked for from use; a written openUrl false is kept; the packer writes them'() {
    const f = twoScenes();
    scene(f).values.best = { type: 'number', initial: 0, minimum: 0, maximum: 9, lifetime: 'saved' };
    f['experience.json'].inputs.link = { kind: 'content', type: 'string', contentType: 'url', maxLength: 200, initial: 'https://example.com/' };
    f['scenes/two/scene.json'].controls = { go: { kind: 'button', target: 'go', label: 'Open' } };
    f['scenes/two/scene.json'].on = { 'press:go': [{ actions: [{ call: 'player.openUrl', with: {field: "'link'"} }] }] };
    const exp = { doc: f['experience.json'], scenes: { one: { doc: scene(f) }, two: { doc: f['scenes/two/scene.json'] } } };
    eq(usedGrants(exp), { openUrl: true, storage: ['saved'] });
    eq(withUsedGrants(exp).derived, { openUrl: true, storage: ['saved'] });
    eq(errors(f), [], 'no grants written: the use asks');
    f['experience.json'].grants = { openUrl: false };
    ok(errors(f).some(x => x.startsWith('E-GRANT')), 'a written no stays');
    delete f['experience.json'].grants;
    const dir = toFolder(f); const out = path.join(dir, 'out');
    return pack(dir, out, { test: true }).then(() => {
      const d = JSON.parse(fs.readFileSync(path.join(out, 'package.json'), 'utf8'));
      eq(d.grants, { openUrl: true, storage: ['saved'] });
      fs.rmSync(dir, { recursive: true, force: true });
    });
  },

  // ---------- 4. optional ids on story links (P1 "Optional ids") ----------
  'item 4: a story link needs no id; it is keyed by its place; a choice link and a link with max still need one'() {
    const f = twoScenes();
    delete f['experience.json'].story.links[0].id;
    eq(errors(f), []);
    const p = play(f);
    ok(p.send('one', 'press:go').ok);
    eq(p.scene, 'two');
    ok(p.outputsLog.some(o => o.name === 'entered' && o.link === 'links[0]'), 'the entered output names its place');
    const g = twoScenes();
    g['experience.json'].story.links = [{ from: 'one', on: 'done', to: 'two', max: 1 }, { from: 'one', choice: 'Go on', to: 'two' }];
    const d = checkExperience(mapSource(g), schemas()).diags.filter(x => x.code === 'E-KEY-REQUIRED');
    eq(d.map(x => x.path), ['story.links[0]', 'story.links[1]']);
    ok(/needs an id because it has max/.test(d[0].message) && /needs an id because it is a choice/.test(d[1].message), d.map(x => x.message));
  },

  // ---------- 5. words that looked built but were not (P1) ----------
  'item 5: the unbuilt words are 2.1 drafts: E-DRAFT names the draft, never an unknown key'() {
    const f = base();
    const e = f['experience.json']; const s = scene(f);
    e.report = { completed: 'flag' }; e.clickArea = 'level';
    s.endHoldMs = 500; s.choiceRegion = 'go'; s.choicesAtMs = 100;
    Object.assign(s.clips.wave, { timeRemap: [[0, 0], [500, 500]], frameRate: 12, holdFrames: 2, blendMs: 100 });
    Object.assign(s.clips.wave.tracks[0], { wiggle: { amplitude: 1, periodMs: 100, seed: 1 }, composite: 'add' });
    const d = checkExperience(mapSource(f), schemas()).diags;
    const drafts = d.filter(x => x.code === 'E-DRAFT');
    eq(drafts.map(x => x.path).sort(), ['choiceRegion', 'choicesAtMs', 'clickArea', 'clips.wave.blendMs', 'clips.wave.frameRate', 'clips.wave.holdFrames', 'clips.wave.timeRemap', 'clips.wave.tracks[0].composite', 'clips.wave.tracks[0].wiggle', 'endHoldMs', 'report']);
    ok(drafts.every(x => /is not in 2\.0; a 2\.1 draft \(spec\/2\.0\/drafts\/[a-z-]+-2\.1\.json\)/.test(x.message)), drafts.map(x => x.message));
    eq(d.filter(x => x.code === 'E-KEY-UNKNOWN'), [], 'one cause, one code');
  },

  'item 5: glide: a channel binding reaches a new value over durationMs; under reduced motion it jumps'() {
    const make = () => {
      const f = base();
      f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('data-hsvg-motion="rotate -90..90"', 'data-hsvg-motion="rotate -90..90; move-x -100..100"');
      scene(f).bindings.push({ target: 'go', axis: 'x', move: 'clamp(score * 80, 0, 100)', glide: { durationMs: 1000 } });
      return f;
    };
    eq(errors(make()), []);
    const run = (reduced) => {
      const p = play(make()); if (reduced) p.setAmbient('reducedMotion', true);
      const d = new Drawing(p); d.mountScene('one'); d.paint();
      const n = d.frames.one.byLocal.get('go');
      const at = [];
      p.send('one', 'press:go'); d.paint(); at.push(n.attrs.transform);
      p.advance(500); d.paint(); at.push(n.attrs.transform);
      p.advance(600); d.paint(); at.push(n.attrs.transform);
      return at;
    };
    eq(run(false), [undefined, 'translate(40 0)', 'translate(80 0)']);
    eq(run(true), ['translate(80 0)', 'translate(80 0)', 'translate(80 0)']);
  },
  'item 5: firstFocus: a new scene takes focus at its firstFocus control, else its first; the checker names the control'() {
    const order = [{ addr: 'one', cid: 'a' }, { addr: 'one', cid: 'b' }, { addr: 'shell', cid: 'x' }];
    eq(stageFocus(order, 'one', 'b'), order[1]);
    eq(stageFocus(order, 'one', 'nothing'), order[0]);
    eq(stageFocus(order, 'one'), order[0]);
    const f = base(); scene(f).firstFocus = 'go';
    eq(errors(f), []);
    scene(f).firstFocus = 'stop';
    eq(errors(f), ['E-REF-UNKNOWN firstFocus']);
  },
  'item 5: a chapter copies its transition, length and slideFrom into the links it builds'() {
    const f = twoScenes();
    const e = f['experience.json'];
    e.story.links = [];
    e.story.chapters = [{ id: 'tour', scenes: ['one', 'two'], next: 'done', transition: 'slide', transitionMs: 300, slideFrom: 'start' }];
    const p = play(f);
    const l = p.links.find(x => x.chapter === 'tour' && x.dir === 1);
    eq([l.transition, l.transitionMs, l.slideFrom], ['slide', 300, 'start']);
  },
  'item 5: a trigger on a repeated use fires every row, or the row itemKey names'() {
    const make = (itemKey) => {
      const f = base();
      scene(f).uses = [{ id: 'badge', use: 'badge', into: 'badge-spot', items: "['a', 'b']", key: 'item', with: { title: 'item' } }];
      const b = f['blocks/badge/component.json'];
      b.values = { hits: { type: 'number', initial: 0, minimum: 0, maximum: 9 } };
      b.on = { celebrate: [{ actions: [{ set: 'hits', to: 'hits + 1' }] }] };
      scene(f).on['press:go'][0].actions = [{ emit: 'badge.celebrate', as: 'trigger', ...(itemKey ? { itemKey } : {}) }];
      return f;
    };
    const hits = (f) => { const p = play(f); ok(p.send('one', 'press:go').ok); return ['a', 'b'].map(k => p.scope(`one/badge[${k}]`).name('hits')); };
    eq(hits(make()), [1, 1]);
    eq(hits(make("'b'")), [0, 1]);
  },
  'item 5: case on a plain text binding shows the text upper or lower; the accessible name keeps it'() {
    const f = base();
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', '<text id="say" x="0" y="20">x</text></svg>');
    scene(f).bindings.push({ target: 'say', text: 'Straße {{ words.go }}', case: 'upper' });
    const p = play(f); const d = new Drawing(p); d.mountScene('one'); d.paint();
    const n = d.frames.one.byLocal.get('say');
    eq([n.children[0].text, n.attrs['aria-label']], ['STRASSE GO', 'Straße Go']);
  },

  // ---------- 6. the cuts with engine or content effect ----------
  'item 6: compound is component: the old kind is refused with the new one named; component plays as before'() {
    const f = base();
    const b = f['blocks/badge/badge.svg'];
    ok(/data-hsvg-kind="component"/.test(b));
    f['blocks/badge/badge.svg'] = b.replace('data-hsvg-kind="component"', 'data-hsvg-kind="compound"');
    const d = checkExperience(mapSource(f), schemas()).diags.filter(x => x.file === 'blocks/badge/badge.svg');
    ok(d.some(x => /data-hsvg-kind="compound" is now component \(D31\): write data-hsvg-kind="component"/.test(x.message)), d.map(x => x.message));
    ok(!JSON.parse(JSON.stringify(schemas())).kinds?.compound, 'no compound schema');
  },
  'item 6: the earlier page marks are not read; data-hsvg-hook is'() {
    const el = (attrs) => ({ getAttribute: (n) => attrs[n] ?? null });
    eq(marksOf(el({ 'data-hsvg-target': 'email' })), []);
    eq(marksOf(el({ 'data-hsvg-hook': 'target:email' })), [{ kind: 'target', name: 'email' }]);
  },
  'item 6: one content selector: the content axis picks by space or input; host and person are refused'() {
    const f = base();
    for (const select of ['host', 'person']) { f['experience.json'].axes = [{ axis: 'content', select }]; eq(check(f), ['E-RANGE axes[0].select'], select); }
    f['experience.json'].axes = [{ axis: 'content', select: 'space' }];
    eq(check(f), []);
    f['experience.json'].axes = [{ axis: 'language', select: 'host' }];
    eq(check(f), [], 'other axes keep host');
  },

  // ---------- 7. messages (P1 "Messages", F0, F0b) ----------
  'item 7: a story with no links is one finding per dead end, with its consequences folded in'() {
    const f = twoScenes();
    const e = f['experience.json']; e.story.links = []; e.story.ends = ['two'];
    const d = described(f).filter(x => x.code.startsWith('E-STORY'));
    eq(d.map(x => x.code), ['E-STORY-DEAD-END']);
    ok(/^the story has no links: one has no outgoing link and is not in ends.*; so two is never reached, and no ending is reachable from one\. A link goes from a scene on an event to the next: \{"from": "one"/.test(d[0].message), d[0].message);
    ok(d[0].line > 0 && d[0].column > 0, 'with its line and column');
  },
  'item 7: a wrong channel is one E-TYPE; a missing range is one finding per part and channel, with the form to add'() {
    const f = base();
    scene(f).clips.wave.tracks.push({ target: 'go', channel: 'y', keys: [[0, 0], [100, 1], [200, 2]] });
    eq(errors(f), ['E-TYPE clips.wave.tracks[1].channel']);
    const g = base();
    scene(g).clips.wave.tracks.push({ target: 'go', channel: 'scale', keys: [[0, 1], [100, 1.1], [200, 1.2]] });
    const d = described(g).filter(x => x.code === 'E-MOTION-RANGE');
    eq(d.length, 1);
    ok(/part go has no motion range for scale; add it to the part's data-hsvg-motion, as "scale 1\.\.1\.2"/.test(d[0].message) && !/layout main/.test(d[0].message), d[0].message);
  },
  'item 7: naming rules are said in words; an unknown action lists the action words and how to change scene'() {
    const f = base();
    scene(f).controls.pickA = { kind: 'button', target: 'go', label: 'x', event: 'picked-a' };
    scene(f).on['press:go'][0].actions.push({ go: 'two' });
    const d = described(f);
    const m = (p) => d.find(x => x.pointer === p)?.message || '';
    ok(/"pickA" is not a name of lower-case letters and digits with dashes between words, as pick-a/.test(m('/controls/pickA')), m('/controls/pickA'));
    ok(/"picked-a" is not a camelCase name with no dashes, as pickA/.test(m('/controls/pickA/event')), m('/controls/pickA/event'));
    const act = m('/on/press:go/0/actions/6');
    ok(/The actions are call, close, emit, if, open, play, set, stop\. To change scene, emit an event/.test(act), act);
    ok(d.every(x => !/does not match \^/.test(x.message)), 'no pattern is shown');
  },
  'item 7: openUrl with an address says to declare a url input; a link carry says what it reads'() {
    const f = base();
    scene(f).on['press:go'][0].actions.push({ call: 'player.openUrl', with: {field: "'https://example.com/order'"} });
    const m = described(f).find(x => x.pointer === '/on/press:go/0/actions/6/with/field')?.message || '';
    ok(/player.openUrl's field names an input of the experience whose contentType is url, not an address/.test(m) && /"call": "player.openUrl", "with": {"field": "'clickUrl'"}/.test(m), m);
    const g = twoScenes();
    g['experience.json'].story.links[0].carry = { score: 'points' };
    const c = described(g).filter(x => x.code === 'E-REF-UNKNOWN').map(x => x.message);
    ok(c.some(x => /carry names score, which is no input of two.*experience's values/.test(x)), c);
    ok(c.some(x => /points is not a name in this scope; a link's when and carry read the event/.test(x)), c);
  },
  'item 7: E-KIT-PIN says the rule and the fix'() {
    // The message text, as kits.mjs writes it.
    const src = fs.readFileSync(new URL('../check/kits.mjs', import.meta.url), 'utf8');
    ok(/stays the library.{1,2}s: its files may not change under the pin \(4\.8\)\. If you meant to change it, make a new version of the library/.test(src));
  },
};
