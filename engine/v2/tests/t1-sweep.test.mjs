// test.mjs --all (the sweep's list) and --baseline / --compare (the fingerprints). No browser.
import path from 'node:path';
import { eq, ok } from './helpers.mjs';
import { sweepList, compareFingerprints, printName, table } from '../tools/test/sweep.mjs';

export const tests = {
  'the sweep list: every 2.0 experience folder, sorted, no private or source folders'() {
    const list = sweepList();
    ok(list.length > 100, `${list.length} experiences`);
    ok(list.includes(path.join('engine', 'v2', 'tests', 't1-fixture')), 'the fixture is in it');
    ok(!list.some(p => p.split(path.sep).some(x => ['private', 'sources', 'node_modules', '.git'].includes(x))), 'no private, sources, node_modules or .git');
    eq([...list].sort(), list);
  },
  'a fingerprint file name is the folder with __ for each separator'() {
    eq(printName(path.join('examples', '2.0-library', 'choices')), 'examples__2.0-library__choices');
  },
  'baseline and compare: every difference, by layout, scene and step'() {
    const step = { after: 'arrive', scene: 'a', values: { a: { values: { n: 1 } } }, texts: { t: 'One' }, boxes: { t: [0, 0, 10, 10] }, names: [['i', 'button', 'Go', null, null, false]] };
    const a = { wide: { a: [step, { ...structuredClone(step), after: 'a#go press' }] } };
    const b = structuredClone(a);
    eq(compareFingerprints(a, b), []);
    b.wide.a[1].texts.t = 'Two'; b.wide.a[1].boxes.t = [0, 0, 10.5, 10]; b.wide.a[1].names[0][2] = 'Go on';
    const d = compareFingerprints(a, b);
    eq(d.map(x => [x.layout, x.scene, x.step, x.what]), [['wide', 'a', 'a#go press', 'texts'], ['wide', 'a', 'a#go press', 'boxes'], ['wide', 'a', 'a#go press', 'names']]);
    ok(/t "One" -> "Two"/.test(d[0].detail), d[0].detail);
    b.wide.a.pop(); eq(compareFingerprints(a, b).map(x => x.what), ['step']);
    delete b.wide.a; eq(compareFingerprints(a, b).map(x => x.what), ['scene']);
  },
  'the table: one row per experience'() {
    const t = table([{ target: 'x/y', scenes: 2, errors: 1, warnings: 0, ms: 1500, top: 'T-HIT-SMALL 1' }]).split('\n');
    eq(t.length, 3);
    ok(/^x\/y\s+2\s+1\s+0\s+1\.5\s+T-HIT-SMALL 1$/.test(t[2]), t[2]);
  },
};
