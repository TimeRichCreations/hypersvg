// Spoken lines (6.11), engine half, no browser. The page half (captions, the recording) is checked by
// tests/browser/lines-browser.mjs.
import path from 'node:path';
import { Player } from '../src/story.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
const { wordSegments, linePlan, mouthAt, cueAt } = await addonCode('../src/lines.mjs', import.meta.url) ?? {};
import { eq, ok, repo, schemas, addonCode } from './helpers.mjs';

const dir = path.join(repo, 'engine', 'v2', 'tests', 'lines-fixture');
let loaded;
const fixture = async () => structuredClone((loaded ??= loadExperience(await folderSource(dir), schemas())).experience);
const started = async ({ ambient = {}, edit = null } = {}) => {
  const x = await fixture();
  edit?.(x);
  const p = new Player(x, {});
  Object.assign(p.state.ambient, ambient);
  const r = p.start(); ok(r.ok, r.fault?.message);
  return p;
};
const P = 'talk/polly';
const heard = (p) => p.state.blocks[P].values.heard;
const send = (p, ev) => { const r = p.send('talk', ev); ok(r.ok, r.fault?.message); return r; };

export const tests = {
  'words are the word-like segments: punctuation and spaces do not count'() {
    eq(wordSegments('Hello there, friend!').map(w => w.text), ['Hello', 'there', 'friend']);
    eq(wordSegments('¡Hola, amigo mío!').map(w => w.text), ['Hola', 'amigo', 'mío']);
    eq(wordSegments("can't stop 3.14 e.g. a_b").map(w => w.text), ["can't", 'stop', '3.14', 'e.g', 'a_b']);
    eq(wordSegments('猫が好き').length, 4); // each ideograph or hiragana is one segment
    eq(wordSegments('  ... !').length, 0);
    const s = wordSegments('Hi, you'); eq([s[1].start, s[1].end], [4, 7]);
  },
  'the plan: a voice gives its times; without one, equal word intervals over durationMs'() {
    const line = { text: 'x', durationMs: 900 };
    const p = linePlan(line, 'See you soon.', 'en');
    eq(p.durationMs, 900); eq(p.words.map(w => [w.startMs, w.endMs]), [[0, 300], [300, 600], [600, 900]]);
    const v = linePlan({ durationMs: 900, voices: { en: { durationMs: 500 } } }, 'a b', 'en-GB');
    eq(v.durationMs, 500); eq(v.tag, 'en'); eq(v.words.map(w => w.endMs), [250, 500]);
  },
  'the mouth shows the cue holding t + leadMs, X between and after cues, blending over blendMs'() {
    const mouth = { leadMs: 20, blendMs: 60, cues: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e', F: 'f', G: 'g', H: 'h', X: 'rest' } };
    const cues = [{ startMs: 0, endMs: 200, cue: 'C' }, { startMs: 300, endMs: 400, cue: 'B' }];
    eq(cueAt(cues, 199), 'C'); eq(cueAt(cues, 200), 'X');
    eq(mouthAt(mouth, cues, 100).look, 'c');
    eq(mouthAt(mouth, cues, 185).look, 'rest'); // 185 + 20 = 205: between cues
    const m = mouthAt(mouth, cues, 290); // 310: 10 ms into B, blending from rest
    eq([m.look, m.from], ['b', 'rest']); ok(Math.abs(m.mix - 10 / 60) < 1e-9);
    eq(mouthAt(mouth, cues, 500).look, 'rest');
  },
  async 'a scene fires the character trigger; the character says its line: spoken, words, event, ended'() {
    const p = await started();
    eq(p.scope(P).name('spoken'), { line: '', text: '', word: -1 });
    send(p, 'askHello');
    eq(p.scope(P).name('spoken'), { line: 'hello', text: 'Hello there, friend!', word: -1 });
    p.advance(0);
    eq(p.scope(P).name('spoken').word, 0);
    p.advance(450);
    eq(p.scope(P).name('spoken').word, 1);
    eq(heard(p), 'stress '); eq(p.state.blocks.talk.values.stresses, 1); // the word event, heard by the scene too
    p.advance(400); // 850: the gap between words 1 and 2
    eq(p.scope(P).name('spoken').word, -1);
    p.advance(100);
    eq(p.scope(P).name('spoken').word, 2);
    p.advance(300); // 1250: the English voice's 1200 ms
    eq(p.scope(P).name('spoken'), { line: '', text: '', word: -1 });
    eq(heard(p), 'stress done ');
  },
  async 'another language uses its own voice; a line with no voice runs for durationMs'() {
    const p = await started({ ambient: { language: 'es' } });
    send(p, 'askHello');
    eq(p.scope(P).name('spoken').text, '¡Hola, amigo mío!');
    p.advance(1550); ok(p.state.blocks[P].line, 'still speaking at 1550 (es is 1600)');
    p.advance(60); eq(p.state.blocks[P].line, null);
    send(p, 'askBye');
    eq(p.scope(P).name('spoken').text, 'Hasta pronto.');
    p.advance(899); ok(p.state.blocks[P].line); p.advance(1); eq(heard(p), 'stress done bye-done ');
  },
  async 'say replaces a running line: ended interrupted, one line at a time'() {
    const p = await started();
    send(p, 'askHello'); p.advance(100);
    send(p, 'askBye');
    eq(p.scope(P).name('spoken').line, 'bye');
    eq(heard(p), 'cut ');
    p.advance(2000);
    eq(heard(p), 'cut bye-done '); // no stray hello timers
  },
  async 'the call lines.stop clears spoken and fires lines:ended with interrupted'() {
    const p = await started();
    send(p, 'askHello');
    const r = p.transaction('host', () => p.runActions(P, [{ id: 'hush', call: 'lines.stop' }], 'test'));
    ok(r.ok, r.fault?.message);
    eq(p.scope(P).name('spoken'), { line: '', text: '', word: -1 }); eq(heard(p), 'cut ');
    ok(r.deliveries.some(d => d.kind === 'stopLine' && d.address === P));
  },
  async 'changed:spoken reaches the speaking block at each word change'() {
    const p = await started({ edit: (x) => { const d = x.blocks.parrot.doc; d.values.changes = { type: 'number', initial: 0, minimum: 0, maximum: 100 }; d.on['changed:spoken'] = [{ id: 'cnt', actions: [{ id: 'cnt-up', set: 'changes', to: "changes + 1" }] }]; } });
    send(p, 'askHello'); p.advance(2000);
    // start, word 0, word 1, gap, word 2, end
    eq(p.state.blocks[P].values.changes, 6);
  },
  async 'the mouth: cues drive the speaking block own mouth part, then it returns to its usual writer'() {
    const p = await started();
    eq(p.mouthLooks, []);
    send(p, 'askHello');
    p.advance(100);
    eq(p.mouthLooks.map(m => [m.address, m.target, m.look]), [[P, 'beak', 'wide']]);
    p.advance(500); // 600 + 20 lead: E
    eq(p.mouthLooks[0].look, 'round');
    p.advance(450); // 1050 + 20: after the cues
    eq(p.mouthLooks[0].look, 'shut');
    p.advance(300);
    eq(p.mouthLooks, []);
    // the loudness mouth's list (set by the audio page part) passes through for other parts
    p.mouthLooks = [{ address: 'talk', target: 'meter', look: 'loud' }];
    eq(p.mouthLooks, [{ address: 'talk', target: 'meter', look: 'loud' }]);
  },
  async 'a line without cues holds the rest look while it runs'() {
    const p = await started();
    send(p, 'askBye'); p.advance(100);
    eq(p.mouthLooks.map(m => m.look), ['shut']);
  },
  async 'muted, captions and the mouth still run by timing; reduced motion changes nothing'() {
    const p = await started({ ambient: { muted: true, reducedMotion: true, voice: true } });
    send(p, 'askHello');
    eq(p.scope(P).name('spoken').text, 'Hello there, friend!');
    p.advance(100); eq(p.mouthLooks[0].look, 'wide');
    p.advance(1200); eq(heard(p), 'stress done ');
  },
  async 'voice on with audio: the say delivery asks for the recording; align keeps the origin on its position'() {
    const p = await started({ ambient: { voice: true } });
    const r = send(p, 'askHello');
    const d = r.deliveries.find(x => x.kind === 'say');
    eq([d.address, d.line, d.voiced, d.source.path], [P, 'hello', true, 'components/parrot/hello-en.wav']);
    p.advance(200); // the recording started late: it is at 50 ms
    ok(p.lines.align(P, d.run, 50));
    eq(p.scope(P).name('spoken').word, 0);
    p.advance(300); // engine 500, line time 350: still word 0
    eq(p.scope(P).name('spoken').word, 0);
    p.advance(60); eq(p.scope(P).name('spoken').word, 1);
    p.advance(1200 - 410 - 1); ok(p.state.blocks[P].line, 'the line ends at its own time, 150 ms late');
    p.advance(1); eq(p.state.blocks[P].line, null);
    // voice off: a silent line, nothing to align
    const q = await started();
    const d2 = send(q, 'askHello').deliveries.find(x => x.kind === 'say');
    eq([d2.voiced, d2.source], [false, null]); ok(!q.lines.align(P, d2.run, 10));
  },
  async 'a recording that ends at the line length ends the line at once, whatever the float error'() {
    const p = await started({ ambient: { voice: true } });
    const d = send(p, 'askHello').deliveries.find(x => x.kind === 'say');
    p.advance(5); ok(p.lines.align(P, d.run, 2)); // the recording is 3 ms behind
    p.advance(1195); ok(p.state.blocks[P].line, 'still speaking at 1200: the line ends at 1203');
    ok(p.lines.align(P, d.run, 1200 + 1e-10, true)); // its end, with float error
    p.advance(0); eq(p.state.blocks[P].line, null);
  },
  async 'a paused owner holds its line'() {
    const p = await started();
    send(p, 'askHello'); p.advance(100);
    p.setPause('host', true); p.advance(5000); p.setPause('host', false);
    eq(p.scope(P).name('spoken').word, 0);
    p.advance(1100); eq(p.state.blocks[P].line, null);
  },
  async 'a link on lines:ended:<line> waits for its line; a line never started counts its declared length'() {
    const edit = (sayIt) => (x) => {
      const s = x.scenes.talk.doc;
      s.addons = { lines: { lines: { intro: { text: 'Welcome in.', durationMs: 700 } } } };
      if (sayIt) s.entry = [{ id: 'narrate', call: 'lines.say', with: { line: "'intro'" } }];
      x.scenes.next = { file: 'scenes/next/scene.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'next', drawing: 'talk.svg' }, drawings: x.scenes.talk.drawings, words: {} };
      x.doc.story = { start: 'talk', scenes: { ...x.doc.story.scenes, next: 'scenes/next/scene.json' }, links: [{ id: 'after-intro', from: 'talk', on: 'lines:ended:intro', to: 'next' }], ends: ['next'] };
    };
    const a = await started({ edit: edit(false) });
    a.advance(699); eq(a.scene, 'talk'); a.advance(1); eq(a.scene, 'next');
    const b = await started({ edit: edit(true) });
    eq(b.scope('talk').name('spoken').line, 'intro');
    b.setPause('host', true); b.advance(3000); b.setPause('host', false); // the line pauses with its scene
    b.advance(699); eq(b.scene, 'talk'); b.advance(1); eq(b.scene, 'next');
  },
  async 'a content field of contentType line names the line lines.say speaks'() {
    const p = await started();
    const r = p.transaction('host', () => p.runActions(P, [{ id: 'greet', call: 'lines.say', with: { line: 'greeting' } }], 'test'));
    ok(r.ok, r.fault?.message);
    eq(p.scope(P).name('spoken').line, 'hello');
  },
  async 'say of an unknown line stops with E-REF-UNKNOWN'() {
    const p = await started();
    const r = p.send(P, 'say', { line: 'nope' });
    eq(r.ok, false); eq(r.fault.code, 'E-REF-UNKNOWN');
  },
  async 'read-along: spokenNow gives the current word and each word range'() {
    const p = await started();
    send(p, 'askHello'); p.advance(500);
    const s = p.lines.spokenNow(P);
    eq([s.line, s.word, s.words[s.word].start, s.words[s.word].end], ['hello', 1, 6, 11]);
    eq(s.text.slice(s.words[1].start, s.words[1].end), 'there');
  },
};
