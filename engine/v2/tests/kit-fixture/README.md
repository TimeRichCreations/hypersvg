# The core kit fixture

A small kit and one story that pins it. The engine tests of kits and changes use it in the core release
(`w5k-kits`, `v1-change`, `y2-change`). The kit ads (`examples/2.0-kit-ads`) come with the add-ons release.

- `kits/tale-kit/`: version 1.0.0. Three blocks (`title`, `badge`, `button`), one scene definition (`page`, 400 by 300),
  one kit input (`teller`), two themes, one role word (`page-number`), three rights and its words.
- `tales/fox-tale/`: a story of two pages, `first` and `last`. Each is a use of `page`. The button on the first page
  turns to the last.

Check it from the repository root:

```sh
node engine/v2/tools/check.mjs engine/v2/tests/kit-fixture/tales/fox-tale
```
