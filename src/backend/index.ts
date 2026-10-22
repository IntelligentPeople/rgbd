import type { DemoBackend } from '../domain/types';
import { HttpBackendAdapter } from './http';

// The browser always uses the same HTTP contract. The inference host owns the
// choice of its internal implementation.
export function createBackend(): DemoBackend {
  return new HttpBackendAdapter();
}
