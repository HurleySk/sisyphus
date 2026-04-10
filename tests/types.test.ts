import { describe, it, expect } from 'vitest';
import { isStackSource, isCriterion, isBoulder, isSpec } from '../src/types.js';

describe('type guards', () => {
  describe('isStackSource', () => {
    it('accepts valid analysis source', () => {
      expect(isStackSource({ type: 'analysis', source: 'foo.json', instruction: 'extract' })).toBe(true);
    });
    it('rejects missing type', () => {
      expect(isStackSource({ source: 'foo.json' })).toBe(false);
    });
    it('rejects non-object', () => {
      expect(isStackSource('not an object')).toBe(false);
      expect(isStackSource(null)).toBe(false);
    });
  });

  describe('isCriterion', () => {
    it('accepts valid structural criterion', () => {
      expect(isCriterion({ check: 'contains-table', description: 'has a table' })).toBe(true);
    });
    it('accepts criterion with extra params', () => {
      expect(isCriterion({ check: 'row-count-gte', description: 'enough rows', min: 5 })).toBe(true);
    });
    it('rejects missing check', () => {
      expect(isCriterion({ description: 'no check field' })).toBe(false);
    });
  });

  describe('isBoulder', () => {
    it('accepts valid boulder', () => {
      const boulder = {
        name: 'Test',
        description: 'A test boulder',
        stack: [{ type: 'analysis', source: 'f.json', instruction: 'read' }],
        criteria: [{ check: 'custom', description: 'looks good' }],
      };
      expect(isBoulder(boulder)).toBe(true);
    });
    it('accepts boulder with no stack', () => {
      const boulder = {
        name: 'Test',
        description: 'No data needed',
        criteria: [{ check: 'custom', description: 'looks good' }],
      };
      expect(isBoulder(boulder)).toBe(true);
    });
    it('rejects boulder with empty criteria', () => {
      expect(isBoulder({ name: 'Test', description: 'x', criteria: [] })).toBe(false);
    });
  });

  describe('isSpec', () => {
    it('accepts minimal valid spec', () => {
      const spec = {
        title: 'Test',
        layer: 'documentation',
        output: 'out.md',
        boulders: [{
          name: 'B1',
          description: 'first',
          criteria: [{ check: 'custom', description: 'ok' }],
        }],
      };
      expect(isSpec(spec)).toBe(true);
    });
    it('rejects spec with no boulders', () => {
      expect(isSpec({ title: 'T', layer: 'docs', output: 'o', boulders: [] })).toBe(false);
    });
    it('rejects spec missing layer', () => {
      expect(isSpec({ title: 'T', output: 'o', boulders: [{ name: 'B', description: 'd', criteria: [{ check: 'c', description: 'd' }] }] })).toBe(false);
    });
  });
});
