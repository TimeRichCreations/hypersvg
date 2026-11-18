// The add-ons' moves (9.6; added after 2.0.0-next.0): page signals, hook health and cut marks (page.health,
// page.signal, page.cut), a video place's news (media.report), a snapshot's status (snapshot.status), seat fills
// (seats.fill, with the occupants in the state document, 9.6.1) and a built-in AI answer matched from typed words
// (ai.arrive, how builtIn or late, with the matched intent). Each is recorded through the move hook and fed again to a
// logic-only player, which gives the same fingerprint after every move. Built-in add-on code (D30), so these run in the
// hypersvg-addons checks.
import fs from 'node:fs';
import path from 'node:path';
import { modulePort, aiPort } from '../src/host.mjs';
import { logic } from '../src/logic.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';
import '../src/capabilities/all.mjs';

const v2 = path.join(repo, 'engine', 'v2');
const LOCK = JSON.parse(fs.readFileSync(path.join(v2, 'modules', 'lock.json'), 'utf8'));
for (const m of ['chess', 'chess-opponent']) await import(new URL(`../modules/${m}/index.mjs`, import.meta.url).href);
const load = async (rel) => {
  const l = loadExperience(await folderSource(path.join(repo, rel)), schemas());
  if (!l.experience) throw new Error(l.diags.map(d => `${d.code} ${d.message}`).join('; '));
  return l.experience;
};
const tick = () => new Promise(r => setTimeout(r, 0));

// A recording: a logic-only player whose moves are heard, and the fingerprint after each move (mark() after each
// input, and after an answer that arrives later).
function recorder(exp, opts = {}) {
  const moves = []; const prints = [];
  const a = logic(exp, { epochMs: 0, ...opts, onMove: (m) => moves.push(m) });
  const mark = () => { while (prints.length < moves.length) prints.push(a.fingerprint()); };
  return { a, moves, prints, mark };
}
// Feeds the moves to a fresh logic-only player and compares the fingerprint after every move.
function sameAfterEach(exp, r, opts = {}) {
  const heard = [];
  const b = logic(exp, { epochMs: 0, ...opts, onMove: (m) => heard.push(m) });
  r.moves.forEach((m, i) => { b.feed(m); eq(b.fingerprint(), r.prints[i], `fingerprint after move ${i} ${JSON.stringify(m).slice(0, 140)}`); });
  eq(heard, r.moves, 'the replay hears the same moves');
  ok(!r.moves.some(m => m.source === 'door'), `no door move: ${r.moves.map(m => m.source).join(', ')}`);
  return b;
}
const sources = (r) => r.moves.map(m => m.source);

// ---------- page: an experience on a host page (as tests/w5p-page.test.mjs) ----------
const HOOKS = { name: { kind: 'target' }, email: { kind: 'target' } };
const PAGE_GRANTS = { signals: ['clicked:name', 'scroll'], pageActions: ['point:name', 'highlight:email'] };
const pageExp = () => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['page'], addons: { page: { hooks: HOOKS } }, grants: PAGE_GRANTS, story: { start: 'a', scenes: { a: 'a.json' } } },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { a: { file: 'a.json', drawings: {}, words: {}, doc: {
    format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
    values: { heard: { type: 'string', initial: '', maxLength: 40 }, ends: { type: 'string', initial: '', maxLength: 200 } },
    on: {
      'page:clicked:name': [{ id: 'c', actions: [{ id: 'h', set: 'heard', to: "'name'" }, { id: 'p', call: 'page.point', with: { hook: "'name'" } }, { id: 'hl', call: 'page.highlight', with: { hook: "'email'", durationMs: 900 } }] }],
      'page:scroll': [{ id: 's', actions: [{ id: 'h', set: 'heard', to: "'scroll ' + formatNumber(event.progress, 2, false)" }] }],
      'page:ended:p': [{ id: 'e', actions: [{ id: 'w', set: 'ends', to: "ends + 'p' + (event.interrupted ? '!' : '.')" }] }],
      'page:ended:hl': [{ id: 'e2', actions: [{ id: 'w', set: 'ends', to: "ends + 'hl' + (event.interrupted ? '!' : '.')" }] }],
    },
  } } },
});
const PAGE_HOST = { grants: { ...PAGE_GRANTS, hooks: Object.keys(HOOKS) } };

