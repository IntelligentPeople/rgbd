import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockAdapter } from './mock';
import { fingerprint } from '../input/fingerprint';
const input = { id: 'sample', rgb: new Blob(['rgb']), depth: new Blob(['depth']) };
async function fixtureStore() {
  const hashes = await fingerprint(input);
  let loads = 0;
  return {
    get loads() {
      return loads;
    },
    list: async () => [{ ...hashes, resultUrl: '/result.json' }],
    load: async () => {
      loads++;
      return { baseline: [], improved: [] };
    },
    decode: async () => [],
  };
}
test('sample and upload bytes share one interface without GT or sample IDs', async () => {
  const store = await fixtureStore();
  const adapter = new MockAdapter(false, store);
  const sample = await adapter.compare(input);
  const uploaded = await adapter.compare({
    id: 'upload',
    rgb: new File(['rgb'], 'renamed.png'),
    depth: new File(['depth'], 'another-name.png'),
  });
  assert.equal(sample.inputId, 'sample');
  assert.equal(uploaded.inputId, 'upload');
  assert.deepEqual(sample.models, uploaded.models);
  assert.equal(store.loads, 2);
});
test('both file contents must match; unknown pair never reuses another result', async () => {
  const store = await fixtureStore();
  const adapter = new MockAdapter(false, store);
  await assert.rejects(
    adapter.compare({ ...input, depth: new Blob(['other-depth']) }),
    /没有该输入的测试结果/,
  );
  await assert.rejects(
    adapter.compare({ ...input, rgb: new Blob(['other-rgb']) }),
    /没有该输入的测试结果/,
  );
  assert.equal(store.loads, 0);
});
test('aborted comparison stops before fixture access', async () => {
  const store = await fixtureStore();
  const controller = new AbortController();
  const pending = new MockAdapter(false, store).compare(input, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(store.loads, 0);
});
test('failure is recoverable and subsequent request succeeds', async () => {
  const adapter = new MockAdapter(true, await fixtureStore());
  await assert.rejects(adapter.compare(input), /请重试/);
  assert.equal((await adapter.compare(input)).models[0].status, 'success');
});
