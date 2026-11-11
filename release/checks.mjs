// The public 2.0 checks: node .github/workflows/checks.mjs (or node release/checks.mjs) from the repository root.
// Node 20+, standard library only, no browser. It runs:
// - the leak check over every file;
// - the fast tests of engine/v2, skill/2.0, kit/2.0, the examples and release/leak.test.mjs (each where it is there:
//   the lean base of D41 holds the engine, not the skill or the kit);
// - hsvg check and pack on docs/one-page/example, with the engine tools and, where the kit is there, again from a
//   freshly built core kit (kit/2.0/build.mjs --core);
// - in the lean base (release/lean.json is not there, package.json is): hsvg check on every door example, and the
//   hypersvg command (bin/hypersvg.mjs): --version, init, check and pack.
// Tests listed in release/lean-tests.json need material that lives in another repository of D41 (skills, kit,
// library, showcases); the lean base skips them.
// Tests listed in release/public-omissions.json need material that is not public. Tests listed in
// release/addons-tests.json need a built-in capability (D30); they run in the hypersvg-addons checks
// (node release/checks.mjs --suite <name> --addons, in a copy of the core with the add-ons laid over it).
// Each skipped test is printed as OMITTED with its reason.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {verifyExport} from './verify.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const omissions=JSON.parse(fs.readFileSync(path.join(root,'release','public-omissions.json'),'utf8'));
const addonsFile=path.join(root,'release','addons-tests.json');
const addonTests=fs.existsSync(addonsFile)?JSON.parse(fs.readFileSync(addonsFile,'utf8')):{};
// The lean base (D41): its tests that need another repository's material. Only where that material is absent.
const leanFile=path.join(root,'release','lean-tests.json');
const LEAN_BASE=!fs.existsSync(path.join(root,'skill','2.0','tests'));
const leanTests=LEAN_BASE&&fs.existsSync(leanFile)?JSON.parse(fs.readFileSync(leanFile,'utf8')):{};
const ADDONS=process.argv.includes('--addons');
const at=(...p)=>path.join(root,...p);

// Suites that export `tests` (an object of named functions), as engine/v2/tests/run.mjs runs them.
const SUITES={
 engine:{dir:['engine','v2','tests'],before:['engine','v2','src','capabilities','all.mjs'],extra:[['examples','2.0-ad-studio','tests','studio.test.mjs']]},
 skill:{dir:['skill','2.0','tests']},
};
const rel=f=>path.relative(root,f).split(path.sep).join('/');
// Why a whole file or one test is skipped: a reason to print, '' to skip silently (not an add-on test, in --addons
// mode), or null to run it. In --addons mode only the add-on tests run.
function wholeFile(file){
 const r=rel(file),o=omissions[r],a=addonTests[r],l=leanTests[r];
 if(o?.tests==='all')return o.why;
 if(l?.tests==='all')return 'in another repository: '+l.why;
 if(ADDONS)return a?null:'';
 return a?.tests==='all'?'add-on test: '+a.why:null;
}
function oneTest(file,name){
 const r=rel(file),o=omissions[r],a=addonTests[r],l=leanTests[r];
 if(o&&o.tests!=='all'&&o.tests.includes(name))return o.why;
 if(l&&l.tests!=='all'&&l.tests.includes(name))return 'in another repository: '+l.why;
 if(ADDONS)return a&&(a.tests==='all'||a.tests.includes(name))?null:'';
 return a&&a.tests!=='all'&&a.tests.includes(name)?'add-on test: '+a.why:null;
}

// One suite in this process: node release/checks.mjs --suite <name>
async function runSuite(name){
 const s=SUITES[name],dir=at(...s.dir);
 if(!fs.existsSync(dir)){console.log(`0 passed, 0 failed, 0 omitted (${rel(dir)} is not in this repository)`);process.exit(0);}
 if(s.before)await import(pathToFileURL(at(...s.before)).href);
 const files=[...fs.readdirSync(dir).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>path.join(dir,f)),...(s.extra||[]).map(p=>at(...p)).filter(f=>fs.existsSync(f))];
 let pass=0,fail=0,omit=0;
 for(const file of files){
  const whole=wholeFile(file);
  if(whole!==null){if(whole){omit++;console.log(`OMITTED: ${rel(file)} (all tests): ${whole}`);}continue;}
  let mod;try{mod=await import(pathToFileURL(file).href);}catch(e){fail++;console.log(`FAIL ${rel(file)} :: (import)\n  ${String(e?.message||e).split('\n')[0]}`);continue;}
  for(const [test,fn]of Object.entries(mod.tests||{})){
   const skip=oneTest(file,test);
   if(skip!==null){if(skip){omit++;console.log(`OMITTED: ${rel(file)} :: ${test}: ${skip}`);}continue;}
   try{await fn();pass++;}catch(e){fail++;console.log(`FAIL ${rel(file)} :: ${test}\n  ${String(e?.stack||e).split('\n').slice(0,3).join('\n  ')}`);}
  }
 }
 console.log(`${pass} passed, ${fail} failed, ${omit} omitted`);
 process.exit(fail?1:0);
}

function run(label,args,{cwd=root,expect}={}){
 const r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:600000,maxBuffer:32*1024*1024});
 const out=(r.stdout||'')+(r.stderr||'');
 for(const line of out.split(/\r?\n/))if(line.startsWith('OMITTED:'))console.log(line);
 if(r.error||r.status!==0||(expect&&!expect.test(out))){console.log(out.split(/\r?\n/).filter(l=>/FAIL|Error|not ok/i.test(l)).slice(0,40).join('\n'));throw Error(`Public check failed: ${label} (exit ${r.status})`);}
 const counted=/(\d+) passed, 0 failed(?:, (\d+) omitted)?/.exec(out)||/^# pass (\d+)/m.exec(out);
 console.log(`CHECK PASS: ${label}${counted?` (${counted[1]} passed${counted[2]?`, ${counted[2]} omitted`:''})`:''}`);
}

