# A12. Publishing

This is a reference chapter of the tool reference (`reference/README.md`): for people who build editors, hosts,
packers and checkers. A first experience needs none of it.

## A12.1 The open-only test pass and the publish leak check

The spec has open sections and private ones in a private folder that is not published. Tests run twice.

1. **Full pass.** Every checker test, example and play test runs with the whole spec and all private rule packs and
   kits.
2. **Open-only pass.** The same runs with the private folder and every private rule pack and kit removed. Every open
   example and suite must still pass. The private term list is read before the folder is removed; an open document
   or open section that holds a private term fails (`docs/spec-2.0-work/tools/check-spec.mjs` lists them). Dependencies go one way: private may build on open, never the reverse.

**The publish leak check.** Publishing builds the spec without the private folder, by script; the section lists (1.12
and the README) name only open files. The script then scans every
published file for the private term list (`private/terms.json`: names, numbers and phrases) and for links to files
in the private folder. It also scans the text each word and template can produce from its literal parts, input
`initial` values and `enum` options, so a term split across words or template pieces is found; a term that only
other data can assemble is a review question. Text is compared after Unicode NFKC, case folding and collapsing
runs of white space (Unicode 16.0, bundled with the checker, never taken from the host's `Intl`). Any hit stops the publish (`E-PRIVATE-LEAK`) and names the file, line and term. The same scan runs on
an open kit or package before it is published: authoring-only and private rule packs are never delivered.
