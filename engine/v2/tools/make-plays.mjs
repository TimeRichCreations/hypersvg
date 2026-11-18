// Writes the whole-play test files (spec/2.0/conformance/plays/, 9.6.2; added after 2.0.0-next.0). Each file is one
// play of an example that every core export holds: the package (its folder and each file's digest), how it starts
// (the clock's start, the inputs, the stored values), the moves (9.6) and the state fingerprint (9.6.1) after every
// move, with the outputs heard. Some plays are written here move by move; the others are seeded random walks, as the
// replay tests make them. tests/plays.test.mjs feeds every file to a fresh player and checks it is what this tool makes.
// Usage: node engine/v2/tools/make-plays.mjs [--check]
//   --check  write nothing; exit 1 when a file differs from what this tool makes
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExperience, folderSource } from '../src/load.mjs';
import { loadSchemas } from '../schema/load.mjs';
import { logic } from '../src/logic.mjs';
import { sha256 } from '../src/members.mjs';
import { modulePort } from '../src/host.mjs';
import { unregister } from '../src/capabilities.mjs';
import { loadAddons } from './addons.mjs';
import { actionsNow } from './test/node-play.mjs';
import { VERSION } from '../src/version.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repo = path.resolve(here, '..', '..', '..');
export const folder = path.join(repo, 'spec', '2.0', 'conformance', 'plays');
export const FORMAT_ID = 'hsvg-play/1';
// The clock's start of every play: 1 January 2026, 00:00 UTC.
export const EPOCH = Date.UTC(2026, 0, 1);
// Moves a play file never holds: a door move has nothing to feed again (9.6, D62).
export const NOT_FED = ['door'];
// The examples every core export holds (release/lean.json "experiences").
export const EXAMPLES = {
  harbour: 'docs/guide/examples/harbour',
  lamp: 'docs/guide/examples/lamp',
  list: 'docs/guide/examples/list',
  ad: 'docs/guide/examples/ad',
  'one-page': 'docs/one-page/example',
  infographic: 'skill/2.0/examples/kinds/infographic',
  orientation: 'skill/2.0/examples/recipes/orientation',
  noughts: 'engine/v2/addons/examples/noughts',
  doors: 'engine/v2/addons/examples/doors',
  'addon-lamp': 'engine/v2/addons/examples/lamp',
};
const TEXT = /\.(json|svg|csv|txt|vtt|md|mjs)$/;
const posix = (p) => p.split(path.sep).join('/');

// The digest of a package file: SHA-256 of its bytes, with a text file's line ends as LF (a checkout on Windows may
// write CRLF).
export function fileDigest(file) {
  const bytes = fs.readFileSync(file);
  if (!TEXT.test(file)) return sha256(bytes);
  return sha256(new TextEncoder().encode(bytes.toString('utf8').replace(/\r\n/g, '\n')));
}
// Every file of an example folder, by its path inside the folder: its digest. Sorted by path.
export function packageFiles(rel) {
  const root = path.join(repo, ...rel.split('/'));
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else out.push([posix(path.relative(root, p)), fileDigest(p)]);
    }
  };
  walk(root);
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return Object.fromEntries(out);
}

