import { describe, it, expect } from 'vitest';
import { loadSpec, validateSpec } from '../src/spec.js';
import path from 'path';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

describe('loadSpec', () => {
  it('loads and validates a valid spec file', async () => {
    const spec = await loadSpec(path.join(fixturesDir, 'valid-spec.json'));
    expect(spec.title).toBe('Test Spec');
    expect(spec.layer).toBe('documentation');
    expect(spec.boulders).toHaveLength(2);
    expect(spec.boulders[0].name).toBe('Introduction');
    expect(spec.maxRetries).toBe(2);
  });

  it('throws on non-existent file', async () => {
    await expect(loadSpec('nonexistent.json')).rejects.toThrow();
  });

  it('throws on invalid JSON content', async () => {
    await expect(loadSpec(path.join(fixturesDir, 'invalid-json.txt'))).rejects.toThrow('Invalid JSON');
  });

  it('throws on spec missing the layer field', async () => {
    await expect(loadSpec(path.join(fixturesDir, 'invalid-spec-no-layer.json'))).rejects.toThrow('Spec validation failed');
  });
});

describe('validateSpec', () => {
  it('returns valid for a correct spec', () => {
    const result = validateSpec({
      title: 'T', layer: 'docs', output: 'o.md',
      boulders: [{ name: 'B', description: 'd', criteria: [{ check: 'c', description: 'd' }] }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for missing layer field', () => {
    const result = validateSpec({
      title: 'T', output: 'o.md',
      boulders: [{ name: 'B', description: 'd', criteria: [{ check: 'c', description: 'd' }] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns errors for empty boulders array', () => {
    const result = validateSpec({ title: 'T', layer: 'docs', output: 'o.md', boulders: [] });
    expect(result.valid).toBe(false);
  });

  it('returns errors for boulder missing criteria', () => {
    const result = validateSpec({
      title: 'T', layer: 'docs', output: 'o.md',
      boulders: [{ name: 'B', description: 'd' }],
    });
    expect(result.valid).toBe(false);
  });

  it('preserves explicit maxRetries value', async () => {
    const spec = await loadSpec(path.join(fixturesDir, 'valid-spec.json'));
    expect(spec.maxRetries).toBe(2);
  });
});
