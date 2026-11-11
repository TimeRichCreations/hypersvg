// The master skill's fast tests (skill/2.0/tests/*.test.mjs) run with the engine's: every snippet in the skill is
// checked against a real example, and every example checks clean and plays. A change to the engine or the spec that
// breaks the skill fails here (request 11).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'skill', '2.0', 'tests');
export const tests = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort()) {
  const mod = await import(pathToFileURL(path.join(dir, f)).href);
  for (const [name, fn] of Object.entries(mod.tests || {})) tests[`skill ${f} :: ${name}`] = fn;
}

// A skill test written to wait for a capability fails when it lands; list it here with the failure it should give,
// until the skill graduates the example.
const LANDED = {
};
for (const [name, { says, by }] of Object.entries(LANDED)) {
  const fn = tests[name];
  tests[`landed, ${by}: ${name}`] = async () => {
    if (!fn) throw new Error(`${name} is gone: remove it from LANDED in engine/v2/tests/skill.test.mjs`);
    let message = null;
    try { await fn(); } catch (e) { message = String(e.message); }
    if (message === null || !message.includes(says)) throw new Error(`${name}: expected the landed failure "${says}", got ${message === null ? 'a pass' : message}`);
  };
  delete tests[name];
}
