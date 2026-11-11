# 5. Faces and body

This section defines a block's faces and body: its **values** (body state), its **inputs** (part of its outside),
its **output values**, the **ambient inputs** the engine provides, the one **formula** language used for every
condition, computed value and text template, the places and controls a drawing offers, and **behaviour**: events,
reactions, machines, actions and records.

Rules end with the check that proves them: **[files]** (the checker, from the files alone), **[playing]** (the engine
while it plays, or a play test: the `playing` proof kind of A11.9) or **[review]** (a person). The checker is 10.12;
every code is in `errors.json`.

## 5.1 Values

A **value** is named, typed, bounded state with an initial value and a lifetime. Values live in a block's body, in
the `values` map. The map key is the value's name.

```json
"values": {
  "score":     {"type": "number", "initial": 0, "minimum": 0, "maximum": 3},
  "picked":    {"type": "string", "enum": ["", "left", "right"], "maxLength": 5, "initial": ""},
  "bestScore": {"type": "number", "initial": 0, "minimum": 0, "maximum": 3, "lifetime": "saved"}
}
```

- Value names match `^[a-z][a-zA-Z0-9]*$`, have at most 48 characters and are not reserved (5.9).
  `E-NAME-SHAPE`, `E-NAME-RESERVED` **[files]**
- Every value declares `type`, `initial` and the bounds its type requires. `initial` is literal JSON, never a formula,
  and must satisfy the bounds. `E-KEY-REQUIRED`, `E-TYPE`, `E-RANGE` **[files]**
- There is no null stored value, no implicit coercion and no default cell. Use a bounded empty string for missing
  text. **[files]**
- Every write is checked against the type and bounds before it is stored. A failing write is refused and never
  clamped; it faults the transaction (9.2). Write `clamp(...)` to keep a number in range. **[playing]**
- A write that can never fit is refused before play: a `set ... to` or a choice option's `value` whose proven range
  lies wholly outside the value's bounds (`{"set": "score", "to": 5}` with maximum 3), or whose texts are all longer
  than its `maxLength`. A formula that may fit (`score + 1`) is left to the player. `E-RANGE` **[files]**
- Arrays and objects are immutable. A write replaces the whole value; there are no member writes. **[files]**

### 5.1.1 Types

| `type` | Required | Optional | Notes |
|---|---|---|---|
| `number` | `minimum`, `maximum` | | Finite, inclusive bounds. NaN and infinities are never stored. |
| `boolean` | | | |
| `string` | `maxLength` | `enum` | Length counts Unicode code points. Enum members are distinct literals that fit `maxLength`. |
| `array` | `items`, `maxItems` | | `items` is a type. `maxItems` is 1..1024. |
| `object` | `properties`, `required`, `additionalProperties` | | Closed: `required` lists every property; `additionalProperties` is `false`. |

Nested data is at most 16 levels deep. Every property of an object and every cell of a row is required; there are
no optional members. The same type shape is used by inputs, output values, event payloads, record rows and data
table columns (section 2). **[files]**

### 5.1.2 Lifetimes

A value's `lifetime` says how long it lasts.

| `lifetime` | Lasts | Starts again | Default for |
|---|---|---|---|
| `moment` | While its owner is active: a scene from entry to exit, a use of a component from creation to removal. Kept while the owner is suspended by a visit (3.7). | On fresh entry or creation | scenes, components |
| `run` | One run of the experience: from mounting it until it is closed or restarted (`player.restart()`, 10.6). | On mount and on restart | experiences, shells |
| `session` | Until the browser session ends. Survives a reload in the same tab. | When the session ends | |
| `saved` | Across runs, on the device or in host storage. | On `resetSaved` or when storage is cleared | |

The story graph's memory (3.8) uses the same words: `run`, `session`, `saved`.

- `session` and `saved` need the `storage` grant for that scope (10.5). Without it, or when storage fails, the value
  lasts for the run in memory and the engine emits `save:unavailable` once per run. **[playing]**
- Stored values are keyed by the page path (without query or fragment, and without a final `/`), experience
  id, **partition** (below), owner address (section 2), use and repeat key path, and value name. A `session` or
  `saved` value inside a repeated use needs a stable row key (4.5). **[files]**
- **Partitions.** Stored values are also keyed by an opaque `partition` that the host gives at mount (10.6): a learner,
  a signed-in account. It is `device` when the host gives none. The engine never reads or shows it, and content cannot
  name it. **[playing]**
  - `player.clearStorage()` (10.6) clears the current partition's stored data, resets `saved` values and knob values
    to their initial values, then restarts.
  - A host may keep stored data only for a time (its profile's `retention`, A10.1).
  - When a host switches or ends a partition (a sign-out), the engine stops writing to the old one. The host switches
    with `player.setPartition(id)` (10.6): the new partition's stored values are restored as a new run.
    `player.setPartition('device')` ends a learner or account partition.
  - A partition id is 1 to 128 characters of `A-Z a-z 0-9 . _ -`. `E-RANGE` **[files]**, **[playing]**
  - When a storage grant is withdrawn, stored values fall back to `run` and are not written again (10.5).
- Stored values are restored before entry actions. Stored data that is unknown, of the wrong type or out of bounds
  is ignored: the value takes its initial value and the engine emits `save:invalid`. Restored data over the stored-data
  limit (9.8) is ignored the same way. **[playing]**
- **Save stamp.** A publisher may drop old stored data when a new version changes it (`saveStamp`, A10.5). **[playing]**
- Changed `session` and `saved` values are written after each committed transaction (9.2). **[playing]**
- `player.resetSaved` clears this experience's `session` and `saved` values and the graph memory (3.8), and
  restores those values' initials; `run` values and the scene on the stage stay. It does not clear knobs (the person's settings, 5.3.2) unless it carries `settings: true`, which restores
  every knob a settings item names to its initial value. It clears no other storage. **[playing]**
- Saved values are not a security boundary. They must not hold secrets or personal data. **[review]**

### 5.1.3 Scope: who reads and who writes

- A block reads its own inputs, values, computed values and ambient inputs, and the output values of its uses.
- The scenes and the shell of an experience also read the experience's inputs, computed values, data tables and
  words, and read and write its values and records: they
  are the experience's own behaviour. Editable content of a whole experience is best declared on the experience's
  inputs, which every scene reads. Components see nothing outside themselves; a parent passes inputs and reads outputs.
  `E-REF-PRIVATE`, and `E-SEAL-LEAK` for a sealed block (A9.4) **[files]**
- A visible name may not hide another: a scene value may not reuse an experience value's name. `E-NAME-SHADOW` **[files]**
- **One writer per value.** A body value is written only by its own block's actions and controls. For an
  experience's values, that block is the experience together with its scenes and shell: their behaviour is the
  experience's own. An input is
  written only by its source (5.3); a knob is also written by a person, through a drawn control whose `value` names it (5.11) or a `setting` (5.15), and the latest change wins, the host's or the person's (D45). Computed values and output values are never written. Ambient inputs, and a shell
  value named by a dialog slot's `openValue` (10.1), are written only by the engine; `voice` is also written by a person's `setting` (5.15.1). An add-on writes only the values its manifest lets it
  write (`writes`, chapter 12). `E-WRITE-INPUT` **[files]**

### 5.1.4 Interface values and body values

Only declared interface values are visible outside a block (decision 1).

| Declared in | Visible outside | Written by |
|---|---|---|
| `inputs` of kind `content`, `knob`, `trigger` (5.3) | Yes. Uses supply them, editors change them, settings show knobs. | The use's `with`, a link's `carry` (3.2), the host API (10.6), the changes protocol (A9.7) |
| `outputs` of kind `result` (5.4) | Yes. Parents, links (3.2) and the host API (10.6) read them. | Nobody: each is a formula |
| `values` | No | The block's own behaviour |
| `computed` | No | Nobody: each is a formula |

Editors, agents, hosts and parents can neither read nor change body values. A sealed block changes only through its
inputs. `E-HOST-PRIVATE` (10.6) **[files]**

## 5.2 Computed values

A **computed value** is a read-only value defined by a formula over other names. The `computed` map takes a name to
one formula string. Its type is inferred by the checker.

```json
"computed": {"canNext": "phase === 'done' && tries < 3", "stars": "min(score, 3)"}
```

- Computed values form an acyclic graph, at most 256 per block. `E-CYCLE`, `E-RANGE` **[files]**
- Each computed value is cached and evaluated again only when a name it reads changes. `visits` and `canReturn` change
  only when a link fires, and computed values that read them are evaluated again then. A computed value may not read
  `elapsed`, which changes all the time; a binding may, and it then repaints every scene while it is mounted. Its
  formula has its own budget (5.6.6); reading it does not inline it into the reader. **[files]**, **[playing]**
- After each write, computed values that depend on it are evaluated before the next action or guard reads them.
  **[playing]**

## 5.3 Inputs

The **inputs** face lists what may be changed from outside. It is one map from input name to declaration; each
declaration has a `kind`: `content` (a content field), `knob` or `trigger`. Content fields and knobs use the type
shape of 5.1.1; `initial` is the value a use gets when it gives none. Triggers have no type and no value.

```json
"inputs": {
  "message.headline": {"kind": "content", "type": "string", "maxLength": 40, "initial": "Warm croissants"},
  "pricing.amount":   {"kind": "content", "type": "number", "minimum": 0, "maximum": 999, "initial": 3.5},
  "productPhoto":     {"kind": "content", "type": "string", "contentType": "picture", "maxLength": 48,
                       "initial": "croissant-photo"},
  "badgeNote":        {"kind": "content", "type": "string", "maxLength": 24, "initial": "", "required": false,
                       "tier": "rich"},
  "rideSpeed":        {"kind": "knob", "type": "number", "minimum": 0.5, "maximum": 1.5, "step": 0.05, "initial": 1,
                       "lifetime": "saved"},
  "celebrate":        {"kind": "trigger"}
}
```

- **Names.** Inputs, values and computed values share one namespace in a block: no name is used twice among them.
  Outputs are a separate namespace, read only from outside, so a `result` output may share the name of the value it
  reports (5.4). Inputs are read-only inside the block. `E-ID-DUPLICATE`, `E-WRITE-INPUT` **[files]**
