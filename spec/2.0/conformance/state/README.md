# State fingerprint conformance files

These files test a writer of the state fingerprint (9.6.1). Added after `2.0.0-next.0`.

Each `.json` file but `expected.json` is one state document, written with line breaks for reading. `expected.json`
gives, for each file:

- `fingerprint`: `sha256:` and the hex SHA-256 of the document's canonical JSON;
- `bytes`: the UTF-8 length of the canonical JSON;
- `canonical`: the canonical JSON itself, for a short document.

A writer in another language passes when it parses each file and gives the same `fingerprint` (and the same
`canonical` text where one is given).

- `minimal.json`, `numbers.json`, `strings.json` and `order.json` are written by hand. They test the canonical form:
  the number form, string escapes, key order by UTF-16 code units (an emoji key sorts before `U+FB33`) and `-0`.
- `harbour-start.json`, `harbour-sailed.json` and `harbour-later.json` are the state of a real play (the guide's
  harbour) after a few moves. They show the shapes of a block record, the story and a machine timer.
- `harbour-first-input.json` is the state after the start, a `firstInput` move and the gate's press: it shows the key
  `firstInput`, present once the run has reported it (10.4).

## Run

```sh
node engine/v2/tools/make-state.mjs           # writes the files again
node engine/v2/tools/make-state.mjs --check   # exit 1 when a file differs
node engine/v2/tests/run.mjs r1-replay        # the engine against these files
```
