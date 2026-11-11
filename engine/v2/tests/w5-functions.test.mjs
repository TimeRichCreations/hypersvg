// The five functions the person added to 5.6.4: sqrt, exp, log, sin and cos (degrees).
import { parse, evaluate } from '../src/formula.mjs';
import { eq, ok } from './helpers.mjs';

const run = (f) => evaluate(parse(f), { get: () => { throw new Error('no names'); } });
const fails = (f) => { try { run(f); return false; } catch { return true; } };

export const tests = {
  'sqrt, exp and log'() {
    eq(run('sqrt(16)'), 4);
    eq(run('exp(0)'), 1);
    eq(run('log(1)'), 0);
    ok(Math.abs(run('log(exp(2))') - 2) < 1e-12, 'log undoes exp');
  },
  'sin and cos take degrees, exact at the quarter turns'() {
    eq([run('sin(0)'), run('sin(90)'), run('sin(180)'), run('sin(270)'), run('sin(-90)')], [0, 1, 0, -1, -1]);
    eq([run('cos(0)'), run('cos(90)'), run('cos(180)'), run('cos(360)')], [1, 0, -1, 1]);
    ok(Math.abs(run('sin(30)') - 0.5) < 1e-12, 'sin(30) is a half');
  },
  'out of their domain they fault'() {
    ok(fails('sqrt(-1)'), 'sqrt of a negative');
    ok(fails('log(0)'), 'log of 0');
    ok(fails('exp(1000)'), 'exp that is not finite');
  },
};
