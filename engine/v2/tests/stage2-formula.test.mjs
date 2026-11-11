// Stage 2: the formula language (5.6) and templates (5.7).
import { parse, evaluate, renderTemplate, numberText, printNumber, mix } from '../src/formula.mjs';
import { eq, ok, throwsCode } from './helpers.mjs';

const scope = (names = {}, extra = {}) => ({ name: (n) => { if (!(n in names)) { const e = new Error(`unknown ${n}`); e.code = 'E-FORMULA'; throw e; } return names[n]; }, active: (id) => id === 'red', ...extra });
const run = (f, names, extra) => evaluate(parse(f), scope(names, extra));

export const tests = {
  'precedence and laziness'() {
    eq(run('1 + 2 * 3'), 7);
    eq(run('true || 1 / 0 > 0'), true);
    eq(run('false && missing'), false);
    eq(run('a > 2 ? "big" : "small"', { a: 3 }), 'big');
    eq(run('-7 % 3'), -1);
    eq(run("'a' + 'b'"), 'ab');
  },
  'no coercion and faults'() {
    eq(run('"3" + 1'), '31'); // + joins text and a number (D36)
    eq(run("'Score ' + 2.5 + ' of ' + 9"), 'Score 2.5 of 9');
    throwsCode(() => run('"3" + true'), 'E-FORMULA');
    throwsCode(() => run('1 / 0'), 'E-FORMULA');
    throwsCode(() => run('x.y', { x: {} }), 'E-FORMULA');
    throwsCode(() => parse('a == b'), 'E-FORMULA');
    throwsCode(() => parse('x.__proto__'), 'E-FORMULA');
    throwsCode(() => parse('and'), 'E-FORMULA');
    throwsCode(() => parse('nope(1)'), 'E-FORMULA');
  },
  'deep equality and members'() {
    eq(run('[1, {"a": 2}] === [1, {"a": 2}]'), true);
    eq(run("o['k'] + o.n", { o: { k: 1, n: 2 } }), 3);
    eq(run('s[1]', { s: 'héllo' }), 'é');
  },
  'functions of 5.6.4'() {
    eq(run('clamp(angle, -20, 20)', { angle: 31 }), 20);
    eq(run('round(2.5) + round(-2.5)'), 1);
    eq(run('at(choices, 2, null)', { choices: [1] }), null);
    eq(run("lookup(rows, 'id', 'b', null).v", { rows: [{ id: 'a', v: 1 }, { id: 'b', v: 2 }] }), 2);
    eq(run('append(j, 3, 2)', { j: [1, 2] }), [2, 3]);
    eq(run('count(xs, item > 1)', { xs: [1, 2, 3] }), 2);
    eq(run('sum(xs, item * index)', { xs: [5, 5, 5] }), 15);
    eq(run('filter(xs, item.ok)', { xs: [{ ok: true, n: 1 }, { ok: false, n: 2 }] }), [{ ok: true, n: 1 }]);
    eq(run('minBy(xs, item.r).n', { xs: [{ r: 2, n: 'a' }, { r: 1, n: 'b' }, { r: 1, n: 'c' }] }), 'b');
    eq(run("active('red') && !active('green')"), true);
    eq(run('length("héllo")'), 5);
  },
  'seeded randomness (5.6.5)'() {
    eq(mix(0), 0);
    ok(mix(1) === mix(1) && mix(1) !== mix(2));
    const s = run('shuffle([1, 2, 3, 4, 5], 7)');
    eq([...s].sort(), [1, 2, 3, 4, 5]);
    eq(run('shuffle([1, 2, 3, 4, 5], 7)'), s, 'deterministic');
    const r = run('random(0, 1, 42)');
    ok(r >= 0 && r < 1);
  },
  'number text rounds the shortest decimal half toward +infinity (5.7)'() {
    eq(numberText(2.675, 2), '2.68');
    eq(numberText(-2.675, 2), '-2.67');
    eq(numberText(1234567, 0), '1234567');
    eq(numberText(0.5, 0), '1');
    eq(numberText(-0.5, 0), '0');
    eq(printNumber(1e21), '1000000000000000000000');
    eq(printNumber(1e-7), '0.0000001');
  },
  'templates (5.7)'() {
    eq(renderTemplate('Score {{ score }} of {{ total }}', scope({ score: 2, total: 3 })), 'Score 2 of 3');
    eq(renderTemplate('\\{{ literal \\}}', scope()), '{{ literal }}');
    eq(renderTemplate("{{ {\"a\": 1}['a'] }}", scope()), '1');
    eq(renderTemplate('{{ formatNumber(1234.5, 2, true) }}', scope({}, { words: {} })), '1,234.50');
    throwsCode(() => renderTemplate('{{ [1] }}', scope()), 'E-FORMULA');
  },
  'budgets (5.6.6)'() {
    throwsCode(() => parse('1+'.repeat(600) + '1'), 'E-RANGE');
    throwsCode(() => parse('('.repeat(40) + '1' + ')'.repeat(40)), 'E-RANGE');
  },
};
