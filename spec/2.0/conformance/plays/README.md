# Whole-play test files

These files test another implementation of the logic layer against the engine (9.6.2). Added after `2.0.0-next.0`.

Each `.json` file is one play of an example that every core export holds. It gives the package, how the play starts,
the moves, and the state fingerprint (9.6.1) after every move, with the outputs heard. An implementation passes a file
when it plays the package from that start, feeds each move, and gives the same fingerprint, the same outputs and the
same result after every move. You need only a JSON parser, SHA-256 and the package files.

## The format (`hsvg-play/1`)

One JSON object, with these keys in this order:

- `format`: `"hsvg-play/1"`.
- `engine`: the version of the engine that made the file (`VERSION` of `engine/v2/src/version.mjs`). The release step
  sets `VERSION` with the package version, and the files are made again with it (D64).
- `name`: the file name without `.json`.
- `about`: what the play shows, in words.
- `package`: the files the play runs.
  - `folder`: the example's folder, from the repository root, with `/`.
  - `experience`: the experience file inside the folder.
  - `files`: every file in the folder, by its path inside the folder, sorted: `sha256:` and the hex SHA-256 of its
    bytes. A text file (`.json`, `.svg`, `.csv`, `.txt`, `.vtt`, `.md`, `.mjs`) is hashed with its line ends as LF.
    Check them first: a file that differs means another package, and the play does not apply.
  - `addons`: the add-ons the package pins (`id@version`: digest), as in its `about.trust.pins`. An implementation
    needs its own port of each one (D57: rules in code need their own ports). Empty for most plays.
- `start`: how the play starts.
  - `epochMs`: the clock's start. The host's clock gives `epochMs + t` at engine time `t` (9.6).
  - `inputs`: input values the host gives, by name. Each replaces that input's `initial` before the start, as a host
    places a HyperSVG with inputs.
  - `stored`: the stored values, or `null`. An object of scope (`session`, `saved`) to the record a store holds, as
    the engine writes it: `{stamp, values: {"<address>#<name>": value}, knobs, graph}`. The host grants those scopes,
    with an empty page path and the partition `device` (10.6). The engine reads a scope only when the experience's
    storage grant names it (10.5). The guide's harbour asks for saved storage; `harbour-saved.json` starts with a
    saved record, and the other plays start with `null`.
  - The host profile: with `stored` null, none. With stored values, the host gives the experience the grants it asks
    for, with storage for the scopes of `stored`: `{"format": "hsvg/2.0", "kind": "host-profile", "id": "play",
    "grants": {…the experience's grants, "storage": [the scopes]}}`.
  - No host options, no fixtures: each play uses none.
