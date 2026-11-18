// Writes the formula conformance files (spec/2.0/conformance/formula/, 5.6.8): one JSON file per area of the formula
// language (5.6, 5.7). Each case is a formula or a template, the values it reads, and the result or the error code.
// The cases are written here; the engine gives every result. A case with `expect` (or `expectError`) states what the
// spec says outright: the tool stops when the engine gives something else. tests/formula-conformance.test.mjs runs
// every case in the files and checks that the files are what this tool makes.
// Usage: node engine/v2/tools/make-formula-conformance.mjs [--check]
//   --check  write nothing; exit 1 when a file differs from what this tool makes
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseTemplate, evaluate, renderTemplate, FUNCTIONS } from '../src/formula.mjs';
import { jsonUnits } from '../src/limits-runtime.mjs';
import { FORMAT } from '../src/limits.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
export const folder = path.join(repo, 'spec', '2.0', 'conformance', 'formula');
export const FORMAT_ID = 'hsvg-formula-cases/1';

// ---------- the runner: one case, read as the README says ----------
// A case's scope: `values` (names), `builtins` (what hsvg.<name> reads, and a bare name no value has), `states` (the
// active machine states), `language` and `words` (the active language's words). Words are templates, expanded in the
// case's own scope. Returns {result, steps} or {error, stage, steps}: steps is the work steps of 5.6.6 the evaluation
// counted (for a template, all its spans and the words they expand), up to the fault for an error; a parse error has
// no steps.
export function runCase(c) {
  const values = c.values || {};
  const builtins = c.builtins || {};
  const unknown = (n) => { const e = new Error(`unknown name ${n}`); e.code = 'E-FORMULA'; throw e; };
  const budget = { steps: 0 };
  const scope = {
    name: (n) => (Object.hasOwn(values, n) ? values[n] : Object.hasOwn(builtins, n) ? builtins[n] : unknown(n)),
    builtin: (n) => (Object.hasOwn(builtins, n) ? builtins[n] : unknown(n)),
    active: (id) => (c.states || []).includes(id),
    words: c.words,
    language: c.language,
    template: (w) => renderTemplate(w, scope, budget),
  };
  let stage = 'parse';
  try {
    if ('template' in c) parseTemplate(c.template); else parse(c.formula);
    stage = 'evaluate';
    const v = 'template' in c ? renderTemplate(c.template, scope, budget) : evaluate(parse(c.formula), scope, budget);
    // The result size (5.6.6), as the engine checks every result it keeps (limits-runtime.mjs).
    if (jsonUnits(v, FORMAT.formulaResultUnits) > FORMAT.formulaResultUnits) { const e = new Error('result size'); e.code = 'E-RANGE'; throw e; }
    if (v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return { result: v === undefined ? 'undefined' : String(v), invalid: true };
    return { result: v, steps: budget.steps };
  } catch (e) {
    if (!e.code) throw e;
    // The work steps counted when an evaluation faults; a parse error has none (5.6.6).
    return stage === 'evaluate' ? { error: e.code, stage, steps: budget.steps } : { error: e.code, stage };
  }
}

// Two results are the same: numbers by value (-0 is 0), arrays in order, objects by keys. A case marked `math` allows
// a difference in the last bits (4 units in the last place), since the platform's maths library gives it (see README).
export function sameResult(a, b, math = false) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return true;
    if (!math) return false;
    const ulp = Math.max(Number.EPSILON * Math.max(Math.abs(a), Math.abs(b)), Number.MIN_VALUE);
    return Math.abs(a - b) <= 4 * ulp;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => sameResult(x, b[i], math));
  const ka = Object.keys(a); const kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.hasOwn(b, k) && sameResult(a[k], b[k], math));
}

// Whether a case passes: the runner gives its result, or its error code and stage.
export function casePasses(c) {
  const got = runCase(c);
  if (got.steps !== c.steps) return `expected ${c.steps ?? 'no'} work steps, got ${got.steps ?? 'none'}`;
  if ('error' in c) return got.error === c.error && got.stage === c.stage ? null : `expected ${c.error} (${c.stage}), got ${JSON.stringify(got)}`;
  if ('error' in got) return `expected ${JSON.stringify(c.result)}, got ${got.error} (${got.stage})`;
  return sameResult(got.result, c.result, (c.platform || []).includes('math')) ? null : `expected ${JSON.stringify(c.result)}, got ${JSON.stringify(got.result)}`;
}

// ---------- the cases ----------
// Short forms: f formula, t template, v values, b builtins, s states, lang language, w words, x expected result (the
// spec states it), xe expected error code, xs expected work steps (5.6.6 states them), p platform tags. n is the case
// name.
const big = 1e308;
const zeros = (k) => new Array(k).fill(0);
const nestedParens = (d) => '('.repeat(d) + '1' + ')'.repeat(d);
const ones = (k) => new Array(k).fill('1').join('+');
const WORDS = { 'lives.one': '{{ n }} life', 'lives.other': '{{ n }} lives', decimalMark: ',', groupMark: '.' };
// Whitespace in formulas (5.6.2, D62): exactly the 25 characters JavaScript's \s matches. NOT_WHITESPACE: characters
// often taken for whitespace that are not.
export const WHITESPACE = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
  0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff];
export const NOT_WHITESPACE = [0x85, 0x180e, 0x200b, 0x2060];
const hex4 = (c) => c.toString(16).toUpperCase().padStart(4, '0');
const PLURAL_ALL = { 'x.zero': 'zero', 'x.one': 'one', 'x.two': 'two', 'x.few': 'few', 'x.many': 'many', 'x.other': 'other' };

