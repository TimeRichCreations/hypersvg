# 10. Hosts and delivery

Inside an experience, everything on screen sits in a slot of its shell. Outside, the experience reaches the host only
through the hooks, signals and actions the host grants. Every change, from inside or outside, passes the same checks:
type, bounds, rules and grants (section 1, principle 4).

This section then says how add-ons are named (the door), how an experience runs (packed) and how everything is
checked (the checker).

Rules end with the check that proves them: **[files]**, **[playing]** or **[review]**, as in section 5. Every code
is in `errors.json`.

## 10.1 The shell

A **shell** is the screen around scenes: a block with a master drawing (one frame per shape, section 7) and named
slots. It is a JSON document of kind `shell` that refers to its drawing. Its structure is core (D31.2): the `shell`
document, `slots`, `hideSlots`, and the `open` and `close` actions. A slot holds SVG uses. HTML widgets in a slot (a
form, a table, the choices of 3.5, the settings form) are the `widgets` add-on, whose page comes with the add-ons release.

```json
{
  "format": "hsvg/2.0",
  "kind": "shell",
  "id": "robin-screen",
  "layouts": [
    {"id": "wide", "shape": "wide", "drawing": "robin-screen.svg"},
    {"id": "tall", "shape": "tall", "drawing": "robin-screen.phone.svg"}
  ],
  "slots": {
    "stage": {"kind": "stage", "label": "{{words.stageLabel}}"},
    "top-bar": {"kind": "widget", "landmark": "navigation", "label": "{{words.topBar}}", "hideable": true},
    "captions": {"kind": "overlay", "passThrough": true},
    "settings": {"kind": "dialog", "label": "{{words.settings}}", "openValue": "settingsOpen", "pauses": true}
  },
  "values": {"settingsOpen": {"type": "boolean", "initial": false}},
  "uses": [
    {"id": "map-button", "use": "map-button", "into": "top-bar"},
    {"id": "gear", "use": "settings-gear", "into": "top-bar"},
    {"id": "settings-panel", "use": "settings-panel", "into": "settings"}
  ],
  "outputs": {"map": {"kind": "event"}},
  "on": {
    "map-button.pressed": [{"id": "report-map", "actions": [{"id": "emit-map", "emit": "map"}]}],
    "gear.pressed": [{"id": "open-settings", "actions": [{"id": "show-settings", "open": "settings"}]}]
  }
}
```

Robin today draws the Settings gear in 44 scene drawings, the map button in 42 and the help panel in 44. With a shell
each is drawn once.

**Slots.** Each slot is a drawn place in the shell drawing (`data-hsvg-slot`, section 6), present in every frame
(`E-SHELL-SLOT`). The shell document gives its kind:

| Kind | Holds | Notes |
|---|---|---|
| `stage` | The current scene of the story graph | At least one per shell. May carry a `clock` (3.10) |
| `widget` | A use that stays across scenes | A top bar, a score badge, a help panel |
| `overlay` | A use painted over every earlier slot | `passThrough: true` lets input reach what is beneath, except on the overlay's own controls |
| `dialog` | A use shown on request, modal | `openValue` (required), optional `pauses` and `gate` |

`pauses`, `passThrough` and `hideable` default to `false`. A missing required `label` or `openValue`, or `hideable` on a
stage or dialog slot, is `E-SHELL-SLOT` (files).

**Several uses in one slot** are laid out in use order along the slot's longer side, each at its drawn size times the
design scale, with equal gaps; their focus order is use order. **[playing]**

**Persistence.** The shell mounts once, before the start scene, and stays until the player is destroyed. Its
widgets keep their values, clocks and focus while scenes come and go. Links change only what a stage slot holds.
**[playing]**

**Scenes mount into stage slots.** The scene's frame is chosen by the stage slot's box (7.3, 7.4). It is scaled
uniformly to fit the slot's box and centred, with bleed filling the rest (7.3). A scene never sees the shell's body
(its values and behaviour). **[playing]**

**Scenes may hide slots, not redraw the shell.** A scene lists the shell slots it hides while it is mounted:
`"hideSlots": ["top-bar"]`. Only slots marked `hideable` may be listed; a scene can never hide a stage or dialog
slot. The engine shows them again when the scene leaves. A scene cannot bind to, move, restyle or add to shell parts
(review).

**Shell outputs.** The shell reports events like any block (section 5). Links may leave from the shell (3.3): Robin's
`map` output links to `hub-map` from whatever scene is on the stage. **[files]**

**Dialog slots.** The core actions `open` and `close` (5.15.1) show and hide a dialog slot, naming it:
`{"id": "show-settings", "open": "settings"}`. `openValue` names a boolean the shell declares in its `values` (initial `false`, lifetime `run` or `moment`, never
stored); the engine writes it and content only reads it. While a dialog is
open, every other slot is inert (no input reaches it). With `pauses: true`, the stage slots' clocks also pause
(3.10). Escape closes the dialog. `"gate": "long-press"` lets `open` proceed only in a transaction started by a continuous
2000 ms press, or Enter or Space held, on the control whose event led to it (the long-press gate); releasing early cancels
and is announced. Seats, timers and hosts cannot pass a long-press gate. **[files]** for declarations, **[playing]** for behaviour.

**No shell.** An experience without a shell gets the default shell: one stage slot named `stage` filling the host's
box. An add-on may draw in the default shell (the `lines` add-on shows captions along its bottom edge).

**Reference.** An experience names its shell by file (`"shell": "shell/robin-screen.json"`) or, in a kit experience, as a use
of a kit definition (`"shell": {"use": "robin-screen"}`), as scenes do (A14.2).

## 10.2 One stage slot

A shell has exactly one stage slot. Split screen (two or more stage slots, each with its own scene) is a 2.1
draft (`drafts/structure-2.1.md`); a shell with two is refused (`E-DRAFT`). **[files]**

## 10.3 Landmarks and focus order

Paint order is document order is focus order (section 6). The shell adds one level above it.

- **Order.** Tab moves through the slots in the shell drawing's document order. Inside a slot, the order is the document
  order of control targets in the mounted drawing (6.5). An HTML widget an add-on draws takes its slot's place in this order. Hidden slots are skipped. **[playing]**
- **Landmarks.** The stage slot is the `main` landmark (on someone else's page, a labelled `region`, since the
  page has its own `main`). A widget slot
  is `navigation`, `complementary` or `region` as its `landmark` says (default `region`) and needs a `label`. An overlay
  slot is no landmark; its drawing is decorative unless it holds controls, which then form a labelled `region`. A
  dialog slot is a `dialog` with `aria-modal` and its `label`. **[files]**
- **Dialogs.** A dialog opened by a person's action moves focus to its first usable control; one opened by a timer,
  signal or host leaves focus where it is until the person moves into it. Tab stays inside it. Closing returns focus to
  the control that opened it if still usable, else to the first usable control of the first stage slot. While a dialog
  is open, its drawn element (or the widget over it) has `role="dialog"`, `aria-modal="true"` and its `label` as name,
  and everything else of the shell, the stage included, is `inert` (an SVG element is also `aria-hidden`, since
  browsers apply `inert` to HTML only); with dialogs stacked only the top one is live. Tab from its last usable control
  goes to its first, Shift+Tab from its first to its last; closing removes all of this. **[playing]**
- **Host focus.** The player never moves focus away from a host control and never takes focus the person has not
  given it (the `hsvg/0.1` focus rules). **[playing]**

## 10.4 Hosts

The **host** is where an experience runs and the side that grants. Each host has a host profile naming the grants it gives, its limits and the add-ons it runs (the tool reference,
A10.1). A package that needs an add-on the host does not run is refused at mount (`E-HOST-RUNS`).

| Host | What it gives | Usually refused |
|---|---|---|
| Own page | A packed or served page that the experience fills; storage scoped by origin and path | network unless granted |
| Ad placement | An export (a 2.1 draft: `drafts/delivery-2.1.md`, "Exports") with fixed sizes, file and time budgets. The click-out is the experience's `openUrl` output, which the adapter maps to the network's click macro; the address is a `url` content field | network, storage, AI, agent and program seats, page hooks |
| Portal | A served page for making and previewing; editors and portal agents | grants the portal's owner has not given |
| App | A native wrapper; may supply a host storage backend | page hooks |
| AI assistant | The experience inside an assistant's conversation; the assistant reaches it through the host API (10.6) | page hooks, network, storage |
| Someone else's page | A page overlay over a site that the site owner marks (the `page` add-on) | anything not granted |

