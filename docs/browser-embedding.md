# Put a HyperSVG in a page

Install `@hypersvg/core`, pack the lamp with `hypersvg pack --asset my-lamp out`, and serve the project folder over HTTP. The package name is a release candidate; use a locally packed tarball when testing an unpublished build.

For a plain browser, save this as `index.html` at the project root:

```html
<script type="module" src="./node_modules/@hypersvg/core/engine/v2/web/asset-web.mjs"></script>
<hypersvg-asset src="./out/lamp.svg" lit="true" height="1.2"></hypersvg-asset>
```

The element fetches its SVG and the package's schemas. Keep the package directory structure intact. A bundler or import map can resolve `@hypersvg/core/asset`; an ordinary browser does not resolve npm names by itself. With a bundler, supply schemas using `useSchemas(schemas)` or arrange for the schema files to be served at the module's expected relative location.

For direct mounting, provide schemas explicitly:

```html
<div id="lamp"></div>
<script type="module">
import { mount, sharedSchemas } from './node_modules/@hypersvg/core/engine/v2/web/asset-web.mjs';
const svg = await fetch('./out/lamp.svg').then(r => {
  if (!r.ok) throw new Error(`Asset request failed: ${r.status}`);
  return r.text();
});
const schemas = await sharedSchemas();
const lamp = mount(document.querySelector('#lamp'), svg, { lit: true }, { schemas });
lamp.on('hsvg.changed', e => console.log(e.detail));
lamp.set('lit', false);
// When removing the player yourself: lamp.destroy();
</script>
```

`sharedSchemas()` loads the core schemas used by assets. The package-mount API (`@hypersvg/core/mount`) instead accepts a map of member paths to `Uint8Array` bytes, including `package.json`, and also requires `{schemas}`. Experiences using extensions need their corresponding schema records and host capability setup; the asset helper covers core assets only.

The host and a drawn toggle share the same input. `lamp.read('lit')` reflects either source's latest change. Each placed player has independent state and SVG IDs, including when two copies use the same authored names. Use the host API and authored marks to interact with it; generated DOM IDs are private.

## Place a checked file with its fingerprint

Added after `2.0.0-next.0`.

A host that checks a HyperSVG once can skip the check on every page. `pack --asset` prints the file's fingerprint:

```sh
hypersvg pack --asset my-lamp out
# ...
# integrity sha256-2bL8+yr62lvHcX3oRuHoyS+t3R/DE9NL5tEP7cg7+i0=
```

Store that value on your server, beside the file. Then place the file with it, as browsers check scripts
(Subresource Integrity):

```html
<script type="module" src="./node_modules/@hypersvg/core/engine/v2/web/asset-lean.mjs"></script>
<hypersvg-asset src="./out/lamp.svg" integrity="sha256-2bL8+yr62lvHcX3oRuHoyS+t3R/DE9NL5tEP7cg7+i0=" lit="true"></hypersvg-asset>
```

Or from code. `mountAsync` returns a promise of the same host API as `mount`:

```js
import { mountAsync } from './node_modules/@hypersvg/core/engine/v2/web/asset-lean.mjs';
const bytes = new Uint8Array(await (await fetch('./out/lamp.svg')).arrayBuffer());
const lamp = await mountAsync(document.querySelector('#lamp'), bytes, { lit: true }, { integrity: storedValue });
```

- The value is `sha256-` and the base64 SHA-256 of the file's exact bytes. Give the bytes to `mountAsync` when you
  can; text is hashed as its UTF-8.
- On a match, the player skips the schema check, so the page loads no schemas and no checking code.
  `asset-lean.mjs` is about a third smaller than `asset-web.mjs` with its schemas. A bundler or import map resolves
  it as `@hypersvg/core/asset-lean`.
- On a mismatch, it refuses with `E-ASSET-INTEGRITY` and nothing plays. Nothing of the changed file shows: the
  element keeps what it holds, or stays empty.
- A small safety pass always runs, with or without `integrity`: no script, no foreign content, no event handlers, no
  outside addresses.
- **The fingerprint must come from your server, never from the file.** The digests inside a HyperSVG catch accidents,
  not tampering: whoever edits the file can make them again.
- The hash uses the browser's Web Crypto on pages served over HTTPS or from `localhost`, and a plain SHA-256
  elsewhere. Both give the same value, so a match skips the check on either.
- A file placed without `integrity` on an `asset-lean.mjs` page still plays: the player loads the checker and the
  schemas when it needs them. `asset-web.mjs` takes `integrity` too, and keeps the synchronous `mount`.

## What is stable

Spec 10.16 labels every part of the API. **Stable** parts stay for all of 2.x: a minor version only adds to them.
**Experimental** parts work and are documented, but may change in a minor version, with a note in the changelog.
**Internal** parts are not for your code, even when a module exports them. Below, an item is stable unless it says
**Experimental**.

## More host options (added after 2.0.0-next.0)

These are built and tested, but not yet part of a release. Every earlier call works as before.

- **Wait for a trigger.** `await lamp.emit('flash')` resolves once the trigger's reactions have run, with
  `{name, payload, outputs}`. It does not wait for clips or timers.
