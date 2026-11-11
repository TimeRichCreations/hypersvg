// E-AI-FLOW in the checker (A5.1, 5.3.1, 5.15.2): AI answers and every value derived from them reach only bindings
// and moment values. One test per path, on ai-fixture/ with small edits.
import fs from 'node:fs';
import path from 'node:path';
import { checkExperience } from '../check/index.mjs';
import { repo, schemas, mapSource, eq, ok } from './helpers.mjs';

const dir = path.join(repo, 'engine', 'v2', 'tests', 'ai-fixture');
const base = {};
for (const rel of ['experience.json', 'shell/frame.json', 'shell/frame.svg', 'scenes/desk/scene.json', 'scenes/desk/desk.svg']) {
  const text = fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
  base[rel] = rel.endsWith('.json') ? JSON.parse(text) : text;
}
// Runs the ai family on the fixture after edit(files); returns the E-AI-FLOW findings as "file path".
function flow(edit = () => {}, extra = {}) {
  const files = structuredClone(base);
  Object.assign(files, structuredClone(extra));
  edit(files);
  const r = checkExperience(mapSource(files), schemas(), { only: ['ai'] });
  ok(r.experience, `loads: ${r.diags.map(d => d.message).join('; ')}`);
  return r.diags.filter(d => d.code === 'E-AI-FLOW').map(d => `${d.file} ${d.path}`);
}
const scene = (f) => f['scenes/desk/scene.json'];
const onAnswer = (f, ...actions) => { scene(f).on.guideAnswered[0].actions.push(...actions); };

