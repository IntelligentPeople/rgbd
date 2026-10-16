import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBackendAdapter } from './mock';
import { fingerprint } from '../backend/fingerprint';
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
  const adapter = new MockBackendAdapter(false, store);
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
  assert.equal('info' in adapter, false);
  assert.deepEqual(Object.keys(uploaded).sort(), ['inputId', 'models']);
  for (const model of uploaded.models) {
    assert.equal('source' in model, false);
    assert.doesNotMatch(JSON.stringify(model), /mock|cached|live|fixture|模拟/i);
  }
});
test('both file contents must match; unknown pair never reuses another result', async () => {
  const store = await fixtureStore();
  const adapter = new MockBackendAdapter(false, store);
  await assert.rejects(
    adapter.compare({ ...input, depth: new Blob(['other-depth']) }),
    /暂时无法处理此输入/,
  );
  await assert.rejects(
    adapter.compare({ ...input, rgb: new Blob(['other-rgb']) }),
    /暂时无法处理此输入/,
  );
  assert.equal(store.loads, 0);
});
test('aborted comparison stops before fixture access', async () => {
  const store = await fixtureStore();
  const controller = new AbortController();
  const pending = new MockBackendAdapter(false, store).compare(input, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(store.loads, 0);
});
test('failure is recoverable and subsequent request succeeds', async () => {
  const adapter = new MockBackendAdapter(true, await fixtureStore());
  await assert.rejects(adapter.compare(input), /请重试/);
  assert.equal((await adapter.compare(input)).models[0].status, 'success');
});
