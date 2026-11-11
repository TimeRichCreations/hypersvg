function glob(pattern){let source='^';for(let i=0;i<pattern.length;i++){const c=pattern[i];if(c==='*'){if(pattern[i+1]==='*'){i++;if(pattern[i+1]==='/'){i++;source+='(?:.*/)?';}else source+='.*';}else source+='[^/]*';}else if(c==='?')source+='[^/]';else source+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}return new RegExp(source+'$','i');}
export function policy(text){const rules=[];for(const [i,line]of text.split(/\r?\n/).entries()){const clean=line.trim();if(!clean||clean.startsWith('#'))continue;const match=/^([+-]) ([^\s]+)$/.exec(clean);if(!match||match[2].startsWith('/')||match[2].includes('\\')||match[2].includes(':')||match[2].split('/').some(p=>p==='..'||p==='.'||p===''))throw Error('Invalid export pattern on line '+(i+1));rules.push({include:match[1]==='+',pattern:match[2],test:glob(match[2])});}if(!rules.some(r=>r.include))throw Error('Export policy needs an include');return rules;}
// Raster images in examples/ may be photos or private test images. Only these generated ones may leave.
export const EXAMPLE_IMAGES=new Set(['examples/2.0-video-explainer/media/sprout-poster.png']);
const RASTER=/\.(?:png|jpe?g|webp|avif|gif|bmp|tiff?|heic|heif|dng|raw)$/i;
// The gallery's pictures (examples/README.md): screenshots of the exported examples, taken with skill/2.0/tools/shots.mjs.
// Only JPEGs directly in examples/gallery/, with plain lower-case names.
export const GALLERY_IMAGE=/^examples\/gallery\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/;
// The folders a policy lifts out of the experiences/ exclusion: exactly the include lines
// "+ experiences/2.0/<name>/**" (the waiting group of release/core-examples.json, once the owner switches it on).
// Every other hard exclusion still holds inside them.
export const LIFT=/^experiences\/2\.0\/[a-z0-9]+(?:-[a-z0-9]+)*\/\*\*$/;
export function lifted(rules){return rules.filter(r=>r.include&&LIFT.test(r.pattern)).map(r=>r.pattern.slice(0,-3));}
// Hard exclusions cannot be overridden by a target policy (except lift, above).
export function protectedPath(name,lift=[]){
 const parts=name.toLowerCase().split('/').map(p=>p.replace(/[ .]+$/g,''));
 // The 2.0 certify tool lives in a folder named proof; it is code, so only that folder is exempt, and never for images.
 const proofTool=/^engine\/v2\/tools\/proof(?:\/|$)/.test(name)&&!RASTER.test(name);
 if(parts.some(p=>['pro','.git','node_modules','private','evidence','sources'].includes(p)||(p==='proof'&&!proofTool)))return true;
 if(/^examples\//i.test(name)&&RASTER.test(name)&&!EXAMPLE_IMAGES.has(name)&&!GALLERY_IMAGE.test(name))return true;
 // A lifted folder, and the folders on the way to it, keep only the private-pack rule.
 if(lift.some(f=>name===f||name.startsWith(f+'/')||f.startsWith(name+'/')))return parts.some(p=>/^(?:private[-_]catalog|ad[-_]catalog|layout[-_]roles?|ad[-_]checkers?|ad[-_]iq)/.test(p));
 return parts.some(p=>/^(?:private[-_]catalog|ad[-_]catalog|layout[-_]roles?|ad[-_]checkers?|ad[-_]iq)/.test(p)) ||
  /^(?:assets|experiences)\//i.test(name) || /^(?:assets|experiences)$/i.test(name) ||
  /^docs\/(?:briefs|tasks|reports|reviews)(?:\/|$)/i.test(name) ||
  /(?:^|\/)(?:rio[^/]*|percy[^/]*|pelican[^/]*|lighthouse[^/]*)\.(?:svg|png|jpe?g|webp|avif|gif)$/i.test(name);
}
export function decide(name,rules){
 if(protectedPath(name,lifted(rules))||/^pieces\//i.test(name))return {include:false,reason:'protected subtree'};
 const matched=rules.filter(r=>r.test.test(name)),exclude=matched.find(r=>!r.include);
 return exclude?{include:false,reason:exclude.pattern}:{include:matched.some(r=>r.include),reason:matched.some(r=>r.include)?'included':'not selected'};
}
