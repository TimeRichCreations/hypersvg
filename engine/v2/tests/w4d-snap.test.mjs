// A drag's snap (5.11). The rest is block state, painted on the item and rolled back with the block. The
// browser run drops by mouse and keyboard and resizes (drawing-browser.mjs).
import { eq, ok } from './helpers.mjs';
import { setup } from './w4d-helpers.mjs';

export const tests = {
  'a snapped drag is block state: painted on its item, rolled back with the block (5.11)'() {
    const { p, d } = setup();
    const token = d.frames.one.byLocal.get('token');
    ok(p.transaction('person', () => { p.state.blocks.one.snaps = { token: 'goal' }; }).ok);
    const rests = [...d.snapNodes().keys()];
    ok(rests.length === 1 && rests[0] === token, 'the token rests on its drop');
    // A transaction that faults rolls the rest back with the block.
    const r = p.transaction('person', () => { p.state.blocks.one.snaps = {}; p.write('one', 'heard', -5, 'set'); });
    eq(r.ok, false);
    eq(p.state.blocks.one.snaps, { token: 'goal' });
    // Without a browser there is nothing to measure: the item keeps its drawn transform and nothing faults.
    d.paint();
    eq(token.attrs.transform, undefined);
    eq(d.faults, []);
  },
  'a drag without snap never rests, whatever the block holds'() {
    const { p, d } = setup({ edit: (f) => { delete f['scenes/one/scene.json'].controls.token.snap; } });
    p.state.blocks.one.snaps = { token: 'goal' };
    eq(d.snapNodes().size, 0);
  },
  'the block entering afresh forgets the rest'() {
    const { p } = setup();
    p.state.blocks.one.snaps = { token: 'goal' };
    p.restart();
    eq(p.state.blocks.one.snaps, undefined);
  },
};
