// The engine's README and AGENTS.md name what exists, so a new tool, browser test or capability cannot
// land unseen. No browser.
import fs from 'node:fs';
import path from 'node:path';
import { repo, ok } from './helpers.mjs';

const v2 = path.join(repo, 'engine', 'v2');
// The suites that play the showcases are listed in tests/showcases/README.md, where that folder is there.
const showcasesReadme = path.join(v2, 'tests', 'showcases', 'README.md');
const readme = fs.readFileSync(path.join(v2, 'README.md'), 'utf8') + (fs.existsSync(showcasesReadme) ? fs.readFileSync(showcasesReadme, 'utf8') : '');
const agents = fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8');
const list = (dir, test = (f) => f.endsWith('.mjs')) => fs.readdirSync(path.join(v2, dir)).filter(test).sort();
const missing = (text, names) => names.filter(n => !text.includes(n));

export const tests = {
  'readme: names every tool'() {
    const gone = missing(readme, list('tools').map(f => `engine/v2/tools/${f}`));
    ok(!gone.length, `not in engine/v2/README.md: ${gone.join(', ')}`);
  },
  'readme: names every browser test, with its command'() {
    const gone = missing(readme, list(path.join('tests', 'browser'), f => /-browser\.mjs$|^parity\.mjs$/.test(f)).map(f => `node engine/v2/tests/browser/${f}`));
    ok(!gone.length, `not in engine/v2/README.md: ${gone.join(', ')}`);
  },
  'readme: names every capability module and every schema tool'() {
    const caps = list(path.join('src', 'capabilities'), f => f.endsWith('.mjs') && f !== 'all.mjs').map(f => `\`${f.slice(0, -4)}\``);
    const schema = list('schema').map(f => `\`${f}\``);
    const gone = missing(readme, [...caps, ...schema]);
    ok(!gone.length, `not in engine/v2/README.md: ${gone.join(', ')}`);
  },
  'readme: says how a host mounts a package, with schemas and capability modules'() {
    const section = readme.split('## How a host mounts a package')[1]?.split('\n## ')[0] || '';
    ok(section, 'no mount section');
    for (const w of ['mount(', 'schemas', 'src/capabilities/', 'E-NEEDS-MISSING', 'modules']) ok(section.includes(w), `the mount section does not say ${w}`);
  },
  'agents: the commands name the 2.0 check, pack and fast tests, and the browser tests one at a time'() {
    const section = agents.split('## Commands')[1] || '';
    for (const c of ['node engine/v2/tools/check.mjs', 'node engine/v2/tools/pack.mjs', 'node engine/v2/tests/run.mjs', 'engine/v2/tests/browser/', 'one at a time']) {
      ok(section.includes(c), `AGENTS.md commands do not name ${c}`);
    }
  },
};
