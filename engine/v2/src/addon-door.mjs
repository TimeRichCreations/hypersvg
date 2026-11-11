// The add-on door's engine side (D23, spec chapter 12): registers the code of an outside module or capability add-on.
// Bundled only into a page that carries an outside add-on (tools/pack.mjs), so other pages pay nothing for it.
import { register } from './capabilities.mjs';
import { checkValue } from './runtime.mjs';
import { isModulePort } from './host.mjs';
import { registerModule, pageModulePort } from './modules.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const deepFreeze = (x) => { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); } return x; };

// The page door methods an outside capability's attach gets: reads and drawing, never a write (Y1).
const PAGE_READS = ['shell', 'scene', 'scenes', 'block', 'words', 'template', 'eval', 'read', 'input', 'ambient', 'revision', 'colorRoles', 'onDeliveries', 'repaint'];
// The hooks an outside capability's install may return besides calls (12.5).
const OUTSIDE_HOOKS = ['timer', 'mount', 'entered', 'hold', 'keep'];
// D39: the part channels a channel's writer may set (onto), by the engine's channel names.
const ONTO = Object.freeze({ x: 'translate-x', y: 'translate-y', rotate: 'rotate', scale: 'scale', opacity: 'opacity' });
// A frozen copy with no prototype (a control for a hook).
const bare = (x) => deepFreeze(Object.assign(Object.create(null), structuredClone(x)));
// The style properties a part handle may set (12.5): how a part looks, nothing that loads a file or moves the page.
const HANDLE_STYLES = ['filter', 'opacity', 'transform', 'transformOrigin', 'transition', 'visibility', 'fill', 'stroke', 'strokeWidth', 'strokeOpacity', 'fillOpacity', 'mixBlendMode'];
// A limited handle on a drawn part or slot (D31): its style, within HANDLE_STYLES, never the element (which reaches the
// window and every other part). A value that names a file (url(...)) or holds markup is refused. warn(message), when
// given (the dev player and test pages), hears each refusal with its reason.
const handleOf = (el, warn = null) => {
  if (!el) return null;
  const style = Object.create(null);
  for (const k of HANDLE_STYLES) Object.defineProperty(style, k, {
    enumerable: true,
    get: () => String(el.style?.[k] ?? ''),
    set: (v) => { const t = String(v); const why = refusedStyle(t); if (!why) el.style[k] = t; else warn?.(`style.${k} = ${JSON.stringify(t.slice(0, 80))} was refused: ${why}`); },
  });
  return Object.freeze(Object.assign(Object.create(null), { style: Object.freeze(style) }));
};

