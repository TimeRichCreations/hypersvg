// Stage 5, snapshot (capabilities/snapshot.json): the engine side. The PNG itself is made by the browser host
// (web/snapshot-web.mjs) and checked by tests/browser/snapshot-browser.mjs.
import path from 'node:path';
import { Player } from '../src/story.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

// D31: a press control whose reaction calls snapshot.save {save}; the picture settings are addons.snapshot.saves.<save>.
// control: the press control's extra keys; event: the event its reaction hears (default press:save-button).
const make = (control, needs = ['snapshot']) => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs, story: { start: 'a', scenes: { a: 'a.json' } } },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { a: { file: 'a.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
    values: { status: { type: 'string', initial: '', maxLength: 200 }, open: { type: 'boolean', initial: true }, saved: { type: 'number', initial: 0 } },
    controls: { save: { kind: 'button', target: 'save-button', enabled: 'open', ...control } },
    ...(needs.includes('snapshot') ? { addons: { snapshot: { saves: { save: { picture: 'card', filename: 'card.png', pixelWidth: 600, status: 'status' } } } } } : {}),
    on: { [control.event || 'press:save-button']: [{ id: 'r', actions: [{ call: 'snapshot.save', with: { save: "'save'" } }, { id: 'n', set: 'saved', to: 'saved + 1' }] }] } }, drawings: {}, words: {} } },
});

export const tests = {
  "a person's press delivers the request; padding defaults to 8; the press's reaction goes on"() {
    const p = make({ event: 'saving' });
    ok(p.start().ok);
    const r = p.activate('a', 'save');
    ok(r.ok, r.fault?.message);
    eq(r.deliveries.filter(d => d.kind === 'snapshot'), [{ kind: 'snapshot', address: 'a', control: 'save', picture: 'card', filename: 'card.png', pixelWidth: 600, padding: 8, status: 'status' }]);
    eq(p.read('a', 'saved'), 1);
  },
  'a timer, host or seat cannot save (E-HUMAN-ONLY); a disabled control does nothing'() {
    const p = make({});
    ok(p.start().ok);
    for (const src of ['timer', 'host', 'seat']) eq(p.activate('a', 'save', undefined, src).fault?.code, 'E-HUMAN-ONLY', src);
    p.state.blocks.a.values.open = false;
    eq(p.activate('a', 'save'), { ok: true, ignored: 'disabled' });
  },
  'without the snapshot capability the call is refused (E-NEEDS-MISSING)'() {
    const p = make({}, []);
    ok(p.start().ok);
    eq(p.activate('a', 'save').fault?.code, 'E-NEEDS-MISSING');
  },
  'the host writes progress into the status value, at most 200 characters'() {
    const p = make({});
    ok(p.start().ok);
    ok(p.snapshotStatus('a', 'status', 'Preparing picture…').ok);
    eq(p.read('a', 'status'), 'Preparing picture…');
    p.snapshotStatus('a', 'status', 'x'.repeat(300));
    eq(p.read('a', 'status').length, 200);
    eq(p.snapshotStatus('gone', 'status', 'late'), { ok: true, ignored: 'gone' });
  },
};
