// Sleep (play option sleep, experimental; src/sleep.mjs): what is scheduled next, and the catch-up after a sleep. Every
// play file of spec/2.0/conformance/plays/ is played twice through a model of the page's frame loop: once awake
// (a frame every 16 ms, as today) and once with sleep (no frame while nothing is due, then the frames it missed in one
// catch-up, as player-web.mjs does). Both must give the file's fingerprint and outputs after every move. No browser;
// the page's wiring is engine/v2/tests/browser/sleep-browser.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { nextDue, framesSince } from '../src/sleep.mjs';
import { logic } from '../src/logic.mjs';
import { loadExperience } from '../src/load.mjs';
import { folder, startPlayer, closeExamples } from '../tools/make-plays.mjs';
import { eq, ok, schemas, mapSource, repo } from './helpers.mjs';

const FRAME = 16;
const files = () => fs.readdirSync(folder).filter(f => f.endsWith('.json')).sort();
const read = (f) => JSON.parse(fs.readFileSync(path.join(folder, f), 'utf8'));

// The page's frame loop, in Node: to(t) brings the engine to engine time t (the wall time of the next move, when no
// frame was ever longer than 100 ms) as frames would. Awake: a frame every FRAME ms. With sleep: after each frame,
// nextDue says whether a step is due within two frames; if not, no frame runs until the step is due or the move
// comes, and the frames missed are run in one advance (framesSince), then the last part frame by frame.
function frameModel(l, sleep) {
  let slept = 0;
  const now = () => l.player.state.now;
  const to = (t) => {
    for (;;) {
      const base = Math.floor(now() / FRAME) * FRAME; // the last frame's time
      if (base + FRAME > t) break;
      if (sleep) {
        const due = nextDue(l.player);
        if (due !== null && due - now() > 2 * FRAME) {
          const f = framesSince(base, Math.min(t, due), FRAME); // woken by a timer set for the due time, or the move
          if (f.frames > 1) { l.advance(f.last - now()); slept += f.frames; continue; }
        }
      }
      l.advance(base + FRAME - now()); // one frame
    }
    if (t > now()) l.advance(t - now()); // the move lands between frames
  };
  return { to, slept: () => slept };
}

async function playThrough(doc, sleep) {
  const wrong = [];
  const l = await startPlayer(doc.package.folder, doc.start);
  const clock = frameModel(l, sleep);
  let seen = 0;
  const heardNow = () => { const h = l.heard.slice(seen); seen = l.heard.length; return JSON.parse(JSON.stringify(h)); };
  doc.steps.forEach((s, i) => {
    clock.to(s.move.t);
    l.feed(structuredClone(s.move));
    if (l.fingerprint() !== s.fingerprint) wrong.push(`step ${i} ${s.move.source}: fingerprint`);
    if (JSON.stringify(heardNow()) !== JSON.stringify(s.heard)) wrong.push(`step ${i}: heard`);
  });
  clock.to(doc.end.t);
  if (l.fingerprint() !== doc.end.fingerprint) wrong.push('end: fingerprint');
  if (JSON.stringify(heardNow()) !== JSON.stringify(doc.end.heard)) wrong.push('end: heard');
  return { wrong, slept: clock.slept() };
}

// A folder as a source: the bell of the sleep browser suite (ring starts a 1500 ms chime that sends rung).
const folderSource = (rel) => {
  const root = path.join(repo, ...rel.split('/'));
  const files = {};
  for (const f of fs.readdirSync(root)) files[f] = fs.readFileSync(path.join(root, f), 'utf8');
  return mapSource(files);
};

export const tests = {
  'framesSince: whole frames only, each min(100, round(period)) ms, never past now'() {
    eq(framesSince(0, 100, 16), { frames: 6, ms: 96, last: 96 });
    eq(framesSince(10, 10, 16), { frames: 0, ms: 0, last: 10 });
    eq(framesSince(0, 15.9, 16), { frames: 0, ms: 0, last: 0 });
    eq(framesSince(0, 50, 1000 / 60), { frames: 3, ms: 51, last: 50 }); // a 60 Hz page advances 17 ms a frame
    eq(framesSince(0, 1000, 250), { frames: 4, ms: 400, last: 1000 }); // a frame is capped at 100 ms
    eq(framesSince(5, 3, 16).frames, 0);
  },
  'nextDue: nothing scheduled is Infinity; a timed step is its due time; a held stage waits'() {
    const loaded = loadExperience(folderSource('engine/v2/tests/browser/sleep-fixture'), schemas());
    ok(loaded.experience, JSON.stringify(loaded.diags));
    const l = logic(loaded.experience, { epochMs: 0 });
    l.start();
    eq(nextDue(l.player), Infinity, 'idle');
    l.advance(400);
    l.host.emit('ring');
    eq(nextDue(l.player), 1900, 'the chime, 1500 ms after the ring');
    eq(nextDue(l.player), Math.min(...l.player.state.timers.map(t => t.due)), 'the earliest deadline');
    l.player.setPause('host', true);
    eq(nextDue(l.player), Infinity, 'a paused stage holds its deadlines');
    l.advance(1000);
    l.player.setPause('host', false);
    eq(nextDue(l.player), 2900, 'the pause moved the deadline on by its length');
    l.advance(5000);
    eq(l.heard.filter(h => h.name === 'rung').map(h => h.t), [2900]);
    eq(nextDue(l.player), Infinity, 'idle again');
  },
  async 'every play file gives the same fingerprints and outputs awake and with sleep, and sleep skips frames'() {
    const wrong = []; let slept = 0; let sleepy = 0;
    try {
      for (const f of files()) {
        const doc = read(f);
        const awake = await playThrough(doc, false);
        const asleep = await playThrough(doc, true);
        for (const w of awake.wrong) wrong.push(`${f} awake ${w}`);
        for (const w of asleep.wrong) wrong.push(`${f} sleep ${w}`);
        slept += asleep.slept; if (asleep.slept) sleepy++;
      }
    } finally { closeExamples(); }
    eq(wrong, []);
    ok(sleepy >= 10 && slept > 1000, `sleep skipped ${slept} frames in ${sleepy} files`);
  },
};
