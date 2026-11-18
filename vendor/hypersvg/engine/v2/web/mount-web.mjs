// The host API's mount (10.6) for a page that plays a package itself. It checks the package before it plays (10.12),
// so it carries the schema and drawing checkers (src/load.mjs); the player itself (player-web.mjs) and a packed page do
// not (D19). Plain ES module, served as a file; no network.
// API labels (spec 10.16, D63), as the package's ./mount: mount and VERSION are stable; aiPort, pagePort and
// modulePort are experimental. Options: schemas, host, options, partition, onError, timeLimits, faultBox, nonce, clock
// and onMove are stable; hostWords, modules, capabilities and widgets are experimental; test is internal.
import { loadExperience } from '../src/load.mjs';
import { mountChecked } from './mount-checked.mjs';
import './audio-web.mjs'; // the synchronous mount plays sound as before (the player loads none of itself)
export { VERSION } from '../src/version.mjs';
// The host ports (experimental, D63): what the capabilities option takes. aiPort(sources) for the ai capability,
// pagePort(document) for the page capability, modulePort({lock}) for a logic module (src/host.mjs says each one).
export { aiPort, pagePort, modulePort } from '../src/host.mjs';

// The host API (10.6). pkg maps each member path to its bytes (Uint8Array) and includes package.json. Options: host,
// options, partition, onError, test, schemas. host is the host profile (A10.1) or null: the package must not
// raise a limit further than it allows (9.8.1, E-HOST-LIMIT, thrown), and must not need a grant it does not give
// (10.5, E-GRANT). options picks the host axes (E-AXIS-INPUT); the profile's options are the defaults. The host's
// budget rules are measured on the package bytes (player.internal.hostRules in test mode). Returns the face-only API.
// A mounted package is not a packed page, so it does not vouch for itself (10.9): its documents and drawings go
// through the document checker first (10.12), with schemas (the objects of spec/2.0/schemas, as engine/v2/schema/load.mjs
// gives them; the host serves them). A refused document throws with its code before anything plays; an hsvg/0.1 file
// is E-HEADER, and the message names the upgrade tool. A packed page (boot with checked) is the packer's and is not
// checked again.
// Before the documents, every member is checked against package.json's members (10.8, 10.9 rule 1): a changed,
// missing or extra member throws E-PACKAGE-DIGEST or E-PACKAGE-MEMBER and nothing plays. The package digest
// (about.trust.digest) is not checked here. Not built yet: the in-memory upgrade (A13.2).
// modules: the capability modules to use (src/capabilities/*.mjs records); without it, those registered in the page.
// Added after 2.0.0-next.0: faultBox (false: no fault message; onError still hears it), nonce (given to every <style>
// the player adds, for a strict CSP page), hostWords (src/host-words.mjs); the result has place(name) (place-web.mjs);
// clock ((engineMs) -> UTC ms: the wall clock `now` reads, default Date.now) and onMove (hears every move {t, source,
// payload}, 9.6), for replay (src/logic.mjs). theme: the host's theme, one of the experience's themes (E-AXIS-INPUT); with
// a pick in options on a host-selected language or theme axis, it applies to the drawing and the ambient language and
// wins over an input pick on the same axis (7.1). colors (experimental, 7.7.1): {role: '#rrggbb'}, the host's colours,
// checked against the contrast rules of a declared theme, all or nothing; a refused set warns through onError
// (W-HOST-COLOR-CONTRAST, W-HOST-COLOR-VALUE) and the author's theme stays.
// The body is mountChecked (mount-checked.mjs), with the full loader.
export function mount(container, pkg, options = {}) {
  return mountChecked(container, pkg, options, loadExperience);
}
