// The joins batch 1 asked for. Each item of the brief has its tests here.
import { assetsBase } from '../web/audio-web.mjs';
const { attachMedia } = await addonCode('../web/media-web.mjs', import.meta.url) ?? {};
import fs from 'node:fs';
import path from 'node:path';
import { checkValue, checkContent, wordingOf } from '../src/runtime.mjs';
import { loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing, narrowLayouts } from '../src/drawing.mjs';
import { chooseLayout } from '../src/layout.mjs';
import { folderSource } from '../src/load.mjs';
import { files as richFiles } from './richtext-fixture/files.mjs';
import { eq, ok, repo, schemas, mapSource, addonCode } from './helpers.mjs';
import { checkExperience } from '../check/index.mjs';
import { fixtureFiles as planFiles } from './a1-fit.test.mjs';
import { bakePlans } from '../tools/pack.mjs';
import { parseSize } from '../src/layout.mjs';

// The plan fixture checked with edits: findings as "CODE file path".
const AD = 'scenes/ad/scene.json'; const OFFER = 'components/offer/component.json';
function planFindings(edit) {
  const f = planFiles();
  const docs = { [AD]: JSON.parse(f[AD]), [OFFER]: JSON.parse(f[OFFER]) };
  edit(docs, f);
  for (const [k, v] of Object.entries(docs)) f[k] = JSON.stringify(v);
  return checkExperience(mapSource(f), schemas()).diags.filter(d => d.code !== 'W-PLAN-SCALE').map(d => `${d.code} ${d.file} ${d.path}`); // the plan fixture's known W-PLAN-SCALE aside
}
const BADGE = '<rect id="badge" data-hsvg-kind="part" x="0" y="0" width="40" height="40" fill="#b3261e"/>';
const withBadge = (paint = '') => (docs, f) => {
  f['scenes/ad/ad.svg'] = f['scenes/ad/ad.svg'].replace('</svg>', `${paint ? BADGE.replace('/>', ` data-hsvg-layer="${paint}"/>`) : BADGE}\n</svg>`);
  docs[AD].layouts[0].layoutPlan = { place: 'ad-box', kind: 'free', children: [{ box: [0, 0, 1, 1], node: { item: 'use:offer' } }, { box: [0, 0, 0.2, 0.2], node: { item: 'part:badge' } }] };
};

const RUN = { type: 'object', properties: { text: { type: 'string', maxLength: 200 }, style: { type: 'string', maxLength: 48 }, optional: { type: 'boolean' } }, required: ['text'], additionalProperties: false };
const RICH = { kind: 'content', type: 'array', contentType: 'richText', styles: ['strong'], maxItems: 8, items: RUN };
// The ladder fixture's files as a map, to change them in a test.
const ladderDir = path.join(repo, 'engine', 'v2', 'tests', 'ladder-fixture');
const ladderFiles = () => {
  const out = {};
  const walk = (sub) => { for (const e of fs.readdirSync(path.join(ladderDir, sub), { withFileTypes: true })) { const rel = sub ? `${sub}/${e.name}` : e.name; if (e.isDirectory()) walk(rel); else out[rel] = fs.readFileSync(path.join(ladderDir, rel), 'utf8'); } };
  walk('');
  return out;
};
const LAYOUT = { '970x250': 'billboard', '728x90': 'leaderboard', '300x250': 'rectangle', '320x50': 'phone-strip' };
function drawLadder(f, size) {
  const { experience, diags } = loadExperience(mapSource(f), schemas());
  ok(experience, `the fixture loads: ${diags.map(d => `${d.code} ${d.reason}`).join(', ')}`);
  const p = new Player(experience);
  ok(p.start().ok);
  const [width, height] = size.split('x').map(Number);
  const d = new Drawing(p);
  d.mountScene('ad', LAYOUT[size], { width, height });
  d.paint();
  return { p, d, text: (id) => d.frames.ad.byLocal.get(id).children.map(c => c.text ?? '').join(''), node: (id) => d.frames.ad.byLocal.get(id) };
}
function playRich(edit = (f) => f, language = 'en') {
  const f = structuredClone(richFiles); edit(f);
  const { experience, diags } = loadExperience(mapSource(f), schemas());
  ok(experience, `the fixture loads: ${JSON.stringify(diags)}`);
  const p = new Player(experience);
  p.state.ambient.language = language;
  const r = p.start();
  return { p, r };
}

