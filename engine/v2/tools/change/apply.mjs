// Applies one edit-time change request to an experience or kit folder (9.10, A9.2). The eight checks run in order;
// each reports every failure it finds, and a failing check stops the checks after it. Nothing is written unless every
// check passes. Every request gets a receipt (A8.1, run "change"); a retry with the same id returns the first receipt
// and writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { folderSource, loadExperience } from '../../src/load.mjs';
import { checkExperience } from '../../check/index.mjs';
import { makeDocumentChecker } from '../../schema/check-document.mjs';
import { kitPin } from '../../src/kit.mjs';
import { readFolder, memorySource, digestOf, findDocument, jsonBytes, readWords, writeWords, sha, join, dirOf } from './folder.mjs';
import { checkShape, checkReplay, checkInputValue, same } from './request.mjs';
import { checkValue } from '../../src/runtime.mjs';
import { rightsTable, kitRightsTable } from './rights.mjs';
import { resolve, ABSENT, getAt, setAt, withForm, waiverKey, promoteOk } from './targets.mjs';
import { checkRules } from './rules.mjs';
import { canonical } from '../../check/kits.mjs';

export const CHECKS = ['shape', 'replay', 'revision', 'reach', 'type', 'rights', 'rules', 'apply'];
export const TOOL = 'hsvg-change 2.0.0';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$/;
const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const REVIEW = ['draft', 'candidate', 'accepted', 'blocked'];

// Where receipts are kept: in the folder's evidence (never covered by a digest, A9.3), and beside the request.
export const ledgerPath = (dir, target, id) => path.join(dir, 'evidence', 'changes', target, `${id}.json`);
export const besidePath = (requestPath) => (requestPath ? requestPath.replace(/\.json$/i, '') + '.receipt.json' : null);

