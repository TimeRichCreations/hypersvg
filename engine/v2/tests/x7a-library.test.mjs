// Libraries and templates (D24; spec 4.8 and 4.10): the catalogue in a kit, pick-and-use, `hsvg new --from` and
// `hsvg add`, proved on the starter library (library/2.0/hsvg-starter) and its six templates. Fast: no browser
// (tests/browser/x7a-library-browser.mjs plays the packed pages).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { checkCatalogue, CATALOGUE_TYPES } from '../check/catalogue.mjs';
import { digestOf } from '../check/digest.mjs';
import { checkKitFolder, newFromTemplate, addItem, starterTemplates, LibraryError, TEMPLATES } from '../tools/library.mjs';
import { pack } from '../tools/pack.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const STARTER = path.join(repo, 'library', '2.0', 'hsvg-starter');
const FIXTURE = path.join(repo, 'engine', 'v2', 'tests', 'x7a-fixture', 'picks');
const SIX = ['ad', 'dashboard', 'game', 'quiz', 'story', 'tour'];
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `hsvg-x7a-${name}-`));
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const kits = { 'hsvg-starter': STARTER };
const check = async (dir, opts = {}) => checkExperience(await folderSource(dir, { kits }), schemas(), opts);
const errors = (r) => r.diags.filter(d => d.code.startsWith('E-'));
const has = (list, code, words = '') => list.some(d => d.code === code && (d.message || '').includes(words));
// A copy of the picks fixture with its experience.json changed by edit(doc).
function fixtureWith(edit) {
  const dir = path.join(tmp('picks'), 'picks');
  fs.cpSync(FIXTURE, dir, { recursive: true });
  const doc = readJson(path.join(dir, 'experience.json'));
  edit(doc);
  fs.writeFileSync(path.join(dir, 'experience.json'), JSON.stringify(doc, null, 2));
  return dir;
}

