import type { InferenceInput } from '../domain/types';
export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}
export async function fingerprint(
  input: Pick<InferenceInput, 'rgb' | 'depth'>,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const [rgbHash, depthHash] = await Promise.all([sha256(input.rgb), sha256(input.depth)]);
  signal?.throwIfAborted();
  return { rgbHash, depthHash };
}
