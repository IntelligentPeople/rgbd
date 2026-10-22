import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { encode } from 'fast-png';
import { unpackPackage, decodeGT } from './package';
test('package requires exact root filenames and accepts optional GT', () => {
  const files = { 'rgb.png': new Uint8Array([1]), 'depth.png': new Uint8Array([2]) };
  assert.equal(Object.keys(unpackPackage(zipSync(files))).length, 2);
  assert.equal(Object.keys(unpackPackage(zipSync({ ...files, 'gt.png': new Uint8Array([3]) }))).length, 3);
  assert.throws(() => unpackPackage(zipSync({ 'rgb.png': files['rgb.png'] })), /缺少/);
  assert.throws(() => unpackPackage(zipSync({ ...files, 'folder/gt.png': new Uint8Array() })), /根目录/);
});
test('GT decodes sparse 16-bit instance IDs without merging them', () => {
  const data = new Uint16Array(1024 * 1024); data[0] = 1; data[1025] = 300; data[1026] = 300;
  const gt = decodeGT(encode({ width: 1024, height: 1024, channels: 1, depth: 16, data }));
  assert.deepEqual(gt.map((g) => g.id), ['1', '300']);
  assert.equal(gt[1].mask.pixels[1025], 1);
  assert.equal(gt[0].mask.pixels[1025], 0);
  assert.throws(() => decodeGT(encode({ width: 2, height: 2, channels: 1, data: new Uint8Array(4) })), /GT 应为/);
});
