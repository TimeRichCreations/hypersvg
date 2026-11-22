// Where the HyperSVG player finds the core schemas (asset-lean.mjs sharedSchemas). Served as files, they sit in the
// package's spec/2.0/schemas/core/, beside this module. The one-file player (tools/bundle-asset.mjs) replaces this
// module with one that holds the core schemas themselves, so it fetches none of those (added after 2.0.0-next.0).
// It fetches a pinned capability's schema (D55) from the package beside it, only for a full check that needs one.
export const SCHEMAS_BASE = new URL('../../../spec/2.0/schemas/core/', import.meta.url);
export const SCHEMAS = null;
// Where the page finds the modules of the capabilities a HyperSVG pins (D55, added after 2.0.0-next.0):
// engine/v2/web/addons/, beside this module. A host gives another with addonBase or addon-base.
export const ADDONS_BASE = new URL('./addons/', import.meta.url);
// The full one-file player (engine/v2/web/hypersvg-asset.js), which the lean player borrows its checked mount from
// (asset-lean.mjs mountAsync). null here and in the full build: the modules check a file themselves. The lean one-file
// build (hypersvg-asset-lean.js) sets it to the full file beside it, with the lean file's own query string.
export const FULL_PLAYER = null;