**Opening a web address.** An experience leaves for an address only through `player.openUrl` (5.15.1), naming a `url` field of the
block that runs it or of the experience (a sealed kit scene names its own). Its optional `with` carries up
to 8 parameters, each a stable id or a number (an id picked from a closed list, such as a chosen colour, is fine;
never words, content text, or free text a person or AI typed, 5.8). The checker refuses a `with` that reads words
or content text (`E-WORDS-DECIDE`), and the engine leaves out any value that is not a finite number or an id
(`^[a-z][a-z0-9-]{0,63}$`), naming it in the output's `refused`;
an adapter whose profile sets `urlParams: true` adds them as query parameters, others drop them and report it. An
ad placement's profile gives `openUrl` itself; the experience still asks for it. The `url` field (5.3.1) it names, of the
running block or of the experience, holds an absolute `https:` address that an editor fills.
The engine reports the output `openUrl`; the host or export adapter opens the address: an ad network adapter calls the
network's click macro, a web host opens the address in a new tab if its host profile lists `openUrl` among its
grants. Behaviour never names an address.
**[files]**, **[playing]**

**Ad lifecycle.** An ad needs a few moments it can report, and no code of its own to do it.

- The built-in experience output `firstInput` (5.12) is reported once per run, at the first trusted press, key press or
  pointer-down in the player. A press on the click area reports `firstInput` before `openUrl`. The page sends it as
  the move `firstInput` (9.6) when that input begins, before the press runs; a restart starts a new run. It is a move
  because it changes the logic state (9.6.1) and what a host hears, and a pointer-down on a part of the drawing that
  is no control reaches no other move. A replay feeds it again.
- The host delivers two player-level signals, `self:visible` and `self:hidden`: the player's box is at least half in
  view, or it is not. `self` is a core signal kind (5.12) with the hooks `visible` and `hidden`, so `signal:self:visible`
  parses as kind `self`, hook `visible`. They are core events, owned by no capability, granted under `signals` (10.5)
  and heard as the events `signal:self:visible` and `signal:self:hidden`. `self:visible` and `self:hidden` fire when
  the player's box crosses half in view (an intersection ratio of 0.5), and once at mount with the starting state.
- **Measurement is the adapter's.** The ad adapter maps `entered`, `firstInput`, `openUrl` and these two signals to the
  network's measurement of impressions, viewability and clicks. Content holds no measurement code and no identifiers.
  **[playing]**

**Hosting strangers.** A platform checks and packs uploaded source itself; it never publishes uploaded HTML as a
trusted page. It serves each experience from its own origin, in an iframe, with a response-header policy that keeps the
packer's limits and adds `frame-ancestors` and `sandbox allow-scripts` (never `allow-same-origin`). Storage may then
be missing; play continues in memory with the save fallback. **[review]**

## 10.5 Grants

A grant is a permission; an add-on (10.7) is an ability a block needs: a module or capability is named in `needs`
(10.11), a preset in `presets` (12.3). A need is never a
permission.

A **grant** allows something across a trust boundary. Grants are **closed by default**. The experience lists the grants
it asks for; the host profile lists the grants it gives, in the same shape. Asking is the author's statement of
intent, which a host reads before mounting. Grants are written, with two exceptions the packer derives from use
(D31.4): a `player.openUrl` call asks for `openUrl`, and a `session` or `saved` value asks for that `storage` scope. The
packer writes these asks into the package, and the check report shows them. The host still decides. Add-on grants
(page, AI, seats) stay written: they reach outside the page. The effective grant is the intersection,
by exact name: names the host does not give are simply absent, and a use of one fails at that use. A kind is
refused only when the experience asked for it and the host gives none of its names, or omits or sets it to `false`.
Content never grants itself anything.

**No host profile, no grant.** A page mounted with no host profile is given no grant. Every kind it asks for is
refused and counts as optional, because no host is there to refuse the mount: the page plays, and a use of a refused
grant fails at that use. A packed page that needs a grant is mounted with a host profile (`pack ... --host <profile>`).
The dev player (`engine/v2/web/index.html`, unpacked) is the author's own preview: it plays as the author's host and
gives the experience the grants it asks for (`?host=none` gives none). A packed page never does this. "Grants are
written, never derived" still holds, with only the two packer asks above (D31.4).

| Grant kind | Names | Example |
|---|---|---|
| `storage` | Storage for the `session` and `saved` lifetimes (5.1.2) | `["session", "saved"]` |
| `signals` | The player's own `self:visible` and `self:hidden` (10.4) | `["self:visible"]` |
| `openUrl` | Opening the addresses of `player.openUrl` calls (10.4) | `true` |
| `network` | Reserved, a 2.1 draft (`drafts/delivery-2.1.md`): named requests to addresses the host configures. 2.0 defines no named request, so this grant allows nothing yet | `[]` |
| an add-on's kind | `ai`, `fillers`, `hooks`, `pageActions` and `widgets`: the kinds the built-in add-ons use | see the add-on's page |

The list of grant kinds is closed. An add-on's manifest names the kinds it uses in `grants` (chapter 12), from this
list only: `storage`, `network`, `fillers`, `signals`, `pageActions`, `hooks`, `widgets`, `openUrl` and `ai`. An
add-on cannot bring a kind of its own (`E-ADDON`).

```json
"grants": {
  "storage": ["session", "saved"],
  "signals": ["self:visible", "self:hidden"],
  "openUrl": true,
  "optional": ["storage"]
}
```

- **Refusal.** A grant kind listed in `optional` may be refused: links that need it are ineligible, actions that need
  it do nothing and are reported, values that need it keep their fallbacks. Any other refused grant refuses the mount
  (`E-GRANT`). **[playing]**
