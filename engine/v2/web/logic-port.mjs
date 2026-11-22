// The logic port (internal): the logic-only engine of a page player, for the replay recorder. A page that already
// loaded a player (asset-lean.mjs, asset-web.mjs or a one-file build) gives the recorder this object, so the recorder
// carries no engine of its own and downloads no schemas. It reads a file that matched its integrity as the lean mount
// does: no schema check. It imports no checker (src/load.mjs, the schema modules).
//
//   import { logicPort } from '.../engine/v2/web/asset-lean.mjs';
//   const l = logicPort.logic(logicPort.loadTrusted(files), { clock, onMove });
//
// Members: VERSION, logic, canonicalJson, stateDocument, fingerprint, fingerprintOf (src/logic-core.mjs), readAsset
// (src/asset.mjs) and loadTrusted(files). Plain ES module; no DOM.
import { logic, canonicalJson, stateDocument, fingerprint, fingerprintOf } from '../src/logic-core.mjs';
import { readAsset } from '../src/asset.mjs';
import { readExperience } from '../src/read.mjs';
import { withUsedGrants } from '../src/grants-asked.mjs';
import { VERSION } from '../src/version.mjs';

const TEXT = /\.(json|svg|csv|txt|vtt)$/;
const fault = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

// The experience of a package's text members ({path: text or Uint8Array}; package.json and other members are left
// out), read as the lean mount reads a file that matched its integrity: parsed, not checked; a kit or an add-on preset
// refuses (an asset uses none, 2.13); the grants written from use are added as the checked load adds them. Throws
// {code, message, diagnostics} on a reader error.
function loadTrusted(files) {
  if (!files || typeof files !== 'object') throw fault('E-TYPE', 'loadTrusted takes the package\'s members: {path: text or bytes}');
  const dec = new TextDecoder();
  const texts = {};
  for (const [p, v] of Object.entries(files)) {
    if (p === 'package.json' || !TEXT.test(p)) continue;
    texts[p] = typeof v === 'string' ? v : dec.decode(v);
  }
  let preset = null;
  const r = readExperience({ read: (rel) => (rel in texts ? texts[rel] : null) }, null, { presets: { expand(doc, file) { preset ??= file; return { doc, diags: [] }; } } });
  if (preset) throw fault('E-ASSET', `${preset}: an asset uses no add-on preset`);
  const errors = r.diags.filter(d => d.code.startsWith('E-'));
  if (errors.length) throw fault(errors[0].code, errors.map(d => `${d.code} ${d.file}${d.path ? ` ${d.path}` : ''}: ${d.message}`).join('; '), { diagnostics: errors });
  if (!r.experience?.doc) throw fault('E-ASSET', 'the package has no experience');
  const g = withUsedGrants(r.experience);
  r.experience.derivedGrants = g.derived;
  if (Object.keys(g.derived).length) r.experience.doc.grants = g.grants;
  return r.experience;
}

export const logicPort = Object.freeze({ VERSION, logic, canonicalJson, stateDocument, fingerprint, fingerprintOf, readAsset, loadTrusted });
