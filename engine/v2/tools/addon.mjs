#!/usr/bin/env node
// The add-on tool (D23, spec chapter 12 "Writing an add-on"). Node standard library only.
//   node engine/v2/tools/addon.mjs new <preset|module|capability> <owner.name> [--in <folder>]
//       writes <folder>/addons/<owner.name>/ (default: the current folder; a folder named addons is used as it is): a
//       working add-on of that kind, with a
//       test (node tests/<name>.test.mjs) and a README. Refuses a folder that exists.
//   node engine/v2/tools/addon.mjs check <add-on folder>
//       checks the manifest and the files, says each fix, prints the digest. Exit 1 on an error.
//   node engine/v2/tools/addon.mjs digest <add-on folder>
//       prints the digest an experience pins: sha256 of its files (tests/ and hidden files left out).
//   node engine/v2/tools/addon.mjs pin <experience folder>
//       writes about.trust.pins for every outside add-on the experience names in needs or presets, after you have
//       reviewed their files. It prints each pin it writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkManifest, OUTSIDE_RE, KINDS, parseName, isOutside } from '../src/addons.mjs';
import { addonDigest, checkAddonFiles } from './addons.mjs';
import { folderSource } from '../src/load.mjs';

const ENGINE_ADDONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'addons');

// Checks an add-on folder: [{code, file, message}] (file relative to the folder).
export function checkFolder(dir) {
  dir = path.resolve(dir);
  const mf = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mf)) return [{ code: 'E-ADDON', file: 'manifest.json', message: `no manifest.json in ${dir}: an add-on is a folder with manifest.json and its files` }];
  let m;
  try { m = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch (e) { return [{ code: 'E-ADDON', file: 'manifest.json', message: `manifest.json is not JSON: ${e.message}` }]; }
  const builtIn = path.dirname(dir) === ENGINE_ADDONS;
  const out = checkManifest(m, { folder: path.basename(dir), builtIn }).map(d => ({ code: d.code, file: 'manifest.json', message: `${d.path ? `${d.path}: ` : ''}${d.message}` }));
  if (KINDS.includes(m?.kind)) out.push(...checkAddonFiles(dir, m.kind));
  return out;
}

const json = (v) => JSON.stringify(v, null, 2) + '\n';
const closed = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

