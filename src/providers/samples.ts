import type { SampleRepository, SampleSummary } from '../domain/types';
import { prepareInput } from '../input/prepare';
import { decodeGroundTruth, readJson, type FixtureInstance } from './resources';
type SampleManifest = { rgbUrl: string; rawDepthUrl: string; gt: FixtureInstance[] };
async function readBlob(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('样例文件缺失，请重新运行样例准备脚本。');
  return response.blob();
}
export class StaticSampleRepository implements SampleRepository {
  listSamples(signal?: AbortSignal) {
    return readJson<SampleSummary[]>('/demo-data/index.json', signal);
  }
  async loadSample(id: string, signal?: AbortSignal) {
    const data = await readJson<SampleManifest>(
      `/demo-data/${encodeURIComponent(id)}/sample.json`,
      signal,
    );
    if (!data.rawDepthUrl) throw new Error('样例缺少原始深度，请重新运行样例准备脚本。');
    const [rgb, depth] = await Promise.all([
      readBlob(data.rgbUrl, signal),
      readBlob(data.rawDepthUrl, signal),
    ]);
    const [item, gt] = await Promise.all([
      prepareInput({ id, rgb, depth }, signal),
      decodeGroundTruth(data.gt, signal),
    ]);
    return { ...item, gt };
  }
}
