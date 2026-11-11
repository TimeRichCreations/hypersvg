// A small JSON Schema validator for the subset the HyperSVG 2.0 schemas use, reporting spec codes (errors.json).
// Plain ES module with no imports, so the browser engine can use it too.
//
// Keywords: type, enum, const, properties, required, additionalProperties, patternProperties, propertyNames,
// items, prefixItems, minItems, maxItems, minProperties, maxProperties, minimum, maximum, exclusiveMinimum,
// exclusiveMaximum, minLength, maxLength, pattern, oneOf, anyOf, allOf, not, if/then/else, $ref (local #/$defs/…
// or a registered $id), and these HyperSVG keywords:
//   x-hsvg-code     the code reported when this schema node fails (instead of the default for the keyword)
//   x-hsvg-owner    the capability that owns this key; outside its needs the key is E-NEEDS-MISSING
//   x-hsvg-codes    per-keyword codes, e.g. {"required": "E-KIT-BODY"}
// Default codes: type, enum, const, pattern, oneOf, anyOf, not -> E-TYPE; the bounds -> E-RANGE;
// required -> E-KEY-REQUIRED; additionalProperties false -> E-KEY-UNKNOWN.

const RANGE = new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength',
  'minItems', 'maxItems', 'minProperties', 'maxProperties']);

export function defaultCode(keyword) {
  if (RANGE.has(keyword)) return 'E-RANGE';
  if (keyword === 'required') return 'E-KEY-REQUIRED';
  if (keyword === 'additionalProperties') return 'E-KEY-UNKNOWN';
  return 'E-TYPE';
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}
function typeMatches(t, v) {
  const a = typeOf(v);
  return t === a || (t === 'number' && a === 'integer');
}
function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function length(s) { return [...s].length; }

// Naming rules said in words, not as patterns (F0b): what each common pattern asks for.
const PATTERN_WORDS = Object.freeze({
  '^[a-z][a-z0-9]*(-[a-z0-9]+)*$': 'a name of lower-case letters and digits with dashes between words, as pick-a (ids, control and scene names)',
  '^[a-z][a-zA-Z0-9]*$': 'a camelCase name with no dashes, as pickA (event, value and input names)',
  '^[a-z][a-zA-Z0-9]*(\\.[a-z][a-zA-Z0-9]*)?$': 'the name of an input or value, camelCase, as clickUrl (or owner.name)',
  '^[a-z]{2,3}(-[a-z0-9]{2,8})*$': 'a language tag, as en or pt-br',
  '^#[0-9a-fA-F]{6}$': 'a colour written #rrggbb',
  '^sha256:[0-9a-f]{64}$': 'a digest written sha256: and 64 hex digits',
  '^[0-9]+x[0-9]+$': 'a size written <width>x<height>, as 300x250',
});

export class Validator {
  constructor() { this.byId = new Map(); }
  add(schema) { if (schema && schema.$id) this.byId.set(schema.$id, schema); return this; }

  // ctx: { needs: Set of capability names }. Returns [{code, path, message}].
  validate(schema, value, ctx = {}) {
    const out = [];
    const needs = ctx.needs instanceof Set ? ctx.needs : new Set(ctx.needs || []);
    this.#node(schema, value, '', schema, out, needs);
    return out;
  }

