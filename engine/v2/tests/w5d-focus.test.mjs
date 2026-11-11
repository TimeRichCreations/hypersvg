// C1 gap 4: a component's viewBox is not a paint limit (6.4). A mounted drawing is not clipped at its
// viewBox, so the focus outline of a control that fills it is painted (the browser run: drawing-browser.mjs).
import { eq } from './helpers.mjs';
import { setup, useSvg } from './w4d-helpers.mjs';

export const tests = {
  'a mounted drawing paints past its viewBox, in <g> and <rect> slots (6.4)'() {
    const { d } = setup();
    for (const addr of ['one/tile', 'one/pin', 'one/big-badge', 'one/dots[ann]']) eq(useSvg(d, addr).attrs.overflow, 'visible', addr);
  },
};
