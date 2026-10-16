import type { DemoItem, InferenceInput } from '../domain/types';
import { COURSE_INPUT } from '../domain/inputSpec';
import { validateUpload } from '../upload/validate';
import { loadImage } from '../providers/resources';
import { colorizeDepth, decodeDepth } from './depth';
function dataUrl(blob: Blob, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const reader = new FileReader();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      reader.abort();
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    reader.onload = () => {
      cleanup();
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      cleanup();
      reject(new Error('输入文件读取失败。'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    reader.readAsDataURL(blob);
  });
}
export async function prepareInput(input: InferenceInput, signal?: AbortSignal): Promise<DemoItem> {
  signal?.throwIfAborted();
  await Promise.all([validateUpload(input.rgb, 'rgb'), validateUpload(input.depth, 'depth')]);
  signal?.throwIfAborted();
  const values = decodeDepth(new Uint8Array(await input.depth.arrayBuffer()));
  const rgba = colorizeDepth(values);
  const canvas = document.createElement('canvas');
  canvas.width = COURSE_INPUT.width;
  canvas.height = COURSE_INPUT.height;
  canvas.getContext('2d')!.putImageData(new ImageData(rgba, canvas.width, canvas.height), 0, 0);
  const [rgbPreview, depthPreview] = await Promise.all([
    loadImage(await dataUrl(input.rgb, signal), signal),
    loadImage(canvas.toDataURL('image/png'), signal),
  ]);
  signal?.throwIfAborted();
  return { input, rgbPreview, depthPreview };
}