let schemaCache = null;
const schemas = () => (schemaCache ??= loadSchemas(path.join(repo, 'spec', '2.0')));
const opened = new Map();
// An example, checked as a host checks it, with the add-ons it pins loaded (their code runs in Node, as a host's would).
// Returns {experience, addons: {pinned: digest}, capabilities()}: capabilities() gives fresh module ports.
export async function openExample(rel) {
  if (opened.has(rel)) return opened.get(rel);
  const src = await folderSource(path.join(repo, ...rel.split('/')));
  const l = loadExperience(src, schemas());
  if (!l.experience) throw new Error(`${rel}: ${l.diags.filter(d => d.code.startsWith('E-')).map(d => `${d.code} ${d.message}`).join('; ')}`);
  const ids = Object.keys(l.experience.addons || {});
  const loaded = ids.length ? await loadAddons(src, l.experience, { allow: ids }) : [];
  const lock = Object.fromEntries(loaded.map(a => [a.pinned, a.digest]));
  const out = { experience: l.experience, addons: lock, capabilities: () => Object.fromEntries(loaded.map(a => [a.id, modulePort({ lock })])) };
  opened.set(rel, out);
  return out;
}
// Unregisters the add-ons openExample loaded, so later code in the same process sees only its own (the engine's tests
// run in one process).
export function closeExamples() {
  for (const ex of opened.values()) for (const pinned of Object.keys(ex.addons)) unregister(pinned.slice(0, pinned.indexOf('@')));
  opened.clear();
}

// A store over strings, as a page's localStorage, holding the records a play starts with.
const memoryStore = (init = {}) => { const m = new Map(Object.entries(init)); return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => { m.set(k, String(v)); }, remove: (k) => { m.delete(k); } }; };
// The stored values a play starts with, as the engine's storage option: start.stored is {scope: record}, each record
// as the engine writes it ({stamp, values: {"<address>#<name>": value}, knobs, graph}), with an empty page path and the
// partition "device". The engine reads a scope only when the experience's storage grant names it (10.5). The guide's
// harbour asks for saved storage (D64 7), and the play harbour-saved starts with a saved record; the others start with
// null.
export function storageOf(doc, stored) {
  if (!stored) return undefined;
  const opts = { grants: Object.keys(stored), page: '', partition: 'device' };
  for (const [scope, rec] of Object.entries(stored)) opts[scope] = memoryStore({ [`hsvg/2.0||${doc.id}|device|${scope}`]: JSON.stringify(rec) });
  return opts;
}
// The host of a play with stored values: a host profile that gives the experience the grants it asks for, with
// storage for the scopes of start.stored. A play without stored values has no host profile (null).
export function hostOf(doc, stored) {
  if (!stored) return null;
  return { format: 'hsvg/2.0', kind: 'host-profile', id: 'play', grants: { ...structuredClone(doc.grants || {}), storage: Object.keys(stored) } };
}
// The experience with the play's start inputs as the inputs' initial values (as a host places a HyperSVG with inputs).
export function withInputs(experience, inputs) {
  if (!inputs || !Object.keys(inputs).length) return experience;
  const decls = { ...experience.doc.inputs };
  for (const [k, v] of Object.entries(inputs)) {
    if (!decls[k]) throw new Error(`start.inputs names ${k}, which the experience does not declare`);
    decls[k] = { ...decls[k], initial: structuredClone(v) };
  }
  return { ...experience, doc: { ...experience.doc, inputs: decls } };
}
// A fresh logic-only player for a play's start. onMove hears the moves.
export async function startPlayer(rel, start, onMove = null) {
  const ex = await openExample(rel);
  const exp = withInputs(ex.experience, start.inputs);
  return logic(exp, { clock: (t) => start.epochMs + t, capabilities: ex.capabilities(), storage: storageOf(exp.doc, start.stored), host: hostOf(exp.doc, start.stored), ...(onMove ? { onMove } : {}) });
}
const plain = (v) => JSON.parse(JSON.stringify(v));
// What a step's result says beyond ok: a refused input's fault code, or why an input was ignored (a control that is off).
export function resultNote(r) {
  if (!r || typeof r !== 'object') return {};
  if (r.ok === false) return { refused: r.fault?.code || r.code || 'refused' };
  return typeof r.ignored === 'string' ? { ignored: r.ignored } : {};
}

