import type { DemoProvider } from '../domain/types';
import { MockProvider } from './mock';
// Future HttpProvider implements DemoProvider and normalizes API masks here.
// No transport protocol or endpoint is imposed on the inference team.
export function createProvider(): DemoProvider {
  const mode = import.meta.env.VITE_DEMO_PROVIDER ?? 'mock';
  if (mode !== 'mock') throw new Error(`尚未实现 Provider：${mode}。请使用 mock。`);
  return new MockProvider(import.meta.env.VITE_MOCK_FAIL_ONCE === 'true');
}
