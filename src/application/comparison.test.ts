import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Comparison } from '../domain/types';
import { validateComparison } from './comparison';
const input = { id: 'current', rgb: new Blob(), depth: new Blob() };
function result(): Comparison {
  return {
    inputId: input.id,
    models: [
      {
        role: 'baseline',
        name: 'baseline',
        version: '1',

        elapsedMs: 1,
        status: 'success',
        instances: [],
      },
      {
        role: 'improved',
        name: 'improved',
        version: '1',

        elapsedMs: 1,
        status: 'error',
        message: 'failed',
      },
    ],
  };
}
test('empty predictions and one-model failure remain valid results', () => {
  assert.doesNotThrow(() => validateComparison(result(), input));
});
test('wrong input and duplicate model roles cannot enter display state', () => {
  const value = result();
  value.inputId = 'old';
  assert.throws(() => validateComparison(value, input), /不匹配/);
  value.inputId = input.id;
  value.models[1].role = 'baseline';
  assert.throws(() => validateComparison(value, input), /两个模型/);
});
test('predictions must include confidence and original-size masks', () => {
  const value = result();
  const model = value.models[0];
  if (model.status !== 'success') throw new Error();
  model.instances.push({
    id: '1',
    categoryId: 1,
    score: NaN,
    mask: { width: 1024, height: 1024, pixels: new Uint8Array(1024 * 1024) },
  });
  assert.throws(() => validateComparison(value, input), /置信度/);
  model.instances[0].score = 0.8;
  model.instances[0].mask.width = 1;
  assert.throws(() => validateComparison(value, input), /原图/);
});
