import type { DemoItem, Instance, RenderOptions } from '../domain/types';
export const COLORS = ['#26c9c0', '#ffbe57', '#ac91ff', '#ff7c9a', '#72c8ff', '#a5d77c', '#ff985f'];
export function visibleInstances(instances: Instance[], threshold: number) {
  return instances.filter(
    (instance) => instance.score === undefined || instance.score >= threshold,
  );
}
type MaskTile = { canvas: HTMLCanvasElement; x: number; y: number };
const cache = new WeakMap<Instance, Map<string, MaskTile>>();
function coloredMask(instance: Instance, override?: string): MaskTile {
  const key = override ?? 'instance';
  const cached = cache.get(instance)?.get(key);
  if (cached) return cached;
  const { width, height, pixels } = instance.mask;
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let i = 0; i < pixels.length; i++) {
    if (!pixels[i]) continue;
    const x = i % width,
      y = Math.floor(i / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  // Cache only the instance bounds, rather than an RGBA image of the full scene.
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, right - left + 1);
  canvas.height = Math.max(1, bottom - top + 1);
  const ctx = canvas.getContext('2d')!;
  const rgba = ctx.createImageData(canvas.width, canvas.height);
  // Derive colors from stable instance identity, not the filtered list position.
  const hash = [...instance.id].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
  const color = override ?? COLORS[hash % COLORS.length];
  const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (!pixels[y * width + x]) continue;
      const i = ((y - top) * canvas.width + x - left) * 4;
      rgba.data[i] = rgb[0];
      rgba.data[i + 1] = rgb[1];
      rgba.data[i + 2] = rgb[2];
      rgba.data[i + 3] = 255;
    }
  }
  ctx.putImageData(rgba, 0, 0);
  const tile = { canvas, x: right < 0 ? 0 : left, y: bottom < 0 ? 0 : top };
  if (!cache.has(instance)) cache.set(instance, new Map());
  cache.get(instance)!.set(key, tile);
  return tile;
}
export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  input: DemoItem,
  instances: Instance[],
  options: RenderOptions,
) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#182126';
  ctx.fillRect(0, 0, width, height);
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  const size = Math.min(width, height);
  ctx.translate(
    (width - size) / 2 + options.view.x * size,
    (height - size) / 2 + options.view.y * size,
  );
  ctx.translate(size / 2, size / 2);
  ctx.scale(options.view.zoom, options.view.zoom);
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(input.rgbPreview, 0, 0, size, size);
  if (options.showMasks) {
    ctx.globalAlpha = options.opacity;
    visibleInstances(instances, options.threshold).forEach((instance) => {
      const tile = coloredMask(instance, options.colors?.[instance.id]);
      ctx.drawImage(
        tile.canvas,
        (tile.x / instance.mask.width) * size,
        (tile.y / instance.mask.height) * size,
        (tile.canvas.width / instance.mask.width) * size,
        (tile.canvas.height / instance.mask.height) * size,
      );
    });
    ctx.globalAlpha = 1;
    for (const instance of options.missed ?? []) {
      const { pixels, width: mw, height: mh } = instance.mask;
      ctx.fillStyle = '#f7b32b';
      for (let i = 0; i < pixels.length; i++) {
        if (!pixels[i]) continue;
        const x = i % mw,
          y = Math.floor(i / mw);
        if (
          x > 0 &&
          x < mw - 1 &&
          y > 0 &&
          y < mh - 1 &&
          pixels[i - 1] &&
          pixels[i + 1] &&
          pixels[i - mw] &&
          pixels[i + mw]
        )
          continue;
        if ((x + y) % 8 < 5)
          ctx.fillRect(
            (x / mw) * size,
            (y / mh) * size,
            Math.max(1, size / mw),
            Math.max(1, size / mh),
          );
      }
    }
  }
  ctx.restore();
}
export function zoomView(view: RenderOptions['view'], factor: number) {
  return { ...view, zoom: Math.max(1, Math.min(8, view.zoom * factor)) };
}
