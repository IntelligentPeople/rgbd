import type { Comparison, DemoBackend, InferenceInput, PredictionInstance } from '../domain/types';

type WireMask = { size: [number, number]; counts: string };
type WireInstance = { category_id: number; score: number; segmentation: WireMask };
type WireModel =
  | { role: 'baseline' | 'improved'; name: string; version: string; elapsed_ms: number; status: 'success'; predictions: WireInstance[] }
  | { role: 'baseline' | 'improved'; name: string; version: string; elapsed_ms: number; status: 'error'; message: string };
type WireComparison = { input_id: string; models: [WireModel, WireModel] };

function decodeCompressedCounts(encoded: string, pixelCount: number): number[] {
  const runs: number[] = [];
  let offset = 0;
  let sum = 0;
  while (offset < encoded.length) {
    let value = 0n;
    let shift = 0n;
    let more = true;
    let last = 0;
    while (more) {
      if (offset >= encoded.length || shift > 60n) throw new Error('掩码编码无效。');
      last = encoded.charCodeAt(offset++) - 48;
      if (last < 0 || last > 63) throw new Error('掩码编码无效。');
      value |= BigInt(last & 0x1f) << shift;
      more = (last & 0x20) !== 0;
      shift += 5n;
    }
    if ((last & 0x10) !== 0) value |= (-1n) << shift;
    if (runs.length > 2) value += BigInt(runs[runs.length - 2]);
    if (value < 0n || value > BigInt(pixelCount)) throw new Error('掩码尺寸无效。');
    const run = Number(value);
    sum += run;
    if (sum > pixelCount) throw new Error('掩码尺寸无效。');
    runs.push(run);
  }
  if (sum !== pixelCount || runs.length === 0) throw new Error('掩码尺寸无效。');
  return runs;
}

function decodeInstance(instance: WireInstance, index: number): PredictionInstance {
  const [height, width] = instance.segmentation.size;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
      !Number.isFinite(instance.score) || instance.score < 0 || instance.score > 1 ||
      !Number.isInteger(instance.category_id)) throw new Error('推理服务返回了无效结果。');
  const runs = decodeCompressedCounts(instance.segmentation.counts, width * height);
  const pixels = new Uint8Array(width * height);
  let position = 0;
  let foreground = false;
  for (const run of runs) {
    if (foreground) {
      const end = position + run;
      for (let columnMajor = position; columnMajor < end; columnMajor++) {
        const y = columnMajor % height;
        const x = Math.floor(columnMajor / height);
        pixels[y * width + x] = 1;
      }
    }
    position += run;
    foreground = !foreground;
  }
  return {
    id: `${instance.category_id}-${index + 1}`,
    categoryId: instance.category_id,
    score: instance.score,
    mask: { width, height, pixels },
  };
}

function fromWire(input: InferenceInput, response: WireComparison): Comparison {
  if (response.input_id !== input.id || !Array.isArray(response.models) || response.models.length !== 2)
    throw new Error('推理结果与当前输入不匹配。');
  return {
    inputId: response.input_id,
    models: response.models.map((model) => {
      const common = {
        role: model.role,
        name: model.name,
        version: model.version,
        elapsedMs: model.elapsed_ms,
      };
      if (model.status === 'error') return { ...common, status: 'error' as const, message: model.message };
      return {
        ...common,
        status: 'success' as const,
        instances: model.predictions.map(decodeInstance),
      };
    }) as Comparison['models'],
  };
}

function apiBaseUrl() {
  const configured = import.meta.env.VITE_DEMO_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

export class HttpBackendAdapter implements DemoBackend {
  constructor(private readonly baseUrl = apiBaseUrl()) {}

  async compare(input: InferenceInput, signal?: AbortSignal): Promise<Comparison> {
    const form = new FormData();
    form.append('input_id', input.id);
    form.append('rgb', input.rgb, 'rgb.png');
    form.append('depth', input.depth, 'depth.png');
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/compare`, { method: 'POST', body: form, signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new Error('无法连接推理服务，请检查服务是否启动及网络连接。');
    }
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message || '处理失败，请检查输入后重试。');
    try {
      return fromWire(input, body as WireComparison);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('推理服务返回了无效结果。');
    }
  }
}
