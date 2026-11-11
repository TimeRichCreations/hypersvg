// The media capability (A2.1), engine half, with no browser. The page half is checked by
// tests/browser/media-browser.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Player } from '../src/story.mjs';
import { pack, contentSecurityPolicy, capabilityModules } from '../tools/pack.mjs';
import { eq, ok, repo } from './helpers.mjs';

const RES = {
  clip: { kind: 'video', file: 'media/clip.webm', durationMs: 4000, width: 320, height: 180, digest: 'sha256:' + '0'.repeat(64), poster: 'still', captions: { en: 'clip-en' } },
  other: { kind: 'video', file: 'media/other.webm', durationMs: 2000, width: 320, height: 180, digest: 'sha256:' + '1'.repeat(64) },
  still: { kind: 'image', file: 'media/still.png', width: 320, height: 180, digest: 'sha256:' + '2'.repeat(64) },
  'clip-en': { kind: 'captions', file: 'media/clip.en.vtt', language: 'en', digest: 'sha256:' + '3'.repeat(64) },
};
const press = (id) => ({ kind: 'button', target: `${id}-btn`, event: id });
const sceneDoc = ({ binding = {}, entry = [], extra = {} } = {}) => ({
  format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
  values: { log: { type: 'string', initial: '', maxLength: 400 }, which: { type: 'string', initial: 'clip', maxLength: 20 } },
  controls: { play: press('play'), pause: press('pause'), seek: press('seek'), swap: press('swap') },
  bindings: [{ id: 'show', target: 'screen', label: 'A film', media: { video: 'which', markers: [{ id: 'm0', atMs: 0, event: 'atStart' }, { id: 'm1', atMs: 1000, event: 'cue' }, { id: 'm3', atMs: 3000, event: 'late' }], ...binding } }],
  entry,
  on: {
    play: [{ id: 'p', actions: [{ id: 'go', call: 'media.play', with: { place: "'screen'" } }] }],
    pause: [{ id: 'q', actions: [{ id: 'stop-it', call: 'media.pause', with: { place: "'screen'" } }] }],
    seek: [{ id: 's', actions: [{ id: 'jump', call: 'media.seek', with: { place: "'screen'", atMs: 'seekTo' } }] }],
    swap: [{ id: 'w', actions: [{ id: 'sw', set: 'which', to: "'other'" }] }],
    hostPlay: [{ id: 'hp', actions: [{ id: 'host-go', call: 'media.play', with: { place: "'screen'" } }] }],
    atStart: [{ id: 'l0', actions: [{ id: 'w0', set: 'log', to: "log + 'start '" }] }],
    cue: [{ id: 'l1', actions: [{ id: 'w1', set: 'log', to: "log + 'cue '" }] }],
    late: [{ id: 'l3', actions: [{ id: 'w3', set: 'log', to: "log + 'late '" }] }],
    'media:ended:screen': [{ id: 'le', actions: [{ id: 'we', set: 'log', to: "log + 'ended@' + formatNumber(event.atMs, 0, false) + ' '" }] }],
    'media:stalled:screen': [{ id: 'ls', actions: [{ id: 'ws', set: 'log', to: "log + 'stalled '" }] }],
    'media:failed:screen': [{ id: 'lf', actions: [{ id: 'wf', set: 'log', to: "log + 'failed@' + formatNumber(event.atMs, 0, false) + ' '" }] }],
    'ended:go': [{ id: 'lg', actions: [{ id: 'wg', set: 'log', to: "log + 'go-failed '" }] }],
    'ended:host-go': [{ id: 'lh', actions: [{ id: 'wh', set: 'log', to: "log + (event.failed ? 'refused ' : 'host-ended ')" }] }],
    ...extra,
  },
  computed: { seekTo: 2500 },
});
const make = ({ scene = sceneDoc(), needs = ['media'], ambient = {} } = {}) => {
  const p = new Player({
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs, resources: RES, story: { start: 'a', scenes: { a: 'scenes/a/scene.json' } } },
    words: { en: {} }, data: {}, blocks: {},
    scenes: { a: { file: 'scenes/a/scene.json', doc: scene, drawings: {}, words: {} } },
  }, {});
  Object.assign(p.state.ambient, ambient);
  return p;
};
const started = (opts) => { const p = make(opts); const r = p.start(); ok(r.ok, r.fault?.message); return p; };
const placeOf = (p) => p.media.places().find(x => x.place === 'screen');
const log = (p) => p.read('a', 'log');

