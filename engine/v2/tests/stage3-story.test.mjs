// Stage 3: the story graph (section 3), built on the 3.1 example and small graphs.
import { Player } from '../src/story.mjs';
import { eq, ok } from './helpers.mjs';

const scene = (id, extra = {}) => ({ doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, ...extra }, words: {} });
const make = (story, scenes, values = {}) => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', values, story: { scenes: Object.fromEntries(Object.keys(scenes).map(k => [k, `${k}.json`])), ...story } },
  words: { en: {} }, data: {}, blocks: {}, scenes,
});
const press = (event) => ({ [`press:${event}`]: [{ id: `r-${event}`, actions: [{ id: `e-${event}`, emit: event }] }] });

export const tests = {
  'event links follow outcomes in list order, with when and a fallback (3.2, 3.3)'() {
    const p = make({ start: 'intro', ends: ['ending'], links: [
      { id: 'intro-begin', from: 'intro', on: 'begin', to: 'hub' },
      { id: 'hub-harbour', from: 'hub', on: 'pick', when: "event.stop === 'harbour'", to: 'harbour' },
      { id: 'hub-ride', from: 'hub', on: 'pick', to: 'ending' },
    ] }, {
      intro: scene('intro', { outputs: { begin: { kind: 'event' } }, on: press('begin') }),
      hub: scene('hub', { outputs: { pick: { kind: 'event' } }, on: { choose: [{ id: 'c', actions: [{ id: 'e', emit: 'pick', with: { stop: 'event.stop' } }] }] } }),
      harbour: scene('harbour'), ending: scene('ending'),
    });
    ok(p.start().ok); eq(p.scene, 'intro');
    p.send('intro', 'press:begin'); eq(p.scene, 'hub');
    p.send('hub', 'choose', { stop: 'market' }); eq(p.scene, 'ending', 'fallback link');
    ok(p.outputsLog.some(o => o.name === 'ended' && o.scene === 'ending'), 'ended reported');
  },
  'the scene records a result before it ends; when sees the write (3.3)'() {
    const p = make({ start: 'q', links: [
      { id: 'q-good', from: 'q', on: 'done', when: 'score > 0', to: 'good' },
      { id: 'q-bad', from: 'q', on: 'done', to: 'bad' }] }, {
      q: scene('q', { outputs: { done: { kind: 'event' } }, on: { done: [{ id: 'r', actions: [{ id: 's', set: 'score', to: 1 }] }], ...press('finish') } }),
      good: scene('good'), bad: scene('bad'),
    }, { score: { type: 'number', initial: 0, minimum: 0, maximum: 9 } });
    p.start(); p.send('q', 'press:finish');
    // the press emits finish, not done: wire it
    eq(p.scene, 'q');
    p.send('q', 'done');
    eq(p.scene, 'good');
  },
  'timed links fire on the local clock; when is tested at the deadline (3.4)'() {
    const p = make({ start: 'hook', links: [
      { id: 'hook-offer', from: 'hook', afterMs: 2500, to: 'offer' },
      { id: 'offer-end', from: 'offer', afterMs: 1000, when: 'false', to: 'hook' }] }, { hook: scene('hook'), offer: scene('offer') });
    p.start();
    p.advance(2499); eq(p.scene, 'hook');
    p.advance(1); eq(p.scene, 'offer');
    p.advance(5000); eq(p.scene, 'offer', 'used up when false at the deadline');
  },
  'max bounds a link; the next link is tried (3.6); visits counts entries'() {
    const p = make({ start: 'a', links: [
      { id: 'a-b-once', from: 'a', on: 'go', to: 'b', max: 1 },
      { id: 'a-c', from: 'a', on: 'go', to: 'c' },
      { id: 'b-a', from: 'b', on: 'back', to: 'a' }] }, {
      a: scene('a', { outputs: { go: { kind: 'event' } } }), b: scene('b', { outputs: { back: { kind: 'event' } } }), c: scene('c'),
    });
    p.start(); p.send('a', 'go'); eq(p.scene, 'b');
    p.send('b', 'back'); eq(p.scene, 'a');
    eq(p.read('a', 'visits').a, 2);
    p.send('a', 'go'); eq(p.scene, 'c');
  },
  'visit suspends and return resumes with the returned event (3.7)'() {
    const p = make({ start: 'stop', links: [
      { id: 'stop-flat', from: 'stop', on: 'flat', to: 'fix', visit: true },
      { id: 'fix-back', from: 'fix', on: 'fixed', return: true },
      { id: 'fix-alone', from: 'fix', on: 'fixed', to: 'stop' }] }, {
      stop: scene('stop', { values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 }, back: { type: 'string', maxLength: 9, initial: '' } },
        outputs: { flat: { kind: 'event' } },
        on: { bump: [{ id: 'b', actions: [{ id: 'a', set: 'n', to: 'n + 1' }] }], returned: [{ id: 'r', actions: [{ id: 's', set: 'back', to: 'event.scene' }] }] },
        machines: { t: { initial: 'w', states: { w: { after: [{ id: 'tick', delayMs: 1000, target: 'done' }] }, done: {} } } } }),
      fix: scene('fix', { outputs: { fixed: { kind: 'event' } } }),
    });
    p.start(); p.send('stop', 'bump'); p.advance(400);
    p.send('stop', 'flat'); eq(p.scene, 'fix');
    eq(p.read('fix', 'canReturn'), true);
    p.advance(5000); // the suspended scene's timer waits
    p.send('fix', 'fixed'); eq(p.scene, 'stop');
    eq(p.read('stop', 'n'), 1, 'values kept');
    eq(p.read('stop', 'back'), 'fix', 'returned event');
    ok(p.isActive('stop', 'w'), 'timer kept its remaining time');
    p.advance(600); ok(p.isActive('stop', 'done'));
  },
  'an outcome during entry is held until the first paint (3.2)'() {
    const p = make({ start: 'a', links: [{ id: 'a-b', from: 'a', on: 'skip', to: 'b' }] }, {
      a: scene('a', { outputs: { skip: { kind: 'event' } }, entry: [{ id: 'e', emit: 'skip' }] }), b: scene('b'),
    });
    p.start();
    eq(p.scene, 'b');
    ok(p.outputsLog.filter(o => o.name === 'entered').map(o => o.scene).join() === 'a,b', 'a was entered and shown first');
  },
  'ordered chapters build Next and Back links with skipWhen (3.12)'() {
    const p = make({ start: 'tour', chapters: [{ id: 'tour', scenes: ['s1', { scene: 's2', skipWhen: 'skip2' }, 's3'], next: 'next', back: 'back', after: 'end' }] }, {
      s1: scene('s1', { outputs: { next: { kind: 'event' } } }), s2: scene('s2'), s3: scene('s3', { outputs: { next: { kind: 'event' }, back: { kind: 'event' } } }), end: scene('end'),
    }, { skip2: { type: 'boolean', initial: true } });
    p.start(); eq(p.scene, 's1');
    p.send('s1', 'next'); eq(p.scene, 's3', 'skipped s2');
    p.send('s3', 'back'); eq(p.scene, 's1');
    p.send('s1', 'next'); p.send('s3', 'next'); eq(p.scene, 'end');
  },
  'choice links are offered and picked (3.5)'() {
    const p = make({ start: 'fork', links: [
      { id: 'left', from: 'fork', choice: 'Left', to: 'l' },
      { id: 'right', from: 'fork', choice: 'Right {{ 1 + 1 }}', when: 'false', to: 'r' },
      { id: 'other', from: 'fork', choice: 'Other', to: 'r' }] }, { fork: scene('fork'), l: scene('l'), r: scene('r') });
    p.start();
    eq(p.choices().map(c => c.label), ['Left', 'Other']);
    ok(p.pick('left').ok); eq(p.scene, 'l');
  },
  'resume: a saved graph re-enters the resume scene (3.8)'() {
    // endless: hub is no ending, so entering it keeps the resume place (without ends, a scene with no way out ends the story)
    const p = make({ start: 'intro', lifetime: 'saved', resumeAt: ['hub'], endless: true, links: [{ id: 'i-h', from: 'intro', on: 'go', to: 'hub' }] }, {
      intro: scene('intro', { outputs: { go: { kind: 'event' } } }), hub: scene('hub'),
    });
    p.start(); p.send('intro', 'go');
    eq(p.state.story.resume, 'hub');
  },
};
