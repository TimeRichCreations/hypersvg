// The checker's line rules (check/lines.mjs, 6.11, 8.9 captions), each with a failing copy of the lines
// fixture (tests/lines-fixture).
import fs from 'node:fs';
import path from 'node:path';
import { checkExperience } from '../check/index.mjs';
import { repo, schemas, eq } from './helpers.mjs';

const dir = path.join(repo, 'engine', 'v2', 'tests', 'lines-fixture');
const disk = (rel) => fs.readFileSync(path.join(dir, ...rel.split('/')));
const P = 'components/parrot/component.json'; const S = 'scenes/talk/scene.json';
const TEXT = ['experience.json', P, 'components/parrot/parrot.svg', S, 'scenes/talk/talk.svg', 'words/en.csv', 'words/es.csv'];
const base = Object.fromEntries(TEXT.map(f => [f, disk(f).toString('utf8')]));
// Checks the fixture after edit(parrot, scene, experience, files); returns the findings as [code, path].
const run = (edit = () => {}) => {
  const files = { ...base };
  const c = JSON.parse(files[P]); const s = JSON.parse(files[S]); const e = JSON.parse(files['experience.json']);
  edit(c, s, e, files);
  files[P] = JSON.stringify(c); files[S] = JSON.stringify(s); files['experience.json'] = JSON.stringify(e);
  const source = { read: (p) => files[p] ?? null, bytes: (p) => (p in files ? new TextEncoder().encode(files[p]) : fs.existsSync(path.join(dir, ...p.split('/'))) ? new Uint8Array(disk(p)) : null) };
  return checkExperience(source, schemas()).diags.map(d => [d.code, d.path]);
};
const voice = (c, lang = 'en') => c.addons.lines.lines.hello.voices[lang];

export const tests = {
  'the lines fixture checks with 0 findings'() { eq(run(), []); },
  'word and cue times: inside the duration, sorted, without overlap (E-RANGE)'() {
    eq(run((c) => { voice(c).words[2].endMs = 1300; }), [['E-RANGE', '/addons/lines/lines/hello/voices/en/words/2']]);
    eq(run((c) => { voice(c).cues[1].startMs = 100; }), [['E-RANGE', '/addons/lines/lines/hello/voices/en/cues/1']]);
    eq(run((c) => { voice(c, 'es').cues[0].endMs = 0; }), [['E-RANGE', '/addons/lines/lines/hello/voices/es/cues/0']]);
  },
  'word times for every word or none (E-RANGE)'() {
    eq(run((c) => { voice(c).words.pop(); }), [['E-RANGE', '/addons/lines/lines/hello/voices/en/words']]);
    eq(run((c) => { delete voice(c).words; }), []);
    // a text that reads a value cannot be counted from files
    eq(run((c) => { c.addons.lines.lines.hello.text = '{{ heard }} there friend'; }), []);
  },
  'a line text template is formula-checked in the lines pocket (formula/sites.mjs)'() {
    const d = run((c) => { c.addons.lines.lines.bye.text = '{{ nowhere + 1 }}'; });
    eq(d.filter(x => x[1] === '/addons/lines/lines/bye/text').length > 0, true);
  },
  'a voice audio is a sound resource in scope (E-REF-UNKNOWN)'() {
    eq(run((c) => { voice(c).audio = 'nothing'; }), [['E-REF-UNKNOWN', '/addons/lines/lines/hello/voices/en/audio']]);
  },
  'the mouth part is drawn and carries every look of its cues (refs.mjs: E-REF-UNKNOWN, E-LOOK-NOT-DRAWN)'() {
    eq(run((c) => { c.mouth.target = 'wing'; }), [['E-REF-UNKNOWN', '/mouth/target']]);
    eq(run((c) => { c.mouth.cues.F = 'grin'; }), [['E-LOOK-NOT-DRAWN', '/mouth/cues']]);
  },
  'a line field names a line of its block: its initial and a literal from a use (E-REF-UNKNOWN)'() {
    eq(run((c) => { c.inputs.greeting.initial = 'howdy'; }), [['E-REF-UNKNOWN', '/inputs/greeting/initial']]);
    eq(run((c, s) => { s.uses[0].with = { greeting: "'bye'" }; }), []);
    eq(run((c, s) => { s.uses[0].with = { greeting: "'howdy'" }; }), [['E-REF-UNKNOWN', '/uses/0/with/greeting']]);
  },
  'the captions rule: every line has a caption in its languages (E-RULE)'() {
    const rule = { id: 'every-line-captioned', kind: 'captions' };
    eq(run((c, s, e) => { e.rules = [rule]; }), []);
    eq(run((c, s) => { s.rules = [rule]; }), []); // the parrot is inside the scene
    // a voice in a language whose words lack the line's text
    eq(run((c, s, e) => { e.rules = [rule]; c.addons.lines.lines.bye.voices = { fr: { durationMs: 800 } }; }), [['E-RULE', '/rules/0']]);
    eq(run((c, s, e) => { e.rules = [rule]; c.addons.lines.lines.bye.text = '  '; }), [['E-RULE', '/rules/0']]);
  },
};
