import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { repo, schemas } from './helpers.mjs';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { addonDigest, loadAddons } from '../tools/addons.mjs';
import { playNode } from '../tools/test/node-play.mjs';
import { unregister } from '../src/capabilities.mjs';
import { testOne } from '../tools/test.mjs';

async function fixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-admission-'));
  try {
    fs.cpSync(path.join(repo, 'engine/v2/addons/examples'), dir, { recursive: true });
    await fn(dir, path.join(dir, 'lamp'));
  } finally { unregister('example.tint'); fs.rmSync(dir, { recursive: true, force: true }); }
}

export const tests = {
  async 'rejected code is never executed by testOne or the direct loader, even with allow'() {
    await fixture(async (dir, exp) => {
      const addon = path.join(dir, 'addons/example.tint');
      fs.appendFileSync(path.join(addon, 'index.mjs'), '\nglobalThis.__hsvgAdmissionProbe = true;\n');
      const file = path.join(exp, 'experience.json');
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      doc.about.trust.pins['example.tint@1.0.0'] = addonDigest(addon);
      fs.writeFileSync(file, JSON.stringify(doc));
      delete globalThis.__hsvgAdmissionProbe;
      try {
        const report = await testOne(exp, { kits: {}, nodeOnly: true, allow: ['example.tint'] });
        assert.ok(report.errors > 0);
        assert.equal(report.node, undefined, 'checker errors stop playback');
        const source = await folderSource(exp);
        const checked = checkExperience(source, schemas());
        await assert.rejects(loadAddons(source, checked.experience, { allow: ['example.tint'] }), /globalThis/);
        assert.equal(globalThis.__hsvgAdmissionProbe, undefined);
      } finally { delete globalThis.__hsvgAdmissionProbe; }
    });
  },
  async 'Node add-on approval is required on every call, including after a cached import'() {
    await fixture(async (_dir, exp) => {
      const source = await folderSource(exp);
      const checked = checkExperience(source, schemas());
      await assert.rejects(loadAddons(source, checked.experience), /allow example.tint/);
      await loadAddons(source, checked.experience, { allow: ['example.tint'] });
      await assert.rejects(loadAddons(source, checked.experience), /allow example.tint/);
      const refused = await playNode(exp, { budget: 5 });
      assert.equal(refused.scenes.length, 0);
      assert.ok(refused.findings.some(f => f.code === 'E-ADDON' && f.severity !== 'warning'));
      const accepted = await playNode(exp, { allow: ['example.tint'], budget: 5 });
      assert.ok(accepted.scenes.length > 0);
      const again = await playNode(exp, { budget: 5 });
      assert.equal(again.scenes.length, 0);
    });
  },
};
