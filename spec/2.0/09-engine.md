# 9. The engine

The **engine** runs all blocks of one experience together. Each experience has **one store, one queue and one
clock** (decision 5); shell, stage slots, scenes and every use share them. This section is the engine's contract.

Rules end with their check: **[files]**, **[playing]** or **[review]**, as in section 5.

## 9.1 Store

The store holds every value, input and computed cache of every live block, and the run state of behaviour: active
machine states, timer deadlines, attachments, clip runs and add-on runs, repeat keys, visit stacks and graph memory.
Nothing else holds state.

## 9.2 The execution model

**One event at a time, to completion.** The engine handles one **source** at a time, in one **transaction**, and
finishes it before the next starts. A source is one of: a person's input, a host call (10.6), an add-on's input (a
seat, a widget, an answer), a timer or timed-link deadline, a clip marker or end, an ambient change (`now`, `size`,
`language`, `inputMode`, `reducedMotion`), or a tick that repaints bindings reading `elapsed`. Sources never overlap.
Nothing in content is asynchronous: what comes later (an AI answer, the end of a video) arrives as a new source.

**The steps of one transaction.**

| Step | What happens |
|---|---|
| 1. Queue | The source's event is queued. |
| 2. Hear | The next event is taken from the queue (first in, first out) and given to the block that hears it: its machines in list order (5.14), then its root `on` (5.13). In each, the first reaction whose guard passes runs. A scene's outcome then goes to the story graph (3.3). |
| 3. Act | The chosen actions run in list order. Each write is checked (type, bounds, rules) before it is stored, and the computed values that read it are updated before the next action reads them. |
| 4. Follow | Emitted events are queued in order. After each action list, one `changed:<name>` is queued per value that differs from before the list (deep JSON equality), in order of first write. Then the `with` inputs of uses that read a changed name are evaluated again, all inputs of a use at once, and their `changed:` events are queued after the parent's, in declaration order. |
| 5. Repeat | Steps 2 to 4 repeat until the queue is empty. |
| 6. Bindings | Binding formulas are evaluated on the result; a fault rolls everything back (below). Today the engine does this for changes from the host, an editor or an add-on's input; for other sources it evaluates bindings when it paints, and a fault there stops the experience. Bindings have their own step budget, apart from the transaction's formula steps. |
| 7. Commit | The store is published once; its revision rises by one. The starts and stops of clips and add-on runs are part of the store. |
| 8. Deliver | The deliveries run, each list in scheduling order: stored writes; add-on actions; sounds; listener calls (`on` callbacks of 10.6, record rows included). |
| 9. Paint | Bindings repaint once per tick or manual clock step, never inside a transaction. |

Steps 1 to 6 are the **compute** phase, step 7 is the **commit**, step 8 the **deliver** phase. Step 9 only paints.

**Order.**

- **Within a block:** machines in list order, then the root `on`; within a reaction, actions in list order (5.13 to
  5.15).
- **One event, many blocks.** An event sent to many blocks at once (a trigger on the experience's inputs face, a key,
  an ambient change, a `changed:` of an experience value) is queued once per block that hears it, in the order the
  blocks were mounted: the shell, then the scene in each stage slot, each parent before its uses. It counts as one
  event toward the cap.
- **Entry and exit.** A block's uses mount before it, so a use's `entry` list runs before its parent's; then the
  parent's root `entry` runs, then its machines enter in list order (9.5). On exit, timers are cancelled first, then
  the machines exit in reverse list order, then the root `exit` runs.
- **A link** fires inside the transaction that handles its outcome (3.2): the rest of the current action list runs,
  then the leaving scene runs its exit lists and its other queued events are discarded.

**When derived values recompute.**

| What | When |
|---|---|
| Computed values (5.2) | Before the next read after any name they read changes. They form an acyclic graph; a cycle is refused (`E-CYCLE`, files). |
| A use's `with` inputs (5.3) | In step 4, after the action list that changed a name they read. |
| Output results and `uses['x'].<output>` (5.4) | When read: they are formulas over the block's own names, so a parent always reads the current value. |
| Bindings (6.8) | In step 6, then painted in step 9. A binding that reads `elapsed` is evaluated again at each tick. |

A cycle through uses (a parent's `with` reads a child's output that reads that input) is refused when the checker can
see it (`E-CYCLE`, files); at play it is cut by the event cap.

**Caps on chained events.** One transaction may run at most **100 events**, **4096 actions**, **1,000,000 formula
work steps** (5.6.6), **100 deliveries** and **1,000 deadlines** at one engine millisecond (9.8). Going over any of
them faults with `E-EVENT-LOOP`. The caps follow the chain of causes, not the number of blocks: one event sent to many
blocks counts once.

