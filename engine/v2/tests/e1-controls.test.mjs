// How controls reach people. e1-fixture: a named part holding an
// option group in a clipped pill, a named part with no control, an option group that shares its parent with a press,
// three sliders (no positions, 4 and 21 positions), a pill press and a drag with a hidden drop. The browser half is
// tests/browser/e1-controls-browser.mjs.
import path from 'node:path';
import { loadExperience, folderSource } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { checkExperience } from '../check/index.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const FIXTURE = path.join(repo, 'engine', 'v2', 'tests', 'e1-fixture');
async function play() {
  const src = await folderSource(FIXTURE);
  const l = loadExperience(src, schemas());
  ok(l.experience, l.diags?.map(d => d.message).join('; '));
  const p = new Player(l.experience, {});
  ok(p.start().ok, 'starts');
  return p;
}
// A small stand-in for the page's elements: attributes, a parent, and contains() along the node tree.
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
  'the fixture checks with no findings'() {
    return folderSource(FIXTURE).then(src => eq(checkExperience(src, schemas()).diags.map(x => `${x.code} ${x.path}`), []));
  },
  // ---------- item 1 ----------
  async 'names(): a named part that holds a control target is a group; one that holds none stays an image; so does the root'() {
    const p = await play();
    const d = new Drawing(p); d.mountScene('s');
    const at = fakeDom(d, 's');
    d.paint();
    eq([at('sun').role, at('sun')['aria-label']], ['img', 'A sun'], 'no control inside: a named image');
    eq([at('panel').role, at('panel')['aria-label']], ['group', 'Size panel'], 'options inside: a named group');
    eq(d.frames.s.root.dom.a.role, 'group', 'the drawing root holds controls: a group, never an image');
    eq(at('size-s').role, undefined, 'a control target is named by the input layer');
    // A part the input layer made an option group keeps what it was given.
    at('panel')['data-hsvg-group'] = ''; at('panel').role = 'radiogroup';
    d.paint();
    eq(at('panel').role, 'radiogroup', 'an option group the input layer made is left alone');
  },
  async 'names(): a root that holds no control has no role of its own'() {
    const p = await play();
    p.def('s').controls = {};
    const d = new Drawing(p); d.mountScene('s');
    const at = fakeDom(d, 's');
    d.frames.s.root.dom.a.role = 'group';
    d.paint();
    eq(d.frames.s.root.dom.a.role, undefined);
    eq(at('panel').role, 'img', 'with no control inside, the panel is an image again');
  },
  // ---------- item 4 ----------
  async 'sliderPage: a tenth of the travel, rounded to whole positions, at least one'() {
    const p = await play();
    eq(p.sliderPage('s', 'volume'), 10, 'no positions: a tenth of 0..100');
    eq([p.sliderStep('s', 'spice'), p.sliderPage('s', 'spice')], [1, 1], '4 positions: a tenth is 0.3 of a stop, so one stop');
    eq([p.sliderStep('s', 'temp'), p.sliderPage('s', 'temp')], [1, 2], '21 positions: two stops');
    p.def('s').controls.temp.positions = 101;
    eq(p.sliderPage('s', 'temp'), 2, '101 positions over 0..20: ten stops of 0.2');
  },
};
