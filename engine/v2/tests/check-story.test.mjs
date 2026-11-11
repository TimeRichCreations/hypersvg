// The story checker family (3, 10.5, 10.11): one valid experience and one change that fails, per rule.
import { checkExperience } from '../check/index.mjs';
import { schemas, eq, mapSource } from './helpers.mjs';

const svg = (body = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect id="r" width="1" height="1"/>${body}</svg>`;
const scene = (id, extra = {}) => ({
  format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`,
  outputs: { go: { kind: 'event' }, alt: { kind: 'event' } },
  entry: [{ id: 'emit-go', emit: 'go' }, { id: 'emit-alt', emit: 'alt' }],
  ...extra,
});
const link = (id, from, on, to, extra = {}) => ({ id, from, on, to, ...extra });

// Three scenes in a line: a -go-> b -go-> c, c ends.
function fx({ story = {}, exp = {}, scenes = {}, files = {} } = {}) {
  const ids = ['a', 'b', 'c'];
  const f = {
    'experience.json': {
      format: 'hsvg/2.0', kind: 'experience', id: 'tiny',
      story: {
        start: 'a',
        scenes: Object.fromEntries(ids.map(i => [i, `scenes/${i}/scene.json`])),
        ends: ['c'],
        links: [link('a-b', 'a', 'go', 'b'), link('b-c', 'b', 'go', 'c')],
        ...story,
      },
      ...exp,
    },
  };
  for (const i of ids) {
    f[`scenes/${i}/scene.json`] = scene(i, scenes[i] || {});
    f[`scenes/${i}/${i}.svg`] = svg();
  }
  return { ...f, ...files };
}
// The fixture with a shell whose choices widget shows choice links (5.11, the shell capability).
function withChoices(opts) {
  const f = fx({ ...opts, exp: { needs: ['widgets'], shell: 'shell.json', ...(opts.exp || {}) } });
  f['shell.json'] = { format: 'hsvg/2.0', kind: 'shell', id: 'shell', drawing: 'shell.svg', slots: { main: { kind: 'stage' }, picks: { kind: 'widget', label: 'Choices' } }, addons: { widgets: { picks: { choices: {} } } } };
  f['shell.svg'] = svg('<rect id="main" data-hsvg-kind="part" data-hsvg-slot="main" width="100" height="80"/><rect id="picks" data-hsvg-kind="part" data-hsvg-slot="picks" y="80" width="100" height="20"/>');
  return f;
}
const run = (files, only = ['story']) => checkExperience(mapSource(files), schemas(), { only });
const codes = (files) => run(files).diags.map(d => d.code);
const valid = (files, msg) => { const r = run(files); eq(r.diags.map(d => `${d.code} ${d.path}`), [], msg); };
const bad = (files, code, msg = '') => { const r = run(files).diags; eq(r.map(d => d.code), [code], `${msg} ${r.map(d => d.message).join(' | ')}`); };
const has = (files, code) => { const c = codes(files); if (!c.includes(code)) throw new Error(`expected ${code} among ${c}`); };
// The page grants are the page family's (check/page.mjs, D31); only its grant findings are looked at here.
const grantsOnly = (files) => [...run(files).diags, ...run(files, ['page']).diags.filter(d => d.code === 'E-GRANT')];
const validP = (files) => eq(grantsOnly(files).map(d => `${d.code} ${d.path}`), []);
const badP = (files, code) => eq(grantsOnly(files).map(d => d.code), [code]);
const withLinks = (...links) => fx({ story: { links } });

