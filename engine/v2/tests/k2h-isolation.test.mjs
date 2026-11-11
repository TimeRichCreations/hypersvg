import assert from 'node:assert/strict';
import path from 'node:path';
import { repo, schemas } from './helpers.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { parseXml } from '../schema/xml.mjs';

const freeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; };
export const tests = {
  async 'players share frozen definitions but keep inputs, state and drawings independent'() {
    for (const example of ['lamp', 'harbour', 'ad', 'list']) {
      const loaded = loadExperience(await folderSource(path.join(repo, 'docs/guide/examples', example)), schemas());
      assert.equal(loaded.diags.filter(d => d.code.startsWith('E-')).length, 0);
      const exp = freeze(loaded.experience);
      const a = new Player(exp), b = new Player(exp);
      assert.equal(a.start().ok, true); assert.equal(b.start().ok, true);
      const draw = (p, namespace) => { const d = new Drawing(p, { namespace }); d.mountScene(p.scene); d.paint(); assert.deepEqual(d.faults, []); return d; };
      const da = draw(a, 'one__'), db = draw(b, 'two__');
      assert.notEqual(da.root, db.root);
      if (example === 'lamp') {
        assert.equal(a.activate('lamp', 'switch').ok, true);
        assert.equal(a.read('experience', 'lit'), true);
        assert.equal(b.read('experience', 'lit'), false);
        da.paint(); db.paint();
        assert.equal(da.frames.lamp.byLocal.get('switch').attrs.id, 'one__lamp__switch');
        assert.equal(db.frames.lamp.byLocal.get('switch').attrs.id, 'two__lamp__switch');
      }
    }
  },
  async 'SVG namespaces rewrite local paint, clip, use, accessibility and follow references'() {
    const loaded = loadExperience(await folderSource(path.join(repo, 'docs/guide/examples/lamp')), schemas());
    const p = new Player(loaded.experience); p.start();
    const d = new Drawing(p, { namespace: 'mount__' });
    const root = parseXml('<svg><defs><linearGradient id="shade"/><clipPath id="clip"/></defs><title id="title">Title</title><desc id="desc">Description</desc><g id="shape" fill="url(#shade)" clip-path="url(#clip)" aria-labelledby="title desc" aria-describedby="desc"/><use href="#shape" data-hsvg-follow="shape"/></svg>');
    d.prefixIds(root, id => 'scene__' + id);
    const xml = d.serialize(root);
    for (const text of ['url(#mount__scene__shade)', 'url(#mount__scene__clip)', 'href="#mount__scene__shape"', 'aria-labelledby="mount__scene__title mount__scene__desc"', 'aria-describedby="mount__scene__desc"', 'data-hsvg-follow="mount__scene__shape"']) assert.ok(xml.includes(text), text);
  },
};
