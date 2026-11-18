// The engine's layers (engine/v2/README.md, "How the engine is built"): the logic never imports the drawing or the
// page, and nothing it imports touches the page. No browser.
import fs from 'node:fs';
import path from 'node:path';
import { repo, ok } from './helpers.mjs';

const src = path.join(repo, 'engine', 'v2', 'src');
const LOGIC = ['runtime.mjs', 'formula.mjs', 'story.mjs', 'storage.mjs', 'capabilities.mjs', 'tiers.mjs', 'limits.mjs', 'limits-runtime.mjs'];
const IMPORT = /^\s*(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]/gm;

// Every file reached by the static imports of the given files, as paths relative to engine/v2.
function graph(files) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    for (const [, rel] of text.matchAll(IMPORT)) walk(path.resolve(path.dirname(file), rel));
  };
  files.forEach(f => walk(path.join(src, f)));
  return [...seen].map(f => path.relative(path.join(repo, 'engine', 'v2'), f).split(path.sep).join('/')).sort();
}
// A use of the page's globals outside a comment.
const touchesPage = (text) => text.split('\n').some(l => !/^\s*\/\//.test(l) && /\b(?:document|window)\.[A-Za-z]/.test(l.replace(/\/\/.*$/, '')));

export const tests = {
  'layers: the logic never imports the drawing or the page'() {
    const files = graph(LOGIC);
    ok(files.includes('src/runtime.mjs') && files.includes('src/story.mjs'), files.join(', '));
    const bad = files.filter(f => f === 'src/drawing.mjs' || f.startsWith('web/') || f.startsWith('check/'));
    ok(!bad.length, `the logic reaches ${bad.join(', ')}`);
  },
  'layers: nothing the logic imports touches the page'() {
    const bad = graph(LOGIC).filter(f => touchesPage(fs.readFileSync(path.join(repo, 'engine', 'v2', f), 'utf8')));
    ok(!bad.length, `these logic files use document or window: ${bad.join(', ')}`);
  },
  'layers: the shared transform helper imports nothing'() {
    const text = fs.readFileSync(path.join(src, 'transform.mjs'), 'utf8');
    ok(![...text.matchAll(IMPORT)].length, 'src/transform.mjs imports something');
  },
};
