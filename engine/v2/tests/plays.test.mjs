// The whole-play test files (9.6.2, spec/2.0/conformance/plays/; added after 2.0.0-next.0): each file is fed to a fresh
// logic-only player, and gives the same state fingerprint and outputs after every move; the files are what
// make-plays.mjs makes; they cover the examples every core export holds, with the outcomes their names promise.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MOVES } from '../src/runtime.mjs';
import { VERSION } from '../src/version.mjs';
import { folder, FORMAT_ID, NOT_FED, EXAMPLES, playFiles, startPlayer, closeExamples } from '../tools/make-plays.mjs';
import { repo, spec, eq, ok } from './helpers.mjs';

const files = () => fs.readdirSync(folder).filter(f => f.endsWith('.json')).sort();
const read = (f) => JSON.parse(fs.readFileSync(path.join(folder, f), 'utf8'));
// A file's digest as the README says, written here apart from the tool: SHA-256 of the bytes, text line ends as LF.
const digest = (file) => {
  let bytes = fs.readFileSync(file);
  if (/\.(json|svg|csv|txt|vtt|md|mjs)$/.test(file)) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
};
const listed = (root) => {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(path.relative(root, p).split(path.sep).join('/')); } };
  walk(root);
  return out.sort();
};
const SOURCES = [...MOVES.filter(m => m !== 'advance'), 'ai.arrive'];

// Feeds one file to a fresh player. Returns what differs (empty when the file passes), and the states after each step.
// The test that calls it unregisters the add-ons after (closeExamples).
async function replayFile(doc, keep = false) {
  const wrong = [];
  const l = await startPlayer(doc.package.folder, doc.start);
  const states = [];
  let seen = 0;
  const heardNow = () => { const h = l.heard.slice(seen); seen = l.heard.length; return JSON.parse(JSON.stringify(h)); };
  doc.steps.forEach((s, i) => {
    const r = l.feed(structuredClone(s.move));
    const note = r?.ok === false ? { refused: r.fault?.code || r.code || 'refused' } : (typeof r?.ignored === 'string' ? { ignored: r.ignored } : {});
    if (JSON.stringify(note) !== JSON.stringify({ ...(s.refused ? { refused: s.refused } : {}), ...(s.ignored ? { ignored: s.ignored } : {}) })) wrong.push(`step ${i}: result ${JSON.stringify(note)}`);
    if (l.fingerprint() !== s.fingerprint) wrong.push(`step ${i} ${s.move.source}: fingerprint`);
    if (JSON.stringify(heardNow()) !== JSON.stringify(s.heard)) wrong.push(`step ${i}: heard`);
    if (keep) states.push(l.state());
  });
  if (doc.end.t > l.now) l.advance(doc.end.t - l.now);
  if (l.fingerprint() !== doc.end.fingerprint) wrong.push('end: fingerprint');
  if (JSON.stringify(heardNow()) !== JSON.stringify(doc.end.heard)) wrong.push('end: heard');
  if (JSON.stringify(l.state()) !== JSON.stringify(doc.end.state)) wrong.push('end: state');
  return { wrong, states };
}