**When something fails or a budget runs out.**

| Where | What happens |
|---|---|
| Compute phase: a refused write, a formula fault, a cap or budget passed, a failed module call, a human-only refusal | The **whole transaction rolls back**: store, machine states, timers, attachments, visit stacks, graph memory, queued events and deliveries. Nothing partial is published. |
| ... and the source was the host, an editor or an add-on's input | The change is refused with its code; the experience goes on (10.6, 9.9). |
| ... and the source was anything else (a control, a timer, a marker, an add-on event) | The experience **stops** with a visible message naming the code, the owner's address and the field. Later sources are refused (`E-HOST-CLOSED`). |
| Deliver phase | The commit stands. A failed stored write emits `save:unavailable` (5.1.2). A failed add-on action ends with its failure event. A host listener that throws is reported to the host's error callback and does not stop the player. |
| A host call during the deliver phase | `read` answers at once from the published store. A call that changes state (`set`, `emit`, `restart`, `clearStorage`, `setPartition`, `scene`) is queued as a new source and runs after the current transaction. |
| A logic module's step budget | The call faults (`E-MODULE-RESULT`) and its transaction rolls back (12.4). A module that never counts steps is stopped too: the loader meters its loops and function bodies (12.4). |

**[playing]**

## 9.3 One writer, and who drives a channel

Each value has one writer (5.1.3). Each drawn property of a target (its transform channels, opacity, variant, colour,
stroke dash, text) has **one driver**: a binding, a clip lane, a drag, an attachment, or the add-on that paints it
(`draws`, chapter 12). Two drivers on one property are refused, so no precedence rule is needed. `E-WRITER` **[files]**
The checker proves this from the files; the engine trusts the checked files and does not check it again at mount.

- Ownership is resolved after dotted addresses, repeated uses and every frame. A mirror (a `scale` on `axis` `x` of −1 or 1,
  6.8) applies after the channels and does not drive the x scale. `scale` owns both scale axes; a drag or an add-on
  that moves bodies owns the whole transform; `draw` owns the stroke dash.
- **One hand-over is allowed.** An add-on that speaks may take a mouth's variant from its usual driver while a line runs
  and give it back when the line ends (the `lines` add-on).
- **Rest and reduced motion.** When a clip stops or reduced motion asks for rest, the property goes back to its
  drawn value, or to the binding that drives it.

## 9.4 One clock and local time origins

- One **engine clock** in whole milliseconds per experience. Play tests use a manual clock (A8.5).
- Each stage slot, scene and component use has a **local clock** with its own origin, and optional pause and speed,
  as 3.10 defines. `elapsed` reads it; timers, clips, effects and timed links count on it.
- All deadlines of all owners form **one chronological schedule**, in the owner order of 3.10. Before any deadline
  runs, every active local clock advances to it and motion is sampled. One large step and many small steps give the
  same events and motion. Cancelled work never fires. **[playing]**
- An add-on that steps a simulation (the `physics` add-on, 120 Hz) runs every fixed step that a clock advance covers,
  however large the advance; it has no catch-up cap. **[playing]**
- A visit stops the calling scene's clock and keeps its timers' remaining time; return resumes it (3.7).
- Pause reasons add up (3.10); every one must clear before time moves. Reduced motion never changes timer timing.
  **[playing]**

## 9.5 Lifecycle

- **Mount:** create the store, restore `session` and `saved` values and graph memory, mount the shell, enter the
  start or resume scene (3.8).
- **Entry or creation:** set values, run root `entry`, enter machines in list order, settle the queue, paint
  once. No link leaves a scene before its first paint (3.2).
- **Exit or removal:** cancel timers, stop clips, add-on runs and sounds, release holds and drags, run exit lists.
- **Destroy:** release timers, observers, listeners and media; repeating destroy after a failure is safe. **[playing]**

## 9.6 Deterministic replay

With the same files, the same fixtures (A8.5) and the same input log (every source with its engine time and payload,
host replies and AI answers included), the engine produces the same store, events, records, captions and drawing at
every step. **[playing]**

- A `freeText` payload (5.3.1) is logged by length only, never by its words.
- Randomness comes only from seeds (5.6.5). The wall clock is read only as `now`. The network is reached only through
  logged host replies. Easing and fixed-step effects are exact algorithms.
- Bitwise equal floating-point results across different JavaScript engines are not promised for effects and physics.

