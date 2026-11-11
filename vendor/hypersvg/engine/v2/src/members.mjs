// A package's members (10.8): every file except package.json, each with the SHA-256 digest of its exact bytes. The
// checker (check/packages.mjs) and mount (web/mount-web.mjs) share these rules, so a page that mounts a package
// refuses the same changed, missing or extra member the checker does (10.9 rule 1). Plain JavaScript, synchronous,
// no platform crypto: mount stays a synchronous call.

// SHA-256 of bytes (a Uint8Array), as `sha256:<hex>`.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256(bytes) {
  const n = bytes.length;
  const total = Math.ceil((n + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(bytes);
  m[n] = 0x80;
  const bits = n * 8;
  const view = new DataView(m.buffer);
  view.setUint32(total - 8, Math.floor(bits / 0x100000000));
  view.setUint32(total - 4, bits >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rot = (x, r) => (x >>> r) | (x << (32 - r));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]; const b = w[i - 2];
      w[i] = (w[i - 16] + (rot(a, 7) ^ rot(a, 18) ^ (a >>> 3)) + w[i - 7] + (rot(b, 17) ^ rot(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += k;
  }
  return `sha256:${[...h].map(x => x.toString(16).padStart(8, '0')).join('')}`;
}

// The member findings: members is package.json's `members` ({path: digest}); paths are the package's other files;
// digestOf(path) gives a file's digest. Returns [{code, path, message}]: E-PACKAGE-MEMBER for a listed file that is
// missing or a file that is not listed, E-PACKAGE-DIGEST for bytes that do not match.
export function memberFindings(members, paths, digestOf) {
  const out = [];
  const listed = members && typeof members === 'object' && !Array.isArray(members) ? members : {};
  const have = new Set(paths.filter(p => p !== 'package.json'));
  for (const rel of Object.keys(listed)) if (!have.has(rel)) out.push({ code: 'E-PACKAGE-MEMBER', path: `/members/${rel}`, message: `${rel} is listed but missing from the package` });
  for (const rel of have) if (!Object.hasOwn(listed, rel)) out.push({ code: 'E-PACKAGE-MEMBER', path: `/members/${rel}`, message: `${rel} is in the package but not in members` });
  for (const [rel, digest] of Object.entries(listed)) if (have.has(rel) && digestOf(rel) !== digest) out.push({ code: 'E-PACKAGE-DIGEST', path: `/members/${rel}`, message: `${rel} does not match its digest` });
  return out;
}
