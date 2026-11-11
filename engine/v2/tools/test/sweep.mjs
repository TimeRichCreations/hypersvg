// test.mjs --all: every 2.0 experience in the repo (the sweep's list), one after another in one browser, with a
// table; --baseline <dir> saves a fingerprint of each scene after each action, --compare <dir> reports every
// difference (K2's proof that a fold changed nothing).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
// Never swept: git's folder, packages, build output, and the folders that stay private.
const SKIP = new Set(['.git', 'node_modules', 'out', 'private', 'sources', 'evidence']);

// The sweep's list: every folder (relative to the repo, sorted) whose experience.json is a 2.0 experience.
export function sweepList(root = repo) {
  const out = [];
  const walk = (dir) => {
    let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (list.some(e => e.isFile() && e.name === 'experience.json')) {
      try { const j = JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8')); if (j?.format === 'hsvg/2.0' && j.kind === 'experience') out.push(path.relative(root, dir)); } catch { /* not JSON: not swept */ }
    }
    for (const e of list) if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name));
  };
  walk(root);
  return out.sort();
}
// A file name for an experience folder: its path with the separators as "__".
export const printName = (rel) => rel.split(/[\\/]+/).join('__');

// Every difference between two fingerprints of one experience: {layout: {scene: [print]}}. Each difference names the
// layout, the scene, the step (the action after which it was taken), what differs and how.
export function compareFingerprints(before, after) {
  const out = [];
  for (const layout of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[layout] || {}; const b = after[layout] || {};
    for (const scene of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!a[scene] || !b[scene]) { out.push({ layout, scene, step: '', what: 'scene', detail: a[scene] ? 'not reached now' : 'reached now, not before' }); continue; }
      const n = Math.max(a[scene].length, b[scene].length);
      for (let i = 0; i < n; i++) {
        const x = a[scene][i]; const y = b[scene][i];
        const step = (x || y).after;
        if (!x || !y) { out.push({ layout, scene, step, what: 'step', detail: x ? 'missing now' : 'new now' }); continue; }
        if (x.after !== y.after) { out.push({ layout, scene, step, what: 'step', detail: `the step was "${x.after}", now "${y.after}"` }); continue; }
        for (const what of ['scene', 'values', 'texts', 'boxes', 'names']) {
          const d = diff(x[what], y[what]);
          if (d) out.push({ layout, scene, step, what, detail: d });
        }
      }
    }
  }
  return out;
}
// The first few differences of two JSON values, as words.
function diff(a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    return `${keys.length} differ: ${keys.slice(0, 4).map(k => `${k} ${short(a[k])} -> ${short(b[k])}`).join('; ')}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const i = [...Array(Math.max(a.length, b.length)).keys()].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    return `${i.length} differ: ${i.slice(0, 4).map(k => `${short(a[k])} -> ${short(b[k])}`).join('; ')}`;
  }
  return `${short(a)} -> ${short(b)}`;
}
const short = (v) => { const s = JSON.stringify(v); return s === undefined ? 'none' : s.length > 80 ? `${s.slice(0, 77)}...` : s; };

// The table --all prints: one row per experience.
export function table(rows) {
  const head = ['experience', 'scenes', 'errors', 'warnings', 'seconds', 'top codes'];
  const body = rows.map(r => [r.target, String(r.scenes), String(r.errors), String(r.warnings), (r.ms / 1000).toFixed(1), r.top]);
  const w = head.map((h, i) => Math.max(h.length, ...body.map(b => b[i].length)));
  const fmt = (cells) => cells.map((c, i) => (i === 0 || i === 5 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ').trimEnd();
  return [fmt(head), fmt(w.map(n => '-'.repeat(n))), ...body.map(fmt)].join('\n');
}
