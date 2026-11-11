// In a <g> slot the component root's pivot, default the viewBox centre, sits on the slot's origin, one
// unit to one unit (6.2.1, 5.10). The browser run sees the same (drawing-browser.mjs).
import { eq } from './helpers.mjs';
import { setup, useSvg, attrs } from './w4d-helpers.mjs';

export const tests = {
  'in a <g> slot the root pivot sits on the slot origin, in the slot\'s units (6.2.1)'() {
    const { d } = setup();
    eq(attrs(useSvg(d, 'one/pin'), 'x', 'y', 'width', 'height'), ['-20', '-40', '40', '40'], 'the pin\'s foot (20 40) at the origin');
    eq(attrs(useSvg(d, 'one/flag'), 'x', 'y', 'width', 'height'), ['-30', '-15', '60', '30'], 'the flag\'s viewBox centre at the origin');
    eq(attrs(useSvg(d, 'one/dots[ann]'), 'x', 'y'), ['-20', '-20']);
  },
  'a pivot of 0 0 keeps the viewBox origin on the slot origin (the skill\'s examples)'() {
    const { d } = setup({ edit: (f) => { f['components/flag/flag.svg'] = f['components/flag/flag.svg'].replace('data-hsvg-kind="component"', 'data-hsvg-kind="component" data-hsvg-pivot="0 0"'); } });
    eq(attrs(useSvg(d, 'one/flag'), 'x', 'y'), ['0', '0']);
  },
};
