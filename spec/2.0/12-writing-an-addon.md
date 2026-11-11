# 12. Writing an add-on

An add-on adds to the format from outside the engine. There are three kinds:

| Kind | What it is | Trust |
|---|---|---|
| **preset** | JSON values with typed, range-checked inputs. It is expanded into ordinary content. | Nothing to trust: the checker checks the result as any file. |
| **module** | A pure function: a logic module. Trusted code, reviewed for no page, no network and no clock, with a step budget. Not a sandbox. | Hash-locked: the experience pins the digest of every file it runs; the host grants it. |
| **capability** | Code in the page, with hooks the engine calls. | Hash-locked, allowed by the host, within the size limit. |

Add-ons are chosen and fingerprinted when the experience is made. Nothing new arrives while a page runs, except data
and pictures through the host API (10.6, D40). Runtime import of SVG, parts or code is outside the standard. The engine
never knows an add-on's name; it knows the door.

"Add-on" means only what this door admits. The spec's labelled chapters A1 to A14 are reference pages,
not add-ons.

**Built-in capabilities use the same door (D28).** A built-in (the engine's own, with a bare name) keeps its settings
in `"addons": {"<name>": {...}}`, its actions are calls `{"call": "<name>.<verb>", "with": {...}}`, and its events are
heard as `<name>:<event>:<subject>`. Its manifest (`spec/2.0/capabilities/<name>.json`, which comes with the hypersvg-addons release, not with the core)
lists its words: `grammar.addons.<name>`
for the settings and `grammar.calls` for the calls, each `with` a closed schema of the evaluated inputs. An input may
say `"x-hsvg-names": "<key>"`: a quoted literal then names an entry of that key of the settings (a body). For example
physics: `addons.physics`, `physics.throw`, `physics.kick`, `physics:hit:<body>`; effects: `addons.effects.particles`,
`effects.play`, `effects:ended:<effect>` (10.7). A built-in's control kinds and channels (D39) are
`grammar.controls` and `grammar.paints`, in the shape of 12.5, named `<name>.<kind>` and `<name>.<channel>` in
content. An unknown key in a built-in's settings is refused with the capability's name and where its words are listed.

## 12.1 One rule

An add-on is a folder with `manifest.json` and its files.

- **The folder is named by the add-on's id.** An outside add-on's id is `owner.name`, in lower case, for example
  `acme.shake`. Built-in add-ons (the engine's own) have bare names, for example `wobble`. The core holds the built-in presets of
  12.3 in `engine/v2/addons/`; the built-in capabilities and modules come with the hypersvg-addons release. An
  outside add-on with a bare name is refused (`E-CAPABILITY-GRAMMAR`). So an outside name never clashes with a
  built-in one, now or later.
- **The folder sits at `addons/<id>/`** beside the experience, or in any parent folder. The checker, the packer and
  the tool look there.
- **The experience names it.** A module or capability goes in `needs` with its version: `"acme.noughts@1.0.0"`. A
  preset goes in a document's `presets` list (12.3).
- **What an add-on adds in JSON (D34).** Its settings go in `addons.<name>` of a block, such as `addons.physics.bodies`.
  Its actions are calls `<name>.<verb>`, and its events are heard as `<name>:<event>:<subject>`. Each needs the add-on
  in `needs`.
- **The growth slots (D39).** An add-on may also add a control kind, a binding channel and a clip track channel. Each
  is a value `<name>.<kind>` or `<name>.<channel>` (split at the last dot, as a call), declared in its manifest
  (`controls` and `paints`, 12.5) and needing the add-on in `needs`: `"kind": "example.steps.stepper"`,
  `{"target": "flag", "example.sway.swing": "wind / 5"}`, `{"target": "pennant", "channel": "example.sway.swing", ...}`.
  No core word or mark is added. A value that names no slot the add-on declares is one `E-ADDON` that names the slots
  it has and the core words. The drawing side is closed: no add-on value goes in a drawing mark (D34).
- **A known add-on that this release does not hold.** A built-in capability or module from the registry that comes with
  the hypersvg-addons release is still named in `needs` when content uses it. The checker gives one `W-ADDON-ABSENT`
  per such need, accepts the add-on's calls, events and `addons.<name>` settings by name (from the registry), and checks
  the rest. A use of it with no need is `E-NEEDS-MISSING`. The packer refuses the experience: pack it with the
  hypersvg-addons release.
- **The experience pins it.** Every outside add-on it uses is pinned in `about.trust.pins` as
  `"<id>@<version>": "<digest>"`. The digest is SHA-256 over the folder's files (each as its path, a line break, its
  text with LF line ends, a line break, sorted by path). Hidden files and a `tests/` folder at the top of the add-on are
  left out; a `tests/` folder deeper down is hashed. After you
  review a change, pin it again: `node engine/v2/tools/addon.mjs pin <experience folder>`.
- **Only text files:** `.json`, `.mjs`, `.svg`, `.csv`, `.md`, `.txt`.
- **The door has its own version.** The manifest says `"door": 2` (D31.5), which adds the entries of 12.5 below, or
  `"door": 1`. A door 1 manifest keeps working: its `channels` are read as `writes`, and a door 2 word in it is
  refused with a message that says to write `"door": 2`. A door 2 manifest that still says `channels` is told to
  rename it. Any other door is refused (`E-CAPABILITY-FORMAT`). Three worked examples below are door 1 files, on
  purpose: they show that door 1 still works. The fourth, a tint (12.5), is door 2. A new add-on (`addon.mjs new`) is
  door 2.

### The manifest

| Key | Holds |
|---|---|
| `door` | The door's version, `2` or `1` (above) |
| `id` | `owner.name` (outside) or a bare name (built-in). The folder's name. |
| `version` | `major.minor.patch`, for example `"1.0.0"` |
| `kind` | `preset`, `module` or `capability` |
| `title` | A short name for people, 1 to 80 characters |
| `description` | Optional plain text, at most 400 characters: what it does and how to use it |
| `adds` | What it adds. A preset: `inputs`, `provides`. A module: `exports`. A capability: `keys`, `calls`, `events`, `writes` (door 1 called it `channels`), and with door 2 `draws`, `contentTypes`, `grants`, `controls` and `paints` (12.5). |

The schemas in a manifest (a module's `with` and `returns`, a capability's `keys` and a call's `with`) describe
content values (5.1). Each is a closed object: `{"type": "object", "properties": {...}, "required": [...],
"additionalProperties": false}`. Use the content types: `number` (with `step: 1` for whole numbers, and `minimum` and
`maximum`), `string` (with `maxLength` or `enum`), `boolean`, `array` (with `maxItems`) and `object`.

## 12.2 Make one

```sh
node engine/v2/tools/addon.mjs new preset acme.pulse        # or: hsvg addon new preset acme.pulse
node engine/v2/tools/addon.mjs new module acme.score
node engine/v2/tools/addon.mjs new capability acme.fade
```

Each writes `addons/<id>/` in the current folder (or `--in <folder>`): a working add-on with a README and a test.
Then:

```sh
node addons/acme.score/tests/score.test.mjs                 # the add-on's own test
node engine/v2/tools/addon.mjs check addons/acme.score      # the door's checks; each finding says the fix
node engine/v2/tools/addon.mjs pin <experience folder>      # pin it in the experience that uses it
node engine/v2/tools/check.mjs <experience folder>          # the checker, with the add-on in place
node engine/v2/tools/pack.mjs <experience folder> <out> --allow <id>   # a module or capability: you allow its code
```

The worked examples below are in `engine/v2/addons/examples/`. The game `noughts/` (play against Bolt, a desk robot) uses all three: the module chooses Bolt's move, the capability makes a win glow, and the preset shakes the paper when a cell is taken. A scene picks the level; the game scene does everything you see. The engine's
tests copy them to a folder outside the engine, pin, check, play and pack them.

## 12.3 Presets

A preset is JSON only. Its `adds` holds `inputs` and `provides`.

**Inputs** are typed and range-checked. Each is `{"type": ..., "initial": ..., "description": ...}`:

| Type | A value is | Also give |
|---|---|---|
| `number`, `integer` | a number; an integer is whole | `minimum` and `maximum` (required) |
| `boolean` | `true` or `false` | |
| `string` | text | `maxLength` (1 to 4096) or `enum` |
| `color` | `#rrggbb` | |
| `part` | the id of a drawn part | |
| `role` | a role name | |

An input without an `initial` value must be given by every use.

**Provides** holds the content the preset adds, under these keys only: `clips`, `addons` (capability settings, such as
physics bodies under `addons.physics` and particle effects under `addons.effects.particles`), `themes` (motion curves
and themes), `layouts` (layout plans), `rules` (rule sets), `needs`, `entry` and `on`. `effects` is no longer a
preset key: particle effects are add-on settings, so they go under `addons`. Anything else is grammar a preset cannot add (`E-CAPABILITY-GRAMMAR`).

`{{name}}` in a key or a string is filled with an input. A string that is exactly `{{name}}` takes the input's value
and type; inside a longer string it becomes text. `{{as}}` is the name the use gives, so two uses never clash.

**A use** is `{"use": <name>, "as": <id>, "with": {<inputs>}}` in a document's `presets` list (an experience, a
scene, a shell or a block definition). A built-in preset is named bare (`"wobble"`); an outside one with its version
(`"acme.shake@1.0.0"`). `as` defaults to the name's last word. It is an id of at most 32 characters: small letters,
digits and dashes, starting with a letter (`logo-wobble`), so `{{as}}-drop` is an id too.

**Expansion.** The loader and the packer expand each use into the document before it is checked: objects merge key by
key, lists append, `needs` entries join once. A key the document already has is a conflict (`E-ADDON`), and so is a key `__proto__`, `constructor` or `prototype` anywhere in what a preset adds. The `presets`
key then goes. A packed page carries the expanded documents, never a preset. The checker checks the result as any
content, and a finding in what a preset added ends with `(from the preset <id>, used as <as>)`.

**Starter presets** (built-in, in `engine/v2/addons/`). This release ships `wobble`, `pop-in`, `breathe` and
`gentle-motion`. Each manifest's description says how to use it. The others (`bouncy-ball`, which needs `physics`, and
`confetti`, `sparkle` and `snowfall`, which need `effects`) come with the hypersvg-addons release, with the
capabilities they need. A use of a built-in preset this release does not hold is refused: `E-ADDON ... confetti is
not a built-in preset in this release; if it is one of the built-in presets that need a built-in capability (...), it
comes with the hypersvg-addons release`.