- `initial` is literal JSON. An input without `initial` must be supplied by every use. `E-KEY-REQUIRED` **[files]**
- A use supplies inputs in its `with` map: one formula per input, evaluated in the parent's scope and evaluated again
  when a name it reads changes; a machine's state, read by `active(...)`, is such a name, as for bindings. Text
  is in single quotes (D36, 5.6.1): `"with": {"title": "'Harbour'"}`. All inputs of one use are checked together and updated at once; `changed:<name>`
  events follow (5.12). If one value fails, none changes and the transaction faults. **[playing]**
- A change from an editor, a host or an agent passes the same checks: type, bounds and rules (A9.6). Who may edit
  which input (`editableBy`) and how a container exposes an inner input (`promote`) are in the tool reference (A9).
  **[files]**, **[playing]**

### 5.3.1 Content fields

A **content field** is a typed input for words, pictures or data. `contentType` says what it holds. It may be left
out when the type implies it: a string is `text`, a string with `enum` is `choice`, a number is `number`, a boolean is
`flag`, an array is `rows`, an object is `row`.

| `contentType` | `type` | Holds | Usually bound by (6.8) |
|---|---|---|---|
| `text` | string | Words a person reads | `text` |
| `number` | number | A displayed number: a price, a count | `text` with `formatNumber` |
| `flag` | boolean | An on/off content choice: show a badge | `visible` |
| `choice` | string with `enum` | One of fixed options, as stable ids | `variant`, `visible` |
| `picture` | string | A picture resource id (section 2) | `picture` |
| `icon` | string | An icon's id, such as `clock`, in an icon set (section 2, 6.2.2) | `variant` as `icon` |
| `color` | string | A colour role name from the theme (7.7) | `color` |
| `time` | number | A moment in UTC milliseconds, such as when a sale ends | formulas with `now` |
| `point` | array `[x, y]`, numbers 0..1 | A place in a picture, such as a photo's focal point | `cover` crops (the `fit` add-on) |
| `rows` | array of objects | Rows in the shape of a data table named by the field's `table` key (2.8) | repeated uses (4.5) |
| `row` | object with declared `properties` | One row, such as a data table's row a parent looked up and passes to a component | formulas reading its members |
| `url` | string | An absolute `https:` address that `openUrl` opens (10.4) | `player.openUrl` |
| `freeText` | string | Words a visitor types, at most 500 characters | an add-on call that declares it (the `ai` add-on) |
| `richText` | array of runs `{text, style?, optional?}` | Needs the `rich-text` capability (10.7). Words with emphasis: each run's `style` is one of the field's `styles` (the text styles of the theme, 7.7, that an editor may choose); a value may give runs per tier and per language, as a `text` field does | a `runs` binding (the `rich-text` add-on) |

- A `type` that does not match its `contentType` is refused. `E-TYPE` **[files]**
- `picture`, `icon` and `color` values name a declared resource, meaning or role, when declared and
  on every change. `E-REF-UNKNOWN` **[files]**, **[playing]**
- A `text` value may hold line feeds (U+000A) as forced line breaks (7.6); no other control character.
  `E-TYPE` **[files]**
- A `url` value is an absolute `https:` address of at most 2048 characters, checked when declared and on every
  change. Only `player.openUrl` reads it. `E-TYPE` **[files]**, **[playing]**
- A `freeText` field holds words a visitor types (in a form an add-on draws). Its `maxLength` is 1..500. A `freeText`
  value is never stored and never copied into a `saved` or `session` value: a binding or `set` that would do so is
  `E-TYPE`. It is never read by a formula, except as an input of an add-on call whose manifest takes free text (the
  `ai` add-on). A `freeText` field with a longer `maxLength` is `E-TYPE`; a read anywhere else is `E-AI-FLOW`. A `freeText` field defaults to `required: false` and `initial: ""`.
  The replay log (9.6) records only its length, never the words. A host `read` of it is refused with
  `E-HOST-PRIVATE` (10.6). 5.8 names this one exception to "words never decide". **[files]**
- `required` (default `true`) means the value is never empty: no empty string, no empty array. An optional field
  left empty reads `""`, `false` or `[]`, and a `number` or `time` field its `initial`; `""` is exempt from the
  reference, address and enum checks when `required` is false.
  `E-CONTENT-REQUIRED` (7.9) **[files]**, **[playing]**
- `tier` (`short`, `medium` or `rich`; default `short`) is the smallest content tier in which the field appears
  (7.9). A required field is `short`. **[files]**
- **Role prefix.** A content field name is a value name, or a role's `prefix` (the role id in camelCase, 6.3) and a
  field of that role's schema joined by one dot: `message.headline`, `action.text`. A formula reads the field as `message.headline`: a role-prefixed name
  is matched as one name before member access. The role prefix is used for nothing else in the block and cannot be
  read alone. **[files]**
- Content is plain data. A `text` value is never a template and never runs a formula. **[files]**
- A `text` field's `initial`, and its value in a use's `with`, may be a **tier object** (7.9): wordings per tier.
  Its wordings are literal text. It may also be a **language object**, language tag to wording
  (each wording itself plain or a tier object): `{"en": "Fresh sourdough", "de": "Frisches Sauerteigbrot"}`. Without a
  language object the value is in the block's default language and other languages come from words (7.8). 

### 5.3.2 Knobs and settings

A **knob** is a bounded input that may be adjusted, such as speed or difficulty. Its type is a number with
`minimum`, `maximum` and an optional `step`; a boolean; or a string with `enum`. As for any input (5.3), a knob
without `initial` must be supplied by every use; a knob that a settings item names always has `initial`. (The model's
knob `{min, default, max, step}` is written `minimum`, `initial`, `maximum`, `step`.)

- `step` is positive. `initial` and every change lie on the lattice `minimum + n × step`, within 1e-9 × `step` for
  floating-point error. `E-RANGE` **[files]**, **[playing]**
- A knob's `lifetime` (`run`, `session` or `saved`) applies to changes made while playing through a setting or the
  host. It defaults to `run`;
  `saved` remembers a person's setting across runs and is not cleared by `resetSaved`. On mount the knob takes its
  `initial`, then a stored value, then any host change. Changes made while making are written into the files.
  Content fields have no lifetime: their source sets them.

A **setting** is a knob shown to the player. Which knobs are settings, with their labels and groups, is said by the
`widgets` add-on, which also draws the settings form; the add-on's page comes with the add-ons release. A person changes a setting with the
`player.setting` from a drawn control (5.15.1), or in that form. That change is a seat's change, checked by type,
bounds and rules, not by editor rights. A setting never implies saving: the knob's `lifetime` decides. **[playing]**

### 5.3.3 Triggers

A **trigger** is an input with no stored value: something happened. Its entry is `{"kind": "trigger"}`, with an
optional `payload` naming an object type.

- Firing a trigger queues one event with the trigger's name, carrying the payload as `event`. It never latches true
  and has no `changed:` event. **[playing]**
- A parent fires a use's trigger with `emit` as a trigger (5.15). The host fires an experience's triggers with
  `player.emit` (10.6); an add-on may fire the triggers its manifest names (the `seats` add-on). A choice link is a trigger too (3.5). A
  trigger on the experience's inputs face is queued to the shell and to every mounted scene, which hear it under its
  name in their `on` maps; links may also fire on it (3.3). A trigger
  cannot be read as a value. `E-TYPE` **[files]**

## 5.4 Output values

An **output value** is a typed formula a block exposes for reading. The outputs face is one map from name to
declaration; each has a `kind`: `result` (an output value, defined here), `event` or `record` (section 5). Names are
unique across kinds. A name is not both an input and an output of one block: the host's `set` and `read` (10.6) and a
parent reach both by the same name. `E-ID-DUPLICATE` **[files]**

```json
"outputs": {
  "done":  {"kind": "result", "type": "boolean", "value": "active('resolved')"},
  "score": {"kind": "result", "type": "number", "minimum": 0, "maximum": 3, "value": "score"}
}
```

- The formula's inferred type must fit the declared type. A result outside its bounds faults the transaction.
  `E-TYPE`, `E-RANGE` **[files]**, **[playing]**
- A parent reads `uses['left-answer'].done`; a repeated use reads `uses['answers']['<row-key>'].done`;
  `uses['left-answer']` alone is an object of the use's output results. Only declared
  output values can be read. `E-REF-PRIVATE` **[files]**
- A link's `when` and `carry` read the `from` scene's output values (3.2); the host reads them with `player.read`
  (10.6).

## 5.5 Ambient inputs

**Ambient inputs** are read-only values the engine provides to every block. They cannot be saved, and only the
engine writes them, apart from a person's own sound, voice, motion and time-limit settings (`setting`, 5.15). An author's own value of
the same name hides one inside its scope, and `hsvg.<name>` always reads the ambient input (5.9). `E-WRITE-INPUT`,
`W-NAME-HIDES` **[files]**

| Name | Type | Meaning | Change event |
|---|---|---|---|
| `now` | number | Date and time as UTC milliseconds, rounded down to whole seconds | `changed:now`, once a second, only in blocks that read it |
| `elapsed` | number | Milliseconds on the reading owner's local clock (3.10) | none; use `after` (5.14) |
| `reducedMotion` | boolean | The system's reduced-motion preference, or the person's own setting (`setting`, 5.15): a setting can turn it on, but not off while the system asks for it | `changed:reducedMotion` |
| `timeLimits` | number | The person's time limits (10.13): 1 by default; 0 turns timed links and machine timers off, 2 to 10 multiplies them. Set by the person (`setting`, a settings item) or the host (`timeLimits`, 10.6); a value between 0 and 1 is refused (`E-RANGE`): a time limit is never shortened | `changed:timeLimits` |
| `inputMode` | string | `keyboard`, `pointer` or `touch`: the kind of the last real input | `changed:inputMode` |
| `language` | string | The active language tag (7.8) | `changed:language` |
| `size` | object | `shape` (the active shape id, 7.2), `width` and `height` (player box, CSS pixels) | `changed:size`, at most once a scene |
| `muted`, `volume` | boolean, number 0..1 | The master mute and volume (6.10) | `changed:muted`, `changed:volume` |
| `voice` | boolean | Recorded voices may play (the `lines` add-on); false until a person turns it on | `changed:voice` |
| `spoken` | object | `line`, `text` and `word` of the spoken line this block is saying; `{line: "", text: "", word: -1}` when silent. Only the `lines` add-on changes it | `changed:spoken` |
| `visits` | object | `visits['hub-map']`: entries of that scene under the graph memory (3.6) | none |
| `canReturn` | boolean | The stage slot's visit stack is not empty (3.7) | none |
| `chapter` | object | `id`, `index` and `count` of the chapter on the stage; in an ordered chapter, present steps only (3.12). `index` counts from 0. Outside a chapter it is `{id: "", index: 0, count: 0}` | `changed:chapter` |
| `layout` | object | For each block on screen, by its address: `frame` (the chosen layout or frame id), `tier` and `steps` (the give-way steps taken, if any). Read-only; the same read-out as the host's `ladder()` (7.1, 10.6) | `changed:layout` |

