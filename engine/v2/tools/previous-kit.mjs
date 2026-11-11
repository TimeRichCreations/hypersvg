// A kit as it was before a version change (4.8, A9.1): `--previous-kit <kit folder>` of check.mjs and change.mjs.
// The folder holds that kit's kit.json and files. It is read as the kit a small probe experience pins, so it loads as
// the checker loads any kit; the checker then compares the pinned kit with it (E-KIT-VERSION).
import fs from 'node:fs';
import path from 'node:path';
import { loadExperience } from '../src/load.mjs';

// Returns the loaded kit, or null when the folder holds no kit.
export function loadPreviousKit(kitDir, schemas) {
  const kitFile = path.join(kitDir, 'kit.json');
  if (!fs.existsSync(kitFile)) return null;
  const kdoc = JSON.parse(fs.readFileSync(kitFile, 'utf8'));
  const prefix = `kits/${kdoc.id}/`;
  const probe = JSON.stringify({ format: 'hsvg/2.0', kind: 'experience', id: 'previous-kit', kit: { id: kdoc.id, version: kdoc.about?.version } });
  const at = (rel) => (rel.startsWith(prefix) ? path.join(kitDir, ...rel.slice(prefix.length).split('/')) : null);
  const source = {
    read(rel) { if (rel === 'experience.json') return probe; const p = at(rel); return p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; },
    bytes(rel) { const p = at(rel); return p && fs.existsSync(p) && fs.statSync(p).isFile() ? new Uint8Array(fs.readFileSync(p)) : null; },
  };
  return loadExperience(source, schemas).experience?.kit ?? null;
}