// dir: the experience or kit folder. req: the request object. opts: {schemas, by (the authenticated by; it replaces
// the request's own), out (a folder for the new revision; default dir), requestPath, now (ISO date), host}.
// Returns {receipt, replayed, written: [relative paths], dir: the folder written}.
export async function applyChange(dir, req, opts = {}) {
  const { schemas } = opts;
  const now = (opts.now ?? new Date().toISOString()).replace(/\.\d{3}Z$/, 'Z');
  // 9.10: `by` is filled by whoever authenticated the source; a value the requester supplied is replaced, never
  // trusted. With no authenticated `by` the request has no rights: it is refused below, after the shape check.
  const authenticated = isObj(opts.by);
  if (authenticated) req = { ...req, by: { ...opts.by } };
  const verdicts = {};
  const base = { format: 'hsvg/2.0', kind: 'receipt', id: isObj(req) && typeof req.id === 'string' && ID.test(req.id) ? req.id : 'change-refused', run: 'change', subject: `document:${isObj(req) && typeof req.target === 'string' ? req.target : 'unknown'}` };
  const finish = (status, extra) => {
    for (const c of CHECKS) verdicts[c] ??= 'not-run';
    const receipt = { ...base, ...extra, date: now, status, verdicts, authority: { checker: TOOL } };
    if (isObj(req) && isObj(req.by)) receipt.by = req.by;
    if (isObj(req) && Array.isArray(req.changes)) receipt.changes = req.changes;
    return receipt;
  };
  // keep: a replay refusal never overwrites the first receipt beside the request (9.10).
  const refuse = (check, errors, digest, { keep = false } = {}) => {
    verdicts[check] = 'fail';
    const d = digest ?? (isObj(req) && DIGEST.test(String(req.expected)) ? req.expected : sha(Buffer.from('')));
    return done(finish('fail', { digest: d, previous: d, rules: [], errors: errors.map(e => ({ code: e.code, severity: 'error', ...(e.address ? { address: e.address } : {}), ...(e.file ? { file: e.file } : {}), pointer: e.path ?? '', message: e.message })) }), false, {}, { keep });
  };
  const done = (receipt, written, extra = {}, { keep = false } = {}) => {
    const out = { receipt, replayed: false, written: [], dir: opts.out ?? dir, ...extra };
    const beside = besidePath(opts.requestPath);
    if (beside && !out.replayed && !keep) fs.writeFileSync(beside, `${JSON.stringify(receipt, null, 2)}\n`);
    return out;
  };

  // 1. Shape.
  const shape = checkShape(req, schemas);
  if (req?.at === 'play') shape.push({ code: 'E-CHANGE-SHAPE', path: '/at', message: 'this tool applies edit-time changes; a play-time change goes to the running experience (play.mjs)' });
  if (shape.length) return refuse('shape', shape);
  verdicts.shape = 'pass';
  if (!authenticated) return refuse('rights', [{ code: 'E-RIGHTS', path: '/by', message: 'no authenticated by: whoever authenticated the source gives it (change.mjs apply --right <id> --who <who> --source <source>); a request\'s own by is never trusted (9.10)' }]);

  // 2. Replay: the first receipt for this id and target, pass or fail.
  // The ledgers: the source folder's and, with --out, the out folder's, where a pass with --out wrote it.
  const outLedger = opts.out ? ledgerPath(path.resolve(opts.out), req.target, req.id) : null;
  const first = readReceipt(ledgerPath(dir, req.target, req.id), req) ?? readReceipt(outLedger, req) ?? readReceipt(besidePath(opts.requestPath), req);
  const replay = checkReplay(req, first);
  if (replay?.receipt) return { receipt: replay.receipt, replayed: true, written: [], dir };
  if (replay?.diag) return refuse('replay', [replay.diag], undefined, { keep: !!first });
  verdicts.replay = 'pass';

  // 3. Revision: expected is the document's current digest, and each old is the current value.
  const files = readFolder(dir);
  const disk = await folderSource(dir);
  const src = memorySource(files, disk);
  const found = findDocument(files, req.target);
  if (!found) return refuse('revision', [{ code: 'E-REF-UNKNOWN', path: '/target', message: `no document ${req.target} in ${dir}` }]);
  const { rel, doc } = found;
  const kitFolder = files.has('kit.json') && JSON.parse(files.get('kit.json').toString('utf8'))?.kind === 'kit';
  const digest = digestOf(src, rel, doc);
  const exp = !kitFolder && files.has('experience.json') ? loadExperience(src, schemas).experience : null;
  const language = (exp?.own ?? exp?.doc)?.language || exp?.kit?.doc.language || doc.language || 'en';
  const ctx = { files, read: (r) => src.read(r), rel, doc, exp, kitFolder, language };
  const resolved = req.changes.map(c => resolve(c, ctx));
  const stale = [];
  if (req.expected !== digest) stale.push({ code: 'E-CHANGE-STALE', path: '/expected', message: `expected ${req.expected}, but ${req.target} is now ${digest}` });
  req.changes.forEach((c, i) => {
    const t = resolved[i].target;
    if (!t) return;
    const has = 'old' in c;
    if (t.kind === 'review') { if (has) stale.push({ code: 'E-CHANGE-STALE', path: `/changes/${i}/old`, address: c.address, message: 'reviews are append-only: a review change has no old' }); return; }
    if (t.notLiteral !== undefined) return; // check 6 refuses it
    if (!has) {
      if (t.current !== ABSENT && (t.kind === 'pointer' || t.kind === 'waiver')) stale.push({ code: 'E-CHANGE-STALE', path: `/changes/${i}`, address: c.address, message: `${c.address} already holds a value; give it as old to change it` });
      else if (t.kind === 'input' || t.kind === 'value' || t.kind === 'kit') stale.push({ code: 'E-CHANGE-STALE', path: `/changes/${i}/old`, address: c.address, message: `old is required; ${c.address} is now ${JSON.stringify(t.current === ABSENT ? null : t.current)}` });
      return;
    }
    if (t.current === ABSENT || !same(c.old, t.current)) stale.push({ code: 'E-CHANGE-STALE', path: `/changes/${i}/old`, address: c.address, message: `old is ${JSON.stringify(c.old)}, but ${c.address} is now ${t.current === ABSENT ? 'absent' : JSON.stringify(t.current)}` });
  });
  if (stale.length) return refuse('revision', stale, digest);
  verdicts.revision = 'pass';

  // 4. Reach.
  const reach = resolved.map((r, i) => (r.diag ? { ...r.diag, path: `/changes/${i}/address` } : null)).filter(Boolean);
  if (reach.length) return refuse('reach', reach, digest);
  verdicts.reach = 'pass';
  const targets = resolved.map(r => r.target);

  // 5. Type and bounds. Values are never clamped. Pointer changes are checked as the document they make.
  const typeDiags = [];
  const work = structuredClone(doc);
  const copy = new Map(files);
  req.changes.forEach((c, i) => {
    const t = targets[i]; const at = `/changes/${i}/new`;
    const bad = (code, message) => typeDiags.push({ code, path: at, address: c.address, message });
    if (t.kind === 'input') { const r = checkInputValue(t.tag !== null ? { ...t.decl, type: 'string' } : t.decl, c.new); if (r) bad(r[0], `${c.address}: ${r[1]}`); }
    if (t.kind === 'value') { if (c.new === null) bad('E-TYPE', 'a value always has an initial'); else if (t.decl.type) { const r = checkValue(t.decl, c.new); if (r) bad(r[0], `${c.address}: ${r[1]}`); } }
    if (t.kind === 'waiver' && c.new !== null) for (const m of waiverProblems(c.new)) bad('E-TYPE', m);
    if (t.kind === 'waiver' && c.new === null && !('old' in c)) bad('E-TYPE', 'removing a waiver names it in old');
    if (t.kind === 'review') for (const m of reviewProblems(c.new)) bad('E-TYPE', m);
    if (t.kind === 'kit') for (const m of pinProblems(c.new, t.current)) bad('E-TYPE', m);
  });
  for (let i = 0; i < req.changes.length; i++) write(targets[i], req.changes[i], work, copy, rel);
  if (targets.some(t => t.kind === 'pointer') || targets.some(t => t.kind === 'waiver')) {
    const checker = makeDocumentChecker(schemas);
    const needs = exp?.needs ?? [];
    const before = new Set(checker.check(structuredClone(doc), { needs, file: rel }).diags.map(d => `${d.code}|${d.path}`));
    for (const d of checker.check(structuredClone(work), { needs, file: rel }).diags) if (!before.has(`${d.code}|${d.path}`)) typeDiags.push({ code: d.code, path: `/${String(d.path).replace(/^\//, '')}`, file: rel, message: d.message });
  }
  if (typeDiags.length) return refuse('type', typeDiags, digest);
  verdicts.type = 'pass';

  // 6. Rights.
  const table = kitFolder ? kitRightsTable(doc.kind === 'kit' ? doc : JSON.parse(files.get('kit.json').toString('utf8'))) : rightsTable(exp);
  const right = req.by.right;
  const may = (ability) => table.abilities[ability]?.includes(right);
  const rightDiags = [];
  const defs = { ...(exp?.kit?.blocks || {}), ...(exp?.blocks || {}) };
  if (exp && !exp.kit) for (const [id, s] of Object.entries(exp.scenes || {})) defs[`scene:${id}`] = s;
  req.changes.forEach((c, i) => {
    const t = targets[i]; const at = `/changes/${i}`;
    const no = (message, code = 'E-RIGHTS') => rightDiags.push({ code, path: at, address: c.address, message });
    if (t.kind === 'input') {
      if (t.notLiteral !== undefined) return no(`${c.address} is given by the formula ${JSON.stringify(t.notLiteral)}, not a literal, so it cannot be edited (4.7)`);
      const list = table.edit[t.rightsKey];
      if (!list?.includes(right) || !may('edit')) no(`right ${right} may not edit ${t.rightsKey}; ${list?.length ? `its editors are ${list.join(', ')}` : 'no editor may change it, only a kit change'}`);
    }
    if (t.kind === 'value' && !may('edit')) no(`right ${right} has no edit ability`);
    if (t.kind === 'waiver') {
      const w = c.new ?? c.old;
      const list = table.waive[w?.rule];
      if (!list?.includes(right)) no(`right ${right} may not waive ${w?.rule}; ${list?.length ? `its waivableBy is ${list.join(', ')}` : 'it has no waivableBy, so it cannot be waived'}`);
      else if (c.new !== null && c.new.by !== right) no(`the waiver says by ${c.new.by}, but it is saved under ${right}; whoever saves a waiver holds its right (8.5)`);
    }
    if (t.kind === 'review') {
      if (!may('review')) no(`right ${right} has no review ability`);
      if (c.new?.status === 'accepted' && (String(c.new.by).startsWith('agent:') || String(req.by.who).startsWith('agent:'))) no('only a person may accept; an agent sets candidate or blocked', 'E-TRUST-REVIEW');
    }
    if (t.kind === 'kit' && !may('publish')) no(`moving a kit pin needs publish; right ${right} does not have it`);
    if (t.kind === 'pointer') {
      if (t.kitChange ? !may('changeKit') : !may('edit')) no(`a pointer change into ${t.kitChange ? 'a kit\'s documents needs changeKit' : `${req.target} needs edit`}; right ${right} does not have it`);
      if (t.promotes) for (const [k, p] of (Array.isArray(work.promote) ? work.promote : []).entries()) if (!promoteOk(work, p, defs)) no(`promote ${k}: ${p?.from} is unknown or deeper than a direct child's input`, 'E-PROMOTE');
    }
  });
  if (!(right in (exp?.kit?.doc.rights ?? (kitFolder ? (doc.kind === 'kit' ? doc : JSON.parse(files.get('kit.json').toString('utf8'))).rights : (exp?.own ?? exp?.doc)?.rights) ?? {}))) rightDiags.unshift({ code: 'E-RIGHTS', path: '/by/right', message: `${right} is not a right of ${table.kit ? `kit ${table.kit.id}` : req.target}` });
  if (rightDiags.length) return refuse('rights', rightDiags, digest);
  verdicts.rights = 'pass';

  // 7. Rules, on the copy.
  copy.set(rel, jsonBytes(work));
  const copySrc = memorySource(copy, disk);
  let rules = []; const ruleDiags = []; let checkerPasses = false;
  if (exp) {
    const after = checkExperience(copySrc, schemas, { host: opts.host ?? null, ...(opts.previousKit ? { previousKit: opts.previousKit } : {}) });
    const beforeDiags = checkExperience(src, schemas, { host: opts.host ?? null }).diags;
    checkerPasses = after.experience && !after.diags.some(d => d.code?.startsWith('E-'));
    if (after.experience) {
      const r = checkRules(after.experience, after.diags);
      rules = r.rows; ruleDiags.push(...r.diags);
    }
    // A kit pin move runs the full checker on the copy and refuses on any error (4.8); any other change refuses on
    // an error the change brings.
    const pinMove = targets.some(t => t.kind === 'kit');
    const key = (d) => `${d.code}|${d.file}|${d.path}|${d.message}`;
    const old = new Set(beforeDiags.map(key));
    for (const d of after.diags) if (d.code?.startsWith('E-') && !/^E-RULE$/.test(d.code) && (pinMove || !old.has(key(d)))) ruleDiags.push({ code: d.code, file: d.file, path: d.path, message: d.message });
  } else if (kitFolder) {
    const r = checkKitSamples(copy, disk, schemas, opts);
    rules = r.rules; ruleDiags.push(...r.diags); checkerPasses = r.ran && !r.diags.length;
  }
  if (ruleDiags.length) return refuse('rules', ruleDiags, digest);
  verdicts.rules = 'pass';

  // 8. Apply: all changes at once. The document gets a new digest; its review status is recomputed (A9.3).
  let next = digestOf(copySrc, rel, work);
  if (isObj(work.about?.trust) && work.about.trust.digest !== undefined) { work.about.trust.digest = next; copy.set(rel, jsonBytes(work)); }
  next = digestOf(memorySource(copy, disk), rel, work);
  const reviews = Array.isArray(work.about?.trust?.review) ? work.about.trust.review : [];
  const last = [...reviews].reverse().find(r => r?.digest === next && r.of === undefined);
  verdicts.review = last ? last.status : checkerPasses ? 'candidate' : 'draft';
  verdicts.apply = 'pass';
  const outDir = opts.out ? path.resolve(opts.out) : dir;
  const changed = new Set([...copy].filter(([r, b]) => !files.has(r) || !files.get(r).equals(b)).map(([r]) => r));
  // The revision again, just before writing, with no wait in between: a change that committed since this one read
  // the folder makes this one stale, so two changes against one revision never both commit (9.10).
  const moved = movedSince(dir, files, disk, rel, digest, changed);
  if (moved) {
    for (const c of CHECKS.slice(CHECKS.indexOf('reach'))) delete verdicts[c];
    delete verdicts.review;
    return refuse('revision', [{ code: 'E-CHANGE-STALE', path: '/expected', message: moved }], digest);
  }
  const receipt = finish('pass', { digest: next, previous: digest, rules });
  commitFiles(outDir, outDir !== path.resolve(dir) ? copy : new Map([...copy].filter(([r]) => changed.has(r))), ledgerPath(outDir, req.target, req.id), `${JSON.stringify(receipt, null, 2)}\n`);
  return done(receipt, true, { written: [...changed].sort(), dir: outDir });
}

