import { describe, it, expect } from 'vitest';
import { CheckRegistry } from '../src/checks.js';
import type { CheckFn, Criterion } from '../src/types.js';

function makeCriterion(overrides: Partial<Criterion> = {}): Criterion {
  return { check: 'test-check', description: 'A test criterion', ...overrides };
}

const passingCheck: CheckFn = (_markdown, criterion) => ({
  criterion: criterion.description,
  pass: true,
  message: 'Looks good',
});

const failingCheck: CheckFn = (_markdown, criterion) => ({
  criterion: criterion.description,
  pass: false,
  message: 'Did not pass',
});

describe('CheckRegistry', () => {
  describe('register / has / get', () => {
    it('registers and retrieves a check by name', () => {
      const registry = new CheckRegistry();
      registry.register('my-check', passingCheck);
      expect(registry.has('my-check')).toBe(true);
      expect(registry.get('my-check')).toBe(passingCheck);
    });

    it('returns undefined for an unregistered check', () => {
      const registry = new CheckRegistry();
      expect(registry.has('unknown')).toBe(false);
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('overwrites an existing check when the same name is registered again', () => {
      const registry = new CheckRegistry();
      registry.register('my-check', passingCheck);
      registry.register('my-check', failingCheck);
      expect(registry.get('my-check')).toBe(failingCheck);
    });
  });

  describe('registerAll', () => {
    it('registers multiple checks from a Map', () => {
      const registry = new CheckRegistry();
      const checks = new Map<string, CheckFn>([
        ['check-a', passingCheck],
        ['check-b', failingCheck],
      ]);
      registry.registerAll(checks);
      expect(registry.has('check-a')).toBe(true);
      expect(registry.has('check-b')).toBe(true);
      expect(registry.get('check-a')).toBe(passingCheck);
      expect(registry.get('check-b')).toBe(failingCheck);
    });

    it('merges with existing checks without removing them', () => {
      const registry = new CheckRegistry();
      registry.register('pre-existing', passingCheck);
      registry.registerAll(new Map([['new-check', failingCheck]]));
      expect(registry.has('pre-existing')).toBe(true);
      expect(registry.has('new-check')).toBe(true);
    });
  });

  describe('runChecks', () => {
    it('runs structural checks and collects results', () => {
      const registry = new CheckRegistry();
      registry.register('passes', passingCheck);
      registry.register('fails', failingCheck);

      const criteria: Criterion[] = [
        makeCriterion({ check: 'passes', description: 'Should pass' }),
        makeCriterion({ check: 'fails', description: 'Should fail' }),
      ];

      const results = registry.runChecks('# Some markdown', criteria);

      expect(results).toHaveLength(2);
      expect(results[0].pass).toBe(true);
      expect(results[0].criterion).toBe('Should pass');
      expect(results[1].pass).toBe(false);
      expect(results[1].criterion).toBe('Should fail');
    });

    it('skips custom criteria (Hades handles these)', () => {
      const registry = new CheckRegistry();

      const criteria: Criterion[] = [
        makeCriterion({ check: 'custom', description: 'AI evaluated criterion' }),
        makeCriterion({ check: 'custom', description: 'Another AI criterion' }),
      ];

      const results = registry.runChecks('# Some markdown', criteria);
      expect(results).toHaveLength(0);
    });

    it('mixes structural checks, custom skips, and unknown checks correctly', () => {
      const registry = new CheckRegistry();
      registry.register('known-check', passingCheck);

      const criteria: Criterion[] = [
        makeCriterion({ check: 'known-check', description: 'Structural check' }),
        makeCriterion({ check: 'custom', description: 'AI check - skipped' }),
        makeCriterion({ check: 'not-registered', description: 'Unknown check type' }),
      ];

      const results = registry.runChecks('# Markdown', criteria);

      // custom is skipped, so only 2 results
      expect(results).toHaveLength(2);
      expect(results[0].pass).toBe(true);
      expect(results[0].criterion).toBe('Structural check');
      expect(results[1].pass).toBe(false);
      expect(results[1].criterion).toBe('Unknown check type');
      expect(results[1].message).toContain('"not-registered"');
    });

    it('fails with a descriptive message for unknown non-custom check types', () => {
      const registry = new CheckRegistry();

      const criteria: Criterion[] = [
        makeCriterion({ check: 'does-not-exist', description: 'Missing check' }),
      ];

      const results = registry.runChecks('# Markdown', criteria);

      expect(results).toHaveLength(1);
      expect(results[0].pass).toBe(false);
      expect(results[0].criterion).toBe('Missing check');
      expect(results[0].message).toMatch(/unknown check type/i);
      expect(results[0].message).toContain('"does-not-exist"');
    });

    it('returns empty array when no criteria are given', () => {
      const registry = new CheckRegistry();
      const results = registry.runChecks('# Markdown', []);
      expect(results).toHaveLength(0);
    });
  });
});
