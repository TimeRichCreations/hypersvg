// The live-data capability (10.7, capabilities/live-data.json), as far as files show it. For each entry of the
// experience's addons.live-data.inputs (D31), keyed by an input's name:
// - it is a rows content field (`kind: content`, `type: array`, contentType `rows` or left out) of the experience, the
//   one document a host feeds through set (10.6) (E-TYPE);
// - its `table` names a declared data table (2.8) (E-REF-UNKNOWN);
// - its `fallback` names a data table with a resource (the rows that play when nothing is fed), whose key and columns
//   are the field's table's, so any fallback row is a row the field takes (E-REF-UNKNOWN, E-TYPE);
// - it has no `initial`: the fallback is its value before a feed (E-TYPE).
// The schemas refuse the pocket without live-data in needs (E-NEEDS-MISSING).
const esc = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function check(ctx) {
  const { experience: exp, report } = ctx;
  const owners = [exp, ...Object.values(exp.scenes || {}), ...Object.values(exp.blocks || {}), ...(exp.shell ? [exp.shell] : [])];
  const data = exp.doc?.data || {};
  for (const o of owners) {
    const doc = o?.doc;
    const pocket = doc?.addons?.['live-data']?.inputs;
    if (!pocket || typeof pocket !== 'object') continue;
    const file = o.file ?? 'experience.json';
    for (const [name, l] of Object.entries(pocket)) {
      const at = `/addons/live-data/inputs/${esc(name)}`;
      const d = doc.inputs?.[name];
      if (o !== exp) { report('E-TYPE', file, at, `${name}: only an input of the experience is fed by the host; a block takes rows through with (10.6, 10.7)`); continue; }
      if (!d || typeof d !== 'object') { report('E-REF-UNKNOWN', file, at, `${name} is not an input of the experience: addons.live-data.inputs is keyed by the name of a rows content field`); continue; }
      const ia = `/inputs/${esc(name)}`;
      if (d.kind !== 'content' || d.type !== 'array' || (d.contentType !== undefined && d.contentType !== 'rows')) { report('E-TYPE', file, at, `${name}: live data is for a rows content field (5.3.1)`); continue; }
      if (d.initial !== undefined) report('E-TYPE', file, `${ia}/initial`, `${name}: a live field takes its value from its fallback table; leave out initial (10.7)`);
      const table = data[d.table];
      if (typeof d.table !== 'string' || !table) { report('E-REF-UNKNOWN', file, `${ia}/table`, `${name}: a live field names its table (2.8); ${JSON.stringify(d.table)} is not a declared table`); continue; }
      const fb = data[l?.fallback];
      if (!fb) { report('E-REF-UNKNOWN', file, `${at}/fallback`, `${name}: the fallback ${JSON.stringify(l?.fallback)} is not a declared data table`); continue; }
      if (fb.resource === undefined) report('E-REF-UNKNOWN', file, `${at}/fallback`, `${name}: the fallback table ${l.fallback} has no resource, so it has no rows to play`);
      if (fb !== table && (fb.key !== table.key || !same(fb.columns, table.columns))) report('E-TYPE', file, `${at}/fallback`, `${name}: the fallback table ${l.fallback} has other columns or another key than the table ${d.table}`);
      if (fb.maxRows > table.maxRows) report('E-TYPE', file, `${at}/fallback`, `${name}: the fallback table ${l.fallback} may hold ${fb.maxRows} rows, over the table's ${table.maxRows}`);
    }
  }
}
