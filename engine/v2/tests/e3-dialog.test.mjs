// A shell dialog is a real dialog (10.3). The input layer writes the
// dialog's role, aria-modal and name, and inert on the rest (tests/browser/e3-dialog-browser.mjs). Here: the drawing's
// names() leaves an open dialog's role alone, and gives it back when the dialog closes.
import path from 'node:path';
import { loadExperience, folderSource } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const FIXTURE = path.join(repo, 'engine', 'v2', 'tests', 'e1-fixture');
function fakeDom(d, addr) {
  const f = d.frames[addr];
  const make = (n, up) => {
    if (!n.name) return;
    const a = {};
    n.dom = { a, up, setAttribute: (k, v) => { a[k] = String(v); }, removeAttribute: (k) => { delete a[k]; }, getAttribute: (k) => a[k] ?? null, set textContent(t) {} };
    n.dom.contains = (t) => { for (let x = t; x; x = x.up) if (x === n.dom) return true; return false; };
    for (const k of n.children) make(k, n.dom);
  };
  make(f.root, null);
  return (id) => f.byLocal.get(id).dom.a;
}

export const tests = {
  async 'names(): a named part that is an open dialog (aria-modal) keeps role dialog; closed, it is a group again'() {
    const src = await folderSource(FIXTURE);
    const l = loadExperience(src, schemas());
    ok(l.experience, l.diags?.map(x => x.message).join('; '));
    const p = new Player(l.experience, {});
    ok(p.start().ok, 'starts');
    const d = new Drawing(p); d.mountScene('s');
    const at = fakeDom(d, 's');
    d.paint();
    eq(at('panel').role, 'group', 'a named part holding controls is a group');
    Object.assign(at('panel'), { role: 'dialog', 'aria-modal': 'true' });
    d.paint();
    eq(at('panel').role, 'dialog', 'an open dialog keeps its role');
    delete at('panel')['aria-modal']; delete at('panel').role;
    d.paint();
    eq(at('panel').role, 'group', 'closed, the drawing names it again');
  },
};