// Why the folder is no longer the revision this change read, or null: the target's digest moved, or a file the
// change writes was changed. Synchronous, so nothing else in this process runs between it and the write.
function movedSince(dir, files, disk, rel, digest, changed) {
  const now = readFolder(dir);
  const found = now.has(rel) ? JSON.parse(now.get(rel).toString('utf8')) : null;
  const d = found && digestOf(memorySource(now, disk), rel, found);
  if (d !== digest) return `${rel} changed while this change was checked: it is now ${d ?? 'gone'}`;
  for (const r of changed) {
    const a = now.get(r); const b = files.get(r);
    if (!!a !== !!b || (a && !a.equals(b))) return `${r} changed while this change was checked`;
  }
  return null;
}

// Writes the files and then the receipt so that a failed write changes nothing: each goes to a temporary file
// first, and only when all are written are they renamed into place, the receipt last. A failure removes the
// temporary files and reaches the caller; the folder is as it was, so the same request can run again.
function commitFiles(dir, files, ledger, receiptText) {
  const staged = [];
  const stage = (abs, bytes) => {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = `${abs}.hsvg-tmp`;
    staged.push([tmp, abs]);
    fs.writeFileSync(tmp, bytes);
  };
  try {
    for (const [rel, bytes] of files) stage(path.join(dir, ...rel.split('/')), bytes);
    stage(ledger, receiptText);
  } catch (e) {
    for (const [tmp] of staged) { try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ } }
    throw e;
  }
  for (const [tmp, abs] of staged) fs.renameSync(tmp, abs);
}

