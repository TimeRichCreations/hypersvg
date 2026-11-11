// Time per frame of an experience folder in Node: on each step asked for, the player advances 16 ms and the drawing
// paints what changed, as the page does on each animation frame. No browser, no text measuring.
// --full paints every binding each frame (a frame after a change that touches the whole step, as a drag does).
// Run alone: node engine/v2/tests/bench/frames-bench.mjs <experience folder> [frames] [step numbers, 1-based...] [--full]
// Prints, per step, the milliseconds per frame (median of 3 runs) and the faults seen.
import path from 'node:path';
import { loadExperience, folderSource } from '../../src/load.mjs';
import { Player } from '../../src/story.mjs';
import { Drawing } from '../../src/drawing.mjs';
import { schemas } from '../helpers.mjs';
import '../../src/capabilities/all.mjs';

export async function frames(folder, count = 600, steps = [1], full = false) {
  const loaded = loadExperience(await folderSource(path.resolve(folder)), schemas());
  const out = [];
  for (const step of steps) {
    const runs = [];
    let faults = 0;
    for (let run = 0; run < 3; run++) {
      const p = new Player(structuredClone(loaded.experience), { host: { grants: structuredClone(loaded.experience.doc.grants || {}) } });
      if (!p.start().ok) throw new Error(`${folder} did not start`);
      const order = Object.values(loaded.experience.doc.story?.chapters || {}).flatMap(c => c.scenes || []);
      const list = order.length ? order : Object.keys(loaded.experience.scenes);
      for (let i = 0; i < 20 && p.scene !== list[step - 1]; i++) { p.activate(p.scene, 'next'); p.advance(50); }
      if (p.scene !== list[step - 1]) throw new Error(`step ${step} (${list[step - 1]}) not reached; at ${p.scene}`);
      const lay = (doc) => doc?.layouts?.[0]?.id || 'main';
      const d = new Drawing(p);
      if (p.shellId) { d.mountShell(p.shellId, lay(loaded.experience.shell.doc)); d.mountStage(p.scene, lay(loaded.experience.scenes[p.scene].doc)); } else d.mountScene(p.scene, lay(loaded.experience.scenes[p.scene].doc));
      p.bindingPhase(() => d.paint());
      const t0 = performance.now();
      for (let f = 0; f < count; f++) {
        for (const r of p.advance(16)) if (r.ok === false) faults++;
        p.bindingPhase(() => d.paint(full ? null : p.takeDirty()));
      }
      runs.push((performance.now() - t0) / count);
      faults += d.faults.length;
    }
    runs.sort((a, b) => a - b);
    out.push({ step, msPerFrame: runs[1], faults });
  }
  return out;
}

if (process.argv[1]?.endsWith('frames-bench.mjs')) {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const [folder, n, ...steps] = args.filter(a => a !== '--full');
  for (const r of await frames(folder, Number(n || 600), steps.length ? steps.map(Number) : [1], full)) console.log(`${path.basename(path.resolve(folder))} step ${r.step}${full ? ' (full paint)' : ''}: ${r.msPerFrame.toFixed(2)} ms/frame, faults ${r.faults}`);
}
