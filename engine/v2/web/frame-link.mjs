// The frame link (10.6): the page side. A host page and a packed page inside a sandboxed iframe talk by postMessage.
// The host opens the link with one hello {call: 'hello', channel} from window.parent; the page accepts the first
// one only, and its channel token (base64url, at least 128 bits) must then be on every message. A message with
// another token, or from any window but the parent, is dropped with no reply.
// Envelope {channel, v: 1, id, call, args}; reply {channel, id, ok: true, value} or {channel, id, ok: false,
// error: {code, message}}. An `on` call subscribes; each delivery is {channel, v: 1, call: 'on', name, detail}.
// A message over 64 KiB (the UTF-8 bytes of its JSON) is refused with E-RANGE. The hello reply ({v: 1}) waits until
// the page is ready. destroy and pagehide close the link, and the page then says {channel, call: 'bye'} to the host.
// A {call: 'ping'} from the parent after the hello (it carries no token) is answered {channel, call: 'pong'}: the host
// asks it when its frame loads again, to learn whether this page is still the one it talks to. `entered` and
// `hsvg.entered` are one event: the page hears it once for the link. The host side is web/frame-host.mjs.
const CALLS = new Set(['set', 'emit', 'read', 'on', 'off', 'pause', 'resume', 'restart', 'scene', 'seat', 'clearStorage', 'setPartition', 'ladder']);
const VALUED = new Set(['read', 'scene', 'ladder']);
const TOKEN = /^[A-Za-z0-9_-]{22,256}$/;
const MAX = 65536;
const fail = (code, message) => ({ ok: false, error: { code, message } });
const utf8 = new TextEncoder();
// One subscription per event: a built-in output's bare name and hsvg.<name> are one (5.9).
const eventKey = (n) => (typeof n === 'string' && n.startsWith('hsvg.') ? n.slice(5) : n);

// win: the page's window. Returns null when the page is not in a frame, else {receive, open(host, failure), close}.
export function frameLink(win) {
  const parent = win.parent;
  if (!parent || parent === win) return null;
  let channel = null; let host; let failure = 'the page is closed'; let queue = []; let shut = false;
  const subs = new Map();
  // A sandboxed frame's origin is opaque, so its messages cannot name the host's origin: they go to '*'. They only
  // ever go to window.parent, and the channel token, which only the host knows, is the guard.
  const post = (m) => {
    try { parent.postMessage(m, '*'); } catch (e) { if (m.ok) post({ channel, id: m.id, ...fail('E-TYPE', String(e?.message ?? e)) }); }
  };
  const run = (d) => {
    let r;
    if (d.call === 'hello') r = host ? { ok: true, value: { v: 1 } } : fail('E-HOST-CLOSED', failure);
    else if (d.v !== 1 || !CALLS.has(d.call)) r = fail('E-HOST-CALL', `${d.call} is not a frame link call (v1)`);
    else if (!host) r = fail('E-HOST-CLOSED', failure);
    else {
      try {
        const args = Array.isArray(d.args) ? d.args : [];
        const n = args[0];
        let value = null;
        const k = eventKey(n);
        if (d.call === 'on') { if (!subs.has(k)) subs.set(k, host.on(n, ({ name, detail }) => post({ channel, v: 1, call: 'on', name, detail }))); }
        else if (d.call === 'off') { subs.get(k)?.(); subs.delete(k); }
        else { const v = host[d.call](...args); if (VALUED.has(d.call)) value = v ?? null; }
        r = { ok: true, value };
      } catch (e) { r = fail(e?.code || 'E-HOST-CALL', String(e?.message ?? e)); }
    }
    post({ channel, id: d.id, ...r });
  };
  const receive = (e) => {
    const d = e.data;
    if (shut || e.source !== parent || !d || typeof d !== 'object') return;
    let size; try { size = utf8.encode(JSON.stringify(d)).length; } catch { size = Infinity; }
    if (channel === null) {
      if (d.call !== 'hello' || typeof d.channel !== 'string' || !TOKEN.test(d.channel) || size > MAX) return;
      channel = d.channel;
    } else if (d.call === 'ping' && d.channel === undefined) return post({ channel, call: 'pong' });
    else if (d.channel !== channel || d.call === 'hello') return;
    else if (size > MAX) return post({ channel, id: d.id, ...fail('E-RANGE', `a frame link message is at most ${MAX} bytes`) });
    if (host === undefined) queue.push(d); else run(d);
  };
  const close = () => {
    if (shut) return;
    shut = true; queue = [];
    win.removeEventListener('message', receive);
    win.removeEventListener('pagehide', close);
    for (const off of subs.values()) { try { off(); } catch { /* already gone */ } }
    subs.clear();
    if (channel !== null) post({ channel, call: 'bye' });
  };
  win.addEventListener('message', receive);
  win.addEventListener('pagehide', close);
  return {
    receive, close,
    // host: the page's host API, or null when the page could not start (failure: why). Queued calls run now.
    open(h, why) {
      host = h || null;
      if (why) failure = String(why);
      if (h) { const destroy = h.destroy; h.destroy = () => { close(); destroy(); }; }
      for (const d of queue.splice(0)) run(d);
    },
  };
}
