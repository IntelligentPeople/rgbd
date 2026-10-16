import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode } from 'fast-png';
import { decodeDepth, colorizeDepth } from './depth';
import { fingerprint } from '../backend/fingerprint';
test('16-bit decoding preserves depths above 255 and preview leaves raw values untouched', () => {
  const data = new Uint16Array(1024 * 1024);
  data[0] = 257;
  data[1] = 4096;
  data[2] = 65535;
  const bytes = encode({ width: 1024, height: 1024, depth: 16, channels: 1, data });
  const decoded = decodeDepth(bytes);
  assert.deepEqual([...decoded.slice(0, 3)], [257, 4096, 65535]);
  const rgba = colorizeDepth(decoded);
  assert.deepEqual([...rgba.slice(12, 16)], [0, 0, 0, 255]);
  assert.deepEqual([...decoded.slice(0, 3)], [257, 4096, 65535]);
  assert.notDeepEqual([...rgba.slice(0, 3)], [...rgba.slice(8, 11)]);
});
test('all invalid depth is rejected, constant valid depth has a usable preview', () => {
  assert.throws(() => colorizeDepth(new Uint16Array(4)), /没有有效像素/);
  assert.equal(colorizeDepth(new Uint16Array([1000, 1000])).length, 8);
});
test('RGB/depth fingerprints are stable and sensitive to either payload', async () => {
  const pair = { rgb: new Blob(['rgb']), depth: new Blob(['depth']) };
  assert.deepEqual(
    await fingerprint(pair),
    await fingerprint({ rgb: new File(['rgb'], 'name.png'), depth: pair.depth }),
  );
  assert.notDeepEqual(
    await fingerprint(pair),
    await fingerprint({ ...pair, depth: new Blob(['changed']) }),
  );
});
