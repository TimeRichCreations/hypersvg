// Engine follow-ups from the certificates. Fast parts only, no browser.
// - size limits (10.11, D7, D8): the packer and the certificate read coreBundleBytes and capabilityBundleBytes;
// - guided paths (proof-guide/2.0): the format, a step's inputs, the guides of the three large experiences;
// - controls never on screen, listed by reason (B4 finding 9).
// The physics sub-steps are in stage5-physics.test.mjs; a missing module is in tests/browser/fault-browser.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo, eq, ok } from './helpers.mjs';
import { FORMAT } from '../src/limits.mjs';
import { pack, engineSizes, sizeFindings } from '../tools/pack.mjs';
import { certify, markdown, neverSeenBy } from '../tools/proof/certificate.mjs';
import { svgAncestry, controlPlaces } from '../tools/proof/build.mjs';
import { validateGuide, GUIDE, controlKey } from '../tools/proof/format.mjs';
import { guideInputs } from '../tools/proof/explore.mjs';
import { loadGuide } from '../tools/proof/proof.mjs';

const fp = 'sha256:' + 'a'.repeat(64);
const story = { start: 'a', scenes: ['a'], ends: ['a'], endless: false, links: [] };
const build = (bundle) => ({ product: { id: 'demo', folder: 'x/demo', title: 'Demo' }, fingerprint: fp, package: { needs: ['physics'], members: 3, digest: fp },
  size: { raw: 1000, gzip9: 400 }, bundle, csp: "default-src 'none'", findings: [], story, raised: {} });
const exploration = () => ({
  mode: 'bounded-browser-observation', start: {}, policy: {}, ms: 1, startError: null, steps: 1, stopped: null, pendingStates: 0, pointerSteps: 0, pointerStopped: null,
  states: [{ id: 0 }], edges: [], scenes: ['a'], failures: [], network: [], errors: [], controls: [],
  measures: { elements: 10, blocks: 1, depth: 1, timers: 0, savedBytes: 0, sessionBytes: 0 }, sceneElements: { a: 10 }, endings: ['a'], traces: [] });

