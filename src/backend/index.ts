import type { DemoBackend } from '../domain/types';
import { MockBackendAdapter } from './mock';
// Implementation selection belongs only to this composition root.
// Replace the construction below with the real backend adapter when available.
export function createBackend(): DemoBackend {
  return new MockBackendAdapter();
}
