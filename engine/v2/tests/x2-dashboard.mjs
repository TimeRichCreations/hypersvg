// A copy of the live-dashboard recipe with n rows and n repeat slots, built in memory. It checks clean (no
// findings) for any n the format allows; above the default liveRepeatedUses (256) it raises that limit, and the host
// profile it returns allows it (9.8.1). Used by x2-speed.test.mjs and by the measurements in reports/X2.md.
import fs from 'node:fs';
import path from 'node:path';
import { repo, schemas, mapSource } from './helpers.mjs';
import { loadExperience } from '../src/load.mjs';
import { FORMAT } from '../src/limits.mjs';

const dir = path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'live-dashboard');
const FILES = ['experience.json', 'data/sample.json', 'scenes/board/scene.json', 'scenes/board/board.svg', 'components/hour/component.json', 'components/hour/hour.svg'];

// The files of the n-row dashboard: { relative path: text }.
export function dashboardFiles(n, { scene, limit = n } = {}) {
  const files = {};
  for (const f of FILES) files[f] = fs.readFileSync(path.join(dir, ...f.split('/')), 'utf8');
  const exp = JSON.parse(files['experience.json']);
  exp.data.readings.maxRows = n;
  exp.inputs.readings.maxItems = n;
  if (limit > FORMAT.liveRepeatedUses) exp.limits = { liveRepeatedUses: limit };
  files['experience.json'] = JSON.stringify(exp, null, 1);
  if (scene) { const s = JSON.parse(files['scenes/board/scene.json']); scene(s); files['scenes/board/scene.json'] = JSON.stringify(s, null, 1); }
  const slots = Array.from({ length: n }, (_, i) => `      <g id="hour-${i + 1}" data-hsvg-kind="part" data-hsvg-slot="hour-${i + 1}" transform="translate(${430 + (i % 6) * 82} 488)"/>`).join('\n');
  files['scenes/board/board.svg'] = files['scenes/board/board.svg'].replace(/(<g id="hours"[^>]*>)[\s\S]*?(\n\s*<\/g>)/, `$1\n${slots}$2`);
  return files;
}
// The host profile that allows the dashboard's raised limit, or null when it raises none.
export const dashboardHost = (n) => (n > FORMAT.liveRepeatedUses ? { format: 'hsvg/2.0', kind: 'host-profile', id: 'x2-host', limits: { liveRepeatedUses: n } } : null);
export function loadDashboard(n, opts) {
  const r = loadExperience(mapSource(dashboardFiles(n, opts)), schemas());
  if (r.errors?.length) throw new Error(`the ${n}-row dashboard does not load: ${JSON.stringify(r.errors.slice(0, 3))}`);
  return r.experience;
}
// n rows with the keys h0..h(n-1); k changes the values (temp, wind and rain), so a second feed changes every row.
export const rows = (n, k = 1, keyFrom = 0) => Array.from({ length: n }, (_, i) => ({ id: `h${(i + keyFrom).toString(36)}`, hour: (i + keyFrom) % 24, temp: (i * k) % 40 - 10, wind: (i + k) % 60, rain: ((i * 7 + k) % 40) / 10 }));
