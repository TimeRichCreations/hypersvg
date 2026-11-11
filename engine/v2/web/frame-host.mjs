// The frame link (10.6): the host side, for a host page that shows a packed page in a sandboxed iframe
// (sandbox="allow-scripts", no allow-same-origin). It is not part of a packed page; the page side is web/frame-link.mjs.
//   const link = connectFrame(iframe);
//   await link.ready;                       // the page answered the hello
//   await link.set('volume', 0.2);          // every call returns a promise
//   const off = await link.on('won', ({ name, detail }) => ...);
// A refused call rejects with an Error that carries the page's code (E-RANGE, E-REF-UNKNOWN, ...).
// Plain ES module, no dependencies, no network.
const CALLS = ['set', 'emit', 'read', 'pause', 'resume', 'restart', 'scene', 'seat', 'clearStorage', 'setPartition', 'ladder'];

// A fresh channel token: 144 random bits, base64url (24 characters).
export function frameToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// iframe: the frame element. channel: the token (default a fresh one). timeout: ms to wait for the hello reply.
// probe: ms to wait for the page's pong after the frame loads a document again (below).
// The hello is sent at once, on each load of the frame, and again every 200 ms until the page answers: the page
// takes the first hello it hears and drops the rest, so a hello sent before the page listens does no harm.
// A link serves one document. The page says `bye` when it goes away, and the link ends at once. A load of the frame
// after the hello is answered may be a new document: the link holds its calls, sends a `ping` without the token, and
// goes on only if the page that knows the token answers `pong` within `probe` ms; else it ends. An ended link refuses
// its waiting and later calls with E-HOST-CLOSED, and never sends the token or a call to the new document. Connect
// again (connectFrame) to talk to the new document.
export function connectFrame(iframe, { channel = frameToken(), timeout = 30000, probe = 1000 } = {}) {
  const waiting = new Map();
  const listeners = new Map(); // event name (a built-in's bare name) -> Set of listeners
  const asked = new Map(); // event name -> the name the page was asked with
  let n = 0; let closed = false; let answered = false; let held = null; let probeTimer = null;
  const refused = (code, message) => Object.assign(new Error(message), { code });
  const post = (m) => { try { iframe.contentWindow?.postMessage(m, '*'); } catch { /* the frame is gone */ } };
  // A built-in output is heard by its bare name or as hsvg.<name> (5.9): one event, so one key.
  const key = (name) => (typeof name === 'string' && name.startsWith('hsvg.') ? name.slice(5) : name);
  const receive = (e) => {
    const d = e.data;
    if (closed || e.source !== iframe.contentWindow || !d || d.channel !== channel) return;
    if (d.call === 'bye') { end('the page went away'); return; }
    if (d.call === 'pong') { if (held) { const q = held; held = null; clearTimeout(probeTimer); q.forEach(post); } return; }
    if (d.call === 'on') { for (const fn of [...(listeners.get(key(d.name)) || [])]) fn({ name: d.name, detail: d.detail }); return; }
    const w = waiting.get(d.id);
    if (!w) return;
    waiting.delete(d.id);
    if (d.ok) w.resolve(d.value); else w.reject(refused(d.error?.code, d.error?.message));
  };
  const send = (call, args = []) => new Promise((resolve, reject) => {
    if (closed) { reject(refused('E-HOST-CLOSED', 'the frame link is closed')); return; }
    const id = ++n;
    waiting.set(id, { resolve, reject });
    const m = { channel, v: 1, id, call, args };
    if (held) held.push(m); else post(m);
  });
  const hello = () => { if (!answered && !closed) post({ channel, call: 'hello', id: 'hello' }); };
  const loaded = () => {
    if (closed) return;
    if (!answered) { hello(); return; }
    if (held) return; // already asking
    held = [];
    post({ call: 'ping' }); // no token: a new document learns nothing from it
    probeTimer = setTimeout(() => end('the frame shows another document'), probe);
  };
  const ready = new Promise((resolve, reject) => {
    waiting.set('hello', { resolve: (v) => { answered = true; resolve(v); }, reject: (e) => { answered = true; reject(e); } });
  });
  window.addEventListener('message', receive);
  iframe.addEventListener('load', loaded);
  const timer = setInterval(hello, 200);
  const stopAt = setTimeout(() => { const w = waiting.get('hello'); if (w) { waiting.delete('hello'); w.reject(refused('E-HOST-CLOSED', 'the frame did not answer')); } }, timeout);
  ready.then(() => {}, () => {}).finally(() => { clearInterval(timer); clearTimeout(stopAt); });
  hello();
  // Ends the link: listening stops, and calls still waiting (or held) are refused with E-HOST-CLOSED.
  function end(why) {
    if (closed) return;
    closed = true; held = null;
    clearTimeout(probeTimer); clearInterval(timer); clearTimeout(stopAt);
    window.removeEventListener('message', receive);
    iframe.removeEventListener('load', loaded);
    for (const w of waiting.values()) w.reject(refused('E-HOST-CLOSED', `the frame link is closed: ${why}`));
    waiting.clear(); listeners.clear(); asked.clear();
  }

  const link = { channel, ready };
  for (const c of CALLS) link[c] = (...args) => send(c, args);
  // on(name, fn): resolves to a function that stops this listener. The page is asked once per event: `entered` and
  // `hsvg.entered` are one event, so each listener hears it once.
  link.on = async (name, fn) => {
    const k = key(name);
    if (!asked.has(k)) {
      asked.set(k, name);
      try { await send('on', [name]); } catch (e) { if (asked.get(k) === name && !listeners.has(k)) asked.delete(k); throw e; }
    }
    if (!listeners.has(k)) listeners.set(k, new Set());
    listeners.get(k).add(fn);
    return () => link.off(name, fn);
  };
  // off(name, fn): stops one listener, or every listener of the event without fn.
  link.off = async (name, fn) => {
    const k = key(name);
    const set = listeners.get(k);
    if (!set) return;
    if (fn) set.delete(fn); else set.clear();
    if (!set.size) { listeners.delete(k); const asName = asked.get(k); asked.delete(k); await send('off', [asName]); }
  };
  // close: stops listening; calls still waiting are refused with E-HOST-CLOSED.
  link.close = () => end('closed by the host');
  return link;
}