### Worked example: a shake

`addons/example.shake/manifest.json`:

<!-- file: engine/v2/addons/examples/addons/example.shake/manifest.json -->
```json
{
  "door": 1,
  "id": "example.shake",
  "version": "1.0.0",
  "kind": "preset",
  "title": "Shake",
  "description": "A clip that shakes a part left and right, for a wrong move. Play it with {\"play\": \"<as>\"}. The part needs a translate-x motion range of at least the distance.",
  "adds": {
    "inputs": {
      "target": { "type": "part", "description": "the part that shakes" },
      "distance": { "type": "number", "minimum": 1, "maximum": 40, "initial": 6, "description": "how far it moves each way" },
      "times": { "type": "integer", "minimum": 1, "maximum": 4, "initial": 2, "description": "how many shakes" }
    },
    "provides": {
      "clips": {
        "{{as}}": {
          "durationMs": 400,
          "loop": "{{times}}",
          "tracks": [
            {
              "id": "{{as}}-x",
              "target": "{{target}}",
              "channel": "move", "axis": "x",
              "keys": [[0, 0], [100, "{{distance}}", "ease-out"], [300, "-{{distance}}", "ease-in-out"], [400, 0, "ease-in"]]
            }
          ]
        }
      }
    }
  }
}
```

The scene uses it, and plays the clip when a taken cell is picked:

