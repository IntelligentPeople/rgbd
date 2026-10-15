import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleInstances, zoomView } from './render';
const mask={width:1,height:1,pixels:new Uint8Array([1])};
test('threshold keeps GT independent and includes equal confidence',()=>{
  const instances=[{id:'gt',categoryId:1,mask},{id:'a',categoryId:1,score:.5,mask},{id:'b',categoryId:1,score:.49,mask}];
  assert.deepEqual(visibleInstances(instances,.5).map(i=>i.id),['gt','a']);
  assert.deepEqual(visibleInstances(instances,1).map(i=>i.id),['gt']);
});
test('zoom remains bounded and retains normalized pan',()=>{
  assert.deepEqual(zoomView({zoom:7,x:.1,y:.2},2),{zoom:8,x:.1,y:.2});
  assert.equal(zoomView({zoom:1,x:0,y:0},.5).zoom,1);
});
