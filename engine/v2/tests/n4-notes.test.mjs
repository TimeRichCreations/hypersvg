// The doc notes of N4: the checked example for saying "done" when a clip ends (6.7), played here, and the spec text
// carries the same `on` map as the example folder (engine/v2/tests/n4-done-fixture); knob types (5.3.2); place names
// are kebab-case ids (5.10). The notes describe what the checker already does; these tests hold them to it.
import fs from 'node:fs';
import path from 'node:path';
import { folderSource, loadExperience } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { Player } from '../src/story.mjs';
import { hostApi } from '../src/host.mjs';
import { repo, spec, schemas, eq, ok, mapSource } from './helpers.mjs';

const codes = (files) => [...new Set(checkExperience(mapSource(files), schemas()).diags.map(d => d.code).filter(c => c.startsWith('E-')))].sort();
async function filesOf(dir) {
  const out = {};
  const walk = (d, pre) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const rel = pre ? `${pre}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(d, e.name), rel); else out[rel] = fs.readFileSync(path.join(d, e.name), 'utf8'); } };
  walk(dir, '');
  return out;
}
const fixture = path.join(repo, 'engine', 'v2', 'tests', 'n4-done-fixture');
async function flag() {
  const loaded = loadExperience(await folderSource(fixture), schemas());
  ok(loaded.experience, loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
  const p = new Player(loaded.experience, {});
  ok(p.start().ok);
  const host = hostApi(p);
  const heard = [];
  host.on('waved', () => heard.push(p.now ?? 'waved'));
  return { p, heard };
}

export const tests = {
  async '6.7, saying done: the example checks clean'() {
    const r = checkExperience(await folderSource(fixture), schemas());
    eq(r.diags.filter(d => d.code.startsWith('E-') || d.code.startsWith('W-')).map(d => d.code), []);
  },
  async '6.7, saying done: the page hears waved once, when the wave has finished'() {
    const { p, heard } = await flag();
    ok(p.activate('wave', 'go', undefined, 'person').ok);
    p.advance(599); eq(heard.length, 0, 'not before the clip ends');
    p.advance(1); eq(heard.length, 1, 'when the clip ends');
    p.advance(2000); eq(heard.length, 1, 'once');
  },
  async '6.7, saying done: a wave cut short by a new press says nothing; the new one says done'() {
    const { p, heard } = await flag();
    ok(p.activate('wave', 'go', undefined, 'person').ok);
    p.advance(300);
    ok(p.activate('wave', 'go', undefined, 'person').ok); // replaces the run: ended:wave with interrupted true
    eq(heard.length, 0);
    p.advance(600); eq(heard.length, 1);
  },
  '6.7: shows the example\'s ended:wave reaction as it is in the folder'() {
    const scene = JSON.parse(fs.readFileSync(path.join(fixture, 'wave.json'), 'utf8'));
    const text = fs.readFileSync(path.join(spec, '06-drawing.md'), 'utf8');
    ok(text.includes(`"ended:wave": ${JSON.stringify(scene.on['ended:wave']).replace(/":/g, '": ').replace(/,"/g, ', "')}`), '06-drawing.md holds the reaction');
    ok(text.includes('"outputs": {"waved": {"kind": "event"}}'), '06-drawing.md declares the output');
  },
  async 'knob types (5.3.2): a list is refused, a text value from a fixed list is not'() {
    const files = await filesOf(path.join(spec, 'conformance', 'hypersvg', 'folders', 'beacon'));
    const withKnob = (k) => { const doc = JSON.parse(files['experience.json']); doc.inputs.extra = k; return { ...files, 'experience.json': JSON.stringify(doc) }; };
    ok(codes(withKnob({ kind: 'knob', type: 'array', items: { type: 'string', maxLength: 8 }, initial: [] })).includes('E-TYPE'));
    eq(codes(withKnob({ kind: 'knob', type: 'string', enum: ['a', 'b'], maxLength: 1, initial: 'a' })), []);
  },
  async 'place names (5.10): a slot and its into are kebab-case'() {
    const files = await filesOf(path.join(spec, 'conformance', 'hypersvg', 'folders', 'badge'));
    const named = (n) => ({ ...files, 'scenes/card/card.svg': files['scenes/card/card.svg'].replace('data-hsvg-slot="tag-place"', `data-hsvg-slot="${n}"`), 'scenes/card/scene.json': files['scenes/card/scene.json'].replace('"into": "tag-place"', `"into": "${n}"`) });
    eq(codes(named('speech-point')), []);
    for (const n of ['speechPoint', 'speech_point']) { const c = codes(named(n)); ok(c.includes('E-MARK-VALUE') && c.includes('E-TYPE'), `${n}: ${c}`); }
  },
};
