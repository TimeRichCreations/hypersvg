// A control target's spoken name (10.13, 5.11), the rule the browser player writes as aria-label. The browser side
// is checked by tests/browser/input-browser.mjs and the test tool's T-NAME-HIDES-LABEL.
import { controlName } from '../web/input-web.mjs';
import { eq } from './helpers.mjs';

const tpl = (t) => t ? String(t).replace(/\{\{\s*n\s*\}\}/g, '3') : '';

export const tests = {
  'a choice\'s label names the group only: each option keeps its own label, else its drawn words'() {
    const c = { kind: 'choice', label: 'Colour', options: { teal: { target: 'o-teal' }, red: { target: 'o-red', label: 'Red' } } };
    eq(controlName(c, 'teal', true, tpl), undefined, 'no label of its own: the drawn words name it, never "Colour"');
    eq(controlName(c, 'red', true, tpl), 'Red');
    eq(controlName(c, 'teal', true, tpl, 'Teal paint'), 'Teal paint', 'its target\'s data-hsvg-label');
  },
  'other controls: the disabledLabel while not enabled, else the label, else the data-hsvg-label'() {
    const b = { kind: 'button', label: 'Go {{ n }}', disabledLabel: 'Wait' };
    eq(controlName(b, undefined, true, tpl), 'Go 3');
    eq(controlName(b, undefined, false, tpl), 'Wait');
    eq(controlName({ kind: 'slider' }, undefined, true, tpl, 'Speed'), 'Speed');
    eq(controlName({ kind: 'button' }, undefined, true, tpl), undefined);
  },
};
