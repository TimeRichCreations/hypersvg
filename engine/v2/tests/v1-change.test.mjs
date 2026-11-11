// Change requests (9.10, A9.2). The change tool's eight checks, every target of check 4, rules on a copy,
// the new revision and its receipt, `make`, and play-time requests on the same path.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo, schemas, eq, ok } from './helpers.mjs';
import { applyChange, ledgerPath, besidePath, CHECKS } from '../tools/change/apply.mjs';
import { checkShape } from '../tools/change/request.mjs';
import { makeRequest, exposedValues } from '../tools/change/make.mjs';
import { requestAtPlay } from '../tools/change/play.mjs';
import { rightsTable } from '../tools/change/rights.mjs';
import { readFolder, memorySource, digestAt } from '../tools/change/folder.mjs';
import { quote } from '../tools/change/targets.mjs';
import { kitDigest } from '../check/kits.mjs';
import { literalOf } from '../src/kit.mjs';
import { folderSource, loadExperience } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { makeDocumentChecker } from '../schema/check-document.mjs';
import { Player } from '../src/story.mjs';

const FIXTURE = path.join(repo, 'engine', 'v2', 'tests', 'change-fixture');
const ADS = path.join(repo, 'examples', '2.0-kit-ads');
// The proof tests run on the kit ads (add-on tests: the ads come with the add-ons release) and on the core kit fixture
// (engine/v2/tests/kit-fixture), which the core release holds. Their core runs are named "core kit: ...".
const CASES = {
  ad: { root: ADS, dir: ['ads', 'ad-300x250'], kitDir: ['kits', 'ad-kit'], target: 'ad-300x250', kitId: 'ad-kit', kitInput: 'brand',
    word: 'headline', address: 'ad-300x250/open/headline@en', old: 'Rain? Bring it on.', short: 'Rain? Go!', long: 'Rain? Bring it on, friends!',
    other: 'marketer' },
  core: { root: path.join(repo, 'engine', 'v2', 'tests', 'kit-fixture'), dir: ['tales', 'fox-tale'], kitDir: ['kits', 'tale-kit'], target: 'fox-tale',
    kitId: 'tale-kit', kitInput: 'teller', word: 'heading', address: 'fox-tale/first/heading@en', old: 'Fox finds a feather.',
    short: 'Fox finds it.', long: 'Fox finds a feather by the old pond.', other: 'publisher' },
};
const caseCopy = (c) => { const d = tmp(); fs.cpSync(c.root, d, { recursive: true }); return { root: d, ad: path.join(d, ...c.dir), kit: path.join(d, ...c.kitDir) }; };
const NOW = '2026-11-07T10:00:00Z';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-v1-'));
// A copy of the kit ads (the kit beside the ads, as in the example) and of the fixture.
const adsCopy = () => { const d = tmp(); fs.cpSync(ADS, d, { recursive: true }); return { root: d, ad: path.join(d, 'ads', 'ad-300x250'), kit: path.join(d, 'kits', 'ad-kit') }; };
const fixtureCopy = () => { const d = tmp(); fs.cpSync(FIXTURE, d, { recursive: true }); return d; };
const digestOfFolder = async (dir, rel) => digestAt(memorySource(readFolder(dir), await folderSource(dir)), rel);
const snapshot = (dir) => { const out = {}; for (const [k, v] of readFolder(dir)) out[k] = v.toString('base64'); return JSON.stringify(out); };
const request = (target, expected, changes, by, extra = {}) => ({ format: 'hsvg/2.0', kind: 'change', id: extra.id ?? 'chg-1', at: 'edit', target, expected, by, reason: extra.reason ?? 'A test edit', changes });
const COPY = { source: 'agent', right: 'copywriter', who: 'agent:rio' };
const as = (right, who = 'person:mk') => ({ source: 'editor', right, who });
// The test is the authenticator (9.10): it gives the request's by as the authenticated one (Y3: apply never trusts
// a request's own by).
const apply = (dir, req, opts = {}) => applyChange(dir, req, { schemas: schemas(), now: NOW, by: req?.by, ...opts });
const codes = (r) => (r.receipt.errors || []).map(e => e.code);
const failedAt = (r) => Object.entries(r.receipt.verdicts).find(([, v]) => v === 'fail')?.[0];

// The proof headline request of the brief: an ad gets a shorter headline from a copywriter.
async function headlineRequest(ad, id = 'chg-short', by = COPY, text = 'Rain? Go!', c = CASES.ad) {
  return request(c.target, await digestOfFolder(ad, 'experience.json'), [{ address: c.address, old: c.old, new: text }], by, { id, reason: 'Shorter headline for the small sizes' });
}

