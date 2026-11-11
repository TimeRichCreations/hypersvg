// Text fitting (7.6): the parts that need no browser. The measured fit runs in tests/browser/fit-browser.mjs.
import { fontSizes, breakLines } from '../src/fit.mjs';
import { eq } from './helpers.mjs';

// A fake measure: every character is 10 units wide.
const m = (s) => s.length * 10;

export const tests = {
  'font search: whole units from fontPx down to minFontPx'() {
    eq(fontSizes(20, 16), [20, 19, 18, 17, 16]);
    eq(fontSizes(20.7, 15.2), [20, 19, 18, 17, 16]);
    eq(fontSizes(12, 12), [12]);
  },
  'font search: more than 32 sizes become 32 evenly spaced ones with both ends, rounded down'() {
    const s = fontSizes(200, 10);
    eq([s.length, s[0], s[31]], [32, 200, 10]);
    eq(s.every((x, i) => i === 0 || x < s[i - 1]), true);
    eq(s.every(x => Number.isInteger(x) && x >= 10), true);
  },
  'lines break between whole words; every word is kept'() {
    eq(breakLines('aa bb cc dd', 'words', m, 55), ['aa bb', 'cc dd']);
    eq(breakLines('a  b\tc', 'words', m, 1000), ['a b c']);
    eq(breakLines('averyverylongword x', 'words', m, 50), ['averyverylongword', 'x'], 'an unbreakable word stays whole');
  },
  'a line feed is a forced break; wrap none keeps only the value\'s own breaks'() {
    eq(breakLines('aa bb\ncc', 'words', m, 1000), ['aa bb', 'cc']);
    eq(breakLines('aa bb cc dd\nee', 'none', m, 20), ['aa bb cc dd', 'ee']);
    eq(breakLines('aa\n\nbb', 'words', m, 1000), ['aa', '', 'bb']);
  },
};
