// The checker's plan codes (7.5, check/plans.mjs), each on a copy of the plan fixture with one fault.
import { checkExperience } from '../check/index.mjs';
import { fixtureFiles } from './a1-fit.test.mjs';
import { schemas, mapSource, eq, ok } from './helpers.mjs';

const OFFER = 'components/offer/component.json';
// Checks the fixture with one document changed; returns the findings as "CODE file path".
function findings(edit, file = OFFER) {
  const files = fixtureFiles();
  const doc = JSON.parse(files[file]);
  edit(doc, files);
  files[file] = JSON.stringify(doc);
  // The fixture scales one drawing into strips: W-PLAN-SCALE is its known warning, left out here.
  return checkExperience(mapSource(files), schemas()).diags.filter(d => d.code !== 'W-PLAN-SCALE').map(d => `${d.code} ${d.file} ${d.path}`);
}
const stacked = (d) => d.layouts.find(l => l.id === 'stacked').layoutPlan;
const has = (list, code, msg) => ok(list.some(x => x.startsWith(code)), `${msg}: expected ${code}, got ${JSON.stringify(list)}`);

export const tests = {
  'the plan fixture has no findings but W-PLAN-SCALE (one drawing scaled into strips, 7.5)'() {
    eq(checkExperience(mapSource(fixtureFiles()), schemas()).diags.map(d => d.code), ['W-PLAN-SCALE']);
  },
  'shares: initial values must total 100 (E-RANGE)'() {
    const f = findings(d => { stacked(d).children[1].share.initial = 50; });
    eq(f, [`E-RANGE ${OFFER} /layouts/1/layoutPlan`]);
  },
  'shares: minimums at most 100, maximums at least 100, each inside its bounds (E-RANGE)'() {
    has(findings(d => { for (const c of stacked(d).children.slice(1)) c.share.minimum = 60; }), 'E-RANGE', 'minimums total 120');
    has(findings(d => { for (const c of stacked(d).children.slice(1)) c.share.maximum = 45; stacked(d).children[1].share.initial = 45; stacked(d).children[2].share.initial = 55; }), 'E-RANGE', 'maximums under 100');
    has(findings(d => { stacked(d).children[1].share.initial = 80; stacked(d).children[2].share.initial = 20; }), 'E-RANGE', 'initial outside its bounds');
  },
  'one share id is one knob: the same bounds in every layout (E-TYPE)'() {
    const f = findings(d => { stacked(d).children[1].share.maximum = 80; });
    has(f, 'E-TYPE', 'media 30..70 in row, 30..80 in stacked');
  },
  'the root place is drawn (E-DRAWN-MISSING) as a <rect> with no transform (E-PLACE)'() {
    eq(findings(d => { stacked(d).place = 'nope'; }), ['E-DRAWN-MISSING components/offer/offer.svg svg']);
    eq(findings(d => { stacked(d).place = 'offer-title'; }), ['E-PLACE components/offer/offer.svg offer-title']);
  },
  'items and repeats name what exists (E-REF-UNKNOWN)'() {
    eq(findings(d => { stacked(d).children[0].node.item = 'part:nope'; }), [`E-REF-UNKNOWN ${OFFER} /layouts/1/layoutPlan/children/0/node/item`]);
    eq(findings(d => { stacked(d).children[0].node.item = 'use:nope'; }), [`E-REF-UNKNOWN ${OFFER} /layouts/1/layoutPlan/children/0/node/item`]);
    eq(findings(d => { stacked(d).children[0].node.item = 'value:x'; }), [`E-REF-UNKNOWN ${OFFER} /layouts/1/layoutPlan/children/0/node/item`]);
    has(findings(d => { stacked(d).children[0].node = { kind: 'grid', columns: 2, repeat: 'photo' }; }), 'E-REF-UNKNOWN', 'photo is not a repeated use');
  },
  'limits: depth 12 (E-RANGE)'() {
    const f = findings(d => { let n = { item: 'part:offer-title' }; for (let i = 0; i < 12; i++) n = { kind: 'row', children: [{ node: n }] }; stacked(d).children[0].node = n; });
    has(f, 'E-RANGE', 'depth 14');
  },
  'an item box that leaves the root at a must size or a shape edge (E-RANGE)'() {
    // A scene plan whose fixed size is longer than the ad: the offer is pushed out at every size.
    const f = findings(d => { d.layouts[0].layoutPlan.children.unshift({ size: 4000, node: { item: 'part:offer-slot' } }); }, 'scenes/ad/scene.json');
    has(f, 'E-RANGE', 'a 4,000 unit size');
    ok(f.every(x => x.startsWith('E-RANGE scenes/ad/scene.json /layouts/0/layoutPlan')), JSON.stringify(f));
    // A component's plan at its shape's edges: a fixed size over the stacked layout's height.
    has(findings(d => { stacked(d).children[0].size = 900; }), 'E-RANGE', 'a 900 unit title in a 250 unit offer');
  },
};