**Moves.** Added after `2.0.0-next.0`. The input log is a list of moves, in order. A move is one JSON object
`{"t": …, "source": …, "payload": […]}`: `t` is the engine time in ms when the input reached the logic, `source` names
the input (the table below), and `payload` holds its arguments as JSON values, a missing one as `null`. A host hears
each move before it runs, with the option `onMove` (10.6). An input made while another one runs is part of that move
and is not heard again: the start inside a restart, an input a listener makes during that step. A clock advance is not
a move: what the clock fires follows from the moves and their times.

| `source` | `payload` | The input |
|---|---|---|
| `start` | `[ambient]` | The start (3.2). `ambient` is the ambient values it starts with (5.5): settings, language, size. |
| `restart` | `[]` | A new run (10.6). Engine time is 0 again. |
| `clearStorage` | `[]` | The partition's stored data cleared (10.6). The restart after it is a move of its own. |
| `activate` | `[address, control, arg, source, actor]` | A control used (5.11): a press, an option, a slider value, a drop. |
| `hold` | `[address, control, down, source]` | A press, slider or drag held or let go (5.11). |
| `snap` | `[address, control, drop]` | A snap drag at rest on `drop`, or home with `null` (5.11). |
| `key` | `[code, up, source]` | A key of the fixed set, or its release (5.12). |
| `send` | `[address, name, payload, source]` | An event a widget sends to a block. |
| `trigger` | `[name, payload, source]` | A trigger of the experience (10.6 `emit`). |
| `setInput` | `[name, value, source]` | An input written (10.6 `set`, a form, a knob). |
| `hostPicture` | `[name, address]` | A host picture taken, as its `data:` address (10.6 `picture`). |
| `applySettings` | `[[[name, value], …], source]` | A settings form's Apply, or `timeLimits` (5.3.2, 10.13). |
| `setPause` | `[reason, on]` | A pause reason added or cleared (3.10). |
| `setSize` | `[{shape, width, height}]` | The player box (5.5). |
| `setLanguage` | `[language]` | The language an axis picks (7.1). |
| `motion` | `[on]` | The system's reduced-motion preference changed (5.5). |
| `closeDialog` | `[slot]` | A dialog a person closed (10.1). |
| `shellEvent` | `[name]` | A shell widget's event (10.1). |
| `pick` | `[link]` | A choice link picked (3.5). |
| `firstInput` | `[]` | The first trusted press, key press or pointer-down in the player in this run (10.4). The page sends it before the press itself; the engine reports the output `firstInput` once per run and ignores a later one. |
| `seatInput` | `[actor, name, payload]` | A seat's input (A4.1). Experimental: it belongs to the `seats` add-on (10.16). |
| `ai.arrive` | `[key, how, answer, intent]` | An answer to `ai.ask` arrived (A5.1). `how`: `ai` (a host AI source answered), `failed` (it failed), `late` (its time limit passed, for typed words) or `builtIn` (a built-in answer matched from typed words). For typed words, `intent` is the intent they matched, or `null`; otherwise it is left out. |
| `door` | `[add-on, source]` | Another add-on's step that has no move of its own. It has nothing to feed again. |

**Add-on moves.** Experimental. An add-on's step that comes from the page or the host is a move named
`<add-on>.<name>`, with its payload, so a replay feeds it again. `ai.arrive` above is one.

| `source` | `payload` | The input |
|---|---|---|
| `page.health` | `[status]` | The page reported its hooks' status, `{hook: "found" \| "missing" \| "ambiguous"}` (A3.1). |
| `page.signal` | `[name, payload]` | A granted page signal, `<kind>` or `<kind>:<hook>`, with `{hook}` or `{progress}` (A3.1). |
| `page.cut` | `[owner, id]` | A pointing or highlight mark cut short on the page (A3.1). |
| `media.report` | `[address, place, kind]` | A video place's news: `stalled`, `failed` or `refused` (A2.1). |
| `snapshot.status` | `[address, value, text]` | The host's status for a snapshot, at most 200 characters. |
| `seats.fill` | `[seat, filler]` | A player seat filled from outside: by the host, or an agent joined (`agent`) or left (`null`) (A4.1). `filler` is `human`, `agent`, `program` or `null`. A fill made by a time limit's fallback is the clock's, not a move. |

- A move never holds the identity behind a seat, nor typed words: an `ai.arrive` for typed words carries the intent
  they matched and the answer it gave.
- An answer matched from typed words arrives as its own step, just after the asking step, so the words never enter
  the state. A replay that is fed moves makes no such answer itself: it waits for the fed `ai.arrive`.

