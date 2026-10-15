import type { DemoInput, Instance, RenderOptions } from '../domain/types';
export const COLORS = ['#26c9c0', '#ffbe57', '#ac91ff', '#ff7c9a', '#72c8ff', '#a5d77c', '#ff985f'];
export function visibleInstances(instances: Instance[], threshold: number) {
  return instances.filter(instance => instance.score === undefined || instance.score >= threshold);
}
const cache = new WeakMap<Instance, HTMLCanvasElement>();
function coloredMask(instance: Instance, index: number) {
  let canvas = cache.get(instance);
  if (canvas) return canvas;
  canvas = document.createElement('canvas'); canvas.width = instance.mask.width; canvas.height = instance.mask.height;
  const ctx = canvas.getContext('2d')!;
  const rgba = ctx.createImageData(canvas.width, canvas.height);
  // Derive colors from stable instance identity, not the filtered list position.
  const hash = [...instance.id].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, index * 0);
  const color = COLORS[hash % COLORS.length];
  const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  for (let i = 0; i < instance.mask.pixels.length; i++) {
    if (!instance.mask.pixels[i]) continue;
    rgba.data[i * 4] = rgb[0]; rgba.data[i * 4 + 1] = rgb[1]; rgba.data[i * 4 + 2] = rgb[2]; rgba.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(rgba, 0, 0); cache.set(instance, canvas); return canvas;
}
export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, input: DemoInput, instances: Instance[], options: RenderOptions) {
  ctx.save(); ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#182126'; ctx.fillRect(0, 0, width, height);
  ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
  const size = Math.min(width, height);
  ctx.translate((width - size) / 2 + options.view.x * size, (height - size) / 2 + options.view.y * size);
  ctx.translate(size / 2, size / 2); ctx.scale(options.view.zoom, options.view.zoom); ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(input.rgb, 0, 0, size, size);
  if (options.showMasks) {
    ctx.globalAlpha = options.opacity;
    visibleInstances(instances, options.threshold).forEach((instance, index) => ctx.drawImage(coloredMask(instance, index), 0, 0, size, size));
  }
  ctx.restore();
}
export function zoomView(view: RenderOptions['view'], factor: number) {
  return { ...view, zoom: Math.max(1, Math.min(8, view.zoom * factor)) };
}