// The proof tests, for one case of CASES.
const proof = {
  async refused(c) {
    const { ad } = caseCopy(c);
    const before = snapshot(ad);
    const r = await apply(ad, { format: 'hsvg/2.0', kind: 'change', id: 'chg-x', at: 'edit', target: c.target, changes: [] });
    eq([r.receipt.status, failedAt(r), r.receipt.verdicts.replay], ['fail', 'shape', 'not-run']);
    ok(codes(r).every(x => x === 'E-CHANGE-SHAPE'));
    eq(snapshot(ad), before);
  },
  async passes(c) {
    const { ad } = caseCopy(c);
    const req = await headlineRequest(ad, 'chg-short', COPY, c.short, c);
    const reqPath = path.join(path.dirname(ad), 'chg-short.json');
    fs.writeFileSync(reqPath, JSON.stringify(req));
    const r = await apply(ad, req, { requestPath: reqPath });
    const rc = r.receipt;
    eq([rc.status, rc.run, rc.subject, rc.id], ['pass', 'change', `document:${c.target}`, 'chg-short']);
    eq(rc.previous, req.expected);
    ok(rc.digest !== rc.previous, 'the digest changes');
    eq(rc.digest, await digestOfFolder(ad, 'experience.json'));
    for (const x of CHECKS) eq(rc.verdicts[x], 'pass', x);
    eq(rc.verdicts.review, 'candidate');
    eq([rc.by, rc.changes], [COPY, req.changes]);
    eq(r.written, ['experience.json', 'words/en.csv']);
    ok(fs.readFileSync(path.join(ad, 'words', 'en.csv'), 'utf8').includes(`${c.word},${c.short}`));
    // The words file's resource digest follows the file, and the checker still finds nothing.
    const after = checkExperience(await folderSource(ad), schemas());
    eq(after.diags.filter(d => d.code.startsWith('E-')), []);
    // The receipt is a valid receipt document, beside the request and in the evidence.
    eq(makeDocumentChecker(schemas()).check(rc, {}).diags, []);
    eq(JSON.parse(fs.readFileSync(besidePath(reqPath), 'utf8')), rc);
    eq(JSON.parse(fs.readFileSync(ledgerPath(ad, c.target, 'chg-short'), 'utf8')), rc);
  },
  async noRight(c) {
    const { ad } = caseCopy(c);
    const before = snapshot(ad);
    const r = await apply(ad, await headlineRequest(ad, 'chg-short', { source: 'agent', right: c.other, who: 'agent:rio' }, c.short, c));
    eq([r.receipt.status, failedAt(r), codes(r)], ['fail', 'rights', ['E-RIGHTS']]);
    eq(r.receipt.digest, r.receipt.previous);
    eq(snapshot(ad), before);
  },
  async stale(c) {
    const { ad } = caseCopy(c);
    const req = await headlineRequest(ad, 'chg-short', COPY, c.short, c);
    const r = await apply(ad, { ...req, expected: `sha256:${'1'.repeat(64)}` });
    eq([failedAt(r), codes(r)], ['revision', ['E-CHANGE-STALE']]);
    const r2 = await apply(ad, { ...req, id: 'chg-old', changes: [{ ...req.changes[0], old: 'Not the word on disk.' }] });
    eq([failedAt(r2), codes(r2)], ['revision', ['E-CHANGE-STALE']]);
  },
  async rule(c) {
    const { ad } = caseCopy(c);
    const file = path.join(ad, 'experience.json');
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.rules = [{ id: `${c.word}-short`, kind: 'limit', subject: `input:${c.word}`, maxLength: 20, waivableBy: [c.other] }];
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
    const r = await apply(ad, await headlineRequest(ad, 'chg-long', COPY, c.long, c));
    eq([failedAt(r), codes(r)], ['rules', ['E-RULE']]);
    ok(r.receipt.errors[0].message.includes(`${c.target}/${c.word}-short`), 'names the rule');
    // The right that may waive the rule saves a waiver through the same protocol, then the long words pass.
    const waiver = { rule: `${c.target}/${c.word}-short`, subject: `input:${c.word}`, reason: 'The campaign line is approved for this run.', by: c.other };
    const w = await apply(ad, request(c.target, await digestOfFolder(ad, 'experience.json'), [{ address: `${c.target}/waivers`, new: waiver }], as(c.other), { id: 'chg-waiver' }));
    eq(w.receipt.status, 'pass');
    eq(JSON.parse(fs.readFileSync(file, 'utf8')).waivers, [waiver]);
    const r2 = await apply(ad, await headlineRequest(ad, 'chg-long-2', COPY, c.long, c));
    eq(r2.receipt.status, 'pass');
    eq(r2.receipt.rules, [{ rule: `${c.target}/${c.word}-short`, result: 'waived', proof: 'files', detail: `The campaign line is approved for this run. (${c.other})` }]);
  },
  async kitRename(c) {
    const { kit } = caseCopy(c);
    const kitDoc = JSON.parse(fs.readFileSync(path.join(kit, 'kit.json'), 'utf8'));
    const decl = kitDoc.inputs[c.kitInput];
    const rename = request(c.kitId, await digestOfFolder(kit, 'kit.json'), [
      { address: `kit.json#/inputs/${c.kitInput}`, old: decl, new: null },
      { address: `kit.json#/inputs/${c.kitInput}Label`, new: decl },
    ], as('designer'), { id: 'kit-rename', reason: 'Clearer name for the input' });
    const no = await apply(kit, { ...rename, id: 'kit-rename-copy' }, { by: as('copywriter') });
    eq([failedAt(no), codes(no)], ['rights', ['E-RIGHTS', 'E-RIGHTS']]);
    const r = await apply(kit, rename);
    eq(r.receipt.status, 'pass');
    const after = JSON.parse(fs.readFileSync(path.join(kit, 'kit.json'), 'utf8'));
    eq([Object.keys(after.inputs), after.inputs[`${c.kitInput}Label`]], [[`${c.kitInput}Label`], decl]);
    // The version change comes last; its expected is the previous receipt's digest.
    const v = await apply(kit, request(c.kitId, r.receipt.digest, [{ address: 'kit.json#/about/version', old: '1.0.0', new: '2.0.0' }], as('designer'), { id: 'kit-version', reason: 'Renamed input: a major version' }));
    eq([v.receipt.status, v.receipt.previous], ['pass', r.receipt.digest]);
    eq(JSON.parse(fs.readFileSync(path.join(kit, 'kit.json'), 'utf8')).about.version, '2.0.0');
  },
  async replay(c) {
    const { ad } = caseCopy(c);
    const req = await headlineRequest(ad, 'chg-short', COPY, c.short, c);
    const first = await apply(ad, req);
    const before = snapshot(ad);
    const again = await apply(ad, req, { now: '2026-11-08T10:00:00Z' });
    eq([again.replayed, again.receipt, again.written], [true, first.receipt, []]);
    eq(snapshot(ad), before);
    const other = await apply(ad, { ...req, changes: [{ ...req.changes[0], new: 'Something else' }] });
    eq([failedAt(other), codes(other)], ['replay', ['E-CHANGE-SHAPE']]);
    // A refused request's first receipt comes back too, from beside the request.
    const reqPath = path.join(path.dirname(ad), 'bad.json');
    const bad = { ...req, id: 'chg-bad', by: { source: 'agent', right: c.other, who: 'agent:rio' } };
    const f1 = await apply(ad, bad, { requestPath: reqPath });
    const f2 = await apply(ad, bad, { requestPath: reqPath, now: '2026-11-09T10:00:00Z' });
    eq([f2.replayed, f2.receipt], [true, f1.receipt]);
  },
};