- `steps`: one object per move, in order:
  - `move`: the move, as 9.6 writes it: `{t, source, payload}`. The first move is always `start`; its payload holds
    the ambient values it starts with. A `firstInput` move comes just before the first press, key press or pointer
    press of a run (`activate`, `hold` down, `snap`, `key` down, `pick`, `closeDialog` made by a person), as a page
    sends it (10.4).
  - `refused`: present when the input was refused: the fault's code (for example `E-RANGE`).
  - `ignored`: present when the input was ignored: why (for example `disabled`, a control that is off).
  - `fingerprint`: the state fingerprint (9.6.1) after the move.
  - `heard`: the outputs heard while feeding the move (the clock's run to `t`, then the input): `{t, name, detail}`
    for each event or record output of the experience and each built-in output (`entered`, `ended`, `openUrl`,
    `firstInput`, `hookHealth`). Outputs of a scene are not in it; their effect is in the fingerprint.
- `end`: after the last move the clock runs on to `end.t` with no move. `fingerprint` and `heard` as in a step, and
  `state`: the whole state document (9.6.1) at the end, to find where two implementations part.

## Feeding a play

1. Check every file of `package.files` against its digest.
2. Make a player of the package with the start's inputs, stored values and clock.
3. For each step, run the clock to `move.t`, then the input with its payload (a `null` item is a missing argument).
   A `restart` sets engine time to 0, so the next move's `t` may be smaller.
4. After each step, compare the result, the fingerprint and the outputs heard.
5. Run the clock to `end.t` and compare the end.

## Moves a file never holds

- **`door`**: another add-on's step that has no move of its own. It has no payload to feed again (9.6, D62), so a
  play that heard one could not be replayed. The page add-ons' news and seat fills are add-on moves with payloads
  (9.6); no example here uses those add-ons.
- **Moves of the page alone**: layout measures, sound and voice timing, video places. They are not moves (9.6).
- Typed words (`freeText`) are moves by length. What they decide through the `ai` add-on is in its `ai.arrive` move.
  No example here has them.

## The files

The plays cover the ten examples of `release/lean.json`. Scripted plays name what they show; walks are seeded random
walks (one usable control or choice at each step, then 300 to 1199 ms), as the replay tests make them.

| File | Example | Moves | What it shows |
|---|---|---|---|
| `harbour-win.json` | the guide's harbour | 13 | A host input; ten loads reach the win; the ferry's 2 s timer runs out between loads. |
| `harbour-miss-and-restart.json` | the guide's harbour | 20 | A miss, a guard that fails, a load with a record row, a clip and an attach; a choice control; the shell's dialog and mute; a host input and a knob; forget; a restart. |
| `harbour-ambient.json` | the guide's harbour | 10 | A size, a host pause that holds the timers, reduced motion, a key. |
| `harbour-saved.json` | the guide's harbour | 4 | A saved record at the start: `best` starts at 7, not 0. |
| `harbour-walk.json` | the guide's harbour | 42 | A walk (seed 7). |
| `harbour-walk-2.json` | the guide's harbour | 42 | A walk (seed 1913). |
| `lamp-host.json` | the guide's lamp | 8 | Knobs set by the host, one refused (`E-RANGE`); the switch and its event; a settings Apply. |
| `lamp-walk.json` | the guide's lamp | 22 | A walk (seed 7). |
| `list-to-the-end.json` | the guide's list | 5 | Next to the last town; the last press is ignored. |
| `list-walk.json` | the guide's list | 4 | A walk (seed 3); it stops when nothing is usable. |
| `one-page-stars.json` | the one-page example | 8 | Presses that play a clip, one while it runs; reduced motion. |
| `one-page-walk.json` | the one-page example | 17 | A walk (seed 11). |
| `ad-sizes.json` | the guide's ad | 4 | Size changes and a host input. |
| `infographic-sizes.json` | the infographic | 2 | A size change and time running. |
| `orientation-shapes.json` | the orientation recipe | 7 | Taps between size changes. |
| `orientation-walk.json` | the orientation recipe | 12 | A walk (seed 5). |
| `noughts-win.json` | the noughts door example | 8 | A win against the logic module `example.noughts` (easy). |
| `noughts-loss.json` | the noughts door example | 9 | A loss (hard), a taken cell, then Again. |
| `noughts-walk.json` | the noughts door example | 42 | A walk (seed 7). |
| `doors-wind.json` | the doors example | 7 | The add-on control kind `example.steps.stepper` and a clip. |
| `doors-walk.json` | the doors example | 22 | A walk (seed 7). |
| `addon-lamp-switch.json` | the capability door example | 5 | A capability that only draws (`example.tint`). |
| `addon-lamp-walk.json` | the capability door example | 12 | A walk (seed 9). |

No example a core export holds has story choices (3.5): choices here are choice controls (the harbour's cards, the
noughts cells and levels).

## Run

```sh
node engine/v2/tools/make-plays.mjs           # writes the files again
node engine/v2/tools/make-plays.mjs --check   # exit 1 when a file differs
node engine/v2/tests/run.mjs plays            # the engine against these files
```

The files are made by the engine of the same release. A change to the engine's state shapes or behaviour makes them
differ; the tool writes them again, and the change shows in the diff.