- **Use.** Every use of a crossing (a signal heard, an add-on's call that crosses) names a granted name; the
  checker refuses names the experience does not ask for (`E-GRANT`). **[files]** The engine checks again at use.
  **[playing]**
- **Withdrawn.** When a `storage` grant is withdrawn, stored values fall back to `run` and are not written again
  (5.1.2). **[playing]**
- **No inheritance.** The scenes and the shell have the experience's grants: they are its own behaviour. A block used
  inside them gets only the grants its use passes down, by name:
  `{"id": "helper", "use": "page-helper", "into": "captions", "grants": {"storage": ["session"]}}`, in the
  experience's shape. A use passes down only grants its own block has (`E-GRANT`). **[files]**
- **Human only.** The human-only actions of 5.15.4 (`player.openUrl`, `player.setting` except turning `voice` off, and the calls an
  add-on's manifest marks `humanOnly`) need a person's trusted activation. Programs, agents, timers, links and AI answers
  cannot cause them (`E-HUMAN-ONLY`, `W-HUMAN-ONLY-PATH`). **[files]**, conservatively, and **[playing]**.

## 10.6 The host API

The host talks to a mounted player through one small API. It reaches only the experience's four faces, never its body
(decision 1).

```js
import {mount} from '@hypersvg/core/mount';
import {loadSchemas} from '@hypersvg/core/schemas';      // Node; a browser host serves the schema objects itself
const schemas = loadSchemas('node_modules/@hypersvg/core/spec/2.0');
const player = mount(container, experiencePackage, {schemas, host: hostProfile});
const off = player.on('ended', ({name, detail}) => showReplay(detail.scene));
player.on('answers', ({detail}) => platform.track(detail));   // one call per record row
player.set('visitorName', 'Robin');   // an input: content field or knob
player.picture('productPhoto', bytes, 'image/png');   // a picture for a picture place (D40)
player.emit('start');                 // a trigger on the inputs face
player.read('bestScore');             // a declared output result, or an input
player.pause('host');                 // add a host pause reason (3.10)
player.resume('host');                // clear it
player.timeLimits(2);                 // the person's time limits: 0 off, 1 as written, 2..10 multiplies (10.13)
player.scene('stage');                // the id of the scene in a stage slot
player.ladder();                      // a read-only copy of the layout read-out: per block, frame, tier, steps
player.restart();                     // a new run: `run` values reset, `start` entered; inputs keep their values,
                                      // those the host set too
player.clearStorage();                // delete the stored values of the current partition (5.1.2)
player.setPartition('learner-42');    // end writes to the old partition; restore the new one as a new run
off();
player.destroy();
```

- `mount(container, package, options)`: `package` is a map from member path to bytes (`Uint8Array`) that includes
  `package.json` (the `experiencePackage` above). The options are `schemas` (required: the schema objects of
  `spec/2.0/schemas`, as `loadSchemas` gives them; a mounted package is checked before it plays, 10.12), `host` (the
  host profile), `options` (`{<axis id>: <option>}`: the option the host picks on each axis
  whose selector is `host`, 7.1), `partition` (an opaque string that keys stored values, 5.1.2; `device` when absent),
  `onError` (the host's error callback `onError({code, message, source})`, below), `timeLimits` (the person's time
  limits at start, 0 or 1..10, 5.5; a value between 0 and 1 stops the start with `E-RANGE`) and `test`
  (test mode, A8.5). Each
  option is checked against its axis (`E-AXIS-INPUT`). A host profile may give defaults for `options` (A10.1).
  Added after `2.0.0-next.0`: `faultBox` (`false`: the player shows no fault message; `onError` still hears it) and
  `nonce` (given to every `<style>` the player adds, for a page with a strict Content Security Policy). Also taken,
  experimental (10.16): `capabilities` (the host ports by capability: `aiPort`, `pagePort`, `modulePort`, exported
  from `./mount`, 10.7), `modules` (the capability records to use; without it, those the page registered) and
  `widgets` (a 2.1 draft). **[playing]** Added after `2.0.0-next.0`: `hostWords` (`{language, words}`) gives the words of one language the
  package has none for. Each id is one of the package's default-language word ids; each text is plain text, at most
  twice its default word's length (at least 24, at most 400 characters); else `E-WORDS`. That language is the
  ambient language from the start. The checker never saw these words, so they are fit only at play time (7.6, 8.4).
  **[playing]** Added after `2.0.0-next.0`, for replay (9.6): `clock`, a function `(engineMs) => UTC ms`, is the wall
  clock that `now` reads (5.5); it is called with the engine time, and without it the browser's clock is read.
  `onMove`, a function, hears every move `{t, source, payload}` before it runs (9.6). A hook that throws goes to
  `onError` and the move still runs. The HyperSVG mounts take both too. **[playing]**
  **Experimental**, added after `2.0.0-next.0` (D65): `colors` (`{<colour role>: '#rrggbb'}`) gives the host's own
  colours for some or all of the experience's colour roles, checked at mount against the contrast rules of a declared
  theme, all or nothing (7.7.1). A set that fails is not used: the author's theme stays, and `onError` hears
  `W-HOST-COLOR-CONTRAST` (the pair, the theme, the ratio) or `W-HOST-COLOR-VALUE` (an unknown role, a value that is
  not a six-digit hex colour). With `theme`, the theme applies first, then the colours. The HyperSVG mounts take it
  too. **[playing]**
- `logic(source, options)` (added after `2.0.0-next.0`, the package export `./logic`) plays with no page: story,
  runtime and formulas; no drawing, no sound, no measures. `source` is a package, checked as `mount` checks it (it
  needs `options.schemas`), or a checked experience. The options are `clock`, `epochMs` (a fixed date at engine time
  0, instead of a clock), `onMove`, `host`, `options`, `capabilities`, `modules`, `storage` and `onError`. It returns
  `feed(move)` (advance to the move's time, then run it; a `door` move is skipped with `{ok: true, ignored}`),
  `start()`, `advance(ms)`, `read(name)`, `heard` (each output event, record and built-in output: `{t, name,
  detail}`), `fingerprint()` (9.6.1), `state()` (the state document) and `host` (this API, without a page). It runs
  in Node 20 and in a browser. **[playing]**
- `set` writes a declared input as one play-time change with source `host` (A9.7): type, bounds and rules, never
  clamped. A refused change throws before any write and leaves the player usable. A content field takes a tier or
  language object (7.9) as `setInput` does; each wording is checked. A changed input is heard as `changed:<name>` and
  the uses whose `with` or `items` read it are evaluated again (4.5). **[playing]**
- `picture(name, bytes, type)` hands in a picture while the page runs (D40). `name` is a content input of the
  experience whose `contentType` is `picture` (5.3.1); `bytes` is a `Uint8Array`, copied at the call; `type` is
  `image/png`, `image/jpeg` or `image/webp`. The engine checks the type against what the bytes show (their signature
  and header), the bytes against `imageBytesEach` (8 MiB) and the decoded size against `imagePixelsEach` (16
  megapixels), as raised by the experience's `limits` where its host allows (A10.8). A picture is checked data, never code:
  SVG, HTML and any other type are refused. A refused picture throws `E-HOST-PICTURE` and changes nothing. A taken
  one is kept under the input's name, and the input holds `host:<name>`, as one change with source `host` (`changed:<name>`
  is heard). A picture place, an `<image>` part with a `variant` binding `as` `picture` that reads the input (6.8),
  shows it as a `data:` address (a packed page allows images from `data:` and `blob:` only). A later picture under the
  same name replaces it. Only `picture` names a host picture: `set` refuses a `host:` value (`E-TYPE`). Example:
  `{"target": "photo", "variant": "productPhoto", "as": "picture"}`. **[playing]**
- `emit` fires a declared trigger, with a payload only when the trigger declares one. It is not a simulated click;
  controls keep their own admission (visible, enabled). **[playing]** It returns a promise (added after
  `2.0.0-next.0`) that resolves once the trigger's reactions have run and its listeners were called, with
  `{name, payload, outputs}`: the output events and records that step sent, each `{name, detail}`. It does not wait
  for clips or timers. A refused call still throws at the call.
- `onError` always hears `{code, message}` (D63), with `source` and, when known, `address`, `path` or `diagnostics`.
  A failure with no code of its own, such as a listener that throws a plain error, is `E-HOST-ERROR`. **[playing]**
- `on` hears declared output events, including `entered` and `ended` (3.2), and records: one call per row, with the
  row and its `atMs`, `seat` and `filler` as the detail (5.16). The callback runs after the event's
  reactions and bindings, with a frozen copy of the detail. A shell's declared output events (10.1) reach `on(name)`
  as the experience's do. A built-in output is heard by its bare name or as `hsvg.<name>`; one added after 2.0 is
  heard and read only as `hsvg.<name>` (5.9). `hsvg.changed` (D45) hears every change of an input, whoever made it: a
  host `set`, a person's drawn control or setting (5.11), a settings form. Its detail is `{name, value, by}`, with `by`
  the change's source (`host`, `person`, `widget`). A `freeText` field is not heard. So a host panel stays in step with
  the drawing: the latest change wins. There is no replay. A listener runs in the deliver phase
  of its transaction (9.2). A listener that throws is reported to the host's error callback (`onError`) and does
  not stop the player. **[playing]**
- `read` returns a copy of an output result or an input. Body values cannot be read, and neither can a `freeText`
  field (5.3.1): both are refused with `E-HOST-PRIVATE`. An unknown
  name is `E-REF-UNKNOWN`. A refused call throws `{code, message}`. The `on` callback gets `{name, detail}`.
  `read` returns the stored value: a tiered field reads as its tier or language object. A host reads the wording
  shown with `ladder()`. **[playing]**
- `place(name)` (added after `2.0.0-next.0`, in a page that mounts a package or a HyperSVG) returns the box of a place
  that the scene on the stage, or its shell, lists in `places` (4.3): `{x, y, width, height}` in CSS pixels from the
  top left of the document, or `null` while it is not drawn. Another name is `E-REF-UNKNOWN`. **[playing]**
- `ladder()` returns a read-only copy of the ladder's read-out: for each block on screen, its frame, its tier, its
  give-way steps and its texts. It is the same read-out as the ambient `layout` value (7.1). **[playing]**
- An add-on may add host calls in its own page (the `seats` add-on adds `seat`).
- A host call made during a transaction's deliver phase is handled as 9.2 says.
- `setPartition(id)` ends writes to the old partition and restores the new partition's stored values as a new run
  (5.1.2). `setPartition('device')` ends a learner or account partition. An id is 1 to 128 characters of
  `A-Z a-z 0-9 . _ -` (`E-RANGE`). **[playing]**
- `clearStorage` clears the current partition's stored data, resets `saved` values and knob values to their initial
  values, then restarts; other partitions stay alone (5.1.2). **[playing]**
- `timeLimits(factor)` sets the ambient `timeLimits` (5.5) as one change with source `host`, checked as a person's
  setting is: 0, or 1 to 10. It applies at once to the waiting timed links and machine timers (10.13). **[playing]**
- `pause(reason)` and `resume(reason)` add and clear one named pause reason; time moves when every reason is clear.
  `scene(slot)` returns the id of the scene that slot shows.
- `destroy` releases the drawing, clocks, listeners, held page elements and subscriptions. Calls after destroy or a
  fatal stop are refused (`E-HOST-CLOSED`). **[playing]**
- **Ranges in manifests.** Where a range is given only in an add-on's manifest, the manifest
governs; the text and the manifest are kept in step.
- **Agents use the same door.** An MCP or WebMCP adapter lives in the host and maps tool calls to this API. It never edits SVG nodes and never runs agent code. Without WebMCP the drawn experience still works.
  **[review]**

In `hsvg/0.1` a host could read and set any shared value. In 2.0 it reaches only the faces: an experience exposes what
the host may change as inputs and what it may hear as outputs. A host profile may narrow this further (A10.1). Page
code hears the experience's output events the same way, through `on`; there is no separate "host event" action.

A host page that shows a packed page in a sandboxed iframe reaches this API through the **frame link**, a message
link keyed by a random token (the tool reference, A10.4).

### The door to the outside (D25, D40)

An experience meets the outside world through the core door only: values in (inputs the host `set`s, triggers it
`emit`s, pictures it hands in with `picture`) and events out (outputs the host hears with `on`), through the host API
or the frame link. An add-on may bring outside data in through the same door (the `live-data` add-on: rows a host
feeds, checked against a table). Add-ons (logic modules, capabilities, presets) are chosen and fingerprinted when the
experience is made, never handed in while it plays. The closed box is permanent in the base (D40): runtime import of
SVG, parts or code is outside the standard. It may be built privately, as a layer outside the base that a file names
in `needs`.

## 10.7 Capabilities

The core is closed (D27, 1.12). Everything else is an **add-on**, ours or anyone's, and every add-on uses one door.
The registries call a built-in add-on a **capability** (`capabilities.json`, a manifest of kind `capability`). The
door:

- `needs` names it (10.11);
- its settings sit in its pocket, `"addons": {"<name>": {...}}`;
- its actions are calls, `{"call": "<name>.<verb>", "with": {...}}`;
- its events are heard as `<name>:<event>` or `<name>:<event>:<subject>`, in `on` maps and on story links (3.3).

Chapter 12 is the door's contract (12.5): the door's version (`"door": 2`; a door 1 manifest keeps working), what
a manifest declares (`keys`, `calls`, `events`, `writes`, `draws`, `contentTypes`, `grants`), the hooks the engine
takes (`calls`, `timer`, `mount`, `entered`, `hold`, `keep`), the exact list of the outside engine door (`id`,
`settings`, `write`, `emit` with a subject, `read`, `now`, `def`, `entryKey`, `fault`, `timers`), `attach({door})`
with style handles for parts and slots, and the words the checker refuses in add-on code. Content never supplies code. Built-in add-ons have bare
names; outside add-ons are named `owner.name` (12.1). The registry `capabilities.json` lists every built-in
name and what it owns. Each built-in capability and module (its code, its manifest `spec/2.0/capabilities/<name>.json` and its own page)
comes with the hypersvg-addons release (D30), not with the core. The core ships four built-in presets (12.3). The core chapters do not describe them; the table below names each one.

| Built-in | What it adds |
|---|---|
| `effects` | particle effects |
| `motion` | the `morph` channel |
| `physics` | bodies, throws and contacts |
| `synth` | a mouth that follows loudness (made sounds are core, 6.10) |
| `rich-text` | runs with text styles, linked text parts, read-along |
| `lines` | spoken lines, word times, mouth cues, captions |
| `fit` | layout plans, resize kinds, baking |
| `ladder` | give-way rules while playing |
| `widgets` | HTML widgets in shell slots: forms, tables, choices, settings |
| `page` | page hooks, page signals and page actions on someone else's page |
| `seats` | players, turns, legal moves, agents and programs |
| `ai` | AI sources and character seats |
| `live-data` | rows a host feeds |
| `snapshot` | saving a picture of a part |
| `media` | recorded video |
| `chess`, `chess-opponent` | logic modules: chess rules and a computer opponent |

**The door to the outside.** The door to the outside world is the core door: values and pictures go in and events
come out through the host API (10.6), plus add-ons such as `live-data` for rows a host feeds. Add-ons are chosen and
fingerprinted when the experience is made. Runtime import of SVG, parts or code is outside the standard (D40).

A name that is in no registry and no add-on folder is `E-NEEDS-UNKNOWN`. Seats on different devices
(`remote-seats`) are a 2.1 draft (`drafts/remote-seats-2.1.json`).

**Three contracts.** Each built-in is one of three classes, named in `contract` in `capabilities.json`.

| | Module | Privileged | Engine |
|---|---|---|---|
| Examples | `chess`, `chess-opponent` | `page`, `synth`, `widgets`, `media`, `ai`, `live-data` | `seats`, `fit`, `ladder`, `rich-text`, `lines`, `physics`, `effects`, `motion`, `snapshot` |
| What it is | Pure code content calls: typed inputs and outputs only | Reviewed host code that receives host ports (below) | Built into the engine and reviewed with it |
| In `needs` | Its exact version (`chess@0.1.0`), pinned by digest | Its name; the host pins it in its reviewed lock | Its name |
| How it runs | Synchronous calls within a time budget of at most 1000 ms and a step budget (12.4) | In the host, under the engine's checks | In the engine |

**Host ports.** The engine checks each port against the experience's grants (10.5) before a privileged add-on sees
it: page (the page grants), storage (`storage`), audio output (always allowed, under the person's mute and volume),
timers (always allowed, on the engine clock), and network (only addresses the host configures for an add-on; content
never names an address).

**Sizes.**

- Each add-on's runtime bundle is at most 10,000 bytes gzip level 9, measured on the built bundle
  (`capabilityBundleBytes`). A logic module counts as an add-on bundle.
- The core player's bundle (the packed page's engine without capabilities) is at most 120,000 bytes gzip level 9
  (`coreBundleBytes`).
- The audio code (sound and music, 6.10) is not in the core player's bundle. Added after `2.0.0-next.0`. A packed
  page carries it only when one of its documents declares a sound resource or a made sound (`audioSynths`); without
  one, nothing can sound. It counts like an add-on bundle (`capabilityBundleBytes`). Sound stays core: it needs no
  `needs` entry. A HyperSVG page loads it the same way, only for a file that uses sound (10.14).
- The built bundle is the engine as a packed page carries it: each engine module without its comments, a logic module
  exactly as its reviewed file (D19). An engine over either limit is `E-ENGINE-SIZE`.
- A module call runs within a declared time budget of at most 1000 ms (12.4).
- Add-on code is trusted code, not a sandbox: the host's reviewed lock pins each by digest (D26).

## 10.8 Run packed

The packer checks the experience, then writes **one offline HTML file**: the core player, the add-ons `needs` names,
and every file embedded. The page carries a script-hash Content Security Policy with network access denied. It opens
from `file:` and makes no network requests. The packer has checked every file, so the page carries the parsers and no
checker; a kit experience is flattened into the form the player plays. A packed page vouches only for itself: a host
serving strangers' packages checks and packs them itself, one origin per experience (10.4).

```sh
node engine/v2/tools/pack.mjs <experience folder> <out folder>
```

**Asked grants in the package (D31.4).** The packer writes the grants the experience asks for into `package.json`
(`grants`): the written ones and the two it asks for from use (`openUrl`, and the `storage` scope a `session` or
`saved` value needs, 10.5). The check prints `ASKS openUrl, storage saved: requested from use, written by the packer;
the host decides (10.5)` when something was asked from use. A packed page gets a grant only from its host profile
(`--host <profile>`, 10.5). **[files]**, **[playing]**

The package format, served play, conformance levels and host profiles are in the tool reference (A10).

## 10.11 `needs`

`needs` is the first half of the door (10.7). This is the one rule for it.

1. Block definitions, kits and experiences list the modules and capabilities they need in `needs`; a preset is named
   in `presets`, never in `needs` (12.3). A logic module and an outside add-on carry their exact version
   (`chess@0.1.0`, `acme.noughts@1.0.0`, `example.glow@1.0.0`); a built-in capability is named without one. The package's `needs` is the
   union. A use is covered by its own document's `needs`. The experience's `needs` (with its kit's) also cover the
   experience, its scenes and its shell. A block definition names its own, so it works in any experience.
   `E-NEEDS-MISSING` **[files]**, **[playing]**
2. The checker derives needs from content: an add-on is needed when content uses words its manifest owns (its pocket,
   its calls, its events, a binding it draws). A missing need fails (`E-NEEDS-MISSING`); an unknown name fails
   (`E-NEEDS-UNKNOWN`); a declared but unused need is a warning (`W-NEEDS-UNUSED`). A built-in add-on of the
   registry that this release does not hold is still named when content uses it: the checker warns
   (`W-ADDON-ABSENT`), knows its words by name from the registry, and the packer refuses it (12.1). **[files]**
3. A need is a requirement, never a permission. What crosses a trust boundary is decided by grants (10.5).
4. New words enter only through an add-on's manifest, in the door's fixed places (chapter 12). Core names cannot be
   overridden (`E-CAPABILITY-GRAMMAR`). A manifest for another door is refused (`E-CAPABILITY-FORMAT`).
5. A `needs` entry is an add-on name, a module's pinned name, or `font:<family>` for a host font (2.6). A text
   binding's own `fit` (7.6) is core and needs nothing.

## 10.12 The checker

The checker proves what can be proven from files. The engine proves the rest at mount and while playing (9.7):

| When | Run by | Proves |
|---|---|---|
| **on files** (`files`) | the checker | headers, keys, references, types, bounds, formula grammar and budgets, range proofs over whole input ranges, seals and digests, the rights table, kit versions and pins, closure, package integrity, the upgrade report of an upgraded file (A13.3), budgets on actual bytes, references to private terms |
| **at mount** (`playing`) | the engine, before and after mounting | admission against the host profile (A10.1); then every drawn target in every frame, variants, pivots, motion ranges, slots, attach points, writers after aliases |
| **while playing** (`playing`) | the engine | every write, formula, budget, drain, module result, grant and human-only check |

Passing one never proves the next. Play tests (A8.5) and reviews (A9.3) are the other proofs (A11.9).

### Diagnostics

```json
{
  "code": "E-RANGE",
  "severity": "error",
  "file": "experiences/round-cliff/experience.json",
  "line": 12,
  "column": 54,
  "pointer": "/story/scenes/depart/with/windStrength",
  "address": "round-cliff/depart/windStrength",
  "definition": {
    "file": "kits/robin-delivery/blocks/ride-out.json",
    "line": 9,
    "column": 5,
    "pointer": "/inputs/windStrength",
    "address": "ride-out/windStrength"
  },
  "reason": "windStrength 6 is above the maximum 4.",
  "fix": "Use a value from 0 to 4, or ask for a kit version with a wider range."
}
```

1. Each diagnostic has `code`, `severity`, `file`, `line` and `column` (1-based; left out for a whole-file problem
   such as a missing member), `pointer`, the nearest stable `address`, `reason` and a concrete `fix`. `reason` is the specific sentence for this finding; `fix` may be the code's general fix from `errors.json`. `pointer` is a JSON Pointer; in SVG it is the element id; in CSV it is
   `row:column`. `rule` names the rule when one failed.
2. **Use site and definition.** A problem found at a use names both: the use site in the main fields, the definition
   in `definition`.
3. Severities: `error` fails; `warning` never fails and marks something likely wrong; `note` reports a `should` rule
   (A11.5) or a feature an export did not carry. Errors and warnings carry a code (`E-`, `W-`); a note carries `rule` or
   `feature` instead.
4. Static defects fail before packing. Defects found while playing stop the affected experience with the same code.
5. Exit codes: 0 pass (warnings and notes allowed), 1 invalid content or an `incomplete` output, 2 a usage or file access error.
   A kit tool may check a kit experience against another version of its kit without moving its pin (`--against-kit
   <id>@<version>`, A14.2); the receipt names that version in `kit` (A14.1). The base's checker does not take this
   option: it reads a kit from a folder (`--kit <kit folder>`) and compares a kit with its earlier version
   (`--previous-kit <kit folder>`, `E-KIT-VERSION`).
6. `--json` prints diagnostics as a list. Editors and tools print an unchanged formula exactly as written. Tools that rewrite a file never drop data they do not understand; they
   report it. A file that only passes a JSON schema is not admitted: the checker's rules decide.

## 10.13 The accessibility contract

Authors write no ARIA (6.5). The engine gives every drawing its accessible structure from the marks and the JSON, and
this section says what a person can count on. **gap** marks what 2.0 does not do yet. Scene changes are announced, and time limits, dragging and reduced
motion are handled (below).

| Need | What the engine does | Status |
|---|---|---|
| **Controls** | Each control target gets its role, a tab stop and its ARIA state: `button`, `radiogroup` with `radio`, `slider`, a grabbable item (5.11). A hidden or disabled control leaves the focus order; a disabled one that has focus keeps it and is announced as unavailable. | built |
| **Accessible names** | A control's name is its `label`, else its target's `data-hsvg-label`, else the text of its only `<text>`; a control with none is refused (`E-A11Y-NAME`). A drawing is named by its `<title>`; a fitted text keeps its full text as its name; `backdrop` and `decoration` paint is hidden (6.5). | built |
| **Focus order** | Document order of control targets, uses expanded in place; the shell adds its slots in drawing order (10.3). | built |
| **Focus after a scene change** | After a plain link: the scene's `firstFocus` control if set and usable, else its first usable control. After a visit: the visited scene's first usable control. After a return: the control that started the visit if still usable, else the caller's previous one, else its first. Focus moves only if it was in the player (3.7). | built for a plain link, `firstFocus` included; the finer rules after a visit and a return are a gap (3.7) |
| **Focus in dialogs** | A dialog opened by a person takes focus to its first usable control; Tab stays inside; closing returns focus to the control that opened it (10.3). | built |
| **Announcements** | A text part with the role `feedback` is a polite live region: its text is announced when it changes or becomes visible (6.5). A control's state changes (pressed, selected, a slider's value) are announced through its ARIA state. | built |
| **Scene changes announced** | The new scene's title (its drawing's `<title>`) is announced in a polite live region when a link enters it. The first scene is not announced: the page itself is read then. | built |
| **Timed links and timers** | Timed links and machine timers keep their timing under reduced motion (3.4, 5.14). The person's `timeLimits` setting (5.5) covers them: 0 turns them off, 1 keeps them as written, 2 to 10 multiplies them. A change applies at once to the timers that are waiting: each keeps the written time it has left, multiplied by the new factor. Clips, markers, lines, transitions and effects are motion, not time limits, and keep their own time. A scene that moves on by itself should also offer a control that waits or goes on (review). | built |
| **Dragging** | Every drag has a keyboard path: Enter or Space picks up and drops, arrows move between drops, Escape cancels (5.11). Every drag also has a single-pointer path (WCAG 2.5.7): a tap picks up and holds; the next tap drops on the place under it, or on none, with the same `accept` and events; that tap presses nothing else. | built |
| **Hit targets** | Each control target is at least 44 CSS pixels each way at the smallest supported size (rule `hit-target`, A11.10). | checked by review (`not-run`) |
| **Reduced motion** | The ambient `reducedMotion` follows the system or the person's setting (5.5). A clip with `finish` (the default) shows its final pose at once, `rest` its first key; markers and `ended` still fire at their times. A clip whose motion is the meaning (a demonstration) says `"reducedMotion": "keep"` and plays normally (6.7). A `glide` jumps; a `slide` or a `fade` transition becomes a `cut`; a text that counts up shows its value at rest. A channel or points binding reads `elapsed` as at its block's first paint, so it holds still; text, visible, variant and colour bindings read the live clock. Timers never change. | built |
| **Colour and sound** | Colour is never the only signal; what is heard is also shown, and captions show with sound off (6.5, 6.10). | review |
| **Keys** | A player hears keys only while focus is inside it, or while nothing has focus and it was used last. Tab and Escape are never control keys (5.11). | built |

## 10.14 HyperSVGs (D45)

One base, one format, two outputs. A whole experience packs into one offline HTML page (10.8). A reusable asset
(2.13) packs into one HyperSVG:

```sh
node engine/v2/tools/pack.mjs --asset <asset folder> <out folder>     # writes <out>/<id>.svg
node engine/v2/tools/unpack.mjs <id>.svg <folder>                     # gives the folder back
```

`pack --asset` runs the checker first and refuses on any error, as any pack does. `unpack` checks every member's
digest before it writes, refuses a folder that is not empty (unless `--force`) and never writes outside the folder.

**Placing an asset.** A HyperSVG plays when a page loads the shared player (the package's `./asset`,
`engine/v2/web/asset-web.mjs`) and places it:

```html
<script type="module" src=".../engine/v2/web/asset-web.mjs"></script>
<hypersvg-asset src="car.svg" length="1.4" colour="ocean" roof-open><img src="car.svg" alt="A roadster"></hypersvg-asset>
```

```js
import { mount, sharedSchemas } from '@hypersvg/core/asset';
const car = mount(element, svgText, { length: 1.4, colour: 'ocean' }, { schemas: await sharedSchemas() });
car.on('hsvg.changed', (e) => panel.show(e.detail));   // {name, value, by}
car.on('engineStarted', () => {});                       // the asset's own output events
```

Serve the page over http or https: the player fetches the asset and the package's schemas. A plain browser does not
resolve a package name such as `@hypersvg/core/asset`. Use the module's own address (for an installed package,
`./node_modules/@hypersvg/core/engine/v2/web/asset-web.mjs`), or a bundler or an import map. See
`docs/browser-embedding.md`.