// A stored receipt for this request's id and target, or null.
function readReceipt(file, req) {
  if (!file || !fs.existsSync(file)) return null;
  try { const r = JSON.parse(fs.readFileSync(file, 'utf8')); return r?.kind === 'receipt' && r.run === 'change' && r.id === req.id && r.subject === `document:${req.target}` ? r : null; } catch { return null; }
}

// Writes one change into the working document (or a words file of the copy).
function write(t, c, work, copy, rel) {
  if (t.kind === 'input' && t.form === 'words') {
    const text = copy.get(t.words.file).toString('utf8');
    const list = readWords(text);
    const row = list.find(([k]) => k === t.words.id);
    if (row) row[1] = c.new; else list.push([t.words.id, c.new]);
    const bytes = Buffer.from(writeWords(list), 'utf8');
    copy.set(t.words.file, bytes);
    const res = work.resources[t.words.resource];
    if (res.digest !== undefined) res.digest = sha(bytes);
    return;
  }
  if (t.kind === 'input') { setAt(work, t.path, t.form === 'with' ? withForm(c.new, t.decl) : structuredClone(c.new)); return; }
  if (t.kind === 'value') { setAt(work, t.path, structuredClone(c.new)); return; }
  if (t.kind === 'waiver') {
    const list = Array.isArray(work.waivers) ? work.waivers : (work.waivers = []);
    const i = 'old' in c ? list.findIndex(w => waiverKey(w) === waiverKey(c.old)) : -1;
    if (c.new === null) { if (i >= 0) list.splice(i, 1); if (!list.length) delete work.waivers; } else if (i >= 0) list[i] = structuredClone(c.new); else list.push(structuredClone(c.new));
    return;
  }
  if (t.kind === 'review') {
    work.about ??= {}; work.about.trust ??= {}; work.about.trust.review ??= [];
    work.about.trust.review.push(structuredClone(c.new));
    return;
  }
  if (t.kind === 'kit') { work.kit = structuredClone(c.new); return; }
  if (t.kind === 'pointer') setAt(work, t.tokens, c.new === null ? ABSENT : structuredClone(c.new));
}

