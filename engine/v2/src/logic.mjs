// The logic-only entry (9.6, added after 2.0.0-next.0): plays a checked experience with no page. Story, runtime and
// formulas run; nothing is drawn, measured or sounded, and no web module is loaded. It runs in Node 20 and in a browser.
// A replay feeds it the moves a page's move hook heard (onMove) and compares state fingerprints (9.6.1) step by step.
//
//   import { logic } from '@hypersvg/core/logic';
//   const l = logic(pkg, { schemas, clock: (t) => epoch + t });
//   for (const m of moves) { l.feed(m); prints.push(l.fingerprint()); }
//
// logic(source, options): source is a package (member path -> Uint8Array, with package.json; it is checked as mount()
// checks it, so options.schemas is needed) or a checked experience (loadExperience(...).experience).
// Options: schemas; clock (engineMs) -> UTC ms, the wall clock that `now` reads (default Date.now); epochMs (a fixed date
// at engine time 0, instead of a clock); onMove (hears the moves, as on a page); host (the host profile); options (host
// axes); capabilities, modules (as for mount); storage (the engine's stored-value store, none by default); onError.
// Returns {feed(move), start(), advance(ms), read(name), heard, fingerprint(), state(), host, player}.
// What it cannot do: anything that needs the page. Layout measures (the ambient `layout`, the fit plans), sound and
// voice timing from audio, video places and drawn snapshots. The page add-ons' news (page signals and hook health, a
// video place's stalls, a snapshot's status) and seat fills are moves with their payloads (<add-on>.<name>), fed
// again here. A move whose source is `door` came from a page part with no payload to feed again: feed() skips it and
// returns {ok: true, ignored: 'needs a page'}. Once fed, the player starts no add-on step of its own from the page
// (a built-in AI answer matched from typed words comes as its ai.arrive move).
// readAsset (src/asset.mjs, a HyperSVG's documents and drawings, read with no check) and VERSION (the engine's
// version) are added after 2.0.0-next.1, experimental. The logic and the fingerprint live in src/logic-core.mjs, which
// carries no checker; this entry adds the checked load of a package.
// API labels (spec 10.16, D63), as the package's ./logic: logic, fingerprint, fingerprintOf, stateDocument and
// canonicalJson are stable; so are the options schemas, clock, epochMs, onMove, host, options, storage and onError.
// capabilities and modules are experimental. The player member of logic()'s result is internal.
import { logic as logicOf } from './logic-core.mjs';
import { memberFindings, sha256 } from './members.mjs';
import { loadExperience } from './load.mjs';

export { canonicalJson, stateDocument, fingerprint, fingerprintOf } from './logic-core.mjs';
export { readAsset } from './asset.mjs';
export { VERSION } from './version.mjs';

const refuse = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const TEXT = /\.(json|svg|csv|txt|vtt)$/;

// ---------- the entry ----------
// A checked experience from a package, as mount() checks it (10.8, 10.12): members against package.json, then every
// document and drawing. Throws {code, message} and plays nothing on a refusal.
function checkedPackage(pkg, schemas) {
  if (!schemas || !schemas.kinds) throw new TypeError('logic needs options.schemas (spec/2.0/schemas) for a package: it is checked before it plays');
  if (!pkg['package.json']) refuse('E-PACKAGE-DESCRIPTOR', 'the package has no package.json');
  const dec = new TextDecoder();
  const desc = JSON.parse(dec.decode(pkg['package.json']));
  const bad = memberFindings(desc?.members, Object.keys(pkg), (p) => sha256(pkg[p]));
  if (bad.length) refuse(bad[0].code, bad.map(d => `${d.code} ${d.path}: ${d.message}`).join('; '));
  const root = (desc.experience || 'experience.json').split('/').slice(0, -1).join('/');
  const files = {};
  for (const [p, b] of Object.entries(pkg)) if (TEXT.test(p) && p !== 'package.json') files[root && p.startsWith(root + '/') ? p.slice(root.length + 1) : p] = dec.decode(b);
  const checked = loadExperience({ read: (r) => (r in files ? files[r] : null) }, schemas);
  const errors = checked.diags.filter(d => d.code.startsWith('E-'));
  if (errors.length) refuse(errors[0].code, errors.map(d => `${d.code} ${d.file}${d.path ? ` ${d.path}` : ''}: ${d.message}`).join('; '));
  return checked.experience;
}

export function logic(source, { schemas = null, clock = null, epochMs = null, onMove = null, host = null, options = {}, capabilities = {}, modules = null, storage = undefined, onError = null } = {}) {
  if (clock !== null && typeof clock !== 'function') refuse('E-TYPE', 'clock is a function (engineMs) -> UTC ms');
  if (onMove !== null && typeof onMove !== 'function') refuse('E-TYPE', 'onMove is a function');
  const experience = source && source['package.json'] instanceof Uint8Array ? checkedPackage(source, schemas) : source;
  return logicOf(experience, { clock, epochMs, onMove, host, options, capabilities, modules, storage, onError });
}
