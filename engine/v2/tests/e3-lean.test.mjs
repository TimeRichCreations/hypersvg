// A lean core (D18, D19) and the engine items E4 and Q1 left. Each item of the brief has its tests here:
// 1 and 3 the three capabilities (rich-text, ladder, lines) and E-NEEDS-MISSING without them; 2 the checkers and the
// kit loader out of the packed page, kits flattened at pack time; 4 sizes and the core's refusal; 5 needs (the upgrade's
// own test is docs/spec-2.0-work/tools/upgrade/lean-needs.test.mjs); 7 the baked read-out; 8 shell outputs in the
// host; 9 a theme font the package does not carry; 10 host.seat. The comment stripper of the production bundle too.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadExperience, folderSource } from '../src/load.mjs';
import { readExperience } from '../src/read.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { hostApi, modulePort } from '../src/host.mjs';
import { FORMAT } from '../src/limits.mjs';
import { checkExperience } from '../check/index.mjs';
import { bundle, engineSizes, bakePlans, flattenKit, pack, capabilityModules } from '../tools/pack.mjs';
import { stripComments } from '../tools/strip.mjs';
await addonCode('../modules/chess/index.mjs', import.meta.url);
await addonCode('../modules/chess-opponent/index.mjs', import.meta.url);
import { files as richFiles } from './richtext-fixture/files.mjs';
import { fixtureFiles as planFiles } from './a1-fit.test.mjs';
import { parseSize } from '../src/layout.mjs';
const { folder } = await addonCode('./board-game-make.mjs', import.meta.url) ?? {}; // an add-on test helper (it moves with the board game)
import { eq, ok, repo, schemas, mapSource, addonCode } from './helpers.mjs';

const v2 = path.join(repo, 'engine', 'v2');
const ENTRY = path.join(v2, 'web', 'packed-entry.mjs');
const fixture = (name) => path.join(v2, 'tests', name);
const codes = (diags, code = 'E-NEEDS-MISSING') => diags.filter(d => d.code === code);
const withoutNeed = (need) => (text) => { const d = JSON.parse(text); d.needs = (d.needs || []).filter(n => n !== need); return JSON.stringify(d); };
// A folder source with some files changed: edits maps a path to (text) => text.
async function edited(dir, edits = {}) {
  const src = await folderSource(dir);
  return { ...src, read: (rel) => { const t = src.read(rel); return t != null && edits[rel] ? edits[rel](t) : t; } };
}
const coreFiles = () => bundle(ENTRY).files;
// The plan fixture with a give-way rule on the offer's copy (as e2-joins builds it): an optional tiered field.
const OFFER = 'components/offer/component.json';
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

