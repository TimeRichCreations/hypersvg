// The machine files follow D33: in a list of values the first is the default, and no schema branch names a key the
// format no longer has. No browser.
import fs from 'node:fs';
import path from 'node:path';
import { spec, eq, ok } from './helpers.mjs';

const files = () => ['documents.json', ...fs.readdirSync(path.join(spec, 'schemas', 'core')).filter(f => f.endsWith('.json')).map(f => path.join('schemas', 'core', f))];
// Every node of a JSON value with its path.
function* walk(v, p = '') {
  yield [v, p];
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* walk(x, `${p}/${k}`);
}

export const tests = {
  'slideFrom lists its default, end, first (D33; 3.2, 11.4), in the source and every core schema': () => {
    let seen = 0;
    for (const f of files()) for (const [v, p] of walk(JSON.parse(fs.readFileSync(path.join(spec, f), 'utf8')))) {
      if (p.endsWith('/slideFrom') && Array.isArray(v?.enum)) { seen++; eq(v.enum[0], 'end', `${f}${p}`); }
    }
    ok(seen >= 2, `slideFrom found (${seen})`);
  },
  'no binding branch asks for a video key: a video is shown by the media add-on (D31, D33)': () => {
    const bad = [];
    for (const f of files()) for (const [v, p] of walk(JSON.parse(fs.readFileSync(path.join(spec, f), 'utf8')))) {
      if (Array.isArray(v?.required) && v.required.length === 1 && v.required[0] === 'video' && Object.keys(v).length === 1) bad.push(`${f}${p}`);
    }
    eq(bad, [], 'no dead {"required": ["video"]} branch');
  },
};
