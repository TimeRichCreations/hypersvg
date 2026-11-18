// Replay support with add-ons (9.6; added after 2.0.0-next.0): a logic module (chess, with seats and the chess
// opponent) and a host AI source, whose answers arrive later and are moves (ai.arrive). Built-in add-on code (D30), so
// these run in the hypersvg-addons checks.
import fs from 'node:fs';
import path from 'node:path';
import { modulePort, aiPort } from '../src/host.mjs';
import { logic } from '../src/logic.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { sameEveryStep } from './r1-replay.test.mjs';
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

export const tests = {
  async 'replay: chess (a logic module, with seats) gives the same fingerprint after every move'() {
    const ports = () => ({ chess: modulePort({ lock: LOCK }), 'chess-opponent': modulePort({ lock: LOCK }), seats: modulePort({ lock: LOCK }) });
    const exp = await load('examples/2.0-board-game');
    const r = sameEveryStep(exp, { capabilities: ports(), steps: 30 });
    ok(r.moves.filter(m => m.source === 'activate').length > 10 && new Set(r.prints).size > 10, 'the board was played');
  },
  async 'replay: a host AI answer arrives later as the move ai.arrive; a replay feeds it with a port that never answers'() {
    const exp = await load('engine/v2/tests/ai-fixture');
    const host = { grants: structuredClone(exp.doc.grants || {}) };
    const moves = [];
    const a = logic(exp, { epochMs: 0, host, capabilities: { ai: aiPort({ 'test-ai': async () => 'Firm, like an apple.' }) }, onMove: (m) => moves.push(m) });
    a.start();
    a.player.setInput('askText', 'tyres', 'widget');
    a.player.send('desk', 'askGuide', {}, 'widget');
    await tick();
    eq(a.player.read('desk', 'answer'), 'Firm, like an apple.');
    const arrived = moves.find(m => m.source === 'ai.arrive');
    ok(arrived && arrived.payload[1] === 'ai' && arrived.payload[2] === 'Firm, like an apple.', JSON.stringify(moves.map(m => m.source)));
    eq(moves.find(m => m.source === 'setInput').payload[1], { freeText: 5 }, 'the typed words by length only');
    const silent = aiPort({ 'test-ai': () => new Promise(() => {}) });
    const b = logic(exp, { epochMs: 0, host, capabilities: { ai: silent } });
    for (const m of moves) b.feed(m);
    eq(b.player.read('desk', 'answer'), 'Firm, like an apple.');
    eq(b.fingerprint(), a.fingerprint());
  },
};
