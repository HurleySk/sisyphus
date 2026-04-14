import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState } from '../../src/ui/state.js';
import type { UIState, UIAction, PhaseHistoryEntry } from '../../src/ui/state.js';

function apply(state: UIState, action: UIAction): UIState {
  return uiReducer(state, action);
}

describe('produce:stream action', () => {
  it('appends a line to streamingLines', () => {
    let state = apply(initialUIState, {
      type: 'run:start',
      payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
    });
    state = apply(state, {
      type: 'boulder:start',
      payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3, description: '', criteriaDescriptions: [] },
    });
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: '# Welcome' },
    });
    expect(state.agentPanel.streamingLines).toContain('# Welcome');
  });
});

describe('agentPanel state management', () => {
  function makeBoulder(): UIState {
    return apply(
      apply(initialUIState, {
        type: 'run:start',
        payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
      }),
      { type: 'boulder:start', payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3, description: '', criteriaDescriptions: [] } },
    );
  }

  it('produce:start sets agentPanel to sisyphus with empty streamingLines', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    expect(state.agentPanel.agent).toBe('sisyphus');
    expect(state.agentPanel.streamingLines).toEqual([]);
    expect(state.agentPanel.boulderName).toBe('b1');
    expect(state.agentPanel.attempt).toBe(0);
  });

  it('produce:stream appends lines', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: '# Hello' },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: 'World' },
    });
    expect(state.agentPanel.streamingLines).toEqual(['# Hello', 'World']);
  });

  it('evaluate:start switches agentPanel to hades', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'evaluate:start',
      payload: { boulderName: 'b1', attempt: 0, structuralCount: 2, customCount: 1 },
    });
    expect(state.agentPanel.agent).toBe('hades');
    expect(state.agentPanel.streamingLines).toEqual([]);
  });

  it('climb sets agentPanel to retry mode with failure info', () => {
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
        failures: [{ criterion: 'word-count', pass: false, message: 'Too short' }],
      },
    });
    state = apply(state, {
      type: 'climb',
      payload: {
        boulderName: 'b1', attempt: 0,
        failures: [{ criterion: 'word-count', pass: false, message: 'Too short' }],
      },
    });
    expect(state.agentPanel.agent).toBe('retry');
    expect(state.agentPanel.climbFeedback).toContain('Too short');
  });

  it('stack:start sets agentPanel to gathering mode', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'stack:start',
      payload: { boulderName: 'b1', sourceCount: 3 },
    });
    expect(state.agentPanel.agent).toBe('gathering');
    expect(state.agentPanel.boulderName).toBe('b1');
  });

  it('run:end sets agentPanel to done', () => {
    const mockReport = {
      title: 'T', startedAt: '', completedAt: '',
      boulders: [], totalBoulders: 0, passedClean: 0, passedAfterClimb: 0, flagged: 0,
    };
    let state = makeBoulder();
    state = apply(state, { type: 'run:end', payload: { report: mockReport } });
    expect(state.agentPanel.agent).toBe('done');
  });
});

describe('producerStatus transitions', () => {
  it('produce:start sets producerStatus to idle', () => {
    let state = uiReducer(initialUIState, {
      type: 'boulder:start',
      payload: { name: 'greeting', index: 0, total: 1, maxAttempts: 2, description: 'greeting boulder', criteriaDescriptions: [] },
    });
    state = uiReducer(state, {
      type: 'stack:start',
      payload: { boulderName: 'greeting', sourceCount: 0 },
    });
    state = uiReducer(state, {
      type: 'produce:start',
      payload: { boulderName: 'greeting', attempt: 0, maxAttempts: 2 },
    });
    expect(state.agentPanel.producerStatus).toBe('idle');
  });

  it('produce:thinking sets producerStatus to thinking', () => {
    let state = uiReducer(initialUIState, {
      type: 'boulder:start',
      payload: { name: 'greeting', index: 0, total: 1, maxAttempts: 2, description: 'greeting boulder', criteriaDescriptions: [] },
    });
    state = uiReducer(state, {
      type: 'stack:start',
      payload: { boulderName: 'greeting', sourceCount: 0 },
    });
    state = uiReducer(state, {
      type: 'produce:start',
      payload: { boulderName: 'greeting', attempt: 0, maxAttempts: 2 },
    });
    state = uiReducer(state, {
      type: 'produce:thinking',
      payload: { boulderName: 'greeting' },
    });
    expect(state.agentPanel.producerStatus).toBe('thinking');
  });

  it('produce:stream sets producerStatus to streaming', () => {
    let state = uiReducer(initialUIState, {
      type: 'boulder:start',
      payload: { name: 'greeting', index: 0, total: 1, maxAttempts: 2, description: 'greeting boulder', criteriaDescriptions: [] },
    });
    state = uiReducer(state, {
      type: 'stack:start',
      payload: { boulderName: 'greeting', sourceCount: 0 },
    });
    state = uiReducer(state, {
      type: 'produce:start',
      payload: { boulderName: 'greeting', attempt: 0, maxAttempts: 2 },
    });
    state = uiReducer(state, {
      type: 'produce:thinking',
      payload: { boulderName: 'greeting' },
    });
    state = uiReducer(state, {
      type: 'produce:stream',
      payload: { boulderName: 'greeting', line: '# Hello' },
    });
    expect(state.agentPanel.producerStatus).toBe('streaming');
    expect(state.agentPanel.streamingLines).toEqual(['# Hello']);
  });

  it('produce:thinking is ignored when no active boulder', () => {
    const state = uiReducer(initialUIState, {
      type: 'produce:thinking',
      payload: { boulderName: 'greeting' },
    });
    expect(state.agentPanel.producerStatus).toBe('idle');
  });
});

