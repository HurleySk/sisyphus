// tests/ui/state.test.ts
import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState, defaultWorkerPanel } from '../../src/ui/state.js';
import type { UIState, UIAction, BoulderUIState } from '../../src/ui/state.js';

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
          dispatchLog: [],
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
          dispatchLog: [],
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
          dispatchLog: [],
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
          dispatchLog: [],
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
          dispatchLog: [],
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
          dispatchLog: [],
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
          dispatchLog: [],
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

  // --- New two-panel state tests ---

  describe('dispatchLog', () => {
    function makeBoulder(): UIState {
      return apply(
        apply(initialUIState, {
          type: 'run:start',
          payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
        }),
        { type: 'boulder:start', payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3 } },
      );
    }

    it('boulder:start initializes empty dispatchLog', () => {
      const state = makeBoulder();
      expect(state.activeBoulder?.dispatchLog).toEqual([]);
    });

    it('stack:start adds gathering dispatch entry', () => {
      const state = apply(makeBoulder(), {
        type: 'stack:start',
        payload: { boulderName: 'b1', sourceCount: 3 },
      });
      expect(state.activeBoulder?.dispatchLog).toHaveLength(1);
      expect(state.activeBoulder?.dispatchLog[0].type).toBe('gathered');
      expect(state.activeBoulder?.dispatchLog[0].message).toContain('3 sources');
    });

    it('stack:end adds gathered dispatch entry', () => {
      let state = apply(makeBoulder(), {
        type: 'stack:start',
        payload: { boulderName: 'b1', sourceCount: 2 },
      });
      state = apply(state, {
        type: 'stack:end',
        payload: { boulderName: 'b1', resultCount: 5 },
      });
      expect(state.activeBoulder?.dispatchLog).toHaveLength(2);
      expect(state.activeBoulder?.dispatchLog[1].message).toContain('5 files');
    });

    it('produce:start adds dispatched-sisyphus entry', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'stack:start',
        payload: { boulderName: 'b1', sourceCount: 1 },
      });
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      const log = state.activeBoulder?.dispatchLog ?? [];
      const entry = log.find((e) => e.type === 'dispatched-sisyphus');
      expect(entry).toBeDefined();
      expect(entry?.message).toContain('attempt 0');
    });

    it('produce:end adds sisyphus produced entry', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'produce:file-change',
        payload: { boulderName: 'b1', filePath: 'out.md', changeType: 'A' },
      });
      state = apply(state, {
        type: 'produce:end',
        payload: { boulderName: 'b1', attempt: 0, outputLength: 100 },
      });
      const log = state.activeBoulder?.dispatchLog ?? [];
      const entry = log[log.length - 1];
      expect(entry.message).toContain('1 changes');
    });

    it('evaluate:start adds dispatched-hades entry', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'evaluate:start',
        payload: { boulderName: 'b1', attempt: 0, structuralCount: 2, customCount: 1 },
      });
      const log = state.activeBoulder?.dispatchLog ?? [];
      const entry = log.find((e) => e.type === 'dispatched-hades');
      expect(entry).toBeDefined();
      expect(entry?.message).toContain('dispatched hades');
    });

    it('evaluate:end (pass) adds evaluated-pass entry', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'evaluate:start',
        payload: { boulderName: 'b1', attempt: 0, structuralCount: 0, customCount: 0 },
      });
      state = apply(state, {
        type: 'evaluate:end',
        payload: { boulderName: 'b1', attempt: 0, passed: true, failures: [] },
      });
      const log = state.activeBoulder?.dispatchLog ?? [];
      const entry = log.find((e) => e.type === 'evaluated-pass');
      expect(entry).toBeDefined();
      expect(entry?.message).toContain('hades passed');
    });

    it('evaluate:end (fail) adds evaluated-fail entry with issue count', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'evaluate:start',
        payload: { boulderName: 'b1', attempt: 0, structuralCount: 1, customCount: 0 },
      });
      const failures = [
        { criterion: 'has-heading', pass: false, message: 'No H1' },
        { criterion: 'word-count', pass: false, message: 'Too short' },
      ];
      state = apply(state, {
        type: 'evaluate:end',
        payload: { boulderName: 'b1', attempt: 0, passed: false, failures },
      });
      const log = state.activeBoulder?.dispatchLog ?? [];
      const entry = log.find((e) => e.type === 'evaluated-fail');
      expect(entry).toBeDefined();
      expect(entry?.message).toContain('2 issues');
    });

    it('climb adds retry entry with failure summary', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'evaluate:start',
        payload: { boulderName: 'b1', attempt: 0, structuralCount: 1, customCount: 0 },
      });
      state = apply(state, {
        type: 'evaluate:end',
        payload: {
          boulderName: 'b1', attempt: 0, passed: false,
          failures: [{ criterion: 'has-heading', pass: false, message: 'No H1' }],
        },
      });
      state = apply(state, {
        type: 'climb',
        payload: {
          boulderName: 'b1', attempt: 0,
          failures: [{ criterion: 'has-heading', pass: false, message: 'No H1' }],
        },
      });
      const log = state.activeBoulder?.dispatchLog ?? [];
      const entry = log.find((e) => e.type === 'retry');
      expect(entry).toBeDefined();
      expect(entry?.message).toContain('retry');
      expect(entry?.message).toContain('No H1');
    });
  });

  describe('workerPanel', () => {
    function makeBoulder(): UIState {
      return apply(
        apply(initialUIState, {
          type: 'run:start',
          payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
        }),
        { type: 'boulder:start', payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3 } },
      );
    }

    it('initialUIState has default workerPanel', () => {
      expect(initialUIState.workerPanel.agent).toBeNull();
      expect(initialUIState.workerPanel.fileChanges).toEqual([]);
      expect(initialUIState.workerPanel.evaluatePassed).toBeNull();
    });

    it('boulder:start resets workerPanel', () => {
      const state = makeBoulder();
      expect(state.workerPanel.agent).toBeNull();
    });

    it('produce:start sets workerPanel to sisyphus', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 1, maxAttempts: 3, climbFeedback: 'fix it' },
      });
      expect(state.workerPanel.agent).toBe('sisyphus');
      expect(state.workerPanel.boulderName).toBe('b1');
      expect(state.workerPanel.climbFeedback).toBe('fix it');
      expect(state.workerPanel.fileChanges).toEqual([]);
      expect(state.workerPanel.startedAt).toBeTypeOf('number');
    });

    it('produce:file-change appends to workerPanel.fileChanges', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'produce:file-change',
        payload: { boulderName: 'b1', filePath: 'out.md', changeType: 'A' },
      });
      expect(state.workerPanel.fileChanges).toHaveLength(1);
      expect(state.workerPanel.fileChanges[0].filePath).toBe('out.md');
    });

    it('produce:diff sets workerPanel.diffStat', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'produce:diff',
        payload: { boulderName: 'b1', attempt: 0, diff: '3 files changed' },
      });
      expect(state.workerPanel.diffStat).toBe('3 files changed');
    });

    it('evaluate:start switches workerPanel to hades', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'evaluate:start',
        payload: { boulderName: 'b1', attempt: 0, structuralCount: 2, customCount: 1 },
      });
      expect(state.workerPanel.agent).toBe('hades');
      expect(state.workerPanel.structuralCount).toBe(2);
      expect(state.workerPanel.customCount).toBe(1);
    });

    it('evaluate:structural sets workerPanel.structuralResults', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'evaluate:start',
        payload: { boulderName: 'b1', attempt: 0, structuralCount: 1, customCount: 0 },
      });
      const results = [{ criterion: 'has-heading', pass: true, message: 'OK' }];
      state = apply(state, {
        type: 'evaluate:structural',
        payload: { boulderName: 'b1', results },
      });
      expect(state.workerPanel.structuralResults).toEqual(results);
    });

    it('evaluate:custom sets workerPanel.customResults', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'evaluate:start',
        payload: { boulderName: 'b1', attempt: 0, structuralCount: 0, customCount: 1 },
      });
      const results = [{ criterion: 'custom-check', pass: false, message: 'fail' }];
      state = apply(state, {
        type: 'evaluate:custom',
        payload: { boulderName: 'b1', results },
      });
      expect(state.workerPanel.customResults).toEqual(results);
    });

    it('evaluate:end sets workerPanel.evaluatePassed', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'evaluate:start',
        payload: { boulderName: 'b1', attempt: 0, structuralCount: 0, customCount: 0 },
      });
      state = apply(state, {
        type: 'evaluate:end',
        payload: { boulderName: 'b1', attempt: 0, passed: true, failures: [] },
      });
      expect(state.workerPanel.evaluatePassed).toBe(true);
    });

    it('evaluate:end (fail) sets evaluatePassed to false', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'evaluate:start',
        payload: { boulderName: 'b1', attempt: 0, structuralCount: 0, customCount: 0 },
      });
      state = apply(state, {
        type: 'evaluate:end',
        payload: {
          boulderName: 'b1', attempt: 0, passed: false,
          failures: [{ criterion: 'x', pass: false, message: 'bad' }],
        },
      });
      expect(state.workerPanel.evaluatePassed).toBe(false);
    });

    it('climb resets workerPanel to default', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'climb',
        payload: {
          boulderName: 'b1', attempt: 0,
          failures: [{ criterion: 'x', pass: false, message: 'bad' }],
        },
      });
      expect(state.workerPanel.agent).toBeNull();
      expect(state.workerPanel.fileChanges).toEqual([]);
    });

    it('boulder:end resets workerPanel', () => {
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, {
        type: 'boulder:end',
        payload: { name: 'b1', status: 'passed', attempts: 1, durationMs: 5000 },
      });
      expect(state.workerPanel.agent).toBeNull();
    });

    it('run:end resets workerPanel', () => {
      const mockReport = {
        title: 'T', startedAt: '', completedAt: '',
        boulders: [], totalBoulders: 0, passedClean: 0, passedAfterClimb: 0, flagged: 0,
      };
      let state = makeBoulder();
      state = apply(state, {
        type: 'produce:start',
        payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
      });
      state = apply(state, { type: 'run:end', payload: { report: mockReport } });
      expect(state.workerPanel.agent).toBeNull();
    });
  });
});
