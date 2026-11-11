# Choice places inside a scene (2.1 draft)

This is a 2.1 draft. It is not part of HyperSVG 2.0: no 2.0 engine, checker or schema reads it as grammar. A 2.0
file that uses what it describes is refused (`E-DRAFT`, "not in 2.0; a 2.1 draft"), and the message names this draft.

In 2.0 choice links are shown by an add-on (the `widgets` add-on's `choices` widget) or by a seat (the `seats`
add-on), never in a place of the scene's drawing (3.5).

- **`choiceRegion`.** A scene key naming a `repeat` region of its drawing (5.10) whose child slots are the option
  slots, present in every frame. Offered choices fill them in link order, with no gaps. The region must have at least
  as many drawn option slots as the scene has choice links (`E-REPEAT-CAPACITY`). The engine draws each offered choice
  in its slot as an option control styled by the theme, its label fitted to the slot box.
- **`choicesAtMs`.** A scene key, local time 0..3,600,000 (default 0): choices are offered from then until the scene
  leaves.