- `inputMode` starts from the device's pointer capability. Only real input changes it: Tab or a key of the fixed
  set of 5.12 gives `keyboard`, touch gives `touch`, mouse or pen gives `pointer`. Hover, modifier keys, typing in host fields and
  synthetic events do not. It belongs to the mounted player, survives scene changes and is never saved or sent.
  **[playing]**
- In play tests, `now`, `reducedMotion`, `inputMode`, `language`, `size` and `voice` come from fixtures (A8.5).
  **[playing]**
- `language` and `size` are presentation inputs (5.8).

Other built-in read-only names: `event` (the current event's payload, during its reactions), `uses` (output values
of uses), `data` and `words` (tables and words, section 2); these four are reserved (5.9). The row names `item` and
`index` (in repeated uses and row functions) and `acc` (in `fold`) exist only inside their fields and brackets.

## 5.6 The formula language

A **formula** is a short expression in one bounded language with a closed grammar. Formulas write conditions,
computed values, written values and binding values. Safety comes from the grammar and its budgets (decision 3). The
grammar is the `hsvg/0.1` expression grammar, unchanged; this section renames it and fixes its function list.

### 5.6.1 Formula slots, template slots and literal slots

**One formula rule (D36).** `set ... to`, a use's `with` and every other value slot hold a formula; text in a formula
is in single quotes. Only words a person reads are plain words with `{{ formula }}` inside. This replaces D31.1's
text slots: the slot's declared type no longer changes how a string is read.

| Slot | A plain string is | A formula is written | Example |
|---|---|---|---|
| **formula slot**: every value slot: the `to` of `set`, an input given in a use's `with`, a kit scene's or shell's `with` and the kit's own `with`, a choice option's `value`, a link's `carry`, the entries of a `call`'s `with` (`player.setting` included), and everything that is a number, a yes/no value, a list, an object or a condition | a formula | as the whole string, text in single quotes | `"to": "'Fox at dawn'"`, `"with": {"title": "words.harbour"}`, `"to": "score + 1"`, `"visible": "canNext"` |
| **template slot**: words a person reads: `text`, `label`, `disabledLabel`, `valueText`, a link's `choice` | text | inside `{{ }}` (5.7) | `"text": "Score {{ score }}"` |
| **literal slot**: `initial`, ids, names, bounds, enum members, table cells, clip key times, `*Ms` fields other than `delayMs` and link `afterMs` | JSON data, never read | (none) | `"initial": 0` |

- Text and values join with `+`: `"to": "'Score ' + score + ' of 9'"`. A number beside text is printed as a template
  prints it; `+` of two numbers adds them, so two values side by side start from text: `"'' + hours + minutes"`.
  **[files]**, **[playing]**
- A formula of one name, `"title"` in a use's `with`, passes the value through with its type and declaration, so a
  content field's tiers pass through (7.9). **[files]**
- An empty text is `''` (two single quotes). **[files]**
- `{{ }}` in a formula slot is refused, with the fix: "this field holds a formula, not text: write score + 1 without
  {{ }}"; words with `{{ }}` inside are told to join with `+`, and plain words that do not parse are told to go in
  single quotes. `E-FORMULA` **[files]**
- In a template slot, two quote marks (`''`) or a bare name of the block's own (`"text": "score"`) show as they are
  written: `W-TEXT-LITERAL` names the fix (`""`, or `{{ score }}`). So do words with no `{{ }}` that name a value of
  the block after a colon or an equals sign (`"Score: score"`), or anywhere when no word is spelt like it
  (`bestScore`, `level2`); the message gives the words with `{{ }}` around each name. A plain word elsewhere
  (`"Try another ending"`) is an everyday word and passes. **[files]**
- A text field given in `with` may also be a tier object or a language object (5.3.1), and a `rows` field literal
  JSON rows.
- The K2 rewrite tool (`docs/spec-2.0-work/tools/k2/k2.mjs`) rewrites files written before D36, and the upgrade tool
  uses the same mapping:

  | Before D36 | Now |
  |---|---|
  | `{"set": "label", "to": "Fox at dawn"}` (a text value) | `{"set": "label", "to": "'Fox at dawn'"}` |
  | `"with": {"title": "{{ cta }}"}` | `"with": {"title": "cta"}` |
  | `{"set": "turn", "to": "{{ turn === 'x' ? 'o' : 'x' }}"}` | `{"set": "turn", "to": "turn === 'x' ? 'o' : 'x'"}` |
  | `"to": "{{ l0 }} is back. {{ n }} placed."` | `"to": "l0 + ' is back. ' + n + ' placed.'"` |
  | `"options": {"a": {"value": "a"}}` (a text value) | `"options": {"a": {"value": "'a'"}}` |
  | `{"set": "score", "to": "score + 1"}` (a number) | unchanged |

### 5.6.2 Grammar

Whitespace is allowed between tokens.

```ebnf
formula     = conditional ;
conditional = or, [ "?", formula, ":", conditional ] ;
or          = and, { "||", and } ;
and         = equality, { "&&", equality } ;
equality    = comparison, { ("===" | "!=="), comparison } ;
comparison  = sum, { ("<" | "<=" | ">" | ">="), sum } ;
sum         = product, { ("+" | "-"), product } ;
product     = unary, { ("*" | "/" | "%"), unary } ;
unary       = ("!" | "+" | "-"), unary | member ;
member      = primary, { ".", identifier | "[", formula, "]" } ;
primary     = number | string | "true" | "false" | "null" | identifier
            | "(", formula, ")" | "[", [arguments], "]"
            | "{", [ string, ":", formula, { ",", string, ":", formula } ], "}"
            | functionName, "(", [arguments], ")" ;
arguments   = formula, { ",", formula } ;
identifier  = lowerLetter, { letter | digit } ;
number      = digit, {digit}, [".", digit, {digit}], [ ("e"|"E"), ["+"|"-"], digit, {digit} ] ;
```

- Tokenize a whole identifier-shaped word first. Exactly `true`, `false` and `null` become literal tokens before name
  lookup; `trueValue` stays a name. `and`, `or` and `not` are reserved, not operators. **[files]**
- Strings use single or double quotes, JSON escapes, and `\'` inside single quotes. No raw control characters.
- Not in the language: comments, trailing commas, assignment, methods, user functions, regular expressions, spread,
  backtick templates, globals, imports and any dynamic code. `E-FORMULA` **[files]**
- `__proto__`, `prototype` and `constructor` are refused as names and as member keys, including computed keys. Only
  own data properties are read. **[files]**, **[playing]**
- `null` exists only to test a lookup fallback. It has its own type and is never stored, passed in `with` or
  printed. The checker narrows only the direct forms `r === null ? a : f(r)` and `r !== null ? f(r) : a`, where `r` is the
  same pure call written identically in both places; prefer a real
  row as the fallback. **[files]**

### 5.6.3 Operators and types

| Precedence (low to high) | Operators | Associativity | Operands |
|---|---|---|---|
| 1 | `? :` | right | condition must be boolean; lazy |
| 2 | `\|\|` | left | booleans; lazy |
| 3 | `&&` | left | booleans; lazy |
| 4 | `===`, `!==` | left | any; scalars by type and value, arrays and objects by deep JSON equality |
| 5 | `<`, `<=`, `>`, `>=` | left | numbers |
| 6 | `+`, `-` | left | numbers; `+` also joins two strings |
| 7 | `*`, `/`, `%` | left | numbers |
| 8 | `!`, unary `+`, unary `-` | right | boolean for `!`, numbers otherwise |
| 9 | `.`, `[ ]`, calls | left | |

- There is no coercion. `"3" + 1` is a type error. **[files]**, **[playing]**
- A lazy operator does not evaluate the branch it skips: the skipped branch costs no budget and cannot fault. The
  checker still type-checks every branch. **[files]**, **[playing]**
- Division or remainder by zero, a missing member, a wrong operand type and a non-finite result fault the formula.
  `E-FORMULA` **[playing]**
- `%` is the truncated remainder: its sign follows the left operand (`-7 % 3` is `-1`). It accepts non-integers.
- `===` between values of different types is false; the checker warns when it can see the types never match.
- Indexes are zero-based. `[ ]` reads arrays and objects; `length` counts a string's Unicode code points.
  **[playing]**

### 5.6.4 Functions

The function list is closed. No other call is accepted. `E-FORMULA` **[files]**

