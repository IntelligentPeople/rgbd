import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockProvider } from './mock';
test('mock does not return fixed predictions for uploaded input', async () => {
  const provider = new MockProvider();
  assert.equal(provider.getCapabilities().uploadInference, false);
  await assert.rejects(
    provider.compare({
      kind: 'upload',
      rgb: new File([], 'rgb.png'),
      depth: new File([], 'depth.png'),
    }),
    /尚未接入/,
  );
});
test('aborted comparison stops before accessing fixtures', async () => {
  const controller = new AbortController();
  const pending = new MockProvider().compare(
    { kind: 'sample', sampleId: 'example' },
    controller.signal,
  );
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
test('failure fixture reports a recoverable error before resource access', async () => {
  await assert.rejects(
    new MockProvider(true).compare({ kind: 'sample', sampleId: 'example' }),
    /请重试/,
  );
});
