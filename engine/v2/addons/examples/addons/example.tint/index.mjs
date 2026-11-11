// example.tint: paints a drawn part with a colour, an outside capability add-on (door 2).
// It adds no calls. Its manifest declares keys (the fade time), draws (the binding it paints) and contentTypes (the
// colour an input may hold). install(door) runs in the engine and has nothing to do: it returns no hooks.
// attach({door}) runs in the browser page. door.draws(address) lists the block's bindings that name this add-on; the
// add-on is the only writer of each target part, and paints its fill with the colour the binding's value holds.

export function install() {
  return {};
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function attach({ door }) {
  let queued = false;
  const paint = () => {
    queued = false;
    for (const address of door.blocks()) {
      const fadeMs = door.settings(address)?.fadeMs ?? 0;
      for (const d of door.draws(address)) {
        const el = door.part(address, d.target);
        if (!el) continue;
        const color = door.read(address, d.binding.color);
        if (typeof color !== 'string' || !HEX.test(color)) continue;
        el.style.fill = color;
        el.style.transition = `fill ${fadeMs}ms ease-out`;
      }
    }
  };
  door.onDeliveries(() => { if (!queued) { queued = true; queueMicrotask(paint); } });
  paint();
  return { sync: paint };
}
