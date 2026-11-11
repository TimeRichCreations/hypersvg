// What files cannot prove (8.8): the rules a play run, a browser run or a person must settle. playingOnly(experience)
// lists, for every rule in the experience, the proof kinds the checker leaves open, so a check can report them `not-run`
// instead of passing them (8.8: a bounded search or a missing proof is never a pass).
import { PROOFS } from './tables.mjs';

// Kinds whose files proof covers only part of the rule (8.9 "files, playing": the checker proves what it can, the rest is play).
const FILES_PART = {
  inside: 'painted bounds while it moves', clear: 'painted covering after clips and filters', 'reading-order': 'the focus order at run time',
  keep: 'painted visibility in every output', keyboard: 'the keyboard path at run time', timing: 'the wait on the scene clock',
  scoring: 'changes made only by a seat\'s input', 'on-route': 'the part on the route at every sample (by construction, files)',
};

// Kinds whose `files` proof this checker has no evaluator for (8.9): nothing compares them with the drawing or the
// words, so a broken rule of these kinds would pass. They are listed `not-run` with the proof `files` (8.8: a missing
// proof is never a pass). `relation` is read only for its `overlay` allowance (plans.mjs), never proven.
export const NO_FILES_EVALUATOR = {
  protected: 'the checker does not compare a protected part with its kit original',
  fonts: 'the checker does not compare the drawn font families with the allowed list',
  colors: 'the checker does not compare the drawn paints with the colour roles',
  intrinsic: 'the checker does not measure intrinsic sizes',
  relation: 'the checker does not prove a relation between boxes',
  'answers-spread': 'the checker does not count how the answers spread',
  'no-copy': 'the checker does not compare the text with the protected sources',
};

export function playingOnly(experience) {
  const out = [];
  const docs = [[experience.file, experience.doc], ...[experience.shell, ...Object.values(experience.scenes), ...Object.values(experience.blocks)].filter(Boolean).map(b => [b.file, b.doc])];
  for (const [file, doc] of docs) {
    (doc.rules || []).forEach((r, i) => {
      if (!r || typeof r !== 'object') return;
      const given = Array.isArray(r.proof) ? r.proof : r.proof ? [r.proof] : (PROOFS[r.kind] || []);
      const path = `/rules/${i}`;
      if (given.includes('files') && NO_FILES_EVALUATOR[r.kind]) out.push({ file, path, rule: r.id, kind: r.kind, proof: 'files', why: `${NO_FILES_EVALUATOR[r.kind]}; it is not-run, never a pass (8.8)` });
      if (given.includes('playing')) out.push({ file, path, rule: r.id, kind: r.kind, proof: 'playing', why: FILES_PART[r.kind] || 'only play can show it' });
      if (given.includes('review')) out.push({ file, path, rule: r.id, kind: r.kind, proof: 'review', why: 'a person or an agent looks at the files' });
      if (r.maximum === 'host' || r.minimum === 'host') out.push({ file, path, rule: r.id, kind: r.kind, proof: 'host', why: 'the value comes from the host profile (A10.3); without one the rule is not-run' });
      if (r.kind === 'budget' && ['archiveBytes', 'unpackedBytes', 'files', 'pathsRewritten', 'suspendChars', 'lengthMs', 'repeatItems'].includes(r.measure)) out.push({ file, path, rule: r.id, kind: 'budget', proof: 'export', why: `${r.measure} is measured on the actual export or while playing (A10.3)` });
      if (['fits', 'contrast', 'readable'].includes(r.kind)) out.push({ file, path, rule: r.id, kind: r.kind, proof: 'measurer', why: 'a fit or text-size proof needs the pinned text measurer and fonts; without them it is not-run (8.8)' });
      // hit-target (8.9): each control target's painted box at the smallest declared size's scale; the 2.0 checker
      // does not measure painted boxes, so it is not-run, never a pass (G2 block 33).
      if (r.kind === 'hit-target') out.push({ file, path, rule: r.id, kind: r.kind, proof: 'measurer', why: "a control target's painted box at the smallest declared size needs a measurer; without one it is not-run (8.8)" });
    });
  }
  return out;
}
