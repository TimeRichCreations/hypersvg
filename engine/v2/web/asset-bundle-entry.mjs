// The entry of the one-file player (added after 2.0.0-next.0): tools/bundle-asset.mjs bundles it into
// engine/v2/web/hypersvg-asset.js, one module with the whole HyperSVG player, its full check and the core schemas.
// It exports what asset-web.mjs exports. The checked mount is given here, so a file placed without integrity needs no
// second request.
import * as checked from './mount-checked.mjs';
import * as assetLoad from '../src/load-asset.mjs';
import { bundleCheck } from './asset-lean.mjs';
export { mount, mountAsync, useSchemas, sharedSchemas, HyperSvgAsset, VERSION, elementVersion, repack, readAsset } from './asset-web.mjs';

bundleCheck(checked.mountChecked, assetLoad.loadAsset);
