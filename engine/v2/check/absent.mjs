// Needs whose add-on this release does not hold (D30). The registry (spec/2.0/capabilities.json) names every built-in
// add-on, and the core release keeps it, but the add-ons' code and manifests come with the hypersvg-addons release. A
// built-in capability is here when its module (engine/v2/src/capabilities/<name>.mjs) and its manifest are; a logic
// module when its folder (engine/v2/modules/<name>/) and its manifest are.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageNeeds, capabilityNames } from '../src/capabilities.mjs';

const v2 = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = path.join(v2, '..', '..', 'spec', '2.0');
let registry = null;
function builtIns() {
  if (registry) return registry;
  try { registry = JSON.parse(fs.readFileSync(path.join(spec, 'capabilities.json'), 'utf8')).capabilities || []; } catch { registry = []; }
  return registry;
}
// Whether this release holds a built-in add-on's code and manifest.
export function addonHeld(c) {
  const manifest = typeof c.manifest !== 'string' || fs.existsSync(path.join(spec, ...c.manifest.split('/')));
  const code = c.kind === 'module' ? fs.existsSync(path.join(v2, 'modules', c.name)) : fs.existsSync(path.join(v2, 'src', 'capabilities', `${c.name}.mjs`));
  return manifest && code;
}
// A known built-in add-on (in the registry) whose code this release does not hold, by name, or null.
export function knownAbsent(name) {
  const c = builtIns().find(x => x.name === name);
  return c && !addonHeld(c) ? c : null;
}
// Whether a call "<name>.<verb>" belongs to a known add-on this release does not hold (its registry entry owns it).
export const absentCall = (call, name) => !!knownAbsent(name)?.owns?.calls?.includes(call);
// The findings for a loaded experience: one W-ADDON-ABSENT per built-in add-on its needs name that is not here. The
// need is right: the add-on's words (its calls, events and addons.<name> settings) are accepted by name from the
// registry, and the rest of the experience is checked. It packs and plays only with the hypersvg-addons release.
export function absentAddons(experience) {
  const names = capabilityNames(packageNeeds(experience));
  const out = [];
  for (const n of names) {
    if (!knownAbsent(n)) continue;
    out.push({ file: experience.file || 'experience.json', code: 'W-ADDON-ABSENT', path: '/needs', message: `needs ${n}: the built-in add-on ${n} is not in this release; it comes with the hypersvg-addons release. Its calls, events and settings are checked by name only; the experience packs and plays with that release (D30)` });
  }
  return out;
}
