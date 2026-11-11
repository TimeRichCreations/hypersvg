// The engine and checker follow-ups before the freeze: the checker agrees with the engine.
import { checkExperience } from '../check/index.mjs';
import { Player } from '../src/story.mjs';
import { Engine } from '../src/runtime.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { schemas, eq, ok, mapSource, repo } from './helpers.mjs';
import { absentAddons, addonHeld, knownAbsent, absentCall } from '../check/absent.mjs';
import { checkManifest } from '../src/addons.mjs';

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>One</title>${body}</svg>`;
// A small experience: one scene with a button, a value and a text; `edit` changes it before the check.
function files(edit = (f) => f) {
  return edit({
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'tiny', language: 'en', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' } } },
    'scenes/one/scene.json': {
      format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      values: { slow: { type: 'boolean', initial: false } },
      controls: { go: { kind: 'button', target: 'go', label: 'Go' } },
      on: { 'press:go': [{ actions: [{ set: 'slow', to: 'true' }] }] },
    },
    'scenes/one/one.svg': svg('<rect id="go" data-hsvg-kind="part" width="40" height="40"/><text id="note" data-hsvg-kind="part" x="10" y="80">x</text>'),
  });
}
const scene = (f) => f['scenes/one/scene.json'];
const check = (f) => checkExperience(mapSource(f), schemas()).diags;
// A story whose scene `stop` waits 1000 ms in a machine timer and visits `fix` on `flat`; `fixed` returns.
const visiting = () => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'v', language: 'en', story: { start: 'stop', scenes: { stop: 'stop.json', fix: 'fix.json' }, links: [
    { from: 'stop', on: 'flat', to: 'fix', visit: true }, { from: 'fix', on: 'fixed', return: true }] } },
  words: { en: {} }, data: {}, blocks: {},
  scenes: {
    stop: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'stop', drawing: 'stop.svg', outputs: { flat: { kind: 'event' } },
      machines: { t: { initial: 'w', states: { w: { after: [{ delayMs: 1000, target: 'done' }] }, done: {} } } } }, words: {} },
    fix: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'fix', drawing: 'fix.svg', outputs: { fixed: { kind: 'event' } } }, words: {} },
  },
});
const factor = (p, v) => ok(p.applySettings([['timeLimits', v]], 'host').ok);
const say = (d) => d.map(x => `${x.code} ${x.path} ${x.message}`).join(' | ');

export const tests = {
  'item 1: the small experience checks clean'() { eq(say(check(files())), ''); },
  'item 1: a file that reads and sets hsvg.timeLimits checks clean (10.13, 5.5, 5.15.1)'() {
    const d = check(files((f) => {
      const s = scene(f);
      s.computed = { longer: 'hsvg.timeLimits > 1', factor: 'timeLimits * 2' };
      s.bindings = [{ target: 'note', text: 'Time x{{ hsvg.timeLimits }}' }];
      s.on['press:go'][0].actions.push({ call: 'player.setting', with: {timeLimits: "hsvg.timeLimits === 0 ? 1 : 0"} });
      s.on['changed:hsvg.timeLimits'] = [{ actions: [{ set: 'slow', to: "hsvg.timeLimits > 1" }] }];
      return f;
    }));
    eq(say(d), '');
  },
  'item 1: a setting of timeLimits must be a number'() {
    const d = check(files((f) => { scene(f).on['press:go'][0].actions.push({ call: 'player.setting', with: {timeLimits: 'true'} }); return f; }));
    ok(d.some(x => x.code === 'E-TYPE'), say(d));
  },
  'item 1: a new timeLimits rescales a visiting caller\'s saved timers at once (10.13)'() {
    const p = visiting(); ok(p.start().ok);
    p.advance(200); p.send('stop', 'flat'); eq(p.scene, 'fix');
    factor(p, 2); // 800 ms written are left: 1600 now
    p.send('fix', 'fixed'); eq(p.scene, 'stop');
    p.advance(1599); ok(p.isActive('stop', 'w'), 'the caller\'s timer took the new factor');
    p.advance(1); ok(p.isActive('stop', 'done'));
  },
  'item 1: timeLimits 0 during a visit keeps the caller\'s timer off after the return, and a factor starts it again'() {
    const p = visiting(); ok(p.start().ok);
    p.advance(400); p.send('stop', 'flat');
    factor(p, 0);
    p.send('fix', 'fixed'); eq(p.scene, 'stop');
    p.advance(100000); ok(p.isActive('stop', 'w'), 'off');
    factor(p, 1);
    p.advance(599); ok(p.isActive('stop', 'w'));
    p.advance(1); ok(p.isActive('stop', 'done'), 'its 600 written ms ran');
  },
  'item 1: a timer turned off before a visit stays off through the visit and starts again with a factor'() {
    const p = visiting(); ok(p.start().ok);
    p.advance(300); factor(p, 0);
    p.send('stop', 'flat'); p.advance(50000); p.send('fix', 'fixed');
    p.advance(50000); ok(p.isActive('stop', 'w'));
    factor(p, 3); p.advance(2099); ok(p.isActive('stop', 'w')); p.advance(1); ok(p.isActive('stop', 'done'));
  },
  'item 2 (D36): a call\'s string input is a formula in the checker too: quoted text, a name, and bare words refused'() {
    const effect = (src) => check(files((f) => {
      f['experience.json'].needs = ['effects'];
      f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', '<defs><g id="dot" data-hsvg-kind="part" data-hsvg-motion="move-x 0..100; move-y 0..100; opacity 0..1"><circle r="3"/></g></defs><g id="sky" data-hsvg-kind="part"/></svg>');
      const s = scene(f);
      s.values.which = { type: 'string', initial: 'pop', maxLength: 8 };
      s.addons = { effects: { particles: { pop: { target: 'sky', source: 'dot', seed: 1, count: 4, position: [50, 50], start: 'play', reducedMotion: 'rest' } } } };
      s.on['press:go'][0].actions.push({ call: 'effects.play', with: { effect: src } });
      return f;
    }));
    eq(say(effect("'pop'")), '', 'quoted text');
    eq(say(effect('which')), '', 'a formula');
    eq(effect("'nope'").map(d => d.code), ['E-REF-UNKNOWN'], 'a quoted name that is no particle');
    eq(effect('nothing').map(d => d.code), ['E-REF-UNKNOWN'], 'the formula is checked');
  },
  'item 3: no core file imports a file the add-ons release owns (release/hypersvg-addons.files.txt)'() {
    // In the core release the add-ons policy is absent: there, every relative import of a core file must resolve.
    const policy = path.join(repo, 'release', 'hypersvg-addons.files.txt');
    const inCore = !fs.existsSync(policy);
    const owned = (inCore ? '' : fs.readFileSync(policy, 'utf8')).split('\n')
      .map(l => /^\+ (engine\/v2\/(?:src|web|check)\/\S+)$/.exec(l.trim())?.[1]).filter(Boolean);
    const isOwned = (rel) => owned.some(p => (p.endsWith('*.mjs') ? rel.startsWith(p.slice(0, -5)) && rel.endsWith('.mjs') && !rel.endsWith('/all.mjs') : rel === p));
    if (!inCore) ok(isOwned('engine/v2/src/capabilities/motion.mjs') && isOwned('engine/v2/src/effects.mjs') && !isOwned('engine/v2/src/capabilities/all.mjs'));
    const bad = [];
    for (const dir of ['src', 'web', 'check', 'tools', 'schema']) {
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const f = path.join(d, e.name);
          if (e.isDirectory()) { walk(f); continue; }
          if (!e.name.endsWith('.mjs')) continue;
          const rel = path.relative(repo, f).split(path.sep).join('/');
          if (isOwned(rel) || rel === 'engine/v2/src/capabilities/all.mjs') continue; // the core export writes all.mjs empty
          const text = fs.readFileSync(f, 'utf8');
          for (const m of text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'(\.[^']+)'|^\s*import\s+'(\.[^']+)'/gm)) {
            const to = path.relative(repo, path.resolve(path.dirname(f), m[1] || m[2])).split(path.sep).join('/');
            if (isOwned(to) || (inCore && !fs.existsSync(path.join(repo, ...to.split('/'))))) bad.push(`${rel} -> ${to}`);
          }
        }
      };
      walk(path.join(repo, 'engine', 'v2', dir));
    }
    eq(bad, [], bad.join('; '));
  },
  'item 3 (K2a): a need whose add-on this release does not hold is one W-ADDON-ABSENT; its calls are known by name'() {
    eq(addonHeld({ name: 'nothing-here', kind: 'capability', manifest: 'capabilities/nothing-here.json' }), false);
    // The authors' full repository holds effects; the core release does not, and says where it comes from.
    const held = fs.existsSync(path.join(repo, 'engine', 'v2', 'src', 'capabilities', 'effects.mjs'));
    eq(addonHeld({ name: 'effects', kind: 'capability', manifest: 'capabilities/effects.json' }), held);
    const exp = { file: 'experience.json', doc: { needs: ['effects', 'example.glow'] }, scenes: {}, blocks: {} };
    const d = absentAddons(exp);
    eq(!!knownAbsent('effects'), !held);
    eq(absentCall('effects.play', 'effects'), !held, 'a call the registry gives the add-on');
    eq(absentCall('effects.nope', 'effects'), false, 'a call it does not own is no call of it');
    eq(knownAbsent('example.glow'), null, 'an outside add-on is not a known built-in');
    if (held) eq(d, [], 'held built-ins and outside add-ons give nothing');
    else {
      eq(d.map(x => `${x.code} ${x.path}`), ['W-ADDON-ABSENT /needs'], 'one finding, for effects only');
      ok(d[0].message.includes('comes with the hypersvg-addons release'), d[0].message);
    }
  },
  'item 4: the network grant, the widgets grant and the site storage scope are 2.1 drafts (E-DRAFT)'() {
    const grants = (g) => check(files((f) => { f['experience.json'].grants = g; return f; }));
    const codes = (g) => grants(g).map(d => `${d.code} ${d.path}`);
    eq(codes({ storage: ['saved'] }), [], 'a 2.0 grant checks clean');
    eq(codes({ network: [] }), ['E-DRAFT grants.network']);
    eq(codes({ widgets: { clock: { set: [] } } }), ['E-DRAFT grants.widgets']);
    eq(codes({ storage: ['saved', 'site'] }), ['E-DRAFT grants.storage[1]']);
    eq(codes({ storage: ['saved'], optional: ['network', 'storage', 'widgets'] }), ['E-DRAFT grants.optional[0]', 'E-DRAFT grants.optional[2]']);
    const d = grants({ network: [] });
    ok(d[0].message.includes('spec/2.0/drafts/delivery-2.1.md'), d[0].message);
    ok(grants({ widgets: {} })[0].message.includes('spec/2.0/drafts/custom-widgets-2.1.md'));
  },
  'item 4: no add-on may take a core event prefix as its name (12.5)'() {
    const m = (id, builtIn = false) => checkManifest({ door: 2, id, version: '1.0.0', kind: 'preset', title: 'T', adds: { provides: {} } }, { builtIn }).filter(d => d.path === 'id');
    eq(m('acme.shake'), []);
    for (const id of ['acme.press', 'acme.changed', 'acme.ended', 'acme.key', 'acme.signal', 'acme.save', 'acme.audio', 'acme.hsvg']) eq(m(id).map(d => d.code), ['E-ADDON'], id);
    eq(m('save', true).map(d => d.code), ['E-ADDON'], 'a bare name too');
    ok(m('acme.press')[0].message.includes('core event prefix'), m('acme.press')[0].message);
  },
  'item 5: one event to many blocks is heard in a fixed order: the shell, each scene, each block before its uses (9.2)'() {
    // A scene with a use `a` and a repeated use `rows` of the block `kid`; each kid uses `leaf`. Rows added later are
    // still heard in list order, right after their parent, and before a use listed after them.
    const leaf = { doc: { format: 'hsvg/2.0', kind: 'component', id: 'leaf', drawing: 'l.svg' }, words: {} };
    const kid = { doc: { format: 'hsvg/2.0', kind: 'component', id: 'kid', drawing: 'k.svg', uses: [{ id: 'l', use: 'leaf' }] }, words: {} };
    const ROWS = { type: 'array', maxItems: 4, initial: [{ id: 'x' }], items: { type: 'object', properties: { id: { type: 'string', maxLength: 4 } }, required: ['id'], additionalProperties: false } };
    const e = new Engine({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
      words: { en: {} }, data: {}, blocks: { kid, leaf },
      scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'x.svg', values: { list: ROWS },
        uses: [{ id: 'rows', use: 'kid', items: 'list', key: 'item.id' }, { id: 'a', use: 'kid' }],
        on: { more: [{ actions: [{ set: 'list', to: "[{ 'id': 'w' }, { 'id': 'x' }, { 'id': 'y' }]" }] }] } }, words: {} } },
    });
    ok(e.transaction('host', () => e.mount('one', 'scene', 'one')).ok);
    eq(e.broadcastOrder(), ['one', 'one/rows[x]', 'one/rows[x]/l', 'one/a', 'one/a/l']);
    ok(e.send('one', 'more').ok);
    eq(e.broadcastOrder(), ['one', 'one/rows[w]', 'one/rows[w]/l', 'one/rows[x]', 'one/rows[x]/l', 'one/rows[y]', 'one/rows[y]/l', 'one/a', 'one/a/l']);
    const heard = [];
    const fan = e.fanOut.bind(e); e.fanOut = (addresses, ...rest) => { heard.push(addresses); return fan(addresses, ...rest); };
    ok(e.applySettings([['volume', 0.5]], 'host').ok);
    eq(heard[0], e.broadcastOrder(), 'changed:volume goes to the blocks in that order');
  },
  'item 5: a parent and its uses leave in a fixed order: the uses first, the last listed first, then the parent (3.2)'() {
    const log = { type: 'string', initial: '', maxLength: 200 };
    const kid = { doc: { format: 'hsvg/2.0', kind: 'component', id: 'kid', drawing: 'k.svg', inputs: { name: { kind: 'content', type: 'string', maxLength: 4, initial: 'k' } },
      outputs: { bye: { kind: 'event' } }, exit: [{ emit: 'bye' }] }, words: {} };
    const p = new Player({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', values: { log }, story: { start: 'one', scenes: { one: 'one.json', two: 'two.json' }, links: [{ from: 'one', on: 'go', to: 'two' }] } },
      words: { en: {} }, data: {}, blocks: { kid },
      scenes: {
        one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'x.svg', outputs: { go: { kind: 'event' } },
          uses: [{ id: 'a', use: 'kid', with: { name: "'a'" } }, { id: 'b', use: 'kid', with: { name: "'b'" } }],
          exit: [{ set: 'log', to: "log + 'one '" }] }, words: {} },
        two: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'two', drawing: 'y.svg' }, words: {} },
      },
    });
    const order = [];
    const leave = p.leave.bind(p); p.leave = (a) => { order.push(a); return leave(a); };
    const run = p.runActions.bind(p); p.runActions = (a, list, what, ...rest) => { if (what === 'exit' && list?.length) order.push(`exit ${a}`); return run(a, list, what, ...rest); };
    ok(p.start().ok); ok(p.send('one', 'go').ok);
    eq(order, ['one', 'one/b', 'exit one/b', 'one/a', 'exit one/a', 'exit one']);
  },
  'item 5: a binding fault is found in the compute phase for every source: a person\'s change rolls back, then play stops (9.2 step 6)'() {
    const p = new Player({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', story: { start: 'a', scenes: { a: 'a.json' } } },
      words: { en: {} }, data: {}, blocks: {},
      scenes: { a: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', values: { level: { type: 'number', initial: 1, minimum: 0, maximum: 3 } },
        bindings: [{ target: 'label', text: 'Level {{ 10 / level }}' }],
        on: { zero: [{ actions: [{ set: 'level', to: '0' }] }] },
        machines: { m: { initial: 'w', states: { w: { after: [{ delayMs: 100, target: 'd', actions: [{ set: 'level', to: '0' }] }] }, d: {} } } } }, words: {} } },
    });
    ok(p.start().ok);
    const rev = p.state.revision;
    const r = p.send('a', 'zero');
    eq([r.ok, r.fault?.code, p.read('a', 'level'), p.state.revision, !!p.stopped], [false, 'E-FORMULA', 1, rev, true], 'rolled back before commit, and a person\'s fault stops play');
    ok(/binding/.test(r.fault.message), r.fault.message);
  },
  'item 5: a timer\'s change is checked the same way'() {
    const p = new Player({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', story: { start: 'a', scenes: { a: 'a.json' } } },
      words: { en: {} }, data: {}, blocks: {},
      scenes: { a: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', values: { level: { type: 'number', initial: 1, minimum: 0, maximum: 3 } },
        bindings: [{ target: 'bar', opacity: '1 / level' }],
        machines: { m: { initial: 'w', states: { w: { after: [{ delayMs: 100, target: 'd', actions: [{ set: 'level', to: '0' }] }] }, d: {} } } } }, words: {} } },
    });
    ok(p.start().ok);
    p.advance(100);
    eq([p.read('a', 'level'), !!p.stopped, p.stopped?.code], [1, true, 'E-FORMULA']);
  },
  'item 5: cycles across uses are refused (E-CYCLE): a with that reads an output made from the input it fills'() {
    const withKid = (edit) => check(files((f) => {
      f['blocks/kid/component.json'] = { format: 'hsvg/2.0', kind: 'component', id: 'kid', drawing: 'kid.svg',
        inputs: { n: { kind: 'content', type: 'number', minimum: 0, maximum: 100, initial: 1 } },
        computed: { twice: 'n * 2' },
        outputs: { out: { kind: 'result', type: 'number', minimum: 0, maximum: 1000, value: 'twice + 1' }, fixed: { kind: 'result', type: 'number', minimum: 0, maximum: 9, value: '3' } } };
      f['blocks/kid/kid.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0"><g id="kid" data-hsvg-kind="component"><rect id="kid__box" data-hsvg-kind="part" width="4" height="4"/></g></svg>';
      f['experience.json'].blocks = { kid: 'blocks/kid/component.json' };
      edit(scene(f));
      return f;
    }));
    const codes = (d) => d.filter(x => x.code === 'E-CYCLE').map(x => `${x.code} ${x.path}`);
    eq(codes(withKid((s) => { s.uses = [{ id: 'k', use: 'kid', with: { n: "uses['k'].fixed" } }]; })), [], 'an output that reads no input is no cycle');
    const one = withKid((s) => { s.uses = [{ id: 'k', use: 'kid', with: { n: "uses['k'].out" } }]; });
    eq(codes(one), ['E-CYCLE /uses/0/with/n'], say(one));
    ok(one.find(x => x.code === 'E-CYCLE').message.includes("k.with.n -> uses['k'].out -> k.with.n"), say(one));
    const two = withKid((s) => {
      s.computed = { got: "uses['b'].out" };
      s.uses = [{ id: 'a', use: 'kid', with: { n: 'got' } }, { id: 'b', use: 'kid', with: { n: "uses['a'].out" } }];
    });
    eq(codes(two), ['E-CYCLE /uses/0/with/n'], 'across two uses and the parent\'s computed value, once');
  },
  'item 6: a machine timer\'s id is optional, like other reactions (D29, 5.14)'() {
    const d = check(files((f) => { scene(f).machines = [{ id: 'm', initial: 'wait', states: { wait: { after: [{ delayMs: 3000, target: 'done' }] }, done: {} } }]; return f; }));
    eq(say(d), '');
  },
  'item 6: E-MOTION-RANGE names the layout only when the file writes layouts'() {
    const d = check(files((f) => { scene(f).clips = { spin: { durationMs: 500, tracks: [{ target: 'go', channel: 'rotate', keys: [[0, 0], [500, 30]] }] } }; return f; }));
    const m = d.filter(x => x.code === 'E-MOTION-RANGE');
    eq(m.length, 1, say(d));
    ok(!m[0].message.includes('in layout'), m[0].message);
  },
};
