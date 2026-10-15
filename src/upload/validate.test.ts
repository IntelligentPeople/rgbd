import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectPng } from './validate';
function header(depth = 8, type = 2, width = 1024) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, 1024);
  bytes[24] = depth;
  bytes[25] = type;
  return bytes;
}
test('accept course RGB and preserve 16-bit depth requirement', () => {
  assert.deepEqual(inspectPng(header(), 'rgb'), { width: 1024, height: 1024 });
  assert.deepEqual(inspectPng(header(16, 0), 'depth'), { width: 1024, height: 1024 });
  assert.throws(() => inspectPng(header(8, 0), 'depth'), /16 位/);
  assert.throws(() => inspectPng(header(8, 6), 'rgb'), /三通道/);
});
test('reject corrupt signature, short data and wrong dimensions', () => {
  assert.throws(() => inspectPng(new Uint8Array(8), 'rgb'), /有效/);
  const bytes = header();
  bytes[0] = 0;
  assert.throws(() => inspectPng(bytes, 'rgb'), /有效/);
  assert.throws(() => inspectPng(header(8, 2, 512), 'rgb'), /1024/);
});