| Function | Meaning and example |
|---|---|
| `min`, `max` | 1..32 numbers: `min(speed, 10)` |
| `clamp` | Number, low, high, with low ≤ high: `clamp(angle, -20, 20)` |
| `floor`, `ceil`, `round` | One number; `round` takes ties toward +infinity: `round(score)` |
| `pow` | Base and exponent; the result must be finite: `pow(2, clamp(level, 0, 10))` |
| `sqrt` | A number 0 or more: `sqrt(area)` |
| `exp`, `log` | One number; `log` is the natural logarithm of a number above 0; the result must be finite: `exp(-time / tau)`, `log(ratio)` |
| `sin`, `cos` | An angle in degrees: `sin(angle)`, `cos(phase * 360)` |
| `length` | Array items or string code points: `length(choices)` |
| `at` | Array and index (truncated toward zero), or object and string key, with a required fallback: `at(choices, 2, null)` |
| `includes` | Array and scalar member: `includes(seen, item.id)` |
| `lookup` | Rows, key column, scalar key, required fallback; first match in order: `lookup(data.topics, 'id', topic, null)` |
| `append` | Array, item, maximum 1..1024; a new array keeping the newest items: `append(journey, {"stop": stopId}, 128)` |
| `filter` | Array and row predicate: `filter(data.topics, item.enabled)` |
| `count` | Array and row predicate: `count(choices, item.correct)` |
| `sum` | Array and numeric row formula; empty gives 0: `sum(answers, item.points)` |
| `minBy` | Non-empty array and numeric row formula; the first minimum wins: `minBy(rows, item.rank)` |
| `fold` | Array, a start, and a step formula; the step is evaluated once per row with `acc` (the result so far, `start` at the first row), `item` and `index` bound; the result is the last `acc`, `start` for an empty array: `fold(scores, 0, acc + item)` |
| `sort` | Array, a row key formula, and an optional boolean, `true` for high to low; a new array in key order, stable (equal keys keep their order); the keys are all numbers or all strings (code point order): `sort(data.cities, item.population, true)` |
| `range` | A count, truncated toward zero, 0 to `formulaArrayItems` (1,024); the array `[0, 1, …, count − 1]`: `range(5)`, `sum(range(index), rows[item].value)` |
| `pick` | Non-empty array and a seed (truncated toward zero): `pick(choices, seed)` |
| `shuffle` | Array and a seed (truncated toward zero); a new array: `shuffle(choices, seed)` |
| `random` | Finite min, max and a seed (truncated toward zero): `random(0, 1, seed)` |
| `active` | A static machine state id of this block: `active('red')` |
| `numberText` | Number and decimals 0..8; plain digits with a dot, the same in every language: `numberText(roundNumber, 0)` |
| `formatNumber` | Number, decimals 0..8, grouping boolean; the active language's marks: `formatNumber(price, 2, true)` |
| `plural` | Count and a word id; the word's plural form for that count (2.7): `plural(lives, 'livesLeft')` |

- `append` adds one item, then drops the oldest items until at most `maximum` remain. The input array holds at most
  1024 items. A later write checks the item type and bounds. **[playing]**
- `filter`, `count`, `sum`, `minBy`, `sort` and `fold` are row functions: they evaluate the array once, then their row
  formula (the second argument; for `fold`, the third) once per row with `item` and `index` bound. Nested row
  functions restore the outer `item` and `index`; `acc` is the nearest `fold`'s, so a row function inside a step still
  reads it. They are special forms, not callbacks. **[playing]**
- `fold` runs within the evaluation limits (5.6.6): each row's work counts against the work steps of one evaluation,
  and an array it builds holds at most 1024 items. A running total:
  `fold(xs, [], append(acc, (length(acc) > 0 ? at(acc, length(acc) - 1, 0) : 0) + item, 1024))`. The checker needs an
  array as the first argument, gives the result `start`'s type and the step's type must match it. A number from
  `fold` has no proven range (each step may change it): write `clamp(...)` where a field needs one. **[files]**,
  **[playing]**
- `formatNumber` takes the decimal and group marks from the active language's words (`decimalMark`, `groupMark`,
  2.7); `.` and `,` when a language gives none. It reads `language`, so its result is presentation (5.8). Use
  `numberText` for ids and data.
- `plural` returns the text of the row `<id>.<form>` of the active language's words, the form chosen from the count
  by the language's plural rule (2.7); a missing form falls back to `<id>.other`. The id is a literal string, checked
  like any word reference. It reads words, so its result is presentation (5.8). Dates have no display function in 2.0.
- `sort` faults when its keys mix numbers and strings or one is neither; `range` faults outside 0 to 1,024
  (`E-RANGE`). The checker proves both bounds where it can. A cumulative sum reads the outer `index` in the first
  argument, before the row function binds its own: `sum(range(index), rows[item].share)` is the share of the rows
  before this one (a donut's start). **[files]**, **[playing]**
- No randomness is hidden. A new draw needs an authored write of a new seed. **[files]**

### 5.6.5 Seeded randomness

`pick`, `shuffle` and `random` use one 32-bit mixer, `mix(seed)`, written with JavaScript's 32-bit integer
operations: truncate the seed toward zero and take it modulo 2^32 (so negative and fractional seeds are allowed);
`x = imul(x ^ (x >>> 16), 0x85ebca6b)`; `x = imul(x ^ (x >>> 13), 0xc2b2ae35)`; return `(x ^ (x >>> 16)) >>> 0`.
`pick` returns the item at `mix(seed) % length`. `random` returns `min + ((max - min) * mix(seed)) / 4294967296`,
computed in that order in double precision. `shuffle` copies the array, then for `i` from `n - 1` down to 1 swaps the
items at `i` and `j = mix(seed + (n - 1 - i)) % (i + 1)` (the sum is formed before the conversion); it never changes
its input. These are format algorithms, not calls into content code. **[playing]**

### 5.6.6 Budgets

| Budget | Limit |
|---|---|
| Formula source | 4096 UTF-16 units |
| Tokens | 1024 |
| Nesting depth | 32 |
| Work steps per evaluation, counted as below (row formulas included) | 65536 |
| Items in any array a function reads or returns | 1024 |
| Result size, serialized | 65,536 UTF-16 units |

**Work steps.** One step for each call, operator, name, member access and literal evaluated; for each row a row
function visits; for each item `sort` orders or `shuffle` mixes; and for each value an equality (`===`, `!==`,
`includes`, `lookup`) compares, nested values included. One step for every 16 items, or part of 16, that `append` or
`range` builds, and for every 16 UTF-16 units, or part of 16, that `+` joins or that `length` or a string index reads.
So the work of one evaluation is bounded, whatever it builds or compares; a row formula of 64 steps fits every row of
the largest table (1024 rows). A `+` that would build a string over the result size faults at once. The steps also
count toward the formula steps of the transaction (9.2).

These are the format's ceilings, not budgets (A10.3): they hold everywhere. A limit that is known from the files is
checked by the checker. Otherwise the evaluation faults with the owner's address. There is no
timeout and no partial result. `E-RANGE` **[files]**, **[playing]**

### 5.6.7 Static checks and range proof

- The checker parses every formula, resolves every name in its scope (5.1.3), infers types and refuses a formula whose
  type does not fit its field: guards, `if` and `visible` need booleans; `delayMs` and channel values need numbers.
  `E-FORMULA`, `E-REF-UNKNOWN`, `E-TYPE` **[files]**
- Where a field needs a proven range (channel values within a part's motion range, `delayMs` and link `afterMs` within
  1..3,600,000, clock speeds, add-on inputs with a range), the checker proves it from declared bounds. Bounds pass
  through names, arithmetic, conditionals, `min`, `max`, `clamp`, `floor`, `ceil` and `round`; a conditional's range
  joins both branches (its test does not narrow them); a divisor whose range spans zero fails; `a % n` with a positive literal `n` and a non-negative `a` gives 0..n.
  The interval rules: `+`, `−`, `*` and `/` use interval arithmetic over the corner values (a divisor range that
  spans zero fails); `%` as stated; `length` and `count` give 0..`maxItems`; `index` gives 0..`maxItems − 1`;
  `at` and `lookup` give the element's bounds or the fallback's; `volume` gives 0..1;
  `visits[...]`, `elapsed` and `size.*` are unbounded. The literals `[]` and `{}` take the target's type; a `null`
  fallback gives an optional value that must be narrowed (5.6.2).
  Event payloads and `now` give no bound. Write `clamp(...)` when a range cannot be proved.
  `E-RANGE` **[files]**
- `pow(a, n)` is bounded only when `n` is a literal, or when `a` is a literal above 0 and `n` has a known range.
  `pow(a, 0)` is 1. An odd integer `n` keeps the order of `a`'s range. An even
  integer `n` gives 0..max(lo^n, hi^n) when `a`'s range spans zero, and otherwise the minimum and maximum of the
  corner values. A negative integer `n` is bounded only when `a`'s range lies wholly above 0 or wholly below 0 (the
  corner values). A non-integer `n` needs `a >= 0`; otherwise the result is unbounded. A literal base `a > 0` with an
  exponent of known range is monotone, so the corners of the exponent's range give the bounds: `a > 1` rises,
  `0 < a < 1` falls, and `a = 1` is 1.
- `sum` gives min(0, `maxItems` × lo)..max(0, `maxItems` × hi), where lo..hi is the bound of the row formula. An empty
  list sums to 0, so 0 is always inside the range.
- A source not listed here is unbounded and needs `clamp(...)`.
- Worked cases:
  - `pow(x, 2)` with `x` in −1..1 gives 0..1.
  - `sum` of an empty list is 0, and the proof counts 0 in the range.
  - `pow(x, 0.5)` with `x` in −1..1 is unbounded, because `x` may be negative. Write `pow(clamp(x, 0, 1), 0.5)`.
  - `pow(2, clamp(level, 0, 10))` is bounded 1..1024, because the base is a literal above 1 and the exponent's range
    is known. `pow(2, level)` with no known range for `level` is unbounded.
- Where a field needs a value from a known set (a variant name, a colour role, a resource id), the checker proves it
  from `enum`s and literals. A free string is checked while playing, and the checker gives a note. **[files]**,
  **[playing]**
- Editors print an unchanged formula exactly as written (tool conformance, section 10).

## 5.7 Templates for text

A **template** is literal text with `{{ formula }}` spans: `"text": "Score {{ score }} of {{ total }}"`.

- The scanner finds `}}` only outside quoted strings and balanced brackets. `\{{` and `\}}` in the decoded string are
  literal braces; JSON writes the slash as `\\`. **[files]**
- A span gives a string, a number or a boolean. Numbers print as the shortest decimal that reads back to the same
  number, never in exponent form; use `formatNumber` for display. `numberText` and `formatNumber` round the number's shortest decimal form half toward +infinity:
  `numberText(2.675, 2)` is `"2.68"`, `numberText(-2.675, 2)` is `"-2.67"`.
  Booleans print `true` or `false`. Null, arrays and objects cannot be printed. No HTML is parsed. **[files]**,
  **[playing]**
- Visible prose lives in words files (section 2). A word may contain a template; it is expanded once, in the scope of
  the template that reads it. A word may not refer to itself, directly or through other words. `E-CYCLE` **[files]**
- A translation may not read a name that its default-language word does not read. `E-WORDS-PATH` **[files]**
- The full text of a fitted text stays the part's accessible name (7.6). **[playing]**

## 5.8 Words never decide behaviour

Display text must never change what happens. Then every language, tier and shape behaves the same, and content can be
swapped safely (7.8).

**Presentation sources** are: words (`words.*`), the result of a template, labels, `about` fields, content fields of
`contentType: "text"`, `formatNumber`, `plural`, and the ambient inputs `language`, `size` and `spoken`.

