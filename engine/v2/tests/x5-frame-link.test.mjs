// The frame link (10.6), page side (web/frame-link.mjs), driven with fake window and parent objects.
// The browser test is tests/browser/frame-link-browser.mjs.
import { Player } from '../src/story.mjs';
import { hostApi } from '../src/host.mjs';
import { frameLink } from '../web/frame-link.mjs';
import { eq, ok } from './helpers.mjs';

const TOKEN = 'abcdefghijklmnopqrstuvwxyz_-0123';
const exp = () => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en',
    inputs: {
      visitorName: { kind: 'content', type: 'string', maxLength: 20, initial: 'friend' },
      volume: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, initial: 0.5 },
      start: { kind: 'trigger' },
    },
    values: { starts: { type: 'number', initial: 0, minimum: 0, maximum: 99 } },
    outputs: { startCount: { kind: 'result', type: 'number', minimum: 0, maximum: 99, value: 'starts' }, started: { kind: 'event' } },
    on: { start: [{ id: 's', actions: [{ id: 's1', set: 'starts', to: 'starts + 1' }, { id: 's2', emit: 'started' }] }] },
    story: { start: 'a', scenes: { a: 'a.json' } } },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { a: { file: 'a.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' }, drawings: {}, words: {} } },
});

// A fake frame: win is the page's window, parent the host's. sent: what the page posted to the parent.
function frame({ open = true } = {}) {
  const sent = [];
  const parent = { postMessage: (m, origin) => { eq(origin, '*'); sent.push(structuredClone(m)); } };
  const handlers = {};
  const win = {
    parent,
    addEventListener: (t, fn) => { handlers[t] = fn; },
    removeEventListener: (t, fn) => { if (handlers[t] === fn) delete handlers[t]; },
  };
  const link = frameLink(win);
  const p = new Player(exp()); p.start();
  const host = hostApi(p);
  if (open) link.open(host);
  const send = (data, source = parent) => { handlers.message?.({ source, data }); return sent.at(-1); };
  const call = (id, c, ...args) => { const before = sent.length; send({ channel: TOKEN, v: 1, id, call: c, args }); return sent.length > before ? sent.at(-1) : null; };
  return { sent, parent, win, link, host, handlers, send, call };
}
const hello = (f, channel = TOKEN, source) => f.send({ call: 'hello', channel, id: 'h' }, source);

