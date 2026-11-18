// What the commands print (10.12): one finding format in check and pack, singular counts, no empty {}, the notes
// init writes left out without a word, a HyperSVG of several scenes says what its picture shows, and the help says
// --quick still opens a browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findingCount, findingLine } from '../check/diagnostics.mjs';
import { packNotes } from '../tools/pack.mjs';
import { COMMAND_HELP } from '../../../bin/hypersvg.mjs';
import { repo, eq, ok } from './helpers.mjs';

const LAMP = path.join(repo, 'docs', 'guide', 'examples', 'lamp');
const tool = (name, ...args) => spawnSync(process.execPath, [path.join(repo, 'engine', 'v2', 'tools', name), ...args], { encoding: 'utf8' });
// A copy of the lamp, changed by edit(dir); fn(dir, out) runs on it, and the copy is removed after.
function onLamp(edit, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-output-'));
  const dir = path.join(tmp, 'lamp');
  try { fs.cpSync(LAMP, dir, { recursive: true }); edit(dir); return fn(dir, path.join(tmp, 'out')); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

export const tests = {
  'the count: 0 findings with no {}, 1 finding, 2 findings with their codes'() {
    eq(findingCount([]), '0 findings');
    eq(findingCount([{ code: 'E-X' }]), '1 finding {"E-X":1}');
    eq(findingCount([{ code: 'E-X' }, { code: 'W-Y' }]), '2 findings {"E-X":1,"W-Y":1}');
    eq(findingLine({ code: 'E-SVG-UNSAFE', file: 'lamp.svg', line: 12, column: 5, pointer: 'switch', message: 'event attribute onclick' }), 'E-SVG-UNSAFE lamp.svg:12:5 switch: event attribute onclick');
    eq(onLamp(() => {}, (dir) => tool('check.mjs', dir).stdout.trim()), '0 findings');
  },
  'pack prints a finding as check does, and refuses with a singular count'() {
    onLamp((dir) => {
      const f = path.join(dir, 'lamp.svg');
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('<g id="switch" data-hsvg-kind="part"', '<g id="switch" onclick="x()" data-hsvg-kind="part"'));
    }, (dir, out) => {
      const c = tool('check.mjs', dir).stdout.split('\n')[0];
      const p = tool('pack.mjs', dir, out);
      ok(/^E-SVG-UNSAFE lamp\.svg:\d+:\d+ switch: /.test(c), c);
      eq(p.stdout.split('\n')[0], c, 'the same line');
      ok(p.stdout.includes('refusing to pack: 1 error\n'), p.stdout);
      const a = tool('pack.mjs', '--asset', dir, out);
      eq(a.stdout.split('\n')[0], c, 'the asset too');
      ok(a.stdout.includes('refusing to pack the asset: 1 error\n'), a.stdout);
    });
  },
  'the notes init writes are left out without a word; other files are counted'() {
    const init = ['AGENTS.md', 'CLAUDE.md', 'GUIDE.md', '.claude/skills/hypersvg/SKILL.md'];
    eq(packNotes({ leftOut: init }), []);
    eq(packNotes({ leftOut: [...init, 'old.json'] }), ['left out: 1 file not reached by the experience (--verbose names them)']);
    eq(packNotes({ leftOut: [...init, 'old.json'] }, true, 'asset'), ['left out (not reached by the asset): old.json']);
    onLamp((dir) => { for (const f of init.slice(0, 3)) fs.writeFileSync(path.join(dir, f), '# notes\n'); }, (dir, out) => {
      const p = tool('pack.mjs', dir, out); const a = tool('pack.mjs', '--asset', dir, out);
      ok(p.status === 0 && !p.stdout.includes('left out'), p.stdout);
      ok(a.status === 0 && !a.stdout.includes('left out'), a.stdout);
    });
  },
  'pack --asset of several scenes says its still picture is the start scene'() {
    onLamp((dir) => {
      const exp = JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8'));
      exp.story = { start: 'lamp', scenes: { lamp: 'lamp.json', 'lamp-b': 'lamp-b.json' }, links: [{ id: 'to-b', from: 'lamp', on: 'flip', to: 'lamp-b' }], endless: true };
      fs.writeFileSync(path.join(dir, 'experience.json'), JSON.stringify(exp));
      const scene = JSON.parse(fs.readFileSync(path.join(dir, 'lamp.json'), 'utf8'));
      fs.writeFileSync(path.join(dir, 'lamp-b.json'), JSON.stringify({ ...scene, id: 'lamp-b', drawing: 'lamp-b.svg' }));
      fs.copyFileSync(path.join(dir, 'lamp.svg'), path.join(dir, 'lamp-b.svg'));
    }, (dir, out) => {
      const a = tool('pack.mjs', '--asset', dir, out);
      ok(a.status === 0 && a.stdout.includes('its still picture is the start scene, lamp: an <img> or a design tool shows only that scene. All 2 scenes play'), a.stdout);
    });
    onLamp(() => {}, (dir, out) => ok(!tool('pack.mjs', '--asset', dir, out).stdout.includes('still picture'), 'one scene: no note'));
  },
  'the help says --quick still opens a browser, and --node-only opens none'() {
    ok(/--quick[^\n]*still opens a browser/.test(COMMAND_HELP.test), COMMAND_HELP.test);
    ok(/--node-only[^\n]*no browser/.test(COMMAND_HELP.test), COMMAND_HELP.test);
  },
};
