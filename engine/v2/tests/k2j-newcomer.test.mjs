// What a newcomer's first run tripped on (a timed first-run test).
//   - `hypersvg init --help` printed nothing useful and made a folder named "--help";
//   - `hypersvg <command> --help` printed the engine tools' internal usage;
//   - `hypersvg test --json` printed notes around the JSON, so stdout was not valid JSON;
//   - E-WRITE-INPUT did not say what to do instead.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo, eq, ok, mapSource, schemas } from './helpers.mjs';
import { checkExperience } from '../check/index.mjs';

const bin = path.join(repo, 'bin', 'hypersvg.mjs');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k2j-'));
const run = (cwd, ...args) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, PW_PATH: '' } });

export const tests = {
  'init --help prints the usage and makes no folder; init with a flag for a folder is refused'() {
    const dir = temp();
    const r = run(dir, 'init', '--help');
    eq(r.status, 0, r.stderr);
    ok(r.stdout.startsWith('Usage: hypersvg init <folder>'), r.stdout);
    eq(fs.readdirSync(dir), [], 'no folder was made');
    const bad = run(dir, 'init', '-x');
    ok(bad.status !== 0, 'a flag is not a folder');
    eq(fs.readdirSync(dir), [], 'still no folder');
  },
  'init writes CLAUDE.md and the HyperSVG skill in .claude/skills'() {
    const dir = temp();
    eq(run(dir, 'init', 'lamp').status, 0);
    const skill = path.join(dir, 'lamp', '.claude', 'skills', 'hypersvg', 'SKILL.md');
    ok(fs.existsSync(skill), 'the skill is installed');
    const text = fs.readFileSync(skill, 'utf8');
    ok(/^---\nname: hypersvg\ndescription: .+\n---\n/.test(text.replace(/\r\n/g, '\n')), 'the skill has its name and description');
    eq(text, fs.readFileSync(path.join(repo, 'skills', 'hypersvg', 'SKILL.md'), 'utf8'), 'the package skill, unchanged');
    eq(fs.readFileSync(path.join(dir, 'lamp', 'CLAUDE.md'), 'utf8'), fs.readFileSync(path.join(dir, 'lamp', 'AGENTS.md'), 'utf8'), 'CLAUDE.md holds the AGENTS.md notes');
    ok(/npx @hypersvg\/core/.test(text) && /npx hypersvg/.test(text), 'the skill names both command forms');
  },
  'the skill\'s three files check clean as written'() {
    // The skill shows a traffic light in three files; copied as they are, they check with 0 findings.
    const text = fs.readFileSync(path.join(repo, 'skills', 'hypersvg', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    const blocks = [...text.matchAll(/`([a-z.]+\.(?:json|svg))`(?: \(the scene\))?:\n\n```(?:json|svg)\n([\s\S]*?)```/g)].map(m => [m[1], m[2]]);
    eq(blocks.map(b => b[0]), ['experience.json', 'main.json', 'main.svg']);
    const files = Object.fromEntries(blocks);
    const r = checkExperience(mapSource(files), schemas());
    eq(r.diags.filter(d => d.severity === 'error').map(d => `${d.code} ${d.message}`), [], 'no errors');
  },
  'each command\'s --help speaks in hypersvg terms, not the engine tools\' usage'() {
    const dir = temp();
    for (const c of ['check', 'test', 'pack', 'unpack', 'addon']) {
      const r = run(dir, c, '--help');
      eq(r.status, 0, `${c}: ${r.stderr}`);
      ok(r.stdout.startsWith(`Usage: hypersvg ${c}`), `${c}: ${r.stdout.slice(0, 80)}`);
      ok(!/engine\/v2\/tools|--baseline|--previous-kit|--all\b/.test(r.stdout), `${c} lists internal usage: ${r.stdout}`);
    }
  },
  'test --json prints exactly one JSON report on stdout, notes on stderr'() {
    const dir = temp();
    eq(run(dir, 'init', 'lamp').status, 0);
    const r = run(dir, 'test', 'lamp', '--quick', '--json', '--no-shots', '--out', path.join(dir, 'report'));
    let rep = null;
    try { rep = JSON.parse(r.stdout); } catch (e) { ok(false, `stdout is not JSON: ${r.stdout.slice(0, 120)}`); }
    eq(rep.name, 'lamp');
    ok(/report:/.test(r.stderr), 'the report folder is said on stderr');
  },
  'E-WRITE-INPUT says to declare a value and set that'() {
    const files = {
      'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en',
        inputs: { phase: { kind: 'knob', type: 'number', initial: 0, minimum: 0, maximum: 2 } },
        story: { start: 's', scenes: { s: 's.json' }, endless: true } },
      's.json': { format: 'hsvg/2.0', kind: 'scene', id: 's', drawing: 's.svg',
        controls: { go: { kind: 'button', target: 'go', event: 'go', label: 'Go' } },
        on: { go: [{ actions: [{ set: 'phase', to: 'phase + 1' }] }] } },
      's.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>X</title><g data-hsvg-layer="content"><rect id="go" data-hsvg-kind="part" width="100" height="100" fill="#d84315"/></g></svg>',
    };
    const r = checkExperience(mapSource(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))), schemas());
    const d = r.diags.find(x => x.code === 'E-WRITE-INPUT');
    ok(d, `E-WRITE-INPUT expected: ${r.diags.map(x => x.code).join(', ')}`);
    ok(/values/.test(d.message) && /set that/.test(d.message), d.message);
  },
};
