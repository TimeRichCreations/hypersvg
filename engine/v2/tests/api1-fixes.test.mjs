// D63's fixes before the freeze and D64's follow-ups (added after 2.0.0-next.0). No browser; the page parts are in
// tests/browser/api1-browser.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { loadExperience, folderSource } from '../src/load.mjs';
import { logic, stateDocument } from '../src/logic.mjs';
import { MOVES } from '../src/runtime.mjs';
import * as hostModule from '../src/host.mjs';
import { errorDetail } from '../src/error-detail.mjs';
import * as mountEntry from '../web/mount-web.mjs';
import { checkExperience } from '../check/index.mjs';
import { repo, schemas, eq, ok, mapSource } from './helpers.mjs';

const load = async (rel) => {
  const l = loadExperience(await folderSource(path.join(repo, rel)), schemas());
  if (!l.experience) throw new Error(l.diags.map(d => `${d.code} ${d.message}`).join('; '));
  return l.experience;
};

export const tests = {
  // ---------- D63 fix 1: firstInput (10.4, 5.12) ----------
  async 'firstInput: a move; the engine reports it once per run, and a restart starts a new run'() {
    ok(MOVES.includes('firstInput'), 'firstInput is a move (9.6)');
    const moves = [];
    const l = logic(await load('docs/guide/examples/lamp'), { epochMs: 0, onMove: (m) => moves.push(m) });
    const heard = [];
    l.host.on('firstInput', (e) => heard.push(e.name));
    l.start();
    const before = l.fingerprint();
    ok(!('firstInput' in stateDocument(l.player)), 'a state before the first input has no firstInput key');
    const r = l.player.firstInput();
    ok(r.ok && !r.ignored, 'the first one runs');
    eq(r.outputs.map(o => o.name), ['firstInput'], 'it reports the built-in output');
    eq(heard, ['firstInput'], 'the host hears it');
    eq(stateDocument(l.player).firstInput, true, 'the state document says it was reported');
    ok(l.fingerprint() !== before, 'so the fingerprint changes');
    const again = l.player.firstInput();
    ok(again.ok && typeof again.ignored === 'string', 'a second one in the run is ignored');
    eq(heard.length, 1, 'and not heard');
    eq(moves.filter(m => m.source === 'firstInput').map(m => m.payload), [[], []], 'both were heard as moves with no payload');
    l.player.restart();
    ok(!('firstInput' in stateDocument(l.player)), 'a restart clears it');
    l.player.firstInput();
    eq(heard.length, 2, 'the new run reports it again');
  },
  async 'firstInput: a replay that feeds the move hears it again'() {
    const exp = await load('docs/guide/examples/lamp');
    const a = logic(exp, { epochMs: 0 });
    a.feed({ t: 0, source: 'start', payload: [null] });
    a.feed({ t: 100, source: 'firstInput', payload: [] });
    a.feed({ t: 100, source: 'activate', payload: ['lamp', 'switch', null, null, null] });
    eq(a.heard.filter(h => h.name === 'firstInput'), [{ t: 100, name: 'firstInput', detail: {} }], 'heard once, at its time');
  },
  // ---------- D63 fix 2: the host ports from ./mount ----------
  'the host ports aiPort, pagePort and modulePort are exported from ./mount (experimental)'() {
    for (const n of ['aiPort', 'pagePort', 'modulePort']) {
      eq(typeof mountEntry[n], 'function', `${n} is exported from mount-web.mjs`);
      ok(mountEntry[n] === hostModule[n], `${n} is the port of src/host.mjs`);
    }
    eq(mountEntry.aiPort({ 'browser-ai': async () => 'hi' }).kind, 'ai-port');
  },
  // ---------- D63 fix 4: the error detail always has code and message ----------
  'errorDetail: a code and a message always; the other fields stay; a failure with no code is E-HOST-ERROR'() {
    eq(errorDetail({ code: null, message: 'boom', source: 'listener' }), { code: 'E-HOST-ERROR', message: 'boom', source: 'listener' });
    eq(errorDetail({ code: 'E-RANGE', message: 'too big', source: 'start', address: 'a' }), { code: 'E-RANGE', message: 'too big', source: 'start', address: 'a' });
    eq(errorDetail({ code: 'W-SOUND-UNPLAYABLE', message: 'm', source: 'audio', path: 'a.ogg' }).path, 'a.ogg');
    eq(errorDetail('plain'), { message: 'plain', code: 'E-HOST-ERROR' });
    eq(errorDetail({}), { code: 'E-HOST-ERROR', message: '' });
  },
  async 'onError: a listener that throws a plain Error is heard with code E-HOST-ERROR'() {
    const heard = [];
    const l = logic(await load('docs/guide/examples/lamp'), { epochMs: 0, onError: (d) => heard.push(d) });
    l.host.on('switched', () => { throw new Error('host code broke'); });
    l.start();
    l.player.activate('lamp', 'switch');
    eq(heard.map(d => [d.code, d.message, d.source]), [['E-HOST-ERROR', 'host code broke', 'listener']]);
  },
  // ---------- D64 2: lookup over rows that are arrays ----------
  'W-LOOKUP-ARRAY: the checker warns on lookup over rows that are arrays; object rows are fine; the file still checks'() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Rows</title><text id="out" x="10" y="50">x</text></svg>';
    const files = (rows, item) => ({
      'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'rows', language: 'en', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] } },
      'scenes/one/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
        values: { rows: { type: 'array', maxItems: 4, items: item, initial: rows } },
        bindings: [{ target: 'out', text: "{{ lookup(rows, '0', 2, null) === null ? 'none' : 'found' }}" }] },
      'scenes/one/one.svg': svg,
    });
    const codes = (f) => checkExperience(mapSource(f), schemas()).diags.map(d => d.code);
    const arrays = codes(files([['1', 'a'], ['2', 'b']], { type: 'array', maxItems: 2, items: { type: 'string', maxLength: 4 } }));
    ok(arrays.includes('W-LOOKUP-ARRAY'), `array rows: ${arrays}`);
    ok(!arrays.some(c => c.startsWith('E-')), `a warning only: ${arrays}`);
    const objects = codes(files([{ 0: '1' }], { type: 'object', properties: { 0: { type: 'string', maxLength: 4 } }, required: ['0'], additionalProperties: false }));
    eq(objects, [], 'object rows check clean');
  },
  // ---------- D64 3 and 4: the formula files' README ----------
  'the formula files never hold a lone surrogate escape in a JSON string; the README says so, and why 4 units'() {
    const dir = path.join(repo, 'spec', '2.0', 'conformance', 'formula');
    // A lone surrogate in a parsed string can only come from a JSON escape: UTF-8 text cannot hold one.
    const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    const lone = [];
    const walk = (v, at) => { if (typeof v === 'string') { if (LONE.test(v)) lone.push(at); } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (LONE.test(k)) lone.push(`${at}/${k}`); walk(x, `${at}/${k}`); } };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    ok(files.length >= 5, `${files.length} formula files`);
    for (const f of files) walk(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), f);
    eq(lone, [], 'strings with a lone surrogate');
    ok(LONE.test('a\ud800b') && !LONE.test('a\ud83d\ude00b'), 'the test finds a lone one and passes a pair');
    const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
    ok(/never hold a lone\s+surrogate escape/.test(readme) && /Why 4/.test(readme), 'the README says both');
  },
};