// Why a style handle refuses a value (12.5), or null: a value may not load a file or hold markup or an escape.
function refusedStyle(t) {
  if (/url\s*\(/i.test(t)) return 'it names a file (url(...)); a style handle never loads one';
  if (/image-set/i.test(t)) return 'it names a file (image-set); a style handle never loads one';
  if (/@import/i.test(t)) return 'it imports a style sheet (@import)';
  if (/expression\s*\(/i.test(t)) return 'it holds an expression(...)';
  if (/[<>]/.test(t)) return 'it holds markup (< or >)';
  if (/\\/.test(t)) return 'it holds a backslash (a CSS escape could hide a word above)';
  return null;
}

// Registers the code of an outside add-on: {manifest, digest, code}. digest is the digest of the add-on's files
// (tools/addons.mjs addonDigest; in a packed page the packer's). A module's code exports make(step); it registers as
// any module, under its id, and is admitted as one (the pin, the host's reviewed lock, the confined executor). A
// capability's code exports install(door) and may export attach(ctx); it installs only when needs names it, the
// experience pins its digest and the host allows it: the host's reviewed lock (a modulePort, or a packed page's own
// lock, which the packer writes only with --allow) lists the same digest. Else the mount faults with E-ADDON.
export function registerAddon({ manifest, digest, code }) {
  const m = deepFreeze(structuredClone(manifest));
  if (m.kind === 'module') return registerModule({ name: m.id, version: m.version, digest, exports: m.adds.exports, make: code.make });
  if (m.kind !== 'capability') throw new TypeError(`${m.id} is a ${m.kind}: only module and capability add-ons have code`);
  if (typeof code?.install !== 'function') throw new TypeError(`${m.id}: a capability add-on exports install(door)`);
  const pinned = `${m.id}@${m.version}`;
  const calls = m.adds.calls || {};
  const events = m.adds.events || [];
  const writes = m.adds.writes || m.adds.channels || []; // door 1 called them channels
  const SUBJECT = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/;
  return register({
    id: m.id,
    addon: m,
    install(door) {
      const refuse = (msg) => door.fault('E-ADDON', `${pinned}: ${msg}`, 'experience');
      const pins = door.experience?.about?.trust?.pins;
      if (!isObj(pins) || pins[pinned] === undefined) refuse(`about.trust.pins does not pin it: add "${pinned}": "${digest}"`);
      if (pins[pinned] !== digest) refuse(`the pin ${pins[pinned]} is not the digest of its files, ${digest}: pin what you reviewed`);
      const port = door.port ?? pageModulePort();
      if (!port || !isModulePort(port) || port.lock[pinned] !== digest) refuse(`the host has not allowed this capability: a host lists it in its reviewed lock, mount(..., {capabilities: {"${m.id}": modulePort({lock: {"${pinned}": "${digest}"}})}}); a packed page is packed with --allow ${m.id}`);
      // Its door (12.5, D31): a frozen object with no prototype and only its listed functions. emit is limited to its
      // own events (heard as <id>:<name>), write to the body values its channels name in a block's settings, and
      // settings(address) is the block's addons.<id>. It never holds the core door: no transaction (it cannot act as a
      // person), no raw write or emit.
      const settings = (address) => { const s = door.def(address)?.addons?.[m.id]; return s === undefined ? null : s; };
      const timers = Object.freeze(Object.assign(Object.create(null), {
        add: (owner, due, fields) => door.timers.add(owner, due, fields),
        drop: (match) => door.timers.drop(match),
        list: () => door.timers.list(),
      }));
      const own = Object.freeze(Object.assign(Object.create(null), {
        id: m.id,
        settings,
        // emit(address, name, payload, subject): heard as <id>:<name>, or <id>:<name>:<subject> when the manifest lists
        // name:<subject> (door 2). subject is an id.
        emit: (address, name, payload = {}, subject) => {
          const about = events.includes(`${name}:<subject>`);
          if (!about && !events.includes(name)) door.fault('E-ADDON', `${m.id} emits ${name}, which its manifest's events do not list`, address);
          if (about && !(typeof subject === 'string' && SUBJECT.test(subject))) door.fault('E-ADDON', `${m.id} emits ${name} about a subject: give it an id (its manifest lists ${name}:<subject>)`, address);
          if (!about && subject !== undefined) door.fault('E-ADDON', `${m.id} emits ${name} with a subject, but its manifest lists ${name} without :<subject>`, address);
          door.emit(address, about ? `${m.id}:${name}:${subject}` : `${m.id}:${name}`, payload);
        },
        write: (address, name, value) => {
          const s = settings(address) || {};
          if (!writes.some(c => s[c] === name)) door.fault('E-ADDON', `${m.id} writes ${name}, which no key of its writes names in its settings of ${address}`, address);
          door.write(address, name, value);
        },
        read: (address, name) => door.read(address, name),
        now: () => door.now(),
        def: (address) => door.def(address),
        entryKey: (address, entry) => door.entryKey(address, entry),
        fault: (code, message, address) => door.fault(code, message, address),
        timers,
      }));
      const hooks = code.install(own) || {};
      const run = {};
      for (const [n, c] of Object.entries(calls)) {
        const fn = hooks.calls?.[n];
        run[n] = (address, a, E, S = (d, f) => E(f)) => {
          const fault = (msg) => door.fault('E-ADDON', `call ${a.call}: ${msg}`, address);
          if (typeof fn !== 'function') fault(`${m.id} does not run ${n}`);
          // A humanOnly call needs a person's trusted activation (10.5, door 2).
          if (c.humanOnly === true) door.humanOnly(address, `call ${a.call}`);
          // with gives only its inputs and every required one (as the built-in door, B1a).
          const ins = Object.keys(c.with.properties || {});
          const given = Object.keys(isObj(a.with) ? a.with : {});
          const extra = given.filter(k => !ins.includes(k));
          const missing = (c.with.required || []).filter(k => !given.includes(k));
          if (extra.length || missing.length) fault(`with gives ${given.join(', ') || 'nothing'}; the call takes ${ins.join(', ') || 'nothing'}${(c.with.required || []).length ? `, and needs ${c.with.required.join(', ')}` : ''}`);
          const input = {};
          // An input the manifest types as a string is a text slot (D31.1): words, or {{ }} for a formula.
          for (const k of given) input[k] = c.with.properties?.[k]?.type === 'string' && typeof a.with[k] === 'string' ? S(c.with.properties[k], a.with[k]) : E(a.with[k]);
          const bad = checkValue(c.with, input);
          if (bad) fault(`the inputs do not fit: ${bad[1]}`);
          fn(address, deepFreeze(structuredClone(input)));
        };
      }
      run['*'] = (address, a) => door.fault('E-ADDON', `call ${a.call}: ${m.id} has no call ${a.call.slice(a.call.lastIndexOf('.') + 1)}; it has ${Object.keys(calls).join(', ') || 'none'}`, address);
      // Only the hooks 12.5 lists, taken by name: never an id, a record, play or actions.
      const out = { calls: run }; const grow = { controls: {}, access: {}, paints: {} };
      for (const k of OUTSIDE_HOOKS) if (hooks[k] !== undefined) out[k] = hooks[k];
      // D39's growth slots, only those the manifest lists, each under its content name <id>.<name>.
      // A control kind: the page passes a gesture the manifest lists; input(address, control, gesture) answers the new
      // value, which the engine writes into the control's value as a set (type, bounds and rules apply), then the
      // control's event goes. access(address, control) answers {valueText}; only plain text of at most 200 characters
      // is kept. The control is a frozen copy with no prototype.
      for (const [k, d] of Object.entries(m.adds.controls || {})) {
        const h = hooks.controls?.[k];
        if (typeof h?.input !== 'function') continue;
        const kind = `${m.id}.${k}`;
        grow.controls[kind] = (address, id, c, gesture) => {
          if (!d.gestures.includes(gesture)) door.fault('E-ADDON', `control ${id}: ${kind} takes ${d.gestures.join(', ')}, not ${JSON.stringify(gesture)}`, address);
          const v = h.input(address, bare(c), gesture);
          if (v !== undefined && c.value !== undefined) door.write(address, c.value, v);
          if (c.event) door.emit(address, c.event, {});
        };
        grow.access[kind] = (address, id, c) => {
          let a = null;
          try { a = h.access?.(address, bare(c)); } catch { a = null; }
          const t = a?.valueText;
          return { role: d.role, gestures: [...d.gestures], valueText: typeof t === 'string' && t.length <= 200 && !/[<>\\\u0000-\u001f]/.test(t) ? t : null };
        };
      }
      // A channel: the engine checks the value against the manifest's value range before the writer runs. The writer's
      // answer may set only the part channels onto lists, each a finite number; the drawing keeps it inside the part's
      // drawn motion range (ranges, by the engine's channel names). The writer runs while the page paints, outside any
      // step, so the door refuses a write or an event from it.
      for (const [k, d] of Object.entries(m.adds.paints || {})) {
        const w = hooks.paints?.[k];
        if (typeof w !== 'function') continue;
        const name = `${m.id}.${k}`;
        grow.paints[name] = (address, v, ranges = {}) => {
          const bad = checkValue(d.value, v);
          if (bad) door.fault(bad[0], `${name} ${JSON.stringify(v)}: ${bad[1]} (its manifest's value is ${d.value.minimum}..${d.value.maximum})`, address);
          const said = w(v, address);
          const put = {};
          for (const [o, x] of Object.entries(isObj(said) ? said : {})) {
            if (!d.onto.includes(o)) door.fault('E-ADDON', `${name} sets ${o}, which its manifest's onto (${d.onto.join(', ')}) does not list`, address);
            if (typeof x !== 'number' || !Number.isFinite(x)) door.fault('E-ADDON', `${name} sets ${o} to ${String(x)}, not a finite number`, address);
            const ch = ONTO[o]; const r = o === 'opacity' ? [0, 1] : ranges[ch];
            put[ch] = r ? Math.min(r[1], Math.max(r[0], x)) : x;
          }
          return put;
        };
      }
      for (const [k, v] of Object.entries(grow)) if (Object.keys(v).length) out[k] = v;
      return out;
    },
    // The page part: a visual-only door (chapter 12, Y1, D31): the reading methods of its page door (makePageDoor),
    // with settings(address), blocks() (the addresses of the blocks now on the page whose definition gives settings for
    // it), and part(address, id) and slot(id) as limited handles. It changes how parts look; it never writes values,
    // sends, fires or picks. No player, no engine state, no window: attach gets {door} and nothing else.
    ...(typeof code.attach === 'function' ? { attach: (ctx) => {
      const settings = (address) => { const s = ctx.player.def(address)?.addons?.[m.id]; return s === undefined ? null : deepFreeze(structuredClone(s)); };
      const door = Object.create(null);
      // draws(address): the bindings of a block that name this add-on (door 2: {"target": part, "<id>": {...}}), each
      // as {target, key, binding} (frozen copies); the add-on is that part's only writer and paints it.
      const draws = (address) => {
        const list = ctx.player.def(address)?.bindings;
        return deepFreeze((Array.isArray(list) ? list : []).filter(b => isObj(b?.[m.id])).map(b => ({ target: b.target, key: b.id ?? null, binding: structuredClone(b[m.id]) })));
      };
      Object.assign(door, { settings, draws, blocks: () => Object.keys(ctx.player.state.blocks).filter(a => settings(a) !== null || draws(a).length > 0) });
      for (const k of PAGE_READS) if (typeof ctx.door[k] === 'function') door[k] = ctx.door[k];
      // part and slot give limited handles (D31), never page elements.
      // In the dev player and test pages (options.test) a refused style value is a warning with its reason.
      const warn = ctx.options?.test ? (msg) => console.warn(`hsvg: ${m.id}: ${msg}`) : null;
      door.part = (address, local) => handleOf(ctx.door.part?.(address, local), warn);
      door.slot = (id) => handleOf(ctx.door.slot?.(id), warn);
      Object.defineProperties(door, { id: { value: ctx.door.id, enumerable: true }, experience: { get: () => ctx.door.experience, enumerable: true } });
      Object.freeze(door);
      // attach gets only its door (D31): no window, no container, no options.
      return code.attach({ door });
    } } : {}),
  });
}