export const tests = {
  // ---------- items 1 and 3: the three capabilities ----------
  async 'lines: without it in needs the checker says E-NEEDS-MISSING and the engine stops with it; with it a line runs'() {
    const dir = fixture('lines-fixture');
    // The parrot names its own needs (10.11 rule 1): without lines means in neither document.
    const noLines = { 'experience.json': withoutNeed('lines'), 'components/parrot/component.json': withoutNeed('lines') };
    const bad = checkExperience(await edited(dir, noLines), schemas());
    ok(codes(bad.diags).some(d => /lines/.test(d.message)), JSON.stringify(codes(bad.diags)));
    const off = loadExperience(await edited(dir, noLines), null).experience;
    const p = new Player(off);
    eq(p.start().fault?.code, 'E-NEEDS-MISSING');
    eq(p.lines, null);
    const on = new Player(loadExperience(await folderSource(dir), null).experience);
    ok(on.start().ok);
    ok(on.lines, 'the lines runner is installed');
  },
  'lines: without it spoken stays idle and say is refused (E-NEEDS-MISSING)'() {
    const exp = { doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } }, words: { en: {} }, data: {},
      scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', on: { 'press:x': [{ id: 'p', actions: [{ id: 's', say: "'hi'" }] }] } }, words: {}, drawings: { main: { text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0"/>' } } } },
      blocks: {}, limits: { ...FORMAT } };
    const p = new Player(exp);
    ok(p.start().ok);
    eq(p.read('one', 'spoken'), { line: '', text: '', word: -1 });
    eq(p.send('one', 'press:x').fault?.code, 'E-NEEDS-MISSING');
  },
  async 'rich-text: without it the checker refuses its settings, rich-text bindings and richText fields; the engine stops at mount'() {
    const f = structuredClone(richFiles);
    f['experience.json'].needs = [];
    const r = checkExperience(mapSource(f), schemas());
    const paths = codes(r.diags).map(d => d.path);
    for (const p of ['addons.rich-text', 'bindings[0].rich-text', 'inputs.headline.contentType']) ok(paths.includes(p), `${p} in ${paths}`);
    const { experience } = loadExperience(mapSource(f), null);
    let code = null;
    try { code = new Player(experience).start().fault?.code ?? null; } catch (e) { code = e.code; }
    eq(code, 'E-NEEDS-MISSING');
    const good = loadExperience(mapSource(richFiles), null).experience;
    ok(new Player(good).start().ok, 'with rich-text in needs the fixture starts');
    eq(codes(checkExperience(mapSource(richFiles), schemas()).diags), []);
  },
  'rich-text: a richText value is refused without the capability\'s content type (E-NEEDS-MISSING)'() {
    const exp = { doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', inputs: { h: { kind: 'content', type: 'array', contentType: 'richText', initial: [{ text: 'Hi' }], items: { type: 'object', properties: { text: { type: 'string' } } } } }, story: { start: 'one', scenes: { one: 'one.json' } } },
      words: { en: {} }, data: {}, scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg' }, words: {}, drawings: { main: { text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0"/>' } } } },
      blocks: {}, limits: { ...FORMAT } };
    let code = null;
    try { code = new Player(exp).start().fault?.code ?? null; } catch (e) { code = e.code; }
    eq(code, 'E-NEEDS-MISSING');
  },
  async 'ladder: a package that needs fit and has a fits, limit or keep give-way rule needs ladder (checker and engine)'() {
    const dir = fixture('ladder-fixture');
    const bad = checkExperience(await edited(dir, { 'experience.json': withoutNeed('ladder') }), schemas());
    ok(codes(bad.diags).some(d => /ladder/.test(d.message)), JSON.stringify(bad.diags.slice(0, 3)));
    let code = null;
    try { new Player(loadExperience(await edited(dir, { 'experience.json': withoutNeed('ladder') }), null).experience); } catch (e) { code = e.code; }
    eq(code, 'E-NEEDS-MISSING');
    const good = checkExperience(await folderSource(dir), schemas());
    eq(codes(good.diags), []);
    // Baked (no fit): no ladder at play, so none is needed.
    const baked = checkExperience(await edited(dir, { 'experience.json': (t) => withoutNeed('ladder')(withoutNeed('fit')(t)) }), schemas());
    eq(codes(baked.diags).filter(d => /ladder/.test(d.message)), []);
  },
  'union of needs: a page that names none of the three carries none of their code, and the core carries no checker or kit loader'() {
    const core = coreFiles();
    for (const f of ['src/richtext.mjs', 'src/richtext-draw.mjs', 'web/richtext-web.mjs', 'src/ladder.mjs', 'src/ladder-draw.mjs', 'src/lines.mjs', 'src/words.mjs', 'web/captions-web.mjs',
      'schema/check-document.mjs', 'schema/drawing-check.mjs', 'schema/validate.mjs', 'src/load.mjs', 'src/kit.mjs']) ok(!core.includes(`engine/v2/${f}`), `the core carries ${f}`);
    ok(core.includes('engine/v2/src/read.mjs') && core.includes('engine/v2/schema/json-strict.mjs') && core.includes('engine/v2/schema/xml.mjs'), 'the core keeps the parsers');
    for (const [id, own] of Object.entries({ 'rich-text': ['src/richtext.mjs', 'src/richtext-draw.mjs', 'web/richtext-web.mjs'], ladder: ['src/ladder.mjs', 'src/ladder-draw.mjs'], lines: ['src/lines.mjs', 'src/words.mjs', 'web/captions-web.mjs'] })) {
      const [{ file }] = capabilityModules([id]);
      const files = bundle(ENTRY, [file]).files;
      for (const f of own) ok(files.includes(`engine/v2/${f}`), `${id} carries ${f}`);
    }
  },
  // ---------- item 2: checkers and kits ----------
  'the player\'s reader only parses: it refuses to check without the checkers, and reads no kit'() {
    let threw = false;
    try { readExperience(mapSource(richFiles), schemas()); } catch (e) { threw = /checkers/.test(e.message); }
    ok(threw, 'checking needs the checkers from src/load.mjs');
    const kitted = { 'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'k', kit: { id: 'a', version: '1.0.0' }, story: { start: 's', scenes: { s: { use: 's' } } } } };
    eq(readExperience(mapSource(kitted), null).diags.map(d => d.code), ['E-KIT-PIN']);
    const r = readExperience(mapSource(richFiles), null);
    ok(r.ok && r.experience.scenes.ad, 'a plain experience reads');
  },
  async 'kits flattened at pack time: the flattened studio ad is what the kit loader gives, without its drawings\' texts'() {
    const dir = path.join(repo, 'examples', '2.0-ad-studio', 'ad');
    const src = await folderSource(dir);
    const texts = {};
    const walk = (base, at) => { for (const e of fs.readdirSync(base, { withFileTypes: true })) { const p = path.join(base, e.name); const rel = at ? `${at}/${e.name}` : e.name; if (e.isDirectory()) walk(p, rel); else if (/\.(json|svg|csv)$/.test(e.name)) texts[rel] = fs.readFileSync(p, 'utf8'); } };
    walk(dir, '');
    walk(src.kitDir('studio-ad'), 'kits/studio-ad');
    const flat = flattenKit(texts);
    ok(!('kit' in flat) && !('own' in flat), 'no kit loader state');
    const loaded = loadExperience(src, null).experience;
    eq(Object.keys(flat.scenes).sort(), Object.keys(loaded.scenes).sort());
    eq(flat.doc, JSON.parse(JSON.stringify(loaded.doc)));
    for (const [id, sc] of Object.entries(loaded.scenes)) {
      eq(flat.scenes[id].doc, JSON.parse(JSON.stringify(sc.doc)));
      for (const [k, d] of Object.entries(sc.drawings)) eq(flat.scenes[id].drawings[k], { file: d.file });
    }
    for (const id of Object.keys(loaded.blocks)) eq(flat.blocks[id].doc, JSON.parse(JSON.stringify(loaded.blocks[id].doc)));
    // The flattened form plays: its drawings' texts come back from the files.
    const e = structuredClone(flat);
    for (const b of [...Object.values(e.scenes), ...Object.values(e.blocks)]) for (const d of Object.values(b.drawings)) d.text = texts[d.file];
    ok(new Player(e).start().ok);
  },
  async 'a packed kit experience carries the flattened form and no kit loader; a kit finding stops the pack'() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'e3-pack-'));
    try {
      const r = await pack(path.join(repo, 'examples', '2.0-ad-studio', 'ad'), out, { date: '2026-11-07T00:00:00Z' });
      ok(r.kitted, 'the page plays the flattened kit experience');
      ok(!r.files.includes('engine/v2/src/kit.mjs') && !r.files.includes('engine/v2/src/load.mjs'), r.files.join(' '));
      const html = fs.readFileSync(r.htmlPath, 'utf8');
      ok(html.includes('kitted:'), 'the page script holds the flattened experience');
      let refused = null;
      try { flattenKit({ 'experience.json': JSON.stringify({ format: 'hsvg/2.0', kind: 'experience', id: 'k', kit: { id: 'nowhere', version: '1.0.0' }, story: { start: 's', scenes: { s: { use: 's' } } } }) }); } catch (e) { refused = e.diags?.map(d => d.code); }
      eq(refused, ['E-KIT-PIN']);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  },
  // ---------- item 4: sizes ----------
  'sizes: the built core is under coreBundleBytes, each capability under capabilityBundleBytes; the source is measured too'() {
    const ids = capabilityModules(fs.readdirSync(path.join(v2, 'src', 'capabilities')).map(f => f.replace(/\.mjs$/, ''))).map(c => c.id);
    const built = engineSizes(ids);
    ok(!built.core.over, `core ${built.core.gzip9}`);
    for (const c of built.capabilities) ok(!c.over, `${c.id} ${c.gzip9}`);
    const source = engineSizes(['rich-text'], [], { source: true });
    ok(source.core.gzip9 > built.core.gzip9, 'the source, with its comments, is larger than the built bundle');
  },
  async 'sizes: the packer refuses when the core is over coreBundleBytes, as for a capability (E-ENGINE-SIZE)'() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'e3-size-'));
    try {
      const over = { core: { gzip9: 130000, max: 120000, over: true }, capabilities: [], modules: [] };
      let diags = null;
      try { await pack(fixture('lines-fixture'), out, { sizes: over }); } catch (e) { diags = e.diags; }
      eq(diags?.map(d => [d.code, d.limit]), [['E-ENGINE-SIZE', 'coreBundleBytes']]);
      const r = await pack(fixture('lines-fixture'), out, { sizes: over, acceptFindings: true });
      eq(r.accepted.map(d => d.code), ['E-ENGINE-SIZE']);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  },
  'the production build strips comments and keeps strings, templates, regular expressions and line breaks'() {
    const cases = [
      ['a = b / c / d; // x', 'a = b / c / d;'],
      ['x = /a\\/b[/]c/g.test(s) // y', 'x = /a\\/b[/]c/g.test(s)'],
      ['s = `a ${ {b:1}.b } // c` // d', 's = `a ${ {b:1}.b } // c`'],
      ['return /x/.test(y)', 'return /x/.test(y)'],
      ['q = "//no"; /* c\n */ z', 'q = "//no";\n z'],
      ['n = (a) / 2 /* half */', 'n = (a) / 2'],
      ["t = '/*' + `*/` // done", "t = '/*' + `*/`"],
    ];
    for (const [a, b] of cases) eq(stripComments(a).trimEnd(), b);
    let threw = false; try { stripComments('a = "open'); } catch { threw = true; }
    ok(threw, 'a broken source is refused, never guessed');
  },
  // ---------- item 7: the baked read-out ----------
  'the baked read-out: the derived frame carries the bake ladder\'s steps, and the drawing reads them at play'() {
    const f = ladderPlanFiles(90);
    const { experience } = loadExperience(mapSource(f), schemas());
    const out = bakePlans(experience, { date: '2026-11-07T00:00:00Z' });
    const frames = Object.entries(out.texts).filter(([k]) => /offer\/.*\.derived\.svg$/.test(k));
    ok(frames.length >= 4, `${frames.length} derived frames of the offer`);
    for (const [k, svg] of frames) {
      const r = out.receipts.find(x => x.subject === 'document:offer' && k.endsWith(`-${x.selected.size}.derived.svg`));
      eq(/<metadata>[^<]*"steps":"([^"]*)"/.exec(svg)?.[1], r.steps.map(x => `${x.rule}:${x.step}`).join(' '), k);
    }
    // The baked files check clean (the mark is a 2.0 mark of 6.6), and the baked page reads the steps at play.
    const files = { ...f, ...out.texts };
    eq(checkExperience(mapSource(files), schemas()).diags.filter(d => d.code.startsWith('E-')), []);
    const p = new Player(loadExperience(mapSource(files), schemas()).experience);
    ok(p.start().ok);
    const d = new Drawing(p);
    d.mountScene('ad', 'fill', parseSize('300x250'));
    d.paint();
    const lr = d.ladder?.['ad/offer'];
    eq(lr?.steps, [{ rule: 'copy-fits', step: 'short', times: 1 }]);
    ok(lr.baked, 'marked baked, so a layout choice never counts it as reduced');
    eq(lr.texts.map(t => [t.binding, t.text, t.outcome]), [['copy-text', 'Two for one', 'given-way']]);
    eq(d.layoutValue()['ad/offer'].steps, ['short'], 'the ambient layout value shows the baked steps');
  },
  // ---------- item 8: shell outputs in the host ----------
  async 'shell outputs: host.on hears a shell\'s declared output event, with no page wrapper'() {
    const exp = loadExperience(await folderSource(path.join(repo, 'examples', '2.0-ad-studio', 'studio')), null).experience;
    const p = new Player(exp);
    ok(p.start().ok);
    const host = hostApi(p);
    const heard = [];
    host.on('export', (e) => heard.push(e.name));
    let unknown = null;
    try { host.on('no-such-output', () => {}); } catch (e) { unknown = e.code; }
    eq(unknown, 'E-REF-UNKNOWN');
    ok(p.activate(p.shellId, 'export').ok);
    eq(heard, ['export']);
  },
  // ---------- item 9: a theme font the package does not carry ----------
  'a theme\'s type role naming a font the package does not carry is E-REF-UNKNOWN; a font resource passes'() {
    const f = structuredClone(richFiles);
    const exp = f['experience.json'];
    exp.themes.day = { ...exp.themes.day, typeRoles: { display: { font: 'bitter-700', fallback: 'Georgia, serif', byLanguage: { de: 'nowhere-400' } } } };
    const r = checkExperience(mapSource(f), schemas(), { only: ['roles'] });
    eq(codes(r.diags, 'E-REF-UNKNOWN').map(d => d.path), ['/themes/day/typeRoles/display/font', '/themes/day/typeRoles/display/byLanguage/de']);
    exp.resources = { ...(exp.resources || {}), 'bitter-700': { kind: 'font', file: 'fonts/bitter-700.woff2', family: 'Bitter', weight: 700 }, 'nowhere-400': { kind: 'image', file: 'x.png' } };
    const r2 = checkExperience(mapSource(f), schemas(), { only: ['roles'] });
    eq(codes(r2.diags, 'E-REF-UNKNOWN').map(d => [d.path, /not a font/.test(d.message)]), [['/themes/day/typeRoles/display/byLanguage/de', true]]);
  },
  // ---------- item 10: host.seat ----------
  async 'host.seat gives a seat to a filler through the seats port; an unknown seat or filler is refused'() {
    const exp = loadExperience(await folderSource(folder), null).experience;
    const LOCK = JSON.parse(fs.readFileSync(path.join(v2, 'modules', 'lock.json'), 'utf8'));
    const p = new Player(exp, { capabilities: { chess: modulePort({ lock: LOCK }), 'chess-opponent': modulePort({ lock: LOCK }), seats: modulePort({ lock: LOCK }) } });
    ok(p.start().ok);
    const host = hostApi(p);
    const seats = Object.keys(exp.doc.addons.seats.seats);
    const seat = seats.find(s => exp.doc.addons.seats.seats[s].fillers?.includes('human'));
    host.seat(seat, 'agent');
    eq(p.seats.occupant(seat).filler, null);
    host.seat(seat, 'human');
    eq(p.seats.occupant(seat).filler, 'human');
    const code = (fn) => { try { fn(); return null; } catch (e) { return e.code; } };
    eq(code(() => host.seat('nobody', 'human')), 'E-REF-UNKNOWN');
  },
};
