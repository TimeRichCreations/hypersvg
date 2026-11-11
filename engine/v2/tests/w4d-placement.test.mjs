// A use in a <rect> slot is fitted uniformly and centred, drawn right after the <rect> (5.10); repeated
// uses in a repeat region take its child slots in list order (4.5). The browser run sees the same (drawing-browser.mjs).
import { eq, ok } from './helpers.mjs';
import { setup, useSvg, attrs, NAMES } from './w4d-helpers.mjs';

export const tests = {
  'a use in a <rect> slot is fitted and centred in the box, after the rect (5.10)'() {
    const { d } = setup();
    for (const [addr, box, slotId] of [['one/big-badge', ['20', '20', '300', '100'], 'one__big-box'], ['one/small-badge', ['340', '20', '60', '60'], 'one__small-box']]) {
      const svg = useSvg(d, addr);
      eq(attrs(svg, 'x', 'y', 'width', 'height', 'preserveAspectRatio'), [...box, 'xMidYMid meet'], addr);
      eq(svg.attrs.viewBox, '0 0 40 20');
      const slot = d.frames.one.byLocal.get(slotId.slice(5));
      eq(slot.children.length, 0, 'the rect slot holds no children');
      const sib = slot.parent.children;
      ok(sib[sib.indexOf(slot) + 1] === svg, `${addr} is drawn right after its rect`);
    }
    ok(/<rect id="one__big-box"[^>]*\/><svg [^>]*data-player-use="one__big-badge"/.test(d.serialize()), 'serialized after the rect');
  },
  'the fitted scale of a use in a <rect> slot is the box over the viewBox (7.3)'() {
    const { d } = setup();
    eq(d.frames['one/big-badge'].scale, 5);
    eq(d.frames['one/small-badge'].scale, 1.5);
  },
  'repeated uses in a repeat region take its child slots in list order (4.5)'() {
    const { d } = setup();
    const row = d.frames.one.byLocal.get('row');
    const slots = row.children.filter(n => n.name);
    eq(slots.length, 5);
    NAMES.forEach((name, i) => {
      const addr = `one/dots[${name}]`;
      ok(d.frames[addr], `${addr} is drawn`);
      ok(slots[i].children[0] === useSvg(d, addr), `${name} is in slot ${i + 1}`);
    });
    d.paint();
    eq(d.frames['one/dots[cy]'].byLocal.get('name').children[0].text, 'cy');
    eq(d.faults, []);
  },
  'rows beyond a repeat region\'s slots are a fault and are not drawn (4.5)'() {
    const { d } = setup({ edit: (f) => { const s = f['scenes/one/scene.json']; s.values.names.maxItems = 6; s.values.names.initial = [...NAMES, 'fy']; } });
    ok(!d.frames['one/dots[fy]'], 'the sixth row has no slot');
    eq(d.faults.map(x => x.code), ['E-REPEAT-CAPACITY']);
  },
  'a non-repeated use into a repeat region is E-PLACE, not drawn'() {
    const { d } = setup({ edit: (f) => { f['scenes/one/scene.json'].uses[3].into = 'row'; } });
    ok(!d.frames['one/pin']);
    eq(d.faults.map(x => x.code), ['E-PLACE']);
  },
};