- `mount(element, assetSvg, inputs, options)` is the host API's mount (10.6) for a HyperSVG. It returns the host
  API, plus `inputs()`: each input's `name`, `kind`, `type`, bounds (`minimum`, `maximum`, `step`, `enum`,
  `maxLength`), `initial` and current `value`. Any host, tool or experience builds a knobs panel from it; a panel is
  not part of the base. It also has `outputs()`: each output event and record of the asset, `{name, kind}` with
  `kind` `event` or `record`, the names `on` hears. `inputs` are the inputs' values at the start, checked by type and
  bounds (`E-TYPE`, `E-RANGE`, `E-REF-UNKNOWN` for a name the asset does not declare).
- The `<hypersvg-asset>` element's attributes set the declared inputs by name (case does not matter; `roof-open`
  sets `roofOpen`): a number is read as a number, a boolean is true when present unless `"false"`, text as written.
  A change of attribute sets the input again; removing it gives the declared initial value back. The element has
  `ready` (a promise of the host API), `inputs()`, `set`, `read` and `on`. It sends `hsvg:changed` for every change of
  an input and `hsvg:<name>` for each of the asset's output events and records, as DOM events, and `hsvg:error` for a
  refusal or a fault, with `code` and `message` always (10.16). Until it plays it shows what it holds, such as an
  `<img>` of the same file.
