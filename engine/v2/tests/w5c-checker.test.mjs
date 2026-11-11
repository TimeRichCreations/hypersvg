// Checker follow-ups. One failing and one passing fixture per item.
import fs from 'node:fs';
import path from 'node:path';
import { checkExperience } from '../check/index.mjs';
import { base } from './check-refs.test.mjs';
import { repo, schemas, mapSource, eq, ok } from './helpers.mjs';

const dir = path.join(repo, 'engine', 'v2', 'tests', 'ai-fixture');
const aiBase = {};
for (const rel of ['experience.json', 'shell/frame.json', 'shell/frame.svg', 'scenes/desk/scene.json', 'scenes/desk/desk.svg']) {
  const text = fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
  aiBase[rel] = rel.endsWith('.json') ? JSON.parse(text) : text;
}
export const run = (files, opts = {}) => checkExperience(mapSource(files), schemas(), opts).diags;
const ai = (edit) => { const f = structuredClone(aiBase); edit?.(f); return run(f); };
const line = (d) => `${d.code} ${d.file} ${d.path}`;

export const tests = {
  // ----- item 1: character seats and ask -----
  'a character seat and an ask check clean (the AI fixture)'() { eq(ai().map(line), []); },
  'an ask with inputs missing names the inputs, not the page capability'() {
    const d = ai(f => { const a = f['scenes/desk/scene.json'].on.askGuide[0].actions[0]; delete a.with.timeoutMs; delete a.with.fallback; });
    eq(d.map(x => x.code), ['E-ADDON', 'E-ADDON']);
    ok(d.every(x => !/capability page/.test(x.message)), 'no blame on page');
    ok(d[0].message.includes('timeoutMs') && d[1].message.includes('fallback'));
  },
  'an ask with the ai need missing is blamed on ai'() {
    const d = ai(f => { f['experience.json'].needs = ['shell']; });
    ok(d.some(x => x.code === 'E-NEEDS-MISSING' && /capability ai\b/.test(x.message)), d.map(x => x.message).join('; '));
  },
  'a character seat with keys missing is checked as a character, not refused for its kind'() {
    const d = ai(f => { f['experience.json'].addons.ai.seats.guide = {}; });
    eq(d.map(x => x.code), ['E-KEY-REQUIRED', 'E-KEY-REQUIRED', 'E-KEY-REQUIRED']);
    ok(d.every(x => !/fillers|inputs|player/.test(x.message)), d.map(x => x.message).join('; '));
  },
  // ----- item 2: an unknown action -----
  'an unknown action is named as unknown, not blamed on a capability'() {
    const d = ai(f => { f['scenes/desk/scene.json'].on.askGuide[0].actions[0] = { id: 'x', askk: 'guide', to: 'answer' }; });
    const u = d.filter(x => x.path.includes('askGuide'));
    // Since the media, page and lines actions left the core (D31), the closest core form (set) is named; no finding
    // blames a capability, and the unknown key is named.
    ok(u.some(x => x.code === 'E-KEY-UNKNOWN' && /askk/.test(x.path + x.message)), JSON.stringify(u));
    ok(u.every(x => !/capability/.test(x.message)), JSON.stringify(u));
  },
  // ----- item 3: words rows -----
  'a words row with more cells than the header is E-WORDS'() {
    const f = base(); f['words/en.csv'] = 'id,text\ngo,Go\nbye,Thank you, goodbye!\n';
    const d = run(f).filter(x => x.code === 'E-WORDS');
    eq(d.length, 1); eq(d[0].file, 'words/en.csv'); ok(/3 cells/.test(d[0].message) && /"bye"/.test(d[0].message));
  },
  'a quoted comma in a words row passes'() {
    const f = base(); f['words/en.csv'] = 'id,text\ngo,Go\nbye,"Thank you, goodbye!"\n';
    eq(run(f).filter(x => x.code === 'E-WORDS'), []);
  },
  "a word's template is parsed at check time"() {
    const f = base(); f['words/en.csv'] = "id,text\ngo,Go\nturns,\"You made {{ turns {{ plural(turns, 'choice') }}\"\n";
    const d = run(f).filter(x => x.file === 'words/en.csv');
    eq(d.map(x => x.code), ['E-FORMULA']); ok(/"turns"/.test(d[0].message));
    const g = base(); g['words/en.csv'] = "id,text\ngo,Go\nturns,\"You made {{ 1 + 1 }} choices\"\n";
    eq(run(g).filter(x => x.file === 'words/en.csv'), []);
  },
  // ----- item 4: a role on the wrong kind -----
  'a role word on an element of a kind its entry does not list warns'() {
    const svg = (kind, role) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>t</title><rect id="go" data-hsvg-kind="${kind}" data-hsvg-role="${role}" width="9" height="9"/></svg>`;
    const withRole = (kind, role) => { const f = base(); f['scenes/one/one.svg'] = svg(kind, role); return run(f, { only: ['drawingRules'] }).filter(x => x.code === 'W-ROLE-UNKNOWN'); };
    const bad = withRole('part', 'restart');
    eq(bad.length, 1); ok(/applies to component, slot, not to a part/.test(bad[0].message));
    eq(withRole('component', 'restart'), [], 'a component is a kind restart applies to');
    eq(withRole('part', 'label'), [], 'label is a part role');
    eq(withRole('part', 'cta'), [], 'cta is an alias of action, which applies to a part');
  },
  // ----- item 5: a clip track on a <rect> slot -----
  'a clip track on a <rect> slot is E-PLACE; on a <g> slot it passes'() {
    const slotSvg = (el) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>t</title><rect id="go" data-hsvg-kind="part" width="9" height="9"/>${el}</svg>`;
    const withSlot = (el) => {
      const f = base(); f['scenes/one/one.svg'] = slotSvg(el);
      f['scenes/one/scene.json'].clips.wave.tracks.push({ id: 'slide', target: 'badge-spot', channel: 'translateX', keys: [[0, 0], [500, 10]] });
      return run(f, { only: ['drawingRules'] }).filter(x => x.code === 'E-PLACE');
    };
    const bad = withSlot('<rect id="badge-spot" data-hsvg-kind="part" data-hsvg-slot="badge-spot" fill="none" width="20" height="20"/>');
    eq(bad.map(x => x.path), ['/clips/wave/tracks/1/target']);
    eq(withSlot('<g id="badge-spot" data-hsvg-kind="part" data-hsvg-slot="badge-spot"/>'), []);
  },
  // ----- item 6: painted extent -----
  'E-PAINT: content past the viewBox is refused in a screen drawing; backdrop, clip, outline and text rules'() {
    const draw = (inner, kind = 'screen') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="${kind}"><title>t</title>${inner}</svg>`;
    const paint = (inner, opts = { paint: true }, kind) => { const f = base(); f['scenes/one/one.svg'] = draw(inner, kind); return run(f, opts).filter(x => x.code === 'E-PAINT'); };
    const bad = paint('<rect id="sky" width="120" height="100" fill="#fff"/>');
    eq(bad.length, 1); ok(/20\.0 right/.test(bad[0].message), bad[0].message);
    eq(paint('<rect id="sky" width="120" height="100" fill="#fff" data-hsvg-layer="backdrop"/>'), [], 'backdrop may bleed');
    eq(paint('<g data-hsvg-layer="backdrop"><rect width="120" height="100" fill="#fff"/></g>'), [], 'a layer is inherited');
    eq(paint('<rect id="sky" width="120" height="100" fill="#fff"/>', {}), [], 'off unless asked');
    eq(paint('<rect width="120" height="100" fill="#fff"/>', { paint: true }, 'component'), [], 'a component viewBox is not a paint limit');
    eq(paint('<rect x="0" y="0" width="100" height="100" fill="none" stroke="#000" stroke-width="10"/>').length, 1, 'half the stroke width counts');
    eq(paint('<defs><clipPath id="c"><rect width="100" height="100"/></clipPath></defs><g clip-path="url(#c)"><rect width="150" height="100" fill="#fff"/></g>'), [], 'a clip cuts the extent');
    eq(paint('<path id="route" d="M-50 50L150 50" fill="none" data-hsvg-route="track"/>'), [], 'a route paints nothing');
    eq(paint('<rect width="50" height="50" fill="#fff"/><circle cx="50" cy="50" r="10" fill="none"/>'), [], 'fill none paints nothing');
    eq(paint('<defs><filter id="b"><feGaussianBlur stdDeviation="3"/></filter></defs><rect x="0" y="0" width="100" height="40" fill="#000" filter="url(#b)"/>').length, 1, 'the filter region grows the box');
    eq(paint('<g transform="translate(60 0)"><rect width="50" height="50" fill="#000"/></g>').length, 1, 'transforms apply');
    eq(paint('<path d="M0 0 C 0 200 100 200 100 0" fill="#000"/>').length, 1, 'curves are measured');
  },
  'W-PAINT-OVER: content in front of an overlay, an overlay over a control or a keep-clear area'() {
    const draw = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>t</title>${inner}</svg>`;
    const over = (inner, ctl = true) => {
      const f = base(); f['scenes/one/one.svg'] = draw(inner);
      if (!ctl) delete f['scenes/one/scene.json'].controls;
      return run(f).filter(x => x.code === 'W-PAINT-OVER').map(x => x.message);
    };
    const frame = '<g data-hsvg-layer="overlay"><rect id="border" x="1" y="1" width="98" height="98" fill="none" stroke="#000" stroke-width="2"/></g>';
    const strip = '<g data-hsvg-layer="overlay"><rect id="strip" x="0" y="80" width="100" height="20" fill="#000"/></g>';
    eq(over(`${strip}<text id="go" x="10" y="90">GO</text><rect id="mid" x="10" y="85" width="20" height="10" fill="#fff"/>`, false).length, 1, 'content after a strip that it crosses');
    eq(over(`<rect id="mid" x="10" y="85" width="20" height="10" fill="#fff"/>${strip}`, false), [], 'content under the overlay is fine');
    eq(over(`${frame}<rect id="mid" x="30" y="30" width="40" height="40" fill="#fff"/>`, false), [], 'an outline overlay does not cover the inside');
    eq(over(`<rect id="go" x="10" y="85" width="20" height="10" fill="#fff"/>${strip}`).length, 1, 'an overlay over a control target');
    eq(over(`<rect id="keep" x="0" y="80" width="30" height="20" fill="none" data-hsvg-role="keep-clear"/>${strip}`, false).length, 1, 'an overlay over a keep-clear area');
    eq(over(`<rect id="keep" x="0" y="0" width="30" height="20" fill="none" data-hsvg-role="keep-clear"/>${strip}`, false), [], 'a clear area elsewhere');
  },
  'E-WIDGET-PAINT: an overlay slot after a declared widget slot that it crosses'() {
    const shellFiles = (overlayAt) => {
      const f = structuredClone(aiBase);
      const sh = f['shell/frame.json'];
      sh.slots.hint = { kind: 'overlay', passThrough: true };
      f['shell/frame.svg'] = f['shell/frame.svg'].replace('</svg>', `<rect id="hint-box" x="${overlayAt}" y="40" width="80" height="40" fill="none" data-hsvg-slot="hint" data-hsvg-kind="part"/></svg>`);
      return f;
    };
    const codes = (f) => run(f).filter(x => x.code === 'E-WIDGET-PAINT');
    const bad = codes(shellFiles(100));
    eq(bad.length, 1); eq(bad[0].file, 'shell/frame.svg');
    eq(codes(shellFiles(500)), [], 'an overlay slot that does not cross');
    const f = shellFiles(100);
    f['shell/frame.svg'] = f['shell/frame.svg'].replace(/(<rect id="hint-box"[^>]*>)(<\/svg>)/, '$1$2');
    const before = structuredClone(f); // overlay before the widget slot: the widget is later, so the overlay is not over it
    const svg = before['shell/frame.svg'];
    const hint = /<rect id="hint-box"[^>]*\/>/.exec(svg)[0];
    before['shell/frame.svg'] = svg.replace(hint, '').replace('<rect id="ask-box"', `${hint}<rect id="ask-box"`);
    eq(codes(before), [], 'an overlay slot earlier in document order');
  },
  // ----- item 7: needs and the union (10.11) -----
  'W-NEEDS-UNUSED: a need named by a scene and used by no document is judged at the scene; the message says union'() {
    const f = base(); f['scenes/one/scene.json'].needs = ['physics'];
    const d = run(f).filter(x => x.code === 'W-NEEDS-UNUSED');
    eq(d.map(x => `${x.file} ${x.path}`), ['scenes/one/scene.json needs[0]']);
    ok(/union of every document's needs/.test(d[0].message), d[0].message);
  },
  'W-NEEDS-UNUSED: a need that any document uses is not unused, whichever document names it'() {
    // The experience names physics; only the scene uses it. The union holds it, so there is no warning.
    const g = structuredClone(aiBase); g['experience.json'].needs = ['shell', 'ai']; // the ai fixture uses ai in a scene
    eq(run(g).filter(x => x.code === 'W-NEEDS-UNUSED'), []);
    // A scene names ai and uses it, the experience does not name it: no E-NEEDS-MISSING for the union, no warning.
    const h = structuredClone(aiBase);
    h['experience.json'].needs = ['shell'];
    h['scenes/desk/scene.json'].needs = ['ai'];
    eq(run(h).filter(x => x.code === 'W-NEEDS-UNUSED' || (x.code === 'E-NEEDS-MISSING' && x.file === 'scenes/desk/scene.json')), []);
  },
};