export const tests = {
  'the frame link is off when the page is not in a frame'() {
    const win = { addEventListener() {}, removeEventListener() {} };
    win.parent = win;
    eq(frameLink(win), null);
  },
  'hello: the first one from the parent, with a good token, is answered {v: 1}; later hellos are ignored'() {
    const f = frame();
    eq(hello(f, 'short'), undefined, 'a short token is not a channel');
    eq(hello(f, TOKEN, {}), undefined, 'a hello from another window is dropped');
    eq(f.call(1, 'read', 'volume'), null, 'nothing is answered before the hello');
    eq(hello(f), { channel: TOKEN, id: 'h', ok: true, value: { v: 1 } });
    const other = 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
    hello(f, other);
    hello(f);
    eq(f.sent.length, 1, 'a second hello gets no reply');
    const before = f.sent.length;
    f.send({ channel: other, v: 1, id: 2, call: 'read', args: ['volume'] });
    eq(f.sent.length, before, 'the second hello did not change the token');
  },
  'a wrong token or another window is dropped with no reply'() {
    const f = frame();
    hello(f);
    f.send({ channel: TOKEN.replace('a', 'b'), v: 1, id: 2, call: 'read', args: ['volume'] });
    f.send({ channel: TOKEN, v: 1, id: 3, call: 'read', args: ['volume'] }, { postMessage() {} });
    f.send('not an object');
    eq(f.sent.length, 1);
  },
  'set, read and emit round trip; on delivers events and off stops them'() {
    const f = frame();
    hello(f);
    eq(f.call(1, 'set', 'volume', 0.2), { channel: TOKEN, id: 1, ok: true, value: null });
    eq(f.call(2, 'read', 'volume'), { channel: TOKEN, id: 2, ok: true, value: 0.2 });
    eq(f.call(3, 'set', 'visitorName', 'Robin').ok, true);
    eq(f.call(4, 'read', 'visitorName').value, 'Robin');
    eq(f.call(5, 'on', 'started'), { channel: TOKEN, id: 5, ok: true, value: null });
    const n = f.sent.length;
    eq(f.call(6, 'emit', 'start').ok, true);
    const on = f.sent.slice(n).filter(m => m.call === 'on');
    eq(on.length, 1);
    eq([on[0].channel, on[0].v, on[0].name], [TOKEN, 1, 'started']);
    eq(f.call(7, 'read', 'startCount').value, 1);
    eq(f.call(8, 'scene').value, 'a');
    eq(f.call(9, 'off', 'started').ok, true);
    const m = f.sent.length;
    f.call(10, 'emit', 'start');
    eq(f.sent.slice(m).filter(x => x.call === 'on').length, 0, 'no delivery after off');
    eq(f.call(11, 'pause', 'host-menu').ok, true);
    ok(f.host.paused);
    eq(f.call(12, 'resume', 'host-menu').ok, true);
    ok(!f.host.paused);
  },
  'a refused host call is an error reply with its code'() {
    const f = frame();
    hello(f);
    eq(f.call(1, 'set', 'volume', 2), { channel: TOKEN, id: 1, ok: false, error: { code: 'E-RANGE', message: f.call(9, 'set', 'volume', 2).error.message } });
    eq(f.call(2, 'read', 'starts').error.code, 'E-HOST-PRIVATE');
    eq(f.call(3, 'on', 'nothing').error.code, 'E-REF-UNKNOWN');
    eq(f.call(4, 'setPartition', 'bad id!').error.code, 'E-RANGE');
  },
  'an unknown call, a destroy call or another version is refused with E-HOST-CALL'() {
    const f = frame();
    hello(f);
    eq(f.call(1, 'internal').error.code, 'E-HOST-CALL');
    eq(f.call(2, 'destroy').error.code, 'E-HOST-CALL');
    eq(f.call(3, 'toString').error.code, 'E-HOST-CALL');
    f.send({ channel: TOKEN, v: 2, id: 4, call: 'read', args: ['volume'] });
    eq(f.sent.at(-1).error.code, 'E-HOST-CALL');
  },
  'a message over 64 KiB is refused with E-RANGE and changes nothing'() {
    const f = frame();
    hello(f);
    const r = f.call(1, 'set', 'visitorName', 'x'.repeat(70000));
    eq([r.ok, r.error.code, r.id], [false, 'E-RANGE', 1]);
    eq(f.call(2, 'read', 'visitorName').value, 'friend');
  },
  'a hello and calls sent before the page is ready are answered once it is ready'() {
    const f = frame({ open: false });
    hello(f);
    f.call(1, 'read', 'volume');
    eq(f.sent.length, 0);
    f.link.open(f.host);
    eq(f.sent, [{ channel: TOKEN, id: 'h', ok: true, value: { v: 1 } }, { channel: TOKEN, id: 1, ok: true, value: 0.5 }]);
  },
  'a page that could not start answers E-HOST-CLOSED'() {
    const f = frame({ open: false });
    hello(f);
    f.link.open(null, 'no drawing');
    eq(f.sent[0].error, { code: 'E-HOST-CLOSED', message: 'no drawing' });
    eq(f.call(1, 'read', 'volume').error.code, 'E-HOST-CLOSED');
  },
  'destroy closes the link: no more replies or deliveries'() {
    const f = frame();
    hello(f);
    f.call(1, 'on', 'started');
    f.host.destroy();
    eq(f.handlers.message, undefined);
    const n = f.sent.length;
    f.send({ channel: TOKEN, v: 1, id: 2, call: 'read', args: ['volume'] });
    eq(f.sent.length, n);
  },
};
