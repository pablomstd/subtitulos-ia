import test from 'node:test';
import assert from 'node:assert/strict';
import {translateGoogle} from '../core.js';
test('keyless Google segments long dialogue and preserves formatting',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{const u=new URL(url);assert.equal(u.hostname,'translate.googleapis.com');assert.ok(u.searchParams.get('q').length<=1500);calls++;return Response.json([[[u.searchParams.get('q').replaceAll('Hello','Hola')]]]);};
 try {const result=await translateGoogle(['<i>Hello</i>\nHello', 'Hello. '.repeat(400)],'eng');assert.equal(result[0],'<i>Hola</i>\nHola');assert.ok(result[1].includes('Hola'));assert.ok(calls>1);}finally{globalThis.fetch=original;}
});
