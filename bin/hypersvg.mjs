#!/usr/bin/env node
// The one hypersvg command (D44). Node 20+, standard library only. It delegates to the engine's tools:
//   hypersvg init <folder>             a tiny starter: a lamp (a drawing and its JSON), AGENTS.md, CLAUDE.md, GUIDE.md and the skill
//   hypersvg check [folder] [options]  engine/v2/tools/check.mjs
//   hypersvg test [folder] [options]   engine/v2/tools/test.mjs; Playwright from PW_PATH or a global install
//   hypersvg pack <folder> <out> [options]   engine/v2/tools/pack.mjs (--asset: one HyperSVG)
//   hypersvg unpack <id>.svg <folder>        engine/v2/tools/unpack.mjs
//   hypersvg addon new|check|digest|pin ...  engine/v2/tools/addon.mjs (chapter 12)
//   hypersvg --version | --help
// It runs from the npm package and from a clone of the repository.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const at=(...p)=>path.join(root,...p);
const tool=name=>at('engine','v2','tools',name+'.mjs');

export const HELP=`hypersvg: make, check, test and pack HyperSVGs and Experiences.

Usage:
  hypersvg init <folder>                  a tiny starter: a lamp (a drawing and its JSON), AGENTS.md, CLAUDE.md, GUIDE.md and the skill
  hypersvg check [folder] [options]       check a folder (default: this folder); 0 findings means ready
  hypersvg test [folder] [options]        check, play in Node, then measure in a browser if Playwright is there
  hypersvg pack <folder> <out> [options]  an Experience: one offline HTML page in <out>
  hypersvg pack --asset <folder> <out>    a HyperSVG: one .svg file, <out>/<id>.svg
  hypersvg unpack <id>.svg <folder>       a HyperSVG back into its folder
  hypersvg addon new|check|digest|pin     write or check an add-on (spec chapter 12)
  hypersvg --version                      the version
  hypersvg --help                         this help

"hypersvg <command> --help" lists a command's options (check, test, pack, unpack, addon).
Before an install, write the full name: npx @hypersvg/core <command>.
Playwright is optional: set PW_PATH to a folder holding node_modules/playwright, or install it globally.
"hypersvg test --browser required" fails when the browser pass cannot run.
`;

// Each command's own help, in the command's terms (not the engine tools' internal usage).
export const COMMAND_HELP={
 init:`Usage: hypersvg init <folder>
  Writes a starter in <folder>: a lamp (experience.json, lamp.json, lamp.svg), AGENTS.md, CLAUDE.md, GUIDE.md and
  the HyperSVG skill for coding agents (.claude/skills/hypersvg/SKILL.md).
  Rename the lamp by changing the ids and file names together (see GUIDE.md section 1).
`,
 check:`Usage: hypersvg check [folder] [options]
  Checks every file of a folder (default: this folder). 0 findings means ready.
  --json      every finding as JSON, with its level (error or warning), file and line
  --review    also the review findings (style and accessibility advice)
`,
 test:`Usage: hypersvg test [folder] [options]
  Checks, plays every scene and control in Node, then measures in a browser if Playwright is there.
  --quick              the wide pass only (faster)
  --min-width <px>     run the phone pass at this width (100 to 2000)
  --browser required   fail when the browser pass cannot run
  --json               the report as JSON on stdout (notes go to stderr)
  --out <dir>          where the report and screenshots go (default: a temp folder)
  Playwright: set PW_PATH to a folder holding node_modules/playwright, or install it globally.
`,
 pack:`Usage: hypersvg pack <folder> <out> [options]
  Writes an Experience: one offline HTML page, <out>/<id>.html, and <out>/package.json describing it.
  --asset          write a HyperSVG instead: one .svg file, <out>/<id>.svg (text only: no add-ons or media files)
  --allow <name>   allow an add-on the experience needs
  --test           keep test hooks in the page (for test tools)
`,
 unpack:`Usage: hypersvg unpack <id>.svg <folder> [--force]
  Writes a HyperSVG's files back into <folder>. --force replaces files that are there.
`,
 addon:`Usage: hypersvg addon new|check|digest|pin ...
  new <kind> <id>   write a working add-on (preset, module or capability) with a manifest, a README and a test
  check <folder>    check an add-on
  digest, pin       the digest an experience pins in its needs
  See spec chapter 12 and EXTENDING.md.
`,
};

export function version(){
 for(const f of [at('package.json'),at('release','npm-package.json')]){try{return JSON.parse(fs.readFileSync(f,'utf8')).version;}catch{/* the next */}}
 return 'unknown';
}

