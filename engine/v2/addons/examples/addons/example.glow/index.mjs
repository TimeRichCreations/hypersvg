// example.glow: a glow around a drawn part, an outside capability add-on (door 1).
// install(door) runs once per page, in the engine. It returns the hooks the engine calls: calls (the manifest's
// calls), and timer (a timer it added is due). The door lets it write only the value its settings' level names, and
// emit only its own events. attach({door}) runs in the browser page and paints the glow.

const PULSE_MS = 400; // one pulse: bright, then dim

export function install(door) {
  return {
    calls: {
      // pulse {times}: the glow goes bright and dim `times` times, then fades.
      pulse(address, { times }) {
        const s = door.settings(address);
        door.write(address, s.level, 1);
        door.timers.drop(t => t.owner === address);
        for (let i = 1; i <= times * 2; i++) door.timers.add(address, door.now() + i * (PULSE_MS / 2), { glow: i === times * 2 ? 0 : (i % 2 ? 0.3 : 1), last: i === times * 2 });
      },
    },
    timer(t) {
      const s = door.settings(t.owner);
      door.write(t.owner, s.level, t.glow);
      if (t.last) door.emit(t.owner, 'faded');
    },
  };
}

// The page part: after each change, each block with settings gets a drop shadow on its part, as bright as its level.
// door.blocks() lists the blocks on the page with settings for this add-on; door.part(address, id) is a handle on a
// drawn part: its style, never the element.
export function attach({ door }) {
  let queued = false;
  const paint = () => {
    queued = false;
    for (const address of door.blocks()) {
      const s = door.settings(address);
      const el = door.part(address, s.part);
      if (!el) continue;
      const level = Number(door.read(address, s.level)) || 0;
      el.style.filter = level > 0 ? `drop-shadow(0 0 ${(level * 12).toFixed(1)}px ${s.color})` : '';
      el.style.transition = 'filter 0.2s ease-out';
    }
  };
  door.onDeliveries(() => { if (!queued) { queued = true; queueMicrotask(paint); } });
  paint();
  return { sync: paint };
}
