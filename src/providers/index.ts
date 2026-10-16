import type { InferenceAdapter } from '../domain/types';
import { MockAdapter } from './mock';
// HTTP transport is implemented here later, without changing input or page flows.
export function createAdapter(): InferenceAdapter {
  const mode = import.meta.env.VITE_DEMO_PROVIDER ?? 'mock';
  if (mode !== 'mock') throw new Error(`尚未实现推理适配器：${mode}。`);
  return new MockAdapter(import.meta.env.VITE_MOCK_FAIL_ONCE === 'true');
}