- **Stored values.** Each placed copy keys its stored values by a partition (5.1.2, 10.6), `asset-<id>` by default, so
  two copies of one HyperSVG on a page share their stored values. The `partition` option of `mount` and `mountAsync`,
  or the element's experimental `partition` attribute (10.16), keeps them apart. A HyperSVG mount takes no host
  profile, so it is given no storage grant (10.5): its stored values last for the run until a host gives storage.
- **Experimental**, added after `2.0.0-next.0` (D65): the element's `colors` attribute gives the host's colours
  (7.7.1) as `role: #rrggbb` entries separated by semicolons: `colors="accent: #bf360c; on-accent: #ffffff"`. Its
  `colors` property reads the attribute as an object and sets it from one (`null` removes it). A change places the
  file again. A refused set is heard as `hsvg:error` with its warning code; the HyperSVG plays in its author's
  colours. If the HyperSVG has an input named `colors`, the attribute sets that input instead, as for `theme`.
- **The latest change wins.** The host (an attribute, `mount`'s inputs, `set`) and a person (a drawn control whose
  `value` names the knob, 5.11) change one knob. Every change takes effect and is heard as `hsvg.changed` (10.6), so a
  host panel stays in step with the drawing.
- **Many assets, one player.** Every asset on a page shares one copy of the player's code and of the schemas. Each
  placed asset is its own experience with its own state, keys and focus.
