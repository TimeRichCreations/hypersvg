// The entry of a packed page (tools/pack.mjs bundles it with the player).
// It fills the page's #stage with the experience, using the files and sounds the packer embedded.
// The packer runs the capability modules the experience needs before run(): they register themselves
// (src/capabilities.mjs), so the player installs them. A page carries no other capability code.
// A published page carries no test hooks: it plays from the story's start on the real clock, and window.hsvg is the
// host API only (10.6). A page packed with --test (pack.test) keeps the hooks of index.html for test tools:
// ?clock=manual stops the clock, ?start=<scene>, ?partition=<id>, and window.hsvg is the whole page state.
// In a frame, the frame link (web/frame-link.mjs) lets the host page reach the host API by postMessage.
import { boot } from './player-web.mjs';
import { frameLink } from './frame-link.mjs';

// pack.files: path -> text. pack.binaries: path -> base64 text. pack.host: the host profile given to the packer, or null.
// pack.kitted: a kit experience flattened by the packer (tools/pack.mjs flattenKit), or absent.
export async function run(pack) {
  const stage = document.getElementById('stage');
  const link = frameLink(window); // listens now, so a hello sent while the page starts waits for it
  const test = pack.test === true;
  const q = new URLSearchParams(test ? location.search : '');
  const assets = async (path) => {
    const b64 = pack.binaries[path];
    if (b64 === undefined) throw new Error(`no packed file ${path}`);
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes.buffer;
  };
  try {
    const state = await boot(stage, {
      files: pack.files, kitted: pack.kitted ?? null, checked: true, assets, host: pack.host ?? null, test,
      manualClock: q.get('clock') === 'manual', start: q.get('start'), partition: q.get('partition') || 'device',
    });
    window.hsvg = test ? state : state.host;
    window.hsvgReady = true;
    link?.open(state.host);
  } catch (e) {
    window.hsvgError = String(e && e.message || e);
    stage.textContent = `This experience could not start: ${window.hsvgError}`;
    link?.open(null, window.hsvgError);
  }
}
