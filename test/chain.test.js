import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../core.js';
for(const status of [401,429])test(`Mistral ${status} falls back to Google with intact cue timing`,async()=>{
 const savedFetch=globalThis.fetch,savedTimeout=globalThis.setTimeout;let attempts=0,google=0;const waits=[];
 globalThis.setTimeout=(fn,ms,...args)=>{waits.push(ms);return savedTimeout(fn,0,...args);};
 globalThis.fetch=async url=>{const u=String(url);
 if(u.includes('api.mistral.ai')){attempts++;return new Response('',{status});}
 if(u.includes('translate.googleapis.com')){google++;return Response.json([[[new URL(u).searchParams.get('q').replace('Hello','Hola')]]]);}
 if(u.includes('/search/'))return Response.json([{SubFormat:'srt',IDSubtitleFile:'x',SubDownloadLink:'https://dl.opensubtitles.org/test',SubLanguageID:'eng'}]);
 if(u.includes('/subtitles/'))return Response.json({subtitles:[]});
 return new Response('7\n00:00:01,123 --> 00:00:03,456\nHello\n');
 };
 try{const env={MISTRAL_API_KEY:'test-only-not-a-real-key',TOKEN_SECRET:`test-${status}`};const list=await (await app.fetch(new Request('http://localhost/subtitles/movie/tt123.json'),env)).json();const result=await app.fetch(new Request(list.subtitles.find(s=>s.id.startsWith('ia-')).url),env);assert.equal(result.status,200);assert.match(await result.text(),/7\n00:00:01,123 --> 00:00:03,456\nHola/);assert.equal(attempts,status===429?4:1);assert.equal(google,1);if(status===429)assert.deepEqual(waits,[2000,5000,15000]);}finally{globalThis.fetch=savedFetch;globalThis.setTimeout=savedTimeout;}
});
