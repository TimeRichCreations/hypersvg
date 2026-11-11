// Rules settled after the author review (R1): machines are a list run in list order (5.14), a use's with takes tier,
// language and row literals (5.3.1, 5.6.1), and an endless story keeps a scene with no way out (3.1, 3.9).
import { Player } from '../src/story.mjs';
import { loadExperience } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { schemas, eq, ok, mapSource } from './helpers.mjs';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect id="bg" width="10" height="10" fill="#fff" data-hsvg-layer="decoration"/><g id="slot" data-hsvg-kind="part" data-hsvg-slot="card"/></svg>';
const CARD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" width="10" height="10"><g id="card" data-hsvg-kind="component"><text id="card__label" data-hsvg-kind="part">x</text></g></svg>';
const files = (story = {}, scene = {}, more = {}) => ({
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'x', about: { title: 'X' }, needs: [], story: { start: 'a', scenes: { a: 'scenes/a/scene.json' }, ends: ['a'], ...story }, ...more },
  'scenes/a/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', ...scene },
  'scenes/a/a.svg': SVG,
});
const codes = (diags) => diags.filter(d => d.code.startsWith('E-')).map(d => d.code);

export const tests = {
  'machines run in list order: the second sees the first one\'s write for the same event (5.14)'() {
    const scene = {
      values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 }, seen: { type: 'number', initial: -1, minimum: -1, maximum: 9 } },
      machines: [
        { id: 'first', initial: 's', states: { s: { on: { go: [{ id: 'one', actions: [{ id: 'set-n', set: 'n', to: 5 }] }] } } } },
        { id: 'second', initial: 's', states: { s: { on: { go: [{ id: 'two', actions: [{ id: 'copy', set: 'seen', to: 'n' }] }] } } } },
      ],
    };
    const l = loadExperience(mapSource(files({}, scene)), schemas());
    eq(codes(l.diags), []);
    const p = new Player(l.experience);
    ok(p.start().ok);
    ok(p.send('a', 'go').ok);
    eq(p.state.blocks.a.values.seen, 5);
  },
  'a machine id used twice in the list is E-ID-DUPLICATE'() {
    const m = { initial: 's', states: { s: {} } };
    const l = loadExperience(mapSource(files({}, { machines: [{ id: 'm', ...m }, { id: 'm', ...m }] })), schemas());
    ok(codes(l.diags).includes('E-ID-DUPLICATE'), JSON.stringify(l.diags));
  },
  'machines written as a map are refused by the schema (the 2.0 form is a list)'() {
    const l = loadExperience(mapSource(files({}, { machines: { m: { initial: 's', states: { s: {} } } } })), schemas());
    ok(codes(l.diags).includes('E-TYPE'), JSON.stringify(l.diags));
  },
  'a use\'s with takes a language object, a tier object and literal rows (5.3.1, 5.6.1)'() {
    const exp = {
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'de', story: { start: 'a', scenes: { a: 'a.json' } } },
      words: { en: {} }, data: {},
      scenes: { a: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
        uses: [{ id: 'c', use: 'card', into: 'card', with: { label: { en: 'Fresh bread', de: 'Frisches Brot' }, tag: { short: 'New', rich: 'Brand new today' }, rows: [{ id: 'r1' }, { id: 'r2' }] } }] }, drawings: { main: { text: SVG } }, words: {} } },
      blocks: { card: { doc: { format: 'hsvg/2.0', kind: 'component', id: 'card', drawing: 'card.svg', inputs: {
        label: { kind: 'content', type: 'string', maxLength: 40, initial: '' },
        tag: { kind: 'content', type: 'string', maxLength: 40, initial: '' },
        rows: { kind: 'content', type: 'array', maxItems: 4, items: { type: 'object', properties: { id: { type: 'string', maxLength: 8 } } }, initial: [] } } },
        drawings: { main: { text: CARD } }, words: {} } },
    };
    const p = new Player(exp);
    ok(p.start().ok);
    // The block keeps the objects; a read gives the wording (tiers reach formulas, 7.9).
    eq([p.read('a/c', 'label'), p.read('a/c', 'tag'), p.read('a/c', 'rows').length], ['Frisches Brot', 'New', 2]);
  },
  'an endless story may keep a scene with no way out, and needs no ends (3.1, 3.9)'() {
    const endless = checkExperience(mapSource(files({ ends: [], endless: true })), schemas(), { only: ['story'] });
    eq(codes(endless.diags), []);
    const plain = checkExperience(mapSource(files({ ends: [] })), schemas(), { only: ['story'] });
    ok(codes(plain.diags).includes('E-STORY-NO-END') || codes(plain.diags).includes('E-STORY-DEAD-END'), JSON.stringify(plain.diags));
  },
};
