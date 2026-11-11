// Content tiers (7.9) and the give-way ladder (8.4), on the plain functions of src/ladder.mjs and the text
// steps of src/fit.mjs. No browser: text is measured by a fixed width per character.
import { wordingAt, wordingsDown, fieldShown, tierEntry, chooseTier, isTierObject, badSteps, ladderOrder, runLadder, readableFloor, textFloor, STEPS_BY_KIND } from '../src/ladder.mjs';
import { searchFit } from '../src/fit.mjs';
import { textStart, textStep, textLayout } from '../src/ladder.mjs';
import { eq, ok } from './helpers.mjs';

const H = { rich: 'Fresh sourdough, baked at dawn and delivered warm', medium: 'Fresh sourdough, delivered warm', short: 'Fresh sourdough' };
// Every character is 0.6 of the font size wide.
const measure = (px) => (s) => s.length * px * 0.6;

export const tests = {
  'a tier object gives its own wording, else the nearest longer, else the nearest shorter (7.9)'() {
    eq(wordingAt(H, 'medium'), H.medium);
    eq(wordingAt({ rich: 'R', short: 'S' }, 'medium'), 'R');
    eq(wordingAt({ short: 'S' }, 'rich'), 'S');
    eq(wordingAt({ medium: 'M' }, 'short'), 'M');
    eq(wordingAt('plain', 'rich'), 'plain');
    ok(isTierObject(H) && !isTierObject({ en: 'x' }) && !isTierObject({}) && !isTierObject(['x']));
  },
  'the short step goes down through authored wordings only, never an empty one (7.9, 8.4)'() {
    eq(wordingsDown(H, 'rich'), [H.rich, H.medium, H.short]);
    eq(wordingsDown(H, 'medium'), [H.medium, H.short]);
    eq(wordingsDown(H, 'short'), [H.short]);
    eq(wordingsDown({ rich: 'R', medium: 'R', short: '' }, 'rich'), ['R']);
    eq(wordingsDown({ rich: 'R', short: 'S' }, 'medium'), ['R', 'S']);
  },
  'a field shows from its own tier up; required fields are short (7.9)'() {
    ok(fieldShown({ required: false, tier: 'rich' }, 'rich'));
    ok(!fieldShown({ required: false, tier: 'rich' }, 'medium'));
    ok(!fieldShown({ required: false, tier: 'medium' }, 'short'));
    ok(fieldShown({ tier: 'rich' }, 'short'), 'a required field is short whatever its tier says');
    ok(fieldShown(undefined, 'short'));
  },
  'the tier by space: the first entry whose shape holds the space; one without a shape is the last resort (7.9)'() {
    const entry = { axis: 'content', select: 'space', tiers: [{ tier: 'rich' }, { tier: 'short', shape: { maxHeight: 120 } }, { tier: 'medium', shape: { maxPixels: 200000 } }] };
    eq(chooseTier(entry, { space: { width: 970, height: 250 } }).tier, 'rich');
    eq(chooseTier(entry, { space: { width: 728, height: 90 } }).tier, 'short');
    eq(chooseTier(entry, { space: { width: 300, height: 250 } }).tier, 'medium');
    eq(chooseTier(entry, { space: { width: 320, height: 50 } }).tier, 'short');
    eq(chooseTier(entry, { space: null }), { tier: 'rich', why: 'space' });
    eq(chooseTier(null), { tier: 'rich', why: 'none' });
  },
  'the tier by input, by person and by host: the value, else the default, else rich (7.1, 7.9)'() {
    const byInput = { axis: 'content', select: 'input', value: 'depth', default: 'medium' };
    eq(chooseTier(byInput, { valueOf: (n) => (n === 'depth' ? 'short' : undefined) }), { tier: 'short', why: 'input' });
    eq(chooseTier(byInput, { valueOf: () => 'huge' }), { tier: 'medium', why: 'default' });
    eq(chooseTier({ axis: 'content', select: 'person', default: 'medium' }).tier, 'medium');
    eq(chooseTier({ axis: 'content', select: 'person' }).tier, 'rich');
  },
  'the tier entry is the innermost one without a subject'() {
    const inner = { axis: 'content', select: 'input', value: 'tier', default: 'short' };
    const outer = { axis: 'content', select: 'space', tiers: [{ tier: 'rich' }] };
    const test = { axis: 'content', id: 'headline-test', select: 'seed', subject: 'field:x', options: ['a', 'b'] };
    eq(tierEntry([{ axes: [test, inner] }, { axes: [outer] }]), inner);
    eq(tierEntry([{ axes: [] }, { axes: [outer] }]), outer);
    eq(tierEntry([{}]), null);
  },
  'a step a kind may not use is found (8.4)'() {
    eq(badSteps({ kind: 'keep', steps: ['shrink', 'short', 'mark-only'] }), [{ step: 'short', index: 1 }]);
    eq(badSteps({ kind: 'fits', steps: ['short', 'mark-only'] }), [{ step: 'mark-only', index: 1 }]);
    eq(badSteps({ kind: 'inside', steps: ['column', 'crop'] }), []);
    eq(badSteps({ kind: 'clear', steps: ['column'] }), [{ step: 'column', index: 0 }]);
    ok(STEPS_BY_KIND.limit.includes('remove'));
  },
  'rules run lowest priority first, written order at equal priority (8.4)'() {
    const a = { id: 'a', priority: 0.8 }; const b = { id: 'b' }; const c = { id: 'c', priority: 0.2 }; const d = { id: 'd', priority: 0.5 };
    eq(ladderOrder([a, b, c, d]).map(r => r.id), ['c', 'b', 'd', 'a']);
  },
  'the ladder stops as soon as every rule holds; a rule uses up its steps before the next (8.4)'() {
    // Two rules sharing space: "need" counts how much room is still missing; each step gives one unit.
    let need = 3; const log = [];
    const low = { id: 'low', priority: 0.2, steps: ['short', 'remove'] };
    const high = { id: 'high', priority: 0.9, steps: ['shrink'] };
    const left = { low: { short: 1, remove: 1 }, high: { shrink: 5 } };
    const r = runLadder([high, low], {
      holds: () => need <= 0,
      apply: (rule, step) => { if (!left[rule.id][step]) return false; left[rule.id][step]--; need--; log.push(`${rule.id}:${step}`); return true; },
      related: () => true,
    });
    eq(log, ['low:short', 'low:remove', 'high:shrink']);
    eq(r.outcome, 'reduced');
    eq(r.used, [{ rule: 'low', step: 'short', times: 1 }, { rule: 'low', step: 'remove', times: 1 }, { rule: 'high', step: 'shrink', times: 1 }]);
  },
  'a rule in its own region takes no step for another; past every floor the output is incomplete (8.4)'() {
    const a = { id: 'a', priority: 0.1, steps: ['shrink'] }; const b = { id: 'b', priority: 0.9, steps: ['shrink'] };
    let bLeft = 1; let aMoves = 0;
    const r = runLadder([a, b], { holds: (x) => (x === a ? true : bLeft < 0), apply: (x) => { if (x === a) { aMoves++; return true; } if (bLeft > 0) { bLeft--; return true; } return false; } });
    eq(aMoves, 0);
    eq(r.outcome, 'incomplete');
    eq(runLadder([a], { holds: () => true, apply: () => true }).outcome, 'unchanged');
    const spin = runLadder([a], { holds: () => false, apply: () => true, maxMoves: 10 });
    eq([spin.outcome, spin.ranOut, spin.moves], ['incomplete', true, 10]);
  },
  'the readable floor is the strictest of the host and every readable rule; a rule floor never goes below it (8.4, 7.6)'() {
    eq(readableFloor([], null), 12);
    eq(readableFloor([], null, 9), 9);
    const docs = [{ rules: [{ id: 'r', kind: 'readable', minTextPx: 'host', byRole: { legal: 14 } }] }];
    eq(readableFloor(docs, 'legal', 10), 14);
    eq(readableFloor(docs, 'body', 10), 10);
    eq(textFloor({ floor: { minTextPx: 9 } }, 12), 12);
    eq(textFloor({ floor: { minTextPx: 13 } }, 12), 13);
  },
  'text steps: short, wrap, shrink and remove move one at a time (8.4)'() {
    const fit = { region: 'r', fontPx: 20, minFontPx: 10, maxLines: 2 };
    let st = textStart({ wordings: wordingsDown(H, 'rich'), fit, drawnPx: 20, steps: ['short', 'wrap', 'shrink', 'remove'], optional: true });
    eq([st.lines, st.sizes[0], st.sizes[st.sizes.length - 1]], [1, 20, 10]);
    st = textStep(st, 'short'); eq(st.wi, 1);
    st = textStep(st, 'short'); eq(st.wi, 2);
    eq(textStep(st, 'short'), null);
    st = textStep(st, 'wrap'); eq(st.lines, 2);
    eq(textStep(st, 'wrap'), null);
    st = textStep(st, 'shrink'); eq(st.si, 1);
    st = textStep(st, 'remove'); ok(st.removed);
    eq(textLayout(st, measure, 100, 40), { px: 19, lines: [], text: '', full: H.short, fits: true, removed: true });
    eq(textStep(textStart({ wordings: ['x'], fit, drawnPx: 20, steps: ['remove'] }), 'remove'), null, 'a required text is never removed');
  },
  'the floor bounds shrink: the sizes stop at the floor in drawing units'() {
    const st = textStart({ wordings: ['x'], fit: { box: 'r', fontPx: 20, minFontPx: 6 }, drawnPx: 20, floorUnits: 13 });
    eq(st.sizes[st.sizes.length - 1], 13);
    eq(textStart({ wordings: ['x'], fit: { box: 'r', fontPx: 10, minFontPx: 6 }, drawnPx: 10, floorUnits: 13 }).sizes, [10]);
  },
  'ellipsis cuts after a whole word and keeps the full text (8.4)'() {
    let st = textStart({ wordings: ['Terms apply to every order'], fit: { box: 'r', fontPx: 10, minFontPx: 10 }, drawnPx: 10, steps: ['ellipsis'] });
    ok(!textLayout(st, measure, 100, 20).fits);
    st = textStep(st, 'ellipsis');
    const l = textLayout(st, measure, 100, 20);
    eq([l.fits, l.text, l.full], [true, 'Terms apply to…', 'Terms apply to every order']);
  },
  'with only wrap and shrink, the ladder ends where searchFit ends, in either order (7.6)'() {
    const value = 'Fresh sourdough, baked at dawn and delivered warm';
    for (const steps of [['wrap', 'shrink'], ['shrink', 'wrap'], ['short', 'wrap', 'shrink']]) {
      for (const [room, height] of [[200, 60], [300, 30], [120, 80], [500, 20]]) {
        const fit = { region: 'r', fontPx: 24, minFontPx: 8, maxLines: 3, steps };
        const want = searchFit(value, fit, 24, measure, room, height);
        let st = textStart({ wordings: [value], fit, drawnPx: 24, steps });
        const rule = { id: 'f', steps };
        runLadder([rule], { holds: () => textLayout(st, measure, room, height).fits, apply: (_, s) => { const n = textStep(st, s); if (!n) return false; st = n; return true; } });
        const got = textLayout(st, measure, room, height);
        eq([got.px, got.lines, got.fits ? 'fitted' : 'incomplete'], [want.px, want.lines, want.outcome], `${steps} at ${room}x${height}`);
      }
    }
  },
};
