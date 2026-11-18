# HyperSVG conformance files

These files test a HyperSVG reader (10.15). Each `.svg` is a packed asset, or a packed asset changed in one way.
`expected.json` says what a reader gives for each one:

- `read`: `"ok"` when the reader returns the files, or the code it refuses with (`E-ASSET`, `E-PACKAGE-DIGEST`,
  `E-PACKAGE-MEMBER`).
- `check`: the error codes the checker gives on the returned files. `[]` means none.
- `maxBytes`: the size limit the reader is given. Without it the limit is `dataBytesEach` (8,388,608 bytes).
- `repack`: reading the file and packing its files again gives the same bytes.
- `pack`: what the packer gives for a folder in `folders/`.

A reader in another language passes when it gives the same `read` result for every file. A host that also checks
gives the same `check` result.

The files are compared byte for byte. Keep their line endings as they are.

## Run

```sh
node engine/v2/tests/run.mjs n4-conformance          # read, check and re-pack every file
node engine/v2/tools/make-conformance.mjs --check    # the files are what the folders and the changes give
node engine/v2/tools/make-conformance.mjs            # write them again after a folder changes
```
