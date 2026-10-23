const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS'};
const manifest={id:'org.pablo.subtitulos-ia',name:'Subtítulos IA',version:'1.0.0',description:'Subtítulos originales y traducción al español con Mistral IA.',resources:['subtitles'],types:['movie','series'],idPrefixes:['tt']};
const json=x=>new Response(JSON.stringify(x),{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
const cache=new Map(),pending=new Map();
async function remote(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(options.method?60000:10000)});if(!r.ok)throw Error(`Proveedor HTTP ${r.status}`);return r;}
function remember(k,v){cache.delete(k);cache.set(k,v);while(cache.size>32)cache.delete(cache.keys().next().value);return v;}
export function parseSrt(text){return text.replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/).map(block=>{const lines=block.split('\n'),i=lines.findIndex(x=>x.includes('-->'));if(i<0)return null;return {n:i?lines[0]:String(1),time:lines[i].replace(/(\d\d:\d\d:\d\d)\.(\d{3})/g,'$1,$2'),text:lines.slice(i+1).join('\n')}}).filter(Boolean)}
export function renderSrt(cues){return cues.map(c=>`${c.n}\n${c.time}\n${c.text}\n`).join('\n')+'\n'}
async function sources(type,id){const [imdb,season,episode]=id.split(':');const path=type==='series'?`episode-${+episode}/imdbid-${+imdb.slice(2)}/season-${+season}`:`imdbid-${+imdb.slice(2)}`;
 const results=await Promise.allSettled([
 remote(`https://rest.opensubtitles.org/search/${path}`,{headers:{'User-Agent':'SubtitulosIA v1'}}).then(r=>r.json()).then(rows=>rows.filter(s=>['srt','vtt'].includes(s.SubFormat)).map(s=>({key:s.IDSubtitleFile,url:s.SubDownloadLink,lang:s.SubLanguageID,encoding:s.SubEncoding,name:s.SubFileName}))),
 remote(`https://opensubtitles-v3.strem.io/subtitles/${type}/${id}.json`).then(r=>r.json()).then(data=>(data.subtitles||[]).map(s=>({key:s.id,url:s.url,lang:s.lang,encoding:s.SubEncoding,name:s.subtitleFileName})))
 ]);const all=results.flatMap(r=>r.status==='fulfilled'?r.value:[]),seen=new Set();return all.filter(s=>{if(!s.url||seen.has(s.url))return false;seen.add(s.url);return true})}