async function main(){
 const files=await verifyExport(root);
 console.log(`CHECK PASS: leak check, ${files.length} files`);
 // Omitted files that are not exported at all: say so once, so no one thinks they ran.
 for(const [file,o]of Object.entries(omissions))if(!fs.existsSync(at(...file.split('/'))))console.log(`OMITTED: ${file} (not exported): ${o.why}`);
 for(const [file,o]of Object.entries(addonTests))if(o.moved&&!fs.existsSync(at(...file.split('/'))))console.log(`OMITTED: ${file} (in hypersvg-addons): ${o.why}`);
 for(const [file,o]of Object.entries(leanTests))if(o.tests==='all'&&!fs.existsSync(at(...file.split('/'))))console.log(`OMITTED: ${file} (in another repository): ${o.why}`);
 const self=fileURLToPath(import.meta.url),there=(...p)=>fs.existsSync(at(...p));
 run('engine/v2 fast tests',[self,'--suite','engine']);
 if(there('skill','2.0','tests'))run('skill/2.0 fast tests',[self,'--suite','skill']);
 if(there('kit','2.0','tests','run.mjs'))run('kit/2.0 tests',[at('kit','2.0','tests','run.mjs')],{expect:/kit tests passed/});
 const live=['host.test.mjs','experiences.test.mjs'].map(f=>at('examples','2.0-live-dashboards','tests',f)).filter(f=>fs.existsSync(f));
 if(live.length)run('live dashboards tests',['--test',...live]);
 run('release leak tests',['--test',at('release','leak.test.mjs')]);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hsvg-public-checks-'));
 try{
  const example=at('docs','one-page','example');
  run('hsvg check docs/one-page/example',[at('engine','v2','tools','check.mjs'),example]);
  run('hsvg pack docs/one-page/example',[at('engine','v2','tools','pack.mjs'),example,path.join(tmp,'pack')]);
  for(const f of [path.join(tmp,'pack')])if(!fs.readdirSync(f).some(n=>n.endsWith('.html')))throw Error('Pack wrote no HTML page');
  if(LEAN_BASE&&there('package.json')&&there('bin','hypersvg.mjs'))leanChecks(tmp);
  if(!there('kit','2.0','build.mjs'))return console.log('PUBLIC CHECKS PASS: leak check, fast tests, check and pack, the door examples and the hypersvg command.');
  run('core kit build',[at('kit','2.0','build.mjs'),'--core',path.join(tmp,'kit')],{expect:/^core kit:/m});
  const kit=path.join(tmp,'kit','hsvg-2.0-kit'),hsvg=path.join(kit,'bin','hsvg.mjs'),copy=path.join(tmp,'work','one-page');
  fs.cpSync(example,copy,{recursive:true});
  run('kit: hsvg check one-page example',[hsvg,'check',copy],{cwd:kit});
  run('kit: hsvg pack one-page example',[hsvg,'pack',copy,path.join(tmp,'kit-pack')],{cwd:kit});
  run('kit: hsvg new from the quiz template, then check',[hsvg,'new','my-quiz','--from','quiz','--in',path.join(tmp,'work')],{cwd:kit});
  run('kit: hsvg check the new quiz',[hsvg,'check',path.join(tmp,'work','my-quiz')],{cwd:kit});
  for(const f of [path.join(tmp,'pack'),path.join(tmp,'kit-pack')])if(!fs.readdirSync(f).some(n=>n.endsWith('.html')))throw Error('Pack wrote no HTML page');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 console.log('PUBLIC CHECKS PASS: leak check, fast tests, kit build, check and pack.');
}

// The lean base (D41): every door example checks clean, and the hypersvg command works from this tree.
// The same list as "experiences" in release/lean.json (a file of the authors' repository; release/lean.test.mjs keeps them equal).
export const LEAN_EXPERIENCES=['docs/one-page/example','engine/v2/addons/examples/noughts','engine/v2/addons/examples/lamp',
 'skill/2.0/examples/kinds/infographic','skill/2.0/examples/recipes/orientation','engine/v2/addons/examples/doors',
 'docs/guide/examples/lamp','docs/guide/examples/harbour','docs/guide/examples/ad','docs/guide/examples/list'];
function leanChecks(tmp){
 for(const e of LEAN_EXPERIENCES)if(fs.existsSync(at(...e.split('/'),'experience.json')))run('hsvg check '+e,[at('engine','v2','tools','check.mjs'),at(...e.split('/'))],{expect:/^0 findings/m});
 const bin=at('bin','hypersvg.mjs'),demo=path.join(tmp,'hypersvg-demo');
 run('hypersvg --version',[bin,'--version'],{expect:/^\d+\.\d+\.\d+/m});
 run('hypersvg init',[bin,'init',demo],{expect:/^Made /m});
 run('hypersvg check the starter',[bin,'check',demo],{expect:/^0 findings/m});
 run('hypersvg pack the starter',[bin,'pack',demo,path.join(tmp,'hypersvg-out')]);
 if(!fs.readdirSync(path.join(tmp,'hypersvg-out')).some(n=>n.endsWith('.html')))throw Error('hypersvg pack wrote no HTML page');
}

const i=process.argv.indexOf('--suite');
if(i>0)await runSuite(process.argv[i+1]);else await main();
