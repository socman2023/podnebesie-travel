import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { nextRandom } from '../src/rng.js';
import { rankedRoutes, pageForRoute } from '../src/route-list.js';
import { assignBotStylesForMode } from '../src/bot-assignment.js';

test('all source modules parse as JavaScript', () => {
  for (const file of readdirSync(new URL('../src/', import.meta.url)).filter(f=>f.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', new URL('../src/'+file, import.meta.url).pathname], {encoding:'utf8'});
    assert.equal(result.status,0,file+': '+result.stderr);
  }
});

test('HTML entry loads stylesheet and ES-module without inlining game', () => {
  const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(index,/styles\/base\.css/);
  assert.match(index,/styles\/vk-responsive\.css/);
  assert.match(index,/type="module" src="\.\/src\/main\.js"/);
  assert.ok(index.length<3000);
});

test('pseudo-random sequence is reproducible',()=>{
  assert.deepEqual(nextRandom(1234),nextRandom(1234));
  const sample=nextRandom(1234);
  assert.ok(sample.value>=0 && sample.value<1);
});

test('route ranking keeps stable ties and selects page',()=>{
  const routes=[['A','B'],['A','C'],['A','D']];
  const sorted=rankedRoutes(routes,path=>path.at(-1)==='C'?10:5);
  assert.deepEqual(sorted.map(x=>x.index),[1,0,2]);
  assert.equal(pageForRoute(sorted,2,2),1);
});

test('mixed bot assignment covers each skill for 3 bots',()=>{
  const styles=assignBotStylesForMode(['a','b','c'],'mixed',()=>0.21);
  assert.deepEqual(Object.values(styles).sort(),['basic','lookahead','random']);
});