// The inputs a person makes with a press, a key press or a pointer-down (9.6), with whether a payload is one: a page
// sends the move firstInput just before the first of them in a run (10.4, 5.12), and so does a play.
const PRESSES = {
  activate: (p) => p[3] == null || p[3] === 'person',
  hold: (p) => p[2] === true && (p[3] == null || p[3] === 'person'),
  snap: () => true,
  key: (p) => !p[1] && (p[2] == null || p[2] === 'person'),
  pick: () => true,
  closeDialog: () => true,
};
// Plays one play: script(api) feeds moves (api.move(t, source, ...payload)). Returns the steps: {move, refused? or
// ignored?, fingerprint, heard}, and the end: {t, fingerprint, heard, state}, after the clock runs on to t.
async function playOut(rel, start, script) {
  const heardMoves = [];
  const l = await startPlayer(rel, start, (m) => heardMoves.push(plain(m)));
  const steps = [];
  let seen = 0;
  const take = () => { const h = l.heard.slice(seen); seen = l.heard.length; return h; };
  // The moves the hook heard since the last step become steps; each gets the fingerprint after it.
  const settle = (result) => {
    const fresh = heardMoves.splice(0);
    if (fresh.length > 1) throw new Error(`${rel}: one input was heard as ${fresh.length} moves: ${JSON.stringify(fresh).slice(0, 200)}`);
    if (!fresh.length) return;
    const move = fresh[0];
    if (NOT_FED.includes(move.source)) throw new Error(`${rel}: a play file never holds a ${move.source} move`);
    steps.push({ move, ...resultNote(result), fingerprint: l.fingerprint(), heard: take() });
  };
  let end = null;
  const api = {
    player: l.player,
    get now() { return l.now; },
    move: (t, source, ...payload) => {
      if (PRESSES[source]?.(payload) && !l.player.state.firstInput && !l.player.stopped) settle(l.feed({ t, source: 'firstInput', payload: [] }));
      settle(l.feed({ t, source, payload }));
    },
    advance: (ms) => l.advance(ms),
    end: (t) => { if (t > l.now) l.advance(t - l.now); end = { t, fingerprint: l.fingerprint(), heard: take(), state: l.state() }; },
  };
  await script(api);
  if (heardMoves.length) throw new Error(`${rel}: a move was heard after the last step`);
  if (!end) throw new Error(`${rel}: a play ends with api.end(t)`);
  return { steps, end };
}

// A seeded random walk: at each step one usable control or choice (as the test crawler finds them), then the clock
// moves 300 to 1199 ms. The same walk as the replay tests' (tests/r1-replay.test.mjs).
const walk = (steps, seed) => (api) => {
  let s = seed;
  api.move(0, 'start', null);
  for (let i = 0; i < steps && !api.player.stopped; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const acts = actionsNow(api.player).filter(x => x.t !== 'wait');
    const x = acts[s % Math.max(1, acts.length)];
    const t = api.now;
    if (x?.t === 'use') api.move(t, 'activate', x.addr, x.cid, x.arg ?? null);
    else if (x?.t === 'pick') api.move(t, 'pick', x.link);
    else if (x?.t === 'close') api.move(t, 'closeDialog', x.dialog);
    api.advance(300 + (s % 900));
  }
  api.end(api.now);
};

