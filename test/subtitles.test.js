import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../core.js';
import {parseSrt,renderSrt} from '../core.js';
test('cue roundtrip retains timestamps and tags',()=>{const s='1\n00:00:01,000 --> 00:00:02,000\n<i>Hello</i>\n';assert.equal(renderSrt(parseSrt(s)),s+'\n')});
test('unknown routes return 404',async()=>assert.equal((await app.fetch(new Request('http://localhost/nope'))).status,404));
test('invalid id returns empty subtitle list',async()=>assert.deepEqual(await (await app.fetch(new Request('http://localhost/subtitles/movie/no.json'))).json(),{subtitles:[]}));
test('arbitrary source tokens rejected',async()=>assert.equal((await app.fetch(new Request('http://localhost/subtitle/garbage.srt'))).status,400));
