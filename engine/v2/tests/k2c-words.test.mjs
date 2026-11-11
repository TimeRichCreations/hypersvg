// Every checker message and hint speaks the final words (D33 to D38). In the coverage round a model copied
// an old channel name (translate-y) from a message. An old word may appear only where a message says what it became.
import fs from 'node:fs';
import path from 'node:path';
import { repo, eq, ok } from './helpers.mjs';
import { sayChannel, bindingFor } from '../check/say.mjs';

// Old words and marks that a message must not teach.
const OLD = [
  /data-hsvg-(?:look|paint|color-role|type-role|follows|region|side|anchor|safe-area)\b/,
  /\btranslate-[xy]\b/, /"channel":\s*"/, /"kind":\s*"(?:press|option)"/, /\blook (?:binding|track|marks?)\b/,
  /\b(?:angle|line) slider\b/, /\brepeat region\b/, /\bslot or region\b/, /\bcolour-role mark\b/, /\bpaint:role\b/,
];
// Where a message names an old word to say what it became (E-WORD-RENAMED and the motion mark's old channels).
const SAYS_WHAT_IT_BECAME = /\bis now\b|\(D33\)|\bwrite the final\b|\bnot "/;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.mjs') ? [path.join(dir, e.name)] : []);
const literals = (line) => line.match(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"/g) || [];

export const tests = {
  'K2c: errors.json reasons and fixes name no old word, except the rename code that says what it became'() {
    const codes = JSON.parse(fs.readFileSync(path.join(repo, 'spec', '2.0', 'errors.json'), 'utf8')).codes;
    const bad = [];
    for (const c of codes) for (const k of ['reason', 'fix']) {
      if (c.code === 'E-WORD-RENAMED') continue;
      for (const re of OLD) if (re.test(c[k] || '')) bad.push(`${c.code} ${k}: ${re}`);
    }
    eq(bad, []);
  },
  'K2c: checker message strings name no old word, except to say what it became'() {
    const files = [...walk(path.join(repo, 'engine', 'v2', 'check')), path.join(repo, 'engine', 'v2', 'schema', 'drawing-check.mjs')];
    const bad = [];
    for (const f of files) fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      for (const s of literals(line)) {
        if (s.length < 12 || !s.includes(' ') || SAYS_WHAT_IT_BECAME.test(s)) continue;
        for (const re of OLD) if (re.test(s)) bad.push(`${path.relative(repo, f)}:${i + 1}: ${re}`);
      }
    });
    eq(bad, []);
  },
  'K2c: a message names what a binding writes as the final word, with its as or axis'() {
    eq(sayChannel('translate-y'), 'move (axis y)');
    eq(sayChannel('skew'), 'rotate (as lean)');
    eq(sayChannel('stroke-width'), 'scale (as line)');
    eq(sayChannel('dash'), 'draw');
    eq(sayChannel('look'), 'variant');
    eq(sayChannel('color:accent'), 'color (role accent)');
    eq(sayChannel('opacity'), 'opacity');
    eq(bindingFor({ kind: 'slider', axis: 'y', value: 'level' }, 'handle'), '{"target": "handle", "move": "level", "axis": "y"}');
    eq(bindingFor({ kind: 'dial', value: 'heat' }, 'pointer'), '{"target": "pointer", "rotate": "heat"}');
    ok(!/translate|channel/.test(bindingFor({ kind: 'slider', axis: 'x', value: 'v' }, 'h')));
  },
};