- The `source` inside a payload is the step's source of 9.2 (`person`, `host`, `widget`, `seat`). It is left out when
  the input gives none.
- A `freeText` value is written `{"freeText": n}`, with `n` its length in UTF-16 code units. A replay feeds `n` letters
  `x`.
- **Feeding.** A replay plays the same files with the same fixtures, host profile, grants, stored values, module lock
  and clock. For each move it advances the engine clock to `t`, then runs the input with its payload. The logic-only
  entry does this without a page (10.6).
- **The clock.** The host's clock is called with the engine time and gives UTC ms. A clock that gives a fixed date plus
  the engine time makes `now` replay exactly; the browser's wall clock does not.
- **What a replay proves.** These moves, from this start, are legal and give this result, step by step (9.6.1). It
  does not prove that a person made them. It cannot replay what needs a page: layout measures (the ambient `layout`,
  layout plans while playing), sound and voice timing, the video itself and the snapshot's picture. What the page
  reports to the logic (hook health, page signals, a video place's news, a snapshot's status) is a move and replays.
  Effects and physics are exact only on the same kind of engine. Typed words decide only through the `ai` add-on, and
  what they decide is in the `ai.arrive` move.

### 9.6.1 The state fingerprint, byte by byte

Added after `2.0.0-next.0`. The state fingerprint says whether two players are in the same logic state. A replay
compares it after every move. A host in any language makes it in three steps: the state document, its canonical
bytes, their SHA-256. The files in `spec/2.0/conformance/state/` test a writer: `expected.json` there gives each
file's fingerprint, the UTF-8 length of its canonical JSON and, for a short one, the canonical text.

**The state document.** One JSON object. It holds the logic state only: what the next step depends on. The drawing,
sound and page measures are not in it.

| Key | Value | Why it is in |
|---|---|---|
| `now` | The engine time in ms. | Timers and `elapsed` count from it. |
| `seq` | The next timer sequence number. | It orders deadlines due at the same time. |
| `blocks` | Every mounted block, by its address (4.5): its record, with `kind`, `def`, `parent`, `values`, `inputs`, `machines` (the active states), `uses`, `clips`, `attach`, `born`, and when present `snaps` and an add-on's run state. | The store, and what each block runs. |
| `timers` | Every waiting deadline, in the engine's order: its owner, its due engine time and what it fires. | Deadlines make the next steps. |
| `records` | Each record's rows (5.16). | Later rows and reads depend on them. |
| `ambient` | The ambient values (5.5), except `layout`. | Formulas read them. |
| `story` | The story's place: `current`, the visit `stack`, link `counts`, `visits`, `resume`, the scenes painted, held outcomes, and the pause and chapter notes. | The next link depends on it. |
| `pauses` | The host's pause reasons, in the order given (3.10). | Time moves only when they are clear. |
| `firstInput` | `true`, only once the run has reported `firstInput` (10.4). | A later one is ignored. |
| `stopped` | The stopping fault's code, only when the player stopped (9.2). | A stopped player takes no input. |

- Left out: the step count (`revision`), the last step's outputs and deliveries (heard by listeners, never read by the
  next step), the list counter (the drawing's), the ambient `layout` (a page measure), the stored data (its values are
  in `blocks`) and a host picture's bytes (the input holds `host:<name>`).
- A `freeText` value is `{"freeText": n}`, as in a move.
- An add-on's run state is in its block's record, under the add-on's id. The `seats` add-on's (A4.1), on the
  experience block, holds `occupants`: each player seat's filler, `"human"`, `"agent"`, `"program"` or `null`. It
  never holds the identity behind a seat. A new run starts with the occupants the last one had. The `ai` add-on's
  never holds typed words: a pending answer to typed words is marked `typed`, and one whose time limit passed `late`.
- The shapes inside a block record, a timer and the story are the reference engine's. The conformance files show them.
  An engine in another language keeps the same shapes to give the same fingerprint.

**The bytes.** The state document's canonical JSON (RFC 8785, the JSON Canonicalization Scheme), encoded as UTF-8
with no byte order mark and no line break at the end:

