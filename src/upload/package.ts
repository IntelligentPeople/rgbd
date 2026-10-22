import { unzipSync } from 'fflate';
import { decode } from 'fast-png';
import { COURSE_INPUT } from '../domain/inputSpec';
import type { GroundTruthInstance } from '../domain/types';
import { prepareInput } from '../input/prepare';

export function unpackPackage(bytes: Uint8Array) {
  let total = 0;
  const entries = unzipSync(bytes, { filter(entry) {
    total += entry.originalSize;
    if (entry.originalSize > COURSE_INPUT.maxFileBytes || total > 90 * 1024 * 1024)
      throw new Error('数据包解压后过大，每个文件限 30 MB，总计限 90 MB。');
    return true;
  }});
  const names = Object.keys(entries).filter((name) => !name.endsWith('/'));
  if (names.some((name) => !['rgb.png', 'depth.png', 'gt.png'].includes(name)))
    throw new Error('ZIP 根目录只允许 rgb.png、depth.png 和可选的 gt.png，请勿嵌套文件夹。');
  if (!entries['rgb.png'] || !entries['depth.png'])
    throw new Error('数据包缺少 rgb.png 或 depth.png。');
  return entries;
}

export function decodeGT(bytes: Uint8Array): GroundTruthInstance[] {
  const image = decode(bytes, { checkCrc: true });
  if (image.width !== COURSE_INPUT.width || image.height !== COURSE_INPUT.height ||
      image.channels !== 1 || ![8, 16].includes(image.depth))
    throw new Error('GT 应为 1024×1024、8 或 16 位单通道实例 ID PNG，背景为 0。');
  const ids = new Set<number>();
  for (const id of image.data) if (id) ids.add(id);
  if (ids.size > 500) throw new Error('GT 实例超过 500 个，请确认上传的是实例 ID 图，而非深度图。');
  const instances = [...ids].sort((a,b) => a-b).map((id) => ({
    id: String(id), categoryId: 1,
    mask: { width: image.width, height: image.height, pixels: new Uint8Array(image.width * image.height) },
  }));
  const byId = new Map(instances.map((instance) => [Number(instance.id), instance]));
  for (let i=0; i<image.data.length; i++) {
    const instance = byId.get(image.data[i]);
    if (instance) instance.mask.pixels[i] = 1;
  }
  return instances;
}

export async function preparePackage(file: File, signal?: AbortSignal) {
  if (file.size > 90 * 1024 * 1024) throw new Error('ZIP 数据包不能超过 90 MB。');
  signal?.throwIfAborted();
  let entries: Record<string, Uint8Array>;
  try { entries = unpackPackage(new Uint8Array(await file.arrayBuffer())); }
  catch (error) { throw new Error(error instanceof Error ? error.message : 'ZIP 无法解压。'); }
  signal?.throwIfAborted();
  const rgb = new File([new Uint8Array(entries['rgb.png'])], 'rgb.png', { type: 'image/png' });
  const depth = new File([new Uint8Array(entries['depth.png'])], 'depth.png', { type: 'image/png' });
  const gt = entries['gt.png'] ? decodeGT(entries['gt.png']) : undefined;
  const item = await prepareInput({ id: crypto.randomUUID(), rgb, depth }, signal);
  return { ...item, gt };
}
