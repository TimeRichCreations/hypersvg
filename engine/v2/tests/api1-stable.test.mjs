// The API snapshot (spec 10.16, D63; added after 2.0.0-next.0). It lists every name of the public API with its label:
// the package entries' exports, the options of each mount, logic(), connectFrame() and pack(), the host API, the frame
// link, the <hypersvg-asset> element, the built-in outputs, the move sources, the command line and a packed page's
// globals. It fails when a stable name is removed or renamed. A name added to the code passes. Experimental and
// internal names are listed too: a change of label, or the removal of an experimental name, is a visible edit here.
// No browser: the entries are imported in Node, and the parts that need a page are read from their source.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MOVES, HOST_OUTPUTS } from '../src/runtime.mjs';
import { VERSION } from '../src/version.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { logic } from '../src/logic.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const read = (...p) => fs.readFileSync(path.join(repo, ...p), 'utf8');
const web = (f) => read('engine', 'v2', 'web', f);

// ---------- the list (spec 10.16) ----------
// Each entry: the module the package's export map names, and its exports by label.
export const ENTRIES = {
  './asset': { file: 'engine/v2/web/asset-web.mjs', stable: ['mount', 'mountAsync', 'HyperSvgAsset', 'useSchemas', 'sharedSchemas', 'readAsset', 'VERSION', 'elementVersion'], experimental: ['repack'], internal: [] },
  './asset-lean': { file: 'engine/v2/web/asset-lean.mjs', stable: ['mountAsync', 'HyperSvgAsset', 'useSchemas', 'sharedSchemas', 'VERSION', 'elementVersion'], experimental: [], internal: ['place', 'leanLoad', 'bundleCheck'] },
  './mount': { file: 'engine/v2/web/mount-web.mjs', stable: ['mount', 'VERSION'], experimental: ['aiPort', 'pagePort', 'modulePort'], internal: [] },
  './logic': { file: 'engine/v2/src/logic.mjs', stable: ['logic', 'fingerprint', 'fingerprintOf', 'stateDocument', 'canonicalJson'], experimental: [], internal: [] },
  './frame-host': { file: 'engine/v2/web/frame-host.mjs', stable: ['connectFrame', 'frameToken'], experimental: [], internal: [] },
  './schemas': { file: 'engine/v2/schema/load.mjs', stable: ['loadSchemas'], experimental: [], internal: [] },
  './pack': { file: 'engine/v2/tools/pack.mjs', stable: ['pack', 'packAsset', 'PackError'], experimental: [],
    internal: ['AUDIO', 'CAPABILITY_CSP', 'KEEP_TOLERANCE', 'PLAYER_NOTICE', 'addonCode', 'addonPins', 'bakeLadder', 'bakePlans', 'bundle', 'capabilityModules', 'checkModuleBytes', 'contentSecurityPolicy', 'engineSizes', 'estimateMeasure', 'flattenKit', 'initNote', 'logicModules', 'packNotes', 'seatPrograms', 'sizeFindings'] },
  './player': { file: 'engine/v2/web/player-web.mjs', stable: ['VERSION'], experimental: ['play'], internal: ['boot', 'useAudio', 'chooseFrame', 'learnFits', 'reducedUnder', 'linkWithoutHostLine'] },
};
// The schema files under ./schemas/*: core/ is stable, capabilities/ and addons/ are experimental.
export const SCHEMA_FILES = {
  stable: ['core/capability.schema.json', 'core/change.schema.json', 'core/component.schema.json', 'core/document.schema.json', 'core/drawing.rules.json', 'core/experience.schema.json', 'core/host-profile.schema.json', 'core/kit.schema.json', 'core/package.schema.json', 'core/play-test.schema.json', 'core/receipt.schema.json', 'core/rule-pack.schema.json', 'core/scene.schema.json', 'core/shell.schema.json'],
  experimental: ['capabilities/', 'addons/'],
};
// The options of each call: [file, function name, which parameter], and the names by label.
export const OPTIONS = {
  'mount() of a package': { at: ['engine/v2/web/mount-checked.mjs', 'mountChecked', 2], stable: ['schemas', 'host', 'options', 'partition', 'onError', 'timeLimits', 'faultBox', 'nonce', 'clock', 'onMove'], experimental: ['theme', 'hostWords', 'colors', 'modules', 'capabilities', 'widgets'], internal: ['test'] },
  'HyperSVG mounts': { at: ['engine/v2/web/asset-lean.mjs', 'place', 3], also: [['engine/v2/web/asset-lean.mjs', 'mountAsync', 3]], stable: ['schemas', 'partition', 'onError', 'timeLimits', 'integrity', 'faultBox', 'nonce', 'clock', 'onMove'], experimental: ['theme', 'options', 'hostWords', 'addonBase', 'colors'], internal: ['test', 'modules'] },
  'logic()': { at: ['engine/v2/src/logic.mjs', 'logic', 1], stable: ['schemas', 'clock', 'epochMs', 'onMove', 'host', 'options', 'storage', 'onError'], experimental: ['capabilities', 'modules'], internal: [] },
  'connectFrame()': { at: ['engine/v2/web/frame-host.mjs', 'connectFrame', 1], stable: ['channel', 'timeout', 'probe'], experimental: [], internal: [] },
  'pack()': { at: ['engine/v2/tools/pack.mjs', 'pack', 2], stable: [], experimental: ['host', 'allow', 'kits', 'test', 'acceptFindings'], internal: ['sizes', 'date'] },
};
export const HOST_API = {
  stable: ['on', 'read', 'set', 'emit', 'picture', 'timeLimits', 'pause', 'resume', 'paused', 'scene', 'restart', 'clearStorage', 'setPartition', 'destroy'],
  stableAsset: ['inputs', 'outputs'], // on HyperSVG mounts
  experimental: ['place', 'seat', 'ladder'],
  internal: ['internal'],
};
export const FRAME_LINK = {
  stable: ['set', 'emit', 'read', 'pause', 'resume', 'restart', 'scene', 'clearStorage', 'setPartition', 'on', 'off', 'close', 'ready'],
  experimental: ['seat', 'ladder'],
};
export const ELEMENT = {
  attributes: { stable: ['src', 'integrity', 'fault-box'], experimental: ['theme', 'addon-base', 'partition', 'colors'] },
  members: { stable: ['ready', 'host', 'inputs', 'read', 'set', 'on', 'nonce'], staticStable: ['version'] },
  events: { stable: ['hsvg:changed', 'hsvg:<output>', 'hsvg:error'] },
  marks: { stable: ['data-hsvg-refused', 'data-hsvg-still'] },
};
export const OUTPUTS = { stable: ['entered', 'ended', 'openUrl', 'firstInput', 'hsvg.changed'], experimental: ['hookHealth'] };
export const MOVE_SOURCES = {
  stable: ['start', 'restart', 'clearStorage', 'activate', 'hold', 'snap', 'key', 'send', 'trigger', 'setInput', 'hostPicture', 'applySettings', 'setPause', 'setSize', 'setLanguage', 'motion', 'closeDialog', 'shellEvent', 'pick', 'firstInput'],
  // seatInput belongs to the seats add-on (D66).
  experimental: ['door', 'ai.arrive', 'seatInput'],
};
export const CLI = {
  commands: ['init', 'check', 'test', 'pack', 'unpack', 'addon', '--version', '--help'],
  flags: { check: ['--json', '--review'], test: ['--quick', '--node-only', '--min-width', '--browser required', '--json', '--out'], pack: ['--asset', '--allow', '--test'], unpack: ['--force'], addon: ['new', 'check', 'digest', 'pin'] },
  internal: ['--only', '--paint', '--speed', '--baseline'],
};
export const PAGE = { stable: ['window.hsvg', 'window.hsvgReady', 'window.hsvgError'], internal: ['clock=manual', 'start', 'partition'] };