export const tests = {
  'the fixture is clean: the answer goes to a moment value and a binding'() { eq(flow(), []); },
  'a session or saved value, or an experience run value, may not hold an answer'() {
    eq(flow(f => { scene(f).values.kept = { type: 'string', maxLength: 200, initial: '', lifetime: 'saved' }; onAnswer(f, { id: 'keep', set: 'kept', to: 'answer' }); }), ['scenes/desk/scene.json /on/guideAnswered/0/actions/1']);
    eq(flow(f => { scene(f).values.kept = { type: 'string', maxLength: 200, initial: '', lifetime: 'session' }; onAnswer(f, { id: 'keep', set: 'kept', to: "'x'" }); }).length, 1, 'control: the answer event alone taints the write');
    eq(flow(f => { f['experience.json'].values.last = { type: 'string', maxLength: 200, initial: '' }; onAnswer(f, { id: 'keep', set: 'last', to: 'answer' }); }).length, 1);
  },
  'the value a reaction to ai:answered sets must be a moment value'() {
    eq(flow(f => { scene(f).values.answer.lifetime = 'run'; }), ['scenes/desk/scene.json /on/ai:answered/0/actions/0']);
  },
  'a quoted seat of ai.ask names a character seat in addons.ai.seats (E-REF-UNKNOWN)'() {
    const files = structuredClone(base);
    files['scenes/desk/scene.json'].on.askGuide[0].actions[0].with.seat = "'nobody'";
    const d = checkExperience(mapSource(files), schemas(), { only: ['ai'] }).diags.filter(x => x.code === 'E-REF-UNKNOWN').map(x => x.path);
    eq(d, ['/on/askGuide/0/actions/0/with/seat']);
  },
  'derived values: a computed value of the answer, then a reaction to its change'() {
    eq(flow(f => {
      scene(f).computed = { short: 'length(answer) < 20' };
      scene(f).values.flag = { type: 'boolean', initial: false, lifetime: 'saved' };
      scene(f).values.note = { type: 'string', maxLength: 20, initial: '' };
      scene(f).on.later = [{ id: 'later', guard: 'short', actions: [{ id: 'l1', set: 'flag', to: 'true' }] }];
    }), ['scenes/desk/scene.json /on/later/0/actions/0'], 'a guard that reads a derived value');
    eq(flow(f => {
      scene(f).values.flag = { type: 'boolean', initial: false, lifetime: 'saved' };
      scene(f).on['changed:answerFrom'] = [{ id: 'ch', actions: [{ id: 'c1', set: 'flag', to: 'true' }] }];
    }), ['scenes/desk/scene.json /on/changed:answerFrom/0/actions/0'], 'changed: of a tainted value');
    eq(flow(f => {
      scene(f).values.flag = { type: 'boolean', initial: false, lifetime: 'saved' };
      scene(f).on.check = [{ id: 'ck', actions: [{ id: 'k1', if: "answer === ''", then: [{ id: 'k2', set: 'flag', to: 'true' }] }] }];
    }), ['scenes/desk/scene.json /on/check/0/actions/0/then/0'], 'an if that reads the answer');
  },
  'events emitted from an answer carry the taint; an output event is refused'() {
    eq(flow(f => {
      scene(f).values.flag = { type: 'boolean', initial: false, lifetime: 'saved' };
      onAnswer(f, { id: 'pass', emit: 'next' });
      scene(f).on.next = [{ id: 'n', actions: [{ id: 'n1', set: 'flag', to: 'true' }] }];
    }), ['scenes/desk/scene.json /on/next/0/actions/0']);
    eq(flow(f => { scene(f).outputs = { done: { kind: 'event' } }; onAnswer(f, { id: 'out', emit: 'done' }); }), ['scenes/desk/scene.json /on/guideAnswered/0/actions/1']);
  },
  'machines and timers: a tainted transition taints the machine, its states and active()'() {
    eq(flow(f => {
      scene(f).values.flag = { type: 'boolean', initial: false, lifetime: 'saved' };
      scene(f).machines = { mood: { initial: 'calm', states: { calm: { on: { guideAnswered: [{ id: 'go', target: 'busy' }] } }, busy: { after: [{ id: 'b', delayMs: 100, actions: [{ id: 'b1', set: 'flag', to: 'true' }] }] } } } };
    }), ['scenes/desk/scene.json /machines/mood/states/busy/after/0/actions/0']);
    eq(flow(f => {
      scene(f).values.flag = { type: 'boolean', initial: false, lifetime: 'saved' };
      scene(f).machines = { mood: { initial: 'calm', states: { calm: { on: { guideAnswered: [{ id: 'go', target: 'busy' }] } }, busy: {} } } };
      scene(f).on.tick = [{ id: 't', guard: "active('busy')", actions: [{ id: 't1', set: 'flag', to: 'true' }] }];
    }), ['scenes/desk/scene.json /on/tick/0/actions/0']);
    eq(flow(f => {
      scene(f).values.flag = { type: 'boolean', initial: false, lifetime: 'saved' };
      scene(f).machines = { wait: { initial: 'a', states: { a: { after: [{ id: 'w', delayMs: 'length(answer) + 1', target: 'b' }] }, b: { entry: [{ id: 'e', set: 'flag', to: 'true' }] } } } };
    }), ['scenes/desk/scene.json /machines/wait/states/b/entry/0'], "a timer's delay that reads the answer");
  },
  'outputs, records, the host API, page actions and module calls are refused'() {
    eq(flow(f => { scene(f).outputs = { said: { kind: 'result', type: 'string', value: 'answer' } }; }), ['scenes/desk/scene.json /outputs/said/value']);
    eq(flow(f => { onAnswer(f, { id: 'r', emit: 'log', as: 'record', with: { a: 'answer' } }); }).length, 1, 'record');
    eq(flow(f => { onAnswer(f, { id: 's', call: 'player.setting', with: {muted: 'true'} }); }).length, 1, 'setting (host API)');
    eq(flow(f => { onAnswer(f, { id: 'h', highlight: 'signup' }); }).length, 1, 'page action');
    eq(flow(f => { onAnswer(f, { id: 'u', call: 'player.openUrl', with: {field: "'link'"} }); }).length, 1, 'openUrl');
  },
  "uses' inputs and triggers are refused"() {
    eq(flow(f => { scene(f).uses = [{ id: 'card', use: 'card', with: { line: 'answer' } }]; }), ['scenes/desk/scene.json /uses/0/with/line']);
    eq(flow(f => { scene(f).uses = [{ id: 'card', use: 'card', with: { line: "'hi'" } }]; onAnswer(f, { id: 'tr', emit: 'card.poke', as: 'trigger' }); }), ['scenes/desk/scene.json /on/guideAnswered/0/actions/1']);
  },
  'link when and carry may not read a tainted value'() {
    eq(flow(f => {
      const x = f['experience.json'];
      x.values.last = { type: 'string', maxLength: 200, initial: '' };
      onAnswer(f, { id: 'keep', set: 'last', to: 'answer' });
      x.story.links = [{ id: 'l', from: 'desk', on: 'go', to: 'desk', when: "last !== ''" }];
    }).sort(), ['experience.json /story/links/0/when', 'scenes/desk/scene.json /on/guideAnswered/0/actions/1']);
  },
  'free text: only the with of a call ai.ask may read it'() {
    eq(flow(f => { scene(f).values.copy = { type: 'string', maxLength: 200, initial: '' }; scene(f).on.copyIt = [{ id: 'c', actions: [{ id: 'c1', set: 'copy', to: 'askText' }] }]; }), ['scenes/desk/scene.json /on/copyIt/0/actions/0/to']);
    eq(flow(f => { scene(f).bindings.push({ id: 'echo', target: 'answer-line', text: '{{ askText }}' }); }), ['scenes/desk/scene.json /bindings/1/text']);
  },
  'presentation may follow an answer: dialogs, sounds and moment values'() {
    eq(flow(f => { onAnswer(f, { id: 'cl', close: 'ask' }, { id: 'm', set: 'answerFrom', to: 'answer' }); }), []);
  },
};
