import type { GroundTruthInstance, PredictionInstance, Mask } from '../domain/types';

export type Scope = 'all' | 'small';
export type Point = { precision: number; recall: number; score: number; tp: number; fp: number };
export type Evaluation = {
  points: Point[];
  ap: number | null;
  total: number;
  envelope: { recall: number; precision: number }[];
  samples: number[];
  entries: { prediction: PredictionInstance; gtIndex: number; iou: number; ignored: boolean }[];
};
const sparseCache = new WeakMap<Mask, Uint32Array>();
function sparse(mask: Mask) {
  let result = sparseCache.get(mask);
  if (!result) {
    const indices: number[] = [];
    mask.pixels.forEach((v, i) => {
      if (v) indices.push(i);
    });
    result = Uint32Array.from(indices);
    sparseCache.set(mask, result);
  }
  return result;
}
export function maskArea(mask: Mask) {
  return sparse(mask).length;
}

// Geometry is independent of confidence and IoU controls. Keep original-resolution masks.
export function prepareEvaluation(gt: GroundTruthInstance[], predictions: PredictionInstance[]) {
  const sorted = predictions
    .map((prediction, index) => ({ prediction, index }))
    .sort((a, b) => b.prediction.score - a.prediction.score || a.index - b.index)
    .slice(0, 100)
    .map((v) => v.prediction);
  const gtAreas = gt.map((g) => maskArea(g.mask));
  const areas = sorted.map((p) => maskArea(p.mask));
  const overlaps = sorted.map((p, pi) =>
    gt.map((g, gi) => {
      if (p.categoryId !== g.categoryId) return 0;
      const [a, b] = areas[pi] < gtAreas[gi] ? [p.mask, g.mask] : [g.mask, p.mask];
      let intersection = 0;
      for (const i of sparse(a)) if (b.pixels[i]) intersection++;
      const union = areas[pi] + gtAreas[gi] - intersection;
      return union ? intersection / union : 0;
    }),
  );
  return { gt, sorted, gtAreas, areas, overlaps };
}
export type Prepared = ReturnType<typeof prepareEvaluation>;

// Single-class, non-crowd COCO matching: non-ignored GT before area-ignored GT.
export function evaluate(data: Prepared, iou: number, scope: Scope): Evaluation {
  const ignored = data.gtAreas.map((area) => scope === 'small' && area > 1024);
  const total = ignored.filter((v) => !v).length;
  const order = data.gt.map((_, i) => i).sort((a, b) => Number(ignored[a]) - Number(ignored[b]));
  const matched = new Set<number>();
  const points: Point[] = [];
  let tp = 0,
    fp = 0;
  const entries = data.sorted.map((prediction, pi) => {
    let best = -1,
      bestIoU = iou;
    for (const gi of order) {
      if (matched.has(gi)) continue;
      if (best >= 0 && !ignored[best] && ignored[gi]) break;
      if (data.overlaps[pi][gi] < bestIoU) continue;
      bestIoU = data.overlaps[pi][gi];
      best = gi;
    }
    if (best >= 0) matched.add(best);
    const skip = best >= 0 ? ignored[best] : scope === 'small' && data.areas[pi] > 1024;
    if (!skip) {
      if (best >= 0) tp++;
      else fp++;
      points.push({
        precision: tp / (tp + fp),
        recall: total ? tp / total : 0,
        score: prediction.score,
        tp,
        fp,
      });
    }
    return { prediction, gtIndex: best, iou: best >= 0 ? bestIoU : 0, ignored: skip };
  });
  // COCO uses 101 recall samples from the monotone precision envelope.
  const interpolated = interpolatePrecision(points);
  return {
    points,
    entries,
    total,
    ...interpolated,
    ap: total ? interpolated.samples.reduce((sum, p) => sum + p, 0) / 101 : null,
  };
}
// This single result drives BOTH the displayed envelope/samples and the AP value.
export function interpolatePrecision(points: Point[]) {
  const precision = points.map((p) => p.precision);
  for (let i = precision.length - 2; i >= 0; i--)
    precision[i] = Math.max(precision[i], precision[i + 1]);
  const envelope = points.flatMap((p, i) =>
    i === 0 || p.recall !== points[i - 1].recall
      ? [{ recall: p.recall, precision: precision[i] }]
      : [],
  );
  let cursor = 0;
  const samples = Array.from({ length: 101 }, (_, k) => {
    while (cursor < points.length && points[cursor].recall < k / 100) cursor++;
    return precision[cursor] ?? 0;
  });
  return { envelope, samples };
}

// A score threshold can select only complete tie groups. Rank steps preserve exact scores.
export function confidenceLevels(evaluations: Evaluation[]) {
  return [
    ...new Set(
      evaluations.flatMap((e) =>
        e.entries.filter((v) => !v.ignored).map((v) => v.prediction.score),
      ),
    ),
  ].sort((a, b) => b - a);
}
export function confidencePrefix(levels: number[], threshold: number) {
  return levels.filter((score) => score >= threshold).length;
}
export function confidenceAtPrefix(levels: number[], prefix: number) {
  if (!levels.length) return 1;
  return prefix <= 0
    ? Math.max(1, levels[0] + Number.EPSILON)
    : levels[Math.min(prefix, levels.length) - 1];
}
export function atConfidence(evaluation: Evaluation, threshold: number) {
  const point = evaluation.points.filter((p) => p.score >= threshold).at(-1);
  const tp = point?.tp ?? 0,
    fp = point?.fp ?? 0;
  return {
    precision: point?.precision ?? 0,
    recall: point?.recall ?? 0,
    tp,
    fp,
    fn: evaluation.total - tp,
  };
}
export function meanAP(data: Prepared, scope: Scope) {
  const values = Array.from({ length: 10 }, (_, i) => evaluate(data, (50 + i * 5) / 100, scope).ap);
  return values[0] === null ? null : values.reduce<number>((sum, v) => sum + (v ?? 0), 0) / 10;
}
