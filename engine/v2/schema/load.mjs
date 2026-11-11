// Reads the generated schemas from <spec/2.0>/schemas into the shape check-document.mjs and drawing-check.mjs take.
// Node only (the browser engine is given the same objects by its loader).
import fs from 'node:fs';
import path from 'node:path';

export function loadSchemas(dir) {
  const base = path.join(dir, 'schemas');
  const readDir = (sub, suffix) => {
    const out = {};
    for (const f of fs.readdirSync(path.join(base, sub)).sort()) {
      if (!f.endsWith(suffix)) continue;
      out[f.slice(0, -suffix.length)] = JSON.parse(fs.readFileSync(path.join(base, sub, f), 'utf8'));
    }
    return out;
  };
  const core = readDir('core', '.schema.json');
  const kinds = {};
  for (const [k, s] of Object.entries(core)) if (k !== 'document') kinds[k] = s;
  return {
    kinds,
    document: core.document,
    drawing: JSON.parse(fs.readFileSync(path.join(base, 'core', 'drawing.rules.json'), 'utf8')),
    capabilities: readDir('capabilities', '.schema.json'),
    addons: readDir('addons', '.schema.json'),
  };
}