describe('phaseHistory accumulation', () => {
  function makeBoulderWithStack(): UIState {
    let state = apply(initialUIState, {
      type: 'run:start',
      payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
    });
    state = apply(state, {
      type: 'boulder:start',
      payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3, description: '', criteriaDescriptions: [] },
    });
    state = apply(state, {
      type: 'stack:start',
      payload: { boulderName: 'b1', sourceCount: 2 },
    });
    state = apply(state, {
      type: 'stack:file',
      payload: { boulderName: 'b1', filePath: 'a.md', lineCount: 100, summarized: false },
    });
    state = apply(state, {
      type: 'stack:file',
      payload: { boulderName: 'b1', filePath: 'b.md', lineCount: 134, summarized: true },
    });
    return state;
  }

  it('produce:start appends gathering summary when transitioning from gathering', () => {
    let state = makeBoulderWithStack();
    expect(state.agentPanel.agent).toBe('gathering');

    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });

    expect(state.phaseHistory).toHaveLength(1);
    const entry = state.phaseHistory[0];
    expect(entry.agent).toBe('gathering');
    expect(entry.boulderName).toBe('b1');
    expect(entry.summary).toBe('2 files (234 lines)');
  });

  it('produce:start does NOT append gathering summary when not in gathering mode', () => {
    let state = apply(initialUIState, {
      type: 'run:start',
      payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
    });
    state = apply(state, {
      type: 'boulder:start',
      payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3, description: '', criteriaDescriptions: [] },
    });
    // agentPanel is idle (no stack:start), go straight to produce
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });

    expect(state.phaseHistory).toHaveLength(0);
  });

  it('evaluate:start appends sisyphus summary with attempt and line count', () => {
    let state = makeBoulderWithStack();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: '# Title' },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: 'Content here' },
    });

    state = apply(state, {
      type: 'evaluate:start',
      payload: { boulderName: 'b1', attempt: 0, structuralCount: 2, customCount: 0 },
    });

    // gathering + sisyphus = 2 entries
    expect(state.phaseHistory).toHaveLength(2);
    const entry = state.phaseHistory[1];
    expect(entry.agent).toBe('sisyphus');
    expect(entry.boulderName).toBe('b1');
    expect(entry.summary).toBe('attempt 1 \u00b7 2 lines');
  });

  it('boulder:end appends hades evaluation summary', () => {
    let state = makeBoulderWithStack();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'evaluate:start',
      payload: { boulderName: 'b1', attempt: 0, structuralCount: 2, customCount: 0 },
    });
    state = apply(state, {
      type: 'evaluate:structural',
      payload: {
        boulderName: 'b1',
        results: [
          { criterion: 'c1', pass: true, message: 'ok' },
          { criterion: 'c2', pass: true, message: 'ok' },
        ],
      },
    });
    state = apply(state, {
      type: 'evaluate:end',
      payload: { boulderName: 'b1', attempt: 0, passed: true },
    });
    state = apply(state, {
      type: 'boulder:end',
      payload: { name: 'b1', status: 'passed', attempts: 1, durationMs: 5000 },
    });

    // gathering + sisyphus + hades = 3 entries
    expect(state.phaseHistory).toHaveLength(3);
    const entry = state.phaseHistory[2];
    expect(entry.agent).toBe('hades');
    expect(entry.boulderName).toBe('b1');
    expect(entry.summary).toBe('2/2 checks passed');
  });

  it('climb appends hades failed summary with retrying', () => {
    let state = makeBoulderWithStack();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'evaluate:start',
      payload: { boulderName: 'b1', attempt: 0, structuralCount: 2, customCount: 1 },
    });
    state = apply(state, {
      type: 'evaluate:structural',
      payload: {
        boulderName: 'b1',
        results: [
          { criterion: 'c1', pass: true, message: 'ok' },
          { criterion: 'c2', pass: false, message: 'bad' },
        ],
      },
    });
    state = apply(state, {
      type: 'evaluate:custom',
      payload: {
        boulderName: 'b1',
        results: [
          { criterion: 'c3', pass: false, message: 'nope' },
        ],
      },
    });
    state = apply(state, {
      type: 'evaluate:end',
      payload: {
        boulderName: 'b1', attempt: 0, passed: false,
        failures: [
          { criterion: 'c2', pass: false, message: 'bad' },
          { criterion: 'c3', pass: false, message: 'nope' },
        ],
      },
    });
    state = apply(state, {
      type: 'climb',
      payload: {
        boulderName: 'b1', attempt: 0,
        failures: [
          { criterion: 'c2', pass: false, message: 'bad' },
          { criterion: 'c3', pass: false, message: 'nope' },
        ],
      },
    });

    // gathering + sisyphus + hades = 3 entries
    expect(state.phaseHistory).toHaveLength(3);
    const entry = state.phaseHistory[2];
    expect(entry.agent).toBe('hades');
    expect(entry.boulderName).toBe('b1');
    expect(entry.summary).toBe('2/3 checks failed \u2192 retrying');
  });
});