export const tests = {
  // ---- 1. the catalogue ----
  'the starter catalogue checks clean, and every block, resource and theme of the kit has an item'() {
    eq(checkKitFolder(STARTER), [], 'kit check');
    const kit = readJson(path.join(STARTER, 'kit.json'));
    const cat = readJson(path.join(STARTER, kit.catalogue));
    const items = Object.values(cat.items);
    for (const b of Object.keys(kit.blocks)) ok(items.some(i => i.block === b), `no item names block ${b}`);
    for (const r of Object.keys(kit.resources)) ok(items.some(i => i.resource === r), `no item names resource ${r}`);
    for (const t of Object.keys(kit.themes)) ok(items.some(i => i.theme === t), `no item names theme ${t}`);
    ok(items.length >= 69, `${items.length} items`);
  },
  'a catalogue with each mistake gets E-CATALOGUE with a message that says the fix'() {
    const kit = readJson(path.join(STARTER, 'kit.json'));
    const good = readJson(path.join(STARTER, kit.catalogue));
    const blockKind = (id) => (kit.blocks[id] ? readJson(path.join(STARTER, ...kit.blocks[id].split('/'))).kind : null);
    const exists = (rel) => fs.existsSync(path.join(STARTER, ...rel.split('/')));
    const run = (edit) => { const c = structuredClone(good); edit(c); return checkCatalogue(c, kit, { blockKind, exists }); };
    const cases = [
      [(c) => { c.version = '0.9.0'; }, 'write "version": "1.0.0"'],
      [(c) => { c.kit = 'other'; }, 'write "kit": "hsvg-starter"'],
      [(c) => { c.items['icon-star'].type = 'sticker'; }, 'use one of background, icon'],
      [(c) => { delete c.items['icon-star'].preview; }, 'give a preview'],
      [(c) => { c.items['icon-star'].preview = 'previews/nope.svg'; }, 'add the image or fix the path'],
      [(c) => { c.items['icon-star'].tags = []; }, 'give 1 to 8 different tags'],
      [(c) => { c.items['icon-star'].line = 'Two\nlines'; }, 'one sentence'],
      [(c) => { c.items['icon-star'].resource = 'bg-ocean-day'; }, 'names exactly one thing'],
      [(c) => { c.items['icon-star'].block = 'icon-nope'; }, 'add it to kit.json blocks or fix the id'],
      [(c) => { c.items['icon-star'].type = 'layout'; }, 'choose the type that fits'],
      [(c) => { c.items['bg-ocean-day'].type = 'icon'; }, 'a icon item names a block, not a resource'],
      [(c) => { c.items['theme-starter-day'].theme = 'starter-noon'; }, 'add it to kit.json themes'],
      [(c) => { c.items['Bad Id'] = c.items['icon-star']; }, 'lower-case words'],
      [(c) => { c.items['icon-star'].colour = 'red'; }, 'is not an item key'],
    ];
    eq(run(() => {}), [], 'the catalogue as it is');
    for (const [edit, fix] of cases) {
      const found = run(edit);
      ok(found.length && found.every(d => d.code === 'E-CATALOGUE'), `${edit}: ${JSON.stringify(found)}`);
      ok(found.some(d => d.message.includes(fix)), `${edit}: no "${fix}" in ${JSON.stringify(found.map(d => d.message))}`);
    }
    eq(Object.keys(CATALOGUE_TYPES).sort(), ['background', 'character', 'control', 'font', 'icon', 'image', 'layout', 'preset', 'rule-pack', 'shell', 'sound', 'theme', 'video'], 'the brief\'s types');
  },
  async 'an experience that pins the kit gets the catalogue checked too'() {
    const dir = path.join(tmp('pinned'), 'q');
    fs.cpSync(path.join(TEMPLATES, 'quiz'), dir, { recursive: true });
    const k = path.join(path.dirname(dir), 'kits', 'hsvg-starter');
    fs.cpSync(STARTER, k, { recursive: true, filter: (s) => !s.includes(`${path.sep}tools`) });
    const cat = readJson(path.join(k, 'catalogue.json'));
    cat.items['icon-star'].tags = ['Not A Tag'];
    fs.writeFileSync(path.join(k, 'catalogue.json'), JSON.stringify(cat));
    const r = checkExperience(await folderSource(dir), schemas());
    ok(has(r.diags, 'E-CATALOGUE', 'tags'), JSON.stringify(errors(r)));
  },

  // ---- 2. pick-and-use ----
  async 'an experience picks items of the starter: a component, a layout, a shell, a resource and a theme, and checks clean'() {
    const r = await check(FIXTURE);
    eq(errors(r), [], 'findings');
    const e = r.experience;
    ok(e.blocks['icon-star']?.kit === 'hsvg-starter' && e.blocks.button?.kit === 'hsvg-starter', 'picked components join blocks');
    ok(e.blocks.maya && e.blocks.answers, 'the definitions a picked layout uses come with it');
    ok(!e.blocks['icon-home'] && !e.blocks.fox, 'only what the items reach');
    eq(e.scenes.quiz.use, 'frame-quiz');
    eq(e.scenes.quiz.doc.inputs.q1.initial, 'Which star is ours?', 'the use\'s with');
    eq(e.shell.use, 'shell-paper');
    eq(e.doc.resources['bg-meadow-dawn'].file, 'kits/hsvg-starter/resources/images/meadow-dawn.svg', 'a picked resource is read from the kit');
    ok(e.doc.themes['starter-night'] && e.doc.themes['starter-day'], 'a picked theme brings the theme it extends');
    ok(e.doc.rights.copywriter, 'the kit\'s rights join');
  },
  async 'picks keep the kit\'s pin, seals and rights'() {
    const wrongVersion = await check(fixtureWith(d => { d.picks[0].version = '1.1.0'; }));
    ok(has(wrongVersion.diags, 'E-KIT-PIN', 'not the pinned 1.1.0'), JSON.stringify(errors(wrongVersion)));
    const wrongDigest = await check(fixtureWith(d => { d.picks[0].digest = `sha256:${'0'.repeat(64)}`; }));
    ok(has(wrongDigest.diags, 'E-KIT-PIN', 'has digest'), JSON.stringify(errors(wrongDigest)));
    // A use gives inputs only: a sealed picked definition's body is not reached.
    const sealed = await check(fixtureWith(d => { d.story.scenes.quiz.with.score = 3; }));
    ok(has(sealed.diags, 'E-SEAL') || has(sealed.diags, 'E-TYPE'), JSON.stringify(errors(sealed)));
    // A knob no editor may change (frame-quiz's total has no editableBy).
    const rights = await check(fixtureWith(d => { d.story.scenes.quiz.with.total = 2; }));
    ok(has(rights.diags, 'E-RIGHTS', 'no editor may change'), JSON.stringify(errors(rights)));
  },
  async 'a pick that cannot be used is refused, with what to do'() {
    const unknown = await check(fixtureWith(d => { d.picks[0].items.push('icon-unicorn'); }));
    ok(has(unknown.diags, 'E-REF-UNKNOWN', 'no catalogue item icon-unicorn'), JSON.stringify(errors(unknown)));
    const notPicked = await check(fixtureWith(d => { d.story.scenes.quiz.use = 'frame-tour'; }));
    ok(has(notPicked.diags, 'E-REF-UNKNOWN', 'pick it first'), JSON.stringify(errors(notPicked)));
    const clash = await check(fixtureWith(d => { d.resources = { 'bg-meadow-dawn': { kind: 'image', file: 'scenes/home/home.svg', width: 960, height: 600, license: 'CC-BY-4.0' } }; }));
    ok(has(clash.diags, 'E-ID-DUPLICATE', 'already declared'), JSON.stringify(errors(clash)));
    const kitExp = await check(fixtureWith(d => { d.kit = { id: 'hsvg-starter', version: '1.0.0' }; d.story = { start: 'quiz', scenes: { quiz: { use: 'frame-quiz' } }, ends: ['quiz'] }; delete d.shell; delete d.theme; }));
    ok(has(kitExp.diags, 'E-KIT-BODY'), `a kit experience never picks: ${JSON.stringify(errors(kitExp))}`);
    const noKit = await checkExperience(await folderSource(FIXTURE), schemas());
    ok(has(noKit.diags, 'E-KIT-PIN', 'put the kit at kits/hsvg-starter/'), JSON.stringify(errors(noKit)));
  },
  async 'a package of picked items carries only what they reach, and the page plays it flattened'() {
    const out = tmp('picks-out');
    const r = await pack(FIXTURE, out, { kits });
    const desc = readJson(r.packagePath);
    const members = Object.keys(desc.members);
    ok(members.includes('kits/hsvg-starter/blocks/icon-star/icon.svg') && members.includes('kits/hsvg-starter/catalogue.json'), members.join(' '));
    ok(!members.some(m => m.includes('/icon-home/') || m.includes('/fox/') || m.includes('/frame-tour/')), 'nothing the items do not reach');
    ok(desc.kits['hsvg-starter'].version === '1.0.0', JSON.stringify(desc.kits));
    const html = fs.readFileSync(r.htmlPath, 'utf8');
    ok(html.includes(', kitted: {'), 'the page plays the flattened experience');
  },

  // ---- 3. templates ----
  async 'hsvg new makes each of the six starter templates: new id, derivedFrom, the kit brought, checked and packed'() {
    eq(starterTemplates(), SIX, 'the starter templates');
    const into = tmp('new');
    for (const t of SIX) {
      const name = `my-${t}`;
      const tdir = path.join(TEMPLATES, t);
      const tdoc = readJson(path.join(tdir, 'experience.json'));
      const r = await newFromTemplate(name, t, into);
      eq(errors({ diags: r.diags }), [], `${t} checks`);
      const doc = readJson(path.join(into, name, 'experience.json'));
      eq(doc.id, name);
      eq(doc.about.derivedFrom, { id: t, version: '1.0.0', digest: digestOf(await folderSource(tdir), 'experience.json', tdoc) }, `${t} derivedFrom`);
      // Y3: the kit pin gains the kit's digest; the rest is the template's.
      const DIG = /^sha256:[0-9a-f]{64}$/;
      if (tdoc.kit) ok(DIG.test(doc.kit?.digest ?? ''), `${t}: the kit pin carries the kit's digest`);
      const noDigest = (k) => (k && typeof k === 'object' ? { ...k, digest: undefined } : k);
      const picks = (d) => (Array.isArray(d.picks) ? d.picks.map(noDigest) : d.picks);
      eq({ ...doc, id: tdoc.id, kit: noDigest(doc.kit), picks: picks(doc), about: { ...doc.about, derivedFrom: undefined } }, { ...tdoc, kit: noDigest(tdoc.kit), picks: picks(tdoc), about: { ...tdoc.about, derivedFrom: undefined } }, `${t}: the rest is the template's`);
      if (t === SIX[0]) eq(r.kitsCopied, ['hsvg-starter'], 'a folder that cannot find the kit gets it at kits/');
      const p = await pack(path.join(into, name), path.join(into, `${name}-out`));
      ok(fs.existsSync(p.htmlPath) && p.bytes > 0, `${t} packs`);
    }
    // The kit is copied once per new folder that needs it; a sibling of a folder with kits/ finds it there.
    ok(fs.existsSync(path.join(into, 'my-ad', 'kits', 'hsvg-starter', 'catalogue.json')), 'the brought kit holds its catalogue');
    ok(!fs.existsSync(path.join(into, 'my-ad', 'kits', 'hsvg-starter', 'tools')), 'never the kit\'s build tools');
  },
  async 'hsvg new refuses a folder that exists, a bad name and an unknown template'() {
    const into = tmp('refuse');
    fs.mkdirSync(path.join(into, 'taken'));
    const refusal = async (fn) => { try { await fn(); } catch (e) { ok(e instanceof LibraryError, e.stack); return e.message; } return null; };
    ok((await refusal(() => newFromTemplate('taken', 'quiz', into)))?.includes('already exists'), 'existing folder');
    ok((await refusal(() => newFromTemplate('My Quiz', 'quiz', into)))?.includes('lower-case words'), 'bad name');
    ok((await refusal(() => newFromTemplate('x', 'nope', into)))?.includes('one of the starter templates: ad, dashboard'), 'unknown template');
    eq(fs.readdirSync(path.join(into, 'taken')), [], 'nothing written into the folder that exists');
  },
  async 'a copy of a copy names its direct source, and a new experience from a plain folder works too'() {
    const into = tmp('copy');
    await newFromTemplate('first', 'story', into);
    const r = await newFromTemplate('second', path.join(into, 'first'), into);
    eq(r.derivedFrom.id, 'first');
    eq(errors({ diags: r.diags }), []);
    ok(r.kitsCopied.length === 0 || fs.existsSync(path.join(into, 'second', 'kits')), 'the kit found or brought');
    const plain = await newFromTemplate('press', path.join(repo, 'skill', '2.0', 'examples', 'first-run'), into);
    eq(errors({ diags: plain.diags }), [], 'an experience without a kit');
    eq(plain.kitsCopied, []);
  },
  async 'hsvg add picks one item for an experience, pinned to the library\'s version, and checks'() {
    const into = tmp('add');
    const dir = path.join(into, 'press');
    fs.cpSync(path.join(repo, 'skill', '2.0', 'examples', 'first-run'), dir, { recursive: true });
    const r = await addItem(STARTER, 'icon-star', dir);
    ok(r.changed && r.message.includes('"use": "icon-star"'), r.message);
    eq(r.kitsCopied, ['hsvg-starter']);
    eq(errors({ diags: r.diags }), [], 'checks after add');
    const picked = readJson(path.join(dir, 'experience.json')).picks;
    ok(/^sha256:[0-9a-f]{64}$/.test(picked[0]?.digest ?? ''), 'the pick carries the kit\'s digest (Y3)');
    eq(picked.map(x => ({ ...x, digest: undefined })), [{ id: 'hsvg-starter', version: '1.0.0', items: ['icon-star'], digest: undefined }]);
    const two = await addItem('hsvg-starter', 'theme-starter-night', dir); // by id, found at kits/ now
    ok(two.changed && two.message.includes('"theme": "starter-night"'), two.message);
    eq(readJson(path.join(dir, 'experience.json')).picks[0].items, ['icon-star', 'theme-starter-night']);
    const again = await addItem(STARTER, 'icon-star', dir);
    ok(!again.changed && again.message.includes('already picked'), again.message);
    let miss = null;
    try { await addItem(STARTER, 'icon-starr', dir); } catch (e) { miss = e.message; }
    ok(miss?.includes('near: icon-star'), miss);
    // A kit experience of the same kit already has every item; of another kit, it is refused.
    await newFromTemplate('q', 'quiz', into);
    const same = await addItem(STARTER, 'fox', path.join(into, 'q'));
    ok(!same.changed && same.message.includes('already there'), same.message);
  },
};