function waiverProblems(w) {
  if (!isObj(w)) return ['a waiver is {rule, reason, by, subject?, size?, language?, theme?, until?} (8.5)'];
  const out = [];
  for (const k of Object.keys(w)) if (!['rule', 'subject', 'size', 'language', 'theme', 'reason', 'by', 'until'].includes(k)) out.push(`a waiver has no key ${k}`);
  if (typeof w.rule !== 'string' || !/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test(w.rule)) out.push('a waiver names its rule as <pack or block id>/<rule id>');
  if (typeof w.reason !== 'string' || !w.reason.trim()) out.push('a waiver gives its reason (E-WAIVER-REASON)');
  if (typeof w.by !== 'string' || !ID.test(w.by)) out.push('a waiver names the editor right that made it');
  if (w.until !== undefined && !VERSION.test(String(w.until))) out.push('until is a kit version');
  return out;
}
function reviewProblems(r) {
  if (!isObj(r)) return ['a review is {status, by, date, digest, note?, of?} (A9.3)'];
  const out = [];
  for (const k of Object.keys(r)) if (!['status', 'by', 'date', 'digest', 'note', 'of', 'signature'].includes(k)) out.push(`a review has no key ${k}`);
  if (!REVIEW.includes(r.status)) out.push(`status is one of ${REVIEW.join(', ')}`);
  if (typeof r.by !== 'string' || !/^(person|agent):./.test(r.by)) out.push('by is person:<id> or agent:<id>');
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(r.date)) out.push('date is ISO 8601');
  if (typeof r.digest !== 'string' || !DIGEST.test(r.digest)) out.push('digest is the reviewed digest');
  if (r.note !== undefined && (typeof r.note !== 'string' || [...r.note].length > 2000)) out.push('note is text of at most 2,000 characters');
  if (r.status === 'blocked' && !(typeof r.note === 'string' && r.note.trim())) out.push('a blocked review says why in its note');
  return out;
}
function pinProblems(p, current) {
  if (!isObj(p)) return ['a kit pin is {id, version, digest?} (4.8)'];
  const out = [];
  for (const k of Object.keys(p)) if (!['id', 'version', 'digest'].includes(k)) out.push(`a kit pin has no key ${k}`);
  if (p.id !== current?.id) out.push(`a pin moves to another version of kit ${current?.id}, not to ${p.id}`);
  if (typeof p.version !== 'string' || !VERSION.test(p.version)) out.push('version is major.minor.patch');
  else if (/-/.test(p.version)) out.push('a published kit experience never pins a pre-release (4.8)');
  if (p.digest !== undefined && !(typeof p.digest === 'string' && DIGEST.test(p.digest))) out.push('digest is sha256: and 64 hex digits');
  return out;
}