const el = () => ({ style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, append() {}, appendChild() {}, addEventListener() {} });

// The plan fixture with a give-way rule on the offer's copy: an optional tiered field in a fit region `boxWidth` wide.
function ladderPlanFiles(boxWidth) {
  const f = planFiles();
  const offer = JSON.parse(f[OFFER]);
  offer.inputs = { copy: { kind: 'content', type: 'string', maxLength: 60, required: false, initial: { rich: 'Two for one, this week only', short: 'Two for one' } } };
  offer.bindings = [{ id: 'copy-text', target: 'offer-copy', text: '{{ copy }}', fit: { box: 'copy-box', minFontPx: 8, maxLines: 1 } }];
  offer.rules = [{ id: 'copy-fits', kind: 'fits', subject: 'field:copy', strength: 'give-way', steps: ['short', 'shrink', 'remove'], floor: { minTextPx: 10 } }];
  f[OFFER] = JSON.stringify(offer);
  f['components/offer/offer.svg'] = f['components/offer/offer.svg'].replace('<text id="offer__offer-copy"', `<rect id="offer__copy-box" data-hsvg-kind="part" data-hsvg-fit="" x="10" y="195" width="${boxWidth}" height="20" fill="none"/>\n<text id="offer__offer-copy"`);
  return f;
}
function bakeWith(f) {
  const { experience, diags } = loadExperience(mapSource(f), schemas());
  ok(experience, JSON.stringify(diags.slice(0, 3)));
  return bakePlans(experience, { date: '2026-11-07T00:00:00Z' });
}
const copyIn = (svg) => /<text id="offer__offer-copy"[^>]*?(\/>|>([^<]*)<\/text>)/.exec(svg);