```json
"presets": [{"use": "example.shake@1.0.0", "as": "nope", "with": {"target": "board", "distance": 10}}],
"machines": [{"id": "round", "initial": "your-turn", "states": {"your-turn": {"on": {"picked": [
  {"id": "cell-taken", "guard": "at(board, cell, '') !== ''", "actions": [{"id": "shake", "play": "nope"}]},
  {"id": "place-x", "actions": [...]}]}}}}]
```

The part `board` (the sheet of paper) is drawn with `data-hsvg-motion="move-x -12..12"`. The experience pins
`"example.shake@1.0.0": "sha256:..."`.

## 12.4 Logic modules

A logic module is a pure function. It is the door the chess module uses, opened to outside authors.

- **Code:** `index.mjs` exports `make(step)`, which returns an object of functions, one per export. Other `.mjs`
  files of the folder may be imported as `./name.mjs`. Nothing else may be imported.
- **Trusted code, not a sandbox (D26).** A module runs in the page, in the same realm as the engine. It is admitted
  only by its fingerprint (12.1: the digest covers every file it runs, its imports included) and the host's grant
  (the reviewed lock). Nothing isolates it at run time: review is the guard. Real isolation (a worker or similar,
  with a hard time limit) may come in 2.1 or later as an engine-internal hardening, with no format change (D40). A
  module is a pure function, so moving it there breaks no module.
- **Reviewed for purity.** The code gets only its inputs and `step`. It may not name a global, the page, the network,
  a clock or a random source, and may not catch (`try`, `catch`). The checker scans the code for these words:
  `globalThis`, `window`, `self`, `document`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator`,
  `location`, `localStorage`, `sessionStorage`, `indexedDB`, `Date`, `performance`, `setTimeout`, `setInterval`,
  `setImmediate`, `queueMicrotask`, `requestAnimationFrame`, `eval`, `Function`, `require`, `process`, `constructor`,
  `__proto__`, `prototype`, `Reflect`, `Proxy`, `WebAssembly`, `Atomics`, `SharedArrayBuffer`, `crypto`,
  `postMessage`, `importScripts`, `Worker`, `async`, `await`, `Promise`, `random`, `try`, `catch`, `this`,
  `arguments`, `debugger`, `Symbol`, `defineProperty`, `getPrototypeOf`, `setPrototypeOf`, `parent`, `top`, `frames`,
  `opener`, `history`, `Image`, `Audio`, `Blob` and `__hsvgTick` (the loader's time check). The scan matches whole
  words in the code as JavaScript reads them, with comments left out and `\u` and `\x` escapes decoded. Strings and property names count: a module that returns the string `'top'` or has a function named
  `random` is refused. It also refuses `import()`, an import from outside the folder, `export default` and `export *`.
  In a packed page each file of the module also runs in strict mode inside a scope that answers every name it does not
  declare: the language's plain objects (`Math`, `JSON`, `Object`, `Array`, `Number`, `String` and the like) read as
  themselves, and every other name (`top`, `parent`, `document`, `location`, `fetch`, `Date`, an element's id) reads
  as undefined and cannot be written. Its imports reach only its own files. This shuts out the page's names, so a slip
  in review reaches nothing by name. It is not a sandbox: the host's review of the code is what admits it.
- **Deterministic.** The same inputs always give the same result.
- **A step budget, kept per player.** Call `step()` once per unit of work. The engine stops a call that passes its
  `budgetSteps` (default 10,000,000), and `budgetMs` (1 to 1000) when it reads its clock (every 1,024 steps and after
  the call). Before the module runs, its loader also adds a time check to every loop and function body, so a module
  that never calls `step` (`for (;;) {}`, `while (true)`, `do`, recursion) still stops at its `budgetMs`, on the
  page's thread. A stopped call faults with no output. Each player keeps its own budgets and limits.
- **Hash-locked** with the lock rule of 12.1: the experience pins the digest, and the host's reviewed lock must list
  the same digest. A packed page is its own host: the person packing reviews the module and allows it with
  `pack ... --allow <id>` (without it the pack is refused, `E-ADDON`), and the page's lock lists what the packer
  carries.
- **Within the size limit,** as a capability (12.5): its code is at most `capabilityBundleBytes` (10,000 bytes) gzip 9.
  The checker measures its files; the packer measures what it carries (`E-ENGINE-SIZE`).

**Exports** are `{"with": <schema>, "returns": <schema>, "budgetMs": 1..1000, "budgetSteps": ..., "description":
...}`. `with`, `returns` and `budgetMs` are required; `budgetSteps` (default 10,000,000) and `description` are
optional. Content calls an export with the `call` action:

```json
{"id": "turn", "call": "example.noughts.turn", "with": {"board": "board", "cell": "cell", "level": "level"}, "to": {"board": "board", "winner": "winner", "reply": "reply"}}
```

`with` gives exactly the export's inputs, each a formula. `to` maps exactly its outputs to body values the block may
write. The inputs, the result and every output are checked before anything is written (`E-MODULE-CALL`,
`E-MODULE-RESULT`).

### Worked example: a noughts-and-crosses opponent

`addons/example.noughts/manifest.json`:

<!-- file: engine/v2/addons/examples/addons/example.noughts/manifest.json -->
```json
{
  "door": 1,
  "id": "example.noughts",
  "version": "1.0.0",
  "kind": "module",
  "title": "Noughts and crosses opponent",
  "description": "Plays O against a person who plays X. turn takes the board, the person's cell and a level from 1 (easy) to 3 (never loses), and returns the new board, the winner and the cell O took.",
  "adds": {
    "exports": {
      "turn": {
        "description": "Puts X in cell, then, unless the game is over, puts O where the level chooses.",
        "with": {
          "type": "object",
          "properties": {
            "board": { "type": "array", "maxItems": 9, "items": { "type": "string", "maxLength": 1, "enum": ["", "X", "O"] } },
            "cell": { "type": "number", "step": 1, "minimum": 0, "maximum": 8 },
            "level": { "type": "number", "step": 1, "minimum": 1, "maximum": 3 }
          },
          "required": ["board", "cell", "level"],
          "additionalProperties": false
        },
        "returns": {
          "type": "object",
          "properties": {
            "board": { "type": "array", "maxItems": 9, "items": { "type": "string", "maxLength": 1, "enum": ["", "X", "O"] } },
            "winner": { "type": "string", "maxLength": 4, "enum": ["", "X", "O", "draw"] },
            "reply": { "type": "number", "step": 1, "minimum": -1, "maximum": 8 }
          },
          "required": ["board", "winner", "reply"],
          "additionalProperties": false
        },
        "budgetMs": 250,
        "budgetSteps": 1000000
      }
    }
  }
}
```

`addons/example.noughts/index.mjs`:

<!-- file: engine/v2/addons/examples/addons/example.noughts/index.mjs -->
```js
// example.noughts: a noughts-and-crosses opponent, an outside logic module (door 1).
// A logic module is a pure function. It gets only step(), which it calls once per unit of work, and its inputs.
// It names no global, no clock and no random source, so the same inputs always give the same answer.

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7]; // centre, corners, edges

