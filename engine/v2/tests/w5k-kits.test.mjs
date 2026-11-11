// Kits (4.6 to 4.9, 7.7, 9.9, 10.8, A9.3). The loader reads a pinned kit; the player plays its kit
// experiences; the checker's kit codes each have a failing and a passing fixture. The fixtures start from the example
// in examples/2.0-kit-ads (one kit, three ads) and change one thing. The kit ads come with the add-ons release; the
// tests named "core kit: ..." prove the same features on engine/v2/tests/kit-fixture, which the core release holds.
import fs from 'node:fs';
import path from 'node:path';
import { repo, schemas, eq, ok } from './helpers.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { applyKit, literalOf, versionStep, parseVersion } from '../src/kit.mjs';
import { checkExperience } from '../check/index.mjs';
import { canonical, documentDigest, kitDigest, blockDigest, checkKitVersion, kitChangeClass, sealLeaks } from '../check/kits.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { packageNeeds } from '../src/capabilities.mjs';
import { pack } from '../tools/pack.mjs';
import { checkPackage } from '../check/packages.mjs';
import os from 'node:os';
import crypto from 'node:crypto';

const EX = path.join(repo, 'examples', '2.0-kit-ads');
const ADS = ['ad-300x250', 'ad-728x90', 'ad-160x600'];
function filesUnder(dir, prefix = '', out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) filesUnder(p, `${prefix}${e.name}/`, out); else out[`${prefix}${e.name}`] = fs.readFileSync(p, 'utf8');
  }
  return out;
}
// The files of one ad with its kit at kits/ad-kit/, as the package lays them out. Values are text; JSON documents may
// be changed through edit().
function adFiles(ad = 'ad-300x250') {
  return { ...filesUnder(path.join(EX, 'ads', ad)), ...filesUnder(path.join(EX, 'kits', 'ad-kit'), 'kits/ad-kit/') };
}
const edit = (files, rel, fn) => { const d = JSON.parse(files[rel]); fn(d); files[rel] = JSON.stringify(d, null, 1); return files; };
const sourceOf = (files) => ({ read: (r) => files[r] ?? null, bytes: (r) => (r in files ? new TextEncoder().encode(files[r]) : null) });
const check = (files, opts) => checkExperience(sourceOf(files), schemas(), opts);
const codes = (r, prefix = '') => r.diags.map(d => d.code).filter(c => c.startsWith(prefix));
const has = (r, code) => r.diags.some(d => d.code === code);
const KIT = 'kits/ad-kit/kit.json';
const AD = 'kits/ad-kit/scenes/ad/scene.json';
const OFFER = 'kits/ad-kit/blocks/offer/component.json';

function play(files) {
  const l = loadExperience(sourceOf(files), schemas());
  ok(l.ok, JSON.stringify(l.diags));
  const p = new Player(l.experience);
  p.start();
  return p;
}
function draw(p, layout) { const d = new Drawing(p); d.mountScene(p.state.story.current, layout); d.paint(); return d.serialize(); }

// The core kit fixture (engine/v2/tests/kit-fixture): a story kit and one story of two pages. The kit ads come with the
// add-ons release, so the core release runs its kit tests on this fixture (the tests named "core kit: ...").
const CORE = path.join(repo, 'engine', 'v2', 'tests', 'kit-fixture');
function taleFiles() {
  return { ...filesUnder(path.join(CORE, 'tales', 'fox-tale')), ...filesUnder(path.join(CORE, 'kits', 'tale-kit'), 'kits/tale-kit/') };
}
const TKIT = 'kits/tale-kit/kit.json';
const PAGE = 'kits/tale-kit/scenes/page/scene.json';
const BADGE = 'kits/tale-kit/blocks/badge/component.json';

