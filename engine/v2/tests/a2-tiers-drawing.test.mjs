// Content tiers in the drawing (7.9), without a browser, on the ladder fixture (engine/v2/tests/ladder-fixture).
// Without a DOM nothing is measured, so the ladder does not run; the tier still picks each field's wording.
import fs from 'node:fs';
import path from 'node:path';
import { loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { repo, schemas, eq, ok, mapSource } from './helpers.mjs';

const dir = path.join(repo, 'engine', 'v2', 'tests', 'ladder-fixture');
const disk = { read: (rel) => { const p = path.join(dir, ...rel.split('/')); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; } };
const LAYOUT = { '970x250': 'billboard', '728x90': 'leaderboard', '300x250': 'rectangle', '320x50': 'phone-strip' };
const draw = (source, size, opts = {}) => {
  const { experience, diags } = loadExperience(source, schemas());
  ok(experience, `the fixture loads: ${diags.map(d => d.code).join(', ')}`);
  const p = new Player(experience, opts);
  ok(p.start().ok);
  const [width, height] = size.split('x').map(Number);
  const d = new Drawing(p);
  d.mountScene('ad', LAYOUT[size], { width, height });
  d.paint();
  const text = (id) => d.frames.ad.byLocal.get(id).children.map(c => c.text ?? '').join('');
  return { p, d, text };
};
// The fixture's files as a map, to change them in a test.
const files = () => {
  const out = {};
  const walk = (sub) => { for (const e of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) { const rel = sub ? `${sub}/${e.name}` : e.name; if (e.isDirectory()) walk(rel); else out[rel] = fs.readFileSync(path.join(dir, rel), 'utf8'); } };
  walk('');
  return out;
};

export const tests = {
  'the tier by space picks each field wording at each size (7.9)'() {
    const want = { '970x250': ['rich', 'Fresh sourdough, baked at dawn and delivered warm', 'Offer ends Sunday. One loaf per order while stocks last. Terms at the counter.'],
      '728x90': ['short', 'Fresh sourdough', 'Terms apply.'], '300x250': ['medium', 'Fresh sourdough, delivered warm', 'Offer ends Sunday. One loaf per order while stocks last. Terms at the counter.'],
      '320x50': ['short', 'Fresh sourdough', 'Terms apply.'] };
    for (const [size, [tier, headline, legal]] of Object.entries(want)) {
      const { d, text } = draw(disk, size);
      eq(d.tierOf('ad'), { tier, why: 'space' }, size);
      eq(text('headline'), headline, `${size} headline`);
      eq(text('legal'), legal, `${size} legal: medium has no wording, so the nearest longer one`);
      eq(text('brand'), 'Harbour Bakery', `${size}: a plain field is not tiered`);
    }
  },
  'the tier by input follows the value; a field from a higher tier is left out below it (7.1, 7.9)'() {
    const f = files();
    const exp = JSON.parse(f['experience.json']);
    exp.axes[1] = { axis: 'content', select: 'input', value: 'depth', default: 'medium' };
    exp.inputs.depth = { kind: 'knob', type: 'string', enum: ['short', 'medium', 'rich'], initial: 'rich' };
    exp.inputs.legal.tier = 'medium';
    f['experience.json'] = JSON.stringify(exp);
    const { p, d, text } = draw(mapSource(f), '970x250');
    eq(d.tierOf('ad'), { tier: 'rich', why: 'input' });
    eq(text('headline'), 'Fresh sourdough, baked at dawn and delivered warm');
    p.state.blocks.experience.inputs.depth = 'short';
    d.paint();
    eq(d.tierOf('ad'), { tier: 'short', why: 'input' });
    eq(text('headline'), 'Fresh sourdough');
    eq(text('legal'), '', 'legal shows from medium up, so it reads as empty at short');
    p.state.blocks.experience.inputs.depth = 'medium';
    d.paint();
    eq([text('headline'), text('legal')], ['Fresh sourdough, delivered warm', 'Offer ends Sunday. One loaf per order while stocks last. Terms at the counter.']);
  },
  'without a content axis the tier is rich (7.9)'() {
    const f = files();
    const exp = JSON.parse(f['experience.json']);
    exp.axes = exp.axes.slice(0, 1);
    f['experience.json'] = JSON.stringify(exp);
    const { d, text } = draw(mapSource(f), '320x50');
    eq(d.tierOf('ad'), { tier: 'rich', why: 'none' });
    eq(text('headline'), 'Fresh sourdough, baked at dawn and delivered warm');
  },
};
