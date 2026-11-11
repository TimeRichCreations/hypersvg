# HyperSVG: notes for AI agents

1. **Read `GUIDE.md` first.** It teaches every word and mark with an example. Do not guess names.
2. An asset or an experience is a drawing (SVG) plus decisions (JSON). Nothing else. Start small: one asset.

## Commands

```sh
node bin/hypersvg.mjs check <folder>          # or: npx @hypersvg/core check <folder>; 0 findings means ready
node bin/hypersvg.mjs test <folder> --quick   # play every scene and control; Playwright optional (--browser required to insist)
node bin/hypersvg.mjs pack <folder> <out>     # an Experience (one offline HTML page); --asset for one HyperSVG (.svg)
node .github/workflows/checks.mjs             # every check of this repository
```

## Rules

- Marks (`data-hsvg-*`) go only in drawings. In someone else's drawing, change only marks; keep ids and pivots.
- No program code in an experience: no `<script>`, no event attributes, no outside addresses.
- Text in a formula is in single quotes: `"to": "'Done'"`. Only `text` and `label` use `{{ formula }}`.
- Always write `axis` on `move` and `slider`, and the `kind` of every control, input and output.
- Check before you pack. Fix every error. A message that names a word names the right one: use it.
- An add-on's settings go in the JSON (`addons.<name>`) and its name in `needs`, never in a drawing.
- No dependencies: Node 20+ standard library only, Windows-safe paths. Never commit secrets.

The spec is `spec/2.0/` (start with `01-model.md`). Extending: `EXTENDING.md`, then `spec/2.0/12-writing-an-addon.md`.