  #resolve(ref, root) {
    if (ref.startsWith('#/')) {
      let s = root;
      for (const part of ref.slice(2).split('/')) s = s?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
      if (!s) throw new Error(`unresolved $ref ${ref}`);
      return [s, root];
    }
    const [id, frag] = ref.split('#');
    const r = this.byId.get(id);
    if (!r) throw new Error(`unknown schema ${id}`);
    return frag ? this.#resolve('#' + frag, r) : [r, r];
  }

  #fail(out, s, keyword, path, message) {
    const code = s['x-hsvg-codes']?.[keyword] || s['x-hsvg-code'] || defaultCode(keyword);
    out.push({ code, path: path || '(document)', message });
  }

  #node(s, v, path, root, out, needs) {
    if (s === true || s === undefined) return;
    if (s === false) { out.push({ code: 'E-KEY-UNKNOWN', path, message: 'not allowed here' }); return; }
    if (s['x-hsvg-owner'] && s['x-hsvg-owner'] !== 'core' && !needs.has(s['x-hsvg-owner'])) {
      out.push({ code: 'E-NEEDS-MISSING', path, message: `${path} belongs to the capability ${s['x-hsvg-owner']}, which needs does not name` });
      return;
    }
    if (s.$ref) { const [t, r] = this.#resolve(s.$ref, root); this.#node(t, v, path, r, out, needs); }
    if (s.type !== undefined) {
      const ts = Array.isArray(s.type) ? s.type : [s.type];
      if (!ts.some(t => typeMatches(t, v))) {
        this.#fail(out, s, 'type', path, `expected ${ts.join(' or ')}, found ${typeOf(v)}`);
        return;
      }
    }
    if (s.const !== undefined && !equal(s.const, v)) this.#fail(out, s, 'const', path, `must be ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.some(e => equal(e, v))) this.#fail(out, s, 'enum', path, `${JSON.stringify(v)} is not one of ${s.enum.map(e => JSON.stringify(e)).join(', ')}`);
    const t = typeOf(v);
    if (t === 'integer' || t === 'number') {
      if (s.minimum !== undefined && v < s.minimum) this.#fail(out, s, 'minimum', path, `${v} is below ${s.minimum}`);
      if (s.maximum !== undefined && v > s.maximum) this.#fail(out, s, 'maximum', path, `${v} is above ${s.maximum}`);
      if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) this.#fail(out, s, 'exclusiveMinimum', path, `${v} must be above ${s.exclusiveMinimum}`);
      if (s.exclusiveMaximum !== undefined && v >= s.exclusiveMaximum) this.#fail(out, s, 'exclusiveMaximum', path, `${v} must be below ${s.exclusiveMaximum}`);
    }
    if (t === 'string') {
      if (s.minLength !== undefined && length(v) < s.minLength) this.#fail(out, s, 'minLength', path, `shorter than ${s.minLength}`);
      if (s.maxLength !== undefined && length(v) > s.maxLength) this.#fail(out, s, 'maxLength', path, `longer than ${s.maxLength}`);
      if (s.pattern !== undefined && !new RegExp(s.pattern, 'u').test(v)) this.#fail(out, s, 'pattern', path, `${JSON.stringify(v)} is not ${PATTERN_WORDS[s.pattern] ?? `of the form ${s.pattern}`}`);
    }
    if (t === 'array') {
      if (s.minItems !== undefined && v.length < s.minItems) this.#fail(out, s, 'minItems', path, `fewer than ${s.minItems} items`);
      if (s.maxItems !== undefined && v.length > s.maxItems) this.#fail(out, s, 'maxItems', path, `more than ${s.maxItems} items`);
      const pre = s.prefixItems || [];
      v.forEach((x, n) => {
        const sub = n < pre.length ? pre[n] : s.items;
        if (sub !== undefined) this.#node(sub, x, `${path}[${n}]`, root, out, needs);
      });
    }
    if (t === 'object') {
      const keys = Object.keys(v);
      if (s.minProperties !== undefined && keys.length < s.minProperties) this.#fail(out, s, 'minProperties', path, `fewer than ${s.minProperties} entries`);
      if (s.maxProperties !== undefined && keys.length > s.maxProperties) this.#fail(out, s, 'maxProperties', path, `more than ${s.maxProperties} entries`);
      for (const r of s.required || []) if (!(r in v)) this.#fail(out, s, 'required', path, `the key ${r} is required`);
      const props = s.properties || {};
      const pats = Object.entries(s.patternProperties || {}).map(([p, sch]) => [new RegExp(p, 'u'), sch]);
      for (const k of keys) {
        const kp = path ? `${path}.${k}` : k;
        if (s.propertyNames) this.#node(s.propertyNames, k, kp, root, out, needs);
        let matched = false;
        if (Object.prototype.hasOwnProperty.call(props, k)) { matched = true; this.#node(props[k], v[k], kp, root, out, needs); }
        for (const [re, sch] of pats) if (re.test(k)) { matched = true; this.#node(sch, v[k], kp, root, out, needs); }
        if (!matched && s.additionalProperties !== undefined) {
          if (s.additionalProperties === false) this.#fail(out, s, 'additionalProperties', kp, `the key ${k} is not defined here`);
          else this.#node(s.additionalProperties, v[k], kp, root, out, needs);
        }
      }
    }
    if (s.allOf) for (const sub of s.allOf) this.#node(sub, v, path, root, out, needs);
    if (s.anyOf && !s.anyOf.some(sub => this.#quiet(sub, v, root, needs))) this.#fail(out, s, 'anyOf', path, 'matches none of the allowed forms');
    if (s.oneOf) {
      const ok = s.oneOf.filter(sub => this.#quiet(sub, v, root, needs)).length;
      if (ok !== 1) {
        // Report the errors of the closest form, so the code is the specific one. A form whose fixed keys (a const
        // such as kind, or a required operation key) match the value is closer than any form whose do not.
        const tries = s.oneOf.map(sub => { const o = []; this.#node(sub, v, path, root, o, needs); return { o, miss: this.#discriminatorMiss(sub, v, root) }; });
        const best = ok === 0 ? tries.reduce((a, b) => (b.miss < a.miss || (b.miss === a.miss && b.o.length < a.o.length) ? b : a)).o : [];
        if (best.length && !s['x-hsvg-code']) out.push(...best);
        else this.#fail(out, s, 'oneOf', path, ok === 0 ? 'matches none of the allowed forms' : 'matches more than one form');
      }
    }
    if (s.not && this.#quiet(s.not, v, root, needs)) this.#fail(out, s, 'not', path, 'matches a refused form');
    if (s.if !== undefined) {
      const branch = this.#quiet(s.if, v, root, needs) ? s.then : s.else;
      if (branch !== undefined) this.#node(branch, v, path, root, out, needs);
    }
  }

  // 1 when a form's fixed keys say the value is another form: a property with const that the value has with another
  // value, or (for an object form told apart by which key is present) a single required key the value lacks.
  #discriminatorMiss(s, v, root) {
    if (s && s.$ref) { try { [s] = this.#resolve(s.$ref, root); } catch { return 0; } }
    if (!s || typeof v !== 'object' || v === null || Array.isArray(v)) return 0;
    for (const [k, p] of Object.entries(s.properties || {})) {
      if (p && p.const !== undefined && k in v && !equal(p.const, v[k])) return 1;
    }
    const req = (s.required || []).filter(k => k !== 'id');
    if (req.length === 1 && !(req[0] in v) && !Object.values(s.properties || {}).some(p => p && p.const !== undefined)) return 1;
    return 0;
  }

  #quiet(s, v, root, needs) { const o = []; this.#node(s, v, '', root, o, needs); return o.length === 0; }
}