- No guard, `if` condition, machine target, link `when`, rule `when` (A11.2), `carry` or destination (section 3),
  output, record row, add-on call, or `session` or `saved` value may depend on a presentation source. The checker
  follows data and control dependencies through computed values, writes, event payloads, emitted events and repeated
  uses, and refuses any path. Carrying words in a payload is not a decision; what the receiver does with them is
  checked. `E-WORDS-DECIDE` **[files]**
- Presentation may flow into bindings and into `moment` or `run` values that only bindings read. **[files]**
- A decision that needs a category uses a stable id: a `choice` content field, a data column of ids or a knob.
- **One exception.** A `freeText` content field (5.3.1) holds words a visitor typed. It may be read only as an input
  of an add-on call that takes free text (the `ai` add-on), which may choose an answer from the words. The answer stays in bindings and `moment` values (`E-AI-FLOW`), so no other decision depends
  on the typed words. **[files]**

## 5.9 Names: reserved, built-in and the author's

An author's names and the format's built-in names never clash (decision D22), so the format can add functions and
built-in values later without breaking a 2.0 file.

- **Functions are known by their brackets.** A word followed by `(` is a function (5.6.4); a word without is a value.
  A value may share a function's name: a value `fold` (how many times the paper is folded) and the function
  `fold(...)` live in one file, and `fold + fold(range(layers), 0, acc + item)` reads both. **[files]**
- **An author's name hides a built-in value of the same name inside its scope** (5.1.3), as a local name hides a
  global one. The built-ins are the ambient inputs (5.5) and the row names `item`, `index` and `acc`. A scene with its
  own value `now` reads that value as `now`; the built-in is always reachable by its full name, `hsvg.now`. The
  experience's `now` hides the built-in in the experience, its scenes and its shell, not in a component, which sees
  nothing outside itself. The checker warns when an author's value, computed value or input hides a built-in.
  `W-NAME-HIDES` **[files]**, **[playing]**
- **Change events follow the same rule.** Inside the scope of an author's `now`, `changed:now` is heard only when the
  author's `now` changes; the clock's tick never reaches it. `changed:hsvg.<name>` always hears the built-in's change
  (`changed:hsvg.now` once a second, `changed:hsvg.language`). Where no author's name hides the built-in, the bare
  `changed:<name>` hears the built-in too. `changed:hsvg.<name>` of a name that is not an ambient input is
  `E-REF-UNKNOWN`. **[files]**, **[playing]**
- **Row names exist only inside their function's brackets** (`item` and `index` in a row formula and in a repeated
  use's fields, 4.5; `acc` in a `fold` step). There they hide an author's value of the same name; outside, the name is
  the author's. **[files]**, **[playing]**
- `hsvg.<name>` names a built-in value only: an ambient input, or one of `data`, `words`, `uses` and `event`. Any other
  name after `hsvg.` is unknown; `hsvg` alone is not a formula. `E-REF-UNKNOWN`, `E-FORMULA` **[files]**
- **Reserved names** cannot be declared as values, computed values, inputs or outputs: `E-NAME-RESERVED` **[files]**
  - keywords: `true`, `false`, `null`, `and`, `or`, `not`;
  - the root of the built-ins, `hsvg`, and the format's own roots `data`, `words`, `uses` and `event`;
  - built-in experience outputs: `entered`, `ended`, `openUrl`, `firstInput` (5.12);
  - unsafe names: `__proto__`, `prototype`, `constructor`.