// The starter: the guide's level 1 asset (a lamp, D45), an AGENTS.md for the folder and the guide.
export function init(folder){
 if(!folder)throw usage('init needs a folder: hypersvg init <folder>');
 const dest=path.resolve(folder);
 if(fs.existsSync(dest)&&(!fs.statSync(dest).isDirectory()||fs.readdirSync(dest).length))throw usage(`${folder} exists and is not empty. Choose a new folder.`);
 const example=at('docs','guide','examples','lamp');
 if(!fs.existsSync(path.join(example,'experience.json')))throw Error('The starter is missing from this install: docs/guide/examples/lamp');
 fs.mkdirSync(dest,{recursive:true});
 fs.cpSync(example,dest,{recursive:true});
 fs.copyFileSync(at('bin','starter','AGENTS.md'),path.join(dest,'AGENTS.md'));
 // The same notes as CLAUDE.md (some coding agents read that name), and the HyperSVG skill in .claude/skills/.
 fs.copyFileSync(at('bin','starter','AGENTS.md'),path.join(dest,'CLAUDE.md'));
 const skill=at('skills','hypersvg','SKILL.md');
 if(fs.existsSync(skill)){fs.mkdirSync(path.join(dest,'.claude','skills','hypersvg'),{recursive:true});fs.copyFileSync(skill,path.join(dest,'.claude','skills','hypersvg','SKILL.md'));}
 const guide=[at('GUIDE.md'),at('release','lean','GUIDE.md')].find(f=>fs.existsSync(f));
 if(guide)fs.copyFileSync(guide,path.join(dest,'GUIDE.md'));
 return dest;
}

// Playwright for hypersvg test: PW_PATH if set, else a global npm install. Never a dependency.
export function findPlaywright(env=process.env){
 if(env.PW_PATH)return env.PW_PATH;
 // One command string, no argument list: a shell with arguments is deprecated (DEP0190), and npm is npm.cmd on Windows.
 const r=spawnSync('npm root -g',{encoding:'utf8',shell:true,windowsHide:true,timeout:20000});
 const global=(r.stdout||'').trim();
 if(r.status===0&&global&&fs.existsSync(path.join(global,'playwright','package.json')))return path.join(global,'playwright');
 return null;
}

function usage(message){const e=Error(message);e.usage=true;return e;}
function run(file,args,env=process.env){
 const r=spawnSync(process.execPath,[file,...args],{stdio:'inherit',env,windowsHide:true});
 if(r.error)throw r.error;
 return r.status??1;
}

export function main(argv){
 const [command,...rest]=argv;
 if(!command||command==='--help'||command==='-h'||command==='help'){process.stdout.write(HELP);return command?0:1;}
 if(command==='--version'||command==='-v'){console.log(version());return 0;}
 if(command==='init'){
  if(rest.some(a=>a==='--help'||a==='-h')){process.stdout.write(COMMAND_HELP.init);return 0;}
  if(rest.length!==1||rest[0].startsWith('-'))throw usage('Usage: hypersvg init <folder>');
  const dest=init(rest[0]),r=path.relative(process.cwd(),dest),rel=!r?'.':r.startsWith('..')?dest:r;
  // The full name works before and after an install (the npm name hypersvg is another package).
  console.log(`Made ${rel}: a lamp (a drawing and its JSON), AGENTS.md, CLAUDE.md, GUIDE.md and the HyperSVG skill (.claude/skills/hypersvg).\nNext:\n  npx @hypersvg/core check ${rel}\n  npx @hypersvg/core test ${rel} --quick\n  npx @hypersvg/core pack ${rel} out`);
  return 0;
 }
 // "hypersvg <command> --help": the tool's own usage (each tool prints it when run with no folder).
 if(['check','test','pack','unpack','addon'].includes(command)&&rest.some(a=>a==='--help'||a==='-h')){process.stdout.write(COMMAND_HELP[command]);return 0;}
 if(command==='addon')return run(tool('addon'),rest);
 if(command==='check')return run(tool('check'),rest.length&&!rest[0].startsWith('-')?rest:['.',...rest]);
 if(command==='pack'){
  if(rest.filter(a=>!a.startsWith('-')).length<2)throw usage('Usage: hypersvg pack <folder> <out> [options]');
  return run(tool('pack'),rest);
 }
 if(command==='unpack'){
  if(rest.filter(a=>!a.startsWith('-')).length<2)throw usage('Usage: hypersvg unpack <id>.svg <folder> [--force]');
  return run(tool('unpack'),rest);
 }
 if(command==='test'){
  const env={...process.env},pw=findPlaywright(env);
  if(pw)env.PW_PATH=pw;else console.error('Playwright not found (PW_PATH or a global install): the Node part runs, the browser part does not.');
  return run(tool('test'),rest.length&&!rest[0].startsWith('-')?rest:['.',...rest],env);
 }
 throw usage(`Unknown command: ${command}. Run hypersvg --help.`);
}

const self=fileURLToPath(import.meta.url);
let invoked=false;
try{invoked=!!process.argv[1]&&fs.realpathSync(path.resolve(process.argv[1]))===fs.realpathSync(self);}catch{/* not the entry */}
if(invoked){
 try{process.exitCode=main(process.argv.slice(2));}
 catch(e){console.error(e.usage?e.message:'hypersvg: '+(e?.message||e));process.exitCode=e.usage?2:1;}
}
