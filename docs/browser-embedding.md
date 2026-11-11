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

An `<img src="./out/lamp.svg">` shows the static fallback without running the player. A packed HTML experience already carries its player and opens directly as an offline page.
