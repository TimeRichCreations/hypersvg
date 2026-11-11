// Local pattern scan. Diagnostics name the file/rule, never the matched value.
import path from 'node:path';
const rules=[
 ['provider credential',/\bsk-(?:or-v1-|proj-|ant-(?:api\d+-)?)?[A-Za-z0-9_-]{16,}/g],
 ['GitHub credential',/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g],
 ['cloud credential',/\b(?:(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]{15,})/g],
 ['private key',/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g],
 ['JWT',/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g],
 ['credential URL',/\bhttps?:\/\/[^\s/'"<>:]+:[^\s/'"<>@]+@/g],
 ['literal credential',/\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|authorization)\s*["']?\s*[:=]\s*["'][A-Za-z0-9_+./=-]{8,}["']/gi],
 // A drive path into a folder (a drive letter, a slash, a folder, a slash). A bare drive file is a checker fixture, not a PC path;
 // a letter after a backslash is a regular-expression escape (\\d:\\d), not a drive.
 ['private drive path',/(?<![\w\\])[a-z]:[\\/]+(?:[^\\/\s'"`<>|*?]+[\\/]|(?:Users|HyperSVG[-]bench)\b)/gi],
 ['private bench path',/HyperSVG[-]bench/gi],
 ['private rule pack',/(?<![A-Za-z0-9])ad[-_]iq(?![A-Za-z0-9])/gi],
 // A user name never starts with a dot: /home/.test(x) is a regular expression, not a home folder.
 ['private home path',/(?<![\w/])\/(?:Users|home|workspace)\/[A-Za-z0-9_-][A-Za-z0-9_.-]*/g],
 ['private UNC path',/(?:\\\\|\/\/)(?:[A-Za-z0-9_.-]+)[\\/](?:Users|private|share)[\\/]/gi]
];
const sensitive=/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.npmrc|\.pypirc|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|credentials(?:\.json)?|[^/]+\.(?:p12|pfx|pem|key))$/i;
function decoded(input){return input.replace(/\\u([a-f0-9]{4})|\\x([a-f0-9]{2})/gi,(_,u,x)=>String.fromCharCode(parseInt(u||x,16)));}
export function scan(name,bytes){
 const findings=[];if(sensitive.test(name)||/(?:^|\/)\.env(?:\.[^/]*)?(?:\/|$)/i.test(name))findings.push({rule:'sensitive filename',line:0});
 const original=Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes);
 const texts=[original,decoded(original)];
 if(Buffer.isBuffer(bytes)&&bytes.length>=2){if(bytes[0]===0xff&&bytes[1]===0xfe)texts.push(bytes.subarray(2).toString('utf16le'));if(bytes[0]===0xfe&&bytes[1]===0xff){const swapped=Buffer.from(bytes.subarray(2,bytes.length-bytes.length%2));swapped.swap16();texts.push(swapped.toString('utf16le'));}}
 for(const text of new Set(texts))for(const [rule,re]of rules){re.lastIndex=0;let match;while((match=re.exec(text))){const line=text.slice(0,match.index).split('\n').length;if(!findings.some(f=>f.rule===rule&&f.line===line))findings.push({rule,line});}}
 return findings;
}
export function safeName(name){return scan('',name).length?'[redacted filename]':name.split(path.sep).join('/');}
