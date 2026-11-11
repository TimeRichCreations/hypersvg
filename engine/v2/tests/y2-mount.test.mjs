// Mount checks every member digest against package.json (10.8, 10.9 rule 1)
// before anything plays. A changed, missing or extra member is refused.
import crypto from 'node:crypto';
import { mount } from '../web/mount-web.mjs';
import { sha256 } from '../src/members.mjs';
import { schemas, eq, ok } from './helpers.mjs';

const enc = new TextEncoder();
const sha = (b) => `sha256:${crypto.createHash('sha256').update(b).digest('hex')}`;
const svg = (title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>${title}</title><rect id="a-bg" width="100" height="100" fill="#ddd" data-hsvg-layer="backdrop"/></svg>`;
// A tiny package as bytes, with a correct descriptor; then edit changes the members' bytes.
const pkg = (edit = () => {}) => {
  const files = {
    'experience.json': JSON.stringify({ format: 'hsvg/2.0', kind: 'experience', id: 'm', story: { start: 'a', scenes: { a: 'scenes/a/scene.json' }, ends: ['a'] } }),
    'scenes/a/scene.json': JSON.stringify({ format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' }),
    'scenes/a/a.svg': svg('Title'),
  };
  const bytes = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, enc.encode(v)]));
  const members = Object.fromEntries(Object.entries(bytes).map(([k, b]) => [k, sha(b)]));
  bytes['package.json'] = enc.encode(JSON.stringify({ format: 'hsvg/2.0', kind: 'package', id: 'm', experience: 'experience.json', needs: [], members }));
  edit(bytes);
  return bytes;
};
const refusal = (fn) => { try { fn(); return null; } catch (e) { return e; } };

export const tests = {
  'Y2.8 mount refuses a member whose bytes do not match its digest'() {
    const e = refusal(() => mount(null, pkg((b) => { b['scenes/a/a.svg'] = enc.encode(svg('Changed title')); }), { schemas: schemas() }));
    eq(e?.code, 'E-PACKAGE-DIGEST', `${e?.code} ${e?.message}`);
    ok(/scenes\/a\/a\.svg/.test(e.message), e.message);
  },
  'Y2.8 mount refuses a missing or an extra member'() {
    eq(refusal(() => mount(null, pkg((b) => { delete b['scenes/a/a.svg']; }), { schemas: schemas() }))?.code, 'E-PACKAGE-MEMBER');
    eq(refusal(() => mount(null, pkg((b) => { b['extra.json'] = enc.encode('{}'); }), { schemas: schemas() }))?.code, 'E-PACKAGE-MEMBER');
  },
  'Y2.8 a package with matching digests passes the checks (play then needs a page)'() {
    const e = refusal(() => mount(null, pkg(), { schemas: schemas() }));
    ok(e && !e.code && /window/.test(e.message), `it failed at the checks: ${e?.code} ${e?.message}`);
  },
  'Y2.8 the page\'s SHA-256 agrees with Node\'s'() {
    for (const text of ['', 'abc', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'é'.repeat(1000)]) eq(sha256(enc.encode(text)), sha(enc.encode(text)), `length ${text.length}`);
  },
};
