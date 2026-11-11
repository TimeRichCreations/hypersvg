// The format decisions after R2. Each test names its item.
import { makeDocumentChecker } from '../schema/check-document.mjs';
import { schemas, eq, ok } from './helpers.mjs';

const checker = () => makeDocumentChecker(schemas());
const codes = (doc, opts = {}) => checker().check(JSON.stringify(doc), { file: 'x/experience.json', ...opts }).diags.map(d => d.code);
const exp = (extra = {}) => ({ format: 'hsvg/2.0', kind: 'experience', id: 'x', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' } }, ...extra });

export const tests = {
  'X5.4 logical blocks, nested experiences and split screen are a 2.1 draft (E-DRAFT)'() {
    eq(codes({ format: 'hsvg/2.0', kind: 'logical-block', id: 'ride-road' }, { file: 'blocks/ride-road.json' }), ['E-DRAFT']);
    eq(codes({ format: 'hsvg/2.0', kind: 'experience', id: 'x', kit: { id: 'k', version: '1.0.0' }, experiences: [{ id: 'a', file: 'a/experience.json' }] }), ['E-DRAFT']);
    eq(codes(exp({ story: { start: { left: 'one', right: 'one' }, scenes: { one: 'scenes/one/scene.json' } } })), ['E-DRAFT']);
    const link = { id: 'l', from: 'one', to: 'one', on: 'go', slot: 'right' };
    eq(codes(exp({ story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, links: [link] } })), ['E-DRAFT']);
    const shell = (slots) => ({ format: 'hsvg/2.0', kind: 'shell', id: 'sh', drawing: 'sh.svg', slots });
    eq(codes(shell({ a: { kind: 'stage' }, b: { kind: 'stage', label: 'B' } }), { file: 'shell/sh.json', needs: ['shell'] }), ['E-DRAFT']);
    eq(codes(shell({ a: { kind: 'stage' } }), { file: 'shell/sh.json', needs: ['shell'] }), []);
    const scene = { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', uses: [{ id: 'ride', use: 'ride-road', places: { road: 'road' } }] };
    eq(codes(scene, { file: 'scenes/one/scene.json' }), ['E-DRAFT']);
    const msg = checker().check(JSON.stringify({ format: 'hsvg/2.0', kind: 'logical-block', id: 'r' }), { file: 'blocks/r.json' }).diags[0].message;
    ok(msg.includes('not in 2.0; a 2.1 draft') && msg.includes('structure-2.1.md'), msg);
    eq(codes(exp()), []);
  },
};
tests['X5.5 content options, the seed selector and the rule kind seeds are a 2.1 draft or gone'] = () => {
  const withAxes = exp({ axes: [{ axis: 'content', id: 'headline-test', select: 'seed', options: ['fresh', 'warm'] }] });
  eq(codes(withAxes), ['E-DRAFT']);
  const withOptions = exp({ inputs: { headline: { kind: 'content', type: 'string', maxLength: 40, initial: { options: { fresh: { short: 'Fresh' }, warm: { short: 'Warm' } } } } } });
  eq(codes(withOptions), ['E-DRAFT']);
  const tiered = exp({ inputs: { headline: { kind: 'content', type: 'string', maxLength: 40, initial: { short: 'Fresh', rich: 'Fresh sourdough' } } } });
  eq(codes(tiered), []);
  eq(codes(exp({ rules: [{ id: 's', kind: 'seeds' }] })), ['E-RULE']);
};
tests['X5.7 the give-way step reflow is gone: a rule or a text fit that lists it is refused'] = async () => {
  const { STEPS, FIT_STEPS } = await import('../src/ladder.mjs');
  ok(!STEPS.includes('reflow') && !FIT_STEPS.includes('reflow'));
  const rule = { id: 'r', kind: 'inside', of: 'place:slot', subject: 'use:a', strength: 'give-way', steps: ['reflow'], floor: { minShare: 0.2 } };
  const found = codes(exp({ rules: [rule] }));
  ok(found.length > 0 && found.every(c => c === 'E-RULE' || c === 'E-TYPE'), found.join());
  eq(codes(exp({ rules: [{ ...rule, steps: ['column'] }] })), []);
};
tests['X5.11 execution profiles are folded into host profiles: capabilities on the host profile, E-HOST-RUNS at mount'] = async () => {
  const { admitHost } = await import('../src/host-profile.mjs');
  const host = (extra) => ({ format: 'hsvg/2.0', kind: 'host-profile', id: 'h', ...extra });
  const doc = { needs: ['shell', 'physics'], grants: {} };
  let code = null; try { admitHost(doc, host({ capabilities: ['shell'] })); } catch (e) { code = e.code; }
  eq(code, 'E-HOST-RUNS');
  ok(admitHost(doc, host({ capabilities: ['shell', 'physics'] })).grants);
  ok(admitHost(doc, host({})).grants, 'no list: every capability the player has');
  eq(codes(host({ capabilities: ['shell'] }), { file: 'host-profile.json' }), []);
  eq(codes(host({ runs: 'player-2-0' }), { file: 'host-profile.json' }), ['E-KEY-UNKNOWN']);
  const r = checker().check(JSON.stringify({ format: 'hsvg/2.0', kind: 'execution-profile', id: 'p' }), { file: 'p.json' }).diags.map(d => d.code);
  eq(r, ['E-HEADER']);
};
tests['X5.12 one capabilities section, one rename list'] = async () => {
  const fs = await import('node:fs'); const path = await import('node:path'); const { spec } = await import('./helpers.mjs');
  const text = fs.readFileSync(path.join(spec, '10-hosts-and-delivery.md'), 'utf8');
  eq(text.split('\n').filter(l => /^##+ .*[Cc]apabilit/.test(l)), ['## 10.7 Capabilities']);
  const renames = JSON.parse(fs.readFileSync(path.join(spec, 'renames.json'), 'utf8')).rows;
  ok(renames.some(r => r.row.startsWith('W-')) && renames.some(r => r.row === 'K-01' && r.from === '`E-EXPRESSION`'), 'words and codes are in renames.json');
  ok(!('replaced' in JSON.parse(fs.readFileSync(path.join(spec, 'errors.json'), 'utf8'))), 'errors.json keeps no second rename list');
  ok(!fs.readFileSync(path.join(spec, 'addons', 'a13-migration.md'), 'utf8').includes('## A13.12'), 'A13.12 is folded into A13.4');
};
tests['X5.13 D25, as D40 changed it: 10.6 and 10.7 say the door is the core door plus live-data and host pictures; runtime import is outside the standard'] = async () => {
  const fs = await import('node:fs'); const path = await import('node:path'); const { spec } = await import('./helpers.mjs');
  const text = fs.readFileSync(path.join(spec, '10-hosts-and-delivery.md'), 'utf8');
  const section = (h) => { const i = text.indexOf(`## ${h}`); return text.slice(i, text.indexOf('\n## ', i + 3)); };
  for (const h of ['10.6', '10.7']) {
    const s = section(h);
    ok(/core door/.test(s) && s.includes('`live-data`') && /pictures/.test(s), `${h} holds the door text`);
    ok(/runtime import[^.]*outside the standard/i.test(s) && !/bridge/.test(s), `${h}: runtime import is outside the standard (D40), no bridge plan`);
  }
};
