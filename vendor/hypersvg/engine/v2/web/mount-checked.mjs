// The checked mount (10.6, 10.12), shared by mount-web.mjs (a package, with the full loader src/load.mjs) and the
// HyperSVG path (asset-web.mjs and asset-lean.mjs, with src/load-asset.mjs, which carries no kit or add-on code).
// mountChecked(container, pkg, options, load): load(source, schemas) is the loader; the rest is mount-web.mjs's mount.
// Plain ES module, served as a file; no network.
import { play } from './player-web.mjs';
import { memberFindings, sha256 } from '../src/members.mjs';
import { addPlace } from './place-web.mjs';
import { applyHostWords } from '../src/host-words.mjs';
import { hostColors } from '../src/host-colors.mjs';

const TEXT = /\.(json|svg|csv|txt|vtt)$/;

// The options and the checks are mount-web.mjs's mount (see its comment).
export function mountChecked(container, pkg, { partition = 'device', onError = null, test = false, capabilities = {}, widgets = {}, host = null, options = {}, modules = null, schemas = null, timeLimits = null, faultBox = true, nonce = null, hostWords = null, clock = null, onMove = null, theme = null, colors = null } = {}, loadExperience) {
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
  const language = applyHostWords(checked.experience, hostWords); // throws E-WORDS before anything plays
  const assets = (p) => { const b = pkg[root ? `${root}/${p}` : p]; if (!b) throw new Error(`no member ${p}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
  const members = Object.fromEntries(Object.entries(pkg).map(([p, b]) => [rel(p), b]));
  // The checked definition is ready to instantiate; do not parse every member a second time.
  const state = play(container, { files: own, schemas: null, assets, partition, capabilities, onError, test, widgets, host, options, members, modules, load: () => checked, timeLimits, faultBox, nonce, language, clock, onMove, theme, colors, checkColors: hostColors });
  // The engine could not be made (a module or capability that does not install): throw its fault, with its code.
  if (!state.player) { const e = new Error(state.stopped.message); e.code = state.stopped.code; e.address = state.stopped.address; throw e; }
  return addPlace(state);
}
