import type { Comparison, InferenceInput } from '../domain/types';
import { COURSE_INPUT } from '../domain/inputSpec';
export function validateComparison(result: Comparison, input: InferenceInput) {
  if (result.inputId !== input.id) throw new Error('预测结果与当前输入不匹配。');
  if (
    result.models.length !== 2 ||
    new Set(result.models.map((m) => m.role)).size !== 2 ||
    !result.models.some((m) => m.role === 'baseline') ||
    !result.models.some((m) => m.role === 'improved')
  )
    throw new Error('结果必须包含基线与改进两个模型。');
  for (const model of result.models) {
    if (model.status !== 'success') continue;
    for (const instance of model.instances) {
      if (!Number.isFinite(instance.score) || instance.score < 0 || instance.score > 1)
        throw new Error('预测置信度必须为 0–1。');
      if (
        instance.mask.width !== COURSE_INPUT.width ||
        instance.mask.height !== COURSE_INPUT.height ||
        instance.mask.pixels.length !== COURSE_INPUT.width * COURSE_INPUT.height
      )
        throw new Error('预测掩码必须对应 1024×1024 原图。');
    }
  }
}