export const tests = {
  // Item 6: baking runs the ladder (A1 and A2 Request 10).
  'the bake runs the ladder: the short wording goes into each derived frame, the step into its receipt (8.4, A8.3)'() {
    const f = ladderPlanFiles(90);
    const bad = checkExperience(mapSource(f), schemas()).diags.filter(d => d.code.startsWith('E-'));
    eq(bad.map(d => `${d.code} ${d.file} ${d.path} ${d.message}`), [], 'the changed fixture checks clean');
    const out = bakeWith(f);
    const offers = out.receipts.filter(r => r.subject === 'document:offer');
    ok(offers.length >= 4, `offer receipts: ${offers.length}`);
    for (const r of offers) {
      // Where the plan draws the offer so small that even the short wording is below the 10 px floor at its drawn size
      // (156x596, 318x48, 725x87), a size below the floor never fits, so the optional copy is removed (8.4).
      const want = /156x596|318x48|725x87/.test(r.id) ? ['short', 'remove'] : ['short'];
      eq(r.steps, want.map(step => ({ kind: 'give-way', rule: 'copy-fits', subject: 'field:copy', step })), r.id);
      eq(r.status, 'reduced', r.id);
      eq(r.rules, [{ rule: 'copy-fits', result: 'pass', proof: 'files' }], r.id);
      eq(r.selected.tiers, { copy: 'rich' }, r.id);
      eq(r.authority.textMeasurer, 'hsvg-plan-estimate-1');
    }
    const frames = Object.entries(out.texts).filter(([k]) => /offer\/.*\.derived\.svg$/.test(k));
    ok(frames.length >= 4);
    for (const [k, svg] of frames) eq(copyIn(svg)?.[2], /156x596|318x48|725x87/.test(k) ? undefined : 'Two for one', k);
    // The baked page shows the baked wording; the same experience unbaked, with no fit, shows the text's own fit.
    const baked = loadExperience(mapSource({ ...f, ...out.texts }), schemas()).experience;
    const p = new Player(baked); ok(p.start().ok);
    const d = new Drawing(p);
    d.mountScene('ad', 'fill', parseSize('300x250'));
    d.paint();
    const node = d.frames['ad/offer'].byLocal.get('offer-copy');
    eq(node.children.map(c => c.text ?? '').join(''), 'Two for one', 'the baked page keeps the baked wording');
    eq(p.read('ad/offer', 'copy'), 'Two for one, this week only', 'the content itself is unchanged');
  },
  'the bake removes an optional text that does not fit at its floor; the baked page keeps it hidden'() {
    const f = ladderPlanFiles(30);
    const out = bakeWith(f);
    const r = out.receipts.find(x => x.subject === 'document:offer');
    const kinds = r.steps.map(x => x.step).filter((x, i, a) => a.indexOf(x) === i);
    ok(kinds[0] === 'short' && kinds[kinds.length - 1] === 'remove', JSON.stringify(r.steps));
    eq(r.status, 'reduced');
    const [, svg] = Object.entries(out.texts).find(([k]) => /offer\/.*\.derived\.svg$/.test(k));
    ok(/display="none"\/>$/.test(copyIn(svg)[0]), copyIn(svg)[0]);
    const baked = loadExperience(mapSource({ ...f, ...out.texts }), schemas()).experience;
    const p = new Player(baked); ok(p.start().ok);
    const d = new Drawing(p);
    d.mountScene('ad', 'fill', parseSize('300x250'));
    d.paint();
    const node = d.frames['ad/offer'].byLocal.get('offer-copy');
    eq([node.attrs.display, node.children.map(c => c.text ?? '').join('')], ['none', '']);
  },
  // Item 8: checks.
  'E-OVERLAP: two plan items overlap at a must size; a relation overlay rule or decoration paint allows it (7.5)'() {
    eq(planFindings(withBadge()), [`E-OVERLAP ${AD} /layouts/0/layoutPlan`]);
    eq(planFindings((d, f) => { withBadge()(d, f); d[AD].rules = [{ id: 'badge-over', kind: 'relation', strength: 'must', subject: 'part:badge', is: 'overlay', to: 'use:offer' }]; }), []);
    eq(planFindings((d, f) => { withBadge()(d, f); d[AD].rules = [{ id: 'badge-beside', kind: 'relation', strength: 'must', subject: 'part:badge', is: 'beside', to: 'use:offer' }]; }), [`E-OVERLAP ${AD} /layouts/0/layoutPlan`], 'beside does not allow overlay');
    eq(planFindings(withBadge('decoration')), []);
    eq(planFindings((d, f) => { withBadge()(d, f); d[AD].layouts[0].layoutPlan.children[1].box = [0.8, 0.8, 0.2, 0.2]; d[AD].layouts[0].layoutPlan.children[0].box = [0, 0, 0.7, 0.7]; }), [], 'apart: no finding');
  },
  'a field item that no part shows alone is E-REF-UNKNOWN; a runs binding shows its field (7.5)'() {
    const item = (d) => d[OFFER].layouts[1].layoutPlan.children[0].node;
    eq(planFindings((d) => { item(d).item = 'field:nothing'; }), [`E-REF-UNKNOWN ${OFFER} /layouts/1/layoutPlan/children/0/node/item`]);
    eq(planFindings((d) => { item(d).item = 'field:features.items.1.title'; }), [`E-REF-UNKNOWN ${OFFER} /layouts/1/layoutPlan/children/0/node/item`], 'a column of a list row is not a field item');
    const found = planFindings((d) => {
      d[OFFER].inputs = { ...(d[OFFER].inputs || {}), title: { kind: 'content', type: 'string', maxLength: 40, initial: 'Summer' } };
      d[OFFER].bindings = [...(d[OFFER].bindings || []), { id: 'title-text', target: 'offer-title', text: '{{ title }}' }];
      item(d).item = 'field:title';
    });
    ok(!found.some(x => x.startsWith('E-REF-UNKNOWN')), JSON.stringify(found));
  },
  'an inner shape entry narrows layout choice: a layout for a size it drops is left out (7.1)'() {
    const layouts = [{ id: 'bill', size: '970x250' }, { id: 'leader', size: '728x90' }, { id: 'rect', size: '300x250' }, { id: 'any', shape: { minAspect: 0 } }];
    const kit = { axes: [{ axis: 'shape', select: 'space', sizes: { '970x250': 'must', '728x90': 'must', '300x250': 'must' } }] };
    const exp = { axes: [...kit.axes, { axis: 'shape', select: 'space', sizes: { '970x250': 'must', '300x250': 'must' } }] };
    eq(narrowLayouts(layouts, exp).map(l => l.id), ['bill', 'rect', 'any']);
    eq(narrowLayouts(layouts, kit).map(l => l.id), ['bill', 'leader', 'rect', 'any'], 'the kit alone keeps its sizes');
    eq(narrowLayouts(layouts.slice(0, 3), { axes: [{ axis: 'shape', select: 'space', sizes: { '1x1': 'must' } }] }).length, 3, 'none would be left: all stay');
    eq(chooseLayout(narrowLayouts(layouts, exp), { width: 728, height: 90 }).id, 'any', 'the dropped size is not chosen at its own space');
    eq(chooseLayout(layouts, { width: 728, height: 90 }).id, 'leader');
  },
  'E-CONTENT-REQUIRED: a required field never has an empty wording, in its initial or a use\'s with (7.9)'() {
    const check = (edit) => { const f = ladderFiles(); const exp = JSON.parse(f['experience.json']); edit(exp, f); f['experience.json'] = JSON.stringify(exp); return checkExperience(mapSource(f), schemas()).diags.map(d => `${d.code} ${d.file} ${d.path}`); };
    eq(check(() => {}), [], 'the ladder fixture is clean');
    eq(check((e) => { e.inputs.headline.initial.medium = ''; }), ['E-CONTENT-REQUIRED experience.json /inputs/headline/initial/medium']);
    eq(check((e) => { e.inputs.headline.initial = { en: e.inputs.headline.initial, de: { short: '' } }; }), ['E-CONTENT-REQUIRED experience.json /inputs/headline/initial/de/short']);
    eq(check((e) => { e.inputs.legal.initial.short = ''; }), [], 'an optional field may be left out at a tier');
    // richText: runs with no words; and a use's with for a component's required field.
    const f = structuredClone(richFiles);
    f['scenes/ad/scene.json'].uses[0].with.label.de = [{ text: ' ', style: 'strong' }];
    const rich = checkExperience(mapSource(f), schemas()).diags.filter(d => d.code === 'E-CONTENT-REQUIRED').map(d => `${d.file} ${d.path}`);
    eq(rich, ['scenes/ad/scene.json /uses/0/with/label/de']);
  },
  'a contrast rule\'s own ratio applies to each text style; without one, 4.5:1 (8.9)'() {
    const rule = (ratio) => (f) => { f['experience.json'].rules = [{ id: 'text-contrast', kind: 'contrast', strength: 'must', subject: 'text', ratio, largeRatio: 3 }]; };
    const styleFindings = (edit) => { const f = structuredClone(richFiles); edit(f); return checkExperience(mapSource(f), schemas()).diags.filter(d => d.code === 'E-RULE' && /rich-text\/styles/.test(d.path)).map(d => d.path); };
    eq(styleFindings(() => {}), [], 'the fixture passes 4.5:1');
    const strict = styleFindings(rule(7));
    ok(strict.includes('/addons/rich-text/styles/was-price/colorRole') && strict.includes('/addons/rich-text/styles/legal/colorRole'), `muted (about 6.7:1) is under 7:1: ${JSON.stringify(strict)}`);
    eq(styleFindings(rule(3)), [], 'a lower ratio of the rule is the ratio');
  },
  'a use item whose slot is a <g> has no box: E-PLACE (7.5)'() {
    const found = planFindings((d, f) => { f['scenes/ad/ad.svg'] = f['scenes/ad/ad.svg'].replace('<rect id="offer-slot" data-hsvg-kind="part" data-hsvg-slot="offer" x="4" y="4" width="292" height="242" fill="none"/>', '<g id="offer-slot" data-hsvg-kind="part" data-hsvg-slot="offer"/>'); });
    ok(found.includes('E-PLACE scenes/ad/ad.svg offer-slot'), JSON.stringify(found));
  },
  // Item 7: the line mouth's blend (L1 Request 1).
  async 'a line mouth blends its from look at 1 - mix and its look at mix, by group opacity (6.11)'() {
    const { experience } = loadExperience(await folderSource(path.join(repo, 'engine', 'v2', 'tests', 'lines-fixture')), schemas());
    const p = new Player(experience, {});
    ok(p.start().ok);
    const d = new Drawing(p);
    d.mountScene('talk', Object.keys(experience.scenes.talk.drawings)[0]);
    d.paint();
    const beak = d.frames['talk/polly'].byLocal.get('beak');
    const looks = () => Object.fromEntries(beak.children.filter(c => c.name).map(c => [c.attrs['data-hsvg-variant'], [c.attrs.display ?? '', c.attrs.opacity ?? '']]));
    eq(looks(), { shut: ['', ''], wide: ['none', ''], round: ['none', ''] });
    ok(p.send('talk', 'askHello').ok);
    p.advance(100); d.paint();
    eq(looks(), { shut: ['none', ''], wide: ['', ''], round: ['none', ''] }, 'a cue held past blendMs: one look, no opacity');
    p.advance(500); d.paint(); // line time 600 + lead 20: 20 ms into E (round), from X (shut), blendMs 60
    const m = p.mouthLooks[0];
    eq([m.look, m.from], ['round', 'shut']);
    ok(Math.abs(m.mix - 1 / 3) < 1e-9);
    eq([looks().shut[0], looks().wide[0], looks().round[0]], ['', 'none', ''], 'both looks of the blend show');
    ok(Math.abs(Number(looks().round[1]) - 1 / 3) < 0.01 && Math.abs(Number(looks().shut[1]) - 2 / 3) < 0.01, JSON.stringify(looks()));
    p.advance(100); d.paint();
    eq(looks(), { shut: ['none', ''], wide: ['none', ''], round: ['', ''] }, 'the blend is over: opacity back as drawn');
    p.advance(1000); d.paint();
    eq(looks(), { shut: ['', ''], wide: ['none', ''], round: ['none', ''] }, 'the line ended: rest, as drawn');
  },
  // Item 2: the runtime and richText values (R1 Requests 1 to 3).
  'checkValue honours required in an object: a run may leave out style, never text (5.1, 5.3.1)'() {
    eq(checkValue(RUN, { text: 'Hi' }), null);
    eq(checkValue(RUN, { style: 'strong' }), ['E-TYPE', 'missing member style'.replace('style', 'text')]);
    eq(checkValue(RUN, { text: 'Hi', bold: true }), ['E-TYPE', 'unknown member bold']);
    const closed = { type: 'object', properties: { a: { type: 'number', minimum: 0, maximum: 1 } } };
    eq(checkValue(closed, {}), ['E-TYPE', 'missing member a'], 'without required every member is required');
  },
  'checkContent: richText styles and markup; each wording of a tier or language object (5.3.1)'() {
    eq(checkContent(RICH, [{ text: 'Hi', style: 'strong' }, { text: ' there' }]), null);
    eq(checkContent(RICH, [{ text: 'Hi', style: 'legal' }])[0], 'E-TYPE');
    eq(checkContent(RICH, [{ text: '<b>Hi</b>' }])[0], 'E-TYPE');
    eq(checkContent(RICH, [{ text: 'a &amp; b' }])[0], 'E-TYPE');
    eq(checkContent(RICH, { en: [{ text: 'Hi' }], de: { short: [{ text: 'Hallo' }], rich: [{ text: 'Hallo', style: 'emphasis' }] } })[0], 'E-TYPE', 'a leaf deep in the object');
    const text = { kind: 'content', type: 'string', maxLength: 5 };
    eq(checkContent(text, { short: 'Hi', rich: 'Hello' }), null);
    eq(checkContent(text, { short: 'Hi', rich: 'Hello there' })[0], 'E-RANGE');
    eq(checkContent(text, { colour: 'red' })[0], 'E-TYPE');
  },
  'wordingOf: the tier wording, else the nearest longer, else shorter; a language object inside (7.9)'() {
    const v = { short: 'S', rich: { en: 'Rich', de: 'Reich' } };
    eq(wordingOf(v, { tier: 'short' }), 'S');
    eq(wordingOf(v, { tier: 'medium', language: 'de' }), 'Reich', 'medium takes the nearest longer');
    eq(wordingOf({ short: 'S', medium: 'M' }, { tier: 'rich' }), 'M', 'rich takes the nearest shorter');
    eq(wordingOf({ en: { short: 'S' }, fr: 'F' }, { language: 'fr-CA' }), 'F');
  },
  'a richText initial per language mounts, and reads in the active language'() {
    const de = [{ text: 'Regen?', style: 'accent' }];
    const edit = (f) => { f['experience.json'].inputs.headline.initial = { en: f['experience.json'].inputs.headline.initial, de }; };
    const { p, r } = playRich(edit, 'de');
    ok(r.ok, JSON.stringify(r));
    eq(p.read('experience', 'headline'), de);
    p.state.ambient.language = 'en';
    eq(p.read('experience', 'headline')[0].text, 'RAIN?');
  },
  'a run without a style is accepted when the field\'s items do not require one'() {
    const edit = (f) => { const h = f['experience.json'].inputs.headline; h.items = { ...h.items, required: ['text'] }; h.initial = [{ text: 'Plain' }, { text: ' bold', style: 'strong' }]; };
    const { r } = playRich(edit);
    ok(r.ok, JSON.stringify(r));
  },
  'setInput on a richText field checks its styles and its markup at play (5.3.1)'() {
    const { p, r } = playRich();
    ok(r.ok);
    const before = p.read('experience', 'headline');
    const a = p.setInput('headline', [{ text: 'Hi', style: 'legal' }]);
    ok(!a.ok, 'a style the field does not allow'); eq(a.code ?? a.fault?.code, 'E-TYPE');
    const b = p.setInput('headline', [{ text: '<i>Hi</i>', style: 'strong' }]);
    ok(!b.ok, 'markup in a run'); eq(b.code ?? b.fault?.code, 'E-TYPE');
    eq(p.read('experience', 'headline'), before, 'nothing written');
    ok(p.setInput('headline', [{ text: 'Hi', style: 'strong' }]).ok);
  },
  // Item 3: tiers reach formulas (A2 Request 1).
  'a formula, a mixed template and a visible binding see the tier wording, and a left-out field is empty (7.9)'() {
    const f = ladderFiles();
    const exp = JSON.parse(f['experience.json']);
    exp.inputs.badge = { kind: 'content', type: 'boolean', contentType: 'flag', required: false, tier: 'rich', initial: true };
    exp.computed = { ...(exp.computed || {}), headLength: 'length(headline)' };
    f['experience.json'] = JSON.stringify(exp);
    const sc = JSON.parse(f['scenes/ad/scene.json']);
    const brand = sc.bindings.find(b => b.id === 'brand-text');
    brand.text = '{{ brand }}: {{ headline }}';
    delete brand.fit;
    sc.bindings.push({ id: 'legal-shown', target: 'legal', visible: 'badge' });
    f['scenes/ad/scene.json'] = JSON.stringify(sc);
    const rich = drawLadder(f, '970x250');
    eq(rich.d.tierOf('ad').tier, 'rich');
    eq(rich.p.read('ad', 'headline'), 'Fresh sourdough, baked at dawn and delivered warm');
    eq(rich.p.read('ad', 'headLength'), 'Fresh sourdough, baked at dawn and delivered warm'.length);
    eq(rich.text('brand'), 'Harbour Bakery: Fresh sourdough, baked at dawn and delivered warm');
    eq(rich.p.read('ad', 'badge'), true);
    ok(rich.node('legal').attrs.display !== 'none', 'shown at rich');
    const short = drawLadder(f, '728x90');
    eq(short.d.tierOf('ad').tier, 'short');
    eq(short.p.read('ad', 'headline'), 'Fresh sourdough');
    eq(short.text('brand'), 'Harbour Bakery: Fresh sourdough');
    eq(short.p.read('ad', 'badge'), false, 'a flag left out at short reads false');
    eq(short.node('legal').attrs.display, 'none', 'its visible binding hides the part');
  },
  // Item 9: a packed page in a srcdoc frame.
  'audio: about:srcdoc gives no base, and a packed page still reads its sounds'() {
    eq(assetsBase('./', { location: { href: 'about:srcdoc' } }), null);
    eq(String(assetsBase('./a/', { location: { href: 'http://x/p/' } })), 'http://x/p/a/');
  },
  'media: attachMedia in a srcdoc frame does not throw'() {
    const doc = { createElement: el };
    const win = { location: { href: 'about:srcdoc' }, document: doc, addEventListener() {}, queueMicrotask() {} };
    const door = { exposed: () => ({ places: () => [] }), onDeliveries() {}, repaint() {}, report() {} };
    const container = el();
    const m = attachMedia({ door, container, win, options: { assets: async () => new Uint8Array(1) }, player: {} });
    ok(m && typeof m.sync === 'function');
  },
};
