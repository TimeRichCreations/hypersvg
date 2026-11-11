// Cross-file rules: the story graph (section 3), needs (10.11) and grants (10.5).
// The work is in story/: model (ids, links, chapters), graph, needs and grants.
import { buildModel } from './story/model.mjs';
import { checkGraph } from './story/graph.mjs';
import { checkNeeds } from './story/needs.mjs';
import { checkGrants } from './story/grants.mjs';

export function check(ctx) {
  const m = buildModel(ctx);
  if (!m.doc.story || typeof m.doc.story !== 'object') return;
  checkGraph(ctx, m);
  checkNeeds(ctx, m);
  checkGrants(ctx, m);
}
