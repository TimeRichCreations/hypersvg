# This folder: for coding agents

1. Read `GUIDE.md` first. Agents that read project skills also load the HyperSVG skill in `.claude/skills/hypersvg/SKILL.md`.
2. It is a drawing (SVG) plus decisions (JSON). Marks go only in drawings. No program code here.
3. Check before you pack. Before `@hypersvg/core` is installed, write the full name (`npx @hypersvg/core`): the
   npm name `hypersvg` is another package. After `npm install @hypersvg/core`, `npx hypersvg` works too.

```sh
npx @hypersvg/core check .
npx @hypersvg/core test .          # Playwright optional; without it the Node part runs (--browser required to insist)
npx @hypersvg/core pack . out      # an Experience: out/<id>.html
npx @hypersvg/core pack --asset . out   # a HyperSVG: out/<id>.svg
```

4. 0 findings from check means it is ready to pack. Fix each finding as its message says.
5. To rename the lamp, change the ids and file names together, then delete `lamp.json` and `lamp.svg`.
