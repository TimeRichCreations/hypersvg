// The HyperSVG in a page (D45, 10.14): mount(element, assetSvg, inputs) and the <hypersvg-asset> element.
// The npm package exports it as ./asset. It is not part of the core bundle a packed page carries.
//
//   import { mount } from '@hypersvg/core/asset';
//   const car = mount(document.querySelector('#car'), svgText, { length: 1.4, colour: 'ocean' }, { schemas });
//   car.on('hsvg.changed', (e) => console.log(e.detail));   // {name, value, by}
//
//   <script type="module" src=".../engine/v2/web/asset-web.mjs"></script>
//   <hypersvg-asset src="car.svg" length="1.4" colour="ocean"></hypersvg-asset>
//
// - The player checks what it is handed before anything plays: the asset record and every member's digest
//   (src/asset.mjs: a changed file is E-PACKAGE-DIGEST), the safety pass (src/asset-safety.mjs), then every document
//   and drawing with the schemas, as mount checks a package (10.12). A HyperSVG with anything an asset cannot hold (a
//   need, a file that is not text) is E-ASSET. Nothing is fetched by mount itself.
// - inputs: {name: value} for the asset's declared inputs (knobs and content fields), each checked by type and bounds.
//   They are the inputs' values at the start. Later changes go through set; a person's drawn control changes the
//   same knob; the latest change wins (5.11, D45).
// - The result is the host API (10.6) plus inputs(): each input's name, kind, type, bounds and value, so any panel
//   can build itself.
// - Many assets on one page share one player: this module, the engine's code and one copy of the schemas. Each
//   placed asset is its own experience with its own state.
// - Added after 2.0.0-next.0 (D56): mountAsync and the element's integrity attribute, from asset-lean.mjs. A page
//   that places every HyperSVG with integrity loads asset-lean.mjs alone, without the checker this module carries.
// API labels (spec 10.16, D63), as the package's ./asset: mount, mountAsync, HyperSvgAsset, useSchemas, sharedSchemas,
// readAsset, VERSION and elementVersion are stable; repack is experimental. Options and the element: asset-lean.mjs.
import { mountChecked } from './mount-checked.mjs';
import { loadAsset } from '../src/load-asset.mjs';
import { readAsset } from '../src/asset.mjs';
import { FORMAT } from '../src/limits.mjs';
import { place } from './asset-lean.mjs';
import './audio-web.mjs'; // the synchronous mount plays sound as before; asset-lean.mjs loads it only when used

export { mountAsync, useSchemas, sharedSchemas, HyperSvgAsset, VERSION, elementVersion } from './asset-lean.mjs';
export { repack } from '../src/repack.mjs'; // added after 2.0.0-next.0
export { readAsset };

// Places a HyperSVG (its text) in element and plays it. options: schemas (required, as for mount), partition (default
// asset-<id>), onError, test, timeLimits, and the options asset-lean.mjs place() takes (theme, options, faultBox, nonce,
// hostWords, colors). Throws {code, message} and plays nothing when the asset is refused.
export function mount(element, assetSvg, inputs = {}, options = {}) {
  const asset = readAsset(assetSvg, { maxBytes: FORMAT.dataBytesEach });
  const { schemas = null, ...rest } = options || {};
  if (!schemas || typeof schemas !== 'object' || !schemas.kinds) throw new TypeError('mount needs options.schemas (spec/2.0/schemas): an asset is checked before it plays');
  return place(element, asset, inputs, rest, (el, pkg, o) => mountChecked(el, pkg, { ...o, schemas }, loadAsset));
}
export { logicPort } from './logic-port.mjs'; // internal, added after 2.0.0-next.1: the replay recorder's engine