// The files of a new add-on: {path: text}.
export function template(kind, id) {
  const name = id.split('.').pop();
  const head = { door: 2, id, version: '1.0.0', kind };
  const readme = (what, use) => `# ${id}\n\n${what}\n\n## Use it\n\n${use}\n\n## Check and test it\n\n\`\`\`sh\nnode engine/v2/tools/addon.mjs check addons/${id}\nnode addons/${id}/tests/${name}.test.mjs\n\`\`\`\n\nAfter a change, review it, then pin the new digest: \`node engine/v2/tools/addon.mjs pin <experience folder>\`.\n`;
  if (kind === 'preset') {
    const manifest = { ...head, title: 'Pulse', description: 'A clip that grows a part a little and back. Play it with {"play": "<as>"}. The part needs a scale motion range.',
      adds: {
        inputs: {
          target: { type: 'part', description: 'the part that pulses' },
          amount: { type: 'number', minimum: 1.01, maximum: 2, initial: 1.1, description: 'the largest scale' },
          durationMs: { type: 'integer', minimum: 100, maximum: 5000, initial: 500, description: 'how long one pulse takes' },
        },
        provides: { clips: { '{{as}}': { durationMs: 1000, speed: '1000 / {{durationMs}}', tracks: [{ id: '{{as}}-grow', target: '{{target}}', channel: 'scale', keys: [[0, 1], [500, '{{amount}}', 'ease-out'], [1000, 1, 'ease-in']] }] } } },
      } };
    const test = `// The preset's own test: node tests/${name}.test.mjs. It fills the preset's provides with its initial values, as the
// engine's expansion does, and checks the result is a clip. Run engine/v2/tools/addon.mjs check for the door's checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const values = { as: 'logo-pulse', target: 'logo' };
for (const [k, d] of Object.entries(m.adds.inputs)) if (d.initial !== undefined) values[k] = d.initial;
const fill = (s) => (typeof s === 'string' ? (/^\\{\\{(\\w+)\\}\\}$/.test(s) ? values[s.slice(2, -2)] : s.replace(/\\{\\{(\\w+)\\}\\}/g, (x, n) => values[n])) : s);
const walk = (n) => (Array.isArray(n) ? n.map(walk) : n && typeof n === 'object' ? Object.fromEntries(Object.entries(n).map(([k, v]) => [fill(k), walk(v)])) : fill(n));
const out = walk(m.adds.provides);
const clip = out.clips['logo-pulse'];
assert.ok(clip, 'the clip is named after as');
assert.equal(clip.tracks[0].target, 'logo');
assert.equal(clip.tracks[0].keys[1][1], m.adds.inputs.amount.initial);
console.log('${id}: ok');
`;
    return {
      'manifest.json': json(manifest), [`tests/${name}.test.mjs`]: test,
      'README.md': readme('A preset: JSON only. It adds a clip that pulses a part.', `In a scene, block or experience:\n\n\`\`\`json\n"presets": [{"use": "${id}@1.0.0", "as": "logo-pulse", "with": {"target": "logo"}}]\n\`\`\`\n\nThen play it: \`{"id": "pulse", "play": "logo-pulse"}\`. Pin \`${id}@1.0.0\` in the experience's \`about.trust.pins\`.`),
    };
  }
  if (kind === 'module') {
    const manifest = { ...head, title: 'Score keeper', description: 'Adds points to a score and says when the target is reached.',
      adds: { exports: { add: {
        description: 'Adds points to score, never above target.',
        with: closed({ score: { type: 'number', minimum: 0, maximum: 1000000 }, points: { type: 'number', minimum: 0, maximum: 1000 }, target: { type: 'number', step: 1, minimum: 1, maximum: 1000000 } }),
        returns: closed({ score: { type: 'number', minimum: 0, maximum: 1000000 }, reached: { type: 'boolean' } }),
        budgetMs: 20,
      } } } };
    const code = `// ${id}: a logic module (door 2). A pure function: it gets only step() and its inputs. It names no global, no clock and
// no random source, and does not catch. Call step() once per unit of work; the engine stops a call that runs too long.

export function make(step) {
  return {
    add({ score, points, target }) {
      step();
      const next = score + points > target ? target : score + points;
      return { score: next, reached: next >= target };
    },
  };
}
`;
    const test = `// The module's own test: node tests/${name}.test.mjs. It runs the module with a step counter, as the engine does.
import assert from 'node:assert/strict';
${'import'} { make } from '../index.mjs';
let steps = 0;
const api = make(() => { steps++; });
assert.deepEqual(api.add({ score: 8, points: 3, target: 10 }), { score: 10, reached: true });
assert.deepEqual(api.add({ score: 2, points: 3, target: 10 }), { score: 5, reached: false });
assert.ok(steps > 0, 'the module calls step()');
console.log('${id}: ok');
`;
    return {
      'manifest.json': json(manifest), 'index.mjs': code, [`tests/${name}.test.mjs`]: test,
      'README.md': readme('A logic module: a pure function, hash-locked. Trusted code, not a sandbox (D26).', `\`\`\`json\n"needs": ["${id}@1.0.0"],\n"about": {"trust": {"pins": {"${id}@1.0.0": "<digest>"}}}\n\`\`\`\n\nCall it in an action list: \`{"id": "add", "call": "${id}.add", "with": {"score": "score", "points": "3", "target": "10"}, "to": {"score": "score", "reached": "won"}}\`. Pack with \`--allow ${id}\`: the person packing reviews the code and is the page's host.`),
    };
  }
  if (kind === 'capability') {
    const manifest = { ...head, title: 'Fade', description: 'Fades a drawn part out and back in. A block sets it up under addons.<id>; content starts it with the call <id>.blink and hears <id>:shown when it is back.',
      adds: {
        keys: closed({ part: { type: 'string', maxLength: 48, description: 'the drawn part that fades' }, level: { type: 'string', maxLength: 48, description: 'a number value of the block, 0 to 1, that the add-on writes' } }),
        calls: { blink: { with: closed({ ms: { type: 'number', minimum: 50, maximum: 5000 } }) } },
        events: ['shown'],
        writes: ['level'],
      } };
    manifest.description = manifest.description.replaceAll('<id>', id);
    const code = `// ${id}: a capability add-on (door 2). install(door) runs in the engine and returns its hooks: calls (the manifest's
// calls) and timer (a timer it added is due). The door lets it write only the value its settings' level names and emit
// only its own events. attach({door}) runs in the browser page; door.part gives a style handle. No network, no evaluated
// text.

export function install(door) {
  return {
    calls: {
      blink(address, { ms }) {
        const s = door.settings(address);
        door.write(address, s.level, 0);
        door.timers.add(address, door.now() + ms, { back: true });
      },
    },
    timer(t) {
      const s = door.settings(t.owner);
      door.write(t.owner, s.level, 1);
      door.emit(t.owner, 'shown');
    },
  };
}

// The page part: the part's opacity follows the level, after each change.
export function attach({ door }) {
  const paint = () => {
    for (const address of door.blocks()) {
      const s = door.settings(address);
      const el = door.part(address, s.part);
      if (el) el.style.opacity = String(door.read(address, s.level));
    }
  };
  door.onDeliveries(() => queueMicrotask(paint));
  paint();
  return { sync: paint };
}
`;
    const test = `// The capability's own test: node tests/${name}.test.mjs. It installs the add-on on a small fake door and runs a call
// and its timer, as the engine does.
import assert from 'node:assert/strict';
${'import'} { install } from '../index.mjs';
const written = []; const emitted = []; const timers = [];
const door = { now: () => 0, settings: () => ({ part: 'logo', level: 'seen' }), write: (a, n, v) => written.push([n, v]),
  emit: (a, n) => emitted.push(n), timers: { add: (owner, due, f) => timers.push({ owner, due, ...f }) } };
const hooks = install(door);
hooks.calls.blink('scene', { ms: 300 });
assert.deepEqual(written, [['seen', 0]]);
assert.equal(timers[0].due, 300);
hooks.timer(timers[0]);
assert.deepEqual(written, [['seen', 0], ['seen', 1]]);
assert.deepEqual(emitted, ['shown']);
console.log('${id}: ok');
`;
    return {
      'manifest.json': json(manifest), 'index.mjs': code, [`tests/${name}.test.mjs`]: test,
      'README.md': readme('A capability: code in the page, allowed by the host, hash-locked, within the size limit.', `\`\`\`json\n"needs": ["${id}@1.0.0"],\n"about": {"trust": {"pins": {"${id}@1.0.0": "<digest>"}}}\n\`\`\`\n\nIn a block: \`"addons": {"${id}": {"part": "logo", "level": "seen"}}\` with a number value \`seen\` (0 to 1, initial 1). Start it: \`{"id": "blink", "call": "${id}.blink", "with": {"ms": "400"}}\`. Hear \`${id}:shown\` in \`on\`. Pack with \`--allow ${id}\`: the person packing is the page's host.`),
    };
  }
  throw new Error(`no kind ${kind}`);
}