function token(data){return btoa(JSON.stringify(data)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
function untoken(t){if(t.length>4000)throw Error('Token inválido');return JSON.parse(atob(t.replaceAll('-','+').replaceAll('_','/')))}
function allowed(url){const u=new URL(url);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(u.hostname==='dl.opensubtitles.org'||u.hostname==='opensubtitles-v3.strem.io'||/^subs\d+\.strem\.io$/.test(u.hostname)||u.hostname==='dl.strem.io')}
async function signature(t,env){const secret=env.TOKEN_SECRET||env.MISTRAL_API_KEY||ephemeralSecret;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t)))].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function download(s){if(!allowed(s.url))throw Error('Fuente no permitida');const r=await remote(s.url);let bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>3000000)throw Error('Subtítulo demasiado grande');if(bytes[0]===31&&bytes[1]===139)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return new TextDecoder(s.encoding?.toLowerCase().replace('cp1252','windows-1252').replace('macroman','macintosh')||'windows-1252').decode(bytes)}}
async function mistralRequest(options){
 for(let attempt=0;;attempt++){try{return await remote('https://api.mistral.ai/v1/chat/completions',options);}catch(e){if(!e.message.includes('HTTP 429')||attempt>=3)throw e;const wait=[2000,5000,15000][attempt];console.warn('Mistral 429; retry in '+wait+'ms');await new Promise(r=>setTimeout(r,wait));}}
}
const ephemeralSecret=crypto.randomUUID();
export async function translateGoogle(texts,source){
 const sl=({eng:'en',fre:'fr',fra:'fr',ger:'de',deu:'de',ita:'it',por:'pt',rus:'ru'})[source]||'auto';
 const lines=texts.flatMap(t=>t.split('\n'));const translated=[];
 async function request(text){
  const url=new URL('https://translate.googleapis.com/translate_a/single');
  for(const [k,v] of Object.entries({client:'gtx',sl,tl:'es',dt:'t',q:text}))url.searchParams.set(k,v);
  const data=await (await remote(url)).json();const result=data[0]?.map(x=>x[0]||'').join('');
  if(!result)throw Error('Respuesta Google vacía');return result;
 }
 for(let i=0;i<lines.length;){
  let group=[];let size=0;
  while(i<lines.length&&lines[i].length<=1500&&size+lines[i].length+1<=1500){group.push(lines[i++]);size+=group.at(-1).length+1;}
  if(group.length){const out=(await request(group.join('\n'))).split('\n');if(out.length===group.length)translated.push(...out);else for(const line of group)translated.push(line?await request(line):'');}
  else {let rest=lines[i++],out='';while(rest.length){let end=Math.min(1500,rest.length);if(end<rest.length){const boundary=rest.slice(0,end).lastIndexOf(' ');if(boundary>750)end=boundary+1;}out+=await request(rest.slice(0,end));rest=rest.slice(end);}translated.push(out);}
 }
 let offset=0;return texts.map(t=>{const count=t.split('\n').length;const result=translated.slice(offset,offset+count).join('\n');offset+=count;return result;});
}
async function translate(s,env){const source=await download(s);if(['spa','es','Spanish'].includes(s.lang))return source;const cues=parseSrt(source);if(!cues.length)throw Error('Formato SRT/VTT no reconocido');let useMistral=Boolean(env.MISTRAL_API_KEY);console.info('Translation provider: '+(useMistral?'Mistral':'Google Translate (gtx)'));
 for(let start=0;start<cues.length;start+=40){const batch=cues.slice(start,start+40);const masks=batch.map(c=>{const tags=[];return {tags,text:c.text.replace(/<[^>]+>|\{[^}]+\}/g,t=>{tags.push(t);return `⟦TAG${tags.length-1}⟧`})}});let output;
 if(useMistral)try{const r=await mistralRequest({method:'POST',headers:{Authorization:`Bearer ${env.MISTRAL_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:env.MISTRAL_MODEL||'mistral-small-latest',temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:'Translate subtitle dialogue to natural Spanish. Input and output JSON: {"texts":[strings]}. Return exactly one translated string per input, in order. Preserve all ⟦TAGn⟧ placeholders verbatim. Never merge or omit entries. Only translate dialogue, not placeholders.'},{role:'user',content:JSON.stringify({texts:masks.map(x=>x.text)})}]})});output=JSON.parse((await r.json()).choices[0].message.content).texts;if(!Array.isArray(output)||output.length!==batch.length||output.some((x,i)=>typeof x!=='string'||masks[i].tags.some((_,j)=>!x.includes(`⟦TAG${j}⟧`))))throw Error('Respuesta de traducción inválida');}catch(e){useMistral=false;console.warn('Mistral failed ('+e.message+'); Translation provider: Google Translate (gtx)');}
 if(!useMistral)output=await translateGoogle(masks.map(x=>x.text),s.lang);
 output.forEach((text,i)=>{batch[i].text=text.replace(/⟦TAG(\d+)⟧/g,(_,j)=>masks[i].tags[+j]||'')});}
 return renderSrt(cues)}
export default {async fetch(request,env={}){const u=new URL(request.url);try{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='GET')return new Response('Método no permitido',{status:405,headers});
 let p=u.pathname;const gate=env.ACCESS_TOKEN;const prefix=gate?`/t-${gate}`:'';
 const html=(body,status=200)=>new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Subtítulos IA</title><body style="font:20px system-ui;max-width:720px;margin:80px auto;padding:24px">${body}</body></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 if(gate&&p==='/')return html(`<h1>Subtítulos IA</h1><p>Acceso privado. Ingresa el código de acceso:</p><form onsubmit="event.preventDefault();location='/t-'+document.getElementById('c').value.trim()+'/'"><input id="c" autofocus style="font:20px system-ui;padding:10px;border:1px solid #ccc;border-radius:8px"><button style="font:20px system-ui;padding:10px 18px;margin-left:8px;border:0;border-radius:8px;background:#7c3aed;color:#fff">Entrar</button></form>`);
 if(gate){const m=p.match(/^\/t-([^/]+)(\/.*)?$/);if(!m||m[1]!==gate)return new Response('No encontrado',{status:404,headers});p=m[2]||'/';}
 if(p==='/manifest.json')return json(manifest);
 if(p==='/')return html(`<h1>Subtítulos IA</h1><p>Subtítulos originales y traducciones al español con Mistral.</p><a href="stremio://${u.host}${prefix}/manifest.json">Instalar en Stremio</a><p>URL manual: <code>${u.host}${prefix}/manifest.json</code></p><p>La primera traducción puede tardar varios minutos. Las siguientes usan caché.</p>`);
 const match=p.match(/^\/subtitles\/(movie|series)\/(.+)\.json$/);if(match){const [,type,id]=match;if(!/^tt\d+(?::\d+:\d+)?$/.test(id)||(type==='series'&&!/^tt\d+:\d+:\d+$/.test(id)))return json({subtitles:[]});const list=await sources(type,id);const base=(env.PUBLIC_BASE_URL||u.origin).replace(/\/$/,'')+prefix;const originals=list.map((s,i)=>({id:`original-${i}-${s.key}`,lang:s.lang,url:s.url,m:s.name||s.lang}));const best=list.filter(s=>!['spa','es','Spanish'].includes(s.lang)).sort((a,b)=>(a.lang==='eng'?-1:1)-(b.lang==='eng'?-1:1)).slice(0,3);return json({subtitles:[...originals,...await Promise.all(best.map(async s=>{const raw=token({url:s.url,lang:s.lang,encoding:s.encoding});const t=raw+'.'+await signature(raw,env);return {id:`ia-${s.key}`,lang:'spa',url:`${base}/subtitle/${t}.srt`,m:`🤖 Traducido al español (IA) — desde ${s.lang}`}}))]})}
 const sub=p.match(/^\/subtitle\/([\w.-]+)\.srt$/);if(sub){let s;try{const [raw,sig]=sub[1].split('.');if(!sig||sig!==await signature(raw,env))throw Error();s=untoken(raw);if(!allowed(s.url))throw Error()}catch{return new Response('Token inválido',{status:400,headers})}const key=sub[1];let text=cache.get(key);if(!text){if(!pending.has(key))pending.set(key,translate(s,env).then(t=>remember(key,t)).finally(()=>pending.delete(key)));text=await pending.get(key)}return new Response(text,{headers:{...headers,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=86400'}})}
 return new Response('No encontrado',{status:404,headers});
 }catch(e){console.error(e.message);return new Response(`No se pudo obtener el subtítulo: ${e.message}`,{status:502,headers})}}};
