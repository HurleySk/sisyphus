// tests/ui/use-elapsed.test.ts
import { describe, it, expect } from 'vitest';
import { elapsedSeconds } from '../../src/ui/hooks/useElapsed.js';

describe('elapsedSeconds', () => {
  it('returns 0 when startTime is now', () => {
    const now = Date.now();
    expect(elapsedSeconds(now)).toBe(0);
  });

  it('returns correct seconds for a startTime 5 seconds ago', () => {
    const fiveSecondsAgo = Date.now() - 5000;
    const result = elapsedSeconds(fiveSecondsAgo);
    // Allow a small timing tolerance: should be 4, 5, or 6
    expect(result).toBeGreaterThanOrEqual(4);
    expect(result).toBeLessThanOrEqual(6);
  });

  it('returns correct seconds for a startTime 60 seconds ago', () => {
    const sixtySecondsAgo = Date.now() - 60000;
    const result = elapsedSeconds(sixtySecondsAgo);
    expect(result).toBeGreaterThanOrEqual(59);
    expect(result).toBeLessThanOrEqual(61);
  });
});