export const tests = {
  // ---------- loading and playing ----------
  async 'the three ads check with 0 findings, from their folders (the kit is found in a parent kits/ folder)'() {
    for (const ad of ADS) {
      const r = checkExperience(await folderSource(path.join(EX, 'ads', ad)), schemas());
      eq(r.diags, [], `${ad}:`);
    }
  },
  'a kit experience plays: scenes are uses of kit definitions, its with and the kit inputs reach the drawing'() {
    const p = play(adFiles('ad-728x90'));
    eq(p.state.story.current, 'open');
    const svg = draw(p, 'leaderboard');
    ok(svg.includes('>Rain Gear Co.<'), 'the kit input brand, set by the top-level with, reaches the scene through a with formula');
    ok(svg.includes('>Puddles welcome.<'), "the ad's own word reaches the kit headline block");
    ok(svg.includes('>£19<'), 'a literal with reaches the offer block');
    ok(/id="open__offer-area"[^>]*display="none"/.test(svg), 'beat 1 hides the offer');
  },
  'the 15 s story: three timed links of 5 s, the end at 15 s'() {
    const p = play(adFiles());
    const seen = [p.state.story.current];
    for (let i = 0; i < 3; i++) { p.advance(5000); seen.push(p.state.story.current); }
    eq(seen, ['open', 'offer', 'close', 'rest']);
    ok(p.state.outputs.some(o => o.name === 'ended' && o.scene === 'rest'), 'the story ends');
    ok(/id="rest__cta-area"(?![^>]*display="none")/.test(draw(p, 'rectangle')), 'beat 3 shows the button');
  },
  'a kit block is used like an experience block; its words are the kit words'() {
    const l = loadExperience(sourceOf(adFiles()), schemas());
    eq(Object.keys(l.experience.blocks).sort(), ['button', 'headline', 'offer']);
    eq(l.experience.blocks.button.words.en.shopNow, 'Shop now');
    eq(l.experience.scenes.open.file, AD, "a scene use keeps the definition's file");
    eq(l.experience.doc.story.scenes, { open: AD, offer: AD, close: AD, rest: AD });
  },
  'with: a literal becomes the input initial, a formula becomes a computed value of the scene'() {
    const l = loadExperience(sourceOf(adFiles()), schemas());
    const d = l.experience.scenes.close.doc;
    eq(d.inputs.beat.initial, 3);
    eq(d.inputs.price.initial, '£24');
    eq(d.computed, { headline: 'words.headline', cta: 'words.shopNow' });
    eq(d.inputs.brandName.from, 'brand', 'a one-name formula keeps the declaration and passes the input through');
    eq(literalOf("'a'"), { value: 'a' }); eq(literalOf('-2'), { value: -2 }); eq(literalOf('x + 1'), null);
  },
  "the kit's needs join the union"() {
    const files = edit(adFiles(), OFFER, d => { d.needs = ['fit']; });
    edit(files, KIT, d => { d.needs = ['synth']; });
    const l = loadExperience(sourceOf(files), schemas());
    eq(packageNeeds(l.experience), ['synth', 'fit']);
  },
  "a kit experience's settings name a kit knob, and the setting changes it"() {
    const files = edit(adFiles(), KIT, d => { d.inputs.speed = { kind: 'knob', type: 'number', minimum: 1, maximum: 3, step: 1, initial: 2, editableBy: ['designer'] }; });
    edit(files, 'experience.json', d => { d.addons = { widgets: { settings: { items: [{ id: 'tune-speed', knob: 'speed', label: 'Speed', when: 'play' }] } } }; (d.needs ??= []).push('widgets'); d.with.speed = 3; });
    eq(check(files).diags, []);
    const p = play(files);
    eq(p.state.blocks.experience.inputs.speed, 3, 'the top-level with sets the kit knob');
    edit(files, 'experience.json', d => { d.addons.widgets.settings.items[0].knob = 'nope'; });
    ok(has(check(files), 'E-SETTING'), 'a knob that is not on the inputs face is refused');
  },
  'a second theme in the kit changes the colours of all three ads'() {
    for (const [ad, layout] of [['ad-300x250', 'rectangle'], ['ad-728x90', 'leaderboard'], ['ad-160x600', 'skyscraper']]) {
      const day = draw(play(adFiles(ad)), layout);
      const files = edit(adFiles(ad), 'experience.json', d => { d.theme = 'harbour-night'; });
      eq(check(files).diags, [], `${ad} at night:`);
      const night = draw(play(files), layout);
      ok(/id="open__ground"[^>]*fill="#fff4d8"/.test(day) && /id="open__ground"[^>]*fill="#10212b"/.test(night), `${ad}: the surface follows the theme`);
      ok(/__headline-use__line"[^>]*fill="#fff4d8"/.test(night), `${ad}: the kit block's ink follows the theme`);
    }
  },

  // ---------- E-KIT-PIN ----------
  'E-KIT-PIN: a missing kit, a wrong version, a wrong digest; the right digest passes'() {
    ok(has(check(edit(adFiles(), 'experience.json', d => { d.kit.id = 'no-kit'; })), 'E-KIT-PIN'), 'missing kit');
    ok(has(check(edit(adFiles(), 'experience.json', d => { d.kit.version = '1.0.1'; })), 'E-KIT-PIN'), 'missing version');
    const files = adFiles();
    const l = loadExperience(sourceOf(files), schemas());
    const digest = kitDigest(sourceOf(files), l.experience.kit);
    ok(/^sha256:[0-9a-f]{64}$/.test(digest));
    eq(check(edit(adFiles(), 'experience.json', d => { d.kit.digest = digest; })).diags, [], 'the right digest:');
    ok(has(check(edit(adFiles(), 'experience.json', d => { d.kit.digest = `sha256:${'0'.repeat(64)}`; })), 'E-KIT-PIN'), 'wrong digest');
    const changed = edit(adFiles(), 'experience.json', d => { d.kit.digest = digest; });
    changed['kits/ad-kit/blocks/offer/offer.svg'] = changed['kits/ad-kit/blocks/offer/offer.svg'].replace('£24', '£25');
    ok(has(check(changed), 'E-KIT-PIN'), "a changed drawing in the kit changes the kit's digest");
  },
  'digests: the worked example of A9.3 and canonical JSON'() {
    const doc = { format: 'hsvg/2.0', kind: 'rule-pack', id: 'quiet-pack', about: { title: 'Quiet', version: '1.0.0', trust: { digest: 'sha256:x' } },
      rules: [{ id: 'no-sound', kind: 'budget', measure: 'soundBytes', maximum: 0 }] };
    eq(documentDigest(doc, {}), 'sha256:c70b3e81616e3cba79366ec2d6367473955e766f7c5037cf9d0139bdd5202810');
    eq(canonical({ b: [1, 'é', 1e21, 0.5], a: { d: null, c: true } }), '{"a":{"c":true,"d":null},"b":[1,"é",1e+21,0.5]}');
  },

  // ---------- E-KIT-VERSION ----------
  'E-KIT-VERSION: each change needs its class; a smaller step is refused'() {
    const kitOf = (files) => loadExperience(sourceOf(files), schemas()).experience.kit;
    const before = kitOf(adFiles());
    const bump = (v, fn) => { const f = edit(adFiles(), KIT, d => { d.about.version = v; }); fn?.(f); edit(f, 'experience.json', d => { d.kit.version = v; }); return kitOf(f); };
    eq(kitChangeClass(before, kitOf(adFiles())).need, 'none');
    eq(checkKitVersion(before, bump('1.0.1')), [], 'a patch with no change');
    // patch: a body change
    const body = (f) => edit(f, OFFER, d => { d.bindings[0].text = '{{ label }}!'; });
    eq(kitChangeClass(before, bump('1.0.1', body)).need, 'patch');
    // minor: a new input with an initial, a widened bound, a changed initial, a new block
    const widen = (f) => edit(f, OFFER, d => { d.inputs.price.maxLength = 12; });
    eq(kitChangeClass(before, bump('1.1.0', widen)).need, 'minor');
    eq(codes({ diags: checkKitVersion(before, bump('1.0.1', widen)) }), ['E-KIT-VERSION'], 'a widened bound in a patch');
    eq(checkKitVersion(before, bump('1.1.0', widen)), [], 'a widened bound in a minor version');
    // major: a narrowed bound, a changed editableBy, a removed block, a new must rule, changed rights
    for (const fn of [
      (f) => edit(f, OFFER, d => { d.inputs.price.maxLength = 4; }),
      (f) => edit(f, OFFER, d => { d.inputs.price.editableBy = ['designer']; }),
      (f) => edit(f, KIT, d => { delete d.blocks.button; }),
      (f) => edit(f, OFFER, d => { d.rules = [{ id: 'price-clear', kind: 'clear', subject: 'part:price', of: ['controls'] }]; }),
      (f) => edit(f, KIT, d => { d.rights.marketer.may = ['edit']; }),
    ]) {
      eq(kitChangeClass(before, bump('2.0.0', fn)).need, 'major');
      ok(has({ diags: checkKitVersion(before, bump('1.1.0', fn)) }, 'E-KIT-VERSION'), 'a major change in a minor version');
      eq(checkKitVersion(before, bump('2.0.0', fn)), []);
    }
    ok(has({ diags: checkKitVersion(before, bump('1.0.0', body)) }, 'E-KIT-VERSION'), 'a change with no new version');
    eq(versionStep('1.0.0', '0.9.0'), 'down'); eq(parseVersion('01.0.0'), null);
  },
  'E-KIT-VERSION through the checker: opts.previousKit'() {
    const before = loadExperience(sourceOf(adFiles()), schemas()).experience.kit;
    const files = edit(adFiles(), OFFER, d => { d.inputs.price.maxLength = 4; });
    ok(has(check(files, { previousKit: before }), 'E-KIT-VERSION'));
    eq(check(adFiles(), { previousKit: before }).diags, []);
  },

  // ---------- E-ROLE-KIT and E-THEME-ROLES ----------
  'E-ROLE-KIT: a kit role word that is a core role or alias is refused, in the kit file'() {
    const r = check(edit(adFiles(), KIT, d => { d.roles.headline = { aliases: [], jobGroup: 'message', appliesTo: ['part'] }; }));
    eq(r.diags.filter(d => d.code === 'E-ROLE-KIT').map(d => [d.file, d.path]), [[KIT, '/roles/headline']]);
    ok(has(check(edit(adFiles(), KIT, d => { d.roles['price-tag'].aliases.push('cta'); })), 'E-ROLE-KIT'), 'an alias too');
    ok(!has(check(adFiles()), 'E-ROLE-KIT'));
  },
  "kit roles are known: a drawing's kit role is not unknown; without the kit role it is"() {
    ok(!has(check(adFiles()), 'W-ROLE-UNKNOWN'));
    ok(has(check(edit(adFiles(), KIT, d => { delete d.roles['price-tag']; })), 'W-ROLE-UNKNOWN'));
  },
  'E-THEME-ROLES: a theme without a role the kit uses'() {
    const r = check(edit(adFiles(), KIT, d => { delete d.themes['harbour-day'].colorRoles['on-accent']; }));
    eq(r.diags.filter(d => d.code === 'E-THEME-ROLES').map(d => d.path), ['/themes/harbour-day'], 'the night theme gives it itself:');
    ok(!has(check(edit(adFiles(), KIT, d => { delete d.themes['harbour-night'].colorRoles['on-accent']; })), 'E-THEME-ROLES'), 'extends gives the role');
    const typed = adFiles();
    typed['kits/ad-kit/blocks/headline/headline.svg'] = typed['kits/ad-kit/blocks/headline/headline.svg'].replace('data-hsvg-role="message"', 'data-hsvg-role="message" data-hsvg-text-style="heading"');
    ok(has(check(typed), 'E-THEME-ROLES'), 'a type role no theme gives');
  },

  // ---------- seals ----------
  'E-SEAL: a with that names a sealed body value; open definitions are not sealed'() {
    const files = edit(adFiles(), AD, d => { d.values = { taps: { type: 'number', initial: 0, minimum: 0, maximum: 9 } }; });
    edit(files, 'experience.json', d => { d.story.scenes.open.with.taps = 1; });
    ok(has(check(files), 'E-SEAL'));
    edit(files, AD, d => { d.seal = 'open'; });
    ok(!has(check(files), 'E-SEAL'), 'an open definition');
    ok(has(check(edit(adFiles(), 'experience.json', d => { d.story.scenes.open.with.nothing = 1; })), 'E-TYPE'), 'a name that is not an input');
    const used = edit(adFiles(), OFFER, d => { d.values = { shown: { type: 'boolean', initial: true } }; });
    edit(used, AD, d => { d.uses[1].with.shown = 'false'; });
    ok(has(check(used), 'E-SEAL'), 'a use inside the kit');
  },
  'E-SEAL: a promotion of a sealed body value; W-RIGHTS-WIDEN: a promotion that adds a right'() {
    const files = edit(adFiles(), OFFER, d => { d.values = { shown: { type: 'boolean', initial: true } }; });
    edit(files, AD, d => { d.promote = [{ from: 'offer-use/shown' }]; });
    ok(has(check(files), 'E-SEAL'));
    const widen = edit(adFiles(), AD, d => { d.promote = [{ from: 'offer-use/price', as: 'offerPrice', editableBy: ['marketer', 'designer'] }]; delete d.uses[1].with.price; });
    const r = check(widen);
    ok(has(r, 'W-RIGHTS-WIDEN'), JSON.stringify(r.diags));
    ok(!has(check(edit(widen, AD, d => { d.promote[0].editableBy = ['marketer']; })), 'W-RIGHTS-WIDEN'));
  },
  'E-SEAL-LEAK: a sealed body that reads or writes outside itself'() {
    const reads = edit(adFiles(), AD, d => { d.bindings[0].text = '{{ brand }}'; });
    const r = check(reads);
    ok(r.diags.some(d => d.code === 'E-SEAL-LEAK' && d.file === AD && /brand/.test(d.message)), JSON.stringify(r.diags));
    ok(!has(check(edit(reads, AD, d => { d.seal = 'open'; })), 'E-SEAL-LEAK'), 'an open definition may read the experience');
    eq(sealLeaks({ inputs: { a: { kind: 'content', type: 'string' } }, bindings: [{ id: 'x', target: 'y', text: '{{ a }} {{ words.hi }} {{ size.width }}' }] }), []);
    eq(sealLeaks({ values: {}, on: { 'press:a': [{ id: 'r', actions: [{ id: 's', set: 'outside', to: '1' }] }] } }).map(l => [l.name, !!l.write]), [['outside', true]]);
  },
  'E-SEAL-DIGEST: a sealed definition in a reviewed kit needs its digest; a draft kit does not'() {
    const review = (f) => edit(f, KIT, d => { d.about.trust = { review: [{ status: 'candidate', by: 'person:sam', date: '2026-11-01' }] }; });
    eq(check(adFiles()).diags, [], 'a draft kit');
    const r = check(review(adFiles()));
    eq(r.diags.filter(d => d.code === 'E-SEAL-DIGEST').length, 4, 'four sealed definitions, no digests');
    // Record each digest: then it passes.
    const files = review(adFiles());
    const l = loadExperience(sourceOf(files), schemas());
    for (const def of Object.values(l.experience.kit.blocks)) {
      // The trust object is part of the document the digest covers (empty once the digest is removed), so it is
      // added first, then the digest is computed and written into it.
      def.doc.about = { ...(def.doc.about || {}), trust: {} };
      const d = blockDigest(sourceOf(files), def);
      edit(files, def.file, x => { x.about = { ...(x.about || {}), trust: { digest: d } }; });
    }
    eq(check(files).diags.filter(d => d.code === 'E-SEAL-DIGEST'), []);
    edit(files, OFFER, x => { x.inputs.price.initial = '£30'; });
    eq(check(files).diags.filter(d => d.code === 'E-SEAL-DIGEST').map(d => d.file), [OFFER], 'a changed definition no longer matches');
  },

  // ---------- rights ----------
  'E-RIGHTS: a kit experience may set only inputs an editor may change'() {
    const files = edit(adFiles(), AD, d => { delete d.inputs.beat.editableBy; });
    const r = check(files);
    eq(r.diags.filter(d => d.code === 'E-RIGHTS').length, 4, 'four scenes set beat');
    ok(has(check(edit(adFiles(), KIT, d => { d.inputs.brand.editableBy = []; })), 'E-RIGHTS'), 'a kit input with no editor');
    ok(!has(check(adFiles()), 'E-RIGHTS'));
  },
  'E-RIGHTS-UNKNOWN: an editableBy that names a right the kit does not declare'() {
    const r = check(edit(adFiles(), OFFER, d => { d.inputs.price.editableBy = ['marketer', 'intern']; }));
    eq(r.diags.filter(d => d.code === 'E-RIGHTS-UNKNOWN').map(d => [d.file, d.path]), [[OFFER, '/inputs/price/editableBy/1']]);
    ok(has(check(edit(adFiles(), KIT, d => { d.inputs.brand.editableBy = ['intern']; })), 'E-RIGHTS-UNKNOWN'), 'a kit input');
    ok(has(check(edit(adFiles(), AD, d => { d.promote = [{ from: 'offer-use/price', as: 'offerPrice', editableBy: ['intern'] }]; delete d.uses[1].with.price; })), 'E-RIGHTS-UNKNOWN'), 'a promotion');
  },

  // ---------- kit experience shape ----------
  'E-KIT-BODY: a kit experience with values of its own, or a scene file'() {
    ok(has(check(edit(adFiles(), 'experience.json', d => { d.values = { x: { type: 'number', initial: 0 } }; })), 'E-KIT-BODY'));
    const files = edit(adFiles(), 'experience.json', d => { d.story.scenes.open = 'scenes/open/scene.json'; });
    ok(has(check(files), 'E-KIT-BODY'));
  },
  'a scene use of a definition the kit lacks is E-REF-UNKNOWN; a kit path that leaves the kit is E-PATH'() {
    ok(has(check(edit(adFiles(), 'experience.json', d => { d.story.scenes.open.use = 'nope'; })), 'E-REF-UNKNOWN'));
    const files = edit(adFiles(), KIT, d => { d.blocks.offer = '../../outside/component.json'; });
    ok(has(check(files), 'E-PATH'));
  },
  'applyKit is pure data: the kit document is not changed'() {
    const l = loadExperience(sourceOf(adFiles()), schemas());
    const before = JSON.stringify(l.experience.kit.doc);
    const again = { ...l.experience, doc: l.experience.own, scenes: {}, blocks: {} };
    applyKit(again, l.experience.kit);
    eq(JSON.stringify(l.experience.kit.doc), before);
    eq(again.doc.theme, 'harbour-day');
  },

  // ---------- the packer (10.8) ----------
  async 'each ad packs with its kit: kits, members with digests, and the page plays from the packed files'() {
    for (const ad of ADS) {
      const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-w5k-'));
      try {
        const r = await pack(path.join(EX, 'ads', ad), out);
        const pkg = JSON.parse(fs.readFileSync(r.packagePath, 'utf8'));
        eq(pkg.kits, { 'ad-kit': { version: '1.0.0', path: 'kits/ad-kit/kit.json' } });
        const kitFiles = filesUnder(path.join(EX, 'kits', 'ad-kit'), 'kits/ad-kit/');
        const files = { ...filesUnder(path.join(EX, 'ads', ad)), ...kitFiles };
        eq(Object.keys(pkg.members).sort(), Object.keys(files).sort(), `${ad}: every file of the ad and its kit is a member`);
        eq(checkPackage(pkg, files), [], `${ad}: digests`);
        for (const [rel, d] of Object.entries(pkg.members)) eq(d, 'sha256:' + crypto.createHash('sha256').update(files[rel]).digest('hex'));
        // The page's embedded files are the same members; loaded with no schemas (a packed page), they play.
        const html = fs.readFileSync(r.htmlPath, 'utf8');
        const texts = JSON.parse(/const pack = \{ files: (\{[\s\S]*?\}), binaries:/.exec(html)[1]);
        ok('kits/ad-kit/kit.json' in texts && 'kits/ad-kit/scenes/ad/scene.json' in texts, 'the kit is in the page');
        const l = loadExperience({ read: (rel) => texts[rel] ?? null }, null);
        ok(l.ok, JSON.stringify(l.diags));
        const p = new Player(l.experience); p.start(); p.advance(15000);
        eq(p.state.story.current, 'rest');
      } finally { fs.rmSync(out, { recursive: true, force: true }); }
    }
  },
  async 'a kit inside the experience folder (the package layout) is packed once, not twice'() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-w5k-in-'));
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-w5k-out-'));
    try {
      for (const [rel, text] of Object.entries(adFiles())) { const f = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
      fs.mkdirSync(path.join(dir, 'kits', 'ad-kit', 'evidence'));
      fs.writeFileSync(path.join(dir, 'kits', 'ad-kit', 'evidence', 'index.json'), '{}');
      const r = await pack(dir, out);
      const pkg = JSON.parse(fs.readFileSync(r.packagePath, 'utf8'));
      eq(Object.keys(pkg.members).sort(), Object.keys(adFiles()).sort(), 'no evidence, no repeats');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); }
  },

  // ---------- the core kit fixture: the same features, with no ad ----------
  async 'core kit: the story checks with 0 findings from its folder (the kit is found in a parent kits/ folder)'() {
    const r = checkExperience(await folderSource(path.join(CORE, 'tales', 'fox-tale')), schemas());
    eq(r.diags, []);
  },
  'core kit: the story plays: its with, the kit input and both words files reach the drawing; the button turns the page'() {
    const p = play(taleFiles());
    eq(p.state.story.current, 'first');
    const svg = draw(p, 'page');
    ok(svg.includes('>Grandma Owl<'), 'the kit input teller, set by the top-level with, reaches the scene');
    ok(svg.includes('>Fox finds a feather.<'), "the story's own word reaches the kit title block");
    ok(svg.includes('>Turn the page<'), "the kit's word reaches the kit button through the story's with");
    ok(/id="first__badge-use__count"[^>]*>1</.test(svg), 'a literal with reaches the badge block');
    ok(/id="first__next-area"(?![^>]*display="none")/.test(svg), 'step 1 shows the button');
    ok(p.activate('first/next-use', 'press').ok);
    eq(p.state.story.current, 'last');
    ok(p.state.outputs.some(o => o.name === 'ended' && o.scene === 'last'), 'the story ends');
    ok(/id="last__next-area"[^>]*display="none"/.test(draw(p, 'page')), 'step 2 hides the button');
  },
  'core kit: a kit block is used like an experience block; with: a literal becomes the initial, a formula a computed value'() {
    const l = loadExperience(sourceOf(taleFiles()), schemas());
    eq(Object.keys(l.experience.blocks).sort(), ['badge', 'button', 'title']);
    eq(l.experience.blocks.button.words.en.next, 'Turn the page');
    eq(l.experience.doc.story.scenes, { first: PAGE, last: PAGE });
    const d = l.experience.scenes.last.doc;
    eq([d.inputs.step.initial, d.inputs.pageNumber.initial], [2, '2']);
    eq(d.computed, { heading: 'words.ending', turn: 'words.next' });
    eq(d.inputs.tellerName.from, 'teller');
  },
  'core kit: a second theme in the kit changes the colours'() {
    const day = draw(play(taleFiles()), 'page');
    const files = edit(taleFiles(), 'experience.json', d => { d.theme = 'meadow-night'; });
    eq(check(files).diags, []);
    const night = draw(play(files), 'page');
    ok(/id="first__ground"[^>]*fill="#fbf6e9"/.test(day) && /id="first__ground"[^>]*fill="#1d2238"/.test(night), 'the surface follows the theme');
    ok(/__title-use__line"[^>]*fill="#fbf6e9"/.test(night), "the kit block's ink follows the theme");
  },
  'core kit: E-KIT-PIN: a missing kit, a wrong version, a wrong digest; the right digest passes'() {
    ok(has(check(edit(taleFiles(), 'experience.json', d => { d.kit.id = 'no-kit'; })), 'E-KIT-PIN'), 'missing kit');
    ok(has(check(edit(taleFiles(), 'experience.json', d => { d.kit.version = '1.0.1'; })), 'E-KIT-PIN'), 'missing version');
    const files = taleFiles();
    const digest = kitDigest(sourceOf(files), loadExperience(sourceOf(files), schemas()).experience.kit);
    ok(/^sha256:[0-9a-f]{64}$/.test(digest));
    eq(check(edit(taleFiles(), 'experience.json', d => { d.kit.digest = digest; })).diags, [], 'the right digest:');
    ok(has(check(edit(taleFiles(), 'experience.json', d => { d.kit.digest = `sha256:${'0'.repeat(64)}`; })), 'E-KIT-PIN'), 'wrong digest');
    const changed = edit(taleFiles(), 'experience.json', d => { d.kit.digest = digest; });
    changed['kits/tale-kit/blocks/badge/badge.svg'] = changed['kits/tale-kit/blocks/badge/badge.svg'].replace('>Page<', '>Leaf<');
    ok(has(check(changed), 'E-KIT-PIN'), "a changed drawing in the kit changes the kit's digest");
  },
  'core kit: E-KIT-VERSION: a patch, a minor and a major change, each needs its class'() {
    const kitOf = (files) => loadExperience(sourceOf(files), schemas()).experience.kit;
    const before = kitOf(taleFiles());
    const bump = (v, fn) => { const f = edit(taleFiles(), TKIT, d => { d.about.version = v; }); fn?.(f); edit(f, 'experience.json', d => { d.kit.version = v; }); return kitOf(f); };
    eq(kitChangeClass(before, kitOf(taleFiles())).need, 'none');
    const body = (f) => edit(f, BADGE, d => { d.bindings[0].text = '{{ label }}:'; });
    eq(kitChangeClass(before, bump('1.0.1', body)).need, 'patch');
    const widen = (f) => edit(f, BADGE, d => { d.inputs.count.maxLength = 6; });
    eq(kitChangeClass(before, bump('1.1.0', widen)).need, 'minor');
    eq(codes({ diags: checkKitVersion(before, bump('1.0.1', widen)) }), ['E-KIT-VERSION'], 'a widened bound in a patch');
    const narrow = (f) => edit(f, BADGE, d => { d.inputs.count.maxLength = 2; });
    eq(kitChangeClass(before, bump('2.0.0', narrow)).need, 'major');
    ok(has({ diags: checkKitVersion(before, bump('1.1.0', narrow)) }, 'E-KIT-VERSION'), 'a major change in a minor version');
    eq(checkKitVersion(before, bump('2.0.0', narrow)), []);
    ok(has(check(edit(taleFiles(), BADGE, d => { d.inputs.count.maxLength = 2; }), { previousKit: before }), 'E-KIT-VERSION'), 'through the checker');
  },
  'core kit: kit roles and theme roles'() {
    ok(!has(check(taleFiles()), 'W-ROLE-UNKNOWN'), 'the kit role page-number is known');
    ok(has(check(edit(taleFiles(), TKIT, d => { delete d.roles['page-number']; })), 'W-ROLE-UNKNOWN'));
    ok(has(check(edit(taleFiles(), TKIT, d => { d.roles['page-number'].aliases.push('cta'); })), 'E-ROLE-KIT'), 'a core alias');
    const r = check(edit(taleFiles(), TKIT, d => { delete d.themes['meadow-day'].colorRoles['on-accent']; }));
    eq(r.diags.filter(d => d.code === 'E-THEME-ROLES').map(d => d.path), ['/themes/meadow-day']);
  },
  'core kit: seals: E-SEAL, E-SEAL-LEAK and E-SEAL-DIGEST'() {
    const files = edit(taleFiles(), PAGE, d => { d.values = { turns: { type: 'number', initial: 0, minimum: 0, maximum: 9 } }; });
    edit(files, 'experience.json', d => { d.story.scenes.first.with.turns = 1; });
    ok(has(check(files), 'E-SEAL'));
    ok(!has(check(edit(files, PAGE, d => { d.seal = 'open'; })), 'E-SEAL'), 'an open definition');
    const reads = edit(taleFiles(), PAGE, d => { d.bindings[0].text = '{{ teller }}'; });
    ok(check(reads).diags.some(d => d.code === 'E-SEAL-LEAK' && d.file === PAGE), 'a sealed body reads the kit input');
    const review = edit(taleFiles(), TKIT, d => { d.about.trust = { review: [{ status: 'candidate', by: 'person:sam', date: '2026-11-01' }] }; });
    eq(check(review).diags.filter(d => d.code === 'E-SEAL-DIGEST').length, 4, 'four sealed definitions, no digests');
  },
  'core kit: rights: E-RIGHTS and E-RIGHTS-UNKNOWN'() {
    eq(check(edit(taleFiles(), PAGE, d => { delete d.inputs.step.editableBy; })).diags.filter(d => d.code === 'E-RIGHTS').length, 2, 'two scenes set step');
    ok(has(check(edit(taleFiles(), TKIT, d => { d.inputs.teller.editableBy = []; })), 'E-RIGHTS'), 'a kit input with no editor');
    const r = check(edit(taleFiles(), BADGE, d => { d.inputs.count.editableBy = ['publisher', 'intern']; }));
    eq(r.diags.filter(d => d.code === 'E-RIGHTS-UNKNOWN').map(d => [d.file, d.path]), [[BADGE, '/inputs/count/editableBy/1']]);
  },
  'core kit: E-KIT-BODY, E-REF-UNKNOWN and E-PATH'() {
    ok(has(check(edit(taleFiles(), 'experience.json', d => { d.values = { x: { type: 'number', initial: 0 } }; })), 'E-KIT-BODY'));
    ok(has(check(edit(taleFiles(), 'experience.json', d => { d.story.scenes.first = 'scenes/first/scene.json'; })), 'E-KIT-BODY'));
    ok(has(check(edit(taleFiles(), 'experience.json', d => { d.story.scenes.first.use = 'nope'; })), 'E-REF-UNKNOWN'));
    ok(has(check(edit(taleFiles(), TKIT, d => { d.blocks.badge = '../../outside/component.json'; })), 'E-PATH'));
  },
  async 'core kit: the story packs with its kit, and the page plays from the packed files'() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-w5k-core-'));
    try {
      const r = await pack(path.join(CORE, 'tales', 'fox-tale'), out);
      const pkg = JSON.parse(fs.readFileSync(r.packagePath, 'utf8'));
      eq(pkg.kits, { 'tale-kit': { version: '1.0.0', path: 'kits/tale-kit/kit.json' } });
      const files = taleFiles();
      eq(Object.keys(pkg.members).sort(), Object.keys(files).sort(), 'every file of the story and its kit is a member');
      eq(checkPackage(pkg, files), []);
      const html = fs.readFileSync(r.htmlPath, 'utf8');
      const texts = JSON.parse(/const pack = \{ files: (\{[\s\S]*?\}), binaries:/.exec(html)[1]);
      const l = loadExperience({ read: (rel) => texts[rel] ?? null }, null);
      ok(l.ok, JSON.stringify(l.diags));
      const p = new Player(l.experience); p.start();
      ok(p.activate('first/next-use', 'press').ok);
      eq(p.state.story.current, 'last');
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  },
};
