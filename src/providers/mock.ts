import type {
  Comparison,
  ComparisonInput,
  DemoInput,
  DemoProvider,
  SampleSummary,
} from '../domain/types';
import { decodeInstances, loadImage, readJson, type FixtureInstance } from './resources';
type Fixture = {
  width: number;
  height: number;
  rgbUrl: string;
  depthUrl: string;
  depthScaleM: number;
  depthInvalidCode: number;
  gt: FixtureInstance[];
  baseline: FixtureInstance[];
  improved: FixtureInstance[];
};
function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export class MockProvider implements DemoProvider {
  private failNext: boolean;
  constructor(failOnce = false) {
    this.failNext = failOnce;
  }
  getCapabilities() {
    return { mode: 'mock' as const, uploadInference: false };
  }
  listSamples(signal?: AbortSignal) {
    return readJson<SampleSummary[]>('/demo-data/index.json', signal);
  }
  private fixture(id: string, signal?: AbortSignal) {
    return readJson<Fixture>(`/demo-data/${encodeURIComponent(id)}/sample.json`, signal);
  }
  async loadSample(id: string, signal?: AbortSignal): Promise<DemoInput> {
    const data = await this.fixture(id, signal);
    const [rgb, depthPreview, gt] = await Promise.all([
      loadImage(data.rgbUrl, signal),
      loadImage(data.depthUrl, signal),
      decodeInstances(data.gt, signal),
    ]);
    return {
      id,
      width: data.width,
      height: data.height,
      rgb,
      depthPreview,
      gt,
      depthScaleM: data.depthScaleM,
      depthInvalidCode: data.depthInvalidCode,
    };
  }
  async compare(input: ComparisonInput, signal?: AbortSignal): Promise<Comparison> {
    if (input.kind !== 'sample') throw new Error('Mock 模式尚未接入上传推理。');
    await delay(700, signal);
    if (this.failNext) {
      this.failNext = false;
      throw new Error('模拟请求失败，请重试。');
    }
    const fixture = await this.fixture(input.sampleId, signal);
    const [baseline, improved] = await Promise.all([
      decodeInstances(fixture.baseline, signal),
      decodeInstances(fixture.improved, signal),
    ]);
    return {
      inputId: input.sampleId,
      models: [
        {
          role: 'baseline',
          name: '基线模型',
          version: 'fixture-v1',
          source: 'mock',
          status: 'success',
          elapsedMs: 420,
          instances: baseline,
        },
        {
          role: 'improved',
          name: '改进模型',
          version: 'fixture-v1',
          source: 'mock',
          status: 'success',
          elapsedMs: 510,
          instances: improved,
        },
      ],
    };
  }
}