// The plays. Each: name, example, what it shows, start ({inputs, stored}; the clock's start is EPOCH), script.
export const PLAYS = [
  // ---------- the guide's harbour: a shell, components, a machine timer, clips, a choice control, a record ----------
  {
    name: 'harbour-win', example: 'harbour',
    about: 'The gate, then ten loads: the score reaches 10 and done is heard (a win). The ferry sails on each load and its 2 s timer runs out between loads. A host input sets the title first.',
    start: { inputs: { title: 'Quay day' } },
    script(a) {
      a.move(0, 'start', null);
      a.move(500, 'activate', 'gate', 'go');
      let t = 1200;
      for (let i = 0; i < 10; i++) { a.move(t, 'activate', 'harbour', 'go'); t += i % 3 === 2 ? 2600 : 700; }
      a.end(t + 2500);
    },
  },
  {
    name: 'harbour-miss-and-restart', example: 'harbour',
    about: 'A drop in the bin is a miss (the clip stops); a drop in the basket at speed 0 fails its guard; at speed 120 it loads, writes a record row, shakes the lead crate and attaches it. A choice control, the shell\'s dialog and mute, a host input, a knob, then a restart (engine time 0 again).',
    start: {},
    script(a) {
      a.move(0, 'start', null);
      a.move(300, 'activate', 'gate', 'go');
      a.move(1000, 'activate', 'harbour', 'parcel', 'bin');
      a.move(1400, 'activate', 'harbour', 'parcel', 'basket');
      a.move(1800, 'activate', 'harbour', 'speed', 120);
      a.move(2100, 'activate', 'harbour', 'parcel', 'basket');
      a.move(2500, 'activate', 'harbour', 'pick', 'a');
      a.move(2900, 'activate', 'harbour', 'pick', 'b');
      a.move(3200, 'activate', 'harbour', 'wind', -30);
      a.move(3500, 'activate', 'harbour', 'lamp');
      a.move(3900, 'activate', 'shell', 'gear');
      a.move(4300, 'closeDialog', 'settings');
      a.move(4600, 'activate', 'shell', 'mute');
      a.move(5000, 'setInput', 'title', 'Evening tide', 'host');
      a.move(5200, 'setInput', 'pace', 4, 'host');
      a.move(5600, 'activate', 'shell', 'forget');
      a.move(6000, 'restart');
      a.move(400, 'activate', 'gate', 'go');
      a.end(2000);
    },
  },
  {
    name: 'harbour-ambient', example: 'harbour',
    about: 'Moves from the host and the system: a size, reduced motion, a host pause that holds the timers, and a key.',
    start: {},
    script(a) {
      a.move(0, 'start', null);
      a.move(200, 'setSize', { shape: 'wide', width: 800, height: 450 });
      a.move(400, 'activate', 'gate', 'go');
      a.move(1000, 'activate', 'harbour', 'go');
      a.move(1500, 'setPause', 'host', true);
      a.move(4000, 'setPause', 'host', false);
      a.move(4200, 'motion', true);
      a.move(4500, 'key', 'Space');
      a.move(4600, 'key', 'Space', true);
      a.end(7000);
    },
  },
  {
    name: 'harbour-saved', example: 'harbour',
    about: 'The harbour asks for saved storage; the play starts with a saved record whose best is 7, so best starts at 7, not at its initial 0.',
    start: { stored: { saved: { stamp: '', values: { 'experience#best': 7 }, knobs: {}, graph: null } } },
    script(a) {
      a.move(0, 'start', null);
      a.move(400, 'activate', 'gate', 'go');
      a.move(1000, 'activate', 'harbour', 'go');
      a.end(3000);
    },
  },
  { name: 'harbour-walk', example: 'harbour', about: 'A seeded random walk of up to 40 steps (seed 7).', start: {}, script: walk(40, 7) },
  { name: 'harbour-walk-2', example: 'harbour', about: 'A seeded random walk of up to 40 steps (seed 1913).', start: {}, script: walk(40, 1913) },
  // ---------- the guide's lamp: knobs and an event ----------
  {
    name: 'lamp-host', example: 'lamp',
    about: 'The host sets the knobs (lit and height); the person flips the switch, and switched is heard each time.',
    start: { inputs: { height: 1.25 } },
    script(a) {
      a.move(0, 'start', null);
      a.move(100, 'setInput', 'lit', true, 'host');
      a.move(600, 'activate', 'lamp', 'switch');
      a.move(900, 'activate', 'lamp', 'switch');
      a.move(1200, 'setInput', 'height', 0.5, 'host');
      a.move(1300, 'setInput', 'height', 2, 'host');
      a.move(1500, 'applySettings', [['lit', false], ['height', 1.5]], 'person');
      a.end(2000);
    },
  },
  { name: 'lamp-walk', example: 'lamp', about: 'A seeded random walk of up to 20 steps (seed 7).', start: {}, script: walk(20, 7) },
  // ---------- the guide's list: a list of component uses ----------
  {
    name: 'list-to-the-end', example: 'list',
    about: 'Next three times: the third press is ignored, since the button is off at the last town.',
    start: {},
    script(a) {
      a.move(0, 'start', null);
      a.move(500, 'activate', 'coast', 'next');
      a.move(1000, 'activate', 'coast', 'next');
      a.move(1500, 'activate', 'coast', 'next');
      a.end(1500);
    },
  },
  { name: 'list-walk', example: 'list', about: 'A seeded random walk of up to 10 steps (seed 3).', start: {}, script: walk(10, 3) },
  // ---------- the one-page example: a clip ----------
  {
    name: 'one-page-stars', example: 'one-page',
    about: 'Four presses, each playing the pop clip; one press while the clip still runs. Then reduced motion, and one more press.',
    start: {},
    script(a) {
      a.move(0, 'start', null);
      a.move(300, 'activate', 'hello', 'add');
      a.move(500, 'activate', 'hello', 'add');
      a.move(1200, 'activate', 'hello', 'add');
      a.move(2000, 'activate', 'hello', 'add');
      a.move(2100, 'motion', true);
      a.move(2500, 'activate', 'hello', 'add');
      a.end(3000);
    },
  },
  { name: 'one-page-walk', example: 'one-page', about: 'A seeded random walk of up to 15 steps (seed 11).', start: {}, script: walk(15, 11) },
  // ---------- examples with no controls: representations and data ----------
  {
    name: 'ad-sizes', example: 'ad',
    about: 'The ad in its sizes: the player box changes, and the host sets the headline.',
    start: {},
    script(a) {
      a.move(0, 'start', null);
      a.move(1000, 'setSize', { shape: 'tall', width: 160, height: 600 });
      a.move(2000, 'setSize', { shape: 'wide', width: 728, height: 90 });
      a.move(2500, 'setInput', 'headline', 'Fresh today', 'host');
      a.end(4000);
    },
  },
  {
    name: 'infographic-sizes', example: 'infographic',
    about: 'A data-drawn chart: the start, a size change and time running.',
    start: {},
    script(a) {
      a.move(0, 'start', null);
      a.move(800, 'setSize', { shape: 'square', width: 600, height: 600 });
      a.end(3000);
    },
  },
  {
    name: 'orientation-shapes', example: 'orientation',
    about: 'One scene in three shapes: taps between size changes.',
    start: {},
    script(a) {
      a.move(0, 'start', null);
      a.move(300, 'activate', 'harbour', 'tap');
      a.move(600, 'setSize', { shape: 'tall', width: 400, height: 800 });
      a.move(900, 'activate', 'harbour', 'tap');
      a.move(1200, 'setSize', { shape: 'square', width: 600, height: 600 });
      a.move(1500, 'activate', 'harbour', 'tap');
      a.end(1500);
    },
  },
  { name: 'orientation-walk', example: 'orientation', about: 'A seeded random walk of up to 10 steps (seed 5).', start: {}, script: walk(10, 5) },
  // ---------- the door examples: a logic module, a capability, an add-on control kind ----------
  {
    name: 'noughts-win', example: 'noughts',
    about: 'Easy level: X takes cells and wins against the logic module example.noughts. Bolt\'s reply waits on timers.',
    start: {},
    script: noughts('easy'),
  },
  {
    name: 'noughts-loss', example: 'noughts',
    about: 'Hard level: X plays badly and Bolt wins. A taken cell is refused by the game\'s guard. Then Again.',
    start: {},
    script: noughts('hard'),
  },
  { name: 'noughts-walk', example: 'noughts', about: 'A seeded random walk of up to 40 steps (seed 7).', start: {}, script: walk(40, 7) },
  {
    name: 'doors-wind', example: 'doors',
    about: 'The add-on control kind example.steps.stepper (its gestures up, down and press) and a gust clip.',
    start: {},
    script(a) {
      a.move(0, 'start', null);
      a.move(300, 'activate', 'yard', 'wind', 'up');
      a.move(500, 'activate', 'yard', 'wind', 'up');
      a.move(700, 'activate', 'yard', 'wind', 'down');
      a.move(900, 'activate', 'yard', 'wind', 'press');
      a.move(1200, 'activate', 'yard', 'gust');
      a.end(3000);
    },
  },
  { name: 'doors-walk', example: 'doors', about: 'A seeded random walk of up to 20 steps (seed 7).', start: {}, script: walk(20, 7) },
  {
    name: 'addon-lamp-switch', example: 'addon-lamp',
    about: 'A capability add-on (example.tint) that only draws: the switch, pressed three times.',
    start: {},
    script(a) {
      a.move(0, 'start', null);
      for (const t of [400, 800, 1600]) a.move(t, 'activate', 'room', 'switch');
      a.end(2500);
    },
  },
  { name: 'addon-lamp-walk', example: 'addon-lamp', about: 'A seeded random walk of up to 10 steps (seed 9).', start: {}, script: walk(10, 9) },
];
// The noughts plays: X's cells for each level (NOUGHTS), Bolt's reply waited for after each.
function noughts(level) {
  return (a) => {
    a.move(0, 'start', null);
    a.move(300, 'activate', 'pick', 'levels', level);
    a.move(600, 'activate', 'pick', 'go');
    let t = 1500;
    for (const c of NOUGHTS[level]) { a.move(t, 'activate', 'game', 'cells', c); t += 3500; }
    if (level === 'hard') a.move(t, 'activate', 'game', 'again');
    a.end(t + 3500);
  };
}
// Found once by a search over X's cells against the module (easy: a win; hard: a loss, with one taken cell pressed).
export const NOUGHTS = { easy: ['c0', 'c1', 'c6', 'c3'], hard: ['c0', 'c0', 'c1', 'c3'] };