export const tests = {
  'size limits come from limits.json: 10,000 a capability, 120,000 the core (D7, D8)'() {
    const limits = JSON.parse(fs.readFileSync(path.join(repo, 'spec', '2.0', 'limits.json'), 'utf8'));
    const value = (id) => { for (const group of Object.values(limits)) if (group && typeof group === 'object' && group[id]?.value !== undefined) return group[id].value; return undefined; };
    eq([value('capabilityBundleBytes'), value('coreBundleBytes')], [10000, 120000]);
    eq([FORMAT.capabilityBundleBytes, FORMAT.coreBundleBytes], [10000, 120000]);
    const s = engineSizes(['physics', 'page', 'ai', 'fit']);
    eq(s.core.max, FORMAT.coreBundleBytes);
    // Before the lean core (D18, D19) the core could be over its cap: the packer reports it and does not refuse.
    ok(s.core.gzip9 > 50000, `the core: ${s.core.gzip9}`);
    eq(s.capabilities.map(c => c.id), ['ai', 'fit', 'page', 'physics'], 'fit is a module');
    for (const c of s.capabilities) ok(c.max === FORMAT.capabilityBundleBytes && c.gzip9 > 0 && !c.over, `${c.id}: ${c.gzip9}`);
    eq(sizeFindings(s).filter(f => f.limit !== 'coreBundleBytes'), []);
  },
  'a size over its limit is a finding that names the limit'() {
    const f = sizeFindings({ core: { gzip9: 130000, max: 120000, over: true }, capabilities: [{ id: 'page', gzip9: 10001, max: 10000, over: true }, { id: 'ai', gzip9: 9000, max: 10000, over: false }] });
    eq(f.map(d => [d.code, d.limit, d.path]), [['E-ENGINE-SIZE', 'coreBundleBytes', 'core'], ['E-ENGINE-SIZE', 'capabilityBundleBytes', 'capabilities/page']]);
    ok(f[0].message.includes('coreBundleBytes 120000') && f[1].message.includes('capabilityBundleBytes 10000'), f.map(d => d.message).join(' | '));
  },
  async 'the packer reports the engine sizes of the page it packs'() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-e1-'));
    try {
      const r = await pack(path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'toss'), out);
      eq(r.capabilities, ['physics']);
      eq(r.sizes.capabilities.map(c => c.id), ['physics']);
      eq(r.sizes.core.max, 120000);
      eq(r.accepted, []);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  },
  'the certificate reports the core and each capability against their limits'() {
    const c = certify(build({ core: { gzip9: 112000 }, capabilities: [{ id: 'physics', gzip9: 4000 }] }), exploration());
    const rows = c.properties.budgets.rows.filter(r => /BundleBytes$/.test(r.limit)).map(r => [r.limit, r.observed, r.max, r.result]);
    eq(rows, [['coreBundleBytes', 112000, 120000, 'pass'], ['capabilityBundleBytes', 4000, 10000, 'pass']]);
    ok(markdown(c).includes('core 112000 of 120000, physics 4000 of 10000'), markdown(c));
    ok(!c.unknowns.some(u => u.includes('no recorded size cap')), 'the core has a cap now');
    const over = certify(build({ core: { gzip9: 120001 }, capabilities: [] }), exploration());
    eq([over.properties.budgets.result, over.status], ['fail', 'fail']);
    ok(markdown(over).includes('core 120001 of 120000 (over)'));
  },
  'a guide: areas with steps or a trace; each step is use, key or wait'() {
    const good = { format: GUIDE, areas: [{ name: 'a', steps: [{ use: 's#go' }, { use: 's#drag', drop: 'bin' }, { use: 's#knob', key: 'ArrowRight' }, { use: 's#duck', optional: true }, { key: 'Space' }, { wait: 3000 }] }, { name: 'b', trace: 'b.json' }] };
    eq(validateGuide(structuredClone(good)).areas.length, 2);
    const bad = (areas, re) => { try { validateGuide({ format: GUIDE, areas }); } catch (e) { ok(re.test(e.message), e.message); return; } throw new Error('expected a refusal'); };
    bad([], /has areas/);
    bad([{ name: 'a', steps: [] }, { name: 'a', steps: [] }], /own name/);
    bad([{ name: 'a', steps: [], trace: 'x' }], /not both/);
    bad([{ name: 'a', steps: [{ wait: 1, key: 'K' }] }], /one of use, key or wait/);
    bad([{ name: 'a', steps: [{ wait: -1 }] }], /whole ms/);
    bad([{ name: 'a', steps: [{ key: 'K', drop: 'x' }] }], /one of use|drop goes with use/);
    bad([{ name: 'a', steps: [{ key: 'K', optional: true }] }], /one of use|optional goes with use/);
    try { validateGuide({ format: 'x', areas: good.areas }); throw new Error('no'); } catch (e) { ok(/proof-guide\/2.0/.test(e.message), e.message); }
  },
  'a guide step becomes the explorer\'s keyboard inputs at the time now'() {
    const go = { addr: 's', cid: 'go', id: 's__go', role: 'button', name: 'Go', kind: 'button', enabled: true };
    const knob = { addr: 's', cid: 'knob', id: 's__knob', role: 'slider', name: 'Speed', kind: 'slider', enabled: true };
    const drag = { addr: 's', cid: 'd', id: 's__d', role: 'button', name: 'Apple', kind: 'drag', enabled: true, drops: ['bin', 'box'] };
    const off = { addr: 's', cid: 'off', id: 's__off', role: 'button', name: 'Off', kind: 'button', enabled: false };
    const shown = [go, knob, drag, off];
    eq(controlKey(go), 's#go');
    const [a, settle] = guideInputs({ use: 's#go' }, shown, 1000, 500);
    eq([a.t, a.act, a.via, a.control.name, settle], [1000, 'activate', 'keyboard', 'Go', { t: 1500, act: 'advance' }]);
    eq(guideInputs({ use: 's#knob' }, shown, 0, 500)[0].key, 'ArrowRight');
    eq(guideInputs({ use: 's#knob', key: 'ArrowLeft' }, shown, 0, 500)[0].key, 'ArrowLeft');
    eq(guideInputs({ use: 's#d', drop: 'box' }, shown, 0, 500)[0], { t: 0, act: 'drag', control: { role: 'button', name: 'Apple', id: 's__d', addr: 's', cid: 'd' }, drop: 'box', via: 'keyboard' });
    eq(guideInputs({ wait: 3000 }, shown, 200, 500), [{ t: 3200, act: 'advance' }]);
    eq(guideInputs({ key: 'Space' }, shown, 0, 500)[0], { t: 0, act: 'key', key: 'Space' });
    eq(guideInputs({ use: 's#off', optional: true }, shown, 0, 500), [], 'an optional step is skipped');
    eq(guideInputs({ use: 's#gone', optional: true }, shown, 0, 500), []);
    const why = (step) => { try { guideInputs(step, shown, 0, 500); } catch (e) { return e.message; } return null; };
    eq(why({ use: 's#gone' }), 's#gone is not shown');
    eq(why({ use: 's#off' }), 's#off is not usable');
    eq(why({ use: 's#d', drop: 'shelf' }), 's#d: drop shelf is not shown');
  },
  'the SVG reader gives each id its ancestors, with slots by name'() {
    const a = svgAncestry('<svg><!-- <g id="no"/> --><g id="top"><g data-hsvg-slot="settings"><rect id="b"/><g id="c"><path id="d"/></g></g></g><rect id="e"/></svg>');
    eq([...a.keys()], ['top', 'b', 'c', 'd', 'e']);
    eq(a.get('d'), ['top', 'slot:settings', 'c']);
    eq(a.get('e'), []);
  },
  'controls never on screen are listed by reason'() {
    const places = { 's#a': { layouts: ['wide', 'tall'], all: true, dialog: 'settings' }, 's#b': { layouts: ['tall'], all: false, dialog: null },
      'far#c': { layouts: [null], all: true, dialog: null }, 's#d': { layouts: [null], all: true, dialog: null } };
    eq(neverSeenBy(['s#a', 's#b', 'far#c', 's#d', 'kit/x#e'], places, { scenes: ['s', 'far'] }, ['s']),
      { dialog: ['s#a (settings)'], 'other-layouts': ['s#b (tall)'], 'scene-not-reached': ['far#c'], 'not-shown': ['s#d'], unplaced: ['kit/x#e'] });
    const c = certify({ ...build({ core: { gzip9: 1 }, capabilities: [] }), places, story: { ...story, scenes: ['a', 's', 'far'] } },
      { ...exploration(), scenes: ['a', 's'], controls: [{ key: 's#a', reached: false }, { key: 'far#c', reached: false }] });
    eq(c.properties.keyboard.neverSeenBy, { dialog: ['s#a (settings)'], 'scene-not-reached': ['far#c'] });
    ok(markdown(c).includes('- dialog (1): in a dialog slot (settings)'), markdown(c));
  },
  'a kit experience whose scenes are uses (not files) has no places read, and does not fail'() {
    eq(controlPlaces(path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'kit-ads', 'ads', 'ad-300x250')), {});
  },
};
