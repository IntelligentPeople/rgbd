import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareEvaluation,
  evaluate,
  meanAP,
  atConfidence,
  interpolatePrecision,
  confidenceLevels,
  confidenceAtPrefix,
  confidencePrefix,
} from './instanceMetrics';
import type { GroundTruthInstance, PredictionInstance } from '../domain/types';
const mask = (indices: number[], width = 2048) => ({
  width,
  height: 1,
  pixels: Uint8Array.from({ length: width }, (_, i) => Number(indices.includes(i))),
});
const gt = (id: string, indices: number[]): GroundTruthInstance => ({
  id,
  categoryId: 1,
  mask: mask(indices),
});
const pred = (id: string, indices: number[], score: number): PredictionInstance => ({
  ...gt(id, indices),
  score,
});

test('confidence ordering changes AP; filtering only selects a curve point', () => {
  const g = [gt('g', [0, 1])];
  const a = prepareEvaluation(g, [pred('correct', [0, 1], 0.9), pred('wrong', [9], 0.8)]);
  const b = prepareEvaluation(g, [pred('correct', [0, 1], 0.8), pred('wrong', [9], 0.9)]);
  assert.equal(evaluate(a, 0.5, 'all').ap, 1);
  assert.equal(evaluate(b, 0.5, 'all').ap, 0.5);
  assert.deepEqual(atConfidence(evaluate(b, 0.5, 'all'), 0.9), {
    precision: 0,
    recall: 0,
    tp: 0,
    fp: 1,
    fn: 1,
  });
  assert.equal(atConfidence(evaluate(b, 0.5, 'all'), 0.8).recall, 1);
});
test('IoU changes matching and duplicate predictions cannot match twice', () => {
  const d = prepareEvaluation(
    [gt('g', [0, 1, 2, 3])],
    [pred('a', [0, 1, 2], 0.9), pred('b', [0, 1, 2, 3], 0.8)],
  );
  const loose = evaluate(d, 0.5, 'all');
  assert.deepEqual(
    loose.entries.map((e) => e.gtIndex),
    [0, -1],
  );
  assert.equal(loose.ap, 1);
  assert.equal(evaluate(d, 0.8, 'all').ap, 0.5);
  assert.equal(meanAP(d, 'all'), 0.8);
});
test('small evaluation ignores matched large GT and unmatched large predictions', () => {
  const big = Array.from({ length: 1025 }, (_, i) => i + 10);
  const d = prepareEvaluation(
    [gt('small', [0, 1]), gt('large', big)],
    [
      pred('large', big, 0.95),
      pred('small', [0, 1], 0.8),
      pred('duplicate-large', big, 0.7),
      pred('false-small', [2000], 0.6),
    ],
  );
  const e = evaluate(d, 0.5, 'small');
  assert.equal(e.total, 1);
  assert.deepEqual(
    e.entries.map((e) => e.ignored),
    [true, false, true, false],
  );
  assert.equal(e.ap, 1);
  assert.deepEqual(atConfidence(e, 0.5), { precision: 0.5, recall: 1, tp: 1, fp: 1, fn: 0 });
});
test('empty predictions yield zero AP; no small GT yields unavailable APs', () => {
  assert.equal(evaluate(prepareEvaluation([gt('g', [0])], []), 0.5, 'all').ap, 0);
  assert.equal(meanAP(prepareEvaluation([], [pred('p', [0], 0.8)]), 'small'), null);
  assert.equal(
    evaluate(
      prepareEvaluation(
        [
          gt(
            'edge',
            Array.from({ length: 1024 }, (_, i) => i),
          ),
        ],
        [],
      ),
      0.5,
      'small',
    ).total,
    1,
  );
});

test('displayed interpolation is monotone and its 101 equal-width columns sum to AP', () => {
  const d = prepareEvaluation(
    [gt('g1', [0]), gt('g2', [2]), gt('g3', [4])],
    [
      pred('p1', [0], 0.99999),
      pred('fp', [8], 0.99998),
      pred('p2', [2], 0.99997),
      pred('p3', [4], 0.99996),
    ],
  );
  const e = evaluate(d, 0.5, 'all');
  assert.ok(e.points[1].precision < e.points[2].precision);
  assert.equal(e.samples.length, 101);
  for (let i = 1; i < 101; i++) assert.ok(e.samples[i] <= e.samples[i - 1]);
  for (let i = 1; i < e.envelope.length; i++)
    assert.ok(e.envelope[i].precision <= e.envelope[i - 1].precision);
  assert.equal(e.samples.reduce((s, p) => s + p, 0) / 101, e.ap);
  assert.equal(e.samples[0], 1);
  assert.equal(e.samples[100], 0.75);
});

test('sampling uses zero beyond maximum recall, not invented predictions', () => {
  const e = interpolatePrecision([{ recall: 0.5, precision: 1, score: 0.9, tp: 1, fp: 0 }]);
  assert.equal(e.samples[50], 1);
  assert.equal(e.samples[51], 0);
});

test('exact score navigation reaches clustered scores and respects tied candidates', () => {
  const d = prepareEvaluation(
    [gt('g', [0])],
    [
      pred('a', [0], 0.9999998),
      pred('b', [1], 0.9999997),
      pred('c', [2], 0.9999997),
      pred('one', [9], 1),
    ],
  );
  const e = evaluate(d, 0.5, 'all');
  const levels = confidenceLevels([e]);
  assert.deepEqual(levels, [1, 0.9999998, 0.9999997]);
  assert.equal(
    atConfidence(e, confidenceAtPrefix(levels, 0)).tp +
      atConfidence(e, confidenceAtPrefix(levels, 0)).fp,
    0,
  );
  for (let prefix = 0; prefix <= levels.length; prefix++)
    assert.equal(confidencePrefix(levels, confidenceAtPrefix(levels, prefix)), prefix);
  assert.equal(
    atConfidence(e, confidenceAtPrefix(levels, 3)).tp +
      atConfidence(e, confidenceAtPrefix(levels, 3)).fp,
    4,
  );
});
