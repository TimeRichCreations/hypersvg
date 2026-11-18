// place(name) on a placed player's host API (added after 2.0.0-next.0): the box of a place the scene on the stage,
// or its shell, lists in its places face (4.3), in page coordinates. A host lays its own things over the drawing with
// it, instead of reading the player's element ids, which are private.
// Returns {x, y, width, height} in CSS pixels from the top left of the document (scrolling included), or null when the
// place is listed but not drawn now (another layout, hidden). A name not listed is E-REF-UNKNOWN; after destroy or a
// stop, E-HOST-CLOSED. mount-web.mjs and asset-lean.mjs add it; a packed page does not carry it.
export function addPlace(state) {
  const host = state.host;
  host.place = (name) => {
    const scene = host.scene(); // refuses E-HOST-CLOSED once the player is destroyed or stopped
    const p = state.player;
    for (const addr of [scene, p.shellId]) {
      if (!addr || !Object.hasOwn(p.def(addr)?.places || {}, name)) continue;
      const frame = state.drawing?.frames[addr];
      let node = frame?.byLocal.get(name) ?? null;
      const walk = (n) => { if (node || !n?.name) return; if (n.attrs['data-hsvg-slot'] === name) node = n; else n.children.forEach(walk); };
      walk(frame?.root);
      const el = node?.dom;
      if (!el?.isConnected) return null;
      const b = el.getBoundingClientRect();
      if (!(b.width || b.height)) return null;
      const w = el.ownerDocument.defaultView;
      return { x: b.left + w.scrollX, y: b.top + w.scrollY, width: b.width, height: b.height };
    }
    const e = new Error(`${name} is not a place the scene ${scene}${p.shellId ? ' or its shell' : ''} lists in its places`); e.code = 'E-REF-UNKNOWN';
    throw e;
  };
  return host;
}
