// The safety pass for a HyperSVG (D56, 2.13): a small check of every drawing an asset holds that needs no schemas.
// It runs before an asset plays, with or without integrity (web/asset-lean.mjs, web/asset-web.mjs). It is a part of
// the drawing check (schema/drawing-check.mjs, 2.11): a drawing that passes the drawing check passes it too.
//
// For each .svg file of the asset it checks, in this order:
// 1. The text is well-formed XML for the strict reader (schema/xml.mjs): no DOCTYPE, no entity declaration, no
//    processing instruction, no entity but the five predefined ones and character references. Else E-SVG-PARSE.
// 2. The root is <svg> in the SVG namespace. Else E-SVG-ROOT.
// 3. Every element is in the allowed subset of 2.11 (ELEMENTS below; a test keeps it equal to the drawing rules), with
//    no namespace prefix. So no <script>, no <foreignObject>, no <style>, no <a>, no animation element, no <feImage>.
// 4. No attribute starts with "on" (any case): no event handlers.
// 5. Namespaces: xmlns is the SVG namespace; the only other declaration is xmlns:xlink with the XLink namespace; the
//    only prefixed attribute is xlink:href.
// 6. Addresses: href and xlink:href are a local #id, except on <image>, where they are a data: URI of an image type
//    (IMAGE_TYPES), read as a browser reads an address (so "java&#9;script:" is "javascript:"). An asset holds no
//    picture file, so no relative path either: nothing outside the file is named.
// 7. Every url( in any attribute value is url(#id), url('#id') or url("#id").
// 8. CSS text is plain: style holds no @import and no comment; style and every other attribute except id, class,
//    href, xlink:href and data-* hold no backslash (a CSS escape) and no image function that can load an address
//    (image(), image-set(), cross-fade(), element(), src()).
// Each finding is E-SVG-PARSE, E-SVG-ROOT or E-SVG-UNSAFE. Plain ES module; its only import is the XML reader.
import { parseXml } from '../schema/xml.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
// The allowed elements of 2.11 (spec/2.0/schemas/core/drawing.rules.json elements.allowed).
export const ELEMENTS = Object.freeze(['svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'metadata', 'path', 'rect', 'circle',
  'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textPath', 'image', 'linearGradient', 'radialGradient', 'stop',
  'pattern', 'marker', 'clipPath', 'mask', 'filter', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feFuncR', 'feFuncG',
  'feFuncB', 'feFuncA', 'feComposite', 'feDropShadow', 'feFlood', 'feGaussianBlur', 'feMerge', 'feMergeNode', 'feMorphology',
  'feOffset', 'feTurbulence', 'feDisplacementMap']);
// The image types a data: URI may hold (drawing.rules.json limits.imageDataTypes).
export const IMAGE_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);
const ALLOWED = new Set(ELEMENTS);
const LOCAL_URL = /^url\(\s*(?:#[^\s'"()\\]+|'#[^\s'"()\\]+'|"#[^\s'"()\\]+")\s*\)/i;
const IMAGE_FN = /(?:^|[^a-z0-9_-])(?:-webkit-|-moz-)?(?:image-set|image|cross-fade|element|src)\s*\(/i;
const NOT_CSS = /^(?:id|class|href|xlink:href|data-.*)$/;
// An address as the URL parser reads it: tab, CR and LF removed anywhere, C0 controls and spaces cut at the ends.
const asRead = (v) => String(v).replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');

// The findings for one drawing's text: [{code, path, message}], empty when it passes.
export function drawingSafety(text) {
  const out = [];
  const add = (code, el, message) => out.push({ code, path: el ? `<${el.name}${el.attrs?.id ? ` id="${el.attrs.id}"` : ''}> line ${el.line}` : '(file)', message });
  let root;
  try { root = parseXml(String(text)); } catch (e) { add('E-SVG-PARSE', null, e.message); return out; }
  if (root.name !== 'svg' || root.attrs.xmlns !== SVG_NS) add('E-SVG-ROOT', root, 'the root is not <svg> in the SVG namespace');
  const walk = (el) => {
    if (el.name.includes(':') || !ALLOWED.has(el.name)) add('E-SVG-UNSAFE', el, `element <${el.name}> is not in the allowed subset (2.11)`);
    for (const a of el.attrOrder) {
      const v = String(el.attrs[a]);
      if (/^on/i.test(a)) { add('E-SVG-UNSAFE', el, `event attribute ${a}`); continue; }
      if (a === 'xmlns') { if (v !== SVG_NS) add('E-SVG-UNSAFE', el, `xmlns ${v} is not the SVG namespace`); continue; }
      if (a.startsWith('xmlns:')) { if (a !== 'xmlns:xlink' || v !== XLINK_NS) add('E-SVG-UNSAFE', el, `namespace ${a} is refused`); continue; }
      if (a.includes(':') && a !== 'xlink:href') { add('E-SVG-UNSAFE', el, `attribute ${a} is in another namespace`); continue; }
      if (a === 'href' || a === 'xlink:href') {
        if (el.name === 'image') {
          const at = asRead(v);
          const m = /^data:([a-z0-9.+/-]+)[;,]/i.exec(at);
          if (!m || !IMAGE_TYPES.includes(m[1].toLowerCase())) add('E-SVG-UNSAFE', el, `${a} of an <image> in an asset is a data: URI of an image type, not ${JSON.stringify(at.slice(0, 60))}`);
        } else if (!/^#.+/.test(v)) add('E-SVG-UNSAFE', el, `${a} ${JSON.stringify(v.slice(0, 60))} is not a local #id`);
        continue;
      }
      for (const m of v.matchAll(/url\(/gi)) if (!LOCAL_URL.test(v.slice(m.index))) add('E-SVG-UNSAFE', el, `${a} holds ${JSON.stringify(v.slice(m.index, m.index + 60))}, not a local url(#id)`);
      if (NOT_CSS.test(a)) continue;
      if (a === 'style' && (/@import/i.test(v) || v.includes('/*'))) add('E-SVG-UNSAFE', el, 'style holds @import or a comment');
      if (v.includes('\\')) add('E-SVG-UNSAFE', el, `${a} holds a backslash (a CSS escape)`);
      if (IMAGE_FN.test(v)) add('E-SVG-UNSAFE', el, `${a} holds an image function that can load an address`);
    }
    for (const c of el.children) if (c.name) walk(c);
  };
  walk(root);
  return out;
}

// The findings for every drawing of an asset: files maps each path to its text. [{code, file, path, message}].
export function assetSafety(files) {
  const out = [];
  for (const [file, text] of Object.entries(files)) if (/\.svg$/i.test(file)) for (const d of drawingSafety(text)) out.push({ file, ...d });
  return out;
}
