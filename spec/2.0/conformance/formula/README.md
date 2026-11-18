# Formula conformance files

These files test an implementation of the formula language (5.6) and of templates (5.7). Added after
`2.0.0-next.0` (5.6.8).

An implementation passes when it gives the `result` or the `error` of every case, with its `steps`. Reading the
files needs only a JSON parser. No case needs a page, a player or a clock.

## The files

One file per area:

| File | Area |
|---|---|
| `arithmetic.json` | `+ - * /`, unary signs, number literals, precedence, division by zero, overflow |
| `comparison.json` | `=== !== < <= > >=`, `&& \|\| !`, `? :`, laziness, no truthiness |
| `rounding.json` | `floor`, `ceil`, `round` (ties toward +infinity), `clamp`, `min`, `max` |
| `remainder.json` | `%`, the truncated remainder, with negatives and non-integers |
| `random.json` | `pick`, `shuffle`, `random` and the mixer `mix(seed)`, with negative, fractional and very large seeds |
| `text.json` | strings, escapes, joining with `+`, `length` and index by code point, templates |
| `number-text.json` | `numberText` and `formatNumber`: rounding, very large and very small numbers, `-0` |
| `plural.json` | `plural` in several languages, the fallback, words that are templates |
| `lists.json` | array and object literals, members, `length`, `at`, `includes`, `lookup`, `append`, `range` and the row functions `filter`, `count`, `sum`, `minBy`, `fold`, `sort` |
| `maths.json` | `pow`, `sqrt`, `exp`, `log`, `sin`, `cos` |
| `names.json` | names, `hsvg.<name>`, `active`, reserved and refused names, whitespace |
| `errors.json` | grammar errors, the closed function list, the number of arguments |
| `limits.json` | the work limits of 5.6.6: source, tokens, nesting, steps, array items, result size |

## The format

Each file is one JSON object:

```json
{"format": "hsvg-formula-cases/1", "area": "remainder", "title": "...", "spec": ["5.6.3"],
 "cases": [
  {"name": "negative left", "formula": "-7 % 3", "result": -1, "steps": 4},
  {"name": "remainder by zero", "formula": "5 % 0", "error": "E-FORMULA", "stage": "evaluate", "steps": 3}
 ]}
```

A case has:

- `name`: what it tests. Names are unique in a file.
- `formula` or `template`: the source. A template is text with `{{ formula }}` spans (5.7).
- `values` (optional): the names the formula reads, and their values. A name that is not here faults with
  `E-FORMULA`.
- `builtins` (optional): the built-in names (5.9). `hsvg.now` reads `builtins.now`. A bare name reads `values` first,
  then `builtins`.
- `states` (optional): the machine states that are active. `active(id)` is `true` for these and `false` for any other.
- `language` (optional): the active language, a BCP 47 tag. With none, `plural` uses `one` for 1 and `other` for
  any other count.
- `words` (optional): the words of the active language, id to text. `plural` reads `<id>.<form>`. `formatNumber`
  reads `decimalMark` and `groupMark`. A word is a template, expanded in the case's own scope.
- `result`: the value the formula gives. Or:
- `error` and `stage`: the error code, and where it is found. `stage` is `parse` when the source alone is wrong
  (grammar, an unknown function, the number of arguments, the source, token and nesting limits), and `evaluate` when
  it is found while the formula runs. An implementation that checks more before it runs may find an `evaluate` error
  earlier; the code must be the same.
- `steps`: the work steps (5.6.6) the evaluation counted: for a result, all of them; for an `evaluate` error, those
  counted up to the fault. A template counts all its spans and the words they expand. A `parse` error has no `steps`.
  An implementation passes a case only with the same count. Added after `2.0.0-next.0`.
- `platform` (optional): the case's result rests on data or code of the platform. See below.

The work steps of one evaluation start at 0 for each case. A result is also checked against the result size of
5.6.6, as the engine checks every result it keeps. The cases named `steps: …` in `limits.json` show each rule of
5.6.6 on a small formula.

## Comparing results

- Read every JSON number as an IEEE 754 double. Integers above 2^53 in these files are doubles too.
- `-0` and `0` are the same result. JSON cannot tell them apart, and the language cannot either.
- Numbers compare exactly, except in a case marked `math` (below).
- Arrays compare item by item, in order. Objects compare by keys and values, in any key order.
- Text compares by UTF-16 units. There is no Unicode normalization.
- A few cases put a lone surrogate in a formula as a `\u` escape inside the formula's text, for example
  `"length('a\\ud800b')"`. The JSON text itself always holds whole characters: the files never hold a lone
  surrogate escape (`\ud800` alone) in a JSON string, so any language's standard JSON reader can read them (D64).

## Platform tags

- `cldr`: the plural form comes from the platform's CLDR plural rules (2.7). The results were made with CLDR 48.
  The languages chosen have had the same cardinal rules for many CLDR versions, but a platform with other data may
  differ. An implementation without CLDR data uses `one` for 1 and `other` for any other count; it may
  skip `cldr` cases and say so.
- `math`: the result comes from the platform's maths library (`pow`, `exp`, `log`, `sin`, `cos` away from the exact
  points). These functions are not correctly rounded on every platform. A result within 4 units in the last place
  of the one written passes. Why 4: the spec lets each implementation be within 1 unit of the exact result (5.6.4,
  D62), so two implementations that both keep that rule may be 2 units apart, and the written result is one
  implementation's, not the exact one. 4 keeps a margin over 2, so a correct implementation never fails a case
  because the written result was the one off by a unit. A result that decides behaviour should be rounded (the checker's
  note `W-MATH-UNROUNDED`), so these differences stay in drawing (D64).

Cases with no tag are exact on every platform.

## Run

```sh
node engine/v2/tests/run.mjs formula-conformance          # the engine passes every case
node engine/v2/tools/make-formula-conformance.mjs --check   # the files are what the tool makes
node engine/v2/tools/make-formula-conformance.mjs           # write them again after a case changes
```

The cases are written in `engine/v2/tools/make-formula-conformance.mjs`; the engine gives the results. Where the spec
states a result outright, the tool also states it, and stops when the engine gives something else.
