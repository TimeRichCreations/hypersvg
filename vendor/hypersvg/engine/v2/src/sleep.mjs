// Sleep (experimental): what a page's frame loop needs to stop asking for frames while nothing is scheduled, and to
// catch up afterwards as if it had never stopped. The page (web/player-web.mjs) uses it only when play() is given
// sleep: true; without it, nothing here runs.
import { OFF } from './runtime.mjs';

// nextDue(player): the engine time of the next step the clock must run (a deadline, a capability tick, a changed:now
// second), or Infinity when nothing is scheduled. null when the clock must run every frame: a block has its own clock
// (its speed or pause is a formula, which may read time).
export function nextDue(player) {
  if (player.stopped) return Infinity;
  if (player.clocked) return null;
  const rates = player.clockRates(); // the first call sets player.clocked
  if (player.clocked) return null;
  let due = Infinity;
  for (const t of player.state.timers) {
    if ((rates?.get(t.owner) ?? 1) === 0) continue; // a paused owner's deadline waits for a resume (a host call)
    if (Number.isFinite(t.due) && t.due < OFF && t.due < due) due = t.due;
  }
  const cap = player.caps.clockNext(Infinity, player);
  if (cap && cap.due < due) due = cap.due;
  const sec = player.nowTick(Infinity, player.epochBase());
  if (sec && sec.due < due) due = sec.due;
  return due;
}

// framesSince(last, now, period, cap = 100): the frames a page would have run from the frame at last to now, one every
// period ms, each advancing the engine by min(cap, round(period)) as the frame loop does. Returns {frames, ms, last}:
// how many, the engine ms they add, and the time of the last of them (a frame time, never after now).
export function framesSince(last, now, period, cap = 100) {
  if (!(period > 0) || !(now > last)) return { frames: 0, ms: 0, last };
  const frames = Math.floor((now - last) / period + 1e-9);
  return { frames, ms: frames * Math.min(cap, Math.round(period)), last: last + frames * period };
}
