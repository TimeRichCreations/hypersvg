// Combining rules of one kind, strength and subject (8.6 step 2): the strictest bound wins; lists intersect; `case`,
// `positions` and `of` must be equal. Returns the pairs that leave nothing that can hold: [{ a, b, what }] (indexes).
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

export function combine(rules) {
  const out = [];
  for (let a = 0; a < rules.length; a++) {
    for (let b = a + 1; b < rules.length; b++) {
      const x = rules[a]; const y = rules[b];
      const say = (what) => out.push({ a, b, what });
      for (const key of ['case', 'positions', 'of']) {
        if (x[key] !== undefined && y[key] !== undefined && !same(x[key], y[key])) say(`${key} must be equal: ${JSON.stringify(x[key])} against ${JSON.stringify(y[key])}`);
      }
      if (x.kind === 'limit') {
        for (const [lo, hi] of [['minimum', 'maximum'], ['minLength', 'maxLength']]) {
          // the strictest minimum is the larger one, the strictest maximum the smaller one
          const min = Math.max(...[x[lo], y[lo]].filter(isNum), -Infinity);
          const max = Math.min(...[x[hi], y[hi]].filter(isNum), Infinity);
          if (min > max) say(`${lo} ${min} is above ${hi} ${max} once combined`);
        }
      }
      if (x.kind === 'fonts' && Array.isArray(x.families) && Array.isArray(y.families)) {
        if (!x.families.some(f => y.families.includes(f))) say(`the font families ${JSON.stringify(x.families)} and ${JSON.stringify(y.families)} have nothing in common`);
      }
      if (x.kind === 'colors' && x.roles && y.roles) {
        for (const role of Object.keys(x.roles)) {
          if (Array.isArray(x.roles[role]) && Array.isArray(y.roles[role]) && !x.roles[role].some(c => y.roles[role].includes(c))) say(`the colours allowed for role ${role} have nothing in common`);
        }
      }
    }
  }
  return out;
}
