// The module list: every repository file that one or more entry modules load as modules, sorted.
//   node engine/v2/tools/module-list.mjs [--core] <entry> [<entry> ...]
// --core reads engine/v2/src/capabilities/all.mjs as the empty module the published core ships (it carries no built-in
// capability), so the list is the same here and in the core package.
// It follows static imports, re-exports and relative dynamic imports (an import call with a literal address) to the end. A host that
// serves the module player copies exactly these files. A dynamic import of a computed address (import(url)) is not
// followed: it loads an add-on, which is not part of the player. Comments are skipped. Node's standard library only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip.mjs';
import { importSpecs } from './addons.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const posix = (p) => p.split(path.sep).join('/');

// The relative specifiers of a file's dynamic imports with a literal address (on the code without its comments).
const DYNAMIC_RE = /(^|[^.\w$])import\s*\(\s*(['"])(\.\.?\/[^'"\n]+)\2\s*\)/g;
export function dynamicSpecs(text) {
  return [...stripComments(text).matchAll(DYNAMIC_RE)].map(m => m[3]);
}

// The files, as repository paths with "/", sorted. entries: file paths (absolute, or relative to the working folder).
// core: read src/capabilities/all.mjs as empty (its imports are not followed).
export const ALL = path.join(repo, 'engine', 'v2', 'src', 'capabilities', 'all.mjs');
export function moduleList(entries, { core = false } = {}, root = repo) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    if (!fs.existsSync(file)) throw new Error(`${posix(path.relative(root, file))} is imported but not there`);
    seen.add(file);
    if (core && file === ALL) return;
    const text = fs.readFileSync(file, 'utf8');
    for (const spec of [...importSpecs(text), ...dynamicSpecs(text)]) {
      if (spec.startsWith('./') || spec.startsWith('../')) visit(path.resolve(path.dirname(file), spec));
    }
  };
  for (const e of entries) visit(path.resolve(e));
  return [...seen].map(f => posix(path.relative(root, f))).sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const core = args.includes('--core');
  const entries = args.filter(a => a !== '--core');
  if (!entries.length) { console.error('usage: node engine/v2/tools/module-list.mjs [--core] <entry> [<entry> ...]'); process.exit(2); }
  try { for (const f of moduleList(entries, { core })) console.log(f); } catch (e) { console.error(e.message); process.exit(1); }
}
