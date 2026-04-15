import { describe, it, expect, afterEach, vi } from 'vitest';

vi.setConfig({ testTimeout: 15_000 });
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

  it('renders HADES with check count when provided', () => {
    const out = cap(<AgentHeader agent="hades" boulderName="features" attempt={0} maxAttempts={3} elapsed={3} checkCount={8} />);
    expect(out).toContain('HADES');
    expect(out).toContain('evaluating 8 checks');
  });

  it('renders GATHERING with dim cyan style', () => {
    const out = cap(<AgentHeader agent="gathering" boulderName="intro" attempt={0} maxAttempts={3} elapsed={2} />);
    expect(out).toContain('GATHERING');
    expect(out).toContain('intro');
  });

  it('renders GATHERING with source count when provided', () => {
    const out = cap(<AgentHeader agent="gathering" boulderName="intro" attempt={0} maxAttempts={3} elapsed={2} sourceCount={5} />);
    expect(out).toContain('GATHERING');
    expect(out).toContain('5 sources');
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
    expect(out).toContain('✓');
    expect(out).toContain('src/data.ts');
    expect(out).toContain('42 lines');
    expect(out).toContain('data/big.csv');
    expect(out).toContain('summarized');
    expect(out).toContain('2 files');
    expect(out).toContain('542 lines total');
  });

  it('renders sisyphus mode with streaming lines', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'sisyphus',
      boulderName: 'greeting',
      attempt: 0,
      maxAttempts: 3,
      startedAt: Date.now(),
      producerStatus: 'streaming',
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

  it('hides spinner when all checks are received', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'hades',
      boulderName: 'greeting',
      startedAt: Date.now(),
      checkCount: 3,
      structuralResults: [
        { criterion: 'contains-heading', pass: true, message: '"Welcome" h1 found' },
        { criterion: 'word-count-gte', pass: true, message: '47 words (min 20)' },
      ],
      customResults: [
        { criterion: 'custom-tone', pass: true, message: 'tone is appropriate' },
      ],
    };
    const out = cap(<AgentPanel panel={panel} elapsed={3} />);
    expect(out).toContain('✓');
    expect(out).toContain('contains-heading');
    expect(out).toContain('custom-tone');
    // Spinner line should be gone — only the header sublabel contains "evaluating"
    expect(out).not.toMatch(/evaluating\.\.\./);
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

  it('returns empty output when agent is done', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'done',
    };
    const out = cap(<AgentPanel panel={panel} elapsed={0} />);
    expect(out).not.toContain('waiting');
    expect(out).toBe('');
  });

  it('shows "starting..." when producerStatus is idle', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'sisyphus',
      boulderName: 'greeting',
      attempt: 0,
      maxAttempts: 2,
      startedAt: Date.now(),
      producerStatus: 'idle',
    };
    const out = cap(<AgentPanel panel={panel} elapsed={1} mainHeight={20} />);
    expect(out).toContain('starting...');
    expect(out).not.toContain('writing...');
    expect(out).not.toContain('reasoning...');
  });

  it('shows "reasoning..." when producerStatus is thinking', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'sisyphus',
      boulderName: 'greeting',
      attempt: 0,
      maxAttempts: 2,
      startedAt: Date.now(),
      producerStatus: 'thinking',
    };
    const out = cap(<AgentPanel panel={panel} elapsed={3} mainHeight={20} />);
    expect(out).toContain('reasoning...');
    expect(out).not.toContain('writing...');
    expect(out).not.toContain('starting...');
  });

  it('shows streaming lines and "writing..." when producerStatus is streaming', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'sisyphus',
      boulderName: 'greeting',
      attempt: 0,
      maxAttempts: 2,
      startedAt: Date.now(),
      producerStatus: 'streaming',
      streamingLines: ['# Welcome', '', 'Hello world'],
    };
    const out = cap(<AgentPanel panel={panel} elapsed={6} mainHeight={20} />);
    expect(out).toContain('# Welcome');
    expect(out).toContain('Hello world');
    expect(out).toContain('writing...');
    expect(out).not.toContain('reasoning...');
    expect(out).not.toContain('starting...');
  });

  it('windows streaming lines when mainHeight is small', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `Line ${i + 1} of content`);
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'sisyphus',
      boulderName: 'greeting',
      attempt: 0,
      maxAttempts: 3,
      startedAt: Date.now(),
      producerStatus: 'streaming',
      streamingLines: lines,
    };
    // mainHeight=12, bodyHeight=10, budget=max(10-2,3)=8, hasMore=true, maxLines=7
    const out = cap(<AgentPanel panel={panel} elapsed={6} mainHeight={12} />);
    // Should show the "more lines" indicator
    expect(out).toContain('↑ 18 more lines');
    // Should show the last 7 lines
    expect(out).toContain('Line 25 of content');
    expect(out).toContain('Line 19 of content');
    // Should NOT show early lines
    expect(out).not.toContain('Line 1 of content');
    expect(out).not.toContain('Line 18 of content');
    // Should still show spinner
    expect(out).toContain('writing');
  });

  it('windows gathering files when mainHeight is small', () => {
    const files = Array.from({ length: 15 }, (_, i) => ({
      path: `src/file${i + 1}.ts`,
      lines: 100 + i,
      summarized: false,
    }));
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'gathering',
      boulderName: 'intro',
      startedAt: Date.now(),
      stackFiles: files,
    };
    // mainHeight=8, bodyHeight=6, budget=max(6-2,3)=4, hasMore=true, maxItems=3
    const out = cap(<AgentPanel panel={panel} elapsed={2} mainHeight={8} />);
    expect(out).toContain('↑ 12 more files');
    expect(out).toContain('file15.ts');
    expect(out).toContain('file13.ts');
    expect(out).not.toContain('file1.ts');
    expect(out).not.toContain('file12.ts');
    // Should show total summary
    expect(out).toContain('15 files');
    expect(out).toContain('lines total');
  });

  it('windows hades check results when mainHeight is small', () => {
    const structural = Array.from({ length: 10 }, (_, i) => ({
      criterion: `check-${i + 1}`,
      pass: true,
      message: `passed check ${i + 1}`,
    }));
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'hades',
      boulderName: 'greeting',
      startedAt: Date.now(),
      checkCount: 11, // 10 structural + 1 custom — all received, spinner hidden
      structuralResults: structural,
      customResults: [{ criterion: 'custom-1', pass: true, message: 'ok' }],
    };
    // mainHeight=9, bodyHeight=7, budget=max(7-0,3)=7, hasMore=true, maxItems=6
    const out = cap(<AgentPanel panel={panel} elapsed={3} mainHeight={9} />);
    expect(out).toContain('↑ 5 more checks');
    expect(out).toContain('custom-1');
    expect(out).toContain('check-6');
    expect(out).not.toContain('check-1 ');
    expect(out).not.toContain('check-5 ');
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
    expect(out).toContain('produced 2 words');
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
      retryHistory: [{ attempt: 0, failedChecks: ['row-count-gte'] }],
    }];
    const out = cap(
      <CompletionSummary report={report} completedBoulders={completed}
        artifactPath="output/test.md" reportPath="output/test-report.json" elapsed={19} />
    );
    expect(out).toContain('2 attempts');
    expect(out).toContain('row-count-gte');
    expect(out).toContain('attempt 1');
    expect(out).toContain('retried');
    expect(out).toContain('produced 1 words');
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
