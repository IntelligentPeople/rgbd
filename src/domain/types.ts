export type Mask = { width: number; height: number; pixels: Uint8Array };
export type Instance = { id: string; categoryId: number; mask: Mask; score?: number };
export type SampleSummary = {
  id: string;
  title: string;
  description: string;
  rgbUrl: string;
  density: string;
  instanceCount: number;
  smallCount: number;
};
export type DemoInput = {
  id: string;
  width: number;
  height: number;
  rgb: HTMLImageElement;
  depthPreview?: HTMLImageElement;
  depthScaleM: number;
  depthInvalidCode: number;
  gt?: Instance[];
};
export type ComparisonInput =
  { kind: 'sample'; sampleId: string } | { kind: 'upload'; rgb: File; depth: File };
export type ModelResult = {
  role: 'baseline' | 'improved';
  name: string;
  version: string;
  source: 'mock' | 'cached' | 'live';
  elapsedMs: number;
} & ({ status: 'success'; instances: Instance[] } | { status: 'error'; message: string });
export type Comparison = { inputId: string; models: ModelResult[] };
export interface DemoProvider {
  getCapabilities(): { mode: 'mock' | 'http'; uploadInference: boolean };
  listSamples(signal?: AbortSignal): Promise<SampleSummary[]>;
  loadSample(id: string, signal?: AbortSignal): Promise<DemoInput>;
  compare(input: ComparisonInput, signal?: AbortSignal): Promise<Comparison>;
}
export type ViewTransform = { zoom: number; x: number; y: number };
export type RenderOptions = {
  view: ViewTransform;
  opacity: number;
  threshold: number;
  showMasks: boolean;
};
