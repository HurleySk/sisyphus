// tests/ui/state.test.ts
import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState } from '../../src/ui/state.js';
import type { UIState, UIAction } from '../../src/ui/state.js';

function apply(state: UIState, action: UIAction): UIState {
  return uiReducer(state, action);
}

describe('uiReducer', () => {
  describe('run:start', () => {
    it('sets title, layer, and totalBoulders', () => {
      const next = apply(initialUIState, {
        type: 'run:start',
        payload: { title: 'My Run', layer: 'documentation', totalBoulders: 3, maxRetries: 2 },
      });
      expect(next.title).toBe('My Run');
      expect(next.layer).toBe('documentation');
      expect(next.totalBoulders).toBe(3);
    });

    it('does not mutate other fields', () => {
      const next = apply(initialUIState, {
        type: 'run:start',
        payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 1 },
      });
      expect(next.activeBoulder).toBeNull();
      expect(next.completedBoulders).toHaveLength(0);
      expect(next.report).toBeNull();
    });
  });

  describe('boulder:start', () => {
    it('creates a fresh active boulder', () => {
      const withRun = apply(initialUIState, {
        type: 'run:start',
        payload: { title: 'T', layer: 'l', totalBoulders: 2, maxRetries: 3 },
      });
      const next = apply(withRun, {
        type: 'boulder:start',
        payload: { name: 'section-1', index: 0, total: 2, maxAttempts: 4 },
      });
      expect(next.activeBoulder).not.toBeNull();
      expect(next.activeBoulder?.name).toBe('section-1');
      expect(next.activeBoulder?.phase).toBe('idle');
      expect(next.activeBoulder?.attempt).toBe(0);
      expect(next.activeBoulder?.maxAttempts).toBe(4);
      expect(next.activeBoulder?.stackFiles).toHaveLength(0);
      expect(next.activeBoulder?.fileChanges).toHaveLength(0);
      expect(next.activeBoulder?.diffStat).toBeNull();
      expect(next.activeBoulder?.climbFeedback).toBeUndefined();
    });

    it('removes boulder from pending names', () => {
      const withPending: UIState = {
        ...initialUIState,
        pendingBoulderNames: ['section-1', 'section-2'],
      };
      const next = apply(withPending, {
        type: 'boulder:start',
        payload: { name: 'section-1', index: 0, total: 2, maxAttempts: 3 },
      });
      expect(next.pendingBoulderNames).toEqual(['section-2']);
    });
  });

  describe('produce:start', () => {
    it('sets phase to produce and updates attempt + climbFeedback', () => {
      const withBoulder: UIState = {
        ...initialUIState,
        activeBoulder: {
          name: 'b1',
          phase: 'stack',
          attempt: 0,
          maxAttempts: 3,
          stackFiles: [],
          fileChanges: [],
          diffStat: null,
          climbFeedback: undefined,
          structuralResults: null,
          customResults: null,
          results: null,
          startedAt: Date.now(),
        },
      };
      const next = apply(withBoulder, {
        type: 'produce:start',
        payload: {
          boulderName: 'b1',
          attempt: 1,
          maxAttempts: 3,
          climbFeedback: 'Fix headings',
        },
      });
      expect(next.activeBoulder?.phase).toBe('produce');
      expect(next.activeBoulder?.attempt).toBe(1);
      expect(next.activeBoulder?.climbFeedback).toBe('Fix headings');
    });

    it('clears fileChanges and diffStat on produce:start', () => {
      const withBoulder: UIState = {
        ...initialUIState,
        activeBoulder: {
          name: 'b1',
          phase: 'evaluate',
          attempt: 1,
          maxAttempts: 3,
          stackFiles: [],
          fileChanges: [{ filePath: 'old.md', changeType: 'M' }],
          diffStat: '10 insertions',
          climbFeedback: undefined,
          structuralResults: null,
          customResults: null,
          results: null,
          startedAt: Date.now(),
        },
      };
      const next = apply(withBoulder, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 2, maxAttempts: 3 },
      });
      expect(next.activeBoulder?.fileChanges).toHaveLength(0);
      expect(next.activeBoulder?.diffStat).toBeNull();
    });
  });

  describe('boulder:end', () => {
    it('moves active boulder to completedBoulders', () => {
      const withBoulder: UIState = {
        ...initialUIState,
        activeBoulder: {
          name: 'b1',
          phase: 'evaluate',
          attempt: 1,
          maxAttempts: 3,
          stackFiles: [],
          fileChanges: [],
          diffStat: null,
          climbFeedback: undefined,
          structuralResults: null,
          customResults: null,
          results: null,
          startedAt: Date.now(),
        },
      };
      const next = apply(withBoulder, {
        type: 'boulder:end',
        payload: { name: 'b1', status: 'passed', attempts: 1, durationMs: 5000 },
      });
      expect(next.activeBoulder).toBeNull();
      expect(next.completedBoulders).toHaveLength(1);
      expect(next.completedBoulders[0]).toMatchObject({
        name: 'b1',
        status: 'passed',
        attempts: 1,
        durationMs: 5000,
      });
    });

    it('preserves previously completed boulders', () => {
      const withCompleted: UIState = {
        ...initialUIState,
        completedBoulders: [
          { name: 'b0', status: 'passed', attempts: 1, durationMs: 1000 },
        ],
        activeBoulder: {
          name: 'b1',
          phase: 'evaluate',
          attempt: 1,
          maxAttempts: 3,
          stackFiles: [],
          fileChanges: [],
          diffStat: null,
          climbFeedback: undefined,
          structuralResults: null,
          customResults: null,
          results: null,
          startedAt: Date.now(),
        },
      };
      const next = apply(withCompleted, {
        type: 'boulder:end',
        payload: { name: 'b1', status: 'flagged', attempts: 3, durationMs: 9000 },
      });
      expect(next.completedBoulders).toHaveLength(2);
      expect(next.completedBoulders[0].name).toBe('b0');
      expect(next.completedBoulders[1].name).toBe('b1');
    });
  });

  describe('evaluate:end with failures', () => {
    it('sets phase to failed when not passed', () => {
      const failures = [{ criterion: 'has-heading', pass: false, message: 'No H1 found' }];
      const withBoulder: UIState = {
        ...initialUIState,
        activeBoulder: {
          name: 'b1',
          phase: 'evaluate',
          attempt: 1,
          maxAttempts: 3,
          stackFiles: [],
          fileChanges: [],
          diffStat: null,
          climbFeedback: undefined,
          structuralResults: failures,
          customResults: [],
          results: null,
          startedAt: Date.now(),
        },
      };
      const next = apply(withBoulder, {
        type: 'evaluate:end',
        payload: { boulderName: 'b1', attempt: 1, passed: false, failures },
      });
      expect(next.activeBoulder?.phase).toBe('failed');
    });

    it('keeps phase as evaluate when passed', () => {
      const withBoulder: UIState = {
        ...initialUIState,
        activeBoulder: {
          name: 'b1',
          phase: 'evaluate',
          attempt: 1,
          maxAttempts: 3,
          stackFiles: [],
          fileChanges: [],
          diffStat: null,
          climbFeedback: undefined,
          structuralResults: [],
          customResults: [],
          results: null,
          startedAt: Date.now(),
        },
      };
      const next = apply(withBoulder, {
        type: 'evaluate:end',
        payload: { boulderName: 'b1', attempt: 1, passed: true, failures: [] },
      });
      expect(next.activeBoulder?.phase).toBe('evaluate');
    });

    it('combines structural and custom results', () => {
      const structural = [{ criterion: 'has-heading', pass: true, message: 'ok' }];
      const custom = [{ criterion: 'custom-check', pass: false, message: 'fail' }];
      const withBoulder: UIState = {
        ...initialUIState,
        activeBoulder: {
          name: 'b1',
          phase: 'evaluate',
          attempt: 1,
          maxAttempts: 3,
          stackFiles: [],
          fileChanges: [],
          diffStat: null,
          climbFeedback: undefined,
          structuralResults: structural,
          customResults: custom,
          results: null,
          startedAt: Date.now(),
        },
      };
      const next = apply(withBoulder, {
        type: 'evaluate:end',
        payload: { boulderName: 'b1', attempt: 1, passed: false, failures: custom },
      });
      expect(next.activeBoulder?.results).toHaveLength(2);
    });
  });

  describe('run:end', () => {
    it('stores the report', () => {
      const mockReport = {
        title: 'Test',
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T00:01:00Z',
        boulders: [],
        totalBoulders: 0,
        passedClean: 0,
        passedAfterClimb: 0,
        flagged: 0,
      };
      const next = apply(initialUIState, {
        type: 'run:end',
        payload: { report: mockReport },
      });
      expect(next.report).toEqual(mockReport);
    });
  });
});