- **Safety stays as it is.** Nothing new arrives while a page plays (D40). The player checks what it is handed
  before anything plays: the record and every member's digest (a changed file is refused), the safety pass below,
  then every document and drawing with the schemas, as mount checks a package (10.12). An asset with anything a packed
  asset cannot hold is refused (`E-ASSET`), and nothing plays. A HyperSVG holds no script; a drawing with one fails
  the drawing check.

**Placing an asset with integrity (D56).** Added after `2.0.0-next.0`. A host that checked a HyperSVG once with the
full checker may skip that check on its pages. It stores the file's integrity value (2.13) on its server and places
the file with it:

```html
<script type="module" src=".../engine/v2/web/asset-lean.mjs"></script>
<hypersvg-asset src="car.svg" integrity="sha256-..." length="1.4"></hypersvg-asset>
```

```js
import { mountAsync } from '.../engine/v2/web/asset-lean.mjs';
const car = await mountAsync(element, svgBytes, { length: 1.4 }, { integrity: 'sha256-...' });
```

- **The trust rule.** The fingerprint the host stored is the trust anchor, never a digest inside the file.
- The value is one or more `sha256-<base64>` tokens separated by spaces; any one may match. Anything else is
  `E-ASSET-INTEGRITY`.
- The player hashes the file's exact bytes with the browser's Web Crypto and compares. On a match it reads the record
  and the members, runs the safety pass and plays, with no schema check: the page needs no schemas and loads no
  checking code. On a mismatch it refuses with `E-ASSET-INTEGRITY`: nothing plays, and nothing of the file shows (D58).
- A page without Web Crypto (not served over HTTPS or from localhost) hashes with a plain SHA-256. It gives the same
  value, so a match skips the schema check there too (D58).
- `mount()` stays as it is: synchronous, with the full check. `mountAsync(element, asset, inputs, options)` is its
  asynchronous twin: `asset` is the file's bytes or its text (hashed as UTF-8), and `options` adds `integrity`.
  Without `integrity` it checks as `mount()` does and needs the schemas.
