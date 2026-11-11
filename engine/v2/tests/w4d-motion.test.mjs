// Clips under reduced motion (6.7): finish, rest, keep, an endless loop. The web player reads the person's
// prefers-reduced-motion (drawing-browser.mjs).
import { eq, ok } from './helpers.mjs';
import { setup, tx } from './w4d-helpers.mjs';

export const tests = {
  'without reduced motion clips play in time'() {
    const { p, d } = setup();
    p.advance(500); d.paint();
    eq(tx(d.frames.one.byLocal.get('slider')), 50);
    eq(tx(d.frames.one.byLocal.get('spinner')), 50);
  },
  'under reduced motion finish shows the final pose and an endless loop its first key (6.7)'() {
    const { p, d } = setup({ reduced: true });
    d.paint();
    eq(tx(d.frames.one.byLocal.get('slider')), 100, 'finish: the final pose at once');
    eq(tx(d.frames.one.byLocal.get('spinner')), 0, 'an endless loop: its first key');
    p.advance(500); d.paint();
    eq(tx(d.frames.one.byLocal.get('slider')), 100);
    ok(p.state.blocks.one.clips.slide, 'the clip still runs until its normal end');
    ok(p.advance(500).every(x => x.ok));
    ok(!p.state.blocks.one.clips.slide, 'ended at its normal time');
  },
  'under reduced motion rest shows the first key, keep plays as usual (6.7)'() {
    const rest = setup({ reduced: true, edit: (f) => { f['scenes/one/scene.json'].clips.slide.reducedMotion = 'rest'; } });
    rest.d.paint();
    eq(tx(rest.d.frames.one.byLocal.get('slider')), 0);
    const keep = setup({ reduced: true, edit: (f) => { const c = f['scenes/one/scene.json'].clips; c.slide.reducedMotion = 'keep'; c.spin.reducedMotion = 'keep'; } });
    keep.p.advance(250); keep.d.paint();
    eq(tx(keep.d.frames.one.byLocal.get('slider')), 25);
    eq(tx(keep.d.frames.one.byLocal.get('spinner')), 25);
  },
  'reduced motion finish on a ping-pong clip with an even count ends at its first key'() {
    const { d } = setup({ reduced: true, edit: (f) => { Object.assign(f['scenes/one/scene.json'].clips.slide, { loop: 2, loopMode: 'ping-pong' }); } });
    d.paint();
    eq(tx(d.frames.one.byLocal.get('slider')), 0);
  },
};
