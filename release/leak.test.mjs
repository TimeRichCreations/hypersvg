// The leak check's tests: node --test release/leak.test.mjs
// Planted values are built from pieces, so this file itself passes the check it tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {scan} from './scan.mjs';
import {policy,decide,protectedPath,lifted} from './policy.mjs';
import {verifyExport} from './verify.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const drive=letter=>letter+':';
const IQ='ad'+'-'+'iq';
const BENCH='HyperSVG'+'-bench';
const rules=(name,text)=>scan(name,text).map(f=>f.rule);
// In the authors' repository the policy is release/hypersvg.files.txt; in an export it is release/EXPORT-POLICY.txt.
const policyFile=[path.join(root,'release','hypersvg.files.txt'),path.join(root,'release','EXPORT-POLICY.txt')].find(f=>existsSync(f));

test('absolute paths to this PC are refused',()=>{
 for(const text of [drive('C')+'/'+'Users/someone/project',drive('C')+'/'+'Users',drive('C')+'/'+BENCH+'/open-v2-suite/x.wav',
  JSON.stringify(drive('C')+'\\'+BENCH+'\\open\\x.wav'),drive('K')+'/private/folder','see '+BENCH+' for the runs','/'+'home/someone/x','/'+'Users/someone/x'])
  assert.ok(rules('notes.md',text).some(r=>/private (?:drive|bench|home) path/.test(r)),text.replace(/./g,'*'));
});
test('a bare drive file, ordinary words and JSON keys are not paths',()=>{
 for(const text of ["['"+drive('C')+"/a.svg']",'"home": "scenes/home/scene.json"','Arrow keys/Home/End.','check(/'+'home/.test(caption))','https://example.com/a/b','ratio 16:9/2'])
  assert.deepEqual(rules('notes.md',text),[],text);
});
test('private rule-pack names are refused in contents and in file names',()=>{
 assert.ok(rules('pack.json','{"pack": "'+IQ+'-core"}').includes('private rule pack'));
 assert.ok(rules('pack.json','uses '+IQ.toUpperCase()+' rules').includes('private rule pack'));
 assert.ok(scan('',IQ+'-rules/pack.json').length,'a file name is scanned too');
 assert.deepEqual(rules('a.md','load-iq and bad_iq_x are other words'),[]);
});
test('keys, tokens and secret files are refused without printing them',()=>{
 const r=randomBytes(24).toString('hex');
 for(const value of ['sk-'+r,'gh'+'p_'+r,'AI'+'za'+r,'api_key="'+r+'"','-----BEGIN '+'PRIVATE KEY-----']){
  const found=scan('a.txt',value);assert.ok(found.length);assert.ok(!JSON.stringify(found).includes(r));
 }
 for(const name of ['.env','config/.env.local','id_rsa','server.pem','deploy.key','.npmrc'])assert.ok(rules(name,'').includes('sensitive filename'),name);
});
test('private folders, rule packs and example photos are hard exclusions',()=>{
 for(const name of ['spec/2.0/private/terms.json','sources/chapter-1.md','x/sources/a.md','library/2.0/'+IQ+'-rules/pack.json','spec/2.0/packs/'+IQ+'.json',
  'examples/2.0-round1/c3/photo.jpg','examples/2.0-round1/c3/sort/test.png','examples/x/shot.webp','x/proof/frame.mjs','engine/v2/tools/proof/frame.png',
  'x/evidence/a.json','experiences/2.0/demo-show/experience.json','assets/rio/a.svg','docs/briefs/a.md','pro/a.mjs'])
  assert.equal(protectedPath(name),true,name);
 for(const name of ['engine/v2/tools/proof/proof.mjs','examples/2.0-video-explainer/media/sprout-poster.png','spec/2.0/01-model.md','library/2.0/hsvg-starter/resources/images/city-dusk.svg'])
  assert.equal(protectedPath(name),false,name);
});
test('the gallery\'s JPEGs may leave; other images in examples/ may not; a lift opens only its folder',()=>{
 for(const name of ['examples/gallery/sub/a.jpg','examples/gallery/a.png','examples/gallery/A.jpg','examples/gallery/a.jpeg','examples/2.0-showcase/a.jpg'])
  assert.equal(protectedPath(name),true,name);
 assert.equal(protectedPath('examples/gallery/lakes-atlas.jpg'),false);
 const lift=lifted(policy('+ engine/v2/**\n+ experiences/2.0/demo-show/**\n+ experiences/**\n+ experiences/2.0/*/**\n'));
 assert.deepEqual(lift,['experiences/2.0/demo-show']);
 for(const name of ['experiences','experiences/2.0','experiences/2.0/demo-show/experience.json','experiences/2.0/demo-show/scenes/a/art.svg'])
  assert.equal(protectedPath(name,lift),false,name);
 for(const name of ['experiences/2.0/other-show/experience.json','experiences/2.0/demo-show/private/a.json','experiences/2.0/demo-show/sources/a.md',
  'experiences/2.0/demo-show/'+IQ+'/a.json','assets/rio/a.svg','experiences/2.0/demo-show-2/experience.json'])
  assert.equal(protectedPath(name,lift),true,name);
 const r=policy('+ experiences/2.0/demo-show/**\n');
 assert.equal(decide('experiences/2.0/demo-show/experience.json',r).include,true);
 assert.equal(decide('experiences/2.0/other-show/experience.json',r).include,false);
});
test('the public policy takes the lean 2.0 base and leaves out 0.1, briefs and private material',{skip:!policyFile&&'no policy file'},()=>{
 const r=policy(readFileSync(policyFile,'utf8'));
 for(const name of ['engine/v2/src/player.mjs','spec/2.0/01-model.md','spec/2.0/drafts/structure-2.1.md','docs/one-page/example/experience.json','release/scan.mjs','release/browser-smoke.mjs','docs/browser-embedding.md',
  'engine/v2/addons/examples/noughts/experience.json','engine/v2/addons/examples/addons/example.glow/manifest.json','engine/v2/addons/wobble/manifest.json',
  'skill/2.0/examples/kinds/infographic/experience.json','bin/hypersvg.mjs','release/lean-tests.json','engine/v2/src/capabilities/all.mjs'])
  assert.equal(decide(name,r).include,true,name);
 for(const name of [
  // D41: the skills, the kit and its templates, the component library and the showcases have their own repositories.
  'kit/2.0/build.mjs','skill/2.0/SKILL.md','library/2.0/QUALITY.md','library/2.0/templates/quiz/experience.json','examples/README.md',
  'examples/gallery/honeybee.jpg','examples/2.0-showcase/honeybee/experience.json','release/core-examples.json','docs/one-page/README-proposal.md','docs/one-page/ONE-PAGE.md','docs/one-page/FIRST-STEPS.md',
  'engine/src/player.mjs','spec/SPEC.md','templates/quiz/experience.json','skill/SKILL.md','docs/briefs/a.md',
  'docs/reports/a.md','spec/2.0/private/terms.json','spec/2.0/DECISIONS.md','sources/a.md','examples/2.0-live-dashboards/shots/a.png',
  'engine/v2/tests/showcases/a.test.mjs','experiences/2.0/other-show/experience.json','release/export.mjs',
  // D30: no built-in capability's code, pages or manifests, and no example that needs one.
  'engine/v2/src/capabilities/physics.mjs','engine/v2/modules/chess/index.mjs','spec/2.0/capabilities/physics.md','spec/2.0/capabilities/physics.json',
  'examples/2.0-board-game/experience.json','skill/2.0/examples/recipes/toss/experience.json',
  // D30: only the chosen items (release/core-examples.json). The ads go to the add-ons; the others stay in the authors' repository.
  'library/2.0/templates/ad/experience.json','skill/2.0/examples/kinds/ad/experience.json','skill/2.0/examples/recipes/ad-300x250/experience.json',
  'examples/2.0-kit-ads/ads/ad-300x250/experience.json','examples/2.0-round1/c1/data-explorer/experience.json',
  // R1 answers: the experiences and what names or plays them, the decisions log, the 0.1 upgrade tool and its tests.
  'engine/v2/tools/proof/products.json','engine/v2/tools/proof/guides/a.json','engine/v2/tests/browser/parity.mjs','spec/2.0/DRAFT6-DESIGN.md',
  'docs/spec-2.0-work/tools/upgrade/upgrade.mjs','engine/v2/tests/w4u-upgrade.test.mjs','experiences/2.0/demo-show/experience.json'])
  assert.equal(decide(name,r).include,false,name);
});
test('verifyExport refuses a planted leak in a prepared folder and passes the clean folder',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'hsvg-leak-test-'));
 const put=async(name,text)=>{const f=path.join(tmp,...name.split('/'));await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,text);};
 try{
  await put('release/EXPORT-POLICY.txt','+ **\n');
  await put('LICENSE',await fs.readFile(new URL('../LICENSE',import.meta.url)));
  await put('docs/a.md','Clean text.\n');
  // An export keeps LF line endings everywhere: no .gitattributes, or one without eol=lf, is refused.
  await assert.rejects(verifyExport(tmp),/Missing \.gitattributes/);
  await put('.gitattributes','* text=auto\n');await assert.rejects(verifyExport(tmp),/Invalid \.gitattributes/);
  await put('.gitattributes','* text=auto eol=lf\n*.png binary\n');
  await verifyExport(tmp);
  for(const [name,text,why] of [['docs/b.md','run from '+drive('C')+'/'+'Users/x/open',/private drive path/],['docs/c.md','see '+BENCH,/bench/],
   ['docs/d.json','"'+IQ+'-pack"',/rule pack/],['spec/private/x.md','x',/protected/],['sources/x.md','x',/protected/],['.env','X=1',/sensitive/],
   ['examples/c3/photo.jpg','x',/protected/]]){
   await put(name,text);await assert.rejects(verifyExport(tmp),why,name);
   await fs.rm(path.join(tmp,name.split('/')[0]==='docs'?name:name.split('/')[0]),{recursive:true,force:true});
  }
  await verifyExport(tmp);
  // The published repository checks itself in a git checkout: its top-level .git is skipped, a deeper .git is not.
  await put('.git/HEAD','ref: refs/heads/main\n');await put('.git/config','[core]\n');
  await verifyExport(tmp);
  await put('docs/.git/HEAD','x');await assert.rejects(verifyExport(tmp),/protected/,'a nested .git');
  await fs.rm(path.join(tmp,'docs','.git'),{recursive:true,force:true});
  await verifyExport(tmp);
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
test('R09: verifyExport is an allowlist gate: a file the policy does not include is refused, generated files pass by name',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'hsvg-allow-test-'));
 const put=async(name,text)=>{const f=path.join(tmp,...name.split('/'));await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,text);};
 try{
  await put('release/EXPORT-POLICY.txt','+ approved/**\n');
  await put('LICENSE',await fs.readFile(new URL('../LICENSE',import.meta.url)));
  await put('.gitattributes','* text=auto eol=lf\n');
  await put('approved/a.md','Clean text.\n');
  for(const g of ['README.md','GUIDE.md','package.json','release/EXPORT-REPORT.md','.github/workflows/checks.mjs'])await put(g,'{}\n');
  await verifyExport(tmp);
  await put('INTERNAL-NOTES.md','Innocent notes.\n');
  await assert.rejects(verifyExport(tmp),/does not include: INTERNAL-NOTES\.md/);
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