// A kit change: each sample kit experience of the kit is checked with the changed kit. Without samples the kit's
// rules cannot be proven on an experience and are not-run.
function checkKitSamples(copy, disk, schemas, opts) {
  const kit = JSON.parse(copy.get('kit.json').toString('utf8'));
  const rules = []; const diags = []; let ran = false;
  for (const [id, rel] of Object.entries(kit.samples || {})) {
    const dir = dirOf(join('', rel));
    const sample = {
      read(r) {
        const m = /^kits\/([^/]+)\/(.+)$/.exec(r);
        if (m && m[1] === kit.id) return copy.has(m[2]) ? copy.get(m[2]).toString('utf8') : null;
        const at = join(dir, r); return at !== null && copy.has(at) ? copy.get(at).toString('utf8') : null;
      },
      bytes(r) {
        const m = /^kits\/([^/]+)\/(.+)$/.exec(r);
        if (m && m[1] === kit.id) return copy.has(m[2]) ? new Uint8Array(copy.get(m[2])) : null;
        const at = join(dir, r); return at !== null && copy.has(at) ? new Uint8Array(copy.get(at)) : null;
      },
    };
    const r = checkExperience(sample, schemas, { host: opts.host ?? null, ...(opts.previousKit ? { previousKit: opts.previousKit } : {}) });
    ran = true;
    if (!r.experience) { diags.push({ code: 'E-RULE', path: `/samples/${id}`, message: `sample ${id} does not load with the changed kit` }); continue; }
    const rr = checkRules(r.experience, r.diags);
    for (const row of rr.rows) if (!rules.some(x => x.rule === row.rule && x.result === row.result)) rules.push(row);
    diags.push(...rr.diags.map(d => ({ ...d, message: `sample ${id}: ${d.message}` })));
    for (const d of r.diags) if (d.code?.startsWith('E-') && d.code !== 'E-RULE') diags.push({ code: d.code, file: d.file, path: d.path, message: `sample ${id}: ${d.message}` });
  }
  if (!ran) for (const r of Array.isArray(kit.rules) ? kit.rules : []) if (r?.id) rules.push({ rule: `${kit.id}/${r.id}`, result: 'not-run', proof: 'files', detail: 'the kit lists no sample kit experience to check it on' });
  return { rules, diags, ran };
}

export { canonical };
