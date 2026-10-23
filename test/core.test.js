import test from 'node:test';
import assert from 'node:assert/strict';
test('manifest exposes Spanish subtitle addon with CORS', async () => {
 const {default: app}=await import('../core.js');
 const r=await app.fetch(new Request('http://localhost/manifest.json'),{});
 assert.equal(r.headers.get('access-control-allow-origin'),'*');
 assert.equal((await r.json()).name,'Subtítulos IA');
});
