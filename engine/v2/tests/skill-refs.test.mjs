// The master skill's reference pages (skill/2.0/references) are generated from the spec: none may be stale.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ok } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const tests = {
  'skill/2.0/tools/make-refs.mjs --check finds every page up to date'() {
    let out = '';
    try { out = execFileSync(process.execPath, [path.join(root, 'skill', '2.0', 'tools', 'make-refs.mjs'), '--check'], { encoding: 'utf8' }); }
    catch (e) { ok(false, `reference pages are stale: ${e.stdout || e.message}`); }
    ok(/6 pages up to date/.test(out), out);
  },
};
