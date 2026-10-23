import assert from 'node:assert/strict';
import {parseSrt} from '../core.js';
const base=(process.env.BASE_URL||process.argv[2]||'http://127.0.0.1:7111').replace(/\/$/,'');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(900000)});assert.equal(r.status,200,`${url}: ${r.status} ${r.ok?'':await r.text()}`);return r;}
try{
 const manifest=await (await get(base+'/manifest.json')).json();assert.ok(manifest.resources.includes('subtitles'));console.log('PASS manifest');
 const movie=await (await get(base+'/subtitles/movie/tt0137523.json')).json();
 const series=await (await get(base+'/subtitles/series/tt0903747:1:1.json')).json();
 for(const [name,data] of [['movie',movie],['series',series]]){assert.ok(data.subtitles.some(s=>s.id.startsWith('original-')));assert.ok(data.subtitles.some(s=>s.id.startsWith('ia-')));console.log(`PASS ${name}: ${data.subtitles.length} entries`);}
 const chosen=movie.subtitles.find(s=>s.id.startsWith('ia-'));
 const raw=chosen.url.split('/subtitle/')[1].split('.')[0];const source=JSON.parse(Buffer.from(raw,'base64url').toString());
 const r=await get(source.url);let bytes=new Uint8Array(await r.arrayBuffer());if(bytes[0]===31&&bytes[1]===139)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 let original;try{original=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{original=new TextDecoder('windows-1252').decode(bytes);}
 const text=await (await get(chosen.url)).text();const before=parseSrt(original),after=parseSrt(text);
 assert.ok(after.length>100);assert.deepEqual(after.map(c=>[c.n,c.time]),before.map(c=>[c.n,c.time]));assert.notEqual(after.map(c=>c.text).join(''),before.map(c=>c.text).join(''));
 assert.ok(/\b(que|para|pero|estoy|tengo|quiero|una|por|los)\b/i.test(after.map(c=>c.text).join(' ')),'Spanish dialogue expected');assert.ok(!/⟦TAG/.test(text),'Unrestored formatting placeholders');
 console.log(`PASS translated SRT: ${after.length} cues; numbers and timestamps unchanged`);console.log('SAMPLE\n'+after.slice(0,8).map(c=>`${c.n}\n${c.time}\n${c.text}`).join('\n\n'));console.log('ALL REAL CHECKS PASSED');
}catch(e){console.error(e);process.exitCode=1;}
