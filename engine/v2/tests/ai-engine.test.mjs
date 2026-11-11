// The ai capability in the engine (A5.1, A5.2, 5.15.2): character seats, ask, the built-in source, intent matching,
// the host's AI port, answer checks, the time limit, the rate limit and the fallback. Uses ai-fixture/ and a fake host.
import path from 'node:path';
import { Player as BasePlayer } from '../src/story.mjs';
import { granting, addonCode } from './helpers.mjs';
const Player = granting(BasePlayer); // a host that gives what the experience asks (D31: no profile, no grant)
import { loadExperience, folderSource } from '../src/load.mjs';
import { aiPort } from '../src/host.mjs';
const { normalise, words, matchIntent, answerProblem } = await addonCode('../src/ai.mjs', import.meta.url) ?? {};
import { repo, schemas, eq, ok } from './helpers.mjs';

let loaded;
async function fixture() {
  loaded ??= loadExperience(await folderSource(path.join(repo, 'engine', 'v2', 'tests', 'ai-fixture')), schemas());
  if (!loaded.experience) throw new Error(loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
  return structuredClone(loaded.experience);
}
// A player on the fixture; ai: a fake host source ('test-ai'); host: a host profile.
async function make({ ai = null, host = null, edit = null } = {}) {
  const exp = await fixture();
  edit?.(exp);
  const p = new Player(exp, { host, capabilities: ai ? { ai: aiPort({ 'test-ai': ai }) } : {} });
  ok(p.start().ok, 'starts');
  return p;
}
// Types into the free text field and asks, as the form does.
const ask = (p, text) => { ok(p.setInput('askText', text, 'widget').ok, 'typed'); return p.send('desk', 'askGuide', {}, 'widget'); };
const answer = (p) => [p.read('desk', 'answer'), p.read('desk', 'answerFrom')];
const tick = () => new Promise(r => setTimeout(r, 0));

export const tests = {
  'normalising: NFKC, lower case, trimmed, only letters, numbers and spaces (A5.2)'() {
    eq(normalise('  Ｈｅｌｌｏ, World!! '), 'hello world');
    eq(normalise('Ça va? ①'), 'ça va 1');
    eq(normalise('<b>hi</b>'), 'bhib');
    eq(normalise('!!!'), '');
  },
  'words by UAX #29 on normalised text: Han and Hiragana one by one, Katakana and Latin in runs'() {
    eq(words('my brakes squeak'), ['my', 'brakes', 'squeak']);
    eq(words('abc123 x'), ['abc123', 'x']);
    eq(words('自転車'), ['自', '転', '車']);
    eq(words('ブレーキ'), ['ブレーキ']);
    eq(words('ひらがな'), ['ひ', 'ら', 'が', 'な']);
  },
  'matching: empty matches nothing; an exact example wins; else the best share of at least 0.5, ties in order'() {
    const intents = [
      { id: 'a', examples: ['brakes squeak loudly', 'stop'], answers: [{ text: 'A' }] },
      { id: 'b', examples: ['brakes squeak', 'how do brakes work'], answers: [{ text: 'B' }] },
      { id: 'c', examples: ['squeak brakes'], answers: [{ text: 'C' }] },
    ];
    eq(matchIntent(intents, ''), null);
    eq(matchIntent(intents, '?!'), null);
    eq(matchIntent(intents, 'Brakes, squeak!').intent.id, 'b', 'exact after normalising');
    eq(matchIntent(intents, 'STOP').intent.id, 'a', 'exact');
    eq(matchIntent(intents, 'why do my brakes squeak so').intent.id, 'b', 'share 1 beats share 2/3; b before c');
    eq(matchIntent(intents, 'brakes').intent.id, 'b', 'share 0.5 is enough; ties go to the first declared');
    eq(matchIntent(intents, 'loudly'), null, 'one word of three is below 0.5');
    eq(matchIntent(intents, 'brakes brakes brakes work').share, 0.5, 'repeated words count once');
  },
  async 'built-in: a picked question gives its written answer in a new transaction, with source builtIn'() {
    const p = await make();
    const r = ask(p, 'oil');
    ok(r.ok);
    eq(answer(p), ['', ''], 'ask writes nothing in its own transaction');
    p.advance(0);
    eq(answer(p), ['Oil keeps the chain smooth and quiet.', 'builtIn']);
  },
  async 'built-in: typed text matches an intent; its answers are used in turn, with when'() {
    const p = await make();
    ask(p, 'My brakes squeak!'); p.advance(0);
    eq(answer(p), ['Brakes squeeze the wheel to slow it.', 'builtIn']);
    ask(p, 'how do brakes work'); p.advance(0);
    eq(answer(p)[0], 'Check the pads are not worn.', 'the second answer next time');
    ask(p, 'brakes squeak'); p.advance(0);
    eq(answer(p)[0], 'Brakes squeeze the wheel to slow it.', 'then round again');
    p.transaction('host', () => p.runActions('experience', [{ id: 't', set: 'topic', to: "'cars'" }], 'test'));
    ask(p, 'brakes squeak'); p.advance(0);
    ask(p, 'brakes squeak'); p.advance(0);
    eq(answer(p)[0], 'Brakes squeeze the wheel to slow it.', 'an answer whose when is false is passed over');
  },
  async 'built-in: nothing matches, so the fallback, with source fallback'() {
    const p = await make();
    ask(p, 'what is the weather'); p.advance(0);
    eq(answer(p), ['Let us look at the bike together.', 'fallback']);
    ask(p, ''); p.advance(0);
    eq(answer(p)[1], 'fallback', 'empty text matches nothing');
  },
  async 'without the ai grant from the host profile, the built-in source answers and the host is not called'() {
    let calls = 0;
    const p = await make({ ai: async () => { calls++; return 'From the AI.'; }, host: { grants: {} } });
    ask(p, 'oil'); p.advance(0); await tick();
    eq([answer(p)[1], calls], ['builtIn', 0]);
  },
  async 'an AI source: persona, facts and the visitor text in separate fields; the checked answer is written'() {
    const seen = [];
    const p = await make({ ai: async (req) => { seen.push(req); return 'Firm, like an apple.'; } });
    ask(p, 'tyres'); await tick();
    eq(seen.length, 1);
    const req = seen[0];
    eq([req.persona.startsWith('A kind'), req.facts, req.question, req.visitorText, req.steering], [true, { topic: 'bicycles' }, { id: 'tyres', text: 'How hard should tyres be?' }, null, 'ask']);
    ok(Object.isFrozen(req) && Object.isFrozen(req.facts), 'the request is frozen');
    eq(answer(p), ['Firm, like an apple.', 'ai']);
    ask(p, 'Can I ride in the rain?'); await tick();
    eq([seen[1].question, seen[1].visitorText], [null, 'Can I ride in the rain?'], 'typed text travels in its own field');
  },
  async 'answer checks: markup, addresses, code, actions, too long or not text use the written answer, then the fallback'() {
    const bad = ['<b>bold</b>', 'See https://example.com', 'mail me@example.org', 'go to bikes.com', '{"set": "x"}', '```js```', 'x'.repeat(161), 42, null, ''];
    for (const v of bad) {
      const p = await make({ ai: async () => v });
      ask(p, 'oil'); await tick();
      eq(answer(p), ['Oil keeps the chain smooth and quiet.', 'builtIn'], `refused ${JSON.stringify(v)}`);
      ask(p, 'zebra quantum'); await tick();
      eq(answer(p), ['Let us look at the bike together.', 'fallback'], `refused ${JSON.stringify(v)}, no written answer`);
    }
    eq(answerProblem({ type: 'string', maxLength: 160, enum: ['yes', 'no'] }, 'maybe') !== null, true, 'an option answer must be a declared option');
    eq(answerProblem({ type: 'string', maxLength: 160, enum: ['yes', 'no'] }, 'yes'), null);
    eq(answerProblem({ type: 'string', maxLength: 160 }, 'Oil it, then wipe it. Thanks!'), null);
  },
  async 'a failed or late answer uses the written answer (else the fallback); a late answer is then ignored'() {
    const p = await make({ ai: async () => { throw new Error('offline'); } });
    ask(p, 'oil'); await tick();
    eq(answer(p), ['Oil keeps the chain smooth and quiet.', 'builtIn'], 'failed');
    ask(p, 'zebra quantum'); await tick();
    eq(answer(p), ['Let us look at the bike together.', 'fallback'], 'failed, no written answer or intent');
    let release; let aborted = false;
    const q = await make({ ai: (req, signal) => new Promise(r => { release = r; signal.addEventListener('abort', () => { aborted = true; }); }) });
    ask(q, 'oil'); await tick();
    q.advance(7999); eq(answer(q)[0], '', 'still waiting');
    q.advance(1); eq(answer(q), ['Oil keeps the chain smooth and quiet.', 'builtIn'], 'the time limit passed');
    ok(aborted, 'the source is told to stop');
    release('Too late.'); await tick();
    eq(answer(q)[0], 'Oil keeps the chain smooth and quiet.', 'the late answer is ignored');
  },
  async 'a new ask cancels the one still waiting; leaving the scene drops the answer'() {
    const releases = [];
    const p = await make({ ai: () => new Promise(r => releases.push(r)) });
    ask(p, 'oil'); await tick();
    ask(p, 'tyres'); await tick();
    releases[0]('First.'); await tick();
    eq(answer(p)[0], '', 'the cancelled answer is ignored');
    releases[1]('Second.'); await tick();
    eq(answer(p), ['Second.', 'ai']);
  },
  async 'the rate limit: at most perMinute requests a minute reach the AI; the rest use the built-in source'() {
    let calls = 0;
    const p = await make({ ai: async () => { calls++; return 'AI says hi.'; } });
    for (let i = 0; i < 5; i++) { ask(p, 'oil'); await tick(); p.advance(0); }
    eq([calls, answer(p)[1]], [4, 'builtIn'], 'the fifth is over the limit');
    p.advance(60000);
    ask(p, 'oil'); await tick();
    eq([calls, answer(p)[1]], [5, 'ai'], 'a minute later the source is asked again');
  },
  async 'steering: none keeps typed text from the AI; open is lowered for a children audience'() {
    const seen = [];
    const ai = async (req) => { seen.push(req); return 'Okay.'; };
    const p = await make({ ai, edit: (x) => { x.doc.addons.ai.seats.guide.steer = 'none'; } });
    ask(p, 'my brakes squeak'); await tick(); p.advance(0);
    eq([seen.length, answer(p)[1]], [0, 'builtIn'], 'typed text with steering none goes to the built-in matcher');
    ask(p, 'oil'); await tick();
    eq([seen.length, seen[0].steering, seen[0].visitorText], [1, 'none', null], 'a picked question still reaches the AI');
    const openSeat = (x) => { x.doc.addons.ai.seats.guide.steer = 'open'; x.doc.grants.ai['test-ai'] = 'open'; };
    const q = await make({ ai, edit: openSeat, host: { grants: { ai: { 'test-ai': 'open' } }, audience: 'children' } });
    ask(q, 'tell me a story'); await tick();
    eq(seen[1].steering, 'guided', 'children: open is lowered');
    const r = await make({ ai, edit: openSeat, host: { grants: { ai: { 'test-ai': 'open' } } } });
    ask(r, 'tell me a story'); await tick();
    eq(seen[2].steering, 'open');
  },
  async 'ai.ask checks its seat, and that ai:answered sets only moment values of the asking block'() {
    const p = await make({ edit: (x) => { x.scenes.desk.doc.on.askGuide[0].actions[0].with.seat = "'nobody'"; } });
    eq(ask(p, 'oil').fault?.code, 'E-REF-UNKNOWN');
    const q = await make({ edit: (x) => { x.scenes.desk.doc.values.answer.lifetime = 'run'; } });
    eq(ask(q, 'oil').fault?.code, 'E-AI-FLOW');
  },
  async 'an ask in a transaction that faults never calls the host'() {
    let calls = 0;
    const p = await make({ ai: async () => { calls++; return 'Hi.'; }, edit: (x) => { x.scenes.desk.doc.on.askGuide[0].actions.push({ id: 'boom', set: 'answer', to: '1' }); } });
    eq(ask(p, 'oil').fault?.code, 'E-TYPE'); await tick(); p.advance(10000);
    eq([calls, answer(p)], [0, ['', '']]);
  },
  async 'an AI answer cannot run a human-only action: the answer transaction has the source ai'() {
    const p = await make({ ai: async () => 'Fine.', edit: (x) => { x.scenes.desk.doc.on.guideAnswered[0].actions.push({ id: 'bad', call: 'player.openUrl', with: {field: "'link'"} }); } });
    ask(p, 'oil'); await tick();
    eq(p.read('desk', 'answer'), '', 'the answer transaction faulted and rolled back');
    ok(/E-HUMAN-ONLY/.test(p.notes.at(-1).message));
  },
  async 'quick replies: at most 6, from the seat, with their texts'() {
    const p = await make();
    eq(p.ai.quickReplies('guide'), [{ id: 'oil', text: 'Why oil the chain?' }, { id: 'tyres', text: 'How hard should tyres be?' }]);
  },
};
