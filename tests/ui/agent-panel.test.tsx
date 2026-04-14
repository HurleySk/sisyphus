import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { AgentHeader } from '../../src/ui/components/AgentHeader.js';
import { AgentPanel } from '../../src/ui/components/AgentPanel.js';
import type { AgentPanelState } from '../../src/ui/state.js';
import { defaultAgentPanel } from '../../src/ui/state.js';
import { CompletionSummary } from '../../src/ui/components/CompletionSummary.js';
import type { RunReport } from '../../src/types.js';
import type { CompletedBoulder } from '../../src/ui/state.js';

afterEach(() => { cleanup(); });

function cap(el: React.ReactElement): string {
  const { lastFrame } = render(el);
  return lastFrame()!;
}

describe('AgentHeader', () => {
  it('renders SISYPHUS with boulder name and attempt', () => {
    const out = cap(<AgentHeader agent="sisyphus" boulderName="greeting" attempt={0} maxAttempts={3} elapsed={6} />);
    expect(out).toContain('SISYPHUS');
    expect(out).toContain('greeting');
    expect(out).toContain('attempt 1');
    expect(out).toContain('6s');
  });

  it('renders HADES with evaluating label', () => {
    const out = cap(<AgentHeader agent="hades" boulderName="features" attempt={0} maxAttempts={3} elapsed={3} />);
    expect(out).toContain('HADES');
    expect(out).toContain('features');
    expect(out).toContain('evaluating');
  });

  it('renders GATHERING with dim cyan style', () => {
    const out = cap(<AgentHeader agent="gathering" boulderName="intro" attempt={0} maxAttempts={3} elapsed={2} />);
    expect(out).toContain('GATHERING');
    expect(out).toContain('intro');
  });

  it('renders RETRY with attempt number', () => {
    const out = cap(<AgentHeader agent="retry" boulderName="features" attempt={1} maxAttempts={3} elapsed={0} />);
    expect(out).toContain('RETRY');
    expect(out).toContain('features');
    expect(out).toContain('attempt 2');
  });

  it('renders DONE header', () => {
    const out = cap(<AgentHeader agent="done" boulderName={null} attempt={0} maxAttempts={0} elapsed={28} />);
    expect(out).toContain('DONE');
  });
});

describe('AgentPanel', () => {
  it('renders gathering mode with file list', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'gathering',
      boulderName: 'intro',
      startedAt: Date.now(),
      stackFiles: [
        { path: 'src/data.ts', lines: 42, summarized: false },
        { path: 'data/big.csv', lines: 500, summarized: true },
      ],
    };
    const out = cap(<AgentPanel panel={panel} elapsed={2} />);
    expect(out).toContain('src/data.ts');
    expect(out).toContain('42 lines');
    expect(out).toContain('data/big.csv');
    expect(out).toContain('summarized');
  });

  it('renders sisyphus mode with streaming lines', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'sisyphus',
      boulderName: 'greeting',
      attempt: 0,
      maxAttempts: 3,
      startedAt: Date.now(),
      streamingLines: ['# Welcome', '', 'Hello world.'],
    };
    const out = cap(<AgentPanel panel={panel} elapsed={6} />);
    expect(out).toContain('# Welcome');
    expect(out).toContain('Hello world.');
    expect(out).toContain('writing');
  });

  it('renders hades mode with check results', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'hades',
      boulderName: 'greeting',
      startedAt: Date.now(),
      structuralResults: [
        { criterion: 'contains-heading', pass: true, message: '"Welcome" h1 found' },
        { criterion: 'word-count-gte', pass: true, message: '47 words (min 20)' },
      ],
      customResults: null,
    };
    const out = cap(<AgentPanel panel={panel} elapsed={3} />);
    expect(out).toContain('✓');
    expect(out).toContain('contains-heading');
    expect(out).toContain('word-count-gte');
    expect(out).toContain('evaluating');
  });

  it('renders retry mode with failure feedback', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'retry',
      boulderName: 'greeting',
      attempt: 1,
      maxAttempts: 3,
      climbFeedback: 'Too short, expand to 3-4 sentences',
      retryHistory: [{ attempt: 0, failedChecks: ['word-count-gte'] }],
    };
    const out = cap(<AgentPanel panel={panel} elapsed={0} />);
    expect(out).toContain('word-count-gte');
    expect(out).toContain('Too short');
    expect(out).toContain('restarting');
  });

  it('renders idle state as waiting message', () => {
    const out = cap(<AgentPanel panel={defaultAgentPanel} elapsed={0} />);
    expect(out).toContain('waiting');
  });
});

describe('CompletionSummary (v3)', () => {
  it('renders per-boulder check results', () => {
    const report: RunReport = {
      title: 'Test', startedAt: '', completedAt: '',
      boulders: [
        { name: 'greeting', content: 'Hello world', attempts: 1, status: 'passed' },
      ],
      totalBoulders: 1, passedClean: 1, passedAfterClimb: 0, flagged: 0,
    };
    const completed: CompletedBoulder[] = [{
      name: 'greeting', status: 'passed', attempts: 1, durationMs: 9000,
      results: [
        { criterion: 'contains-heading', pass: true, message: 'found' },
        { criterion: 'word-count-gte', pass: true, message: '47 words' },
      ],
    }];
    const out = cap(
      <CompletionSummary report={report} completedBoulders={completed}
        artifactPath="output/test.md" reportPath="output/test-report.json" elapsed={9} />
    );
    expect(out).toContain('DONE');
    expect(out).toContain('1 passed');
    expect(out).toContain('greeting');
    expect(out).toContain('contains-heading');
    expect(out).toContain('word-count-gte');
    expect(out).toContain('output/test.md');
  });

  it('shows retry history for climbed boulders', () => {
    const report: RunReport = {
      title: 'Test', startedAt: '', completedAt: '',
      boulders: [
        { name: 'features', content: 'table', attempts: 2, status: 'passed' },
      ],
      totalBoulders: 1, passedClean: 0, passedAfterClimb: 1, flagged: 0,
    };
    const completed: CompletedBoulder[] = [{
      name: 'features', status: 'passed', attempts: 2, durationMs: 19000,
      results: [
        { criterion: 'contains-heading', pass: true, message: 'found' },
        { criterion: 'row-count-gte', pass: true, message: '3 rows' },
      ],
      failures: [{ criterion: 'row-count-gte', pass: false, message: '2 rows (min 3)' }],
    }];
    const out = cap(
      <CompletionSummary report={report} completedBoulders={completed}
        artifactPath="output/test.md" reportPath="output/test-report.json" elapsed={19} />
    );
    expect(out).toContain('2 attempts');
    expect(out).toContain('row-count-gte');
  });

  it('shows flagged boulders with failing checks', () => {
    const report: RunReport = {
      title: 'Test', startedAt: '', completedAt: '',
      boulders: [
        { name: 'broken', content: '', attempts: 3, status: 'flagged',
          failures: [{ criterion: 'word-count-gte', pass: false, message: '5 words (min 50)' }] },
      ],
      totalBoulders: 1, passedClean: 0, passedAfterClimb: 0, flagged: 1,
    };
    const completed: CompletedBoulder[] = [{
      name: 'broken', status: 'flagged', attempts: 3, durationMs: 30000,
      failures: [{ criterion: 'word-count-gte', pass: false, message: '5 words (min 50)' }],
    }];
    const out = cap(
      <CompletionSummary report={report} completedBoulders={completed}
        artifactPath="output/test.md" reportPath="output/test-report.json" elapsed={30} />
    );
    expect(out).toContain('✗');
    expect(out).toContain('broken');
    expect(out).toContain('1 flagged');
  });
});