- **Built-in event names are reserved as event names.** `paused`, `resumed` and `returned` (5.12) cannot
  name an output event, a trigger input, or an event an `emit`, a control (`event`, `missEvent`, an option's `event`)
  or a clip marker produces. Values and results may use them. `E-NAME-RESERVED` **[files]**
- **Later built-ins never clash.** A built-in event added after 2.0 is named `hsvg:<name>`; a built-in experience
  output added after 2.0 is heard and read by the host only as `hsvg.<name>` (10.6). Author names hold no `:` or `.`,
  so neither can meet an author's name. The host may also hear the five 2.0 outputs as `hsvg.<name>`
  (`on('hsvg.entered', fn)`). **[files]**, **[playing]**

A later version may add built-in values (for example a reader text scale, 7.7) and functions; they never break a file,
because an author's own name wins and a new function is known by its brackets. The file's version (`hsvg/2.0`) changes
only for real format changes (10.11).

Members of typed objects are read through their owner (`record.round`), so they may use any name except the
keywords and unsafe names. Table columns are value names (2.8); as members they may use any name except the keywords and unsafe names. **[files]**

## 5.10 Places in a drawing

A part is a place when it carries a place mark; a part carries at most one. Places are the drawn half of the places face (1.7). A block lists
in its `places` key the places its containers may use; the rest are private (section 2).

| Place | Mark | SVG element | Meaning |
|---|---|---|---|
| **slot** | `data-hsvg-slot="<name>"` | an empty `<g>`, or an unpainted `<rect>` | A use or a scene is mounted here; an empty `<g>` slot inside a moving part is an attach point too (6.9). In a `<g>` the mounted drawing takes the `<g>`'s coordinates, with its placement point (6.2.1) at the `<g>`'s origin. In a `<rect>` it is scaled uniformly to fit the box and centred. |
| **fit box** | `data-hsvg-fit` (no value) or `data-hsvg-fit="text"` | a `<rect>`, painted or not (D38) | The box a text fits in (7.6): the green bar a total fits in may be the box itself. |
| | `data-hsvg-fit="items"` | an unpainted `<rect>` | The box an add-on's layout plan arranges items in (the `fit` add-on). |
| | `data-hsvg-fit="video"` | an unpainted `<rect>` | The box a recorded video plays in (the `media` add-on draws it). |
| **repeat** | `data-hsvg-repeat` (any value, or none) | a `<g>` | Holds repeated uses: its direct child slots, in document order, are the item places (4.5). Other children are decoration. |
| **protected area** | role words: `data-hsvg-role="keep-inside"`, `"keep-clear"`, `"keep-empty"` or `"keep-inside keep-clear"` | an unpainted `<rect>` | Protects a box. `keep-inside`: never cropped or scaled out of view (a face, a product in a photo). `keep-clear`: nothing else is painted over it (a logo); the part or use the area protects is not "else". `keep-empty`: nothing but backdrop paint may be placed or painted in it, and moving things treat it as an obstacle. |
| **route** | `data-hsvg-route="track"` or `"surface"` | `<path>`, `<line>`, `<polyline>` | A drawn line. `track`: things move along it, in its drawn direction. `surface`: things stand and walk on it (a road, a floor). |

A mark that takes no value is written with an empty one, as XML needs: `data-hsvg-fit=""`, `data-hsvg-repeat=""`.

```svg
<rect id="card__total-bar" data-hsvg-kind="part" data-hsvg-fit="" x="20" y="200" width="160" height="32" fill="#2e7d4f"/>
<g id="card__rows" data-hsvg-kind="part" data-hsvg-repeat="">
  <g id="card__row-1" data-hsvg-kind="part" data-hsvg-slot="row-1" transform="translate(20 60)"/>
  <g id="card__row-2" data-hsvg-kind="part" data-hsvg-slot="row-2" transform="translate(20 100)"/>
</g>
<rect id="card__face" data-hsvg-kind="part" data-hsvg-role="keep-inside keep-clear" x="120" y="20" width="60" height="60" fill="none"/>
```

Today's `data-hsvg-region` is `E-WORD-RENAMED`: `fit` is `data-hsvg-fit`, `layout-plan` is `data-hsvg-fit="items"`,
`video` is `data-hsvg-fit="video"` and `repeat` is `data-hsvg-repeat`. Today's `data-hsvg-safe-area` is the same words
in `data-hsvg-role` (D33) (files).

Route places and video boxes are core drawing words (D28): a drawing may carry them whatever its `needs`. A route place
or video box that nothing in the content names is ignored by the engine; the checker warns. `W-PLACE-UNUSED` (files).

- **Rectangles only.** Slots, boxes and protected areas drawn as `<rect>` carry no `transform` (rotated boxes are not
  places in 2.0). Slots, `items` and `video` boxes and protected areas paint nothing: `fill="none"` and no stroke. A
  text's fit box may be painted (D38). `E-PLACE` (files).
- **Resizable slots.** A `<rect>` slot or box may take its size from a `scale` binding as `box` (6.8) while playing; what is
  placed in it chooses again for its new space (7.4). A `<g>` slot has no box and is not resized. A resize handle is a
  pair of sliders (5.11), width and height, drawn as handles: it works by mouse and by keys. There is no other
  resize control.
- **Slots are empty.** A slot `<g>` holds no children; a preview placeholder sits beside it, marked
  `data-hsvg-layer="decoration"`. Kinds of slot (stage, widget, overlay, dialog) are declared in the shell document
  (section 10); a scene mounts into a `<rect>` slot. `E-PLACE`, `E-SHELL-SLOT` (files).
- **A clip moves a `<g>` slot,** and the use mounted in it moves too. A `<rect>` slot carries no transform, so a clip
  track on it is `E-PLACE` (files).
- **A screen drawing's viewBox is a `keep-inside` protected area** of its own (6.6).
- **Repeat capacity** is the number of child slots. Every frame where the whole list shows has at least the
  list's `maxItems` slots.
  `E-REPEAT-CAPACITY` (files).
- **Places outside the drawing.** A place on the host page is a page hook (`data-hsvg-hook`, section 10), never a mark
  in a drawing. A page hook of kind `obstacle` is the host-page form of a `keep-empty` protected area.

## 5.11 Controls

A part reacts when it is the target of a **control**: a part of the block's own drawing, named by its local id (a use reacts through its own controls). Controls are declared in the owning block's JSON, in the
`controls` map; the map key is the control's id. Every control source writes through the same typed input path:
type, bounds and rules (5.3, 8).

```json
"controls": {
  "onward": {"kind": "button", "target": "onward", "event": "onward", "keys": ["KeyN"], "enabled": "delivered",
             "label": "{{ words.onward }}", "disabledLabel": "{{ words.deliverFirst }}"},
  "bell":   {"kind": "toggle", "target": "bell", "value": "bellOn", "label": "Bell"},
  "answer": {"kind": "choice", "value": "picked", "event": "answered",
             "options": {"a": {"target": "answer-a", "value": "'a'"}, "b": {"target": "answer-b", "value": "'b'"}}},
  "speed":  {"kind": "slider", "target": "speed-handle", "value": "speed", "axis": "x", "range": [0, 240], "positions": 5},
  "heat":   {"kind": "dial", "target": "knob", "value": "share", "range": [-135, 135]},
  "parcel": {"kind": "drag", "target": "parcel", "drops": ["basket"], "accept": "event.drop === 'basket'",
             "event": "dropped", "missEvent": "missed", "picked": "parcelPicked"}
}
```

A control's `kind` is one of six words (D33). Each setting list puts its default first.

- `button`: pressed. It queues its `event`, by default `press:<target>`.
- `toggle`: on and off. Each press flips its boolean `value`, then queues its event (default `press:<target>`).
- `choice`: picks exactly one of its `options`, and writes that option's `value` into the control's `value`.
  **What a choice sends:** no payload. The option's value is written first, then the `event` is queued, so the
  reaction reads the value. Before any pick the value keeps its `initial`, such as `''` for nothing picked:

  ```json
  "values": {"picked": {"type": "string", "enum": ["", "a", "b"], "maxLength": 1, "initial": ""}},
  "on": {"answered": [{"id": "mark", "guard": "picked === 'a'", "actions": [{"set": "score", "to": "score + 1"}]}]}
  ```
- `slider`: slides its target along its `axis`, `x` or `y`, and writes a number.
- `dial`: turns its target about its pivot, and writes a number. It is a slider measured round a centre (D32, D33):
  the same keys, `range` (in degrees), `positions`, `held` and events.
- `drag`: picked up and dropped on its `drops`.

An old kind is `E-WORD-RENAMED` with the final form: `press` is `button` (with `checked`, a `toggle` whose `value` is
the old `checked`), `option` is `choice`, and a slider with `"axis": "angle"` is a `dial`. So are the common wrong
guesses: `"type"` for `"kind"`, `knob` or `wheel` for `dial`, and `options` with no `kind` (it is a `choice`) (11.5).

| Key | Kinds | Meaning |
|---|---|---|
| `kind` | all | `button`, `toggle`, `choice`, `slider`, `dial` or `drag`. The core list is closed (a new core kind is a core word, D27 rule 2). An add-on's control kind is `<add-on>.<kind>`, declared in its manifest's `controls` and needing the add-on in `needs` (D39, 12.5): `"kind": "example.steps.stepper"`, with `target`, `value`, `label`, `disabledLabel`, `enabled`, `event` and `keys`. |
| `target` | button, toggle, slider, dial, drag | Required. The local id of the part that reacts. |
| `label`, `disabledLabel` | all | Templates (section 5) giving the accessible name, and the reason when disabled. |
| `enabled` | all | A boolean formula; default `true`. |
| `event` | all | The event queued on activation; default `press:<target>` for a button and a toggle. |
| `keys` | button, toggle, choice options | Shortcuts from the fixed key set of 5.12, unique among live controls. |
| `held` | button, toggle, slider, dial | A boolean body value, true while the control is held. A slider's or dial's is true from a pointer or touch press until its release or cancel, never from keys (a value bubble shows only while held). |
| `value` | toggle, choice, slider, dial | A toggle's: a boolean body value of the block that each press flips, before the event is queued; actions may also write it. The toggle is a checkbox (`aria-checked`), and shows its `selected` variant while the value is true: a checkbox or an on and off chip. It may be used with `held`. `E-TYPE` (files) when it does not name a boolean value of the block or a boolean knob. A choice's, slider's or dial's: the block's own value (section 5) written before the event, or a person's setting as `player.setting` names one (5.15): a drawn sound slider or settings switch. Any of the four may name a **knob** of the experience (5.3.2): the control then writes the knob, as a person's change (human-only); every block hears `changed:<knob>` and the host hears `hsvg.changed` (10.6). **The latest change wins (D45):** a host `set` after a press takes effect, and so does a press after a host `set`. So an asset's knob and its own drawn control share one value, with no copy. |
| `options` | choice | Required. Option id to `{target, value, enabled?, label?, keys?}`; `value` is a formula of the value's type, with text in single quotes (D36). An option's position, from 1, is its target's place in document order among the control's options. The control's `enabled` covers every option; an option's own `enabled` only disables it further, and its `keys` select it. |
| `axis`, `range`, `positions` | slider, dial (no `axis`) | A slider's travel axis (`x`, the default, or `y`), travel `[start, end]`, optional number of positions. The travel is how far the handle moves from where it is drawn, along its axis, in its parent's units: the solar system's `[0, 256]` runs from the handle's drawn place to 256 units along x, in every layout and at every size. It lies inside the handle's motion range for that axis (`translate-x` or `translate-y`); `E-RANGE` (files). The travel maps linearly onto the bounds of the number `value`: start gives its minimum, end its maximum; with `positions`, the value snaps to that many evenly spaced values. A dial turns its target about the target's pivot, and `range` is the turn in degrees from where the target is drawn, clockwise positive as SVG `rotate`: the oven's `"heat": {"kind": "dial", "target": "knob", "value": "share", "range": [-135, 135]}` turns its knob from 135° left of its drawn angle to 135° right. The span is more than 0 and at most 360; the target has a pivot (`E-PIVOT`) and a `rotate` motion range that holds the range, or `rotate *`; `E-RANGE` (files). |
| `valueText` | slider, dial | A template (section 5) giving the spoken value, such as `"{{ numberText(amount, 0) }} °C"`: the engine writes it as the control's `aria-valuetext` and keeps it fresh when a name it reads changes. Without it the value is spoken as the number. A label that reads its own `value`, directly or through a computed value, is `W-LABEL-HAS-VALUE` (files): the value would be spoken twice. |
| `drops`, `accept`, `missEvent`, `picked`, `snap` | drag | Allowed drop targets, each a part of the same drawing (`E-REF-UNKNOWN`, files), a formula tested at release, the event for a drop that `accept` refuses, a boolean value of the block that is true while the item is picked up, and whether an accepted item stays on its drop (default `false`). |

Only a button and a toggle have a default `event`; another control without `event` writes its value and queues nothing.

A drawn part that looks like a button (its role is `button`, `close` or a word of the action group such as `action`,
`next` or `answer`, or its `data-hsvg-label` says "button") needs a control on it, on a part around it, on a part
inside it, or on a hit part that follows it. Without one it is `W-CONTROL-DRAWN` (files): a button nothing presses.

- **Drops.** A drop lands on the first of `drops` whose box holds the pointer (or the keyboard's current drop) at
  release. `accept` is read then, with `event` = `{drop}` (the drop id, or `""` for none). A refused or missed drop
  returns the item home and queues `missEvent`. A finger drag works as a mouse drag: the item follows the finger, and
  the page does not scroll while it is held. **[playing]**
- **Snap.** Without `snap` every release returns the item home, and bindings show what the drop changed. With
  `snap: true`, an accepted item moves so its box centre sits on the drop's box centre, and stays there until it is
  picked up again or its block enters afresh. If the drop moves (a clip or a binding), the item follows it. Where it
  rests is the control's own state, kept and rolled back with the block like a clip's pose. **[playing]**
- **The slider's path.** The band the handle sweeps along its travel (its drawn box, stretched along the axis over the
  travel) is the slider's hit area, so a bar drawn under the handle answers with no word of its own. A press anywhere
  on the band, not on another control drawn above it, moves the handle so its centre is under the pointer, sets the
  value and focuses the slider. A press on the handle itself grabs it where it is: it does not move, and the value does
  not change. While held, the handle follows the pointer along its travel (clamped to it), and the value changes as
  the pointer reaches each stop (with `positions`) or at once (without). A finger drag on the path does not scroll the
  page. On release the handle settles on its value's place with a short glide; under reduced motion it moves at once.
  **[playing]**
- **A dial turns a part.** Its hit area is the disc the target sweeps about its pivot (the
  farthest corner of the target's drawn box from the pivot, at least 22 CSS pixels in radius). A press anywhere on the
  disc grabs the part where it is: it does not turn, and the value does not change. While held, the part turns by as
  much as the pointer has gone round the pivot since the press, added up move by move, so crossing the 180° line or the
  gap of a 270° travel never jumps; it stays at an end while the pointer goes past it, and comes back when the pointer
  does. Moves within 8 CSS pixels of the pivot are ignored. A tap (released within 300 ms and 4 CSS pixels, outside
  the inner 40% of the disc, at an angle inside the travel) turns it to that angle: the drawn angle points from the
  pivot to the target's box centre, or up when the target is centred on its pivot. Keys, settle and touch are the
  slider's. **[playing]**
- **One writer.** The author's binding places the handle from the value; the control writes no channel. While held,
  the player shows the handle at the pointer by one move over what the binding wrote, measured against it at every
  paint, and lets that move glide away on release. So the handle rests where its binding puts it, and a handle with no
  binding returns to where it is drawn. A handle that follows a leader (6.2.1) moves its leader. For a dial
  the move is one outer `rotate` about the pivot, over the `rotate` the binding wrote; a clip track on that `rotate`
  is `E-WRITER` (files). A slider or dial whose part no binding of its channel (a `move` on the slider's `axis`, or a `rotate`) moves
  from the value does not show its value at rest: `W-CONTROL-STILL` (files). **[playing]**
- **Slider positions.** Without `positions`, an arrow moves a tenth of the range, so the value can be any number between its bounds; a value written by such a slider and compared with `===` or `!==` gives `W-SLIDER-EQUALS` (files). `positions` is an integer 2..1000, or a formula
  that reads the block's names (usually its inputs, such as `clamp(round((maximum - minimum) / step) + 1, 2, 1000)`),
  truncated to an integer and read again when a name it reads changes; the checker proves it lies in 2..1000 (5.6.7),
  else `E-RANGE` (files). A change of `positions` does not rewrite the stored value; the next move snaps to the new
  stops. A key outside the 5.12
  set, Tab or Escape as a key, or a key used twice among live controls is `E-KEY-CONFLICT` (files).
- **Targets are parts** (or screen-drawing component roots, 4.1) of the block's own drawing, present in every
  frame. `E-REF-UNKNOWN` (files).
- **Keyboard and pointer share one path.** Button and toggle: pointer, Enter, Space and its keys. Choice: one tab stop (while
  focus is inside the group the focused option holds it, so Tab goes on to the next control; when focus leaves, it goes
  back to the checked option, else the first usable one); arrows
  move and wrap, Home and End jump, Enter and Space select; hidden and disabled options are skipped. Slider and dial:
  ArrowRight and ArrowUp move one stop towards `end`, ArrowLeft and ArrowDown one towards `start`, Page Up and Page
  Down a tenth of the travel (whole stops with `positions`, at least one), Home and End jump. Drag: Enter or Space picks up and drops, and arrows move between the shown `drops` while held (a hidden drop is no stop), while a polite live region names the drop the item is over (its label, else its text); the item is `aria-pressed` and shows its `pressed` variant from the moment it is picked up (by a key, a tap or a press) until it is dropped or Escape lets it go; Escape cancels and returns the item home; a cancel queues no
  event. Tab and Escape cannot be control `keys`: Tab moves focus, and Escape cancels a drag or closes a dialog
  (playing).
- **The engine writes the semantics.** It gives each target its role, tab stop and ARIA state (`button`, `checkbox`
  for a toggle, `radiogroup` and `radio` for a choice, `slider` for every slider and dial, a grabbable item). Authors write none (6.5) (playing).
  Each choice is one `radiogroup` named by its `label` and disabled while the control is: the nearest element
  that holds all its options and no other control target, else an engine-made element just before the first option
  that owns them (`aria-owns`). A part named with `data-hsvg-label` that holds a control target is a named group, not
  an image (6.5).
- **Where keys are heard.** A player hears keys while focus is inside it, or while nothing on the page has focus
  and it is the player a person used last (the first mounted, until a person points at another). A key typed into any
  other element of the host page is never heard, and a player never stops a key it does not hear (7, 10.4). **[playing]**
- **Focus order is document order** of the targets in the mounted drawing, uses expanded in place (6.5).
- **Focus stays.** A control that becomes disabled keeps focus and is announced as unavailable. Focus moves only when
  its target is hidden or removed: to the next usable control in document order, else the previous one, else the
  stage scene's first. When that control is a choice, focus lands on its group's stop: the checked option, else the
  first. This is the successor that rule `focus` checks (playing).
- **Control variants.** When a target part has variants named `idle`, `hover`, `pressed`, `selected`, `focus` or
  `disabled`, the control shows them, in the priority disabled, pressed, selected, focus, hover, idle; a missing
  variant falls through to the next. The `focus` variant, like the player's focus ring, follows the `:focus-visible` rule: it shows while the
  target has focus and the person's last input was a key (Tab, an arrow, a key that opened a dialog), not after a mouse
  or touch press, also when the player then moves focus itself (a new step's first control). A key pressed after that
  shows it again. **[playing]** Every control kind shows `pressed` while it is held. An option of a choice shows
  `selected` while it is the chosen option (its value is the control's value, `aria-checked`), so a chosen option is
  drawn by the control itself; the player's focus ring still marks a focused option. A toggle shows
  `selected` while its value is true. The
  control then owns the part's variant channel; a competing `variant` binding or clip track is refused. `E-WRITER` (files).
- Hit targets are at least 44 CSS pixels each way at the smallest supported size (rule `hit-target`, A11.10, which
  states its proof; the 2.0 checker reports it `not-run`).
- A hidden or disabled control cannot activate and leaves the focus order (playing). An enabled control shows the
  pointer cursor on its target and its hit area (a slider's band, a dial's disc); a disabled one shows the
  default cursor there (playing). An option whose target a
  `visible` binding hides is hidden in every player, the Node test player included.

## 5.12 Events

An **event** is a named thing that happened, with an optional payload. Events are queued (9.2) and heard in `on` maps.

| Event | When | Payload (`event`) |
|---|---|---|
| `press:<target-id>` | A button or toggle without its own `event` is activated | none |
| a custom name, such as `answered` | `emit`, a control's `event` or `missEvent`, a clip marker | the `with` map |
| a trigger input's name | The trigger is fired (5.3.3) | its declared payload |
| `changed:<name>` | A value or input is different after an action list than before it, or an ambient input changed (net change, 9.2: writing the same value, or writing a value and writing it back, queues nothing). An author's name hides the ambient input's change (5.9) | none |
| `changed:hsvg.<name>` | An ambient input changed, even where an author's name hides it (5.9) | none |
| `paused`, `resumed` | The stage slot's clock that holds this block paused or runs again (3.10) | `{reason}`: `dialog`, `hidden`, `host`, `authored`, or a reason an add-on gives |
| `ended:<id>` | A clip run ended | `{interrupted}`: always present, `true` when stopped or replaced |
| `key:<code>`, `keyUp:<code>` | A key from the fixed set: KeyA–KeyZ, Digit0–Digit9, Space, Enter, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ShiftLeft, ShiftRight | none |
| `<use-id>.<event>` | A use emitted one of its output events | its payload; repeated uses add `itemKey` |
| `save:invalid`, `save:unavailable` | Stored data was refused or storage is missing (5.1.2) | none |
| `audio:started`, `audio:ended` | A sound started or ended (6.10) | `sound` |
| `returned` | A visit returned to this scene (3.7) | `scene`: the visited scene |
| `signal:self:visible`, `signal:self:hidden` | The player's box crossed half in view (10.4); granted under `signals` | none |
| `<addon>:<event>`, `<addon>:<event>:<subject>` | An add-on's event, such as `physics:landed:parcel` (10.7, chapter 12) | declared by the add-on |

- Custom names are camelCase, and never one of the bare built-in events `paused`, `resumed` and `returned`; a built-in event added after 2.0 is `hsvg:<name>` (5.9). `E-NAME-RESERVED` **[files]**
- Every `on` key names a producer in the same block, a built-in event, a trigger input, a
  use's output event or record (`<use-id>.<record>`), a granted signal or a declared add-on event. Computed values emit no `changed:` event. `E-REF-UNKNOWN`
  **[files]**
- An emitted event with no listener is allowed. There are no DOM events, no `enter` event and no repeated keydown.
  Tab and Escape stay reserved for navigation. **[files]**, **[playing]**
- `event` is readable only during that event's reactions. It never becomes a stored value. **[files]**
- Controls (the *reacts* job, 5.11) produce `press:<id>` or their declared event. A toggle, choice, slider, dial
  and drag write their value first, then queue their event.

An add-on block names the add-on in `needs`, keeps its settings in `addons.<name>`, calls `<name>.<verb>` and hears
`<name>:<event>:<subject>` (D34). The physics add-on, for a ball the person throws:

```json
"addons": {"physics": {"bodies": {"ball": {"target": "ball", "shape": {"kind": "circle", "radius": 20},
                                           "origin": [120, 400], "rest": [0, 0], "bounce": 0.3, "floor": 420}}}},
"on": {
  "press:throw":        [{"id": "toss", "actions": [{"call": "physics.throw", "with": {"body": "'ball'", "vx": 500, "vy": -500}}]}],
  "physics:rest:ball":  [{"id": "landed", "actions": [{"set": "flying", "to": false}]}]
}
```

with `"needs": ["physics"]` in the experience.

**Output events.** A block lists the events it reports in its `outputs` map (5.4) as entries of kind `event`, with
an optional `payload` of an object type:

```json
"outputs": {
  "onward":   {"kind": "event"},
  "answered": {"kind": "event", "payload": {"type": "object",
               "properties": {"choice": {"type": "string", "maxLength": 16}},
               "required": ["choice"], "additionalProperties": false}}
}
```

- An `emit` of a declared output event is heard inside the block first, then queued to the parent as
  `<use-id>.<event>`. A scene's output events are its **outcomes**: its own reactions run, then the story graph
  picks a link (3.3). **[playing]**
- The payload is checked against its type. `itemKey` is reserved: an authored payload may not supply it. `E-TYPE`
  **[files]**, **[playing]**
- A scene's or the shell's event that the experience declares as an output event also reaches the host as that
  experience output (10.6), whether the block declares it or not and whether a link hears it or not, its payload
  checked against the experience's type, as a scene's record row reaches the experience's record (5.16). This is how an asset sends its
  events (D45). **[playing]**
- Emitted events that are not declared outputs stay inside the block. The engine also reports four built-in
  experience outputs: `entered` and `ended` (3.2), `openUrl` with `{field, with}` from `player.openUrl` (10.4), and `firstInput`, the first trusted press, key press or pointer-down in the player, reported once per run (10.4). Their names
  are reserved in every block (5.9). **[files]**

## 5.13 Reactions

A **reaction** runs actions when an event arrives. `on` maps an event to an ordered list of reactions. Each has
`actions`, an optional `guard` (a boolean formula, default true) and an optional `id` (2.1 rule 4). The root lists `entry` and `exit` run when the
block becomes active and when it is removed.

```json
"on": {
  "answered": [
    {"id": "right-answer", "guard": "picked === question.answer", "actions": [
      {"id": "add-point", "add": "score", "by": 1},
      {"id": "log-right", "record": "answers",
       "with": {"question": "question.id", "choice": "picked", "correct": "true"}}]},
    {"id": "wrong-answer", "actions": [
      {"id": "log-wrong", "record": "answers",
       "with": {"question": "question.id", "choice": "picked", "correct": "false"}}]}
  ]
},
"entry": [{"id": "clear-score", "set": "score", "to": 0}]
```

- **Only the first reaction whose guard passes runs.** Put related work in one action list. This replaces the old
  runtime rule that ran every matching rule (A13.5). **[playing]**
- Root reactions run after the block's machines (5.14) and have no `target`. **[files]**
- Exit lists may not emit an outcome (3.3) or run a human-only action (5.15.4). `E-NAVIGATION`, `E-HUMAN-ONLY` **[files]**

## 5.14 Machines

A **machine** keeps one active machine state and moves between machine states on events and time. The `machines` list
holds independent machines that run side by side; they are the block's parallel regions. Each has an `id`, unique in
the list (`E-ID-DUPLICATE`). The list order is the order they run: a list, because the order of keys in an object
means nothing (2.1.3).

```json
"machines": [
  {
    "id": "light",
    "initial": "red",
    "states": {
      "red":      {"after": [{"id": "turn-green", "delayMs": "redMs", "target": "green"}]},
      "green":    {"on": {"press:cross": [{"id": "start-crossing", "guard": "carCount === 0", "target": "crossing"}]},
                   "after": [{"id": "turn-red", "delayMs": 4000, "target": "red"}]},
      "crossing": {"entry": [{"id": "walk", "play": "walk-across"}],
                   "on": {"ended:walk-across": [{"id": "safe", "target": "red",
                          "actions": [{"id": "report", "emit": "crossedSafely"}]}]}}
    }
  }
]
```

A machine and each machine state may have `initial`, `states`, `on`, `after`, `entry` and `exit`. A transition is
like a reaction, with an optional `target`, and its `actions` are optional too. Unlike a reaction, a transition in `on`
always has an `id` (a kebab-case name), so a test or a trace can name it: `"on": {"next": [{"id": "to-done", "target":
"done"}]}`. Without one it is `E-KEY-REQUIRED`. A timer in `after` needs no `id`.

- `initial` is required on a node with children and names a direct child; it is forbidden on a leaf.
  `E-MACHINE-INITIAL` **[files]**
- A `target` names a machine state of the same machine. To affect another machine, emit an event it hears.
  `E-MACHINE-TARGET` **[files]**
- There are no history states, final states, eventless transitions or wildcard events. **[files]**
- **Dispatch.** For each machine in list order, look in the active leaf's `on`, then its ancestors, until one
  guard passes; that transition runs. Guards see writes made by earlier machines for the same event. The root `on`
  runs last. **[playing]**
- **Transition order.** Exit from the active leaf up to, not including, the least common proper ancestor of the state that
  holds the transition and its target, cancelling owned
  timers before exit lists run; run the transition's actions; enter toward the target and its initial children,
  parent first. A transition to itself or to an ancestor exits and enters again. A transition without `target` runs
  its actions only. **[playing]**
- **Timers.** `after` is a list of transitions with `delayMs`, a formula evaluated once on entry, proven within
  1..3,600,000 (5.6.7). Each timer fires once per entry and is cancelled on exit. A timer whose guard fails at its
  deadline is used up. Timers due at the same time fire in scheduling order (3.10). Repeat with a self-target; a
  repeating 100 ms timer re-arms from its due time (the next deadline is the old one plus the delay). There is no
  `every`. Timers count on the owner's local clock (3.10). A machine timer is a time limit for a person: its delay
  is multiplied by the person's `timeLimits` setting (5.5, 10.13), and 0 holds it off; a change applies at once to
  waiting timers. **[files]**, **[playing]**
- `active('green')` reads whether a machine state is active. Do not mirror a machine in a second value. **[review]**
- Lesson steps are sibling machine states with Next and Back transitions. A choice's selected option is a value; its
  progress (asking, hint, resolved) is a machine.

## 5.15 Actions

An **action** is one operation. Every action has exactly one operation key, and an optional `id` (2.1 rule 4);
there are no combined actions.
The core actions below are the only operation keys. An add-on adds no operation key: its actions are calls
(`call`, 5.15.3). Each action is marked if it needs a grant (10.5) or a person (5.15.4).

### 5.15.1 Core actions

There are eight actions (D33): `set`, `if`, `emit`, `play`, `stop`, `open`, `close` and `call`. Where a setting lists
its values, the first listed value is the default.

| Operation | Keys | Effect on values | Effect on outputs and drawing |
|---|---|---|---|
| `set` | `set`, `to` | Writes a whole body value. Its formula can add (`"score + 1"`) or flip (`"!music"`) | `changed:<name>` |
| `if` | `if`, `then`, optional `else` | Runs one branch | |
| `emit` | `emit`, optional `as`, `with`; `itemKey` as a trigger | | `as` is `event` (queues an event; a declared output event also leaves the block, 5.12), `record` (adds a row to a record output, 5.16) or `trigger` (fires a use's trigger input: `{"emit": "mascot.celebrate", "as": "trigger"}`, `<use-id>.<trigger>`) |
| `play`, `stop` | `play` or `stop`; `play` takes an optional `as`; `stop` takes an optional `keep: true` | | `play` `as` is `clip` (starts a clip again, 6.7) or `sound` (plays a sound, its name a formula, in `group` `sounds` or `voice` at `volume` 0..1, 6.10). `stop` stops a clip; `keep` leaves its parts where they are |
| `open`, `close` | a dialog slot id | The slot's `openValue` | Shows or hides a shell dialog (10.1); a scene or the shell may run it |
| `call` | `call`, `with`; `to` for a logic module | A module's results to values (`to`, 12.4) | An add-on's call (5.15.3), or one of the player's own calls below |

**The player's calls.** The built-in name `player` reaches the person and the page. It needs nothing in `needs`. Each
`with` entry is a formula, with text in single quotes.

| Call | `with` | Effect |
|---|---|---|
| `player.openUrl` | `field`: the quoted name of a `url` content field of the block that runs it, or of the experience (5.3.1); the other entries are query parameters | Reports the experience output `openUrl` with `{"field": "<field>", "with": {...}}`; the host or export adapter opens the field's address, adding the parameters where its profile allows (10.4). Human-only. |
| `player.setting` | one entry: the setting and its value | Writes a knob that a settings item with `when: "play"` names, or the ambient `muted`, `volume`, `voice`, `reducedMotion` or `timeLimits` (`{"call": "player.setting", "with": {"voice": true}}`), or a knob the experience's `audio` `groups` or `mutes` names (6.10). Any other name is `E-WRITE-INPUT`. A person's own setting, from a drawn control (a sound switch in a scene's panel). Human-only. |
| `player.resetSaved` | optional `settings: true` | Clears the whole experience's `session` and `saved` values and graph memory (5.1.2); with `settings`, also restores every knob a settings item names |
| `player.attach` | `part`: a quoted use; `to`: a quoted slot (`'bike.basket-point'`), or `null` (or the use's home slot) to take it off | Changes the attachment state: puts a use on a slot and back (6.9) |

```json
[{"id": "point", "set": "score", "to": "score + 1"},
 {"id": "bonus", "if": "score > 2", "then": [{"id": "cheer", "emit": "cheered"}]},
 {"id": "load", "call": "player.attach", "with": {"part": "'parcel'", "to": "'bike.basket'"}},
 {"id": "ring", "play": "'bell'", "as": "sound", "volume": 0.6}]
```

An old action is `E-WORD-RENAMED` with its final form (11.5): `add` and `toggle` are `set` with a formula; `trigger`
and `record` are `emit` with `as`; `sound` is `play` as a sound, with `volume` for `gain`; `attach`, `detach`,
`openUrl`, `setting` and `resetSaved` are the player's calls.

- Lists run in order. Each write is checked, and dependent computed values are updated before the next action.
  **[playing]**
- An operation key names a thing (a value, an event, an id); `if`, a sound's `play`, the entries of `with`, and `to`
  in `set` are formula slots, text in single quotes (D36, 5.6.1). A module `call`'s
  `to` names values.
- `entry` and `exit` hold action lists directly; `on` holds reactions, each with its own `actions`. On entry the root
  `entry` runs first, then the machines enter in list order; on exit the machines exit in reverse list
  order, then the root `exit` runs.
- An action writes only its own block's body values (5.1.3). `play` (a clip), `stop`, `open` and `close` name ids,
  never formulas. Behaviour never names an address: leaving goes through `player.openUrl`. **[files]**
- **Navigation is not a block action.** A scene reports an outcome by emitting an event (declared, or inferred when a link
  hears it, 3.3); a link in the story graph fires on it. Reporting an outcome is not terminal: the reaction finishes first. The earlier `go`,
  `visit` and `return` actions become links (A13.11).
- There is no imperative show, hide or variant action: a value and a binding (6.8) do that job.

### 5.15.3 Calls

An add-on's action is a call: `{"call": "<name>.<verb>", "with": {...}}`, checked against the add-on's manifest
(chapter 12). Each `with` entry is one formula per input. A call names an add-on that `needs` names; otherwise it is
refused (`E-NEEDS-MISSING`). A call has no `to` unless it calls a logic module (12.4): an add-on's answer comes back
as its event. **[files]**

### 5.15.4 Human-only actions

`player.openUrl`, `player.setting` (except turning `voice` off), and the calls an add-on's manifest marks
`humanOnly`, are **human-only** (10.5).

- A human-only action runs only in a transaction started by trusted person input on this player: a real press, key
  or pointer gesture. Timers, links, markers, host messages, AI answers and synthetic events cannot start one;
  otherwise the transaction faults with `E-HUMAN-ONLY`, including an agent's or program's input that leads to one. **[playing]**
- The checker follows every path from sources other than a person and reports one that can reach a human-only
  action. `W-HUMAN-ONLY-PATH` **[files]**

## 5.16 Records

A **record** is an output stream of typed rows that a block reports, such as answers in a lesson. Records are
`outputs` entries of kind `record` (5.4).

```json
"outputs": {"answers": {"kind": "record", "maxRows": 64, "row": {"type": "object", "properties": {
  "question": {"type": "string", "maxLength": 32}, "choice": {"type": "string", "maxLength": 16},
  "correct": {"type": "boolean"}}, "required": ["question", "choice", "correct"], "additionalProperties": false}}}
```

- An `emit` as a `record` supplies in `with` exactly the row's properties (files); the row's types and bounds are checked,
  and the row published, when the transaction commits (playing). **[files]**, **[playing]**
- The engine adds `atMs` (engine clock), `seat` (the seat whose input started the transaction, or `none`) and `filler`
  (`human`, `agent`, `program` or `none`); these three names are reserved in row types (`E-NAME-RESERVED`). **[playing]**
- A record declares both `maxRows` and `row`. A row beyond `maxRows` (1..1024 per run) faults the transaction. `E-RANGE` **[playing]**
- Records are write-only for their block. To remember rows, also `set` a `saved` array to `append(...)` (5.6.4).
  **[playing]**
- Records only grow: no action removes a row. Undo is authored state: keep
  the moves in a value (an `append`ed history), and undo by setting values back from it; a record row once published
  stays published. **[playing]**
- A parent hears a use's rows as the event `<use-id>.<record>` with the row as payload. No row may depend on a
  presentation source (5.8). **[files]**
- **An experience's records.** The scenes and the shell add rows to the experience's own records with `record`, as
  they write its values (5.1.3), with `emit` as a `record`. The host hears each row through `player.on` (10.6), and results adapters read the same
  rows (A10.1). No grant is needed: a record is part of the outputs face, and it goes no further than the host. A
  record declared on a scene stays inside the experience. **[files]**, **[playing]**
