# HyperSVG 2.0 schemas

These files are generated. Do not edit them. Change the machine files (`documents.json`, `vocabularies.json`,
`capabilities.json`, `capabilities/*.json`), with the text and a `DECISIONS.md` entry, then run the generator.

```sh
node docs/spec-2.0-work/tools/schema/make-schemas.mjs spec/2.0      # write the schemas
node docs/spec-2.0-work/tools/schema/check-schemas.mjs spec/2.0     # the one check
```

## What is here

| Folder | What | Made from |
|---|---|---|
| `core/<kind>.schema.json` | One JSON Schema (2020-12) per document kind: the closed key set, types, required keys, the kit and nested experience key sets. | `documents.json` |
| `core/document.schema.json` | Any document: checks the header, then the schema of its kind. | `documents.json` |
| `core/drawing.rules.json` | The drawing rules: allowed SVG, attributes, marks and their values, ids, limits. Drawings are XML, so this is not JSON Schema. | `vocabularies.json` |
| `capabilities/<id>.schema.json` | Each capability's grammar. When `needs` names the capability, its grammar fills its keys in the core schemas. | `capabilities.json`, `capabilities/<id>.json` |
| `addons/<add-on>.schema.json` | One per add-on: its capabilities, the document keys it defines, its authoring-only features and its drawing rules (A3 page marks, A13 mark aliases). | all of the above |
| `examples/` | Valid and invalid documents and drawings. An invalid file's name starts with the code it must fail with. `context.json` gives a file's path in its folder, inherited `needs` and add-ons. | written by hand |

## How a document is checked

1. Strict JSON: one object, no repeated key, no `__proto__`, `prototype` or `constructor` (`E-JSON`).
2. The header: `format` is `hsvg/2.0` and `kind` is a document kind (`E-HEADER`).
3. `needs` names known capabilities (`E-NEEDS-UNKNOWN`) and their dependencies (`E-NEEDS-MISSING`).
4. The kind's schema, with the grammar of every capability in `needs` (the document's own and what it inherits).
   A key a capability owns, used without that capability in `needs`, is `E-NEEDS-MISSING`. Default codes: an unknown
   key `E-KEY-UNKNOWN`, a missing key `E-KEY-REQUIRED`, a wrong type or value `E-TYPE`, a bound passed `E-RANGE`.
5. The id against the file name (`E-ID-FILE`).

The code is in `docs/spec-2.0-work/tools/schema/`: `json-strict.mjs`, `validate.mjs`, `check-document.mjs`,
`xml.mjs` and `drawing-check.mjs` are plain ES modules with no Node imports, so the 2.0 engine uses the same code.

## What the schemas do not check yet

- **The inside of core structures.** `documents.json` gives each structure (`story`, `values`, `controls`,
  `bindings`, …) its JSON type and section only. Their keys are defined in the section text, not in a machine file,
  so the schemas check the type and leave the inside to the engine and the checker. Capability grammars are full.
- **Conditions in words.** `requiredWhen` conditions that are not "the key X is absent/present" or "X is Y" (for
  example `language` when an experience has words resources) are listed under `x-hsvg-notMachineChecked`.
- **Cross-file rules.** References, digests, drawings against their documents, geometry (`E-PAINT`), fit.