export function make(step) {
  const winner = (b) => {
    for (const [a, c, d] of LINES) { step(); if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]; }
    return b.includes('') ? '' : 'draw';
  };
  // The cell that completes a line for who, or -1.
  const finish = (b, who) => {
    for (const i of ORDER) {
      if (b[i]) continue;
      b[i] = who; const won = winner(b) === who; b[i] = '';
      if (won) return i;
    }
    return -1;
  };
  // Minimax: the score of the board for O to move (1 O wins, 0 draw, -1 X wins).
  const score = (b, toMove) => {
    step();
    const w = winner(b);
    if (w === 'O') return 1;
    if (w === 'X') return -1;
    if (w === 'draw') return 0;
    let best = toMove === 'O' ? -2 : 2;
    for (const i of ORDER) {
      if (b[i]) continue;
      b[i] = toMove; const s = score(b, toMove === 'O' ? 'X' : 'O'); b[i] = '';
      if (toMove === 'O' ? s > best : s < best) best = s;
    }
    return best;
  };
  const choose = (b, level) => {
    if (level >= 2) {
      const win = finish(b, 'O'); if (win >= 0) return win;
      const block = finish(b, 'X'); if (block >= 0) return block;
    }
    if (level >= 3) {
      let best = -1; let bestScore = -2;
      for (const i of ORDER) {
        if (b[i]) continue;
        b[i] = 'O'; const s = score(b, 'X'); b[i] = '';
        if (s > bestScore) { best = i; bestScore = s; }
      }
      return best;
    }
    for (const i of ORDER) if (!b[i]) return i;
    return -1;
  };
  return {
    turn({ board, cell, level }) {
      const b = board.slice();
      if (winner(b) || b[cell]) return { board: b, winner: winner(b), reply: -1 };
      b[cell] = 'X';
      if (winner(b)) return { board: b, winner: winner(b), reply: -1 };
      const reply = choose(b, level);
      b[reply] = 'O';
      return { board: b, winner: winner(b), reply };
    },
  };
}
```

The experience names and pins it:

```json
"needs": ["example.noughts@1.0.0"],
"about": {"trust": {"pins": {"example.noughts@1.0.0": "sha256:..."}}}
```

A host in Node loads its code with `loadAddons` (`engine/v2/tools/addons.mjs`) and lists its digest in the lock of a
`modulePort`. To pack it, the person packing allows it, as a capability: `pack ... --allow example.noughts`. Without
the flag the pack is refused (`E-ADDON`).

## 12.5 Capabilities

A capability add-on is code in the page. It follows the in-page door of 10.7, as one rule:

- **It adds calls, keys, controls or paints.** A capability with none is refused (`E-ADDON`): content could not use
  it.
- **The manifest declares everything it may touch.** `keys`: the settings a block gives it, under
  `"addons": {"<id>": {...}}`, checked against this schema. `calls`: the calls content may make, each with a `with`
  schema. `events`: the events it may emit; content hears each as `<id>:<name>`. `writes` (door 1: `channels`): the keys of its
  settings whose value names a body value it may write.
- **The hooks the engine calls.** `index.mjs` exports `install(door)`, which runs once per page and returns its hooks.
  The engine takes only these, by name: `calls` (one function per manifest call: `(address, input)`), `timer(t)`,
  `mount(address, doc)`, `entered(address, doc)`, `hold(address, ms)`, `keep`, and with door 2 `controls` and `paints`
  (D39, below), each only for a kind or channel its manifest lists. Any other key is ignored. A hook cannot rename the
  add-on, take another add-on's record or add actions. It may also export
  `attach({door})`, which runs in the browser page.
- **The engine door** (`install`) is a frozen object with no prototype. It holds exactly these, and nothing else:

  | Entry | Does |
  |---|---|
  | `id` | The add-on's id |
  | `settings(address)` | The block's settings for this add-on (`addons.<id>`), or null |
  | `write(address, name, value)` | Writes a body value, only one that a key listed in `writes` names in the block's settings |
  | `emit(address, name, payload, subject)` | Sends one of its own events, heard as `<id>:<name>`; with a subject (an id) when the manifest lists `<name>:<subject>`, heard as `<id>:<name>:<subject>` |
  | `read(address, name)` | Reads a value of the block |
  | `now()` | The engine clock, in ms |
  | `def(address)` | The block's definition (read-only) |
  | `entryKey(address, entry)` | The key of a repeated entry |
  | `fault(code, message, address)` | Stops with a finding |
  | `timers` | `add(owner, due, fields)`, `drop(match)` and `list()`, on the engine clock; frozen, no prototype |

  It never holds the core door. It has no `transaction`, so an add-on cannot act as a person, and no raw `write` or
  `emit`.
- **The page door** (`attach`). `attach` gets `{door}` and nothing else: no window, no container, no options. The door
  is frozen and visual-only. It holds `id`, `experience`, `settings(address)`, `blocks()` (the addresses on the page
  with its settings or its bindings), `draws(address)` (the bindings of a block that name this add-on, door 2),
  `part(address, id)`, `slot(id)`, and the reading functions `shell`, `scene`, `scenes`, `block`, `words`,
  `template`, `eval`, `read`, `input`, `ambient`, `revision`, `colorRoles`, `onDeliveries(fn)` (after each change)
  and `repaint()`. An outside capability cannot call `eval`: the code scan below refuses the word. It changes how parts look and never writes values. It has no `setInput`, `applySettings`, `send`,
  `fire`, `pick` or `closeDialog`.
- **Style handles.** `part(address, id)` and `slot(id)` never give the page element. They give a handle: a frozen
  object with no prototype that holds only `style`. Its setters cover how a part looks: `filter`, `opacity`,
  `transform`, `transformOrigin`, `transition`, `visibility`, `fill`, `stroke`, `strokeWidth`, `strokeOpacity`,
  `fillOpacity` and `mixBlendMode`. A value that holds `url(`, markup (`<` or `>`), a backslash, `expression(`,
  `image-set` or `@import` is refused: the style keeps its old value, so a style cannot load a file. In the dev player
  and in a test page (`pack ... --test`) each refusal is a console warning that names the add-on, the property and the
  reason. A published page refuses without a word.
- **Allowed by the host.** It runs only when the experience pins it and the host's reviewed lock lists the same
  digest: `mount(el, pkg, {capabilities: {"<id>": modulePort({lock: {"<id>@<version>": "<digest>"}})}})`. The person
  packing a page is its host and allows it with `pack ... --allow <id>`. Without the grant the page does not start
  (`E-ADDON`, with the grant to give).
- **Hash-locked**, as 12.1.
- **Within the size limit.** Its code is at most `capabilityBundleBytes` (10,000 bytes) gzip 9, the same limit as a
  module's.
- **No network, no evaluated text, no way around the door.** The checker scans its code for these words: `fetch`,
  `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `Worker`, `SharedWorker`, `eval`,
  `Function`, `localStorage`, `sessionStorage`, `indexedDB`, `cookie`, `open`, `postMessage`, `RTCPeerConnection`,
  `window`, `globalThis`, `self`, `top`, `parent`, `opener`, `frames`, `document`, `location`, `hsvg`,
  `getPrototypeOf`, `setPrototypeOf`, `__proto__` and `constructor`. It also refuses `import()`, imports from outside
  its folder, `export default` and `export *`. The scan matches whole words in the code as JavaScript reads them, with
  comments left out and `\u` and `\x` escapes decoded.
  Strings and property names count: a capability with the string `'open'` (a mouth that is open) or a call
  `door.eval(...)` is refused. Write `'opened'`, or read a value with `door.read`. The scan is a first look for the
  reviewer; the door's limits are what hold.
  It is a review aid for trusted, granted code, not a sandbox.

**Door 2 (D31.5).** One step, for built-ins and outside add-ons alike. A capability's `adds` may also hold:

| Entry | Says | Example |
|---|---|---|
| `writes` | The settings keys whose value names a body value the add-on may write (door 1's `channels`, renamed so it is not confused with animation channels) | `"writes": ["score"]` |
| `draws` | `{"binding": <schema>, "text": <bool>, "description": "..."}`. `binding` is a closed schema of the object a binding gives under the add-on's id. A binding names the add-on as its key, and the add-on is that part's only writer (9.3). `text: true` says it paints text, so the core's fitting measures it. Its page part reads the bindings with `door.draws(address)`. `draws` has no clip channels in 2.0 | `"draws": {"binding": {"type": "object", "properties": {"color": {...}}, ...}, "text": false}`; a binding `{"target": "bulb", "example.tint": {"color": "bulbColor"}}` |
| `humanOnly` on a call | The call runs only in a transaction a person started (5.15.4) | `"calls": {"save": {"humanOnly": true, "with": {...}}}` |
| `contentTypes` | Content types the add-on adds to inputs (5.3.1): an object of declarations, each the value type it holds (as 5.1.1). Content names one as `"contentType": "<owner.name>.<type>"`, and needs the add-on in `needs` | `"contentTypes": {"shade": {"type": "string", "maxLength": 7}}`; an input `{"kind": "content", "type": "string", "contentType": "example.tint.shade", ...}` |
| `controls` | Control kinds (D39). Each is `{"role", "gestures", "description"}`. `role` is what a screen reader announces: `button`, `checkbox`, `switch`, `slider` or `spinbutton`. `gestures` lists what the page passes to the add-on: `press` (a click, Enter or Space), `up` (the up or right arrow key) and `down` (the down or left arrow key). Content names one as `"kind": "<id>.<kind>"` | `"controls": {"stepper": {"role": "spinbutton", "gestures": ["press", "up", "down"]}}` |
| `paints` | Channels (D39), for bindings and clip tracks alike. Each is `{"value", "onto", "description"}`. `value` is the number a binding or a track gives: `{"type": "number", "minimum": ..., "maximum": ...}`. `onto` lists the part channels the writer may set: `x`, `y` (moves), `rotate`, `scale`, `opacity`. Content names one as `"<id>.<channel>"`: a binding key holding a formula, or a track's `channel` | `"paints": {"swing": {"value": {"type": "number", "minimum": -1, "maximum": 1}, "onto": ["rotate"]}}` |
| `grants` | The grant kinds the add-on asks the host for (10.5). The list is closed: `storage`, `network`, `fillers`, `signals`, `pageActions`, `hooks`, `widgets`, `openUrl` and `ai`. Any other is refused (`E-ADDON`). `network` is reserved for 2.1 and allows nothing in 2.0 | `"grants": ["pageActions", "hooks"]` |

**The growth hooks (D39).** `install` returns them; the engine takes only the kinds and channels the manifest lists.

- **A control kind: `controls.<kind>.input(address, control, gesture)`.** The page passes a gesture the manifest
  lists; any other is refused before the hook runs (`E-ADDON`). `control` is a frozen copy of the control's JSON with
  no prototype. The hook answers the control's new value, or `undefined` for none. The engine writes it into the
  control's `value` as a `set` (type, bounds and rules apply; a value out of bounds rolls the step back, `E-RANGE`),
  then sends the control's `event`. The hook never writes anything else.
- **Its accessibility: `controls.<kind>.access(address, control)`.** It answers `{valueText}`: what a screen reader
  hears beside the label. Only plain text of at most 200 characters is kept; anything else in the answer is dropped.
  The page sets the manifest's `role`, the control's `label` (as for every control, 10.13), the value text, and for a
  `slider` or `spinbutton` the value with its declared minimum and maximum (for a `checkbox` or `switch`, whether
  the value is true). It takes a tab stop as other controls do.
- **A channel's range proof.** The checker proves that a binding's formula, and every key of a track, lies inside
  the manifest's `value` range (`E-RANGE`, 5.6.7). While playing, the engine checks the value again before the writer
  runs (`E-RANGE`). The target part draws a motion range (`data-hsvg-motion`) for each of `x`, `y`, `rotate` and
  `scale` that `onto` lists (`E-ADDON`); opacity stays 0..1.
- **Its writer: `paints.<channel>(value, address)`.** It answers the part channels to set, such as `{"rotate": 12}`:
  only those `onto` lists, each a finite number (`E-ADDON`). The engine keeps each inside the part's drawn range and
  paints it as its own channels, so every player (and the fingerprint) shows the same. The writer runs while the
  page paints, outside any step: the door refuses a write or an event from it. Under reduced motion a binding's value
  holds still, as for the core channels.

Two grammar lines go with them:

- **Event names.** An add-on's events are `<addon>:<event>`, or `<addon>:<event>:<subject>` when they are about one
  entry (`physics:landed:ball`, `media:ended:intro`). An outside add-on's are `owner.name:<event>`. Event names never
  appear in formulas: a reaction reads the payload as `event`.
- **Links hear add-on events.** A story link may name an add-on's event of its `from` scene in `on`:
  `{"from": "intro", "on": "lines:ended:welcome", "to": "menu"}` (3.3).

**Names never clash.** Built-in names are bare; outside ids have exactly one dot (`acme.shake`). A call splits at its
last dot (`chess.legalMoves`, `example.noughts.turn`). Export, call and event names are camelCase with no dot. The
core's event prefixes (`press`, `changed`, `ended`, `key`, `keyUp`, `signal`, `save`, `audio`, `hsvg`) are reserved:
no add-on may take one as its name.

### Worked example: a glow

`addons/example.glow/manifest.json`:

<!-- file: engine/v2/addons/examples/addons/example.glow/manifest.json -->
```json
{
  "door": 1,
  "id": "example.glow",
  "version": "1.0.0",
  "kind": "capability",
  "title": "Glow",
  "description": "A visual effect: a soft coloured glow around a drawn part that pulses a few times and fades. A block sets it up under addons.example.glow; content starts it with the call example.glow.pulse and hears example.glow:faded when it ends.",
  "adds": {
    "keys": {
      "type": "object",
      "properties": {
        "part": { "type": "string", "maxLength": 48, "description": "the drawn part that glows" },
        "color": { "type": "string", "maxLength": 7, "pattern": "^#[0-9a-fA-F]{6}$", "description": "the glow's colour" },
        "level": { "type": "string", "maxLength": 48, "description": "a number value of the block, 0 to 1, that the add-on writes: how bright the glow is now" }
      },
      "required": ["part", "color", "level"],
      "additionalProperties": false
    },
    "calls": {
      "pulse": {
        "with": {
          "type": "object",
          "properties": {
            "times": { "type": "number", "step": 1, "minimum": 1, "maximum": 5 }
          },
          "required": ["times"],
          "additionalProperties": false
        }
      }
    },
    "events": ["faded"],
    "channels": ["level"]
  }
}
```

`addons/example.glow/index.mjs`:

<!-- file: engine/v2/addons/examples/addons/example.glow/index.mjs -->
```js
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
```

The scene sets it up, starts it on a win and hears it end:

```json
"addons": {"example.glow": {"part": "board", "color": "#ffb800", "level": "glow"}},
"values": {"glow": {"type": "number", "minimum": 0, "maximum": 1, "initial": 0}},
"on": {
  "example.glow:faded": [{"id": "cheer", "actions": [{"id": "cheered", "set": "cheered", "to": "true"}]}]
},
"machines": [{"id": "round", "states": {"over": {"entry": [{"id": "you-won", "if": "winner === 'X'", "then": [
  {"id": "glow", "call": "example.glow.pulse", "with": {"times": "3"}}]}]}}}]
```

A capability's call has no `to`: it writes the values its settings name. Pack with
`node engine/v2/tools/pack.mjs <folder> <out> --allow example.glow --allow example.noughts` (the game also carries the
module `example.noughts`).

### Worked example: a tint (door 2)

A tint paints a drawn part with a colour. It uses three door 2 words: `draws` (the binding it paints), `contentTypes`
(the colour an input may hold) and `keys` (its settings). It adds no calls. The lamp experience in
`engine/v2/addons/examples/lamp/` uses it.

`addons/example.tint/manifest.json`:

<!-- file: engine/v2/addons/examples/addons/example.tint/manifest.json -->
```json
{
  "door": 2,
  "id": "example.tint",
  "version": "1.0.0",
  "kind": "capability",
  "title": "Tint",
  "description": "Paints a drawn part with a colour. A binding {\"target\": \"<part>\", \"example.tint\": {\"color\": \"<value>\"}} names it; the value holds #rrggbb. An input of content type example.tint.shade holds such a colour. Settings under addons.example.tint give the fade time.",
  "adds": {
    "keys": {
      "type": "object",
      "properties": {
        "fadeMs": { "type": "number", "step": 1, "minimum": 0, "maximum": 2000, "description": "how long a change of colour takes, in ms" }
      },
      "required": ["fadeMs"],
      "additionalProperties": false
    },
    "draws": {
      "binding": {
        "type": "object",
        "properties": {
          "color": { "type": "string", "maxLength": 200, "description": "the name of a value of the block that holds a colour #rrggbb" }
        },
        "required": ["color"],
        "additionalProperties": false
      },
      "text": false,
      "description": "the fill of the target part"
    },
    "contentTypes": {
      "shade": { "type": "string", "maxLength": 7, "description": "a colour #rrggbb" }
    }
  }
}
```

`addons/example.tint/index.mjs`:

<!-- file: engine/v2/addons/examples/addons/example.tint/index.mjs -->
```js
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
```

The scene names the content type, gives the settings and binds the bulb:

```json
"inputs": {
  "shade": {"kind": "content", "type": "string", "contentType": "example.tint.shade", "maxLength": 7, "initial": "#ffcc33"}
},
"values": {"lit": {"type": "boolean", "initial": false}},
"computed": {"bulbColor": "lit ? shade : '#3a3a48'"},
"addons": {"example.tint": {"fadeMs": 300}},
"bindings": [{"target": "bulb", "example.tint": {"color": "bulbColor"}}]
```

The experience names it in `needs` (`"example.tint@1.0.0"`) and pins it. The checker checks the binding against
`draws.binding` and the input's type against the declared content type. Nothing else may write `bulb`. Pack with
`node engine/v2/tools/pack.mjs engine/v2/addons/examples/lamp <out> --allow example.tint`.

### Worked example: a stepper (a control kind, D39)

A stepper steps a whole number by one. The doors experience in `engine/v2/addons/examples/doors/` uses it for the
wind.

`addons/example.steps/manifest.json`:

<!-- file: engine/v2/addons/examples/addons/example.steps/manifest.json -->
```json
{
  "door": 2,
  "id": "example.steps",
  "version": "1.0.0",
  "kind": "capability",
  "title": "Steps",
  "description": "A control kind: a stepper. A control {\"kind\": \"example.steps.stepper\", \"target\": \"<part>\", \"value\": \"<a whole number value>\", \"label\": \"...\"} steps its value by one: up and down with the arrow keys, and a press steps up and wraps round to the minimum.",
  "adds": {
    "controls": {
      "stepper": {
        "role": "spinbutton",
        "gestures": ["press", "up", "down"],
        "description": "steps a whole number value by one inside its minimum and maximum"
      }
    }
  }
}
```

`addons/example.steps/index.mjs`:

<!-- file: engine/v2/addons/examples/addons/example.steps/index.mjs -->
```js
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
```

The scene names the kind, its target and its value:

```json
"values": {"wind": {"type": "number", "minimum": 0, "maximum": 5, "initial": 1}},
"controls": {"wind": {"kind": "example.steps.stepper", "target": "dial", "value": "wind", "label": "Wind"}}
```

A screen reader hears "Wind, spin button, 1 of 5". The arrow keys step it; a click or Enter steps it up.

### Worked example: a swing (a channel, D39)

A swing turns a part about its pivot. The same doors experience swings a flag by the wind (a binding) and a pennant
in a gust (a clip track).

`addons/example.sway/manifest.json`:

<!-- file: engine/v2/addons/examples/addons/example.sway/manifest.json -->
```json
{
  "door": 2,
  "id": "example.sway",
  "version": "1.0.0",
  "kind": "capability",
  "title": "Sway",
  "description": "A channel: swing. A binding {\"target\": \"<part>\", \"example.sway.swing\": \"<formula>\"} or a clip track with \"channel\": \"example.sway.swing\" gives -1 to 1, and the part turns up to 20 degrees either way about its pivot. The part needs a rotate motion range.",
  "adds": {
    "paints": {
      "swing": {
        "value": { "type": "number", "minimum": -1, "maximum": 1 },
        "onto": ["rotate"],
        "description": "how far the part swings: -1 is left, 1 is right"
      }
    }
  }
}
```

`addons/example.sway/index.mjs`:

<!-- file: engine/v2/addons/examples/addons/example.sway/index.mjs -->
```js
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
```

The drawing gives each part its pivot and rotate range, and the scene binds one and plays the other:

```svg
<path id="flag" data-hsvg-kind="part" data-hsvg-pivot="104 64" data-hsvg-motion="rotate -20..20" d="M104 64 L184 84 L104 104 Z" fill="#d6453d"/>
```

```json
"bindings": [{"target": "flag", "example.sway.swing": "wind / 5"}],
"clips": {"blow": {"durationMs": 1200, "tracks": [
  {"target": "pennant", "channel": "example.sway.swing", "keys": [[0, 0], [300, 1], [900, -1], [1200, 0]]}]}}
```

The checker proves `wind / 5` inside -1..1 (wind is 0..5). The experience names both add-ons in `needs` and pins
them. Pack with `node engine/v2/tools/pack.mjs engine/v2/addons/examples/doors <out> --allow example.steps --allow
example.sway`.

## 12.6 Findings

Every finding says the fix.

| Code | When |
|---|---|
| `E-ADDON` | A manifest, a folder, a pin, a use or a block's settings is wrong; a control kind or channel names no slot its add-on declares (D39); a channel's part has no drawn range for what it sets; a gesture or a writer's answer is outside the manifest; code reaches outside its door; code is over the size limit; a capability is not allowed |
| `E-ADDON-INPUT` | A preset use gives an input it does not take, leaves out one without an initial value, or gives one that does not fit |
| `E-CAPABILITY-FORMAT` | The manifest is for another door |
| `E-CAPABILITY-GRAMMAR` | An outside add-on has a bare name, or adds grammar its kind cannot add |
| `E-ENGINE-SIZE` | The packer measured an add-on's built code over `capabilityBundleBytes` |
| `E-MODULE-CALL`, `E-MODULE-RESULT`, `E-MODULE-REVIEW` | A module call, its result, or its review (as for the engine's modules, 10.7) |
| `W-ADDON-ABSENT` | `needs` names a known built-in add-on that this release does not hold; the packer refuses it (12.1) |

## 12.7 Outside the standard

Runtime import (SVG, parts, modules or engine add-ons handed in while a page runs) is outside the standard (D40). It
may be built privately, as a layer outside the base that a file names in `needs`. In the base, every add-on is in the
package, chosen and pinned when the experience is made, and a host hands in only data (`player.set`) and pictures
(`player.picture`, 10.6) while a page runs.

## 12.8 Accessibility (10.13)

An add-on meets the same accessibility contract as the core (10.13). A person who cannot see, hear, hold a pointer or
take fast motion must still use what it adds.

- **A control kind (D39)** is a real control. Its manifest gives the role a screen reader announces (`button`,
  `checkbox`, `switch`, `slider` or `spinbutton`); the content gives its name with `label`, as for every control. Its
  `access` hook gives the value text (`"3 of 5"`, `"Left"`); for a `slider` or `spinbutton` the page adds the value
  and its declared bounds. Every gesture has a key: `press` is a click, Enter or Space; `up` and `down` are the arrow
  keys. So list at least `press`, or `up` and `down`. It takes a tab stop and leaves the focus order when hidden or
  disabled, as other controls do. The worked stepper (12.5) is the pattern: "Wind, spin button, 1 of 5".
- **A channel** moves or fades a part. Under reduced motion a binding's value holds still, as for the core channels;
  a clip track follows its clip's `reducedMotion`. A channel never carries meaning by motion alone: what it shows is
  also in a value that a `text` or `label` binding can say.
- **What an add-on draws or plays** keeps the rules of 6.5 and 6.10: colour is never the only signal, what is heard
  is also shown, and a part with words keeps them in the accessible tree. An event that tells the person something
  (`physics:hit:ball`) should end in a value a `feedback` text shows.
- **A module** answers values only; the content that shows the answer meets the contract.

Test it in a browser with the harness (12.10): `test.mjs` names a control with no name (`T-NO-NAME`), a slider that
says only a number (`T-NO-VALUETEXT`) and a part that hides its words from its name (`W-NAME-HIDES-LABEL`).

## 12.9 Versions (semver)

An add-on has two version facts: its own version, and the engine versions it works with.

- **Its own version** is `version` in the manifest, `major.minor.patch` (semver). A **patch** fixes and changes no
  name or setting. A **minor** adds: a call, an event, an optional setting, a control kind or a channel. A **major**
  removes or changes something content uses: a call, an event, a setting, a range. An experience names the exact
  version in `needs` (`"acme.fade@1.2.0"`) and pins its digest (12.1), so a new version of an add-on never changes an
  experience that is already made. To move to a new version, change `needs`, pin again and check.
- **The engine versions it works with.** The base keeps its word (D42): a file made for 2.0 works in every 2.x, and a
  door, once opened, stays open in every 2.x. So an add-on works with every 2.x engine from the first one that opens
  its door and every slot it uses: door 1 and door 2 (with `controls` and `paints`) open in 2.0.0. An engine that does
  not open its door refuses it with `E-CAPABILITY-FORMAT`, never half runs it.
- **It names them where it is published.** An add-on published as an npm package names the engines in
  `peerDependencies`: `{"@hypersvg/core": "^2.0.0"}`, or from the minor that added a slot it needs
  (`">=2.1.0 <3.0.0"`). It never claims 3.x: a major engine may change the door. Its README says the same.
- **A built-in add-on** (bare name) goes with its engine and has no separate range.

## 12.10 Testing an add-on

Test an add-on the way its users will use it: as files, from outside the engine.

1. **Its own test.** `addon.mjs new` writes `tests/<name>.test.mjs` with a working test. Run it with Node. A module's
   test calls its exports with values; a capability's test installs it through the door and checks its answers.
2. **The door's checks.** `node engine/v2/tools/addon.mjs check addons/<id>`: the manifest and the files. Each
   finding says the fix; it prints the digest an experience pins.
3. **An experience that uses it.** Keep one small experience beside the add-on (as `engine/v2/addons/examples/doors/`
   for the stepper and the swing), pin it (`addon.mjs pin`), then run the harness:

   ```sh
   node engine/v2/tools/check.mjs <experience folder>
   node engine/v2/tools/test.mjs <experience folder> --allow <id>   # plays every scene and control, then a browser pass
   node engine/v2/tools/pack.mjs <experience folder> <out> --allow <id>
   ```

   `test.mjs` plays every control in Node, packs the page, and measures it in a browser if Playwright is installed
   (names, focus, keys and the fingerprint; A8.5). Playwright is optional and never a dependency.
4. **A repository of add-ons.** `release/addons-checks.mjs` is how the official add-ons are tested: it lays the
   add-ons' tree over a copy of the matching `hypersvg` export (the folder in `HYPERSVG_ROOT`, or a sibling folder
   named `hypersvg`), runs the leak check, every add-on test that `release/addons-tests.json` names, and the checker
   on every experience the tree holds. A repository of your own add-ons can run the same script the same way.

Run the tests on Windows and Linux paths alike: use `path` and `fileURLToPath`, never string-built paths.

## 12.11 Publishing an add-on (A12)

Publishing is the author's step. Before it:

- **Check and test** (12.10) on the engine versions you name (12.9).
- **Run the leak check** on what you publish (A12.1): no private terms, no secrets, no keys, no private paths.
- **Ship only the add-on's folder:** `manifest.json`, its code, its README and its tests. Only text files (12.1). No
  dependencies and no network at run time.
- **Say what it is.** The README says what it adds (calls, events, settings, control kinds, channels), the engine
  versions it works with, its licence, and one small example with the pin line its users copy.
- **Name it `owner.name`.** Outside add-ons never take a bare name; the owner is yours (a person, a team or a domain).
- **Publish with provenance where you can** (an npm package from a public repository's workflow). Users still pin the
  digest: the pin, not the registry, is what an experience trusts.

A new version is a new publish with a new `version` (12.9); never change files under a version that is out.
