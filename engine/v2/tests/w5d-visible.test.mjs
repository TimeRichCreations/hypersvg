// C1 gap 3: a visible binding owns visibility (6.8). true shows a part drawn with display="none"; false
// hides it again; a part drawn shown is hidden and shown as before.
import { eq } from './helpers.mjs';
import { setup } from './w4d-helpers.mjs';

const edit = (f) => {
  f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', '<g id="shade" data-hsvg-kind="part" display="none"><rect width="10" height="10"/></g>\n<g id="plain" data-hsvg-kind="part"><rect width="10" height="10"/></g>\n<g id="dim-on" data-hsvg-kind="part"><rect x="700" y="500" width="40" height="40"/></g>\n</svg>');
  const s = f['scenes/one/scene.json'];
  s.values.dim = { type: 'boolean', initial: true };
  s.controls['dim-on'] = { kind: 'button', target: 'dim-on', label: 'Dim' };
  s.on['press:dim-on'] = [{ id: 'flip-dim', actions: [{ id: 'set-dim', set: 'dim', to: '!dim' }] }];
  s.bindings = [{ id: 'shade-shown', target: 'shade', visible: 'dim' }, { id: 'plain-shown', target: 'plain', visible: 'dim' }];
};

export const tests = {
  'visible true shows a part drawn with display="none"; false hides it again (6.8)'() {
    const { p, d } = setup({ edit });
    d.paint();
    const shade = d.frames.one.byLocal.get('shade'); const plain = d.frames.one.byLocal.get('plain');
    eq(shade.attrs.display, undefined, 'true shows the part drawn hidden');
    eq(plain.attrs.display, undefined, 'a part drawn shown stays shown');
    eq(p.send('one', 'press:dim-on').ok, true); d.paint();
    eq(shade.attrs.display, 'none', 'false hides it');
    eq(plain.attrs.display, 'none', 'false hides a part drawn shown');
    eq(p.send('one', 'press:dim-on').ok, true); d.paint();
    eq([shade.attrs.display, plain.attrs.display], [undefined, undefined], 'true again shows both');
  },
};