// ---------- helpers ----------
// The text between a bracket at i and its partner, skipping strings, template literals and comments.
function enclosed(src, i) {
  const open = src[i]; const close = { '(': ')', '{': '}', '[': ']' }[open];
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '"' || c === "'" || c === '`') { const q = c; j++; while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; } continue; }
    if (c === '/' && src[j + 1] === '/') { while (j < src.length && src[j] !== '\n') j++; continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') { depth--; if (depth === 0 && c === close) return src.slice(i + 1, j); }
  }
  throw new Error(`no closing ${close}`);
}
// Splits a list at its top-level commas.
function topLevel(text) {
  const out = []; let depth = 0; let cur = '';
  for (let j = 0; j < text.length; j++) {
    const c = text[j];
    if (c === '"' || c === "'" || c === '`') { const q = c; let k = j + 1; while (k < text.length && text[k] !== q) { if (text[k] === '\\') k++; k++; } cur += text.slice(j, k + 1); j = k; continue; }
    if ('({['.includes(c)) depth++;
    if (')}]'.includes(c)) depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// The option names a function destructures from one parameter: `{ a = 1, b: alias = 2, ...rest }` gives [a, b].
export function optionNames(file, fn, index) {
  const src = read(...file.split('/'));
  const m = new RegExp(`function ${fn}\\(`).exec(src);
  if (!m) throw new Error(`${file}: no function ${fn}`);
  const param = topLevel(enclosed(src, m.index + m[0].length - 1))[index];
  if (!param?.startsWith('{')) throw new Error(`${file} ${fn}: parameter ${index} is not destructured`);
  return topLevel(enclosed(param, 0)).filter(p => !p.startsWith('...')).map(p => /^([A-Za-z_$][\w$]*)/.exec(p)[1]);
}
// A name list written in a module's source: const NAME = [ ... ] or new Set([ ... ]).
function listIn(src, name) {
  const m = new RegExp(`const ${name} = (?:new Set\\()?\\[([^\\]]*)\\]`).exec(src);
  if (!m) throw new Error(`no list ${name}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}
// The names a list misses: stable ones are "removed or renamed".
const missing = (have, names) => names.filter(n => !have.includes(n));
const labelled = (x) => [...(x.stable || []), ...(x.experimental || []), ...(x.internal || [])];
function noDouble(where, x) {
  const all = labelled(x);
  eq(all.filter((n, i) => all.indexOf(n) !== i), [], `${where}: a name has two labels`);
}

export const tests = {
  async '10.16: every stable export of every package entry is there (exports by entry)'() {
    // The npm package's file is release/npm-package.json here, and package.json in an exported base.
    const file = [path.join(repo, 'release', 'npm-package.json'), path.join(repo, 'package.json')].find(f => fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).name === '@hypersvg/core');
    ok(file, 'the npm package file is here');
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [entry, e] of Object.entries(ENTRIES)) {
      noDouble(entry, e);
      eq(pkg.exports[entry], `./${e.file}`, `${entry} is the package's export of ${e.file}`);
      const have = Object.keys(await import(pathToFileURL(path.join(repo, ...e.file.split('/'))).href));
      eq(missing(have, e.stable), [], `${entry}: a stable export was removed or renamed`);
      eq(missing(have, [...e.experimental, ...e.internal]), [], `${entry}: a listed experimental or internal export is gone; edit the list (an experimental change needs a changelog note)`);
    }
    eq(pkg.exports['./schemas/*'], './spec/2.0/schemas/*');
    for (const f of SCHEMA_FILES.stable) ok(fs.existsSync(path.join(repo, 'spec', '2.0', 'schemas', ...f.split('/'))), `the stable schema file ${f} is there`);
    for (const d of SCHEMA_FILES.experimental) ok(fs.existsSync(path.join(repo, 'spec', '2.0', 'schemas', d)), `${d} is there`);
    ok(fs.existsSync(path.join(repo, 'engine', 'v2', 'web', 'hypersvg-asset.js')), 'the one-file player (experimental) is there');
  },
  'the snapshot test fails when a stable name is removed or renamed, and passes an addition'() {
    eq(missing(['mount', 'mountAsync', 'extra'], ['mount', 'mountAsync']), [], 'an addition passes');
    eq(missing(['mount', 'mountAsyncRenamed'], ['mount', 'mountAsync']), ['mountAsync'], 'a rename is found');
    eq(optionNames('engine/v2/src/logic.mjs', 'logic', 1).includes('epochMs'), true, 'options are read from the source');
  },
  '10.16: every stable option of each mount, logic(), connectFrame() and pack() is taken'() {
    for (const [where, o] of Object.entries(OPTIONS)) {
      noDouble(where, o);
      let have = optionNames(...o.at);
      for (const a of o.also || []) have = [...have, ...optionNames(...a)];
      // The HyperSVG mounts also take schemas (mount and mountAsync), integrity and addonBase (mountAsync).
      eq(missing(have, o.stable), [], `${where}: a stable option was removed or renamed`);
      eq(missing(have, [...o.experimental, ...o.internal, ...(o.unlisted || [])]), [], `${where}: a listed option is gone; edit the list`);
    }
    const sync = web('asset-web.mjs');
    ok(/const \{ schemas = null, \.\.\.rest \} = options/.test(sync), 'the synchronous HyperSVG mount takes schemas and passes the rest on');
  },
  async '10.16: the host API: every stable call is there; the page and asset calls are added where they are'() {
    noDouble('host API', HOST_API);
    const l = logic(loadExperience(await folderSource(path.join(repo, 'docs', 'guide', 'examples', 'lamp')), schemas()).experience, { epochMs: 0 });
    const have = Object.keys(Object.getOwnPropertyDescriptors(l.host));
    eq(missing(have, HOST_API.stable), [], 'a stable host call was removed or renamed');
    ok(have.includes('internal'), 'test mode adds internal');
    ok(have.includes('seat'), 'seat (experimental) is there');
    ok(/host\.inputs = /.test(web('asset-lean.mjs')) && /host\.outputs = /.test(web('asset-lean.mjs')), 'inputs() and outputs() on HyperSVG mounts');
    ok(/host\.place = /.test(web('place-web.mjs')), 'place(name) (experimental) on a page');
    ok(/state\.host\.ladder = /.test(web('player-web.mjs')), 'ladder() (experimental) on a page');
    ok(typeof l.player === 'object' && typeof l.feed === 'function', 'logic() returns feed and the internal player');
  },
  '10.16: the frame link carries every stable call, on both sides'() {
    const host = web('frame-host.mjs'); const page = web('frame-link.mjs');
    const calls = listIn(host, 'CALLS');
    const linkHas = [...calls, ...['on', 'off', 'close'].filter(n => new RegExp(`link\\.${n} = `).test(host)), ...(/const link = \{ channel, ready \}/.test(host) ? ['ready'] : [])];
    eq(missing(linkHas, FRAME_LINK.stable), [], 'a stable frame link call was removed or renamed (host side)');
    eq(missing(listIn(page, 'CALLS'), FRAME_LINK.stable.filter(n => !['close', 'ready'].includes(n))), [], 'the page side answers every stable call');
    eq(missing(calls, FRAME_LINK.experimental), [], 'seat and ladder (experimental) are carried');
  },
  async '10.16: the element: its attributes, members, events and marks'() {
    const src = web('asset-lean.mjs');
    const own = [...listIn(src, 'OWN'), ...listIn(src, 'OPTS')];
    eq(missing(own, ELEMENT.attributes.stable), [], 'a stable attribute was removed or renamed');
    eq(missing(own, ELEMENT.attributes.experimental), [], 'a listed experimental attribute is gone; edit the list');
    const { HyperSvgAsset } = await import('../web/asset-lean.mjs');
    const proto = Object.getOwnPropertyNames(HyperSvgAsset.prototype);
    eq(missing(proto, ['host', 'inputs', 'read', 'set', 'on']), [], 'a stable member was removed or renamed');
    ok(/this\.ready = /.test(src) && /this\.nonce/.test(src), 'ready and the nonce property');
    eq(HyperSvgAsset.version, VERSION, 'the static version');
    ok(/_send\('changed'/.test(src) && /_send\(o\.name/.test(src) && /_send\('error'/.test(src), 'hsvg:changed, hsvg:<output> and hsvg:error');
    ok(src.includes("'data-hsvg-refused'") && src.includes("'data-hsvg-still'"), 'data-hsvg-refused and data-hsvg-still');
  },
  '10.16: the built-in outputs and the move sources'() {
    eq(missing(HOST_OUTPUTS, OUTPUTS.stable.filter(n => !n.startsWith('hsvg.'))), [], 'a stable built-in output was removed or renamed');
    eq(missing(HOST_OUTPUTS, OUTPUTS.experimental), [], 'hookHealth (experimental)');
    eq(listIn(read('engine', 'v2', 'src', 'host.mjs'), 'PREFIXED'), ['changed'], 'hsvg.changed');
    eq(missing(MOVES, MOVE_SOURCES.stable), [], 'a stable move source was removed or renamed');
    const table = read('spec', '2.0', '09-engine.md');
    for (const s of [...MOVE_SOURCES.stable, ...MOVE_SOURCES.experimental]) ok(table.includes(`| \`${s}\` |`), `9.6's table has ${s}`);
  },
  '10.16: the command line: every stable command and flag is in the help; --version; usage exits 2'() {
    const bin = path.join(repo, 'bin', 'hypersvg.mjs');
    if (!fs.existsSync(bin)) return; // an export without the command line
    const run = (...a) => spawnSync(process.execPath, [bin, ...a], { encoding: 'utf8' });
    const help = run('--help');
    eq(help.status, 0, '--help exits 0');
    for (const c of CLI.commands) ok(help.stdout.includes(`hypersvg ${c}`), `the help lists ${c}`);
    ok(help.stdout.includes('addon new|check|digest|pin'), 'addon new|check|digest|pin');
    for (const [c, flags] of Object.entries(CLI.flags)) {
      const h = run(c, '--help');
      for (const f of flags) ok(h.stdout.includes(f), `${c} --help lists ${f}`);
    }
    const v = run('--version');
    eq([v.status, v.stdout.trim()], [0, VERSION], '--version prints the version');
    eq(run('no-such-command').status, 2, 'a usage error exits 2');
    for (const f of CLI.internal) ok(!help.stdout.includes(f), `${f} stays out of the help (internal)`);
  },
  '10.16: a packed page sets window.hsvg, hsvgReady and hsvgError; the address hooks only with --test'() {
    const src = web('packed-entry.mjs');
    for (const g of PAGE.stable) ok(src.includes(`${g} = `), `the packed page sets ${g}`);
    ok(/q\.get\('clock'\) === 'manual'/.test(src) && /q\.get\('start'\)/.test(src) && /q\.get\('partition'\)/.test(src) && /test \? location\.search : ''/.test(src), 'the test-only address hooks');
  },
  '10.16: the spec section names every stable and experimental name of this list'() {
    const text = read('spec', '2.0', '10-hosts-and-delivery.md');
    const at = text.indexOf('## 10.16 The stable API');
    ok(at > 0, 'chapter 10 has the section');
    const section = text.slice(at, text.indexOf('\n## ', at + 10));
    const names = new Set([
      ...Object.keys(ENTRIES), ...Object.values(ENTRIES).flatMap(e => [...e.stable, ...e.experimental]),
      ...Object.values(OPTIONS).flatMap(o => [...o.stable, ...o.experimental, ...o.internal]),
      ...HOST_API.stable, ...HOST_API.experimental, ...FRAME_LINK.stable,
      ...ELEMENT.attributes.stable, ...ELEMENT.attributes.experimental, 'hsvg:changed', 'hsvg:error', 'data-hsvg-refused',
      ...OUTPUTS.stable, ...OUTPUTS.experimental, 'door', 'ai.arrive', 'seatInput', 'init', 'unpack', '--force', '--node-only', '--min-width',
      'window.hsvg', 'window.hsvgReady', 'window.hsvgError',
    ]);
    const absent = [...names].filter(n => !section.includes(`\`${n}`));
    eq(absent, [], 'names the section does not write');
  },
};