export const tests = {
  'a video place starts paused at 0, with its file, poster, captions and binding keys'() {
    const p = started();
    const pl = placeOf(p);
    eq([pl.address, pl.video, pl.file, pl.poster, pl.captions, pl.durationMs, pl.timeMs, pl.playing, pl.fit, pl.focal, pl.label, pl.stallMs],
      ['a', 'clip', 'media/clip.webm', 'media/still.png', { en: 'media/clip.en.vtt' }, 4000, 0, false, 'contain', [0.5, 0.5], 'A film', 10000]);
    p.advance(2000);
    eq(placeOf(p).timeMs, 0, 'a paused video does not move');
  },
  'mediaPlay by a person plays on the engine clock; markers fire crossing forward; the end fires media:ended {atMs}'() {
    const p = started();
    ok(p.activate('a', 'play').ok);
    eq(placeOf(p).playing, true);
    p.advance(500);
    eq(placeOf(p).timeMs, 500);
    eq(log(p), 'start ');
    p.advance(600);
    eq(log(p), 'start cue ');
    p.advance(3000);
    eq(log(p), 'start cue late ended@4000 ');
    const pl = placeOf(p);
    eq([pl.playing, pl.ended, pl.timeMs], [false, true, 4000]);
  },
  'mediaPause keeps the time; a seek moves it and fires no marker it jumps over; play goes on from there'() {
    const p = started();
    p.activate('a', 'play');
    p.advance(700);
    p.activate('a', 'pause');
    p.advance(5000);
    eq([placeOf(p).timeMs, placeOf(p).playing, log(p)], [700, false, 'start ']);
    p.activate('a', 'seek'); // to 2500: the marker at 1000 is jumped over
    eq(placeOf(p).timeMs, 2500);
    p.activate('a', 'play');
    p.advance(600);
    eq(log(p), 'start late ');
  },
  'a seek back while playing fires a marker again when time crosses it forward'() {
    const p = started({ scene: sceneDoc({ extra: {}, binding: {} }) });
    p.activate('a', 'play');
    p.advance(1200);
    eq(log(p), 'start cue ');
    const r = p.transaction('person', () => p.runActions('a', [{ id: 'back', call: 'media.seek', with: { place: "'screen'", atMs: 500 } }], 'test'));
    ok(r.ok, r.fault?.message);
    p.advance(400);
    eq(log(p), 'start cue ', 'no marker on the seek itself');
    p.advance(200);
    eq(log(p), 'start cue cue ');
  },
  'the owner\'s pause holds video time and its markers; resume goes on in place'() {
    const p = started();
    p.activate('a', 'play');
    p.advance(800);
    p.setPause('host', true);
    p.advance(3000);
    eq([placeOf(p).timeMs, log(p)], [800, 'start ']);
    p.setPause('host', false);
    p.advance(300);
    eq([placeOf(p).timeMs, log(p)], [1100, 'start cue ']);
  },
  'an unmuted mediaPlay from a host or timer is refused: paused, ended:<id> {failed: true}; muted it plays'() {
    const p = started();
    ok(p.send('a', 'hostPlay', {}, 'host').ok);
    eq([placeOf(p).playing, log(p)], [false, 'refused ']);
    const q = started({ ambient: { muted: true } });
    q.send('a', 'hostPlay', {}, 'host');
    q.advance(1);
    eq([placeOf(q).playing, placeOf(q).muted, log(q)], [true, true, 'start ']);
  },
  'autoplay starts at mount with sound forced off; a person\'s mediaPlay then turns the sound on'() {
    const p = started({ scene: sceneDoc({ binding: { autoplay: true } }) });
    eq([placeOf(p).playing, placeOf(p).muted], [true, true]);
    p.advance(1100);
    eq(log(p), 'start cue ');
    p.activate('a', 'play');
    eq([placeOf(p).playing, placeOf(p).muted, placeOf(p).timeMs], [true, false, 1100]);
  },
  'under reduced motion an autoplay video stays paused on its poster'() {
    const p = started({ scene: sceneDoc({ binding: { autoplay: true } }), ambient: { reducedMotion: true } });
    eq(placeOf(p).playing, false);
  },
  'a changed video formula is read at the next action: the new video starts at 0, paused; no video does nothing'() {
    const p = started();
    p.activate('a', 'play');
    p.advance(500);
    p.activate('a', 'swap');
    p.activate('a', 'play');
    const pl = placeOf(p);
    eq([pl.video, pl.durationMs, pl.timeMs, pl.playing], ['other', 2000, 0, true]);
    const q = started({ scene: sceneDoc({ binding: { video: "''" } }) });
    ok(q.activate('a', 'play').ok);
    ok(q.activate('a', 'seek').ok);
    eq([placeOf(q).video, placeOf(q).playing], [null, false]);
  },
  'the page reports a stall, a failure and a browser refusal as media events'() {
    const p = started();
    p.activate('a', 'play');
    p.advance(400);
    ok(p.media.report('a', 'screen', 'stalled').ok);
    ok(p.media.report('a', 'screen', 'failed').ok);
    eq([log(p), placeOf(p).playing], ['start stalled failed@400 ', false]);
    p.activate('a', 'play');
    ok(p.media.report('a', 'screen', 'refused').ok);
    eq([log(p), placeOf(p).playing], ['start stalled failed@400 go-failed ', false]);
  },
  'faults: an unknown place, a seek outside the video, a video id that is no video resource'() {
    const p = started();
    const r1 = p.transaction('person', () => p.runActions('a', [{ id: 'x', call: 'media.play', with: { place: "'nowhere'" } }], 'test'));
    eq(r1.fault.code, 'E-REF-UNKNOWN');
    p.stopped = null; // a control fault stops play (X3): the next case on the same engine
    const r2 = p.transaction('person', () => p.runActions('a', [{ id: 'x', call: 'media.seek', with: { place: "'screen'", atMs: 4001 } }], 'test'));
    eq(r2.fault.code, 'E-RANGE');
    const q = make({ scene: sceneDoc({ binding: { video: "'still'" } }) });
    eq(q.start().fault?.code, 'E-REF-UNKNOWN');
  },
  'without media in needs nothing installs: a media binding is refused at mount (door 2 draws), and so are its calls'() {
    const p = make({ needs: [] });
    eq(p.start().fault?.code, 'E-NEEDS-MISSING');
    ok(p.media === undefined);
    const q = make({ needs: [], scene: { ...sceneDoc(), bindings: [] } });
    ok(q.start().ok);
    eq(q.activate('a', 'play').fault?.code, 'E-NEEDS-MISSING');
  },
  async 'the packer: the video and its captions are members with their digests, embedded; media-src blob: data: only with media'() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'w6v-pack-'));
    try {
      const dir = path.join(repo, 'examples', '2.0-video-explainer');
      const r = await pack(dir, out); // clean since the video binding's schema was fixed (W6-V Request 1)
      eq(r.capabilities, ['media']);
      ok(r.csp.includes('media-src blob: data:'), r.csp);
      ok(r.csp.includes("connect-src 'none'") && r.csp.includes("default-src 'none'"), 'no network');
      const desc = JSON.parse(fs.readFileSync(r.packagePath, 'utf8'));
      const exp = JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8'));
      eq(desc.members['media/sprout.webm'], exp.resources['sprout-film'].digest);
      eq(desc.members['media/sprout.en.vtt'], exp.resources['sprout-captions-en'].digest);
      const html = fs.readFileSync(r.htmlPath, 'utf8');
      ok(html.includes(fs.readFileSync(path.join(dir, 'media', 'sprout.webm')).toString('base64').slice(0, 200)), 'the video bytes are embedded');
      ok(r.files.includes('engine/v2/web/media-web.mjs'), 'the page half ships with media');
      ok(/media-src 'none'/.test(contentSecurityPolicy('x', { needs: [] })));
      eq(capabilityModules(['synth']).map(m => m.id), ['synth'], 'the media module is not bundled without media');
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  },
};