export const tests = {
  async '9.6.2: every play file, fed to a fresh player, gives its fingerprint and outputs after every move'() {
    const wrong = [];
    let moves = 0;
    for (const f of files()) {
      const doc = read(f);
      moves += doc.steps.length;
      for (const w of (await replayFile(doc)).wrong) wrong.push(`${f} ${w}`);
    }
    eq(wrong, []);
    ok(files().length >= 20 && moves >= 250, `${files().length} files, ${moves} moves`);
  },
  async '9.6.2: the files are what make-plays.mjs makes'() {
    const made = await playFiles();
    eq(files(), Object.keys(made).sort());
    const stale = Object.entries(made).filter(([name, text]) => fs.readFileSync(path.join(folder, name), 'utf8').replace(/\r\n/g, '\n') !== text).map(([n]) => n);
    eq(stale, [], 'run node engine/v2/tools/make-plays.mjs');
  },
  '9.6.2: the format, key by key; the package files match their digests; no door move'() {
    for (const f of files()) {
      const d = read(f);
      eq(Object.keys(d), ['format', 'engine', 'name', 'about', 'package', 'start', 'steps', 'end'], f);
      eq(d.engine, VERSION, `${f}: names the engine version that made it (D64); after the release step sets VERSION, run make-plays.mjs`);
      eq([d.format, `${d.name}.json`], [FORMAT_ID, f]);
      eq(Object.keys(d.package), ['folder', 'experience', 'files', 'addons'], `${f} package`);
      const root = path.join(repo, ...d.package.folder.split('/'));
      eq(Object.keys(d.package.files), listed(root), `${f}: every file of the folder is listed`);
      for (const [p, sha] of Object.entries(d.package.files)) eq(digest(path.join(root, ...p.split('/'))), sha, `${f} ${p}`);
      ok(d.package.experience in d.package.files, `${f}: the experience file is in the package`);
      for (const [pin, sha] of Object.entries(d.package.addons)) ok(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/.test(pin) && /^sha256:[0-9a-f]{64}$/.test(sha), `${f} ${pin}`);
      eq(Object.keys(d.start), ['epochMs', 'inputs', 'stored'], `${f} start`);
      ok(d.steps[0].move.source === 'start', `${f}: the first move is the start`);
      let t = 0;
      for (const [i, s] of d.steps.entries()) {
        ok(Object.keys(s).every(k => ['move', 'refused', 'ignored', 'fingerprint', 'heard'].includes(k)), `${f} step ${i}: keys`);
        eq(Object.keys(s.move), ['t', 'source', 'payload'], `${f} step ${i}: a move of 9.6`);
        ok(SOURCES.includes(s.move.source) && !NOT_FED.includes(s.move.source), `${f} step ${i}: ${s.move.source} is a move a file may hold`);
        ok(s.move.t >= t || d.steps[i - 1]?.move.source === 'restart', `${f} step ${i}: moves in time order (a restart sets engine time to 0)`);
        t = s.move.t;
        ok(/^sha256:[0-9a-f]{64}$/.test(s.fingerprint), `${f} step ${i}: fingerprint`);
      }
      eq(Object.keys(d.end), ['t', 'fingerprint', 'heard', 'state'], `${f} end`);
      ok(d.end.t >= t, `${f}: the end comes after the last move`);
    }
  },
  '9.6.2: the plays cover every example a core export holds, each with a scripted play and most with a walk; the README names every file'() {
    // release/lean.json names the examples every core export holds; an export does not ship that file.
    const leanFile = path.join(repo, 'release', 'lean.json');
    const lean = Object.values(EXAMPLES);
    if (fs.existsSync(leanFile)) eq([...lean].sort(), JSON.parse(fs.readFileSync(leanFile, 'utf8')).experiences.sort(), 'the examples are those of release/lean.json');
    for (const rel of lean) ok(fs.existsSync(path.join(repo, ...rel.split('/'), 'experience.json')), `${rel} is here`);
    const by = {};
    for (const f of files()) (by[read(f).package.folder] ??= []).push(f);
    for (const rel of lean) ok(by[rel]?.some(f => !f.includes('-walk')), `${rel} has a scripted play`);
    eq(lean.filter(rel => by[rel].some(f => f.includes('-walk'))).length, 8, 'a walk for each example with controls (the ad and the infographic have none)');
    const readme = fs.readFileSync(path.join(folder, 'README.md'), 'utf8');
    for (const f of files()) ok(readme.includes(`\`${f}\``), `README names ${f}`);
    const sources = new Set(files().flatMap(f => read(f).steps.map(s => s.move.source)));
    for (const s of ['start', 'restart', 'activate', 'key', 'setInput', 'applySettings', 'setPause', 'setSize', 'motion', 'closeDialog']) ok(sources.has(s), `some play holds a ${s} move`);
  },
  async '9.6.2: the scripted plays reach what they say: a win, a loss, timers that run out, a restart, a record, refusals'() {
    const end = (f) => read(f).end.state;
    eq(end('harbour-win.json').blocks.harbour.values.score, 10, 'ten loads: the win');
    eq(end('harbour-win.json').blocks.experience.inputs.title, 'Quay day', 'the start input');
    const win = await replayFile(read('harbour-win.json'), true);
    ok(win.states.some(s => s.blocks.harbour?.machines.ferry[0] === 'sailing'), 'the ferry sails');
    ok(win.states.some(s => s.blocks.harbour?.values.note === 'Back in port'), 'its 2 s timer runs out between loads');
    eq(end('harbour-win.json').blocks.harbour.machines.ferry, ['docked'], 'and after the last load');
    eq(end('noughts-win.json').blocks.game.values.winner, 'X');
    const loss = read('noughts-loss.json');
    const ls = (await replayFile(loss, true)).states;
    eq(ls.at(-2).blocks.game.values.winner, 'O', 'Bolt wins before Again');
    eq(end('noughts-loss.json').blocks.game.values.board, ['', '', '', '', '', '', '', '', ''], 'Again rubs the board out');
    const miss = read('harbour-miss-and-restart.json');
    const ms = (await replayFile(miss, true)).states;
    ok(miss.steps.some(s => s.move.source === 'restart'), 'a restart');
    ok(ms.some(s => Object.values(s.records).some(r => r.length)), 'a record row');
    eq(read('list-to-the-end.json').steps.at(-1).ignored, 'disabled');
    eq(read('lamp-host.json').steps.find(s => s.refused)?.refused, 'E-RANGE', 'a host input out of bounds is refused');
    // D64 7: the harbour asks for saved storage, and a play starts with a saved record.
    const saved = read('harbour-saved.json');
    ok(saved.start.stored?.saved, 'harbour-saved starts with a saved record');
    eq(saved.end.state.blocks.experience.values.best, 7, 'best starts from the record, not its initial 0');
    eq(JSON.parse(fs.readFileSync(path.join(repo, 'docs', 'guide', 'examples', 'harbour', 'experience.json'), 'utf8')).grants.storage, ['saved'], 'the harbour asks for saved storage');
  },
  '10.4: firstInput comes once per run, just before the first press, as a page sends it; it is heard'() {
    const PRESS = ['activate', 'hold', 'snap', 'key', 'pick', 'closeDialog'];
    let seen = 0;
    for (const f of files()) {
      const steps = read(f).steps;
      let reported = false;
      steps.forEach((s, i) => {
        if (s.move.source === 'start' || s.move.source === 'restart') reported = false;
        if (s.move.source === 'firstInput') {
          ok(!reported, `${f} step ${i}: once per run`);
          ok(PRESS.includes(steps[i + 1]?.move.source), `${f} step ${i}: just before a press`);
          eq(s.heard.map(h => h.name), ['firstInput'], `${f} step ${i}: heard`);
          reported = true; seen++;
        }
        if (PRESS.includes(s.move.source) && s.move.source !== 'key' && (s.move.payload[3] ?? 'person') === 'person') ok(reported, `${f} step ${i}: a press after firstInput`);
      });
    }
    ok(seen >= 20, `${seen} firstInput moves`);
  },
  '9.6.2: the spec section names the folder and the format'() {
    const text = fs.readFileSync(path.join(spec, '09-engine.md'), 'utf8');
    ok(/### 9\.6\.2 /.test(text) && text.includes('spec/2.0/conformance/plays/') && text.includes(FORMAT_ID));
  },
};
// Each test unregisters the example add-ons it loaded, so later test files see only their own.
for (const [name, fn] of Object.entries(tests)) tests[name] = async () => { try { return await fn(); } finally { closeExamples(); } };
