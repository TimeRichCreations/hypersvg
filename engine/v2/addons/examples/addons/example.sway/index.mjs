// example.sway: a channel, swing, of an outside capability add-on (door 2).
// install(door) returns paints.swing, the channel's writer. The engine has already checked the value against the
// manifest's range (-1..1). The writer says which part channels to set, only those its manifest's onto lists
// (rotate); the engine keeps each inside the part's drawn motion range and paints it.

export function install() {
  return {
    paints: {
      swing: (value) => ({ rotate: value * 20 }),
    },
  };
}
