// The formula conformance files (5.6.8, spec/2.0/conformance/formula/): the engine passes every case, the files are
// what make-formula-conformance.mjs makes, every function of the language is called, and the seeded cases agree with
// the mixer as 5.6.5 writes it out (worked here with BigInt, apart from the engine's code).
import fs from 'node:fs';
import path from 'node:path';
import { FUNCTIONS, parse } from '../src/formula.mjs';
import { folder, FORMAT_ID, AREAS, WHITESPACE, casePasses, formulaConformanceFiles, sameFile, uncalledFunctions } from '../tools/make-formula-conformance.mjs';
import { eq, ok } from './helpers.mjs';

const files = () => fs.readdirSync(folder).filter(f => f.endsWith('.json')).sort();
const read = (f) => JSON.parse(fs.readFileSync(path.join(folder, f), 'utf8'));

// mix(seed) as 5.6.5 says, on exact integers: truncate toward zero, modulo 2^32, then the two multiplies.
const M32 = 2n ** 32n;
const imul = (a, b) => (a * b) % M32;
function refMix(seed) {
  let x = BigInt(Math.trunc(seed)) % M32;
  if (x < 0n) x += M32;
  x = imul(x ^ (x >> 16n), 0x85ebca6bn);
  x = imul(x ^ (x >> 13n), 0xc2b2ae35n);
  return Number(x ^ (x >> 16n));
}
function refShuffle(list, seed) {
  const out = [...list]; const n = out.length;
  for (let i = n - 1; i >= 1; i--) { const j = refMix(seed + (n - 1 - i)) % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export const tests = {
  '5.6.8: the engine passes every case in every file'() {
    const wrong = [];
    let n = 0;
    for (const f of files()) for (const c of read(f).cases) { n++; const why = casePasses(c); if (why) wrong.push(`${f} ${c.name}: ${why}`); }
    ok(n >= 500, `${n} cases`);
    eq(wrong, []);
  },
  '5.6.8: the files are what make-formula-conformance.mjs makes'() {
    const made = formulaConformanceFiles();
    eq(files(), Object.keys(made).sort());
    const stale = Object.entries(made).filter(([name, text]) => !sameFile(fs.readFileSync(path.join(folder, name), 'utf8'), text)).map(([name]) => name);
    eq(stale, []);
  },
  '5.6.8: every file has the format, an area and cases a JSON parser reads'() {
    for (const f of files()) {
      const d = read(f);
      eq([d.format, `${d.area}.json`], [FORMAT_ID, f], f);
      ok(Array.isArray(d.cases) && d.cases.length > 0 && Array.isArray(d.spec), f);
      for (const c of d.cases) {
        ok(typeof c.name === 'string' && (('formula' in c) !== ('template' in c)), `${f} ${c.name}: a formula or a template`);
        ok(('result' in c) !== ('error' in c), `${f} ${c.name}: a result or an error`);
        if ('error' in c) ok(/^E-[A-Z-]+$/.test(c.error) && ['parse', 'evaluate'].includes(c.stage), `${f} ${c.name}: code and stage`);
        for (const k of Object.keys(c)) ok(['name', 'formula', 'template', 'values', 'builtins', 'states', 'language', 'words', 'result', 'error', 'stage', 'steps', 'platform'].includes(k), `${f} ${c.name}: key ${k}`);
        // D62 3.1: every case that evaluates gives the engine's work steps (5.6.6); a parse error has none.
        if (c.stage === 'parse') ok(!('steps' in c), `${f} ${c.name}: a parse error has no steps`);
        else ok(Number.isInteger(c.steps) && c.steps >= 0, `${f} ${c.name}: steps`);
        for (const p of c.platform || []) ok(['cldr', 'math'].includes(p), `${f} ${c.name}: platform ${p}`);
      }
    }
  },
  '5.6.6: the step counts the spec states (sort, minBy, lookup, joins, equality) are cases, and every one agrees'() {
    const named = read('limits.json').cases.filter(c => c.name.startsWith('steps: '));
    ok(named.length >= 15, `${named.length} step cases`);
    const at = (f) => named.find(c => c.formula === f)?.steps;
    eq([at('sort(range(8), item)'), at('minBy(range(8), item)'), at('count(range(8), true)'), at('lookup(rows, "id", 2, null)')], [55, 23, 20, 9]);
    const text = fs.readFileSync(path.join(folder, '..', '..', '05-faces-and-body.md'), 'utf8');
    ok(text.includes('n × ceil(log2(n + 1))') && text.includes('`sort(range(8), item)` costs 55'), '5.6.6 writes the engine\'s counts');
  },
  '5.6.2 (D62): the spec lists exactly the whitespace the engine skips between tokens, every character of the BMP tried'() {
    const skipped = [];
    for (let c = 0; c <= 0xffff; c++) {
      if (c >= 0xd800 && c <= 0xdfff) continue;
      const ch = String.fromCharCode(c);
      // Skipped between tokens in both: a letter would join a name in the first, a digit a number in the second.
      try { parse(`true${ch}&&${ch}true`); parse(`1${ch}+${ch}1`); skipped.push(c); } catch { /* not whitespace */ }
    }
    eq(skipped, WHITESPACE, 'the engine skips the 25 characters of 5.6.2');
    const text = fs.readFileSync(path.join(folder, '..', '..', '05-faces-and-body.md'), 'utf8');
    const para = text.slice(text.indexOf('Whitespace is exactly these'), text.indexOf('Any other character outside a string'));
    const listed = [];
    for (const m of para.matchAll(/U\+([0-9A-F]{4})(?: to U\+([0-9A-F]{4}))?/g)) {
      const lo = parseInt(m[1], 16); const hi = m[2] ? parseInt(m[2], 16) : lo;
      for (let c = lo; c <= hi; c++) listed.push(c);
    }
    eq(listed, WHITESPACE, 'the spec lists the same characters, in order');
    ok(para.includes(`these ${WHITESPACE.length} characters`));
  },
  '5.6 and 2.7 (D62 item 3): the platform rules are written: text units and order, maths, plural, number text, time, result size'() {
    const s5 = fs.readFileSync(path.join(folder, '..', '..', '05-faces-and-body.md'), 'utf8');
    const s2 = fs.readFileSync(path.join(folder, '..', '..', '02-files-and-names.md'), 'utf8');
    for (const phrase of [
      'A number literal is read as the double nearest its exact decimal value', // P2
      'as IEEE 754 `fmod` gives it', // P8 %
      'Text is a sequence of UTF-16 units', // T1
      'surrogates (the units\n  0xD800 to 0xDFFF) sort after every other unit', // T2
      'No\n  function compares text by locale', // P5
      'within 1\n  unit in the last place', // P3
      '`W-MATH-UNROUNDED`', // D62 3.3
      'the decimals are truncated toward zero', // P8
      'No function reads a clock, a timezone or a calendar', // P7
      'never convert a seed above 2^63 to a machine integer first', // P8 mixer
      'numbers as ECMAScript\'s `Number.prototype.toString` writes them', // P8 result size
      'the one nearest the double\'s exact value', // P1
      'A result whose digits are all zero has no minus sign', // P8
    ]) ok(s5.includes(phrase), `5.6 or 5.7 has: ${phrase}`);
    ok(s2.includes('with at most 3 fraction digits, using its absolute value') && s2.includes('never decides behaviour (D62)'), '2.7 has the plural rule (P6)');
  },
  '5.6.8: every function of 5.6.4 is called by a case, and the README names every file'() {
    eq(uncalledFunctions(formulaConformanceFiles()), []);
    ok(Object.keys(FUNCTIONS).length >= 30);
    const readme = fs.readFileSync(path.join(folder, 'README.md'), 'utf8');
    eq(Object.keys(AREAS).filter(id => !readme.includes(`\`${id}.json\``)), []);
  },
  '5.6.5: the seeded cases agree with the mixer written out in the spec'() {
    const cases = read('random.json').cases.filter(c => 'result' in c);
    let checked = 0;
    for (const c of cases) {
      let m;
      if ((m = /^random\(0, 4294967296, (-?[0-9.e+]+)\)$/.exec(c.formula))) { eq(c.result, refMix(Number(m[1])), c.name); checked++; }
      if ((m = /^pick\(\[((?:'[a-e]'(?:, )?)+)\], (-?[0-9.e+]+)\)$/.exec(c.formula))) {
        const list = m[1].split(', ').map(s => s.slice(1, -1));
        eq(c.result, list[refMix(Number(m[2])) % list.length], c.name); checked++;
      }
      if ((m = /^shuffle\(\[([0-9, ]+)\], (-?[0-9.e+]+)\)$/.exec(c.formula))) { eq(c.result, refShuffle(m[1].split(', ').map(Number), Number(m[2])), c.name); checked++; }
      if ((m = /^random\((-?[0-9.e+]+), (-?[0-9.e+]+), (-?[0-9.e+]+)\)$/.exec(c.formula))) {
        const [lo, hi, seed] = m.slice(1).map(Number);
        eq(c.result, lo + ((hi - lo) * refMix(seed)) / 4294967296, c.name); checked++;
      }
    }
    ok(checked >= 50, `${checked} seeded cases checked`);
    eq(refMix(0), 0);
  },
};
