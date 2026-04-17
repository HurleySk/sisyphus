import type { Criterion } from '../src/types.js';

/**
 * Build a Criterion with sensible defaults and overrides.
 * Each test passes its own `check` value via overrides.
 */
export function criterion(overrides: Partial<Criterion> = {}): Criterion {
  return { check: 'test-check', description: 'test', ...overrides };
}
