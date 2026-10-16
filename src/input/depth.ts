import { decode } from 'fast-png';
import { COURSE_INPUT } from '../domain/inputSpec';
import { inspectPng } from '../upload/validate';
export function decodeDepth(bytes: Uint8Array) {
  inspectPng(bytes, 'depth');
  const image = decode(bytes, { checkCrc: true });
  if (!(image.data instanceof Uint16Array) || image.channels !== 1)
    throw new Error('深度解码失败：需要 16 位单通道 PNG。');
  return image.data;
}
export function colorizeDepth(values: Uint16Array) {
  let min = Infinity,
    max = -Infinity;
  for (const value of values)
    if (value !== COURSE_INPUT.depthInvalidCode) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  if (!Number.isFinite(min)) throw new Error('深度图没有有效像素，请更换原始深度图。');
  const rgba = new Uint8ClampedArray(values.length * 4);
  const stops = [
    [25, 44, 110],
    [25, 177, 182],
    [245, 215, 98],
  ];
  for (let i = 0; i < values.length; i++) {
    rgba[i * 4 + 3] = 255;
    if (values[i] === COURSE_INPUT.depthInvalidCode) continue;
    const t = ((values[i] - min) / Math.max(1, max - min)) * 2;
    const segment = Math.min(1, Math.floor(t));
    const fraction = t - segment;
    for (let c = 0; c < 3; c++)
      rgba[i * 4 + c] = Math.floor(
        stops[segment][c] * (1 - fraction) + stops[segment + 1][c] * fraction,
      );
  }
  return rgba;
}
