// Builds an edit-time change request (9.10) for the input addresses whose values differ: between two folders (before
// and after an edit), or between a folder and a studio's export of edited values ({address: value}, or a request
// whose changes give address and new). `expected` is the current digest of the target document; each `old` is the
// value now in the folder.
import { folderSource, loadExperience } from '../../src/load.mjs';
import { readFolder, memorySource, digestOf, findDocument } from './folder.mjs';
import { rightsTable } from './rights.mjs';
import { resolve, ABSENT } from './targets.mjs';
import { same } from './request.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The exposed input values of an experience folder: {address: value}, with `@<tag>` addresses for the inputs that
// read one word. Also returns the target document and its digest.
export async function exposedValues(dir, schemas) {
  const files = readFolder(dir);
  const src = memorySource(files, await folderSource(dir));
  const exp = loadExperience(src, schemas).experience;
  if (!exp) throw new Error(`${dir} does not load as an experience`);
  const own = exp.own ?? exp.doc;
  const found = findDocument(files, own.id);
  const language = own.language || exp.kit?.doc.language || 'en';
  const ctx = { files, read: (r) => src.read(r), rel: found.rel, doc: found.doc, exp, kitFolder: false, language };
  const tags = Object.values(own.resources || {}).filter(r => r?.kind === 'words').map(r => r.language);
  const values = {}; const places = {};
  const put = (address, t) => { values[address] = t.current; places[address] = t.form === 'words' ? `${t.words.file}#${t.words.id}` : t.path.join('/'); };
  for (const address of Object.keys(rightsTable(exp).edit)) {
    const r = resolve({ address }, ctx);
    if (!r.target) continue;
    if (r.target.notLiteral === undefined) { if (r.target.current !== ABSENT) put(address, r.target); continue; }
    for (const t of tags) { const w = resolve({ address: `${address}@${t}` }, ctx); if (w.target && w.target.current !== ABSENT) put(`${address}@${t}`, w.target); }
  }
  return { values, places, target: own.id, digest: digestOf(src, found.rel, found.doc) };
}

// before: a folder. after: a folder, or edits ({address: value} or {changes: [{address, new}]}).
// opts: {schemas, id, by, reason}. Returns the request.
export async function makeRequest(before, after, opts) {
  const was = await exposedValues(before, opts.schemas);
  let edits;
  if (typeof after === 'string') edits = (await exposedValues(after, opts.schemas)).values;
  else if (isObj(after) && Array.isArray(after.changes)) edits = Object.fromEntries(after.changes.map(c => [c.address, c.new]));
  else if (isObj(after)) edits = after;
  else throw new Error('after is a folder or the edited values');
  const changes = [];
  const written = new Set();
  for (const [address, value] of Object.entries(edits)) {
    if (!(address in was.values)) { if (typeof after !== 'string') throw new Error(`${address} is not an exposed input of ${was.target}`); continue; }
    if (same(was.values[address], value)) continue;
    // Several addresses may write one place (scenes that read one word): the first address carries the change.
    const at = was.places[address];
    if (written.has(at)) continue;
    written.add(at);
    changes.push({ address, old: was.values[address], new: value });
  }
  const req = { format: 'hsvg/2.0', kind: 'change', id: opts.id, at: 'edit', target: was.target, expected: was.digest };
  if (opts.by) req.by = opts.by;
  req.reason = opts.reason ?? (isObj(after) && typeof after.reason === 'string' ? after.reason : 'Edited values');
  req.changes = changes;
  return req;
}