- `asset-lean.mjs` (the package's `./asset-lean`, D58) is the element and `mountAsync` without the checker. It loads the checker and the schemas only for
  a file placed without integrity. `asset-web.mjs` (the package's `./asset`) has all of it, with `mount()`.
- A refused element keeps what it holds. A file that does not match shows nothing of itself: the host never approved
  it (D58). A file that matched but is refused later, with nothing held, shows as a still picture: an `<img>` with a
  `blob:` address, which runs no script and loads nothing. Markup from a refused file never enters the page.
- `integrity` is the element's own attribute, as `src` is: it never sets an input, and a change places the file again.

**A HyperSVG that pins a capability (D55).** Added after `2.0.0-next.0`. A HyperSVG may name `effects` or `physics` in
`needs`, pinned by version and digest (2.13). `mountAsync` and the element load the module only when a placed HyperSVG
names it, on both paths:

```html
<script type="module" src=".../engine/v2/web/asset-lean.mjs"></script>
<hypersvg-asset src="party.svg" integrity="sha256-..."></hypersvg-asset>
<hypersvg-asset src="ball.svg" integrity="sha256-..." addon-base="https://cdn.example/hypersvg/addons/"></hypersvg-asset>
```

```js
const party = await mountAsync(element, svgBytes, {}, { integrity: 'sha256-...', addonBase: '/hypersvg/addons/' });
```

1. The player reads the needs of every document of the asset and the pins of `experience.json`. A need that may not
   load this way, or that is not pinned once, is `E-ASSET`; nothing is fetched.
2. It fetches `<id>-<version>.mjs` from the **add-on address**: the option `addonBase` or the attribute `addon-base`
   (a relative address is the page's), by default the package's own `engine/v2/web/addons/`. A file it cannot fetch
   is `E-ADDON-MISSING`.
3. It hashes the exact bytes and compares them with the pin. A difference is `E-ADDON-DIGEST`.
4. It runs those same bytes from a `blob:` address, so what runs is what was checked. The module imports nothing. Its
   default export is the capability record. One that is not that capability (another id, a page part, no install) is
   `E-ADDON-DIGEST`. A page whose Content Security Policy does not allow `blob:` in `script-src` cannot run it:
   `E-ADDON-MISSING`.
5. The engine installs the record for this placed asset only (10.7). It is not registered in the page.

- Without `integrity`, the full check also needs the capability's grammar. The player fetches
  `spec/2.0/schemas/capabilities/<id>.schema.json` beside the core schemas when the host's set lacks it. The one-file
  player holds the core schemas and fetches only that one.
- A page loads each module once per address and digest: many HyperSVGs that pin the same version share it.
- A refusal shows the rest pose: the element keeps what it holds, or, with integrity and nothing held, the still
  picture.
- `mount()` is synchronous and cannot load code, so it refuses a HyperSVG with a need (`E-ASSET`), as before.
- `addon-base` is the element's own attribute, as `integrity` is.

**Sound only when used.** Added after `2.0.0-next.0`. `mountAsync` and the element load the audio code only for a
HyperSVG that declares a sound resource or a made sound, before it plays, so its first sound plays at the first press
as before. The synchronous `mount()` keeps the audio code with it.

**The safety pass.** It runs before every asset plays, with or without integrity, and needs no schemas. On the full
path it runs before the schema check, so a file that both refuse reports the safety pass's code. It is a part
of the drawing check (2.11): a drawing that passes the drawing check passes it. For every drawing of the asset:

1. The drawing is well-formed XML with no DOCTYPE, entity declaration or processing instruction (`E-SVG-PARSE`).
2. The root is `<svg>` in the SVG namespace (`E-SVG-ROOT`).
3. Every element is in the allowed subset of 2.11, with no namespace prefix: no `<script>`, `<foreignObject>`,
   `<style>`, `<a>`, animation element or `<feImage>` (`E-SVG-UNSAFE`, as are the rules below).
4. No attribute starts with `on`: no event handler.
5. The only namespaces are SVG and XLink; the only prefixed attribute is `xlink:href`.
6. `href` is a local `#id`; on `<image>` it is a `data:` URI of an image type, read as a browser reads an address.
   An asset holds no picture file, so it names nothing outside itself.
7. Every `url(` is `url(#id)`.
8. CSS text holds no `@import`, no comment, no backslash escape and no image function that can load an address.

## 10.15 The HyperSVG record, byte by byte (D45)

This section defines the HyperSVG (2.13) exactly, so a host in any language can read, verify and re-pack one without
the engine's code. The conformance files in `spec/2.0/conformance/hypersvg/` test a reader against it: each file has
its expected result in `expected.json` there.

**The file.** A HyperSVG is UTF-8 text: the drawing, with one line put in.

1. Before the root `<svg>` start tag there may be only a byte order mark, one XML declaration (`<?xml … ?>`) and
   comments, each followed by optional white space. Nothing else, not even a DOCTYPE.
2. The line goes right after the `>` that ends the root start tag. It is a line break, then `<metadata>`, then the
   record's JSON, then `</metadata>`. The line break is CR LF when the drawing's text after the start tag begins with
   CR LF, and LF otherwise. Nothing else in the drawing changes.
3. Taking the line out, from its line break to the end of `</metadata>`, gives the drawing's exact bytes back.

**The JSON.** One object with one key, `asset`. Its value is an object with exactly these five keys:

| Key | Value |
|---|---|
| `format` | `"hsvg/2.0"` |
| `id` | The experience's `id`, matching `^[A-Za-z0-9][A-Za-z0-9._-]*$`. The file is named `<id>.svg`. |
| `drawing` | The folder path of the drawing the file is: the start scene's `drawing`, joined to the folder of the scene's file. |
| `members` | An object: every file of the asset, the drawing too, mapped to its digest. |
| `files` | An object: every member but the drawing, mapped to its text as a JSON string. |

A writer writes the keys in the order above, the keys of `members` and `files` sorted by UTF-16 code units, and no
white space between tokens. It writes every `<`, `>` and `&` as `<`, `>` and `&` (lowercase hex). These
characters only occur inside JSON strings, so the escaped text is the same JSON; the record holds no markup and needs
no XML escaping. A writer that follows these rules gives the same bytes as `pack --asset`. A reader does not depend on
the order or the white space; it needs only that the text between `<metadata>` and `</metadata>` holds no `<`.

**Paths.** Each key of `files` and `members` is a plain relative path: segments joined by `/`, each segment made of
`A`-`Z`, `a`-`z`, `0`-`9`, `_`, `.` and `-` and starting with a letter, a digit or `_`
(`^[A-Za-z0-9_][A-Za-z0-9._-]*(/[A-Za-z0-9_][A-Za-z0-9._-]*)*$`), and no segment `..`. So an absolute path, a
backslash or a `..` is refused: `E-ASSET`. A writer writes `drawing` the same way. A reader that writes the files out
(`unpack`) also refuses any path that would leave its folder.

**Digests.** A member's digest is `sha256:` followed by 64 lowercase hexadecimal digits: the SHA-256 (FIPS 180-4) of
the member's exact bytes, as for a package's members (10.8). The bytes are:

- for a file in `files`: the JSON string's value, decoded, then encoded as UTF-8 (no byte order mark added, line
  endings as they are);
- for the drawing: the HyperSVG's text with the line taken out, encoded as UTF-8.

**Limits.**

- The whole HyperSVG is at most `dataBytesEach` bytes (8,388,608) as UTF-8. A host may set a lower limit. A larger
  file is `E-ASSET`, before anything else is read.
- Every member is text. `pack --asset` writes the `.json`, `.svg` and `.csv` files the experience reaches. The asset
  player refuses a member whose name ends in anything but `.json`, `.svg`, `.csv`, `.txt` or `.vtt`, an asset with no
  `experience.json`, and one whose `needs` is not empty: `E-ASSET`.
- There is no separate limit on the number of members; the size limit covers it.

**Reading.** A reader takes these steps in order and stops at the first failure.

1. The file is within the size limit. Otherwise `E-ASSET`.
2. Find the end of the root start tag (rule 1 of the file). The text right after it is the line: a line break (CR LF
   or LF), `<metadata>`, text with no `<`, `</metadata>`. Otherwise `E-ASSET`: the file is no HyperSVG.
3. The JSON parses to an object whose only key is `asset`; `asset` holds no key but the five; `format` is
   `hsvg/2.0`; `id` matches its pattern; `drawing` is a string; `members` and `files` are objects. Otherwise
   `E-ASSET`.
4. `files` does not hold `drawing`; each of its values is a string and each of its keys a plain relative path.
   Otherwise `E-ASSET`.
5. The drawing's text is the HyperSVG's text with the line taken out.
6. Every name in `members` is a key of `files` or is `drawing`, and every key of `files` and `drawing` is in
   `members`. Otherwise `E-PACKAGE-MEMBER`. Every member's bytes match its digest. Otherwise `E-PACKAGE-DIGEST`.
7. The drawing holds no `<metadata>`: an asset's drawing carries no tool record of its own (2.13). Otherwise
   `E-ASSET`. Added after `2.0.0-next.0`.

The result is the `id`, the `drawing` and every member's text.

**What the digests prove.** The digests catch accidents, not tampering: a file damaged on the way, cut short, or
changed by a tool that did not re-pack it. Anyone who changes a file can make the digests again
(`resealed-script.svg` in the conformance files is one). A digest inside a file is never a reason to trust it. So a
reader that plays a HyperSVG also runs the checker (10.12) on every document and drawing it returned, as the asset
player does, and plays nothing when it finds an error. Only a fingerprint the host keeps itself, outside the file, can
say that a file is the one the host trusted.

**Re-packing after an edit.** A host that changes a member, for example a cleaner that removes an attribute:

1. reads the file as above;
2. changes the members' text;
3. writes the file again with the same `id` and `drawing`: the drawing, then the line, with every digest made again
   from the new bytes, written as above. The drawing must not hold a `<metadata>` of its own;
4. checks the files again (10.12). New digests only say that the record matches the files. The check says whether the
   files are still valid: `repacked-cleaned.svg` passes, `repacked-cleaned-mark.svg` (a removed `data-hsvg-motion`)
   does not.

`unpack`, an edit and `pack --asset` on the folder do the same; the packer checks first. The packer also refuses a
drawing that already has a tool record (`E-ASSET`), and the reader refuses a hand-made one (step 7,
`drawing-has-record.svg`).

## 10.16 The stable API (D63)

Added after `2.0.0-next.0`. This section says which parts of the JavaScript API, the command line and a packed page
a host may build on for all of 2.x. `engine/v2/tests/api1-stable.test.mjs` lists every name below and fails when a
stable name is removed or renamed.

**The three labels.**

| Label | Promise | Changes allowed in 2.x |
|---|---|---|
| **Stable** | Kept for all of 2.x (D42). | Only additions: a new optional option, a new method, a new member in a result. Never a rename, a removal or a changed meaning. |
| **Experimental** | Usable, and documented as experimental. | May change in a minor version, with a note in the changelog. Promoted to stable after real use. |
| **Internal** | Not for outside code. | May change at any time, even when a file exports it. |

**The rule.** Stable is what shipped in `2.0.0-next.0` and is documented, what a decision already made stable (D60),
and the simple safety options (`integrity`, `nonce`, `faultBox`). Experimental is everything else new since
`2.0.0-next.0`, and anything that belongs to an add-on. Internal is building blocks and the tools' inner parts. A
name this section does not list follows the rule: new since `2.0.0-next.0` means experimental.

**Package entry points** (`@hypersvg/core/…`).

| Entry | Stable | Experimental | Internal |
|---|---|---|---|
| `./asset` | `mount`, `mountAsync`, `HyperSvgAsset` (the `<hypersvg-asset>` element), `useSchemas`, `sharedSchemas`, `readAsset`, `VERSION`, `elementVersion` | `repack` | — |
| `./asset-lean` | `mountAsync`, `HyperSvgAsset`, `useSchemas`, `sharedSchemas`, `VERSION`, `elementVersion` | — | `place`, `leanLoad`, `bundleCheck` |
| `./mount` | `mount`, `VERSION` | `aiPort`, `pagePort`, `modulePort` (the host ports, 10.7) | — |
| `./logic` (D60) | `logic`, `fingerprint`, `fingerprintOf`, `stateDocument`, `canonicalJson` | — | the `player` member of `logic()`'s result |
| `./frame-host` | `connectFrame`, `frameToken` | — | — |
| `./schemas`, `./schemas/*` | `loadSchemas`; the schema files under `core/` | the schema files under `capabilities/` and `addons/` | — |
| `./pack` (Node) | `pack`, `packAsset`, `PackError` | — | everything else (`bundle`, `engineSizes`, `bakePlans`, `flattenKit`, …) |
| `./player` | `VERSION` | `play` | `boot`, `useAudio`, `chooseFrame`, `learnFits`, `reducedUnder`, `linkWithoutHostLine` |
| The one-file player `engine/v2/web/hypersvg-asset.js` | — | the file and its exports (those of `./asset`) | — |

**Options.**

| Where | Stable | Experimental | Internal |
|---|---|---|---|
| `mount()` of a package (10.6) | `schemas`, `host`, `options`, `partition`, `onError`, `timeLimits`, `faultBox`, `nonce`, `clock`, `onMove` | `theme` (D66), `hostWords`, `colors` (D65), `modules`, `capabilities`, `widgets` (a 2.1 draft) | `test` |
| HyperSVG mounts (`mount`, `mountAsync`, 10.14) | `schemas`, `partition`, `onError`, `timeLimits`, `integrity`, `faultBox`, `nonce`, `clock`, `onMove` | `theme`, `options`, `hostWords`, `addonBase`, `colors` (D65) | `test`, `modules` |
| `logic()` (D60) | `schemas`, `clock`, `epochMs`, `onMove`, `host`, `options`, `storage`, `onError` | `capabilities`, `modules` | — |
| `connectFrame()` | `channel`, `timeout`, `probe` | — | — |
| `pack()` | — | `host`, `allow`, `kits`, `test`, `acceptFindings` | `sizes`, `date` |

**The host API** (what a mount returns, 10.6).

| Stable | Experimental | Internal |
|---|---|---|
| `on`, `read`, `set`, `emit` (a promise, D59), `picture`, `timeLimits`, `pause`, `resume`, `paused`, `scene`, `restart`, `clearStorage`, `setPartition`, `destroy`; on HyperSVG mounts `inputs()` and `outputs()` | `place(name)`, `seat()` (the `seats` add-on), `ladder()` (the `ladder` add-on) | `internal` (test mode) |

The frame link (`connectFrame`, A10.4) carries these calls as stable: `set`, `emit`, `read`, `pause`, `resume`,
`restart`, `scene`, `clearStorage`, `setPartition`, `on`, `off`, `close` and `ready`.

**The `<hypersvg-asset>` element** (10.14).

| Stable | Experimental |
|---|---|
| The attributes `src`, `integrity` and `fault-box`; the `nonce` property; any other attribute sets the input of that name (lower case or kebab case) | The attributes `theme`, `addon-base`, `partition` and `colors` (D65), and the `colors` property |
| `ready`, `host`, `inputs()`, `read()`, `set()`, `on()`, the static `version` | — |
| The events `hsvg:changed` `{name, value, by}`, `hsvg:<output>`, `hsvg:error` (always `code` and `message`; other fields optional) | — |
| `data-hsvg-refused` on a refused element; `<img data-hsvg-still>` for an approved file that was refused later | — |

- `hsvg:error`'s detail, and what the host's `onError` hears, always has `code` and `message`. A failure with no code
  of its own, such as a listener that throws a plain error, is `E-HOST-ERROR`. The optional fields: `source` (where
  it happened: `start`, `control`, `listener`, `storage`, `audio`, `destroy`, …), `address` (the block of a fault
  while playing), `path` (a sound that cannot play) and `diagnostics` (the findings of a refused file).
- `partition` (experimental) names the partition that keys this copy's stored values (5.1.2, 10.6): 1 to 128 of
  `A-Z a-z 0-9 . _ -`, else `E-RANGE`. Without it every copy of one HyperSVG on a page uses `asset-<id>`, so copies
  share their stored values. If the HyperSVG has an input named `partition`, the attribute sets that input instead.

**Built-in outputs, the move hook and the clock.**

| Stable | Experimental |
|---|---|
| `entered`, `ended`, `openUrl`, `firstInput`, `hsvg.changed`; a built-in added later is heard only as `hsvg.<name>` (5.9) | `hookHealth` (the `page` add-on) |
| `onMove(move)` with `{t, source, payload}`, the sources of 9.6's table (D62) except `seatInput`, `clock(engineMs)` | the `door` move, `seatInput` (the `seats` add-on, D66) and the add-ons' moves (`ai.arrive` and those of the `page`, `media`, `snapshot` and `seats` add-ons) |

The state document's inner shapes are pinned per engine version (D62), not frozen across 2.x: the fingerprint API is
stable; its values may change between versions.

**The command line** (`hypersvg`).

| Stable | Internal |
|---|---|
| `init`, `check` (`--json`, `--review`), `test` (`--quick`, `--node-only`, `--min-width`, `--browser required`, `--json`, `--out`), `pack` (`--asset`, `--allow`, `--test`), `unpack` (`--force`), `addon new\|check\|digest\|pin`, `--version`, `--help`; the exit codes (0 pass, 1 findings or an error, 2 usage); the shape of `check --json` | the flags the tools read but the help does not list (`--only`, `--paint`, `--speed`, `--baseline`, …) |

**A packed Experience page.**

| Stable | Internal |
|---|---|
| `window.hsvg` (the host API), `window.hsvgReady`, `window.hsvgError` | the test-only address hooks (`?clock=manual`, `?start=`, `?partition=`) |

## Moved out of this chapter

| Was | Now |
|---|---|
| The frame link (in 10.6) | A10.4 |
| 10.8 Packages | A10.5 |
| 10.9 Run packed and run served | 10.8 (run packed); A10.6 |
| 10.10 Conformance levels | A10.7 |
