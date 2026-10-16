import type {
  Comparison,
  InferenceInput,
  InferenceAdapter,
  PredictionInstance,
} from '../domain/types';
import { fingerprint } from '../input/fingerprint';
import { decodePredictions, readJson, type FixtureInstance } from './resources';
export type FixtureEntry = { rgbHash: string; depthHash: string; resultUrl: string };
type Fixture = { baseline: FixtureInstance[]; improved: FixtureInstance[] };
type FixtureStore = {
  list(signal?: AbortSignal): Promise<FixtureEntry[]>;
  load(url: string, signal?: AbortSignal): Promise<Fixture>;
  decode(items: FixtureInstance[], signal?: AbortSignal): Promise<PredictionInstance[]>;
};
const staticStore: FixtureStore = {
  list: (signal) => readJson('/demo-data/mock-index.json', signal),
  load: (url, signal) => readJson(url, signal),
  decode: decodePredictions,
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
export class MockAdapter implements InferenceAdapter {
  readonly info = {
    source: 'mock' as const,
    label: '模拟演示',
    description: '预测由固定测试数据提供，不代表模型性能；耗时为模拟值。',
  };
  private failNext: boolean;
  constructor(
    failOnce = false,
    private store: FixtureStore = staticStore,
  ) {
    this.failNext = failOnce;
  }
  async compare(input: InferenceInput, signal?: AbortSignal): Promise<Comparison> {
    await delay(700, signal);
    if (this.failNext) {
      this.failNext = false;
      throw new Error('模拟请求失败，请重试。');
    }
    const [hashes, entries] = await Promise.all([
      fingerprint(input, signal),
      this.store.list(signal),
    ]);
    signal?.throwIfAborted();
    const entry = entries.find(
      (item) => item.rgbHash === hashes.rgbHash && item.depthHash === hashes.depthHash,
    );
    if (!entry)
      throw new Error('当前开发适配器没有该输入的测试结果，请使用内置样例或上传同一组原始文件。');
    const fixture = await this.store.load(entry.resultUrl, signal);
    const [baseline, improved] = await Promise.all([
      this.store.decode(fixture.baseline, signal),
      this.store.decode(fixture.improved, signal),
    ]);
    signal?.throwIfAborted();
    return {
      inputId: input.id,
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
