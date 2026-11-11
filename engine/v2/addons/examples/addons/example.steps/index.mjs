// example.steps: a stepper, a control kind of an outside capability add-on (door 2).
// install(door) returns controls.stepper with two hooks. The engine calls them; the add-on never touches the page.
// - input(address, control, gesture): a person's gesture on the control (one its manifest lists: press, up or down).
//   It returns the new value; the engine checks it and writes it into the control's value, then sends its event.
// - access(address, control): what a screen reader hears beside the label: {valueText}. The role (spinbutton) and
//   the label come from the manifest and the control.

export function install(door) {
  // The control's value and its declaration (a whole number with a minimum and a maximum).
  const range = (address, control) => door.def(address).values?.[control.value] ?? {};
  return {
    controls: {
      stepper: {
        input(address, control, gesture) {
          const { minimum = 0, maximum = 10 } = range(address, control);
          const now = door.read(address, control.value);
          if (gesture === 'up') return Math.min(maximum, now + 1);
          if (gesture === 'down') return Math.max(minimum, now - 1);
          return now >= maximum ? minimum : now + 1;
        },
        access(address, control) {
          const { maximum = 10 } = range(address, control);
          return { valueText: `${door.read(address, control.value)} of ${maximum}` };
        },
      },
    },
  };
}
