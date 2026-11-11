// What the newcomer still tripped on. Each new message is
// tested here. f1a-fixture/lanes is the apple game of Q1a (F0b): a slider with three positions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo, ok, eq, mapSource, schemas } from './helpers.mjs';
import { checkExperience } from '../check/index.mjs';
import { newFromTemplate } from '../tools/library.mjs';
import { base } from './check-refs.test.mjs';
import { scene } from './b1a-format.test.mjs';

const checkTool = path.join(repo, 'engine', 'v2', 'tools', 'check.mjs');
const packTool = path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs');
const runPack = (...a) => spawnSync(process.execPath, [packTool, ...a], { encoding: 'utf8' }).stdout;
// Copies a folder into a fresh temp folder; edit(dir) changes the copy. Returns the copy's path.
export function copyOf(from, edit = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1a-'));
  fs.cpSync(from, dir, { recursive: true });
  edit(dir);
  return dir;
}
export const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));
export const runCheck = (dir, ...more) => spawnSync(process.execPath, [checkTool, dir, ...more], { encoding: 'utf8' }).stdout;

export const tests = {
  'item 1: the ASKS openUrl line says a page alone opens no link, and how a host opens it'() {
    const dir = copyOf(path.join(repo, 'engine', 'v2', 'tests', 'host-fixture'), (d) => {
      const f = path.join(d, 'experience.json'); const e = readJson(f); delete e.grants; writeJson(f, e);
    });
    try {
      const out = runCheck(dir);
      const line = out.split('\n').find(l => l.startsWith('ASKS'));
      ok(line?.startsWith('ASKS openUrl: requested from use, written by the packer; the host decides (10.5)'), line);
      ok(line.includes('A page opened alone has no host: a link press opens nothing and logs "openUrl refused"'), line);
      ok(line.includes("window.hsvg.on('openUrl', fn)") && line.includes('--host'), line);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  },
  'item 2: W-SLIDER-EQUALS warns when a slider without positions feeds === or !==, and names the fix'() {
    const game = path.join(repo, 'engine', 'v2', 'tests', 'f1a-fixture', 'lanes');
    const scene = (d) => path.join(d, 'scenes', 'orchard', 'scene.json');
    ok(!runCheck(game).includes('W-SLIDER-EQUALS'), 'with positions: no warning');
    const without = copyOf(game, (d) => { const s = readJson(scene(d)); delete s.controls.move.positions; writeJson(scene(d), s); });
    const loose = copyOf(game, (d) => {
      const s = readJson(scene(d)); delete s.controls.move.positions;
      writeJson(scene(d), JSON.parse(JSON.stringify(s).replaceAll('basketLane === appleLane', 'basketLane > appleLane - 0.5 and basketLane < appleLane + 0.5')));
    });
    try {
      const line = runCheck(without).split('\n').find(l => l.startsWith('W-SLIDER-EQUALS'));
      ok(line?.includes('scenes/orchard/scene.json'), line);
      ok(line.includes('basketLane is written by slider move, which has no positions, so it can be any number from 0 to 2'), line);
      ok(line.includes('Add "positions": 3 to the slider'), line);
      ok(!runCheck(loose).includes('W-SLIDER-EQUALS'), 'a compare with < and > gives no warning');
    } finally { for (const d of [without, loose]) fs.rmSync(d, { recursive: true, force: true }); }
  },
  'item 3: E-REF-UNKNOWN for entered, start, enter, begin or ready suggests the scene\'s entry list'() {
    const example = path.join(repo, 'docs', 'one-page', 'example');
    const scene = (d) => path.join(d, 'scenes', 'hello', 'scene.json');
    for (const word of ['entered', 'start', 'enter', 'begin', 'ready', 'opened']) {
      const dir = copyOf(example, (d) => { const s = readJson(scene(d)); s.on[word] = [{ actions: [{ play: 'pop' }] }]; writeJson(scene(d), s); });
      try {
        const line = runCheck(dir).split('\n').find(l => l.startsWith('E-REF-UNKNOWN'));
        ok(line?.includes(`"${word}" has no producer in hello`), line);
        const hint = 'To act when the scene starts, list the actions in the scene\'s entry instead of on: "entry": [{"play": "intro"}] (5.13)';
        ok(word === 'opened' ? !line.includes(hint) : line.includes(hint), `${word}: ${line}`);
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
  },
  'item 4: = or == in a formula says that equality is === (and !==)'() {
    const example = path.join(repo, 'docs', 'one-page', 'example');
    const scene = (d) => path.join(d, 'scenes', 'hello', 'scene.json');
    for (const [op, at] of [['==', 7], ['=', 7]]) {
      const dir = copyOf(example, (d) => { const s = readJson(scene(d)); s.bindings[0].text = `{{ stars ${op} 3 ? 'three' : 'some' }} stars`; writeJson(scene(d), s); });
      try {
        const line = runCheck(dir).split('\n').find(l => l.startsWith('E-FORMULA'));
        ok(line?.includes(`${op} at ${at} is not an operator: equality is === (and !==)`), `${op}: ${line}`);
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
  },
  async 'item 6: "is not an input of" lists the inputs (a template use, a kit with, a component use)'() {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1a-'));
    try {
      const made = await newFromTemplate('g', 'game', work);
      const f = path.join(made.dir, 'experience.json');
      const e = readJson(f); e.story.scenes.play.with.thing = 'apple'; writeJson(f, e);
      let out = runCheck(made.dir);
      ok(out.includes('thing is not an input of frame-game; its inputs are seconds, hopMs'), out);
      delete e.story.scenes.play.with.thing; e.with = { bogus: 'x' }; writeJson(f, e);
      out = runCheck(made.dir);
      ok(out.includes('bogus is not an input of kit hsvg-starter; it has no inputs'), out);
    } finally { fs.rmSync(work, { recursive: true, force: true }); }
    const files = base();
    scene(files).uses = [{ id: 'badge', use: 'badge', into: 'badge-spot', with: { nope: '1', title: "'Hi'" } }];
    const d = checkExperience(mapSource(files), schemas()).diags.find(x => x.code === 'E-REF-UNKNOWN');
    ok(d?.message === 'use badge: "nope" is not an input of badge (blocks/badge/component.json); its inputs are title', d?.message);
  },
  async 'item 7: pack counts the files left out (--verbose names them) and refuses to replace another experience\'s package.json'() {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1a-'));
    try {
      const made = await newFromTemplate('my-quiz', 'quiz', work);
      const out = path.join(work, 'out');
      let said = runPack(made.dir, out);
      const left = said.split('\n').find(l => l.startsWith('left out'));
      ok(/^left out: \d+ files not reached by the experience \(--verbose names them\)$/.test(left), left);
      ok(!said.includes('replaced'), said);
      said = runPack(made.dir, out, '--verbose');
      ok(said.includes('left out (not reached by the experience): ') && said.includes('kits/hsvg-starter/'), said);
      ok(!said.includes('replaced'), 'the same experience again replaces nothing it should warn about');
      // Another experience into the same folder is refused (K2h): it would replace my-quiz's package.json.
      const other = spawnSync(process.execPath, [packTool, path.join(repo, 'docs', 'one-page', 'example'), out], { encoding: 'utf8' });
      eq(other.status, 1, other.stdout);
      ok((other.stdout + other.stderr).includes(`${path.join(out, 'package.json')} is the package file of my-quiz. Pack each experience into its own folder (for example ${path.join(out, 'star-counter')})`), other.stdout + other.stderr);
      ok(fs.existsSync(path.join(out, 'my-quiz.html')) && !fs.existsSync(path.join(out, 'star-counter.html')), 'nothing was written');
      eq(JSON.parse(fs.readFileSync(path.join(out, 'package.json'), 'utf8')).id, 'my-quiz', 'my-quiz keeps its package file');
      said = runPack(path.join(repo, 'docs', 'one-page', 'example'), path.join(out, 'star-counter'));
      ok(!said.includes('left out'), 'the example leaves nothing out');
    } finally { fs.rmSync(work, { recursive: true, force: true }); }
  },
};
