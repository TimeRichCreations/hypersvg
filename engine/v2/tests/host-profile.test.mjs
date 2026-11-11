// Host profiles (A10.1) at mount: grants (10.5), rules and budgets (8.2, A10.3), retention (5.1.2), audience (A5.1),
// readable (8.9) and options (10.6, 7.1). No browser.
import { Player as BasePlayer } from '../src/story.mjs';
import { granting } from './helpers.mjs';
const Player = granting(BasePlayer); // a host that gives what the experience asks (D31: no profile, no grant)
import { FORMAT } from '../src/limits.mjs';
import { experienceResources, effectiveGrants, steeringCeiling, readableFloor, hostBudget, budgetResults, packageMeasures, hostOptions, expired, profileProblems } from '../src/host-profile.mjs';
import { eq, ok, throwsCode } from './helpers.mjs';

const profile = (extra = {}) => ({ format: 'hsvg/2.0', kind: 'host-profile', id: 'h', ...extra });
const experience = (exp = {}, scene = {}) => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } }, ...exp },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', ...scene }, words: {}, drawings: {} } },
  limits: { ...FORMAT },
});
const memStore = (init = {}) => { const m = new Map(Object.entries(init)); return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) }; };
const DAY = 86400000;

export const tests = {
  'grants: the effective grant is the intersection by exact name; ai takes the lower steering ceiling (10.5)'() {
    const asked = { storage: ['session', 'saved'], signals: ['idle', 'visible:signup'], ai: { 'browser-ai': 'open', other: 'ask' }, widgets: { form: { set: ['a', 'b'], emit: ['go'] } }, openUrl: true };
    const given = { storage: ['saved', 'site'], signals: ['idle'], ai: { 'browser-ai': 'guided' }, widgets: { form: { set: ['a'] } }, openUrl: true };
    const r = effectiveGrants(asked, given);
    eq(r.grants, { storage: ['saved'], signals: ['idle'], ai: { 'browser-ai': 'guided' }, widgets: { form: { set: ['a'], emit: [] } }, openUrl: true });
    eq(r.refused, []);
    eq(effectiveGrants({ storage: ['saved'], openUrl: true }, { storage: [], openUrl: false }).refused, ['storage', 'openUrl']);
    eq(effectiveGrants({ hooks: ['x'] }, {}).refused, ['hooks'], 'anything not listed is denied');
  },
  'grants: a refused kind refuses the mount (E-GRANT) unless it is optional; then its values last for the run'() {
    const exp = (optional) => experience({ grants: { storage: ['saved'], ...(optional ? { optional: ['storage'] } : {}) }, values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9, lifetime: 'saved' } } });
    const storage = () => ({ saved: memStore(), page: '/p', partition: 'device', now: () => 1 });
    throwsCode(() => new Player(exp(false), { host: profile({ grants: { storage: [] } }), storage: storage() }), 'E-GRANT');
    throwsCode(() => new Player(exp(false), { host: profile(), storage: storage() }), 'E-GRANT');
    const s = storage();
    const p = new Player(exp(true), { host: profile({ grants: {} }), storage: s });
    ok(p.start().ok);
    eq([p.grants.storage, p.stored.usable('saved'), s.saved.m.size], [[], false, 0]);
    const q = new Player(exp(false), { host: profile({ grants: { storage: ['saved'] } }), storage: storage() });
    ok(q.start().ok);
    ok(q.stored.usable('saved'));
    // A page with no host profile is given nothing (closed by default, D31): it still starts, and the asked storage is
    // refused, so saved values last for the run.
    const none = new BasePlayer(exp(false), { storage: storage() });
    ok(none.start().ok);
    eq([none.grants.storage, none.stored.usable('saved'), none.host.refused], [[], false, ['storage']]);
  },
  'budgets: a "host" maximum takes the profile\'s value; none is not-run, never a pass; a number may only be stricter (A10.3)'() {
    const rules = [
      { rule: { id: 'weight', kind: 'budget', measure: 'unpackedBytes', maximum: 'host' }, from: 'host' },
      { rule: { id: 'sound', kind: 'budget', measure: 'soundBytes', maximum: 5000 }, from: 'experience' },
      { rule: { id: 'length', kind: 'budget', measure: 'lengthMs', maximum: 'host' }, from: 'host' },
      { rule: { id: 'font', kind: 'budget', measure: 'fontBytes', on: 'resource:sans', maximum: 'host' }, from: 'host' },
    ];
    const p = profile({ budgets: [{ measure: 'unpackedBytes', maximum: 1000 }, { measure: 'soundBytes', maximum: 300 }, { measure: 'fontBytes', on: 'resource:sans', maximum: 10 }] });
    const members = { 'a.json': new Uint8Array(400), 's.wav': new Uint8Array(400), 'f.woff2': new Uint8Array(20) };
    const m = packageMeasures(members, [{ id: 'beep', kind: 'sound', path: 's.wav' }, { id: 'sans', kind: 'font', path: 'f.woff2' }]);
    eq([m.unpackedBytes[''], m.files, m.soundBytes, m.fontBytes['resource:sans']], [820, 3, 400, 20]);
    eq(budgetResults(rules, p, m).map(r => [r.id, r.maximum, r.measured, r.status]), [['weight', 1000, 820, 'pass'], ['sound', 300, 400, 'fail'], ['length', null, null, 'not-run'], ['font', 10, 20, 'fail']]);
    eq(budgetResults(rules.slice(0, 1), profile(), m)[0].status, 'not-run', 'no host value: not-run');
    eq(budgetResults(rules.slice(0, 1), p, {})[0].status, 'not-run', 'not measured: not-run');
    eq([hostBudget(profile({ budgets: { archiveBytes: 7 } }), 'archiveBytes'), hostBudget(profile(), 'archiveBytes')], [7, null]);
  },
  'host rules (8.2): budget rules are measured at mount on the package bytes the host gives; unknown measures are E-RULE'() {
    const host = profile({ budgets: { unpackedBytes: 100 }, rules: [{ id: 'weight', kind: 'budget', measure: 'unpackedBytes', maximum: 'host' }, { id: 'len', kind: 'budget', measure: 'lengthMs', maximum: 'host' }] });
    const p = new Player(experience(), { host, measures: packageMeasures({ 'a.json': new Uint8Array(150) }) });
    eq(p.hostRules.map(r => [r.id, r.status]), [['weight', 'fail'], ['len', 'not-run']]);
    ok(p.start().ok, 'a broken host rule is reported, not a mount refusal (see the A5 report)');
    throwsCode(() => new Player(experience(), { host: profile({ rules: [{ id: 'x', kind: 'budget', measure: 'bogus', maximum: 1 }] }) }), 'E-RULE');
  },
  'retention: stored data written more than that many days before the host\'s now is dropped before restore (5.1.2)'() {
    const key = 'hsvg/2.0|/p|t|device|saved';
    const rec = (writtenAt) => JSON.stringify({ stamp: '', writtenAt, values: { 'experience#n': 5 }, knobs: {}, graph: null });
    const play = (writtenAt, host) => {
      const p = new Player(experience({ grants: { storage: ['saved'] }, values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9, lifetime: 'saved' } } }),
        { host, storage: { saved: memStore({ [key]: rec(writtenAt) }), page: '/p', partition: 'device', now: () => 10 * DAY } });
      ok(p.start().ok);
      return p.state.blocks.experience.values.n;
    };
    const h = (extra) => profile({ grants: { storage: ['saved'] }, ...extra });
    eq([play(8 * DAY, h({ retention: 3 })), play(6 * DAY, h({ retention: 3 })), play(1, h({}))], [5, 0, 5]);
    eq([expired(0, { retention: 1 }, DAY), expired(0, { retention: 1 }, DAY + 1), expired(undefined, { retention: 1 }, 9 * DAY)], [false, true, false]);
    throwsCode(() => new Player(experience(), { host: profile({ retention: 0 }) }), 'E-RANGE');
    throwsCode(() => new Player(experience(), { host: profile({ retention: 1.5 }) }), 'E-RANGE');
  },
  'audience: children refuses open AI steering; the ceiling is the lowest of the seat and the grant (A5.1)'() {
    eq(steeringCeiling('open', 'open', 'children'), { ceiling: 'open', refused: true });
    eq(steeringCeiling('open', 'guided', 'children'), { ceiling: 'guided', refused: false });
    eq(steeringCeiling(undefined, 'open'), { ceiling: 'none', refused: false });
    const p = new Player(experience(), { host: profile({ audience: 'children' }) });
    eq(p.host.audience, 'children');
    eq(new Player(experience()).host.audience, 'any');
    throwsCode(() => new Player(experience(), { host: profile({ audience: 'kids' }) }), 'E-TYPE');
  },
  'readable: "host" takes the profile\'s floor, 12 when absent; a number is kept (8.9)'() {
    eq([readableFloor('host', profile({ readable: 9 })), readableFloor('host', profile()), readableFloor('host', null), readableFloor(14, profile({ readable: 9 }))], [9, 12, 12, 14]);
    eq(new Player(experience(), { host: profile({ readable: 10 }) }).host.readable, 10);
  },
  'options: a host axis takes the mount\'s option, else the profile\'s, else its default; each is checked (E-AXIS-INPUT, 10.6)'() {
    const axes = [{ axis: 'language', default: 'en', options: { en: {}, de: {} } }, { axis: 'theme', id: 'colourway', select: 'host', options: ['day', 'night'] }, { axis: 'shape', select: 'space', shapes: { wide: {} } }];
    eq(hostOptions(axes, {}, null).options, { language: 'en' });
    eq(hostOptions(axes, { language: 'de' }, profile({ options: { colourway: 'night', language: 'en' } })).options, { language: 'de', colourway: 'night' });
    eq(hostOptions(axes, { shape: 'wide' }, null).ignored, ['shape'], 'a space axis is not the host\'s to pick');
    const p = new Player(experience({ axes }), { host: profile({ options: { colourway: 'day' } }), options: { language: 'de' } });
    eq(p.options, { language: 'de', colourway: 'day' });
    throwsCode(() => new Player(experience({ axes }), { options: { language: 'fr' } }), 'E-AXIS-INPUT');
    throwsCode(() => new Player(experience({ axes }), { host: profile({ options: { colourway: 'dusk' } }) }), 'E-AXIS-INPUT');
  },
  'a host profile\'s own checks: budgets, rules, readable, options, grants'() {
    eq(profileProblems(profile({ budgets: { archiveBytes: 'big', nonsense: 1 }, readable: 0, options: [], grants: 3, rules: {} })).map(p => [p.code, p.path]),
      [['E-TYPE', 'readable'], ['E-TYPE', 'options'], ['E-TYPE', 'grants'], ['E-TYPE', 'budgets.archiveBytes'], ['E-RULE', 'budgets.nonsense'], ['E-TYPE', 'rules']]);
    eq(profileProblems(profile({ retention: 30, audience: 'children', readable: 9, budgets: [{ measure: 'fontBytes', on: 'resources', maximum: 1 }] })), []);
  },
  'the resources of every document, with paths from the experience folder, for the package measures'() {
    const e = { file: 'experience.json', doc: { resources: { beep: { kind: 'sound', file: 'sounds/beep.wav' } } }, scenes: { a: { file: 'scenes/a/scene.json', doc: { resources: { pic: { kind: 'image', file: '../../art/p.png' } } } } }, blocks: {} };
    eq(experienceResources(e), [{ id: 'beep', kind: 'sound', path: 'sounds/beep.wav' }, { id: 'pic', kind: 'image', path: 'art/p.png' }]);
  },
};