1. Object keys are sorted by their UTF-16 code units.
2. No white space between tokens.
3. Numbers are written in the ECMAScript form: `1e+21`, `1e-7`, `0.1`, `100`; `-0` is `0`.
4. Strings are written as JSON with only `"`, `\` and the control characters U+0000 to U+001F escaped: `\b`, `\t`,
   `\n`, `\f`, `\r`, else `\u00xx` in lowercase hex. Every other character is itself.

JCS is a published standard with writers in many languages, and in JavaScript it is `JSON.stringify` with sorted keys.

**The digest.** `sha256:` and the 64 lowercase hexadecimal digits of the SHA-256 (FIPS 180-4) of those bytes, as a
package member's digest (10.8). The fingerprint is compared, printed and stored; it never goes in an `integrity`
attribute, so the `sha256-` base64 form of 10.14 brings nothing here.

### 9.6.2 Whole-play test files

Added after `2.0.0-next.0`. The files in `spec/2.0/conformance/plays/` test another implementation of the logic layer
against the engine, play by play (D57, D62). Their format is `hsvg-play/1`; the folder's `README.md` gives it key by
key. `engine/v2/tools/make-plays.mjs` writes them from the engine, and the engine's tests feed every file again.

- **One file, one play.** A file names its package (an example folder every core export holds, with each file's
  SHA-256 and the add-ons it pins), how the play starts (the clock's start `epochMs`, the host's inputs, the stored
  values), the moves of 9.6 in order, and after every move the state fingerprint (9.6.1), the outputs heard and,
  when the input was refused or ignored, why. After the last move the clock runs on to an end time, and the file gives
  the fingerprint and the whole state document there.
- **Passing.** An implementation passes a file when it plays the same package from the same start and gives the same
  fingerprint, outputs and result after every move and at the end. A package file with another digest is another
  package: the file does not apply.
- **What the plays hold.** Scripted plays (wins and losses, timers that run out, a restart, clips, choice controls,
  host inputs, sizes, pauses, keys) and seeded random walks. A play of a package that pins an add-on
  needs a port of that add-on's code too.
- **What a file never holds.** A `door` move: it has no payload to feed again (9.6). Layout measures, sound and voice
  timing and video places are not moves at all.
- The files are made by the engine of the same release. A later engine version may change the state shapes; its
  files show the change.

## 9.7 When checks run

Checks run as the two proof kinds of A11.9. `files` checks run in the checker; `playing` checks run in the engine at
mount and while playing.

At mount the engine checks what the files alone cannot: every target resolves in every frame, and variants, pivots,
motion ranges and slots exist. While playing it checks every write, formula, budget, drain, module result,
grant and human-only path. What each one proves is listed in 10.12. Passing one never proves the next. A host profile (A10.1) says which capabilities a host runs.

## 9.8 Engine limits

| Limit | Value |
|---|---|
| Events per transaction | 100 |
| Actions per transaction | 4096 |
| Deliveries per transaction | 100 |
| Marker crossings of one clip at one engine millisecond | 100 |
| Live repeated uses per block | 256 |
| Formula work steps (5.6.6) per transaction, all formulas together | 1,000,000 |
| Live timers and timed links per experience (one more faults with `E-EVENT-LOOP`) | 1,024 |
| Deadlines run at one engine millisecond | 1,000 |
| Effects per block | 16 |
| Live particle copies per block, all its particles effects together | 256 |
| `delayMs` and clip `durationMs` | 1..3,600,000 |
| Live block uses per experience | 2,048 |
| SVG elements across all mounted drawings | 200,000 |
| Mount depth (a use inside a use) | 16 |
| Decoded image pixels | 16 megapixels per image, 64 in total |
| Filter surface | The sum of the filter regions of all filtered elements, in player-box pixels, at most 4 times the player box area |
| Stored data | UTF-8 bytes of the stored JSON per partition: 1 MiB `saved`, 4 MiB `session` |

Every limit of this table is in `limits.json`, the one list of every format limit. It says which ones a host may raise,
and how (the tool reference, A10.8). The last six rows are aggregate limits. Going over one when the experience or new art mounts is `E-MOUNT-LIMIT`. While
playing, the transaction that mounts the new art faults with `E-MOUNT-LIMIT` (9.2). Restored stored data over its
limit is not a mount fault: it is ignored with `save:invalid` (5.1.2). A transaction whose `saved` or `session` values
would pass the stored-data limit faults in compute with `E-MOUNT-LIMIT`; this is checked before commit, never in
the deliver phase. **[playing]**

## 9.9 Changes from outside

Every change from outside, from an editor, an agent, the host, a server or a test, passes the same checks as a change
from inside: type, bounds and rules, then grants while playing and editor rights while making (1.1, principle 4). One
request shape serves them all: the changes protocol, in the tool reference (A9.7). A refused change writes nothing.

## Moved out of this chapter

| Was | Now |
|---|---|
| 9.8.1 Where limits live, and raising them | A10.8 |
| 9.9 Editor rights | A9.6 |
| 9.10 The changes protocol | A9.7 |
