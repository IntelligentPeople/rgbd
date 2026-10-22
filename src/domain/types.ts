export type Mask = { width: number; height: number; pixels: Uint8Array };
export type GroundTruthInstance = { id: string; categoryId: number; mask: Mask; score?: never };
export type PredictionInstance = { id: string; categoryId: number; mask: Mask; score: number };
export type Instance = GroundTruthInstance | PredictionInstance;
export type SampleSummary = {
  id: string;
  title: string;
  description: string;
  rgbUrl: string;
  density: string;
  instanceCount: number;
  smallCount: number;
};
// All sources submit the same original PNG payload. GT and previews never enter inference.
export type InferenceInput = {
  id: string;
  rgb: Blob;
  depth: Blob;
};
export type DemoItem = {
  input: InferenceInput;
  rgbPreview: HTMLImageElement;
  depthPreview: HTMLImageElement;
  gt?: GroundTruthInstance[];
};
export type ModelResult = {
  role: 'baseline' | 'improved';
  name: string;
  version: string;
  elapsedMs: number;
} & ({ status: 'success'; instances: PredictionInstance[] } | { status: 'error'; message: string });
export type Comparison = { inputId: string; models: [ModelResult, ModelResult] };
export interface SampleRepository {
  listSamples(signal?: AbortSignal): Promise<SampleSummary[]>;
  loadSample(id: string, signal?: AbortSignal): Promise<DemoItem>;
}
export interface DemoBackend {
  compare(input: InferenceInput, signal?: AbortSignal): Promise<Comparison>;
}
export type InputFiles = { rgb?: Blob; depth?: Blob };
export type InputRole = keyof InputFiles;
export type ViewTransform = { zoom: number; x: number; y: number };
export type RenderOptions = {
  view: ViewTransform;
  opacity: number;
  threshold: number;
  showMasks: boolean;
  colors?: Record<string, string>;
  missed?: GroundTruthInstance[];
};