export const tests = {
  // ---------- check 1 ----------
  'shape: every failure of a request is reported with E-CHANGE-SHAPE'() {
    const bad = { format: 'hsvg/2.0', kind: 'change', id: 'Bad Id', at: 'later', target: 'x', expected: 'sha256:1', by: { source: 'robot', who: 'nobody' }, reason: 'r'.repeat(501), changes: [], extra: 1 };
    const d = checkShape(bad, schemas());
    ok(d.every(x => x.code === 'E-CHANGE-SHAPE'), 'one code');
    const paths = d.map(x => x.path);
    for (const p of ['/id', '/at', '/reason', '/by/source', '/by/who', '/changes', '/extra']) ok(paths.includes(p), `reports ${p}: ${paths}`);
    eq(checkShape({ ...bad, at: 'edit' }, schemas()).filter(x => x.path === '/expected').length, 1);
    eq(checkShape({ format: 'hsvg/2.0', kind: 'change', id: 'ok', at: 'edit', target: 'x', expected: `sha256:${'0'.repeat(64)}`, by: COPY, reason: 'why', changes: [{ address: 'x/a', old: 1, new: 2 }] }, schemas()), []);
    const missingNew = checkShape({ format: 'hsvg/2.0', kind: 'change', id: 'ok', at: 'play', target: 'x', expected: 3, changes: [{ address: 'x/a', old: 1 }] }, schemas());
    eq(missingNew.map(x => x.path), ['/changes/0/new']);
  },
  async 'shape: a refused request writes nothing and its receipt says which check failed'() { await proof.refused(CASES.ad); },
  async 'core kit: shape: a refused request writes nothing and its receipt says which check failed'() { await proof.refused(CASES.core); },

  // ---------- the proof of the brief ----------
  async 'proof: a copywriter shortens an ad headline; it passes, the digest changes, the receipt lists every check'() { await proof.passes(CASES.ad); },
  async 'core kit: proof: a copywriter shortens a story heading; it passes, the digest changes, the receipt lists every check'() { await proof.passes(CASES.core); },
  async 'proof: the same request without the right is E-RIGHTS, and nothing is written'() { await proof.noRight(CASES.ad); },
  async 'core kit: proof: the same request without the right is E-RIGHTS, and nothing is written'() { await proof.noRight(CASES.core); },
  async 'proof: with a stale expected it is E-CHANGE-STALE; a stale old is too'() { await proof.stale(CASES.ad); },
  async 'core kit: proof: with a stale expected it is E-CHANGE-STALE; a stale old is too'() { await proof.stale(CASES.core); },
  async 'proof: a headline that breaks a must rule is E-RULE, and passes once a waiver covers it'() { await proof.rule(CASES.ad); },
  async 'core kit: proof: a heading that breaks a must rule is E-RULE, and passes once a waiver covers it'() { await proof.rule(CASES.core); },
  async 'proof: a kit change renames an input, then moves the kit version'() { await proof.kitRename(CASES.ad); },
  async 'core kit: proof: a kit change renames an input, then moves the kit version'() { await proof.kitRename(CASES.core); },

  // ---------- check 2 ----------
  async 'replay: a retry with the same id returns the first receipt and writes nothing; other content is E-CHANGE-SHAPE'() { await proof.replay(CASES.ad); },
  async 'core kit: replay: a retry with the same id returns the first receipt and writes nothing; other content is E-CHANGE-SHAPE'() { await proof.replay(CASES.core); },

  // ---------- check 4: every target ----------
  async 'reach: kit inputs and literal scene inputs are written into with as plain words; formulas, inner paths and unknown names are refused'() {
    const { ad } = adsCopy();
    const d = await digestOfFolder(ad, 'experience.json');
    const r = await apply(ad, request('ad-300x250', d, [{ address: 'ad-300x250/open/price', old: '£24', new: "£19 'a'" }], as('marketer'), { id: 'chg-price' }));
    eq(r.receipt.status, 'pass');
    const doc = JSON.parse(fs.readFileSync(path.join(ad, 'experience.json'), 'utf8'));
    eq(doc.story.scenes.open.with.price, "'£19 \\'a\\''", 'a text input takes a formula, quoted (D36)');
    const d2 = r.receipt.digest;
    const b = await apply(ad, request('ad-300x250', d2, [{ address: 'ad-300x250/brand', old: 'Rain Gear Co.', new: 'Harbour Rain' }], COPY, { id: 'chg-brand' }));
    eq(b.receipt.status, 'pass');
    eq(JSON.parse(fs.readFileSync(path.join(ad, 'experience.json'), 'utf8')).with.brand, "'Harbour Rain'");
    const d3 = b.receipt.digest;
    const formula = await apply(ad, request('ad-300x250', d3, [{ address: 'ad-300x250/open/headline', old: 'Rain? Bring it on.', new: 'Hi' }], COPY, { id: 'chg-f' }));
    // A `with` that reads a word is not a literal, so it cannot be edited there (4.7 rule 8); its word can (@en).
    eq([failedAt(formula), codes(formula)], ['rights', ['E-RIGHTS']]);
    const noOld = await apply(ad, request('ad-300x250', d3, [{ address: 'ad-300x250/open/headline', new: 'Hi' }], COPY, { id: 'chg-f2' }));
    eq([failedAt(noOld), codes(noOld)], ['rights', ['E-RIGHTS']]);
    const reach = await apply(ad, request('ad-300x250', d3, [
      { address: 'ad-300x250/open/headline-use/text', old: 'x', new: 'y' },
      { address: 'ad-300x250/open/nothing', old: 'x', new: 'y' },
      { address: 'other-ad/brand', old: 'x', new: 'y' },
      { address: 'ad-300x250/open/headline@xx-', old: 'x', new: 'y' },
    ], COPY, { id: 'chg-reach' }));
    eq([failedAt(reach), codes(reach)], ['reach', ['E-SEAL', 'E-REF-UNKNOWN', 'E-REF-UNKNOWN', 'E-REF-UNKNOWN']]);
  },
  async 'reach: type and bounds are checked, never clamped'() {
    const dir = fixtureCopy();
    const d = await digestOfFolder(dir, 'experience.json');
    const r = await apply(dir, request('change-fixture', d, [
      { address: 'change-fixture/speed', old: 2, new: 2.5 },
      { address: 'change-fixture/speed', old: 2, new: 9 },
      { address: 'change-fixture/speed', old: 2, new: 'fast' },
    ], as('designer')));
    eq([failedAt(r), codes(r)], ['type', ['E-RANGE', 'E-RANGE', 'E-TYPE']]);
    const t = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/headline', old: 'Fresh bread', new: 'x'.repeat(21) }], as('copywriter'), { id: 'chg-2' }));
    eq(codes(t), ['E-RANGE']);
  },
  async 'reach: an input of an experience made without a kit is written in its initial; @<tag> reaches one language'() {
    const dir = fixtureCopy();
    const d = await digestOfFolder(dir, 'experience.json');
    const r = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/headline@en', old: 'Fresh bread', new: 'Warm rolls' }, { address: 'change-fixture/speed', old: 2, new: 3 }], as('copywriter')));
    // The copywriter may edit the headline but not the speed.
    eq([failedAt(r), codes(r)], ['rights', ['E-RIGHTS']]);
    const ok2 = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/headline@en', old: 'Fresh bread', new: 'Warm rolls' }], as('copywriter'), { id: 'chg-2' }));
    eq(ok2.receipt.status, 'pass');
    const doc = JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8'));
    eq(doc.inputs.headline.initial, 'Warm rolls');
    // The trust record's digest follows the document.
    eq(doc.about.trust.digest, ok2.receipt.digest);
    const de = await apply(dir, request('change-fixture', ok2.receipt.digest, [{ address: 'change-fixture/headline@de', old: 'x', new: 'y' }], as('copywriter'), { id: 'chg-3' }));
    eq(codes(de), ['E-REF-UNKNOWN']);
  },
  async 'reach: a waiver is added and removed; its right is the rule\'s waivableBy'() {
    const dir = fixtureCopy();
    const d = await digestOfFolder(dir, 'experience.json');
    const w = { rule: 'change-fixture/headline-short', reason: 'Seasonal line', by: 'brand-owner' };
    const no = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/waivers', new: { ...w, by: 'copywriter' } }], as('copywriter')));
    eq(codes(no), ['E-RIGHTS']);
    const bad = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/waivers', new: { rule: 'change-fixture/headline-short', by: 'brand-owner' } }], as('brand-owner'), { id: 'chg-1b' }));
    eq(codes(bad)[0], 'E-TYPE');
    const add = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/waivers', new: w }], as('brand-owner'), { id: 'chg-2' }));
    eq(add.receipt.status, 'pass');
    const twice = await apply(dir, request('change-fixture', add.receipt.digest, [{ address: 'change-fixture/waivers', new: w }], as('brand-owner'), { id: 'chg-3' }));
    eq(codes(twice), ['E-CHANGE-STALE']);
    const rm = await apply(dir, request('change-fixture', add.receipt.digest, [{ address: 'change-fixture/waivers', old: w, new: null }], as('brand-owner'), { id: 'chg-4' }));
    eq(rm.receipt.status, 'pass');
    eq(JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8')).waivers, undefined);
    eq(rm.receipt.digest, d);
  },
  async 'reach: a review is appended, keeps the digest, needs review, and only a person accepts'() {
    const dir = fixtureCopy();
    const d = await digestOfFolder(dir, 'experience.json');
    const review = (status, by) => ({ status, by, date: '2026-11-07', digest: d, note: 'Checked at its one size.' });
    const no = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/review', new: review('candidate', 'agent:sol') }], as('copywriter')));
    eq(codes(no), ['E-RIGHTS']);
    const agent = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/review', new: review('accepted', 'agent:sol') }], { source: 'agent', right: 'reviewer', who: 'agent:sol' }, { id: 'chg-2' }));
    eq(codes(agent), ['E-TRUST-REVIEW']);
    const old = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/review', old: null, new: review('candidate', 'agent:sol') }], as('reviewer'), { id: 'chg-3' }));
    eq(codes(old), ['E-CHANGE-STALE']);
    const r = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/review', new: review('accepted', 'person:mk') }], as('reviewer'), { id: 'chg-4' }));
    eq([r.receipt.status, r.receipt.digest, r.receipt.verdicts.review], ['pass', d, 'accepted']);
    eq(JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8')).about.trust.review.length, 1);
  },
  async 'reach: a kit pin moves by publish, and the full checker runs on the copy'() {
    const { ad, kit } = adsCopy();
    const d = await digestOfFolder(ad, 'experience.json');
    const kd = kitDigest(await folderSource(ad), loadExperience(await folderSource(ad), schemas()).experience.kit);
    eq(kd, await digestOfFolder(kit, 'kit.json'));
    const pin = { id: 'ad-kit', version: '1.0.0' };
    const no = await apply(ad, request('ad-300x250', d, [{ address: 'ad-300x250/kit', old: pin, new: { ...pin, digest: kd } }], COPY));
    eq(codes(no), ['E-RIGHTS']);
    const wrong = await apply(ad, request('ad-300x250', d, [{ address: 'ad-300x250/kit', old: pin, new: { ...pin, digest: `sha256:${'2'.repeat(64)}` } }], as('marketer'), { id: 'chg-2' }));
    eq([failedAt(wrong), codes(wrong)], ['rules', ['E-KIT-PIN']]);
    const shape = await apply(ad, request('ad-300x250', d, [{ address: 'ad-300x250/kit', old: pin, new: { id: 'other-kit', version: '1.0.0-draft.1' } }], as('marketer'), { id: 'chg-3' }));
    eq(codes(shape), ['E-TYPE', 'E-TYPE']);
    const r = await apply(ad, request('ad-300x250', d, [{ address: 'ad-300x250/kit', old: pin, new: { ...pin, digest: kd } }], as('marketer'), { id: 'chg-4' }));
    eq(r.receipt.status, 'pass');
    eq(JSON.parse(fs.readFileSync(path.join(ad, 'experience.json'), 'utf8')).kit, { ...pin, digest: kd });
  },
  async 'reach: a pointer change adds, replaces, removes and renames, with edit rights, checked by the schema'() {
    const dir = fixtureCopy();
    let d = await digestOfFolder(dir, 'experience.json');
    const step = async (changes, by, id) => { const r = await apply(dir, request('change-fixture', d, changes, by, { id })); if (r.receipt.status === 'pass') d = r.receipt.digest; return r; };
    eq(codes(await step([{ address: 'experience.json#/inputs/speed/maximum', old: 5, new: 6 }], as('reviewer'), 'p-0')), ['E-RIGHTS']);
    eq((await step([{ address: 'experience.json#/inputs/speed/maximum', old: 5, new: 6 }], as('designer'), 'p-1')).receipt.status, 'pass');
    eq((await step([{ address: 'experience.json#/values/bonus', new: { type: 'number', initial: 0, minimum: 0, maximum: 10 } }], as('designer'), 'p-2')).receipt.status, 'pass');
    const start = { kind: 'trigger' };
    eq((await step([{ address: 'experience.json#/inputs/start', old: start, new: null }, { address: 'experience.json#/inputs/go', new: start }], as('designer'), 'p-3')).receipt.status, 'pass');
    const doc = JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8'));
    eq([doc.inputs.speed.maximum, doc.values.bonus, 'start' in doc.inputs, doc.inputs.go], [6, { type: 'number', initial: 0, minimum: 0, maximum: 10 }, false, start]);
    const t = await step([{ address: 'experience.json#/inputs/speed/kind', old: 'knob', new: 'dial' }], as('designer'), 'p-4');
    eq(failedAt(t), 'type');
    eq(codes(await step([{ address: 'experience.json#/nothing/here', new: 1 }], as('designer'), 'p-5')), ['E-REF-UNKNOWN']);
    eq(codes(await step([{ address: 'scenes/one/scene.json#/drawing', old: 'one.svg', new: 'two.svg' }], as('designer'), 'p-6')), ['E-REF-UNKNOWN']);
    // A change that breaks the experience (a scene the story needs) is refused by the checker's own code.
    const broken = await step([{ address: 'experience.json#/story/start', old: 'one', new: 'two' }], as('designer'), 'p-7');
    eq(failedAt(broken), 'rules');
  },
  async 'reach: a scene document of the folder is its own target; its inputs and promotions are written there'() {
    const dir = fixtureCopy();
    const file = path.join(dir, 'scenes', 'one', 'scene.json');
    const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
    scene.inputs = { tone: { kind: 'knob', type: 'string', enum: ['warm', 'cool'], initial: 'warm', editableBy: ['designer'] } };
    fs.writeFileSync(file, JSON.stringify(scene, null, 2));
    const d = await digestOfFolder(dir, 'scenes/one/scene.json');
    const r = await apply(dir, request('one', d, [{ address: 'one/tone', old: 'warm', new: 'cool' }], as('designer')));
    eq(r.receipt.status, 'pass');
    eq(JSON.parse(fs.readFileSync(file, 'utf8')).inputs.tone.initial, 'cool');
    const e = await apply(dir, request('one', r.receipt.digest, [{ address: 'one/tone', old: 'cool', new: 'hot' }], as('designer'), { id: 'chg-2' }));
    eq(codes(e), ['E-RANGE']);
  },

  // ---------- check 7 ----------
  async 'rules: limit rules on values, should notes, playing rules not-run, give-way untouched'() {
    const dir = fixtureCopy();
    const d = await digestOfFolder(dir, 'experience.json');
    const r = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/headline', old: 'Fresh bread', new: 'Warm rolls' }], as('copywriter')));
    eq(r.receipt.status, 'pass');
    eq(r.receipt.rules.map(x => [x.rule, x.result]), [['change-fixture/headline-short', 'pass'], ['change-fixture/headline-upper', 'note'], ['change-fixture/keys', 'not-run']]);
    const long = await apply(dir, request('change-fixture', r.receipt.digest, [{ address: 'change-fixture/headline', old: 'Warm rolls', new: 'Warm rolls and buns' }], as('copywriter'), { id: 'chg-2' }));
    eq([failedAt(long), codes(long)], ['rules', ['E-RULE']]);
  },
  async 'rules: a budget the checker proves on the copy refuses the change, naming the rule'() {
    const dir = fixtureCopy();
    const file = path.join(dir, 'experience.json');
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.rules.push({ id: 'small-data', kind: 'budget', measure: 'tableRows', on: 'data:rows', maximum: 2 });
    doc.resources = { rows: { kind: 'data', file: 'rows.json' } };
    doc.data = { rows: { resource: 'rows', columns: { n: { type: 'number' } } } };
    fs.writeFileSync(path.join(dir, 'rows.json'), '[{"n": 1}, {"n": 2}]');
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
    const d = await digestOfFolder(dir, 'experience.json');
    const pass = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/headline', old: 'Fresh bread', new: 'Warm rolls' }], as('copywriter')));
    eq(pass.receipt.rules.find(x => x.rule === 'change-fixture/small-data').result, 'pass');
    // The data file is declared by the document, so a third row would change its digest: a pointer change adds a
    // second data table over the same rows, which stays in budget; a new file of three rows does not.
    fs.writeFileSync(path.join(dir, 'rows.json'), '[{"n": 1}, {"n": 2}, {"n": 3}]');
    const d2 = await digestOfFolder(dir, 'experience.json');
    const over = await apply(dir, request('change-fixture', d2, [{ address: 'change-fixture/headline', old: 'Warm rolls', new: 'Hot rolls' }], as('copywriter'), { id: 'chg-2' }));
    eq([failedAt(over), codes(over)], ['rules', ['E-RULE']]);
    ok(over.receipt.errors[0].message.includes('change-fixture/small-data'), over.receipt.errors[0].message);
  },

  // ---------- check 8 and --out ----------
  async 'apply: with --out the new revision goes to another folder and the source stays as it was'() {
    const dir = fixtureCopy();
    const out = tmp();
    const before = snapshot(dir);
    const d = await digestOfFolder(dir, 'experience.json');
    const r = await apply(dir, request('change-fixture', d, [{ address: 'change-fixture/headline', old: 'Fresh bread', new: 'Warm rolls' }], as('copywriter')), { out });
    eq(r.receipt.status, 'pass');
    eq(snapshot(dir), before);
    eq(JSON.parse(fs.readFileSync(path.join(out, 'experience.json'), 'utf8')).inputs.headline.initial, 'Warm rolls');
    ok(fs.existsSync(path.join(out, 'scenes', 'one', 'one.svg')), 'the whole folder is in --out');
    eq(r.receipt.digest, await digestOfFolder(out, 'experience.json'));
  },

  // ---------- the rights table and digests ----------
  async 'core kit: rights: the table of a kit experience'() {
    const { ad } = caseCopy(CASES.core);
    const t = rightsTable(loadExperience(await folderSource(ad), schemas()).experience);
    eq([t.kit, t.edit['fox-tale/teller'], t.edit['fox-tale/first/pageNumber'], t.edit['fox-tale/last/step']], [{ id: 'tale-kit', version: '1.0.0' }, ['copywriter'], ['publisher'], ['designer']]);
    eq(t.abilities, { edit: ['designer', 'copywriter', 'publisher'], review: [], publish: ['publisher'], changeKit: ['designer'] });
  },
  async 'rights: the table of a kit experience and of an experience made without a kit'() {
    const { ad } = adsCopy();
    const t = rightsTable(loadExperience(await folderSource(ad), schemas()).experience);
    eq(Object.keys(t), ['kit', 'edit', 'waive', 'abilities', 'seats']);
    eq([t.kit, t.edit['ad-300x250/brand'], t.edit['ad-300x250/open/price'], t.edit['ad-300x250/rest/beat']], [{ id: 'ad-kit', version: '1.0.0' }, ['copywriter'], ['marketer'], ['designer']]);
    eq(t.abilities, { edit: ['designer', 'copywriter', 'marketer'], review: [], publish: ['marketer'], changeKit: ['designer'] });
    const f = rightsTable(loadExperience(await folderSource(FIXTURE), schemas()).experience);
    eq([f.experience, f.edit, f.waive], ['change-fixture', { 'change-fixture/headline': ['copywriter'], 'change-fixture/speed': ['designer'] }, { 'change-fixture/headline-short': ['brand-owner'] }]);
  },
  'digest: the worked example of A9.3, and quoted literals read back'() {
    const files = new Map([['quiet.json', Buffer.from(JSON.stringify({ format: 'hsvg/2.0', kind: 'rule-pack', id: 'quiet-pack', about: { title: 'Quiet', version: '1.0.0', trust: { digest: 'x' } }, rules: [{ id: 'no-sound', kind: 'budget', measure: 'soundBytes', maximum: 0 }] }))]]);
    eq(digestAt(memorySource(files), 'quiet.json'), 'sha256:c70b3e81616e3cba79366ec2d6367473955e766f7c5037cf9d0139bdd5202810');
    for (const s of ["Rain? Go!", "it's \\ here", 'two\nlines', '£19']) eq(literalOf(quote(s)).value, s);
  },

  // ---------- make ----------
  async 'make: a request from two folders, and from a studio\'s edited values; it applies'() {
    const { ad } = adsCopy();
    const after = tmp();
    fs.cpSync(ad, after, { recursive: true });
    fs.writeFileSync(path.join(after, 'words', 'en.csv'), 'id,text\nheadline,Rain? Go!\n');
    const kitHome = path.join(path.dirname(path.dirname(ad)), 'kits');
    const aside = path.join(after, 'kits');
    fs.cpSync(kitHome, aside, { recursive: true });
    const req = await makeRequest(ad, after, { schemas: schemas(), id: 'chg-made', by: COPY, reason: 'Shorter headline' });
    eq(req.changes, [{ address: 'ad-300x250/open/headline@en', old: 'Rain? Bring it on.', new: 'Rain? Go!' }]);
    eq(req.expected, await digestOfFolder(ad, 'experience.json'));
    const fromValues = await makeRequest(ad, { 'ad-300x250/open/headline@en': 'Rain? Go!', 'ad-300x250/brand': 'Rain Gear Co.' }, { schemas: schemas(), id: 'chg-made', by: COPY, reason: 'Shorter headline' });
    eq(fromValues, req);
    const v = (await exposedValues(ad, schemas())).values;
    eq([v['ad-300x250/brand'], v['ad-300x250/open/price'], v['ad-300x250/close/headline@en']], ['Rain Gear Co.', '£24', 'Rain? Bring it on.']);
    eq((await apply(ad, req)).receipt.status, 'pass');
  },

  // ---------- play time: one path ----------
  async 'play: the same request shape refused at edit time is refused at play time for the same reason'() {
    const dir = fixtureCopy();
    const d = await digestOfFolder(dir, 'experience.json');
    const exp = loadExperience(await folderSource(dir), schemas()).experience;
    const player = new Player(structuredClone(exp), {});
    player.start();
    const cases = [
      ['no changes', [], 'E-CHANGE-SHAPE'],
      ['a change with no new', [{ address: 'change-fixture/headline', old: 'Fresh bread' }], 'E-CHANGE-SHAPE'],
      ['the wrong type', [{ address: 'change-fixture/headline', old: 'Fresh bread', new: 42 }], 'E-TYPE'],
      ['too long', [{ address: 'change-fixture/headline', old: 'Fresh bread', new: 'x'.repeat(21) }], 'E-RANGE'],
      ['off the step', [{ address: 'change-fixture/speed', old: 2, new: 2.5 }], 'E-RANGE'],
      ['above the maximum', [{ address: 'change-fixture/speed', old: 2, new: 6 }], 'E-RANGE'],
      ['an unknown input', [{ address: 'change-fixture/colour', old: 'red', new: 'blue' }], 'E-REF-UNKNOWN'],
      ['an inner path', [{ address: 'change-fixture/one/button/label', old: 'a', new: 'b' }], 'E-SEAL'],
      ['a stale old', [{ address: 'change-fixture/headline', old: 'Stale bread', new: 'Warm rolls' }], 'E-CHANGE-STALE'],
    ];
    for (const [name, changes, code] of cases) {
      const edit = await apply(dir, { format: 'hsvg/2.0', kind: 'change', id: 'same-shape', at: 'edit', target: 'change-fixture', expected: d, by: as('designer'), reason: name, changes });
      const play = requestAtPlay(player, { format: 'hsvg/2.0', kind: 'change', id: `same-shape-${cases.findIndex(c => c[0] === name)}`, at: 'play', target: 'change-fixture', expected: player.state.revision, by: { source: 'host', who: 'host' }, changes }, { schemas: schemas(), now: NOW });
      eq([name, edit.receipt.status, codes(edit)[0]], [name, 'fail', code]);
      eq([name, play.status, play.errors[0].code], [name, 'fail', code]);
      eq([name, failedAt(edit)], [name, Object.entries(play.verdicts).find(([, v]) => v === 'fail')[0]]);
      fs.rmSync(path.join(dir, 'evidence'), { recursive: true, force: true });
    }
    eq(player.state.blocks.experience.inputs.headline, 'Fresh bread');
  },
  async 'play: a passing request commits one transaction; a retry returns the first receipt; body values are private'() {
    const exp = loadExperience(await folderSource(FIXTURE), schemas()).experience;
    const player = new Player(structuredClone(exp), {});
    player.start();
    const rev = player.state.revision;
    const req = { format: 'hsvg/2.0', kind: 'change', id: 'play-1', at: 'play', target: 'change-fixture', expected: rev, by: { source: 'host', who: 'host' }, changes: [{ address: 'change-fixture/headline', old: 'Fresh bread', new: 'Warm rolls' }, { address: 'change-fixture/speed', old: 2, new: 4 }] };
    const r = requestAtPlay(player, req, { schemas: schemas(), now: NOW });
    eq([r.status, r.previous, r.digest], ['pass', `revision:${rev}`, `revision:${rev + 1}`]);
    eq([player.state.blocks.experience.inputs.headline, player.state.blocks.experience.inputs.speed, player.state.revision], ['Warm rolls', 4, rev + 1]);
    eq(requestAtPlay(player, req, { schemas: schemas(), now: '2026-11-08T00:00:00Z' }), r);
    eq(player.state.revision, rev + 1);
    const stale = requestAtPlay(player, { ...req, id: 'play-2' }, { schemas: schemas() });
    eq(stale.errors.map(e => e.code), ['E-CHANGE-STALE', 'E-CHANGE-STALE', 'E-CHANGE-STALE']);
    const body = requestAtPlay(player, { ...req, id: 'play-3', expected: undefined, changes: [{ address: 'change-fixture/score', old: 0, new: 5 }] }, { schemas: schemas() });
    eq(body.errors.map(e => e.code), ['E-HOST-PRIVATE']);
    const seat = requestAtPlay(player, { ...req, id: 'play-4', expected: undefined, by: { source: 'seat', right: 'white', who: 'seat:white' }, changes: [{ address: 'change-fixture/speed', old: 4, new: 5 }] }, { schemas: schemas() });
    eq(seat.errors.map(e => e.code), ['E-SEAT-INPUT']);
    const fire = requestAtPlay(player, { ...req, id: 'play-5', expected: undefined, changes: [{ address: 'change-fixture/start', new: null }] }, { schemas: schemas() });
    eq(fire.status, 'pass');
  },
};

// ---------- more: the command line, the studio's export, promotions and seals ----------
import { spawnSync } from 'node:child_process';
import { inputValues, editedValues, changeDraft } from '../web/export-web.mjs';
const TOOL = path.join(repo, 'engine', 'v2', 'tools', 'change.mjs');
const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' });

Object.assign(tests, {
  async 'cli: make, then apply with the authenticated by; exit codes 0, 1 and 2; rights prints the table'() {
    const { ad } = adsCopy();
    const edits = path.join(path.dirname(ad), 'edits.json');
    const reqPath = path.join(path.dirname(ad), 'req.json');
    fs.writeFileSync(edits, JSON.stringify({ 'ad-300x250/open/headline@en': 'Rain? Go!' }));
    const m = run('make', ad, edits, '--id', 'chg-cli', '--reason', 'Shorter headline', '--out', reqPath);
    eq(m.status, 0, m.stdout + m.stderr);
    const req = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
    eq([req.by, req.changes.length], [undefined, 1]);
    // Without a right the request is refused (shape), with the copywriter's it passes, and the retry is the same.
    eq(run('apply', ad, reqPath).status, 1);
    fs.rmSync(besidePath(reqPath));
    const ok1 = run('apply', ad, reqPath, '--right', 'copywriter', '--who', 'agent:rio', '--source', 'agent');
    eq(ok1.status, 0, ok1.stdout);
    ok(ok1.stdout.startsWith('pass chg-cli'), ok1.stdout);
    const again = run('apply', ad, reqPath, '--right', 'copywriter', '--who', 'agent:rio', '--source', 'agent');
    ok(again.stdout.includes('the first receipt; nothing applied'), again.stdout);
    eq(JSON.parse(fs.readFileSync(besidePath(reqPath), 'utf8')).status, 'pass');
    eq(run('apply', ad).status, 2);
    const rights = run('rights', ad);
    eq(JSON.parse(rights.stdout).edit['ad-300x250/brand'], ['copywriter']);
    const kitRights = run('rights', path.join(path.dirname(path.dirname(ad)), 'kits', 'ad-kit'));
    eq(JSON.parse(kitRights.stdout).abilities.changeKit, ['designer']);
  },
  async 'export: a studio exports its edited values; make and apply turn them into a new revision'() {
    const dir = fixtureCopy();
    const exp = loadExperience(await folderSource(dir), schemas()).experience;
    const player = new Player(structuredClone(exp), {});
    player.start();
    const before = inputValues(player);
    eq(before, { 'change-fixture/headline': 'Fresh bread', 'change-fixture/speed': 2 });
    player.setInput('headline', 'Warm rolls', 'widget');
    const edits = editedValues(before, inputValues(player));
    eq(edits, { 'change-fixture/headline': 'Warm rolls' });
    eq(changeDraft({ target: 'change-fixture', edits: {} }), null);
    const draft = changeDraft({ target: 'change-fixture', edits, reason: 'Studio edit' });
    const req = await makeRequest(dir, draft, { schemas: schemas(), id: 'studio-1', by: as('copywriter') });
    eq([req.reason, req.changes], ['Studio edit', [{ address: 'change-fixture/headline', old: 'Fresh bread', new: 'Warm rolls' }]]);
    eq((await apply(dir, req)).receipt.status, 'pass');
  },
  async 'promote: a promotion from an unknown or too deep input is E-PROMOTE; a good one exposes the input'() {
    const dir = fixtureCopy();
    const file = path.join(dir, 'scenes', 'one', 'scene.json');
    const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
    scene.inputs = { tone: { kind: 'knob', type: 'string', enum: ['warm', 'cool'], initial: 'warm', editableBy: ['designer'] } };
    fs.writeFileSync(file, JSON.stringify(scene, null, 2));
    const d = await digestOfFolder(dir, 'experience.json');
    const bad = await apply(dir, request('change-fixture', d, [{ address: 'experience.json#/promote', new: [{ from: 'one/nothing' }] }], as('designer')));
    eq([failedAt(bad), codes(bad)], ['rights', ['E-PROMOTE']]);
    // A path deeper than <scene>/<input> is already refused by the document's schema (check 5).
    const deep = await apply(dir, request('change-fixture', d, [{ address: 'experience.json#/promote', new: [{ from: 'one/tone/deeper' }] }], as('designer'), { id: 'chg-1b' }));
    eq(failedAt(deep), 'type');
    const good = await apply(dir, request('change-fixture', d, [{ address: 'experience.json#/promote', new: [{ from: 'one/tone', as: 'sceneTone', editableBy: ['designer'] }] }], as('designer'), { id: 'chg-2' }));
    eq(good.receipt.status, 'pass', JSON.stringify(good.receipt.errors));
    const t = rightsTable(loadExperience(await folderSource(dir), schemas()).experience);
    eq(t.edit['change-fixture/sceneTone'], ['designer']);
    // The promoted input is changed at the container; its inner path is E-SEAL.
    const inner = await apply(dir, request('change-fixture', good.receipt.digest, [{ address: 'change-fixture/one/tone', old: 'warm', new: 'cool' }], as('designer'), { id: 'chg-3' }));
    eq(codes(inner), ['E-SEAL']);
    const outer = await apply(dir, request('change-fixture', good.receipt.digest, [{ address: 'change-fixture/sceneTone', old: 'warm', new: 'cool' }], as('designer'), { id: 'chg-4' }));
    eq(outer.receipt.status, 'pass', JSON.stringify(outer.receipt.errors));
    eq(JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8')).promote, [{ from: 'one/tone', as: 'sceneTone', editableBy: ['designer'], initial: 'cool' }]);
  },
  async 'seal: in a sealed definition only inputs are reachable, except by a kit change'() {
    const dir = fixtureCopy();
    const block = { format: 'hsvg/2.0', kind: 'component', id: 'badge', seal: 'sealed', drawing: 'badge.svg', inputs: { label: { kind: 'content', contentType: 'text', type: 'string', maxLength: 12, initial: 'New', editableBy: ['copywriter'] } }, values: { glow: { type: 'number', initial: 1, minimum: 0, maximum: 2 } } };
    fs.mkdirSync(path.join(dir, 'blocks'));
    fs.writeFileSync(path.join(dir, 'blocks', 'badge.json'), JSON.stringify(block, null, 2));
    const d = await digestOfFolder(dir, 'blocks/badge.json');
    const body = await apply(dir, request('badge', d, [{ address: 'blocks/badge.json#/values/glow/initial', old: 1, new: 2 }, { address: 'badge/glow', old: 1, new: 2 }], as('designer')));
    eq([failedAt(body), codes(body)], ['reach', ['E-SEAL', 'E-SEAL']]);
  },
});

Object.assign(tests, {
  async 'kit change: the kit\'s sample kit experiences are checked with the changed kit'() {
    const { ad, kit } = adsCopy();
    fs.cpSync(ad, path.join(kit, 'samples', 'medium'), { recursive: true });
    const kitFile = path.join(kit, 'kit.json');
    const doc = JSON.parse(fs.readFileSync(kitFile, 'utf8'));
    doc.samples = { medium: 'samples/medium/experience.json' };
    fs.writeFileSync(kitFile, JSON.stringify(doc, null, 2));
    const d = await digestOfFolder(kit, 'kit.json');
    // The sample sets brand in its with, so removing the kit input breaks it: refused at check 7.
    const rm = await apply(kit, request('ad-kit', d, [{ address: 'kit.json#/inputs/brand', old: doc.inputs.brand, new: null }], as('designer')));
    eq([failedAt(rm), codes(rm)[0]], ['rules', 'E-TYPE'], JSON.stringify(rm.receipt.errors));
    ok(rm.receipt.errors[0].message.startsWith('sample medium:'), rm.receipt.errors[0].message);
    // A wider bound keeps the sample whole.
    const wide = await apply(kit, request('ad-kit', d, [{ address: 'kit.json#/inputs/brand/maxLength', old: 24, new: 32 }], as('designer'), { id: 'chg-2' }));
    eq([wide.receipt.status, wide.receipt.verdicts.review], ['pass', 'candidate']);
  },
});