export const AREAS = {
  arithmetic: {
    title: 'Arithmetic: + - * /, unary signs, number literals and precedence',
    spec: ['5.6.2', '5.6.3'],
    cases: [
      { n: 'add', f: '1 + 2', x: 3 },
      { n: 'subtract', f: '5 - 8', x: -3 },
      { n: 'multiply', f: '6 * 7', x: 42 },
      { n: 'divide', f: '7 / 2', x: 3.5 },
      { n: 'product before sum', f: '1 + 2 * 3', x: 7 },
      { n: 'brackets first', f: '(1 + 2) * 3', x: 9 },
      { n: 'left to right: minus', f: '10 - 4 - 3', x: 3 },
      { n: 'left to right: divide', f: '8 / 4 / 2', x: 1 },
      { n: 'unary minus', f: '-5 + 2', x: -3 },
      { n: 'unary minus twice', f: '- -5', x: 5 },
      { n: 'unary plus', f: '+5', x: 5 },
      { n: 'unary binds tighter than *', f: '-2 * 3', x: -6 },
      { n: 'IEEE double sum', f: '0.1 + 0.2', x: 0.30000000000000004 },
      { n: 'IEEE double product', f: '1.1 * 3', x: 3.3000000000000003 },
      { n: 'exact division', f: '1 / 3', x: 1 / 3 },
      { n: 'reads values', f: 'a * b + c', v: { a: 2, b: 3, c: 4 }, x: 10 },
      { n: 'number with exponent', f: '1.5e3', x: 1500 },
      { n: 'number with negative exponent', f: '25E-1', x: 2.5 },
      { n: 'number with plus exponent', f: '2e+2', x: 200 },
      { n: 'largest double', f: '1.7976931348623157e308', x: 1.7976931348623157e308 },
      { n: 'smallest double', f: '5e-324', x: 5e-324 },
      { n: 'underflow to zero', f: '1e-400', x: 0 },
      { n: 'literal of 21 digits, read correctly rounded', f: '123456789012345678901', x: 123456789012345680000 },
      { n: 'literal of 25 digits, read correctly rounded', f: '0.1000000000000000055511151231257827', x: 0.1 },
      { n: 'a literal too large is not finite', f: '1e999', xe: 'E-FORMULA' },
      { n: 'division by zero', f: '1 / 0', xe: 'E-FORMULA' },
      { n: 'division by minus zero', f: '1 / -0', xe: 'E-FORMULA' },
      { n: 'zero divided by zero', f: '0 / 0', xe: 'E-FORMULA' },
      { n: 'overflow of a sum faults', f: 'big + big', v: { big }, xe: 'E-FORMULA' },
      { n: 'overflow of a product faults', f: 'big * 10', v: { big }, xe: 'E-FORMULA' },
      { n: 'overflow of a difference faults', f: '-big - big', v: { big }, xe: 'E-FORMULA' },
      { n: 'overflow of a quotient faults', f: 'big / 0.1', v: { big }, xe: 'E-FORMULA' },
      { n: 'minus zero is zero', f: '-0', x: 0 },
      { n: 'minus zero equals zero', f: '-0 === 0', x: true },
      { n: 'number plus boolean', f: '1 + true', xe: 'E-FORMULA' },
      { n: 'number minus text', f: "5 - '2'", xe: 'E-FORMULA' },
      { n: 'text times number', f: "'2' * 3", xe: 'E-FORMULA' },
      { n: 'null plus number', f: '1 + null', xe: 'E-FORMULA' },
      { n: 'array plus number', f: '[1] + 1', xe: 'E-FORMULA' },
      { n: 'unary minus of text', f: "-'a'", xe: 'E-FORMULA' },
      { n: 'unary plus of a boolean', f: '+true', xe: 'E-FORMULA' },
      { n: 'unary minus of null', f: '-null', xe: 'E-FORMULA' },
    ],
  },
  comparison: {
    title: 'Comparison and truthiness: === !== < <= > >=, && || ! and ? :',
    spec: ['5.6.2', '5.6.3'],
    cases: [
      { n: 'equal numbers', f: '2 === 2.0', x: true },
      { n: 'unequal numbers', f: '2 !== 3', x: true },
      { n: 'equal text', f: "'a' === 'a'", x: true },
      { n: 'quotes do not matter', f: `'a' === "a"`, x: true },
      { n: 'different types are not equal', f: "1 === '1'", x: false },
      { n: 'boolean and number are not equal', f: 'true === 1', x: false },
      { n: 'null equals null', f: 'null === null', x: true },
      { n: 'null is not false', f: 'null === false', x: false },
      { n: 'null is not zero', f: 'null !== 0', x: true },
      { n: 'arrays by deep equality', f: '[1, [2, 3]] === [1, [2, 3]]', x: true },
      { n: 'arrays in order', f: '[1, 2] === [2, 1]', x: false },
      { n: 'arrays of different lengths', f: '[1, 2] === [1, 2, 3]', x: false },
      { n: 'objects by deep equality, any key order', f: '{"a": 1, "b": [true]} === {"b": [true], "a": 1}', x: true },
      { n: 'objects with a key more', f: '{"a": 1} === {"a": 1, "b": 2}', x: false },
      { n: 'object is not array', f: '{} === []', x: false },
      { n: 'empty arrays', f: '[] === []', x: true },
      { n: 'values compared deeply', f: 'a === b', v: { a: { k: [1, { z: null }] }, b: { k: [1, { z: null }] } }, x: true },
      { n: 'less than', f: '1 < 2', x: true },
      { n: 'less or equal', f: '2 <= 2', x: true },
      { n: 'greater than', f: '-1 > -2', x: true },
      { n: 'greater or equal', f: '1 >= 1.5', x: false },
      { n: 'comparison before equality', f: '1 < 2 === true', x: true },
      { n: 'sum before comparison', f: '1 + 1 > 1', x: true },
      { n: 'comparison of text faults', f: "'a' < 'b'", xe: 'E-FORMULA' },
      { n: 'comparison of booleans faults', f: 'false < true', xe: 'E-FORMULA' },
      { n: 'comparison with null faults', f: 'null >= 0', xe: 'E-FORMULA' },
      { n: 'and', f: 'true && false', x: false },
      { n: 'or', f: 'false || true', x: true },
      { n: 'not', f: '!false', x: true },
      { n: 'not not', f: '!!true', x: true },
      { n: 'and before or', f: 'true || false && false', x: true },
      { n: 'and is lazy: the skipped side cannot fault', f: 'false && 1 / 0 > 0', x: false },
      { n: 'or is lazy: the skipped side cannot fault', f: 'true || missing', x: true },
      { n: 'and needs booleans: a number', f: '1 && true', xe: 'E-FORMULA' },
      { n: 'and needs booleans on the right', f: 'true && 1', xe: 'E-FORMULA' },
      { n: 'or needs booleans: text', f: "'' || true", xe: 'E-FORMULA' },
      { n: 'or needs booleans: null', f: 'false || null', xe: 'E-FORMULA' },
      { n: 'not needs a boolean: zero', f: '!0', xe: 'E-FORMULA' },
      { n: 'not needs a boolean: empty text', f: "!''", xe: 'E-FORMULA' },
      { n: 'not needs a boolean: null', f: '!null', xe: 'E-FORMULA' },
      { n: 'conditional', f: "a > 2 ? 'big' : 'small'", v: { a: 3 }, x: 'big' },
      { n: 'conditional, other branch', f: "a > 2 ? 'big' : 'small'", v: { a: 1 }, x: 'small' },
      { n: 'conditional is right associative', f: "a === 1 ? 'one' : a === 2 ? 'two' : 'many'", v: { a: 2 }, x: 'two' },
      { n: 'conditional is lazy', f: 'true ? 1 : 1 / 0', x: 1 },
      { n: 'conditional is lazy on the other side', f: 'false ? missing : 2', x: 2 },
      { n: 'conditional needs a boolean', f: "1 ? 'a' : 'b'", xe: 'E-FORMULA' },
      { n: 'conditional on null faults', f: "null ? 'a' : 'b'", xe: 'E-FORMULA' },
      { n: 'conditional has the lowest precedence', f: 'true || false ? 1 : 2', x: 1 },
    ],
  },
  rounding: {
    title: 'Rounding and bounds: floor, ceil, round, clamp, min, max',
    spec: ['5.6.4'],
    cases: [
      { n: 'floor', f: 'floor(2.7)', x: 2 },
      { n: 'floor of a negative', f: 'floor(-2.1)', x: -3 },
      { n: 'ceil', f: 'ceil(2.1)', x: 3 },
      { n: 'ceil of a negative', f: 'ceil(-2.7)', x: -2 },
      { n: 'ceil to minus zero is zero', f: 'ceil(-0.5)', x: 0 },
      { n: 'round down', f: 'round(2.4)', x: 2 },
      { n: 'round up', f: 'round(2.6)', x: 3 },
      { n: 'round tie toward +infinity', f: 'round(2.5)', x: 3 },
      { n: 'round negative tie toward +infinity', f: 'round(-2.5)', x: -2 },
      { n: 'round tie at one half', f: 'round(0.5)', x: 1 },
      { n: 'round tie at minus one half', f: 'round(-0.5)', x: 0 },
      { n: 'round negative below a tie', f: 'round(-2.6)', x: -3 },
      { n: 'round negative above a tie', f: 'round(-2.4)', x: -2 },
      { n: 'round tie example of the spec', f: 'round(2.5) + round(-2.5)', x: 1 },
      { n: 'round: the double just below one half is not a tie', f: 'round(0.49999999999999994)', x: 0 },
      { n: 'round: the double just above minus one half', f: 'round(-0.49999999999999994)', x: 0 },
      { n: 'round: an integer above 2^52 stays', f: 'round(4503599627370497)', x: 4503599627370497 },
      { n: 'round: a negative integer above 2^52 stays', f: 'round(-4503599627370497)', x: -4503599627370497 },
      { n: 'round: a tie just below 2^52', f: 'round(4503599627370495.5)', x: 4503599627370496 },
      { n: 'round: a negative tie just below 2^52', f: 'round(-4503599627370495.5)', x: -4503599627370495 },
      { n: 'round of a large number', f: 'round(1e300)', x: 1e300 },
      { n: 'round of the smallest double', f: 'round(5e-324)', x: 0 },
      { n: 'round of an integer', f: 'round(-3)', x: -3 },
      { n: 'floor needs a number', f: "floor('2')", xe: 'E-FORMULA' },
      { n: 'round needs a number', f: 'round(true)', xe: 'E-FORMULA' },
      { n: 'ceil needs a number', f: 'ceil(null)', xe: 'E-FORMULA' },
      { n: 'clamp inside', f: 'clamp(5, 0, 10)', x: 5 },
      { n: 'clamp below', f: 'clamp(-31, -20, 20)', x: -20 },
      { n: 'clamp above', f: 'clamp(angle, -20, 20)', v: { angle: 31 }, x: 20 },
      { n: 'clamp with low equal to high', f: 'clamp(3, 2, 2)', x: 2 },
      { n: 'clamp with low above high faults', f: 'clamp(1, 3, 2)', xe: 'E-FORMULA' },
      { n: 'clamp needs numbers', f: "clamp('1', 0, 2)", xe: 'E-FORMULA' },
      { n: 'min of one', f: 'min(4)', x: 4 },
      { n: 'min of several', f: 'min(speed, 10, 3.5)', v: { speed: 12 }, x: 3.5 },
      { n: 'max of several', f: 'max(-1, -5, -0.5)', x: -0.5 },
      { n: 'min of 32 numbers', f: `min(${Array.from({ length: 32 }, (_, i) => 32 - i).join(', ')})`, x: 1 },
      { n: 'min of 33 numbers is refused', f: `min(${Array.from({ length: 33 }, (_, i) => i).join(', ')})`, xe: 'E-FORMULA' },
      { n: 'max of none is refused', f: 'max()', xe: 'E-FORMULA' },
      { n: 'min needs numbers', f: 'min(1, true)', xe: 'E-FORMULA' },
      { n: 'max of an array faults', f: 'max([1, 2])', xe: 'E-FORMULA' },
      { n: 'min of zero and minus zero', f: 'min(0, -0) === 0', x: true },
    ],
  },
  remainder: {
    title: 'Remainder: % is the truncated remainder',
    spec: ['5.6.3'],
    cases: [
      { n: 'positive', f: '7 % 3', x: 1 },
      { n: 'negative left: sign follows the left operand', f: '-7 % 3', x: -1 },
      { n: 'negative right', f: '7 % -3', x: 1 },
      { n: 'both negative', f: '-7 % -3', x: -1 },
      { n: 'exact multiple', f: '9 % 3', x: 0 },
      { n: 'negative exact multiple is zero', f: '-9 % 3', x: 0 },
      { n: 'left smaller than right', f: '2 % 5', x: 2 },
      { n: 'negative left smaller than right', f: '-2 % 5', x: -2 },
      { n: 'zero left', f: '0 % 5', x: 0 },
      { n: 'non-integer left', f: '5.5 % 2', x: 1.5 },
      { n: 'non-integer right', f: '7 % 2.5', x: 2 },
      { n: 'negative non-integer', f: '-5.5 % 2', x: -1.5 },
      { n: 'both non-integer', f: '5.25 % 0.5', x: 0.25 },
      { n: 'exact for doubles: 0.3 % 0.1', f: '0.3 % 0.1', x: 0.09999999999999998 },
      { n: 'exact for doubles: 1 % 0.1', f: '1 % 0.1', x: 0.09999999999999995 },
      { n: 'large left', f: '1e17 % 7', x: 1e17 % 7 },
      { n: 'very large left', f: '1e300 % 360', x: 1e300 % 360 },
      { n: 'large right', f: '5 % 1e300', x: 5 },
      { n: 'tiny right', f: '1 % 5e-324', x: 0 },
      { n: 'same precedence as *, left to right', f: '10 % 4 * 3', x: 6 },
      { n: 'binds tighter than +', f: '1 + 10 % 4', x: 3 },
      { n: 'remainder by zero', f: '5 % 0', xe: 'E-FORMULA' },
      { n: 'remainder by minus zero', f: '5 % -0', xe: 'E-FORMULA' },
      { n: 'remainder needs numbers', f: "'7' % 3", xe: 'E-FORMULA' },
      { n: 'remainder needs a number on the right', f: '7 % true', xe: 'E-FORMULA' },
    ],
  },
  random: {
    title: 'Seeded randomness: pick, shuffle, random and the mixer',
    spec: ['5.6.4', '5.6.5'],
    // random(0, 4294967296, seed) is mix(seed) exactly: (2^32 * mix) / 2^32.
    cases: [
      ...[0, 1, 2, 42, 4294967295, 4294967296, 4294967297, -1, -4294967296, 1.9, -1.9, 0.5, -0.5, 2 ** 53, 2 ** 53 + 2, 1e21, -1e21, 1e300, 1.7976931348623157e308, -1.7976931348623157e308, 5e-324, 123456789.987]
        .map(seed => ({ n: `mix(${seed}) as random(0, 2^32, seed)`, f: `random(0, 4294967296, ${seed})` })),
      { n: 'mix of 0 is 0', f: 'random(0, 4294967296, 0)', x: 0 },
      { n: 'fractional seeds truncate toward zero', f: 'random(0, 4294967296, 1.9) === random(0, 4294967296, 1)', x: true },
      { n: 'negative fractional seeds truncate toward zero', f: 'random(0, 4294967296, -1.9) === random(0, 4294967296, -1)', x: true },
      { n: 'seed minus one half is seed zero', f: 'random(0, 4294967296, -0.5)', x: 0 },
      { n: 'seeds are taken modulo 2^32', f: 'random(0, 4294967296, 4294967297) === random(0, 4294967296, 1)', x: true },
      { n: 'negative seeds are taken modulo 2^32', f: 'random(0, 4294967296, -1) === random(0, 4294967296, 4294967295)', x: true },
      { n: 'random between 0 and 1', f: 'random(0, 1, 42)' },
      { n: 'random between 10 and 20', f: 'random(10, 20, 7)' },
      { n: 'random with max below min', f: 'random(20, 10, 7)' },
      { n: 'random with min equal to max', f: 'random(5, 5, 99)', x: 5 },
      { n: 'random over a large range: (max - min) * mix(seed) overflows, so it faults', f: 'random(-1e300, 1e300, 3)', xe: 'E-FORMULA' },
      { n: 'random over a large range whose product stays finite', f: 'random(-1e290, 1e290, 3)' },
      { n: 'random whose range is not finite faults', f: 'random(-big, big, 1)', v: { big }, xe: 'E-FORMULA' },
      { n: 'random whose range is not finite faults, seed 0', f: 'random(-big, big, 0)', v: { big }, xe: 'E-FORMULA' },
      { n: 'random needs numbers', f: "random(0, 1, '1')", xe: 'E-FORMULA' },
      { n: 'random reads values', f: 'random(lo, hi, seed)', v: { lo: -1, hi: 1, seed: 2026 } },
      { n: 'pick', f: "pick(['a', 'b', 'c'], 0)", x: 'a' },
      ...[1, 2, 3, 7, -1, -7, 0.5, 9.99, 4294967296, 2 ** 53, 1e300, -1e300].map(seed => ({ n: `pick of five, seed ${seed}`, f: `pick(['a', 'b', 'c', 'd', 'e'], ${seed})` })),
      { n: 'pick of one', f: 'pick([9], 12345)', x: 9 },
      { n: 'pick from a long list', f: 'pick(range(1024), 77)' },
      { n: 'pick from an empty list faults', f: 'pick([], 1)', xe: 'E-FORMULA' },
      { n: 'pick needs a number seed', f: 'pick([1], true)', xe: 'E-FORMULA' },
      { n: 'pick needs an array', f: "pick('abc', 1)", xe: 'E-FORMULA' },
      ...[0, 1, 2, 7, -1, -7, 2.5, -2.5, 4294967296, 2 ** 53, 1e21, 1e300].map(seed => ({ n: `shuffle of five, seed ${seed}`, f: `shuffle([1, 2, 3, 4, 5], ${seed})` })),
      { n: 'shuffle of ten', f: 'shuffle(range(10), 42)' },
      { n: 'shuffle of 1024', f: 'sum(shuffle(range(1024), 3), item * index)' },
      { n: 'shuffle forms seed + k before it truncates: seed -0.5 is not seed 0', f: 'shuffle([1, 2, 3, 4, 5], -0.5)' },
      { n: 'shuffle of an empty list', f: 'shuffle([], 1)', x: [] },
      { n: 'shuffle of one', f: 'shuffle([1], 1)', x: [1] },
      { n: 'shuffle keeps the items', f: 'sort(shuffle([3, 1, 2, 2], 9), item)', x: [1, 2, 2, 3] },
      { n: 'shuffle never changes its input', f: 'fold([0], xs, shuffle(acc, 5)) === xs || xs === [1, 2, 3]', v: { xs: [1, 2, 3] }, x: true },
      { n: 'shuffle of objects', f: 'shuffle([{"k": 1}, {"k": 2}, {"k": 3}], 11)' },
      { n: 'shuffle needs an array', f: 'shuffle(5, 1)', xe: 'E-FORMULA' },
      { n: 'shuffle needs a number seed', f: "shuffle([1], 'a')", xe: 'E-FORMULA' },
    ],
  },
  text: {
    title: 'Text: strings, escapes, joining with +, length and index by code point, templates',
    spec: ['5.6.1', '5.6.2', '5.6.3', '5.7'],
    cases: [
      { n: 'single quotes', f: "'Fox at dawn'", x: 'Fox at dawn' },
      { n: 'double quotes', f: '"Fox"', x: 'Fox' },
      { n: 'empty text', f: "''", x: '' },
      { n: 'escaped single quote inside single quotes', f: "'it\\'s'", x: "it's" },
      { n: 'double quote inside single quotes', f: `'say "hi"'`, x: 'say "hi"' },
      { n: 'escaped double quote inside double quotes', f: '"say \\"hi\\""', x: 'say "hi"' },
      { n: 'JSON escapes', f: "'a\\nb\\tc\\\\d\\/e'", x: 'a\nb\tc\\d/e' },
      { n: 'escapes b, f and r', f: "'\\b\\f\\r'", x: '\b\f\r' },
      { n: 'unicode escape', f: "'\\u00e9'", x: 'é' },
      { n: 'unicode escape, upper case hex', f: "'\\u00C9'", x: 'É' },
      { n: 'a surrogate pair from two escapes', f: "'\\ud83d\\ude00'", x: '😀' },
      { n: 'escaped single quote inside double quotes is refused', f: `"it\\'s"`, xe: 'E-FORMULA' },
      { n: 'unknown escape', f: "'\\x41'", xe: 'E-FORMULA' },
      { n: 'short unicode escape', f: "'\\u12'", xe: 'E-FORMULA' },
      { n: 'raw control character in text', f: "'a\nb'", xe: 'E-FORMULA' },
      { n: 'raw tab in text', f: "'a\tb'", xe: 'E-FORMULA' },
      { n: 'unterminated text', f: "'abc", xe: 'E-FORMULA' },
      { n: 'join two strings', f: "'a' + 'b'", x: 'ab' },
      { n: 'join text and a number', f: "'Score ' + score + ' of 9'", v: { score: 3 }, x: 'Score 3 of 9' },
      { n: 'number then text', f: "2.5 + ' kg'", x: '2.5 kg' },
      { n: 'two numbers add, then join', f: "1 + 2 + 'x'", x: '3x' },
      { n: 'text first, then numbers join', f: "'x' + 1 + 2", x: 'x12' },
      { n: 'two values side by side start from text', f: "'' + hours + minutes", v: { hours: 9, minutes: 5 }, x: '95' },
      { n: 'joined number in shortest form', f: "'' + 0.1 * 3", x: '0.30000000000000004' },
      { n: 'joined large number has no exponent', f: "'' + 1e21", x: '1000000000000000000000' },
      { n: 'joined small number has no exponent', f: "'' + 1.5e-7", x: '0.00000015' },
      { n: 'joined minus zero prints 0', f: "'' + -0", x: '0' },
      { n: 'text plus boolean faults', f: "'a' + true", xe: 'E-FORMULA' },
      { n: 'text plus null faults', f: "'a' + null", xe: 'E-FORMULA' },
      { n: 'text plus array faults', f: "'a' + [1]", xe: 'E-FORMULA' },
      { n: 'text plus object faults', f: "'a' + {}", xe: 'E-FORMULA' },
      { n: 'text minus text faults', f: "'a' - 'b'", xe: 'E-FORMULA' },
      { n: 'length in code points', f: "length('héllo')", x: 5 },
      { n: 'length of empty text', f: "length('')", x: 0 },
      { n: 'length counts a character above U+FFFF once', f: "length('a😀b')", x: 3 },
      { n: 'length of a flag (two code points)', f: "length('🇫🇷')", x: 2 },
      { n: 'length of a combining sequence (two code points)', f: "length('e\\u0301')", x: 2 },
      { n: 'length counts a lone surrogate once', f: "length('a\\ud800b')", x: 3 },
      { n: 'length of a lone low surrogate then a high one', f: "length('\\udc00\\ud800')", x: 2 },
      { n: 'index by code point', f: "s[1]", v: { s: 'héllo' }, x: 'é' },
      { n: 'index after a character above U+FFFF', f: "'a😀b'[2]", x: 'b' },
      { n: 'index gives the whole pair', f: "'a😀b'[1]", x: '😀' },
      { n: 'index of the first code point', f: "'abc'[0]", x: 'a' },
      { n: 'index past the end faults', f: "'abc'[3]", xe: 'E-FORMULA' },
      { n: 'negative index faults', f: "'abc'[-1]", xe: 'E-FORMULA' },
      { n: 'non-integer index faults', f: "'abc'[1.5]", xe: 'E-FORMULA' },
      { n: 'text key on text faults', f: "'abc'['length']", xe: 'E-FORMULA' },
      { n: 'no Unicode normalization: composed and decomposed differ', f: "'\\u00e9' === 'e\\u0301'", x: false },
      { n: 'equality is by UTF-16 units, case matters', f: "'A' === 'a'", x: false },
      { n: 'template with a number', t: 'Score {{ score }} of {{ total }}', v: { score: 3, total: 9 }, x: 'Score 3 of 9' },
      { n: 'template with text', t: 'Hello {{ name }}!', v: { name: 'Ada' }, x: 'Hello Ada!' },
      { n: 'template with a boolean', t: 'On: {{ on }}', v: { on: true }, x: 'On: true' },
      { n: 'template with no spans', t: 'Plain words', x: 'Plain words' },
      { n: 'template number in shortest form', t: '{{ 1 / 3 }}', x: '0.3333333333333333' },
      { n: 'template large number has no exponent', t: '{{ 2e21 }}', x: '2000000000000000000000' },
      { n: 'template minus zero prints 0', t: '{{ -0 }}', x: '0' },
      { n: 'template braces inside quotes', t: "{{ '}}' }}", x: '}}' },
      { n: 'template braces inside an object', t: '{{ {"a": 1}.a }}', x: '1' },
      { n: 'template escaped braces', t: '\\{{ not a span \\}}', x: '{{ not a span }}' },
      { n: 'template cannot print null', t: '{{ null }}', xe: 'E-FORMULA' },
      { n: 'template cannot print an array', t: '{{ [1] }}', xe: 'E-FORMULA' },
      { n: 'template cannot print an object', t: '{{ {} }}', xe: 'E-FORMULA' },
      { n: 'template unclosed span', t: 'Score {{ score', xe: 'E-FORMULA' },
      { n: 'template span that does not parse', t: '{{ 1 + }}', xe: 'E-FORMULA' },
    ],
  },
  'number-text': {
    title: 'Numbers as text: numberText and formatNumber',
    spec: ['5.6.4', '5.7'],
    cases: [
      { n: 'spec example: 2.675 to 2 places', f: 'numberText(2.675, 2)', x: '2.68' },
      { n: 'spec example: -2.675 to 2 places', f: 'numberText(-2.675, 2)', x: '-2.67' },
      { n: 'rounds the shortest decimal, not the double: 1.005', f: 'numberText(1.005, 2)', x: '1.01' },
      { n: 'half up at 0 places', f: 'numberText(0.5, 0)', x: '1' },
      { n: 'negative half at 0 places', f: 'numberText(-0.5, 0)', x: '0' },
      { n: 'negative 1.5 at 0 places', f: 'numberText(-1.5, 0)', x: '-1' },
      { n: 'negative above half rounds away from zero', f: 'numberText(-1.51, 0)', x: '-2' },
      { n: 'positive below half', f: 'numberText(2.4999, 0)', x: '2' },
      { n: 'pads with zeros', f: 'numberText(3, 2)', x: '3.00' },
      { n: 'pads a fraction', f: 'numberText(0.1, 3)', x: '0.100' },
      { n: 'whole number at 0 places', f: 'numberText(1234567, 0)', x: '1234567' },
      { n: 'carry through nines', f: 'numberText(9.995, 2)', x: '10.00' },
      { n: 'carry to a new digit', f: 'numberText(99.5, 0)', x: '100' },
      { n: 'negative carry', f: 'numberText(-9.996, 2)', x: '-10.00' },
      { n: '8 places', f: 'numberText(1 / 3, 8)', x: '0.33333333' },
      { n: '8 places, half', f: 'numberText(0.000000005, 8)', x: '0.00000001' },
      { n: '8 places, negative half', f: 'numberText(-0.000000005, 8)', x: '0.00000000' },
      { n: 'a negative that rounds to zero has no minus sign', f: 'numberText(-0.001, 2)', x: '0.00' },
      { n: 'minus zero', f: 'numberText(-0, 2)', x: '0.00' },
      { n: 'minus zero at 0 places', f: 'numberText(-0, 0)', x: '0' },
      { n: 'very large: 1e21 in plain digits', f: 'numberText(1e21, 0)', x: '1000000000000000000000' },
      { n: 'very large with places', f: 'numberText(1.5e22, 1)', x: '15000000000000000000000.0' },
      { n: 'largest double', f: 'numberText(1.7976931348623157e308, 0)', x: '17976931348623157' + '0'.repeat(292) },
      { n: 'very small: 1e-7', f: 'numberText(1e-7, 8)', x: '0.00000010' },
      { n: 'very small rounds to zero', f: 'numberText(1e-9, 8)', x: '0.00000000' },
      { n: 'smallest double', f: 'numberText(5e-324, 8)', x: '0.00000000' },
      { n: 'shortest form of 0.1 + 0.2', f: 'numberText(0.1 + 0.2, 8)', x: '0.30000000' },
      { n: 'decimals 0.. 8: 9 faults', f: 'numberText(1, 9)', xe: 'E-FORMULA' },
      { n: 'decimals 0..8: -1 faults', f: 'numberText(1, -1)', xe: 'E-FORMULA' },
      { n: 'decimals are truncated toward zero', f: 'numberText(1.005, 2.9)' },
      { n: 'decimals -0.5 truncate to 0', f: 'numberText(2.5, -0.5)' },
      { n: 'numberText needs a number', f: "numberText('1', 0)", xe: 'E-FORMULA' },
      { n: 'numberText needs number decimals', f: 'numberText(1, true)', xe: 'E-FORMULA' },
      { n: 'formatNumber with no language marks', f: 'formatNumber(1234567.891, 2, true)', x: '1,234,567.89' },
      { n: 'formatNumber without grouping', f: 'formatNumber(1234567.891, 2, false)', x: '1234567.89' },
      { n: 'formatNumber with the language marks', f: 'formatNumber(price, 2, true)', v: { price: 1234.5 }, w: WORDS, x: '1.234,50' },
      { n: 'formatNumber with a decimal mark only', f: 'formatNumber(1234.5, 1, true)', w: { decimalMark: ',' }, x: '1,234,5' },
      { n: 'formatNumber negative grouped', f: 'formatNumber(-1234567, 0, true)', x: '-1,234,567' },
      { n: 'formatNumber rounds as numberText', f: 'formatNumber(-2.675, 2, false)', x: '-2.67' },
      { n: 'formatNumber of three digits has no group mark', f: 'formatNumber(999, 0, true)', x: '999' },
      { n: 'formatNumber of four digits', f: 'formatNumber(1000, 0, true)', x: '1,000' },
      { n: 'formatNumber very large', f: 'formatNumber(1e21, 0, true)', x: '1,000,000,000,000,000,000,000' },
      { n: 'formatNumber minus zero', f: 'formatNumber(-0, 1, true)', x: '0.0' },
      { n: 'formatNumber with a multi-character group mark', f: 'formatNumber(1234567, 0, true)', w: { groupMark: "'" }, x: "1'234'567" },
      { n: 'formatNumber needs a boolean', f: 'formatNumber(1, 0, 1)', xe: 'E-FORMULA' },
      { n: 'formatNumber decimals over 8 fault', f: 'formatNumber(1, 9, true)', xe: 'E-FORMULA' },
    ],
  },
  plural: {
    title: 'plural: the plural form of a count in the active language',
    spec: ['5.6.4', '2.7'],
    cases: [
      { n: 'English one', f: "plural(1, 'x')", lang: 'en', w: PLURAL_ALL, x: 'one', p: ['cldr'] },
      { n: 'English other', f: "plural(2, 'x')", lang: 'en', w: PLURAL_ALL, x: 'other', p: ['cldr'] },
      { n: 'English zero is other', f: "plural(0, 'x')", lang: 'en', w: PLURAL_ALL, x: 'other', p: ['cldr'] },
      { n: 'English minus one is one', f: "plural(-1, 'x')", lang: 'en', w: PLURAL_ALL, p: ['cldr'] },
      { n: 'English 1.5 is other', f: "plural(1.5, 'x')", lang: 'en', w: PLURAL_ALL, p: ['cldr'] },
      { n: 'English 1.0004 (the platform rounds to 3 places)', f: "plural(1.0004, 'x')", lang: 'en', w: PLURAL_ALL, p: ['cldr'] },
      { n: 'French zero is one', f: "plural(0, 'x')", lang: 'fr', w: PLURAL_ALL, p: ['cldr'] },
      { n: 'French 1.5 is one', f: "plural(1.5, 'x')", lang: 'fr', w: PLURAL_ALL, p: ['cldr'] },
      { n: 'French 2 is other', f: "plural(2, 'x')", lang: 'fr', w: PLURAL_ALL, p: ['cldr'] },
      ...[1, 2, 5, 11, 21, 22, 25, 111].map(k => ({ n: `Russian ${k}`, f: `plural(${k}, 'x')`, lang: 'ru', w: PLURAL_ALL, p: ['cldr'] })),
      ...[0, 1, 2, 3, 11, 100].map(k => ({ n: `Arabic ${k}`, f: `plural(${k}, 'x')`, lang: 'ar', w: PLURAL_ALL, p: ['cldr'] })),
      ...[1, 2, 5, 12, 22].map(k => ({ n: `Polish ${k}`, f: `plural(${k}, 'x')`, lang: 'pl', w: PLURAL_ALL, p: ['cldr'] })),
      { n: 'Japanese has only other', f: "plural(1, 'x')", lang: 'ja', w: PLURAL_ALL, p: ['cldr'] },
      { n: 'a region tag', f: "plural(1, 'x')", lang: 'en-GB', w: PLURAL_ALL, p: ['cldr'] },
      { n: 'a missing form falls back to other', f: "plural(2, 'x')", lang: 'ru', w: { 'x.one': 'one', 'x.other': 'other' }, x: 'other', p: ['cldr'] },
      { n: 'no language: one for 1', f: "plural(1, 'x')", w: PLURAL_ALL, x: 'one' },
      { n: 'no language: other for 2', f: "plural(2, 'x')", w: PLURAL_ALL, x: 'other' },
      { n: 'no language: other for 0', f: "plural(0, 'x')", w: PLURAL_ALL, x: 'other' },
      { n: 'no language: other for 1.5', f: "plural(1.5, 'x')", w: PLURAL_ALL, x: 'other' },
      { n: 'a language the platform does not know: one for 1', f: "plural(1, 'x')", lang: 'qqq', w: PLURAL_ALL, x: 'one', p: ['cldr'] },
      { n: 'a language the platform does not know: other for 0', f: "plural(0, 'x')", lang: 'qqq', w: PLURAL_ALL, x: 'other', p: ['cldr'] },
      { n: 'a word is a template, read in the same scope', f: "plural(n, 'lives')", v: { n: 3 }, lang: 'en', w: WORDS, x: '3 lives', p: ['cldr'] },
      { n: 'a word is a template: one', f: "plural(n, 'lives')", v: { n: 1 }, lang: 'en', w: WORDS, x: '1 life', p: ['cldr'] },
      { n: 'no other form faults', f: "plural(2, 'x')", lang: 'en', w: { 'x.one': 'one' }, xe: 'E-FORMULA', p: ['cldr'] },
      { n: 'no word at all faults', f: "plural(1, 'y')", w: PLURAL_ALL, xe: 'E-FORMULA' },
      { n: 'plural needs a number', f: "plural('1', 'x')", w: PLURAL_ALL, xe: 'E-FORMULA' },
      { n: 'plural needs a word id', f: 'plural(1, 2)', w: PLURAL_ALL, xe: 'E-FORMULA' },
      { n: 'plural in a template', t: 'You have {{ plural(n, "lives") }}', v: { n: 2 }, lang: 'en', w: WORDS, x: 'You have 2 lives', p: ['cldr'] },
    ],
  },
  lists: {
    title: 'Lists and objects: literals, members, length, at, includes, lookup, append, range and the row functions',
    spec: ['5.6.2', '5.6.3', '5.6.4'],
    cases: [
      { n: 'array literal', f: '[1, "a", true, null, [2], {"k": 3}]', x: [1, 'a', true, null, [2], { k: 3 }] },
      { n: 'empty array', f: '[]', x: [] },
      { n: 'object literal', f: '{"a": 1, \'b\': [2]}', x: { a: 1, b: [2] } },
      { n: 'empty object', f: '{}', x: {} },
      { n: 'object key that is not text is refused', f: '{1: 2}', xe: 'E-FORMULA' },
      { n: 'object key __proto__ is refused', f: '{"__proto__": 1}', xe: 'E-FORMULA' },
      { n: 'trailing comma is refused', f: '[1, 2,]', xe: 'E-FORMULA' },
      { n: 'member by dot', f: 'o.n', v: { o: { n: 2 } }, x: 2 },
      { n: 'member by text key', f: "o['k'] + o.n", v: { o: { k: 1, n: 2 } }, x: 3 },
      { n: 'member by computed key', f: "o['a' + 'b']", v: { o: { ab: 'yes' } }, x: 'yes' },
      { n: 'nested members', f: 'rows[1].v[0]', v: { rows: [{ v: [1] }, { v: [2] }] }, x: 2 },
      { n: 'array index', f: 'xs[2]', v: { xs: [10, 20, 30] }, x: 30 },
      { n: 'array index from a formula', f: 'xs[1 + 1]', v: { xs: [10, 20, 30] }, x: 30 },
      { n: 'array index past the end faults', f: 'xs[3]', v: { xs: [10, 20, 30] }, xe: 'E-FORMULA' },
      { n: 'negative array index faults', f: 'xs[-1]', v: { xs: [10, 20, 30] }, xe: 'E-FORMULA' },
      { n: 'non-integer array index faults', f: 'xs[0.5]', v: { xs: [10, 20, 30] }, xe: 'E-FORMULA' },
      { n: 'text index on an array faults', f: "xs['0']", v: { xs: [10] }, xe: 'E-FORMULA' },
      { n: 'missing member faults', f: 'o.y', v: { o: {} }, xe: 'E-FORMULA' },
      { n: 'member of null faults', f: 'o.y', v: { o: null }, xe: 'E-FORMULA' },
      { n: 'member of a number faults', f: 'n.y', v: { n: 1 }, xe: 'E-FORMULA' },
      { n: 'number key on an object faults', f: 'o[0]', v: { o: { 0: 'a' } }, xe: 'E-FORMULA' },
      { n: 'computed key __proto__ is refused', f: "o['__proto__']", v: { o: {} }, xe: 'E-FORMULA' },
      { n: 'computed key constructor is refused', f: "o['con' + 'structor']", v: { o: {} }, xe: 'E-FORMULA' },
      { n: 'length of an array', f: 'length(choices)', v: { choices: [1, 2, 3] }, x: 3 },
      { n: 'length of an empty array', f: 'length([])', x: 0 },
      { n: 'length of a number faults', f: 'length(5)', xe: 'E-FORMULA' },
      { n: 'length of an object faults', f: 'length({})', xe: 'E-FORMULA' },
      { n: 'at an index', f: 'at(xs, 1, 0)', v: { xs: [5, 6] }, x: 6 },
      { n: 'at past the end gives the fallback', f: 'at(choices, 2, null)', v: { choices: [1] }, x: null },
      { n: 'at a negative index gives the fallback', f: "at([1], -1, 'none')", x: 'none' },
      { n: 'at truncates the index toward zero', f: 'at([5, 6], 1.9, 0)', x: 6 },
      { n: 'at -0.5 truncates to 0', f: 'at([5, 6], -0.5, 0)', x: 5 },
      { n: 'at a text key of an object', f: "at(o, 'k', 0)", v: { o: { k: 9 } }, x: 9 },
      { n: 'at a missing key gives the fallback', f: "at(o, 'z', 0)", v: { o: { k: 9 } }, x: 0 },
      { n: 'at __proto__ gives the fallback', f: "at({}, '__proto__', 0)", x: 0 },
      { n: 'at an object needs a text key', f: 'at({"a": 1}, 1, 0)', xe: 'E-FORMULA' },
      { n: 'at an array needs a number index', f: "at([1], '0', 0)", xe: 'E-FORMULA' },
      { n: 'at on text faults', f: "at('abc', 0, '')", xe: 'E-FORMULA' },
      { n: 'includes a number', f: 'includes(seen, 3)', v: { seen: [1, 2, 3] }, x: true },
      { n: 'includes is false', f: "includes(seen, 'x')", v: { seen: [1, 2, 3] }, x: false },
      { n: 'includes compares types', f: "includes([1, 2], '1')", x: false },
      { n: 'includes null', f: 'includes([null], null)', x: true },
      { n: 'includes needs an array', f: "includes('abc', 'a')", xe: 'E-FORMULA' },
      { n: 'lookup a row', f: "lookup(rows, 'id', 'b', null).v", v: { rows: [{ id: 'a', v: 1 }, { id: 'b', v: 2 }] }, x: 2 },
      { n: 'lookup takes the first match', f: "lookup(rows, 'id', 'a', null).v", v: { rows: [{ id: 'a', v: 1 }, { id: 'a', v: 2 }] }, x: 1 },
      { n: 'lookup gives the fallback', f: "lookup(rows, 'id', 'z', {\"v\": 0})", v: { rows: [{ id: 'a', v: 1 }] }, x: { v: 0 } },
      { n: 'lookup skips rows without the column', f: "lookup(rows, 'id', 2, null)", v: { rows: [{ v: 1 }, 5, { id: 2 }] }, x: { id: 2 } },
      { n: 'lookup compares types', f: "lookup(rows, 'id', '1', 'none')", v: { rows: [{ id: 1 }] }, x: 'none' },
      { n: 'lookup needs a text column', f: 'lookup([], 1, 1, null)', xe: 'E-FORMULA' },
      { n: 'append', f: 'append(j, 3, 2)', v: { j: [1, 2] }, x: [2, 3] },
      { n: 'append keeps all when under the maximum', f: 'append([1], 2, 10)', x: [1, 2] },
      { n: 'append an object', f: 'append(journey, {"stop": stopId}, 128)', v: { journey: [], stopId: 'a' }, x: [{ stop: 'a' }] },
      { n: 'append to an empty array with maximum 1', f: 'append([], 1, 1)', x: [1] },
      { n: 'append with maximum 1 keeps the newest', f: 'append([1, 2, 3], 4, 1)', x: [4] },
      { n: 'append with a non-integer maximum keeps at most that many', f: 'append([1, 2, 3], 4, 1.5)', x: [4] },
      { n: 'append with maximum 2.5 keeps two', f: 'append([1, 2, 3], 4, 2.5)', x: [3, 4] },
      { n: 'append maximum 0 faults', f: 'append([], 1, 0)', xe: 'E-FORMULA' },
      { n: 'append maximum 1025 faults', f: 'append([], 1, 1025)', xe: 'E-FORMULA' },
      { n: 'append never changes its input', f: 'fold([0], j, append(acc, 9, 5)) === [1, 9] && j === [1]', v: { j: [1] }, x: true },
      { n: 'range', f: 'range(5)', x: [0, 1, 2, 3, 4] },
      { n: 'range of 0', f: 'range(0)', x: [] },
      { n: 'range truncates toward zero', f: 'range(2.9)', x: [0, 1] },
      { n: 'range of -0.5 is empty', f: 'range(-0.5)', x: [] },
      { n: 'range of 1024', f: 'length(range(1024))', x: 1024 },
      { n: 'range of 1025 faults', f: 'range(1025)', xe: 'E-RANGE' },
      { n: 'range of -1 faults', f: 'range(-1)', xe: 'E-RANGE' },
      { n: 'range needs a number', f: "range('3')", xe: 'E-FORMULA' },
      { n: 'filter', f: 'filter(xs, item.ok)', v: { xs: [{ ok: true, n: 1 }, { ok: false, n: 2 }] }, x: [{ ok: true, n: 1 }] },
      { n: 'filter by index', f: 'filter([5, 6, 7, 8], index % 2 === 0)', x: [5, 7] },
      { n: 'filter needs a boolean', f: 'filter([1], item)', xe: 'E-FORMULA' },
      { n: 'filter of an empty array', f: 'filter([], item > 0)', x: [] },
      { n: 'count', f: 'count(xs, item > 1)', v: { xs: [1, 2, 3] }, x: 2 },
      { n: 'count needs a boolean', f: 'count([1], 1)', xe: 'E-FORMULA' },
      { n: 'sum', f: 'sum(answers, item.points)', v: { answers: [{ points: 2 }, { points: 3 }] }, x: 5 },
      { n: 'sum with index', f: 'sum(xs, item * index)', v: { xs: [5, 5, 5] }, x: 15 },
      { n: 'sum of an empty array is 0', f: 'sum([], item)', x: 0 },
      { n: 'sum adds in order, first row first', f: 'sum([0.1, 0.2, 0.3], item)', x: 0.6000000000000001 },
      { n: 'sum in the other order', f: 'sum([0.3, 0.2, 0.1], item)', x: 0.6 },
      { n: 'sum that overflows faults', f: 'sum([big, big], item)', v: { big }, xe: 'E-FORMULA' },
      { n: 'sum needs numbers', f: "sum(['1'], item)", xe: 'E-FORMULA' },
      { n: 'minBy', f: 'minBy(xs, item.r).n', v: { xs: [{ r: 2, n: 'a' }, { r: 1, n: 'b' }, { r: 1, n: 'c' }] }, x: 'b' },
      { n: 'minBy of an empty array faults', f: 'minBy([], item)', xe: 'E-FORMULA' },
      { n: 'minBy needs numbers', f: "minBy(['a'], item)", xe: 'E-FORMULA' },
      { n: 'fold', f: 'fold(scores, 0, acc + item)', v: { scores: [1, 2, 3] }, x: 6 },
      { n: 'fold of an empty array is the start', f: "fold([], 'start', acc + item)", x: 'start' },
      { n: 'fold with index', f: 'fold([10, 20], 0, acc + item * index)', x: 20 },
      { n: 'fold: a running total', f: 'fold(xs, [], append(acc, (length(acc) > 0 ? at(acc, length(acc) - 1, 0) : 0) + item, 1024))', v: { xs: [1, 2, 3, 4] }, x: [1, 3, 6, 10] },
      { n: 'fold joins text', f: "fold(['a', 'b', 'c'], '', acc + item)", x: 'abc' },
      { n: 'sort numbers', f: 'sort([3, 1, 2], item)', x: [1, 2, 3] },
      { n: 'sort high to low', f: 'sort(data, item.population, true)', v: { data: [{ population: 5 }, { population: 9 }, { population: 1 }] }, x: [{ population: 9 }, { population: 5 }, { population: 1 }] },
      { n: 'sort is stable', f: 'sort(xs, item.k)', v: { xs: [{ k: 1, n: 'a' }, { k: 0, n: 'b' }, { k: 1, n: 'c' }, { k: 0, n: 'd' }] }, x: [{ k: 0, n: 'b' }, { k: 0, n: 'd' }, { k: 1, n: 'a' }, { k: 1, n: 'c' }] },
      { n: 'sort high to low keeps equal rows in their order', f: 'sort(xs, item.k, true)', v: { xs: [{ k: 1, n: 'a' }, { k: 0, n: 'b' }, { k: 1, n: 'c' }] }, x: [{ k: 1, n: 'a' }, { k: 1, n: 'c' }, { k: 0, n: 'b' }] },
      { n: 'sort text by code point, not by locale', f: "sort(['b', 'a', 'B', 'é', 'z', 'A'], item)", x: ['A', 'B', 'a', 'b', 'z', 'é'] },
      { n: 'sort text: a character above U+FFFF sorts after U+FFFD', f: "sort(['😀', '\\ufffd', 'a'], item)", x: ['a', '�', '😀'] },
      { n: 'sort text: a character above U+FFFF sorts after U+E000', f: "sort(['😀', '\\ue000'], item)", x: ['', '😀'] },
      { n: 'sort text: a prefix sorts first', f: "sort(['ab', 'a', ''], item)", x: ['', 'a', 'ab'] },
      // Unit order with surrogates last (5.6.4, D62): a lone low surrogate sorts after a character above U+FFFF,
      // though its code point is smaller; U+FFFF still sorts before one.
      { n: 'sort text: a lone low surrogate sorts after a character above U+FFFF', f: "sort(['\\udc00', '\\ud83d\\ude00'], item)[0] === '\\ud83d\\ude00'", x: true },
      { n: 'sort text: a lone high surrogate sorts after U+FFFF', f: "sort(['\\ud800', '\\uffff'], item)[0] === '\\uffff'", x: true },
      { n: 'sort text: U+FFFF sorts before a character above U+FFFF', f: "sort(['\\ud83d\\ude00', '\\uffff'], item)[0] === '\\uffff'", x: true },
      { n: 'sort by index, high to low', f: "sort(['x', 'y', 'z'], index, true)", x: ['z', 'y', 'x'] },
      { n: 'sort with mixed keys faults', f: "sort([1, 'a'], item)", xe: 'E-FORMULA' },
      { n: 'sort with a boolean key faults', f: 'sort([true], item)', xe: 'E-FORMULA' },
      { n: 'sort with a non-boolean direction faults', f: 'sort([1], item, 1)', xe: 'E-FORMULA' },
      { n: 'sort of an empty array', f: 'sort([], item)', x: [] },
      { n: 'sort minus zero and zero are equal keys', f: 'sort([{"k": 0, "n": 1}, {"k": -0, "n": 2}], item.k)', x: [{ k: 0, n: 1 }, { k: 0, n: 2 }] },
      { n: 'nested row functions restore item', f: 'sum(xs, count(xs, item > 1))', v: { xs: [1, 2, 3] }, x: 6 },
      { n: 'outer index before the row function binds its own', f: 'sum(range(index), item)', v: { index: 4 }, x: 6 },
      { n: 'acc is the nearest fold', f: 'fold([1, 2], 1, acc + sum([10], acc))', x: 4 },
      { n: 'item outside a row function is a plain name', f: 'item', v: { item: 'outside' }, x: 'outside' },
      { n: 'item with no value outside a row function faults', f: 'item', xe: 'E-FORMULA' },
      { n: 'a cumulative share', f: 'sum(range(index), rows[item].share)', v: { index: 2, rows: [{ share: 0.25 }, { share: 0.5 }, { share: 0.25 }] }, x: 0.75 },
      { n: 'row functions need an array', f: 'count(3, true)', xe: 'E-FORMULA' },
    ],
  },
  maths: {
    title: 'Maths beyond + - * /: pow, sqrt, exp, log, sin and cos',
    spec: ['5.6.4'],
    cases: [
      { n: 'pow of integers', f: 'pow(2, 10)', x: 1024 },
      { n: 'pow with a clamped exponent', f: 'pow(2, clamp(level, 0, 10))', v: { level: 12 }, x: 1024 },
      { n: 'pow of 0 exponent is 1', f: 'pow(5, 0)', x: 1 },
      { n: 'pow of a negative base, odd exponent', f: 'pow(-2, 3)', x: -8 },
      { n: 'pow with a negative exponent', f: 'pow(2, -2)', x: 0.25 },
      { n: 'pow one half is a square root', f: 'pow(16, 0.5)', x: 4 },
      { n: 'pow of a negative base and non-integer exponent faults', f: 'pow(-8, 1 / 3)', xe: 'E-FORMULA' },
      { n: 'pow that overflows faults', f: 'pow(10, 309)', xe: 'E-FORMULA' },
      { n: 'pow of zero to a negative faults', f: 'pow(0, -1)', xe: 'E-FORMULA' },
      { n: 'pow 10 to 308', f: 'pow(10, 308)', p: ['math'] },
      { n: 'pow 10 to -5', f: 'pow(10, -5)', p: ['math'] },
      { n: 'pow 1.1 to 10', f: 'pow(1.1, 10)', p: ['math'] },
      { n: 'pow 2 to 0.5', f: 'pow(2, 0.5)', p: ['math'] },
      { n: 'sqrt', f: 'sqrt(area)', v: { area: 81 }, x: 9 },
      { n: 'sqrt of 2 is correctly rounded', f: 'sqrt(2)', x: Math.SQRT2 },
      { n: 'sqrt of 0', f: 'sqrt(0)', x: 0 },
      { n: 'sqrt of a negative faults', f: 'sqrt(-1)', xe: 'E-FORMULA' },
      { n: 'exp of 0', f: 'exp(0)', x: 1 },
      { n: 'exp of 1', f: 'exp(1)', p: ['math'] },
      { n: 'exp of -1', f: 'exp(-1)', p: ['math'] },
      { n: 'exp of a decay', f: 'exp(-time / tau)', v: { time: 3, tau: 2 }, p: ['math'] },
      { n: 'exp that overflows faults', f: 'exp(710)', xe: 'E-FORMULA' },
      { n: 'exp that underflows is 0', f: 'exp(-1000)', x: 0 },
      { n: 'log of 1', f: 'log(1)', x: 0 },
      { n: 'log of 10', f: 'log(10)', p: ['math'] },
      { n: 'log of 0.5', f: 'log(0.5)', p: ['math'] },
      { n: 'log of the largest double', f: 'log(1.7976931348623157e308)', p: ['math'] },
      { n: 'log of 0 faults', f: 'log(0)', xe: 'E-FORMULA' },
      { n: 'log of a negative faults', f: 'log(-1)', xe: 'E-FORMULA' },
      { n: 'sin of 0', f: 'sin(0)', x: 0 },
      { n: 'sin of 90', f: 'sin(90)', x: 1 },
      { n: 'sin of 180 is exactly 0', f: 'sin(180)', x: 0 },
      { n: 'sin of 270', f: 'sin(270)', x: -1 },
      { n: 'sin of -90', f: 'sin(-90)', x: -1 },
      { n: 'sin of 450', f: 'sin(450)', x: 1 },
      { n: 'sin of 360000', f: 'sin(360000)', x: 0 },
      { n: 'cos of 0', f: 'cos(0)', x: 1 },
      { n: 'cos of 90 is exactly 0', f: 'cos(90)', x: 0 },
      { n: 'cos of 180', f: 'cos(180)', x: -1 },
      { n: 'cos of -180', f: 'cos(-180)', x: -1 },
      { n: 'cos of 720', f: 'cos(720)', x: 1 },
      { n: 'sin of 30', f: 'sin(30)', p: ['math'] },
      { n: 'sin of 45', f: 'sin(45)', p: ['math'] },
      { n: 'cos of 60', f: 'cos(60)', p: ['math'] },
      { n: 'sin of 1e300, a whole multiple of 90', f: 'sin(1e300)', x: 0 },
      { n: 'sin of 1e15 + 1', f: 'sin(1000000000000001)', p: ['math'] },
      { n: 'cos of a phase', f: 'cos(phase * 360)', v: { phase: 0.125 }, p: ['math'] },
      { n: 'sin needs a number', f: "sin('0')", xe: 'E-FORMULA' },
      { n: 'pow needs numbers', f: 'pow(2, true)', xe: 'E-FORMULA' },
      { n: 'sqrt needs a number', f: 'sqrt(null)', xe: 'E-FORMULA' },
    ],
  },
  names: {
    title: 'Names: values, built-in names under hsvg. and active',
    spec: ['5.6.2', '5.9'],
    cases: [
      { n: 'a value', f: 'score', v: { score: 3 }, x: 3 },
      { n: 'an unknown name faults', f: 'nope', xe: 'E-FORMULA' },
      { n: 'a name that starts like a literal', f: 'trueValue', v: { trueValue: 1 }, x: 1 },
      { n: 'nullable is a name', f: 'nullable', v: { nullable: 2 }, x: 2 },
      { n: 'a built-in name under hsvg.', f: 'hsvg.now', b: { now: 1000 }, x: 1000 },
      { n: 'hsvg. reads the built-in even when a value has the name', f: 'hsvg.now', v: { now: 1 }, b: { now: 1000 }, x: 1000 },
      { n: 'a bare name reads the author value first', f: 'now', v: { now: 1 }, b: { now: 1000 }, x: 1 },
      { n: 'a bare name reads the built-in when no value has the name', f: 'now', b: { now: 1000 }, x: 1000 },
      { n: 'hsvg alone is refused', f: 'hsvg', xe: 'E-FORMULA' },
      { n: 'a value may share a function name', f: 'min + 1', v: { min: 1 }, x: 2 },
      { n: 'active state', f: "active('red') && !active('green')", s: ['red'], x: true },
      { n: 'active needs a text id', f: 'active(1)', xe: 'E-FORMULA' },
      { n: 'a name with digits', f: 'level2', v: { level2: 5 }, x: 5 },
      { n: 'a name starting with a capital is refused', f: 'Score', xe: 'E-FORMULA' },
      { n: 'a name with an underscore is refused', f: 'my_score', xe: 'E-FORMULA' },
      { n: 'a name starting with $ is refused', f: '$x', xe: 'E-FORMULA' },
      { n: 'and is reserved', f: 'and', xe: 'E-FORMULA' },
      { n: 'or is reserved', f: 'a or b', xe: 'E-FORMULA' },
      { n: 'not is reserved', f: 'not', xe: 'E-FORMULA' },
      { n: '__proto__ is refused as a member', f: 'x.__proto__', xe: 'E-FORMULA' },
      { n: 'prototype is refused as a name', f: 'prototype', xe: 'E-FORMULA' },
      { n: 'constructor is refused as a member', f: 'x.constructor', v: { x: {} }, xe: 'E-FORMULA' },
      { n: 'whitespace between tokens: spaces, tabs and new lines', f: ' 1 +\t2\n*\r3 ', x: 7 },
      // The exact whitespace set of 5.6.2 (D62): each character between tokens, and characters that are not in it.
      ...WHITESPACE.map(c => ({ n: `whitespace: U+${hex4(c)} between tokens`, f: `1${String.fromCharCode(c)}+${String.fromCharCode(c)}2`, x: 3 })),
      ...NOT_WHITESPACE.map(c => ({ n: `not whitespace: U+${hex4(c)} between tokens is refused`, f: `1${String.fromCharCode(c)}+2`, xe: 'E-FORMULA' })),
    ],
  },
  errors: {
    title: 'Errors: grammar, closed function list, arity and words outside the language',
    spec: ['5.6.2', '5.6.4'],
    cases: [
      { n: 'unknown function', f: 'nope(1)', xe: 'E-FORMULA' },
      { n: 'a method call is refused', f: "'a'.toUpperCase()", xe: 'E-FORMULA' },
      { n: 'abs is not a function of the language', f: 'abs(-1)', xe: 'E-FORMULA' },
      { n: 'trunc is not a function of the language', f: 'trunc(1.5)', xe: 'E-FORMULA' },
      { n: 'tan is not a function of the language', f: 'tan(45)', xe: 'E-FORMULA' },
      { n: 'too few arguments', f: 'clamp(1, 2)', xe: 'E-FORMULA' },
      { n: 'too many arguments', f: 'floor(1, 2)', xe: 'E-FORMULA' },
      { n: 'sort takes 2 or 3 arguments', f: 'sort([1], item, true, 1)', xe: 'E-FORMULA' },
      { n: '== is not an operator', f: 'a == b', xe: 'E-FORMULA' },
      { n: '!= is not an operator', f: 'a != b', xe: 'E-FORMULA' },
      { n: '= is not an operator', f: 'a = 1', xe: 'E-FORMULA' },
      { n: 'a comment is refused', f: '1 // one', xe: 'E-FORMULA' },
      { n: 'a block comment is refused', f: '/* x */ 1', xe: 'E-FORMULA' },
      { n: 'a backtick template is refused', f: '`a`', xe: 'E-FORMULA' },
      { n: 'spread is refused', f: '[...xs]', xe: 'E-FORMULA' },
      { n: 'an arrow function is refused', f: 'x => x', xe: 'E-FORMULA' },
      { n: 'a regular expression is refused', f: '/a/', xe: 'E-FORMULA' },
      { n: 'assignment with += is refused', f: 'a += 1', xe: 'E-FORMULA' },
      { n: 'increment is refused', f: 'a++', xe: 'E-FORMULA' },
      { n: 'bitwise and is refused', f: '1 & 2', xe: 'E-FORMULA' },
      { n: 'exponent operator is refused', f: '2 ** 3', xe: 'E-FORMULA' },
      { n: 'a semicolon is refused', f: '1; 2', xe: 'E-FORMULA' },
      { n: 'unbalanced bracket', f: '(1 + 2', xe: 'E-FORMULA' },
      { n: 'unexpected close', f: '1 + 2)', xe: 'E-FORMULA' },
      { n: 'empty formula', f: '', xe: 'E-FORMULA' },
      { n: 'a formula of only spaces', f: '   ', xe: 'E-FORMULA' },
      { n: 'two values with no operator', f: '1 2', xe: 'E-FORMULA' },
      { n: 'a number starting with a dot', f: '.5', xe: 'E-FORMULA' },
      { n: 'a number ending with a dot', f: '5.', xe: 'E-FORMULA' },
      { n: 'a hex number is refused', f: '0x10', xe: 'E-FORMULA' },
      { n: 'a missing operand', f: '1 +', xe: 'E-FORMULA' },
      { n: 'a conditional without :', f: 'true ? 1', xe: 'E-FORMULA' },
      { n: 'a function name with no call is a name', f: 'floor', xe: 'E-FORMULA' },
      { n: 'undefined is a name, not a value', f: 'undefined', xe: 'E-FORMULA' },
      { n: 'the {{ }} of a template is refused in a formula', f: '{{ score }}', v: { score: 1 }, xe: 'E-FORMULA' },
      { n: 'a formula that is not text', f: 5, xe: 'E-FORMULA' },
    ],
  },
  limits: {
    title: 'Work limits: source, tokens, nesting, steps, array items and result size',
    spec: ['5.6.6'],
    cases: [
      { n: 'source of 4096 units', f: '1' + ' '.repeat(4095), x: 1 },
      { n: 'source over 4096 units', f: '1' + ' '.repeat(4096), xe: 'E-RANGE' },
      { n: '1023 tokens', f: ones(512), x: 512 },
      { n: '1025 tokens', f: ones(513), xe: 'E-RANGE' },
      { n: 'nesting of 31 brackets', f: nestedParens(31), x: 1 },
      { n: 'nesting of 32 brackets', f: nestedParens(32), xe: 'E-RANGE' },
      { n: 'nesting of 31 unary minus signs', f: '-'.repeat(31) + '1', x: -1 },
      { n: 'nesting of 32 unary minus signs', f: '-'.repeat(32) + '1', xe: 'E-RANGE' },
      { n: 'a row formula over every row of the largest table fits', f: 'sum(range(1024), item * 2 + 1)', x: 1048576 },
      { n: 'nested row functions over the step limit', f: 'sum(range(1024), sum(range(64), item))', xe: 'E-RANGE' },
      { n: 'a fold over the step limit', f: 'fold(range(1024), 0, fold(range(64), acc, acc + item))', xe: 'E-RANGE' },
      { n: 'equality of large values is charged', f: 'count(range(1024), xs === ys)', v: { xs: zeros(100), ys: zeros(100) }, xe: 'E-RANGE' },
      { n: 'a lazy branch costs no steps', f: 'false && sum(range(1024), sum(range(64), item)) > 0', x: false },
      { n: 'an array value of 1024 items', f: 'length(xs)', v: { xs: zeros(1024) }, x: 1024 },
      { n: 'an array value of 1025 items faults', f: 'length(xs)', v: { xs: zeros(1025) }, xe: 'E-RANGE' },
      { n: 'an array literal of 1025 items faults', f: 'length([' + zeros(1025).join(',') + '])', xe: 'E-RANGE' },
      { n: 'a text of 65536 units', f: 'length(fold(range(16), "abcd", acc + acc))', xe: 'E-RANGE' },
      { n: 'a text of 32768 units', f: 'length(fold(range(13), "abcd", acc + acc))', x: 32768 },
      { n: 'a join over the result size faults at once', f: 'fold(range(15), "abcd", acc + acc)', xe: 'E-RANGE' },
      { n: 'a join of exactly the result size', f: 'length(fold(range(14), "abcd", acc + acc))', x: 65536 },
      { n: 'a result over the result size faults', f: 'fold(range(5), ["' + 'a'.repeat(4000) + '"], [acc, acc])', xe: 'E-RANGE' },
      { n: 'a result of an array under the result size', f: 'fold(range(2), ["ab"], [acc, acc])', x: [[['ab'], ['ab']], [['ab'], ['ab']]] },
      // The work steps 5.6.6 counts, case by case (xs): each is checked against the engine when the files are made.
      { n: 'steps: an operator and two literals', f: '1 + 2', x: 3, xs: 3 },
      { n: 'steps: an equality of two names charges one value', f: 'a === b', v: { a: 1, b: 1 }, x: true, xs: 4 },
      { n: 'steps: an equality of arrays charges each value visited', f: '[1, 2] === [1, 2]', x: true, xs: 10 },
      { n: 'steps: a lazy branch skipped costs nothing', f: 'false && x', x: false, xs: 2 },
      { n: 'steps: a join charges one step per 16 units', f: '"ab" + "cd"', x: 'abcd', xs: 4 },
      { n: 'steps: length of text charges one step per 16 units read', f: 'length("abc")', x: 3, xs: 3 },
      { n: 'steps: range charges one step per 16 items built', f: 'range(20)', x: [...Array(20).keys()], xs: 4 },
      { n: 'steps: append charges one step per 16 items of the new array', f: 'append(range(20), 5, 1024)', x: [...Array(20).keys(), 5], xs: 9 },
      { n: 'steps: count charges one step per row and its row formula', f: 'count(range(8), true)', x: 8, xs: 20 },
      { n: 'steps: minBy evaluates its array twice', f: 'minBy(range(8), item)', x: 0, xs: 23 },
      { n: 'steps: sort evaluates its array twice and charges n times ceil(log2(n + 1))', f: 'sort(range(8), item)', x: [...Array(8).keys()], xs: 55 },
      { n: 'steps: sort high to low evaluates its third argument', f: 'sort(range(8), item, true)', x: [7, 6, 5, 4, 3, 2, 1, 0], xs: 56 },
      { n: 'steps: fold charges one step per row and its step formula', f: 'fold(range(3), 0, acc + item)', x: 3, xs: 17 },
      { n: 'steps: lookup charges each row it visits and each equality', f: 'lookup(rows, "id", 2, null)', v: { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] }, x: { id: 2 }, xs: 9 },
      { n: 'steps: includes charges each equality until a match', f: 'includes([1, 2, 3], 3)', x: true, xs: 9 },
      { n: 'steps: shuffle charges one step per item', f: 'shuffle(range(4), 1)', xs: 9 },
      { n: 'steps: a template counts the steps of all its spans', t: '{{ 1 + 2 }} and {{ n }}', v: { n: 4 }, x: '3 and 4', xs: 4 },
    ],
  },
};

