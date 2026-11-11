// The host API's mount (10.6) for a page that plays a package itself. It checks the package before it plays (10.12),
// so it carries the schema and drawing checkers (src/load.mjs); the player itself (player-web.mjs) and a packed page do
// not (D19). Plain ES module, served as a file; no network.
import { loadExperience } from '../src/load.mjs';
import { play } from './player-web.mjs';
import { memberFindings, sha256 } from '../src/members.mjs';

const TEXT = /\.(json|svg|csv|txt|vtt)$/;

// The host API (10.6). pkg maps each member path to its bytes (Uint8Array) and includes package.json. Options: host,
// options, partition, onError, test, schemas. host is the host profile (A10.1) or null: the package must not
// raise a limit further than it allows (9.8.1, E-HOST-LIMIT, thrown), and must not need a grant it does not give
// (10.5, E-GRANT). options picks the host axes (E-AXIS-INPUT); the profile's options are the defaults. The host's
// budget rules are measured on the package bytes (player.internal.hostRules in test mode). Returns the face-only API.
// A mounted package is not a packed page, so it does not vouch for itself (10.9): its documents and drawings go
// through the document checker first (10.12), with schemas (the objects of spec/2.0/schemas, as engine/v2/schema/load.mjs
// gives them; the host serves them). A refused document throws with its code before anything plays; an hsvg/0.1 file
// is E-HEADER, and the message names the upgrade tool. A packed page (boot with checked) is the packer's and is not
// checked again.
// Before the documents, every member is checked against package.json's members (10.8, 10.9 rule 1): a changed,
// missing or extra member throws E-PACKAGE-DIGEST or E-PACKAGE-MEMBER and nothing plays. The package digest
// (about.trust.digest) is not checked here. Not built yet: the in-memory upgrade (A13.2).
// modules: the capability modules to use (src/capabilities/*.mjs records); without it, those registered in the page.
export function mount(container, pkg, { partition = 'device', onError = null, test = false, capabilities = {}, widgets = {}, host = null, options = {}, modules = null, schemas = null, timeLimits = null } = {}) {
  if (!schemas || typeof schemas !== 'object' || !schemas.kinds) throw new TypeError('mount needs options.schemas (spec/2.0/schemas): a mounted package is checked before it plays');
  const descriptor = pkg['package.json'];
  if (!descriptor) { const e = new Error('the package has no package.json'); e.code = 'E-PACKAGE-DESCRIPTOR'; throw e; }
  const dec = new TextDecoder();
  const desc = JSON.parse(dec.decode(descriptor));
  const bad = memberFindings(desc?.members, Object.keys(pkg), (p) => sha256(pkg[p]));
  if (bad.length) {
    const e = new Error(bad.map(d => `${d.code} ${d.path}: ${d.message}`).join('; '));
    e.code = bad[0].code; e.diagnostics = bad;
    throw e;
  }
  const files = {};
  for (const [p, bytes] of Object.entries(pkg)) if (TEXT.test(p) && p !== 'package.json') files[p] = dec.decode(bytes);
  const root = (desc.experience || 'experience.json').split('/').slice(0, -1).join('/');
  const rel = (p) => (root && p.startsWith(root + '/') ? p.slice(root.length + 1) : p);
  const own = Object.fromEntries(Object.entries(files).map(([p, t]) => [rel(p), t]));
  // The document checker at mount (10.12): headers, keys, types and bounds of every document; drawings.
  const checked = loadExperience({ read: (r) => (r in own ? own[r] : null) }, schemas);
  const errors = checked.diags.filter(d => d.code.startsWith('E-'));
  if (errors.length) {
    const e = new Error(errors.map(d => `${d.code} ${d.file}${d.path ? ` ${d.path}` : ''}: ${d.message}`).join('; '));
    e.code = errors[0].code; e.diagnostics = errors;
    throw e;
  }
  const assets = (p) => { const b = pkg[root ? `${root}/${p}` : p]; if (!b) throw new Error(`no member ${p}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
  const members = Object.fromEntries(Object.entries(pkg).map(([p, b]) => [rel(p), b]));
  // The checked definition is ready to instantiate; do not parse every member a second time.
  const state = play(container, { files: own, schemas: null, assets, partition, capabilities, onError, test, widgets, host, options, members, modules, load: () => checked, timeLimits });
  // The engine could not be made (a module or capability that does not install): throw its fault, with its code.
  if (!state.player) { const e = new Error(state.stopped.message); e.code = state.stopped.code; e.address = state.stopped.address; throw e; }
  return state.host;
}
