// Packages (10.8): E-PACKAGE-MEMBER, E-PACKAGE-DIGEST; and the page linter for hook marks (A3.1): E-HOOK-MARK.
// checkPackage works on a package.json and a map of the other files, so it needs no folder. The family check runs it
// only when the checked folder holds a package.json and the source can list its files.
import crypto from 'node:crypto';
import { memberFindings } from '../src/members.mjs';

const sha = (bytes) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const bytesOf = (v) => (typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(v));

// pkg: the parsed package.json. files: {path: string | bytes} for every file except package.json.
// Returns [{code, path, message}]. The rules are src/members.mjs's, which mount uses too.
export function checkPackage(pkg, files) {
  return memberFindings(pkg?.members, Object.keys(files), (rel) => sha(bytesOf(files[rel])));
}

// A repeated member cannot be a JSON object key twice: it shows as a duplicate key in the text. Returns the repeats.
export function repeatedMembers(packageText) {
  const m = /"members"\s*:\s*\{([\s\S]*?)\}/.exec(packageText);
  if (!m) return [];
  const seen = new Set(); const dup = [];
  for (const k of m[1].matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)) { if (seen.has(k[1])) dup.push(k[1]); seen.add(k[1]); }
  return dup;
}

// The page linter (A3.1): every data-hsvg-hook value in an HTML text is tokens `kind:name`.
const KINDS = new Set(['spot', 'surface', 'target', 'control', 'grab', 'obstacle']);
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export function lintHooks(html) {
  const out = [];
  for (const m of String(html).matchAll(/data-hsvg-hook\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const value = m[1] ?? m[2];
    const tokens = value.split(/\s+/).filter(Boolean);
    if (!tokens.length) out.push({ code: 'E-HOOK-MARK', value, message: 'the hook mark is empty' });
    for (const t of tokens) {
      const [kind, name, ...rest] = t.split(':');
      if (!KINDS.has(kind) || name === undefined || rest.length || !NAME.test(name)) out.push({ code: 'E-HOOK-MARK', value, message: `"${t}" is not kind:name` });
    }
  }
  return out;
}

export function check(ctx) {
  const text = ctx.source.read('package.json');
  if (text == null || typeof ctx.source.list !== 'function') return;
  let pkg;
  try { pkg = JSON.parse(text); } catch { return; } // the schema check reports it
  const files = {};
  for (const rel of ctx.source.list()) if (rel !== 'package.json') files[rel] = ctx.source.bytes ? ctx.source.bytes(rel) ?? ctx.source.read(rel) : ctx.source.read(rel);
  for (const d of checkPackage(pkg, files)) ctx.report(d.code, 'package.json', d.path, d.message);
  for (const k of repeatedMembers(text)) ctx.report('E-PACKAGE-MEMBER', 'package.json', `/members/${k}`, `${k} is listed more than once`);
}