// ---------- media: one video place (as tests/w6v-media.test.mjs) ----------
const RES = { clip: { kind: 'video', file: 'media/clip.webm', durationMs: 4000, width: 320, height: 180, digest: 'sha256:' + '0'.repeat(64) } };
const mediaExp = () => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['media'], resources: RES, story: { start: 'a', scenes: { a: 'scenes/a/scene.json' } } },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { a: { file: 'scenes/a/scene.json', drawings: {}, words: {}, doc: {
    format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
    values: { log: { type: 'string', initial: '', maxLength: 400 } },
    controls: { play: { kind: 'button', target: 'play-btn', event: 'play' } },
    bindings: [{ id: 'show', target: 'screen', media: { video: "'clip'" } }],
    on: {
      play: [{ id: 'p', actions: [{ id: 'go', call: 'media.play', with: { place: "'screen'" } }] }],
      'media:stalled:screen': [{ id: 'ls', actions: [{ id: 'ws', set: 'log', to: "log + 'stalled@' + formatNumber(event.atMs, 0, false) + ' '" }] }],
      'media:failed:screen': [{ id: 'lf', actions: [{ id: 'wf', set: 'log', to: "log + 'failed@' + formatNumber(event.atMs, 0, false) + ' '" }] }],
    },
  } } },
});

// ---------- snapshot: a save whose status the host writes (as tests/stage5-snapshot.test.mjs) ----------
const snapshotExp = () => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['snapshot'], story: { start: 'a', scenes: { a: 'a.json' } } },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { a: { file: 'a.json', drawings: {}, words: {}, doc: {
    format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
    values: { status: { type: 'string', initial: '', maxLength: 200 }, steps: { type: 'number', initial: 0 } },
    addons: { snapshot: { saves: { save: { picture: 'card', filename: 'card.png', pixelWidth: 600, status: 'status' } } } },
    on: { 'changed:status': [{ id: 'c', actions: [{ id: 'n', set: 'steps', to: 'steps + 1' }] }] },
  } } },
});