// Writes a new add-on. Returns its folder.
export function create(kind, id, into = process.cwd()) {
  if (!KINDS.includes(kind)) throw new Error(`the kind is one of ${KINDS.join(', ')}`);
  if (!OUTSIDE_RE.test(id)) throw new Error(`${id} is not owner.name in lower case (for example acme.${id.replace(/[^a-z0-9-]/g, '') || 'shake'}): bare names are the engine's own`);
  // --in addons means the addons folder itself, not a folder that holds one (never addons/addons/<id>).
  const base = path.resolve(into);
  const dir = path.basename(base) === 'addons' ? path.join(base, id) : path.join(base, 'addons', id);
  if (fs.existsSync(dir)) throw new Error(`${dir} exists: choose another name or remove it`);
  for (const [rel, text] of Object.entries(template(kind, id))) {
    const f = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  return dir;
}

// Writes about.trust.pins for the outside add-ons an experience names. Returns [{pinned, digest, was}].
export async function pin(expDir) {
  expDir = path.resolve(expDir);
  const file = path.join(expDir, 'experience.json');
  const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
  const src = await folderSource(expDir);
  const names = new Set();
  const visit = (doc) => {
    for (const n of Array.isArray(doc?.needs) ? doc.needs : []) { const p = parseName(n); if (p && isOutside(p.id)) names.add(p.id); }
    for (const u of Array.isArray(doc?.presets) ? doc.presets : []) { const p = parseName(u?.use); if (p && isOutside(p.id)) names.add(p.id); }
  };
  visit(exp);
  (function walk(d) {
    for (const n of fs.readdirSync(d)) {
      if (n.startsWith('.') || n === 'addons' || n === 'node_modules') continue;
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.json') && p !== file) { try { visit(JSON.parse(fs.readFileSync(p, 'utf8'))); } catch { /* not a document */ } }
    }
  })(expDir);
  const pins = ((exp.about ??= {}).trust ??= {}).pins ??= {};
  const out = [];
  for (const id of [...names].sort()) {
    const dir = src.addonDir(id);
    if (!dir) throw new Error(`no folder for ${id}: put it at addons/${id}/ beside the experience or in a parent folder`);
    const version = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;
    for (const k of Object.keys(pins)) if (k.startsWith(`${id}@`) && k !== `${id}@${version}`) delete pins[k];
    const pinned = `${id}@${version}`;
    const digest = addonDigest(dir);
    out.push({ pinned, digest, was: pins[pinned] ?? null });
    pins[pinned] = digest;
  }
  fs.writeFileSync(file, json(exp));
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  const usage = 'usage:\n  node engine/v2/tools/addon.mjs new <preset|module|capability> <owner.name> [--in <folder>]\n  node engine/v2/tools/addon.mjs check <add-on folder>\n  node engine/v2/tools/addon.mjs digest <add-on folder>\n  node engine/v2/tools/addon.mjs pin <experience folder>';
  try {
    if (cmd === 'new' && args.length >= 2) {
      const i = args.indexOf('--in');
      const dir = create(args[0], args[1], i >= 0 ? args[i + 1] : process.cwd());
      const t = path.join(dir, 'tests', `${args[1].split('.').pop()}.test.mjs`);
      console.log(`wrote ${dir}\nnext: node ${path.relative(process.cwd(), t).startsWith('..') ? t : path.relative(process.cwd(), t)}`);
    } else if (cmd === 'check' && args.length === 1) {
      const found = checkFolder(args[0]);
      for (const f of found) console.log(`${f.code} ${f.file}: ${f.message}`);
      const errors = found.filter(f => f.code.startsWith('E-')).length;
      console.log(`${found.length} findings; digest ${addonDigest(path.resolve(args[0]))}`);
      process.exit(errors ? 1 : 0);
    } else if (cmd === 'digest' && args.length === 1) console.log(addonDigest(path.resolve(args[0])));
    else if (cmd === 'pin' && args.length === 1) {
      for (const p of await pin(args[0])) console.log(`${p.pinned}: ${p.digest}${p.was === p.digest ? ' (unchanged)' : p.was ? ' (was ' + p.was + ')' : ' (new)'}`);
    } else { console.error(usage); process.exit(2); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
