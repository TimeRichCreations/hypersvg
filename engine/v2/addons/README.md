# Add-ons

The add-on door of spec chapter 12 ("Writing an add-on"). An add-on is a folder with `manifest.json` and its files.

## Starter presets (built-in)

Each folder here is a built-in preset with a bare name. This release ships four of them. Use one in a document's
`presets` list:

```json
"presets": [{"use": "wobble", "as": "logo-wobble", "with": {"target": "logo"}}]
```

| Preset | Adds |
|---|---|
| `wobble` | a clip that rocks a part and settles |
| `pop-in` | a clip that grows a part from nothing, on entry |
| `breathe` | a slow looping swell, on entry |
| `gentle-motion` | a theme with slow, soft motion |

The other built-in presets need a built-in capability, so they come with the hypersvg-addons release:

| Preset | Adds |
|---|---|
| `bouncy-ball` | a circle body that drops and bounces on a floor (needs `physics`) |
| `confetti` | a burst of paper bits (needs `effects`) |
| `sparkle` | a few glints that rise and fade (needs `effects`) |
| `snowfall` | flakes that drift down while the block is active (needs `effects`) |

A use of one this release does not hold is refused with `E-ADDON`: the message says it comes with the add-ons
release.

Each manifest's description says which motion ranges its part needs.

## Examples (outside add-ons)

`examples/addons/` holds four outside add-ons. `examples/noughts/` is a game that uses the first three (door 1).
`examples/lamp/` uses the fourth (door 2):

| Add-on | Kind | Door | Does |
|---|---|---|---|
| `example.noughts` | module | 1 | a noughts-and-crosses opponent with a level from 1 to 3 |
| `example.glow` | capability | 1 | a glow around a drawn part that pulses and fades |
| `example.shake` | preset | 1 | a clip that shakes a part |
| `example.tint` | capability | 2 | paints a part's fill; uses `draws`, `contentTypes` and `keys` |

```sh
node engine/v2/tools/check.mjs engine/v2/addons/examples/noughts
node engine/v2/tools/pack.mjs engine/v2/addons/examples/noughts <out> --allow example.glow --allow example.noughts
node engine/v2/addons/examples/addons/example.noughts/tests/noughts.test.mjs
node engine/v2/tools/check.mjs engine/v2/addons/examples/lamp
node engine/v2/tools/pack.mjs engine/v2/addons/examples/lamp <out> --allow example.tint
```

The engine's tests (`tests/x6-addons.test.mjs`, `tests/f1b-door2.test.mjs` and, in a browser,
`tests/browser/x6-addons-browser.mjs` and `tests/browser/f1b-tint-browser.mjs`) copy them to a folder outside
the engine, pin, check, play and pack them.

## Make one

```sh
node engine/v2/tools/addon.mjs new <preset|module|capability> <owner.name> [--in <folder>]
```

## Door 2

New capability add-ons write `"door": 2`. A door 1 manifest keeps working: the engine reads its `channels` as
`writes`. It may not use the door 2 words below.

A capability's `adds` may hold:

- `keys`: the schema of its settings, under `"addons": {"<id>": {...}}` of a block.
- `calls`: one entry per call, `{"with": {schema}}`. Add `"humanOnly": true` when only a person's press may cause it.
  `with` gives only listed inputs and every `required` one.
- `events`: names content hears as `<id>:<name>`. Write `name:<subject>` for an event about one thing; content hears
  it as `<id>:<name>:<subject>`. The add-on emits it with `door.emit(address, name, payload, subject)`. A story link
  may hear an add-on's event of its `from` scene.
- `writes`: keys of its settings whose value names a body value it may write.
- `draws`: `{"binding": {schema}, "text": false}`. A binding `{"target": "<part>", "<id>": {...}}` names the add-on as
  its kind. The add-on is that part's only writer. Its page part reads these with `door.draws(address)`.
- `contentTypes`: `{"<type>": {"type": "string", "maxLength": 64}}`. An input names it as `<id>.<type>`.
- `grants`: the grant kinds of 10.5 it uses.

A `with` input marked `"x-hsvg-names": "<key>"` names an entry of its settings' `<key>` map. When content gives a
quoted literal, the checker proves the entry exists (for example physics's `body` names one of its `bodies`).

The engine door of `install` is a frozen object with only its listed functions. The page door of `attach` is all
`attach` gets: `door.part(address, id)` and `door.slot(id)` give style handles, never page elements. A page with no
host profile is given no grant.
