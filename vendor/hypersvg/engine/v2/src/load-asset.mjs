// The full check of a HyperSVG placed without integrity (added after 2.0.0-next.0): every document and drawing against
// the schemas, as loadExperience (load.mjs) checks a package, but without the kit and add-on machinery (src/kit.mjs,
// src/addons.mjs), which a HyperSVG cannot use (2.13: it uses no kit and no add-on). A kit pin, an add-on preset or an outside
// add-on pin is refused, so a page that places HyperSVGs never loads that code. Same result shape as loadExperience.
import { withUsedGrants } from './grants-asked.mjs';
import { parseStrict } from '../schema/json-strict.mjs';
import { raisedLimits } from './limits.mjs';
import { CHECKERS, raiseSchemas, undeclaredImages } from './load-checks.mjs';
import { readExperience } from './read.mjs';

const OUTSIDE_PIN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.[a-z][a-z0-9]*(-[a-z0-9]+)*@/; // owner.name@version (12)

export function loadAsset(source, schemas) {
  let raised = {};
  let top = null;
  try { top = parseStrict(source.read('experience.json') ?? '{}'); raised = raisedLimits([top]); } catch { /* the reader reports it */ }
  const diags = [];
  const pins = top?.about?.trust?.pins;
  for (const pinned of Object.keys(pins && typeof pins === 'object' ? pins : {})) if (OUTSIDE_PIN.test(pinned)) diags.push({ file: 'experience.json', code: 'E-ASSET', path: `about.trust.pins.${pinned}`, message: 'an asset uses no add-on (2.13)' });
  const presets = { expand(doc, file) { diags.push({ file, code: 'E-ASSET', path: 'presets', message: 'an asset uses no add-on preset (2.13)' }); return { doc, diags: [] }; } };
  const r = readExperience(source, raiseSchemas(schemas, raised), { checkers: CHECKERS, presets });
  diags.push(...r.diags, ...(schemas && r.experience ? undeclaredImages(r.experience) : []));
  if (r.experience?.doc) { const g = withUsedGrants(r.experience); r.experience.derivedGrants = g.derived; if (Object.keys(g.derived).length) r.experience.doc.grants = g.grants; }
  return { ...r, ok: !diags.some(d => d.code.startsWith('E-')), diags };
}