// ---------- the files ----------
const disagree = [];
function caseOut(src) {
  const c = { name: src.n };
  if ('t' in src) c.template = src.t; else c.formula = src.f;
  if (src.v) c.values = src.v;
  if (src.b) c.builtins = src.b;
  if (src.s) c.states = src.s;
  if (src.lang) c.language = src.lang;
  if (src.w) c.words = src.w;
  const got = runCase(c);
  if (got.invalid) disagree.push(`${src.n}: the engine gives ${got.result}, which is not a JSON value`);
  if ('x' in src && !('result' in got && sameResult(got.result, src.x))) disagree.push(`${src.n}: the spec says ${JSON.stringify(src.x)}; the engine gives ${JSON.stringify(got)}`);
  if ('xe' in src && got.error !== src.xe) disagree.push(`${src.n}: the spec says ${src.xe}; the engine gives ${JSON.stringify(got)}`);
  if ('xs' in src && got.steps !== src.xs) disagree.push(`${src.n}: the spec counts ${src.xs} work steps; the engine counts ${got.steps}`);
  Object.assign(c, got);
  if (src.p) c.platform = src.p;
  return c;
}

// One case per line, so a diff shows the case that changed.
function fileText(id, area) {
  const cases = area.cases.map(caseOut);
  const names = new Set();
  for (const c of cases) { if (names.has(c.name)) throw new Error(`${id}: two cases named ${c.name}`); names.add(c.name); }
  const head = { format: FORMAT_ID, area: id, title: area.title, spec: area.spec };
  // Characters a reader cannot see (the whitespace cases) are written as \u escapes: the same JSON value.
  const lines = cases.map(c => '  ' + JSON.stringify(c).replace(/[\u0080-\u00a0\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u206f\u3000\ufeff]/g, (ch) => `\\u${hex4(ch.charCodeAt(0)).toLowerCase()}`));
  return `${JSON.stringify(head).slice(0, -1)},\n "cases": [\n${lines.join(',\n')}\n ]}\n`;
}