export const tests = {
  'page: hook health, signals and a cut mark are moves (page.health, page.signal, page.cut), fed again with the same fingerprint'() {
    const r = recorder(pageExp(), { host: PAGE_HOST });
    r.a.start(); r.mark();
    r.a.player.page.health({ name: 'found', email: 'found' }); r.mark();
    r.a.advance(200);
    r.a.player.page.signal('clicked:name'); r.mark();
    r.a.advance(300);
    r.a.player.page.signal('scroll', { progress: 0.5 }); r.mark();
    r.a.player.page.cut('a', 'p'); r.mark();
    r.a.advance(1000);
    r.a.player.page.health({ name: 'missing', email: 'found' }); r.mark();
    eq(sources(r), ['start', 'page.health', 'page.signal', 'page.signal', 'page.cut', 'page.health']);
    eq(r.moves[2].payload, ['clicked:name', { hook: 'name' }]);
    eq(r.moves[3].payload, ['scroll', { progress: 0.5 }]);
    eq(r.moves[4].payload, ['a', 'p']);
    eq([r.a.player.read('a', 'heard'), r.a.player.read('a', 'ends')], ['scroll 0.50', 'p!hl.']);
    const b = sameAfterEach(pageExp(), r, { host: PAGE_HOST });
    eq([b.player.read('a', 'heard'), b.player.read('a', 'ends')], ['scroll 0.50', 'p!hl.']);
  },
  'media: a video place\'s news is a move (media.report), fed again with the same fingerprint'() {
    const r = recorder(mediaExp());
    r.a.start(); r.mark();
    r.a.player.activate('a', 'play', undefined, 'person'); r.mark();
    r.a.advance(700);
    r.a.player.media.report('a', 'screen', 'stalled'); r.mark();
    r.a.advance(300);
    r.a.player.media.report('a', 'screen', 'failed'); r.mark();
    eq(sources(r), ['start', 'activate', 'media.report', 'media.report']);
    eq(r.moves[2].payload, ['a', 'screen', 'stalled']);
    eq(r.a.player.read('a', 'log'), 'stalled@700 failed@1000 ');
    const b = sameAfterEach(mediaExp(), r);
    eq(b.player.read('a', 'log'), 'stalled@700 failed@1000 ');
  },
  'snapshot: the host\'s status is a move (snapshot.status), at most 200 characters, fed again with the same fingerprint'() {
    const r = recorder(snapshotExp());
    r.a.start(); r.mark();
    r.a.player.snapshotStatus('a', 'status', 'Preparing picture…'); r.mark();
    r.a.advance(50);
    r.a.player.snapshotStatus('a', 'status', 'y'.repeat(300)); r.mark();
    eq(r.a.player.snapshotStatus('gone', 'status', 'late'), { ok: true, ignored: 'gone' }, 'nothing to write: no step, no move');
    eq(sources(r), ['start', 'snapshot.status', 'snapshot.status']);
    eq(r.moves[2].payload, ['a', 'status', 'y'.repeat(200)], 'the text as written');
    const b = sameAfterEach(snapshotExp(), r);
    eq([b.player.read('a', 'status').length, b.player.read('a', 'steps')], [200, 2]);
  },
  async 'seats: a fill is a move (seats.fill [seat, filler]); the occupants are in the state document; a replay gives the same fingerprint'() {
    const exp = await load('examples/2.0-board-game');
    const ports = () => ({ chess: modulePort({ lock: LOCK }), 'chess-opponent': modulePort({ lock: LOCK }), seats: modulePort({ lock: LOCK }) });
    const host = { grants: { fillers: ['agent', 'program'] } };
    const r = recorder(exp, { host, capabilities: ports() });
    const seats = r.a.player.seats;
    eq(seats.host('black', 'human'), { ok: true }); r.mark(); // before the start: a move too
    r.a.start(); r.mark();
    eq(r.a.state().blocks.experience.seats.occupants, { white: 'human', black: 'human' }, 'the occupants, in the state document');
    const humans = r.a.fingerprint();
    eq(seats.host('white', 'none'), { ok: true }); r.mark();
    ok(r.a.fingerprint() !== humans, 'the fingerprint sees a fill');
    const agent = seats.connect('agent-7');
    eq(agent.join('white'), { ok: true }); r.mark();
    eq(r.a.state().blocks.experience.seats.occupants.white, 'agent');
    const list = agent.legal('white');
    ok(list.ok && list.entries.length > 0, 'the agent has inputs');
    eq(agent.act('white', list.entries[0].key), { ok: true }); r.mark();
    r.a.advance(400);
    eq(agent.leave('white'), { ok: true }); r.mark();
    eq(seats.host('black', 'program'), { ok: true }); r.mark();
    r.a.player.restart(); r.mark();
    eq(r.a.state().blocks.experience.seats.occupants, { white: null, black: 'program' }, 'the occupants outlast a restart');
    eq(sources(r), ['seats.fill', 'start', 'seats.fill', 'seats.fill', 'seatInput', 'seats.fill', 'seats.fill', 'restart']);
    eq(r.moves.filter(m => m.source === 'seats.fill').map(m => m.payload), [['black', 'human'], ['white', null], ['white', 'agent'], ['white', null], ['black', 'program']]);
    ok(!JSON.stringify(r.moves).includes('agent-7'), 'a move never holds the identity behind a seat');
    const b = sameAfterEach(exp, r, { host, capabilities: ports() });
    eq(b.player.seats.occupant('black'), { filler: 'program', who: 'program:chess-opponent' });
    eq(b.feed({ t: b.now, source: 'seats.fill', payload: ['black', 'robot'] }).error.code, 'E-SEAT-INPUT', 'a fed fill is checked as the host port checks it');
  },
  async 'ai: a built-in answer matched from typed words is the move ai.arrive (builtIn, with the intent); the words never enter the state'() {
    const exp = await load('engine/v2/tests/ai-fixture');
    const r = recorder(exp);
    r.a.start(); r.mark();
    for (const text of ['My brakes squeak!', 'how do brakes work', 'what is the weather']) {
      r.a.player.setInput('askText', text, 'widget'); r.mark();
      r.a.player.send('desk', 'askGuide', {}, 'widget'); r.mark();
      ok(!JSON.stringify(r.a.state()).includes(text.slice(0, 6)), 'the typed words are not in the state document');
      await tick(); r.mark();
      r.a.advance(100);
    }
    const arrived = r.moves.filter(m => m.source === 'ai.arrive');
    eq(arrived.map(m => m.payload), [
      ['ask-1', 'builtIn', 'Brakes squeeze the wheel to slow it.', 'brakes'],
      ['ask-2', 'builtIn', 'Check the pads are not worn.', 'brakes'],
      ['ask-3', 'builtIn', null, null],
    ]);
    eq([r.a.player.read('desk', 'answer'), r.a.player.read('desk', 'answerFrom')], ['Let us look at the bike together.', 'fallback']);
    const b = sameAfterEach(exp, r);
    eq([b.player.read('desk', 'answer'), b.player.read('desk', 'answerFrom')], ['Let us look at the bike together.', 'fallback']);
    // A fed replay makes no answer of its own from the x letters it is fed.
    const c = logic(exp, { epochMs: 0 });
    for (const m of r.moves.slice(0, 3)) c.feed(m);
    await tick();
    eq(c.player.ai.waiting('desk'), true, 'it waits for the fed ai.arrive');
  },
  async 'ai: a failed or late AI answer to typed words falls back to the intent the move carries'() {
    const exp = await load('engine/v2/tests/ai-fixture');
    const host = { grants: structuredClone(exp.doc.grants || {}) };
    const silent = () => aiPort({ 'test-ai': () => new Promise(() => {}) });
    // Failed: the source throws; ai.arrive [key, failed, null, intent].
    const f = recorder(exp, { host, capabilities: { ai: aiPort({ 'test-ai': async () => { throw new Error('offline'); } }) } });
    f.a.start(); f.mark();
    f.a.player.setInput('askText', 'My brakes squeak!', 'widget'); f.mark();
    f.a.player.send('desk', 'askGuide', {}, 'widget'); f.mark();
    await tick(); f.mark();
    eq(f.moves.at(-1).payload, ['ask-1', 'failed', null, 'brakes']);
    eq([f.a.player.read('desk', 'answer'), f.a.player.read('desk', 'answerFrom')], ['Brakes squeeze the wheel to slow it.', 'builtIn']);
    sameAfterEach(exp, f, { host, capabilities: { ai: silent() } });
    // Late: the source never answers; its time limit passes, then ai.arrive [key, late, null, intent].
    const l = recorder(exp, { host, capabilities: { ai: silent() } });
    l.a.start(); l.mark();
    l.a.player.setInput('askText', 'brakes squeak', 'widget'); l.mark();
    l.a.player.send('desk', 'askGuide', {}, 'widget'); l.mark();
    l.a.advance(7999); await tick();
    eq(l.a.player.read('desk', 'answer'), '', 'still waiting');
    l.a.advance(1); await tick(); l.mark();
    eq(l.moves.at(-1), { t: 8000, source: 'ai.arrive', payload: ['ask-1', 'late', null, 'brakes'] });
    eq([l.a.player.read('desk', 'answer'), l.a.player.read('desk', 'answerFrom')], ['Brakes squeeze the wheel to slow it.', 'builtIn']);
    sameAfterEach(exp, l, { host, capabilities: { ai: silent() } });
  },
};