// The text of one play file.
export async function playFile(play) {
  const rel = EXAMPLES[play.example];
  const ex = await openExample(rel);
  const start = { epochMs: EPOCH, inputs: play.start.inputs || {}, stored: play.start.stored || null };
  const { steps, end } = await playOut(rel, start, play.script);
  const doc = {
    format: FORMAT_ID,
    engine: VERSION,
    name: play.name,
    about: play.about,
    package: { folder: rel, experience: 'experience.json', files: packageFiles(rel), addons: ex.addons },
    start,
    steps,
    end,
  };
  return `${JSON.stringify(doc, null, 1)}\n`;
}
// Every file this tool writes: {name: text}.
export async function playFiles() {
  const out = {};
  try { for (const p of PLAYS) out[`${p.name}.json`] = await playFile(p); } finally { closeExamples(); }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const files = await playFiles();
  let differs = 0;
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(folder, name);
    const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
    if (now === text) continue;
    differs++;
    if (check) console.log(`differs: ${posix(path.relative(repo, file))}`);
    else { fs.mkdirSync(folder, { recursive: true }); fs.writeFileSync(file, text); console.log(`wrote ${posix(path.relative(repo, file))}`); }
  }
  const extra = fs.existsSync(folder) ? fs.readdirSync(folder).filter(f => f.endsWith('.json') && !(f in files)) : [];
  for (const f of extra) { differs++; console.log(`not made by this tool: ${f}`); }
  const moves = Object.values(files).reduce((n, t) => n + JSON.parse(t).steps.length, 0);
  if (check) { console.log(differs ? `${differs} file(s) differ` : `play files: up to date (${Object.keys(files).length} files, ${moves} moves)`); process.exit(differs ? 1 : 0); }
  console.log(`${Object.keys(files).length} files, ${moves} moves`);
}
