// K2f (D45): the HyperSVG. A control and the host share one knob (the latest change wins, and the host hears
// every change as hsvg.changed); pack --asset and unpack (the same bytes again); the player refuses a tampered or
// unpackable asset. The fixture is a small lamp: engine/v2/tests/k2f-fixture.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { folderSource, loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { hostApi } from '../src/host.mjs';
import { checkExperience } from '../check/index.mjs';
import { checkDrawing } from '../schema/drawing-check.mjs';
import { makeAsset, readAsset, assetPackage } from '../src/asset.mjs';
import { packAsset } from '../tools/pack.mjs';
import { unpack } from '../tools/unpack.mjs';
import { repo, schemas, eq, ok, mapSource, throwsCode } from './helpers.mjs';

const fixture = path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture');
async function lamp() {
  const loaded = loadExperience(await folderSource(fixture), schemas());
  ok(loaded.experience, loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
  const p = new Player(loaded.experience, {});
  ok(p.start().ok);
  const host = hostApi(p);
  const heard = [];
  host.on('hsvg.changed', (e) => heard.push(e.detail));
  return { p, host, heard, input: (n) => host.read(n) };
}
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'k2f-'));
const filesOf = (dir) => {
  const out = {};
  const walk = (d, pre) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const rel = pre ? `${pre}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(d, e.name), rel); else out[rel] = fs.readFileSync(path.join(d, e.name), 'utf8'); } };
  walk(dir, '');
  return out;
};
let packed;
async function lampSvg() { packed ??= fs.readFileSync((await packAsset(fixture, temp())).svgPath, 'utf8'); return packed; }
// A packed asset with one member changed and its digest made again: what a careful tamperer would hand in.
function resealed(svg, rel, edit) {
  const a = readAsset(svg);
  const files = { ...a.files, [rel]: edit(a.files[rel]) };
  const drawing = files[a.drawing].replace(/\r?\n<metadata>[^<]*<\/metadata>/, '');
  return makeAsset({ id: a.id, drawing: a.drawing, files: { ...files, [a.drawing]: drawing } });
}
const mountCheck = (svg) => { const a = readAsset(svg); return loadExperience(mapSource(a.files), schemas()).diags.filter(d => d.code.startsWith('E-')); };

export const tests = {
  // ---------- the latest change wins (D45) ----------
  async 'D45: a toggle, a slider and a choice write the knob they name; the host hears each change'() {
    const { p, heard, input } = await lamp();
    ok(p.activate('lamp', 'power', undefined, 'person').ok); eq(input('on'), true);
    ok(p.activate('lamp', 'bright', 1, 'person').ok); eq(input('bright'), 1);
    ok(p.activate('lamp', 'shade', 'sky', 'person').ok); eq(input('shade'), 'sky');
    eq(heard, [{ name: 'on', value: true, by: 'person' }, { name: 'bright', value: 1, by: 'person' }, { name: 'shade', value: 'sky', by: 'person' }]);
    eq(p.read('lamp', 'on'), true, 'the scene reads the knob by its name');
  },
  async 'D45: the host sets a knob again after a person used its control, and it takes effect'() {
    const { p, host, heard, input } = await lamp();
    host.set('shade', 'sky');
    ok(p.activate('lamp', 'shade', 'sun', 'person').ok);
    host.set('shade', 'sky'); // the same value the host gave before: still a change, since the person changed it since
    eq(input('shade'), 'sky');
    ok(p.activate('lamp', 'power', undefined, 'person').ok);
    host.set('on', false);
    eq(input('on'), false);
    eq(heard.map(h => `${h.name}=${h.value}:${h.by}`), ['shade=sky:host', 'shade=sun:person', 'shade=sky:host', 'on=true:person', 'on=false:host']);
  },
  async 'D45: the same value again is no change and is not heard; a refused value changes nothing'() {
    const { host, heard, input } = await lamp();
    host.set('bright', 0.5);
    eq(heard, [], 'the knob already holds 0.5');
    let code = null; try { host.set('bright', 2); } catch (e) { code = e.code; }
    eq(code, 'E-RANGE'); eq(input('bright'), 0.5); eq(heard, []);
  },
  async 'D45: only a person moves a knob through a control; the old prefix-less name is no built-in'() {
    const { p, host, input } = await lamp();
    const r = p.activate('lamp', 'power', undefined, 'host');
    ok(!r.ok && r.fault.code === 'E-HUMAN-ONLY', JSON.stringify(r));
    eq(input('on'), false);
    let code = null; try { host.on('changed', () => {}); } catch (e) { code = e.code; }
    eq(code, 'E-REF-UNKNOWN', 'hsvg.changed is heard only with its prefix (D22)');
  },
  async 'D45: a scene event the experience declares as an output event reaches on(name)'() {
    const { p, host } = await lamp();
    const got = [];
    host.on('clicked', (e) => got.push(e.name));
    ok(p.activate('lamp', 'power', undefined, 'person').ok);
    ok(p.activate('lamp', 'shade', 'sky', 'person').ok);
    eq(got, ['clicked'], 'the toggle\'s event, re-emitted as the experience output, once');
  },
  // ---------- the HyperSVG: pack --asset and unpack ----------
  async 'D45: pack --asset, unpack, pack again: the same bytes, and the folder comes back as it was'() {
    const a = temp(); const b = temp(); const u = path.join(temp(), 'lamp');
    const r1 = await packAsset(fixture, a);
    eq(path.basename(r1.svgPath), 'lamp.svg'); eq(r1.drawing, 'scenes/lamp/lamp.svg'); eq(r1.members, 3);
    const r = unpack(r1.svgPath, u);
    eq(r.written, ['experience.json', 'scenes/lamp/lamp.svg', 'scenes/lamp/scene.json']);
    eq(filesOf(u), filesOf(fixture), 'unpack gives the folder back, byte for byte');
    const r2 = await packAsset(u, b);
    ok(fs.readFileSync(r1.svgPath).equals(fs.readFileSync(r2.svgPath)), 'pack, unpack, pack: the same bytes');
  },
  async 'D45: a HyperSVG is the drawing plus one <metadata> line, and it checks as a drawing'() {
    const svg = await lampSvg();
    const drawing = fs.readFileSync(path.join(fixture, 'scenes', 'lamp', 'lamp.svg'), 'utf8');
    const lines = svg.split('\n');
    ok(/^<metadata>\{"asset":\{"format":"hsvg\/2\.0","id":"lamp","drawing":"scenes\/lamp\/lamp\.svg","members":/.test(lines[1]), lines[1].slice(0, 120));
    eq([lines[0], ...lines.slice(2)].join('\n'), drawing, 'everything but the record is the drawing as drawn');
    ok(!/[<>&]/.test(lines[1].slice('<metadata>'.length, -'</metadata>'.length)), 'the record holds no markup');
    eq(checkDrawing(svg, schemas().drawing).diags.filter(d => d.code.startsWith('E-')).map(d => `${d.code} ${d.message}`), []);
    eq(mountCheck(svg).map(d => d.code), [], 'the shared player\'s check passes too');
  },
  async 'D45: a changed asset is refused: a member edited without its digest, an unknown key, a path out of the folder, too many bytes, no record'() {
    const svg = await lampSvg();
    const plain = fs.readFileSync(path.join(fixture, 'scenes', 'lamp', 'lamp.svg'), 'utf8');
    throwsCode(() => readAsset(plain), 'E-ASSET');
    throwsCode(() => readAsset(svg.replace('Brightness\\"', 'Dimmer\\"')), 'E-PACKAGE-DIGEST');
    throwsCode(() => readAsset(svg.replace('A lamp with a switch', 'A lamp with a switcH')), 'E-PACKAGE-DIGEST'); // the drawing itself
    throwsCode(() => readAsset(svg.replace('{"asset":{"format"', '{"asset":{"script":"x","format"')), 'E-ASSET');
    throwsCode(() => readAsset(svg.replace('"scenes/lamp/scene.json":"{', '"../scene.json":"{')), 'E-ASSET');
    throwsCode(() => readAsset(svg, { maxBytes: 1000 }), 'E-ASSET');
    throwsCode(() => readAsset(svg.replace('<metadata>{"asset":', '<metadata>{"more":1,"asset":')), 'E-ASSET');
    const out = path.join(temp(), 'x');
    const bad = path.join(temp(), 'bad.svg'); fs.writeFileSync(bad, svg.replace('Brightness\\"', 'Dimmer\\"'));
    throwsCode(() => unpack(bad, out), 'E-PACKAGE-DIGEST');
    ok(!fs.existsSync(out), 'a refused unpack writes nothing');
    const full = temp(); fs.writeFileSync(path.join(full, 'keep.txt'), 'x');
    const good = path.join(temp(), 'lamp.svg'); fs.writeFileSync(good, svg);
    throwsCode(() => unpack(good, full), 'E-ASSET');
  },
  async 'D45: a resealed asset with anything an asset cannot hold is refused by the player\'s check'() {
    const svg = await lampSvg();
    const script = resealed(svg, 'scenes/lamp/lamp.svg', (t) => t.replace('</svg>', '<script>alert(1)</script></svg>'));
    ok(mountCheck(script).some(d => /SVG/.test(d.code)), JSON.stringify(mountCheck(script).map(d => d.code)));
    const key = resealed(svg, 'scenes/lamp/scene.json', (t) => t.replace('"kind": "scene",', '"kind": "scene", "script": "x",'));
    eq([...new Set(mountCheck(key).map(d => d.code))], ['E-KEY-UNKNOWN']);
    const pkg = assetPackage(readAsset(svg));
    eq(Object.keys(pkg).sort(), ['experience.json', 'package.json', 'scenes/lamp/lamp.svg', 'scenes/lamp/scene.json']);
  },
  async 'D45: pack --asset refuses what an asset cannot hold: a checker error, a need, a drawing with its own tool record'() {
    const copy = () => { const d = temp(); fs.cpSync(fixture, d, { recursive: true }); return d; };
    const edit = (d, rel, fn) => { const f = path.join(d, ...rel.split('/')); fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8'))); };
    const refusal = async (d) => { try { await packAsset(d, temp()); return null; } catch (e) { return e; } };
    const broken = copy(); edit(broken, 'scenes/lamp/scene.json', (t) => t.replace('"target": "glow"', '"target": "glo"'));
    ok(/errors/.test((await refusal(broken))?.message), 'a checker error refuses');
    const needs = copy(); edit(needs, 'experience.json', (t) => t.replace('"language": "en",', '"language": "en", "needs": ["seats"],'));
    const r = await refusal(needs);
    ok(r && (/E-ASSET/.test(r.message) || /errors/.test(r.message)), r?.message);
    const meta = copy(); edit(meta, 'scenes/lamp/lamp.svg', (t) => t.replace('<title>', '<metadata>{"derived": "edited"}</metadata>\n<title>'));
    ok(/tool record/.test((await refusal(meta))?.message), 'a drawing with its own tool record');
  },
  'D45: a scene\'s declared outcome that the experience also declares reaches on(name) once, and its link still fires'() {
    const svg = (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>${id}</title><g id="go" data-hsvg-kind="part" data-hsvg-label="Go"><rect width="60" height="60" fill="#ccc"/></g></svg>`;
    const files = {
      'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 't', outputs: { done: { kind: 'event' } }, story: { start: 'a', scenes: { a: 'scenes/a/scene.json', b: 'scenes/b/scene.json' }, ends: ['b'], links: [{ id: 'a-b', from: 'a', on: 'done', to: 'b' }] } },
      'scenes/a/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', outputs: { done: { kind: 'event' } }, controls: { go: { kind: 'button', target: 'go', event: 'pressed', label: 'Go' } }, on: { pressed: [{ actions: [{ emit: 'done' }] }] } },
      'scenes/a/a.svg': svg('a'),
      'scenes/b/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'b', drawing: 'b.svg' },
      'scenes/b/b.svg': svg('b'),
    };
    const loaded = loadExperience(mapSource(files), schemas());
    ok(loaded.experience, loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
    const p = new Player(loaded.experience, {});
    ok(p.start().ok);
    const host = hostApi(p);
    const got = [];
    host.on('done', (e) => got.push(e.name));
    ok(p.activate('a', 'go', undefined, 'person').ok);
    eq(got, ['done']); eq(p.state.story.current, 'b', 'the link heard the outcome too');
  },
  'D45: a toggle on a knob that is not boolean is E-TYPE, with the fix'() {
    const files = {
      'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 't', inputs: { size: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, initial: 0 } }, story: { start: 's', scenes: { s: 'scenes/s/scene.json' }, endless: true } },
      'scenes/s/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 's', drawing: 's.svg', controls: { t: { kind: 'toggle', target: 'b', value: 'size', label: 'Size' } } },
      'scenes/s/s.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>T</title><g id="b" data-hsvg-kind="part" data-hsvg-label="Size"><rect width="60" height="60" fill="#ccc"/></g></svg>',
    };
    const r = checkExperience(mapSource(files), schemas());
    const f = r.diags.find(d => d.code === 'E-TYPE' && d.path === '/controls/t/value');
    ok(f && /boolean/.test(f.message), JSON.stringify(r.diags.map(d => `${d.code} ${d.path} ${d.message}`)));
  },
};
