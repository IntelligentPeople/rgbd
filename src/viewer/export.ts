import type { DemoItem, Instance, RenderOptions } from '../domain/types';
import { drawScene } from './render';
export async function exportComparison(
  input: DemoItem,
  panels: { title: string; subtitle: string; instances: Instance[]; options?: RenderOptions }[],
  options: RenderOptions,
) {
  const size = 768;
  const header = 100;
  const footer = 60;
  const canvas = document.createElement('canvas');
  canvas.width = size * panels.length;
  canvas.height = size + header + footer;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f6f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  panels.forEach((panel, i) => {
    ctx.fillStyle = '#172e32';
    ctx.font = 'bold 25px sans-serif';
    ctx.fillText(panel.title, i * size + 24, 38);
    ctx.font = '18px sans-serif';
    ctx.fillText(panel.subtitle, i * size + 24, 72);
    ctx.save();
    ctx.translate(i * size, header);
    drawScene(ctx, size, size, input, panel.instances, panel.options ?? options);
    ctx.restore();
  });
  ctx.fillStyle = '#34565a';
  ctx.font = '18px sans-serif';
  ctx.fillText(
    `RGB-D / ${input.input.id} · 显示置信度 ≥ ${options.threshold.toFixed(2)} · ${panels.some((p) => p.options?.colors) ? '绿色：匹配 / 红色：误检 / 黄色虚线：漏检' : '颜色仅区分实例'} · 放大 ${options.view.zoom.toFixed(1)}×`,
    24,
    canvas.height - 24,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('图片导出失败'))),
      'image/png',
    ),
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `rgbd-${input.input.id}-comparison.png`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