export const tests = {
  'the base experience passes'() { valid(fx()); },

  // ----- 3.1, 3.8 start, ends, resumeAt -----
  'start names a scene or an ordered chapter'() {
    bad(fx({ story: { start: [{ to: 'zed', when: 'true' }, { to: 'a' }] } }), 'E-REF-UNKNOWN');
    valid(fx({ story: { start: [{ to: 'b', when: 'true' }, { to: 'a' }] } }), 'list form');
  },
  'the last start entry has no when (E-STORY-FALLBACK)'() {
    eq(codes(fx({ story: { start: [{ to: 'b', when: 'true' }, { to: 'a', when: 'true' }] } })), ['E-STORY-FALLBACK']);
  },
  'ends and resumeAt name scenes'() {
    bad(fx({ story: { ends: ['c', 'zed'] } }), 'E-REF-UNKNOWN');
    bad(fx({ story: { resumeAt: ['zed'] } }), 'E-REF-UNKNOWN');
    valid(fx({ story: { resumeAt: ['b'] } }));
  },

  // ----- 3.2, 3.3 links -----
  'from and to name scenes (E-REF-UNKNOWN)'() {
    bad(withLinks(link('a-b', 'a', 'go', 'b'), link('b-c', 'b', 'go', 'c'), link('x', 'zed', 'go', 'c')), 'E-REF-UNKNOWN');
    bad(withLinks(link('a-b', 'a', 'go', 'b'), link('b-c', 'b', 'go', 'c'), link('x', 'a', 'alt', 'zed')), 'E-REF-UNKNOWN');
  },
  'on names an output event the scene emits, a trigger or a signal'() {
    bad(withLinks(link('a-b', 'a', 'nothing', 'b'), link('b-c', 'b', 'go', 'c')), 'E-REF-UNKNOWN');
    // declared but never emitted
    const f = fx({ scenes: { a: { entry: [{ id: 'emit-alt', emit: 'alt' }] } } });
    bad(f, 'E-REF-UNKNOWN');
    // a trigger on the experience
    const t = fx({ exp: { inputs: { next: { kind: 'trigger' } } }, story: { links: [link('a-b', 'a', 'next', 'b'), link('b-c', 'b', 'go', 'c')] } });
    valid(t, 'trigger');
  },
  'a name that is an output event and a trigger is E-NAME-SHADOW'() {
    const f = fx({ exp: { inputs: { go: { kind: 'trigger' } } } });
    eq(codes(f), ['E-NAME-SHADOW', 'E-NAME-SHADOW'], 'one per link on go');
  },
  'shell.<event> names an output event of the shell'() {
    const shell = { format: 'hsvg/2.0', kind: 'shell', id: 'frame', drawing: 'frame.svg', slots: { stage: { kind: 'stage', label: 'Stage' } }, outputs: { next: { kind: 'event' } }, entry: [{ id: 'emit-next', emit: 'next' }] };
    const shellFiles = { 'shell/frame.json': shell, 'shell/frame.svg': svg('<g id="stage" data-hsvg-kind="part" data-hsvg-slot="stage"/>') };
    const mk = (on) => fx({ exp: { shell: 'shell/frame.json' }, story: { links: [link('a-b', 'a', on, 'b'), link('b-c', 'b', 'go', 'c')] }, files: shellFiles });
    valid(mk('shell.next'));
    bad(mk('shell.zed'), 'E-REF-UNKNOWN');
    bad(fx({ story: { links: [link('a-b', 'a', 'shell.next', 'b'), link('b-c', 'b', 'go', 'c')] } }), 'E-REF-UNKNOWN');
  },
  'a link on lines:ended:<line> names a line of the scene (afterLine before D31)'() {
    const lines = { narration: { text: 'Hello', durationMs: 1000 } };
    const mk = (name) => fx({ exp: { needs: ['lines'] }, scenes: { a: { addons: { lines: { lines } } } }, story: { links: [{ id: 'a-b', from: 'a', on: `lines:ended:${name}`, to: 'b' }, link('b-c', 'b', 'go', 'c')] } });
    // the line's name is checked by the lines capability's rules (check/lines.mjs)
    eq(run(mk('narration'), ['story', 'lines']).diags.map(d => d.code), []);
    eq(run(mk('missing'), ['story', 'lines']).diags.map(d => d.code), ['E-REF-UNKNOWN']);
  },
  'several links on one event need an unconditional last one (E-STORY-FALLBACK)'() {
    const alt = link('a-c', 'a', 'go', 'c', { when: 'true' });
    valid(withLinks(alt, link('a-b', 'a', 'go', 'b'), link('b-c', 'b', 'go', 'c')));
    bad(withLinks(link('a-b', 'a', 'go', 'b'), alt, link('b-c', 'b', 'go', 'c')), 'E-STORY-FALLBACK');
    bad(withLinks(link('a-b', 'a', 'go', 'b', { max: 2 }), link('a-b2', 'a', 'alt', 'b'), link('b-c', 'b', 'go', 'c')), 'E-STORY-FALLBACK');
  },
  'link ids are unique'() {
    bad(withLinks(link('x', 'a', 'go', 'b'), link('x', 'b', 'go', 'c')), 'E-ID-DUPLICATE');
  },
  'carry names inputs of the destination; an input without initial must be carried'() {
    const inputs = { score: { kind: 'content', type: 'number', minimum: 0, maximum: 9 } };
    const noInitial = fx({ scenes: { b: { inputs } }, story: { links: [link('a-b', 'a', 'go', 'b', { carry: { score: '1' } }), link('b-c', 'b', 'go', 'c')] } });
    valid(noInitial);
    const missing = fx({ scenes: { b: { inputs } } });
    bad(missing, 'E-KEY-REQUIRED');
    const unknown = fx({ story: { links: [link('a-b', 'a', 'go', 'b', { carry: { nope: '1' } }), link('b-c', 'b', 'go', 'c')] } });
    bad(unknown, 'E-REF-UNKNOWN');
    // a start scene is entered without a link: every input needs an initial
    const atStart = fx({ scenes: { a: { inputs } }, story: { links: [link('a-b', 'a', 'go', 'b'), link('b-c', 'b', 'go', 'c')] } });
    bad(atStart, 'E-KEY-REQUIRED');
  },
  'an exit list may not emit an outcome (E-NAVIGATION)'() {
    bad(fx({ scenes: { a: { exit: [{ id: 'leave', emit: 'alt' }] } } }), 'E-NAVIGATION');
    valid(fx({ scenes: { a: { exit: [{ id: 'leave', set: 'n', to: 'n + 1' }], values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 } } } } }));
  },

  // ----- 3.5 choices -----
  'choice links need a place and a way on'() {
    const choices = [
      { id: 'pick-b', from: 'a', choice: 'B', to: 'b' },
      { id: 'pick-c', from: 'a', choice: 'C', to: 'c' },
    ];
    const story = { links: [...choices, link('b-c', 'b', 'go', 'c')] };
    // no shell choices widget (choiceRegion is a 2.1 draft, D31)
    bad(fx({ story }), 'E-STORY-CHOICE-PLACE');
    valid(withChoices({ story }));
    has(fx({ story, scenes: { a: { choiceRegion: 'opts' } } }), 'E-DRAFT');
  },
  'a scene with choice links needs a way on when none is eligible'() {
    const f = (extra) => withChoices({ story: { links: [{ id: 'pick-b', from: 'a', choice: 'B', to: 'b', ...extra }, link('b-c', 'b', 'go', 'c')] } });
    valid(f({}));
    bad(f({ when: 'true' }), 'E-STORY-CHOICE-FALLBACK');
    has(f({ max: 1 }), 'E-STORY-CHOICE-FALLBACK');
  },
  'a scene has at most 16 choice links (E-RANGE)'() {
    const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `pick-${i}`, from: 'a', choice: `Choice ${i}`, to: 'b' }));
    const f = (n) => withChoices({ story: { links: [...many(n), link('b-c', 'b', 'go', 'c')] } });
    valid(f(16));
    bad(f(17), 'E-RANGE');
  },

  // ----- 3.7 visits and returns -----
  'a return link needs a fallback unless every way in is a visit (E-STORY-RETURN)'() {
    const ret = { id: 'b-back', from: 'b', on: 'go', return: true };
    // a enters b by a plain link, so the return from b on go needs a fallback on go
    bad(fx({ story: { links: [link('a-b', 'a', 'go', 'b'), ret, link('b-c', 'b', 'alt', 'c')] } }), 'E-STORY-RETURN');
    valid(fx({ story: { links: [link('a-b', 'a', 'go', 'b'), { ...ret, when: 'canReturn' }, link('b-c', 'b', 'go', 'c')] } }), 'fallback beside the return');
    // every way into b is a visit
    valid(fx({ story: { links: [link('a-b', 'a', 'go', 'b', { visit: true }), ret, link('a-c', 'a', 'alt', 'c')] } }), 'all visits');
  },
  'a cycle of visit links is E-STORY-VISIT-CYCLE'() {
    const base = [link('a-b', 'a', 'go', 'b', { visit: true }), link('b-c', 'b', 'go', 'c')];
    valid(fx({ story: { links: base } }));
    bad(fx({ story: { links: [...base, link('b-a', 'b', 'alt', 'a', { visit: true })] } }), 'E-STORY-VISIT-CYCLE');
  },
  'a chain of more than 16 visit links is E-STORY-VISIT-CYCLE'() {
    const chain = (n) => {
      const ids = Array.from({ length: n + 1 }, (_, i) => `s${i}`);
      const files = {};
      for (const i of ids) { files[`scenes/${i}/scene.json`] = scene(i); files[`scenes/${i}/${i}.svg`] = svg(); }
      const links = ids.slice(0, -1).map((id, i) => link(`l${i}`, id, 'go', ids[i + 1], { visit: true }));
      return { 'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'tiny', story: { start: ids[0], scenes: Object.fromEntries(ids.map(i => [i, `scenes/${i}/scene.json`])), ends: [ids[n]], links } }, ...files };
    };
    valid(chain(16));
    bad(chain(17), 'E-STORY-VISIT-CYCLE');
  },

  // ----- 3.12 chapters -----
  'chapters: steps are scenes, in one chapter at most, ids are shared'() {
    const ch = { id: 'tour', scenes: ['a', 'b'], next: 'go', after: 'c' };
    valid(fx({ story: { start: 'tour', links: [], chapters: [ch] } }), 'ordered chapter');
    bad(fx({ story: { links: [], chapters: [{ ...ch, scenes: ['a', 'b', 'zed'] }] } }), 'E-REF-UNKNOWN');
    const two = [ch, { id: 'tour-two', scenes: ['b'], next: 'go', after: 'c' }];
    eq(codes(fx({ story: { start: 'tour', links: [], chapters: two } })), ['E-ID-DUPLICATE']);
    eq(codes(fx({ story: { start: 'a', links: [], chapters: [{ ...ch, id: 'a' }] } })).includes('E-ID-DUPLICATE'), true);
    has(fx({ story: { start: 'tour', links: [], chapters: [{ ...ch, after: 'zed' }] } }), 'E-REF-UNKNOWN');
    bad(fx({ story: { start: 'tour', links: [], chapters: [{ ...ch, next: 'nothing' }] } }), 'E-REF-UNKNOWN');
  },
  'a chapter\'s built links join the graph'() {
    // b is reached only through the chapter's built Next link
    valid(fx({ story: { links: [], start: 'a', chapters: [{ id: 'tour', scenes: ['a', 'b'], next: 'go', after: 'c' }] } }));
  },

  // ----- 3.9 graph validity -----
  'every scene is reachable (E-STORY-UNREACHABLE)'() {
    bad(withLinks(link('a-c', 'a', 'go', 'c'), link('b-c', 'b', 'go', 'c')), 'E-STORY-UNREACHABLE');
  },
  'a scene with no way on must be an ending (E-STORY-DEAD-END)'() {
    const r = codes(withLinks(link('a-b', 'a', 'go', 'b')));
    eq(r.includes('E-STORY-DEAD-END'), true);
    valid(fx({ story: { ends: ['b', 'c'], links: [link('a-b', 'a', 'go', 'b'), link('a-c', 'a', 'alt', 'c')] } }), 'both ends need no link');
  },
  'a story needs an ending unless endless (E-STORY-NO-END)'() {
    const links = [link('a-b', 'a', 'go', 'b'), link('b-c', 'b', 'go', 'c'), link('c-a', 'c', 'go', 'a')];
    bad(fx({ story: { ends: [], links } }), 'E-STORY-NO-END');
    valid(fx({ story: { ends: [], endless: true, links } }));
  },
  'an ending must stay reachable without bounded links (E-STORY-NO-END)'() {
    const links = [link('a-b', 'a', 'go', 'b'), link('b-c', 'b', 'go', 'c', { max: 1 }), link('b-a', 'b', 'alt', 'a')];
    eq(codes(fx({ story: { links } })).filter(c => c === 'E-STORY-NO-END').length > 0, true);
    valid(fx({ story: { links: [link('a-b', 'a', 'go', 'b'), link('b-c', 'b', 'go', 'c', { max: 1 }), link('b-c2', 'b', 'go', 'c')] } }));
  },
  'a cycle of timed links needs a max (E-STORY-LOOP)'() {
    const timed = (max) => fx({ story: { ends: ['c'], links: [{ id: 'a-b', from: 'a', afterMs: 1000, to: 'b' }, { id: 'b-a', from: 'b', afterMs: 1000, to: 'a', ...(max ? { max: 2 } : {}) }, link('b-c', 'b', 'go', 'c')] } });
    bad(timed(false), 'E-STORY-LOOP');
    valid(timed(true));
  },

  // ----- 10.11 needs -----
  'a capability event needs the capability in needs (E-NEEDS-MISSING)'() {
    const on = { 'physics:landed:ball': [{ id: 'landed', actions: [{ id: 'bump', emit: 'alt' }] }] };
    bad(fx({ scenes: { a: { on } } }), 'E-NEEDS-MISSING');
    valid(fx({ scenes: { a: { on } }, exp: { needs: ['physics'] } }));
  },
  'a link on a capability event needs the capability'() {
    const mk = (needs) => fx({ exp: needs ? { needs, grants: { signals: ['idle'] } } : { grants: { signals: ['idle'] } }, story: { links: [link('a-b', 'a', 'page:idle', 'b'), link('b-c', 'b', 'go', 'c')] } });
    bad(mk(null), 'E-NEEDS-MISSING');
    valid(mk(['page']));
  },
  'a declared need no content uses is W-NEEDS-UNUSED'() {
    const r = run(fx({ exp: { needs: ['physics'] } }));
    eq(r.diags.map(d => d.code), ['W-NEEDS-UNUSED']);
    eq(r.diags[0].path, 'needs[0]');
    // fit adds no grammar that shows in files, so it is never judged
    valid(fx({ exp: { needs: ['fit'] } }));
  },
  'a character seat needs ai'() {
    const seats = { guide: { label: 'Guide', persona: 'Kind.', view: [], answerType: { type: 'string', maxLength: 40 }, limits: { perMinute: 5 } } };
    const r = codes(fx({ exp: { needs: ['seats'], addons: { ai: { seats } } } }));
    eq(r.includes('E-NEEDS-MISSING'), true);
  },

  // ----- 10.5 grants -----
  'a signal heard must be granted (E-GRANT)'() {
    const on = { 'page:visible:signup': [{ id: 'seen', actions: [{ id: 'bump', emit: 'alt' }] }] };
    const mk = (grants) => fx({ scenes: { a: { on } }, exp: { needs: ['page'], addons: { page: { hooks: { signup: { kind: 'target' } } } }, ...(grants ? { grants } : {}) } });
    badP(mk(null), 'E-GRANT');
    badP(mk({ signals: ['visible:other'] }), 'E-GRANT');
    validP(mk({ signals: ['visible:signup'] }));
  },
  'a link on a signal must be granted'() {
    const mk = (grants) => fx({ exp: { needs: ['page'], ...(grants ? { grants } : {}) }, story: { links: [link('a-b', 'a', 'page:idle', 'b'), link('b-c', 'b', 'go', 'c')] } });
    badP(mk(null), 'E-GRANT');
    validP(mk({ signals: ['idle'] }));
  },
  'a page action and its hook must be granted (E-GRANT)'() {
    const entry = [{ id: 'show', call: 'page.highlight', with: { hook: "'signup'" } }, { id: 'emit-go', emit: 'go' }, { id: 'emit-alt', emit: 'alt' }];
    const mk = (grants) => fx({ scenes: { a: { entry } }, exp: { needs: ['page'], addons: { page: { hooks: { signup: { kind: 'target' } } } }, ...(grants ? { grants } : {}) } });
    badP(mk(null), 'E-GRANT');
    validP(mk({ pageActions: ['highlight:signup'] }));
    // a hook that is neither in page.hooks nor in grants.hooks
    const unknownHook = fx({ scenes: { a: { entry: [{ id: 'show', call: 'page.highlight', with: { hook: "'elsewhere'" } }, { id: 'emit-go', emit: 'go' }, { id: 'emit-alt', emit: 'alt' }] } }, exp: { needs: ['page'], addons: { page: { hooks: { signup: { kind: 'target' } } } }, grants: { pageActions: ['highlight:elsewhere'] } } });
    badP(unknownHook, 'E-GRANT');
    validP(fx({ scenes: { a: { entry: [{ id: 'show', call: 'page.highlight', with: { hook: "'elsewhere'" } }, { id: 'emit-go', emit: 'go' }, { id: 'emit-alt', emit: 'alt' }] } }, exp: { needs: ['page'], addons: { page: { hooks: { signup: { kind: 'target' } } } }, grants: { pageActions: ['highlight:elsewhere'], hooks: ['elsewhere'] } } }));
  },
  'a seat filler beyond human must be granted'() {
    const seats = { white: { kind: 'player', fillers: ['human', 'agent'], inputs: ['go'] } };
    const mk = (grants) => fx({ exp: { needs: ['seats'], addons: { seats: { seats } }, ...(grants ? { grants } : {}) } });
    bad(mk(null), 'E-GRANT');
    valid(mk({ fillers: ['agent'] }));
  },
  'session and saved values need no file error for storage (5.1.2 describes play time only)'() {
    const values = { n: { type: 'number', initial: 0, minimum: 0, maximum: 9, lifetime: 'saved' } };
    valid(fx({ exp: { values } }));
  },
};
