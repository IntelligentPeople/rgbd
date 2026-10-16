import { COURSE_INPUT } from '../domain/inputSpec';
export function inspectPng(bytes: Uint8Array, role: 'rgb' | 'depth') {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 33 ||
    signature.some((value, i) => bytes[i] !== value) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR'
  )
    throw new Error('请选择有效的 PNG 文件。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width !== COURSE_INPUT.width || height !== COURSE_INPUT.height)
    throw new Error('课程输入尺寸应为 1024×1024。');
  if (role === 'rgb' && (bytes[24] !== COURSE_INPUT.rgbBitDepth || bytes[25] !== 2))
    throw new Error('RGB 应为 8 位三通道 PNG。');
  if (role === 'depth' && (bytes[24] !== COURSE_INPUT.depthBitDepth || bytes[25] !== 0))
    throw new Error('深度应为 16 位单通道 PNG，请保留原始精度。');
  return { width, height };
}
export async function validateUpload(file: Blob, role: 'rgb' | 'depth') {
  if (file.size > COURSE_INPUT.maxFileBytes) throw new Error('单个文件不能超过 30 MB。');
  inspectPng(new Uint8Array(await file.slice(0, 33).arrayBuffer()), role);
  const image = await createImageBitmap(file).catch(() => {
    throw new Error('图片损坏或浏览器无法解码。');
  });
  image.close();
}
