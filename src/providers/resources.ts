import type { Instance, Mask } from '../domain/types';
export type FixtureInstance = { id: string; categoryId: number; score?: number; maskUrl: string };
export async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('样例资源未就绪，请先按 README 生成 demo-data。');
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error('样例索引无法读取，请重新运行样例准备脚本。');
  }
}
export function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const image = new Image();
    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
      image.onload = null;
      image.onerror = null;
    };
    const abort = () => {
      cleanup();
      image.src = '';
      reject(new DOMException('Aborted', 'AbortError'));
    };
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('图像资源加载失败。'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    image.src = url;
  });
}
export async function decodeMask(url: string, signal?: AbortSignal): Promise<Mask> {
  const image = await loadImage(url, signal);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < pixels.length; i++) pixels[i] = rgba[i * 4] > 127 ? 1 : 0;
  return { width: canvas.width, height: canvas.height, pixels };
}
export async function decodeInstances(
  items: FixtureInstance[],
  signal?: AbortSignal,
): Promise<Instance[]> {
  // Limit concurrent decodes and canvas allocations for dense scenes.
  const output: Instance[] = [];
  for (let i = 0; i < items.length; i += 6) {
    output.push(
      ...(await Promise.all(
        items
          .slice(i, i + 6)
          .map(async (item) => ({ ...item, mask: await decodeMask(item.maskUrl, signal) })),
      )),
    );
  }
  return output;
}
