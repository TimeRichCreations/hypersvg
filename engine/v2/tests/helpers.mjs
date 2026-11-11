// Test helpers: paths, schemas, assertions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../schema/load.mjs';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const spec = path.join(repo, 'spec', '2.0');
let cached;
export const schemas = () => (cached ??= loadSchemas(spec));

export function eq(a, b, msg = '') {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`${msg} expected ${y}, got ${x}`);
}
export function ok(v, msg = 'expected true') { if (!v) throw new Error(msg); }
export function throwsCode(fn, code) {
  try { fn(); } catch (e) { if (e.code === code) return e; throw new Error(`expected ${code}, got ${e.code || ''} ${e.message}`); }
  throw new Error(`expected ${code}, nothing thrown`);
}
// A source over an in-memory map of files.
export const mapSource = (files) => ({ read: (rel) => (rel in files ? (typeof files[rel] === 'string' ? files[rel] : JSON.stringify(files[rel])) : null) });
// A host that gives an experience exactly the grants it asks for (10.5). A page with no host profile is given none
// (D31), so tests that play grants as a host would wrap their Player or Engine: granting(Player).
export function granting(P) {
  return class extends P {
    constructor(exp, opts = {}) { super(exp, opts.host === undefined || opts.host === null ? { ...opts, host: { grants: structuredClone(exp?.doc?.grants || {}) } } : opts); }
  };
}

// A built-in add-on's code for a test, or null when this release does not hold it (the core release, D30). A test
// file loads add-on code with this, so its core tests still run in the core; its add-on tests (release/addons-tests.json)
// run in the hypersvg-addons checks. rel is relative to the test file (from: its import.meta.url).
import { optional } from '../check/optional.mjs';
export const addonCode = (rel, from) => optional(new URL(rel, from).href);