// Every file: its name and its text.
export function formulaConformanceFiles() {
  disagree.length = 0;
  const files = Object.fromEntries(Object.entries(AREAS).map(([id, area]) => [`${id}.json`, fileText(id, area)]));
  if (disagree.length) throw new Error(`the engine and the cases disagree:\n  ${disagree.join('\n  ')}`);
  return files;
}

// The functions of the language no case calls (5.6.4): the test wants none.
export function uncalledFunctions(files) {
  const all = Object.values(files).flatMap(t => JSON.parse(t).cases).map(c => c.formula ?? c.template).filter(s => typeof s === 'string').join('\n');
  return Object.keys(FUNCTIONS).filter(f => !new RegExp(`\\b${f}\\(`).test(all));
}

// Two file texts agree: the same text, or the same cases where only a `math` result differs in its last bits.
export function sameFile(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  const x = JSON.parse(a); const y = JSON.parse(b);
  if (x.cases.length !== y.cases.length) return false;
  return x.cases.every((c, i) => {
    const d = y.cases[i];
    if (JSON.stringify(c) === JSON.stringify(d)) return true;
    const math = (c.platform || []).includes('math');
    return math && JSON.stringify({ ...c, result: 0 }) === JSON.stringify({ ...d, result: 0 }) && sameResult(c.result, d.result, true);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const files = formulaConformanceFiles();
  let stale = 0;
  if (!check) fs.mkdirSync(folder, { recursive: true });
  const extra = fs.existsSync(folder) ? fs.readdirSync(folder).filter(f => f.endsWith('.json') && !(f in files)) : [];
  for (const f of extra) { console.log(`not made by this tool: ${f}`); stale++; }
  for (const [name, text] of Object.entries(files)) {
    const to = path.join(folder, name);
    const now = fs.existsSync(to) ? fs.readFileSync(to, 'utf8') : null;
    if (sameFile(now, text)) continue;
    if (check) { console.log(`stale: ${name}`); stale++; } else { fs.writeFileSync(to, text); console.log(`wrote ${name}`); }
  }
  const count = Object.values(files).reduce((n, t) => n + JSON.parse(t).cases.length, 0);
  console.log(`${Object.keys(files).length} files, ${count} cases${check ? `, ${stale} stale` : ''}`);
  process.exit(stale ? 1 : 0);
}
