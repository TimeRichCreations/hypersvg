# Proof formats (2.0)

Both are JSON. Hashes are SHA-256 with the prefix `sha256:`. Canonical JSON sorts object keys and keeps arrays in
order.

## proof-trace/2.0

```json
{
  "format": "proof-trace/2.0",
  "product": {"id": "drag-sort", "folder": "skill/2.0/examples/recipes/drag-sort", "title": "Sort the rubbish"},
  "fingerprint": "sha256:…",
  "start": {"viewport": {"width": 800, "height": 500}, "reducedMotion": true, "storage": "empty", "stepMs": 100},
  "acts": [
    {"t": 0, "act": "drag", "control": {"role": "button", "name": "Apple core", "id": "sort__apple", "addr": "sort", "cid": "apple"}, "drop": "compost-bin", "via": "keyboard"},
    {"t": 500, "act": "advance"}
  ],
  "checkpoints": [{"label": "mount", "scene": "sort", "time": 0, "values": "sha256:…", "outputs": [], "error": null}],
  "expect": {"scene": "sort", "time": 500, "values": {}, "error": null, "visitedScenes": ["sort"]},
  "network": []
}
```

- `fingerprint` is the digest of the packed HTML bytes. A trace replays only on the same bytes.
- `t` is the engine time in whole ms. Each input first moves the clock by `t` less the time now, in steps of at
  most `start.stepMs` (100, as the page's own clock moves; 0 means one step).
- Acts: `activate` (by `keyboard`, with an optional `key`, or by `pointer`), `drag` (with `drop`), `key`, `advance`.
- A control is named by role and accessible name. A player control also has `addr`, `cid`, `option` and its DOM
  `id`; the replay checks all of them before it acts. A widget has `widget: true`.
- One checkpoint at mount and one after each input: scene, time, the digest of every block's values and inputs, the
  outputs heard since the last checkpoint, and the error.
- Replay compares every checkpoint and `expect`. An engine error fails a replay even when it matches.

## proof-guide/2.0

```json
{
  "format": "proof-guide/2.0",
  "product": "harbour-post",
  "areas": [
    {"name": "race-clean", "steps": [
      {"use": "hub#sign-race-control-1"},
      {"wait": 5000},
      {"use": "race-track#duck-button-control-1", "optional": true},
      {"use": "keeper-study#drag-map-control-1", "drop": "desk-map"},
      {"use": "tutor-demo#cadence-knob-control-1", "key": "ArrowRight"},
      {"key": "Space"}
    ]},
    {"name": "from-a-trace", "trace": "traces/area.json"}
  ]
}
```

- An area has `steps` or a `trace` (a `proof-trace/2.0` file, relative to the guide; its acts are played).
- `use` names a control by its key: `addr#cid`, `addr#cid=option`, or `widget:<role>:<name>`. The input is the
  explorer's keyboard use of it (Enter, Space, ArrowRight, a drag to `drop`), or `key` after Tab. Then the clock
  settles (`settleMs`).
- `key` presses a key on the page. `wait` moves the clock (whole ms, at most an hour).
- A step that cannot be made stops its area; the certificate's exploration lists it under `guided`.

## proof-certificate/2.0

`format`, `product`, `fingerprint`, `package` (needs, members, members digest), `policy`, `explored`, `status`,
`properties`, `unknowns`, `failures`, `witnesses`, `receipt`, `evidenceHash`.

The `receipt` is an A8.1 receipt with `run: "play-test"`, `subject: "document:<id>"`, the page digest, the date,
the status, and one rule row per property (`proof/finishable`, `proof/keyboard` …, proof kind `playing`). A
property's `pass` and `pass-observed` are `pass` rows, `unknown` is `not-run`, `not-applicable` is `waived`.