- **The version.** `asset-web.mjs`, `asset-lean.mjs`, `mount-web.mjs` and `player-web.mjs` export `VERSION`.
  `elementVersion()` gives the version of the copy that defined `<hypersvg-asset>` on the page. A second copy of the
  player uses the first copy's element and says so once in the console when the versions differ.
- **Pick a theme.** **Experimental.** `mount(el, svg, inputs, {schemas, theme: 'night'})`, `mountAsync(..., {theme})` or
  `<hypersvg-asset theme="night">` shows the HyperSVG in one of the themes it declares (`themes` in its
  `experience.json`). Each was contrast-checked by its author. Any other name is refused with `E-AXIS-INPUT`. The
  `options` mount option (`{<axis id>: <option>}`, 10.6) is passed on too. If the HyperSVG has an input named
  `theme`, the attribute sets that input instead. Changing the attribute places the file again.
- **Your own colours (experimental).** Pass colours for the HyperSVG's colour roles, the roles its theme names (such
  as `surface`, `ink`, `accent`, `on-accent`):

  ```js
  mount(el, svg, inputs, {schemas, colors: {accent: '#bf360c', 'on-accent': '#ffffff'}});
  ```

  ```html
  <hypersvg-asset src="./lamp.svg" colors="accent: #bf360c; on-accent: #ffffff"></hypersvg-asset>
  ```

  `mountAsync` and the package `mount` take `colors` too; `element.colors = {accent: '#bf360c'}` sets the attribute.
  - Give six-digit hex values only. Roles you leave out keep the theme's colour.
  - The player checks the colours against the same contrast rules as the author's themes (text on its ground at
    4.5:1, the focus colour at 3:1). With `theme`, it checks that theme; without it, every theme the file declares.
  - All or nothing. If one pair is too weak, none of your colours apply: the HyperSVG shows its author's colours, and
    `onError` (or the element's `hsvg:error`) gets `W-HOST-COLOR-CONTRAST` with the pair, the theme and the ratio,
    such as `on-accent on accent is 4.44:1 in theme day, under 4.5:1`. A wrong role or value gets
    `W-HOST-COLOR-VALUE`. The HyperSVG still plays.
  - Only parts the author gave a colour role change. A logo or other brand part without one keeps its own colours.
  - This option may change in a minor version.
- **A strict Content-Security-Policy.** Pass the page's nonce: `{nonce: 'abc'}`, or `<hypersvg-asset nonce="abc">`.
  The player adds a few `<style>` elements (the focus ring; a shell's widgets; the page add-on) and gives each the
  nonce. Its own inline styles are set through the style object, which CSP allows. With the nonce, a drawing's own
  `style` attributes are set the same way. Scripts need nothing: the player adds none. A policy such as
  `script-src 'self' 'nonce-abc'; style-src 'self' 'nonce-abc'` then works.
- **Hide the fault box.** `{faultBox: false}`, or `<hypersvg-asset fault-box="hidden">`, shows no fault message in
  the player. The fault still goes to `onError` and to `hsvg:error`; the player stops as before.
- **Errors.** `onError` and the element's `hsvg:error` always give `code` and `message`. Other fields when known:
  `source` (where it happened, such as `start`, `control` or `listener`), `address` (the block of a fault while
  playing), `path` (a sound that cannot play) and `diagnostics` (the findings of a refused file). A failure with no
  code of its own, such as your listener throwing a plain error, has the code `E-HOST-ERROR`.
- **Keep two copies apart.** **Experimental.** Each placed copy keys its stored values by a partition,
  `asset-<id>` by default, so two copies of one HyperSVG share them. Give each copy its own:
  `<hypersvg-asset src="./lamp.svg" partition="kitchen">`, or `{partition: 'kitchen'}` when you mount. A partition is
  1 to 128 of `A-Z a-z 0-9 . _ -`; another one is refused with `E-RANGE`. If the HyperSVG has an input named
  `partition`, the attribute sets that input instead. Note: a HyperSVG mount takes no host profile, so today it gets
  no storage grant and keeps its values for the visit only.
- **The first press.** `lamp.on('firstInput', fn)` hears the visitor's first press, key press or pointer-down in the
  player, once per run, before the press itself (so before `openUrl` on a link button).
- **Where is a place?** **Experimental.** `lamp.place('switch')` gives `{x, y, width, height}` in CSS pixels from the top left of the
  document, for a place the scene on the stage (or its shell) lists in its `places` (4.3). It is `null` while the place
  is not drawn. An unlisted name is refused (`E-REF-UNKNOWN`). Use it to lay your own things over the drawing; the
  player's element ids stay private. A packed page does not have it.
- **Host words.** **Experimental.** `{hostWords: {language: 'fr', words: {power: 'Lampe allumée'}}}` shows the HyperSVG in a language
  it has no words for. Each id must be one of its default-language word ids; each text is plain text, at most twice
  as long as the default word (at least 24 and at most 400 characters). Ids you leave out keep the default word.
  Anything else is refused with `E-WORDS` before anything plays. The checker never saw these words, so it could not
  fit-check them: they fit at play time only, with the drawing's own fit and give-way steps. Text the author wrote
  straight into a file, not as a word, stays as written.
- **Make the file again after an edit.** **Experimental.** `repack(files)` (from `asset-web.mjs`) gives the same bytes as
  `hypersvg pack --asset` for the same files. Read the files with `readAsset(svgText).files`, change one (for example a
  cleaned drawing), then `repack(files)`. It makes the record and its digests; it does not check the documents. Place
  the result with the full check, or run `hypersvg check` on the files, before you store its new `integrity` value.
- **Leaner loads.** A page that places HyperSVGs loads no kit or add-on code, with or without `integrity`: a
  HyperSVG cannot use either (2.13). The full check uses `mount-checked.mjs` and `src/load-asset.mjs`; a HyperSVG
  that pins a kit, an add-on or a preset is refused.
- **One file from a CDN.** **Experimental.** `engine/v2/web/hypersvg-asset.js` is the whole HyperSVG player in one module: the
  player, its full check and the core schemas. A page then makes one request for the player instead of about fifty,
  and fetches no schemas:

  ```html
  <script type="module" src="https://cdn.jsdelivr.net/npm/@hypersvg/core@<version>/engine/v2/web/hypersvg-asset.js"></script>
  <hypersvg-asset src="./lamp.svg" lit="true"></hypersvg-asset>
  ```

  Put a published version of `@hypersvg/core` in place of `<version>`. The file is in every version after
  `2.0.0-next.0`; `2.0.0-next.0` itself does not hold it. Pin an exact version, not a tag such as `next`, so the page
  keeps the player it was tested with.

  It exports what `asset-web.mjs` exports. `node engine/v2/tools/bundle-asset.mjs` makes it again after an engine
  change; `--check` says whether the committed file is current.
- **A HyperSVG with confetti, sparkle or a bouncing ball.** These presets need the `effects` or `physics`
  capability. `pack --asset` expands the preset into the file and pins the capability's module by version and digest
  in `about.trust.pins`. The file never carries the code. When you place it with `mountAsync` or `<hypersvg-asset>`,
  the player fetches the module, checks its digest, then plays. A page whose HyperSVGs pin nothing fetches no module.
  - The modules are served from `engine/v2/web/addons/` beside the player. Serve them elsewhere with
    `{addonBase: 'https://cdn.example/hypersvg/addons/'}` or `<hypersvg-asset addon-base="...">` (both
    **experimental**).
  - A module that cannot be loaded is refused with `E-ADDON-MISSING`; one that is not the pinned bytes with
    `E-ADDON-DIGEST`. Nothing plays, and the element shows the rest pose: what it holds, or the still picture.
  - Under a Content Security Policy, allow `blob:` in `script-src`: the player runs the checked bytes from a blob,
    so it never fetches them twice.
  - The synchronous `mount()` cannot load code, so it refuses such a file. Use `mountAsync`.
  - These modules come with the add-ons, not with the base yet.
- **Sound only when used.** `asset-lean.mjs` loads the audio code only for a HyperSVG that has a sound or a made
  sound, before it plays. A silent HyperSVG downloads about 7 KB less. Nothing changes for you: the first sound still
  plays at the visitor's first press.

## Record and replay (added after 2.0.0-next.0)

A host can record a play in the page and replay it later, in Node or in a browser, with no page.

```js
import { mount } from '@hypersvg/core/mount';
import { logic } from '@hypersvg/core/logic';

const epoch = Date.now();
const moves = [];
const lamp = mount(el, pkg, { schemas, clock: (t) => epoch + t, onMove: (m) => moves.push(m) });
// ... the person plays; store epoch and moves ...

const replay = logic(pkg, { schemas, clock: (t) => epoch + t });
for (const m of moves) replay.feed(m);
replay.fingerprint(); // 'sha256:…': the same as the page's state after its last move
```

- `onMove` hears every input that reaches the logic, before it runs, as `{t, source, payload}`: the engine time in ms,
  the input's name and its arguments (spec 9.6 lists them). Typed free text is heard by its length only.
- `clock` gives the wall clock that `now` reads. It is called with the engine time. Give `(t) => epoch + t` when a
  replay must give the same `now`; without `clock` the browser's clock is read, and a replay cannot repeat it.
- `logic(pkg, options)` plays the same package with no page. `feed(move)` advances to the move's time and runs it.
  It also has `advance(ms)`, `read(name)`, `heard` (the outputs it sent), `state()` and `fingerprint()` (spec 9.6.1).
  Give it the same stored values, host profile, grants and module lock as the page had.
- A replay proves that these moves, from this start, are legal and give this result. It does not prove that a person
  made them. It cannot repeat what needs a page: layout measures, sound timing, video places, page hooks and
  snapshots. Effects and physics are exact only on the same kind of engine.

## Without the player

An `<img src="./out/lamp.svg">` shows the static fallback without running the player. A packed HTML experience already carries its player and opens directly as an offline page.
