// The integrity value of a HyperSVG (D56, 2.13, 10.14): the browser's Subresource Integrity form, "sha256-" and the
// base64 SHA-256 of the file's exact bytes. A host that checked a file once stores this value on its server and places
// the file with it; the player hashes what it got and compares. A digest inside the file is never a trust anchor.
// The hash is Web Crypto's (crypto.subtle). Where a page has none (not served over HTTPS or from localhost), the plain
// JavaScript SHA-256 of members.mjs computes the same value, and a match counts the same (D58).
// Plain ES module; no DOM.
import { sha256 } from './members.mjs';

const fault = (code, message) => Object.assign(new Error(message), { code });
const TOKEN = /^sha256-([A-Za-z0-9+/]{43}=)(?:\?\S*)?$/;

// The expected base64 digests of an integrity value: one or more "sha256-<base64>" separated by spaces, as SRI allows
// (a match with any one passes; an option after "?" is ignored). Throws E-ASSET-INTEGRITY for anything else.
export function parseIntegrity(value) {
  const tokens = typeof value === 'string' ? value.trim().split(/\s+/).filter(Boolean) : [];
  if (!tokens.length) throw fault('E-ASSET-INTEGRITY', 'integrity is empty: give "sha256-" and the base64 SHA-256 of the file (pack --asset prints it)');
  return tokens.map((t) => {
    const m = TOKEN.exec(t);
    if (!m) throw fault('E-ASSET-INTEGRITY', `integrity ${JSON.stringify(t.slice(0, 80))} is not "sha256-" and a base64 SHA-256 (44 characters): pack --asset prints the value`);
    return m[1];
  });
}

const base64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
const fromHex = (hex) => Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16));

// The integrity value of bytes ("sha256-<base64>"). subtle: Web Crypto's SubtleCrypto, or null for the plain hash.
export async function integrityOf(bytes, subtle = globalThis.crypto?.subtle ?? null) {
  if (subtle) return `sha256-${base64(new Uint8Array(await subtle.digest('SHA-256', bytes)))}`;
  return `sha256-${base64(fromHex(sha256(bytes).replace(/^sha256:/, '')))}`;
}

// Compares bytes with an integrity value. Returns 'subtle' when Web Crypto matched, 'script' when the plain hash
// matched (no Web Crypto in this page). Throws E-ASSET-INTEGRITY on a malformed value or a mismatch.
export async function verifyIntegrity(bytes, value, subtle = globalThis.crypto?.subtle ?? null) {
  const want = parseIntegrity(value);
  const got = (await integrityOf(bytes, subtle)).slice('sha256-'.length);
  if (!want.includes(got)) throw fault('E-ASSET-INTEGRITY', `the file does not match its integrity value: it is sha256-${got}. The file changed after the host checked it. Check it again and store its new value, or serve the file that was checked`);
  return subtle ? 'subtle' : 'script';
}
