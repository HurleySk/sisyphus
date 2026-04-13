import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Header } from '../../src/ui/components/Header.js';
import { BoulderPending } from '../../src/ui/components/BoulderPending.js';
import { BoulderCompleted } from '../../src/ui/components/BoulderCompleted.js';
import { PhaseStack } from '../../src/ui/components/PhaseStack.js';
import { PhaseProduce } from '../../src/ui/components/PhaseProduce.js';
import { PhaseEvaluate } from '../../src/ui/components/PhaseEvaluate.js';
import { FailureDetail } from '../../src/ui/components/FailureDetail.js';
import { PanelSeparator } from '../../src/ui/components/PanelSeparator.js';
import { CompletionSummary } from '../../src/ui/components/CompletionSummary.js';
import { WorkerPanel } from '../../src/ui/components/WorkerPanel.js';
import { ThanatosPanel } from '../../src/ui/components/ThanatosPanel.js';
import type { BoulderUIState, WorkerPanelState, UIState } from '../../src/ui/state.js';
import { defaultWorkerPanel, initialUIState } from '../../src/ui/state.js';
import type { Spec, RunReport } from '../../src/types.js';

afterEach(() => { cleanup(); });

function renderAndCapture(element: React.ReactElement): string {
  const { lastFrame } = render(element);
  return lastFrame()!;
}

describe('Header', () => {
  it('renders title and layer', () => {
    const output = renderAndCapture(<Header title="Migration Report" layer="documentation" elapsed={42} />);
    expect(output).toContain('Migration Report');
    expect(output).toContain('documentation');
    expect(output).toContain('42s');
  });

  it('renders completed/total count when provided', () => {
    const output = renderAndCapture(<Header title="Test" layer="docs" elapsed={10} completed={2} total={4} />);
    expect(output).toContain('2/4');
  });
});

describe('BoulderPending', () => {
  it('renders boulder name', () => {
    const output = renderAndCapture(<BoulderPending name="recommendations" />);
    expect(output).toContain('recommendations');
  });
});

describe('BoulderCompleted', () => {
  it('renders passed boulder with check mark', () => {
    const output = renderAndCapture(
      <BoulderCompleted name="intro" status="passed" attempts={1} durationMs={12000} />
    );
    expect(output).toContain('✓');
    expect(output).toContain('intro');
    expect(output).toContain('12s');
  });

  it('renders flagged boulder', () => {
    const output = renderAndCapture(
      <BoulderCompleted name="broken" status="flagged" attempts={4} durationMs={120000} />
    );
    expect(output).toContain('✗');
    expect(output).toContain('broken');
  });

  it('shows inline check results when provided', () => {
    const results = [
      { criterion: 'contains-heading', pass: true, message: 'Found' },
      { criterion: 'word-count-gte', pass: false, message: '187/250' },
    ];
    const output = renderAndCapture(
      <BoulderCompleted name="mapping" status="passed" attempts={2} durationMs={48000}
        failures={[{ criterion: 'word-count-gte', pass: false, message: '187/250' }]}
        results={results} />
    );
    expect(output).toContain('mapping');
    expect(output).toContain('word-count-gte');
    expect(output).toContain('contains-heading');
  });
});

describe('PhaseStack', () => {
  it('renders file list', () => {
    const files = [
      { path: 'src/data.ts', lines: 42, summarized: false },
      { path: 'data/big.csv', lines: 500, summarized: true },
    ];
    const output = renderAndCapture(<PhaseStack files={files} />);
    expect(output).toContain('src/data.ts');
    expect(output).toContain('42');
    expect(output).toContain('data/big.csv');
    expect(output).toContain('summarized');
  });
});

describe('PhaseProduce', () => {
  it('renders writing status', () => {
    const output = renderAndCapture(<PhaseProduce elapsed={12} fileChanges={[]} diffStat={null} />);
    expect(output).toContain('writing');
  });

  it('renders climb feedback', () => {
    const output = renderAndCapture(
      <PhaseProduce elapsed={18} climbFeedback="FAIL: word-count" fileChanges={[]} diffStat={null} />
    );
    expect(output).toContain('climbing');
    expect(output).toContain('word-count');
  });

  it('renders file changes', () => {
    const fileChanges = [{ filePath: 'src/risks.ts', changeType: 'M' as const }];
    const output = renderAndCapture(<PhaseProduce elapsed={5} fileChanges={fileChanges} diffStat={null} />);
    expect(output).toContain('src/risks.ts');
  });
});

describe('PhaseEvaluate', () => {
  it('renders structural results', () => {
    const structural = [
      { criterion: 'contains-heading', pass: true, message: 'Found' },
      { criterion: 'word-count-gte', pass: false, message: '187/250' },
    ];
    const output = renderAndCapture(<PhaseEvaluate structuralResults={structural} customResults={[]} />);
    expect(output).toContain('✓');
    expect(output).toContain('contains-heading');
    expect(output).toContain('✗');
    expect(output).toContain('word-count-gte');
  });
});

describe('FailureDetail', () => {
  it('renders all criteria with pass/fail', () => {
    const results = [
      { criterion: 'heading', pass: true, message: 'Found' },
      { criterion: 'word-count', pass: false, message: '187/250' },
    ];
    const output = renderAndCapture(<FailureDetail results={results} />);
    expect(output).toContain('heading');
    expect(output).toContain('word-count');
    expect(output).toContain('187/250');
  });
});

// --- Two-panel components ---

describe('PanelSeparator', () => {
  it('renders a horizontal line with box-drawing characters', () => {
    const output = renderAndCapture(<PanelSeparator />);
    expect(output).toContain('─');
  });
});

describe('CompletionSummary', () => {
  const mockReport: RunReport = {
    title: 'Test', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z',
    boulders: [], totalBoulders: 3, passedClean: 2, passedAfterClimb: 1, flagged: 0,
  };

  it('renders done text', () => {
    const output = renderAndCapture(
      <CompletionSummary report={mockReport} artifactPath="/out/artifact.md" reportPath="/out/report.json" elapsed={60} />
    );
    expect(output).toContain('done');
  });

  it('shows passed count', () => {
    const output = renderAndCapture(
      <CompletionSummary report={mockReport} artifactPath="/out/artifact.md" reportPath="/out/report.json" elapsed={60} />
    );
    expect(output).toContain('3 passed');
  });

  it('shows flagged count when nonzero', () => {
    const flaggedReport: RunReport = { ...mockReport, passedClean: 1, passedAfterClimb: 0, flagged: 2 };
    const output = renderAndCapture(
      <CompletionSummary report={flaggedReport} artifactPath="/out/artifact.md" reportPath="/out/report.json" elapsed={60} />
    );
    expect(output).toContain('2 flagged');
  });

  it('shows artifact and report paths', () => {
    const output = renderAndCapture(
      <CompletionSummary report={mockReport} artifactPath="/out/artifact.md" reportPath="/out/report.json" elapsed={60} />
    );
    expect(output).toContain('/out/artifact.md');
    expect(output).toContain('/out/report.json');
  });
});

describe('WorkerPanel', () => {
  const idleWorker: WorkerPanelState = {
    agent: null, boulderName: null, fileChanges: [], diffStat: null,
    startedAt: null, structuralResults: null, customResults: null,
    structuralCount: 0, customCount: 0, evaluatePassed: null,
  };

  const sisyphusWorker: WorkerPanelState = {
    agent: 'sisyphus', boulderName: 'features', fileChanges: [],
    diffStat: null, startedAt: Date.now(), structuralResults: null,
    customResults: null, structuralCount: 0, customCount: 0, evaluatePassed: null,
  };

  const hadesWorker: WorkerPanelState = {
    agent: 'hades', boulderName: 'features', fileChanges: [],
    diffStat: null, startedAt: Date.now(), structuralResults: null,
    customResults: null, structuralCount: 0, customCount: 0, evaluatePassed: null,
  };

  it('shows waiting message when agent is null', () => {
    const output = renderAndCapture(
      <WorkerPanel workerPanel={idleWorker} activeBoulder={null} report={null} artifactPath="" reportPath="" elapsed={0} />
    );
    expect(output).toContain('waiting for dispatch');
  });

  it('shows SISYPHUS title bar when agent is sisyphus', () => {
    const output = renderAndCapture(
      <WorkerPanel workerPanel={sisyphusWorker} activeBoulder={null} report={null} artifactPath="" reportPath="" elapsed={0} />
    );
    expect(output).toContain('SISYPHUS');
  });

  it('shows HADES title bar when agent is hades', () => {
    const output = renderAndCapture(
      <WorkerPanel workerPanel={hadesWorker} activeBoulder={null} report={null} artifactPath="" reportPath="" elapsed={0} />
    );
    expect(output).toContain('HADES');
  });

  it('shows CompletionSummary when report is provided', () => {
    const report: RunReport = {
      title: 'Test', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z',
      boulders: [], totalBoulders: 2, passedClean: 2, passedAfterClimb: 0, flagged: 0,
    };
    const output = renderAndCapture(
      <WorkerPanel workerPanel={idleWorker} activeBoulder={null} report={report}
        artifactPath="/out/artifact.md" reportPath="/out/report.json" elapsed={30} />
    );
    expect(output).toContain('done');
    expect(output).toContain('/out/artifact.md');
  });
});

describe('ThanatosPanel', () => {
  const minSpec: Spec = {
    title: 'Migration Report', layer: 'documentation', output: 'report.md',
    boulders: [
      { name: 'intro', description: 'Introduction section', criteria: [{ check: 'contains-heading', description: 'Has heading' }] },
      { name: 'risks', description: 'Risk assessment', criteria: [{ check: 'word-count-gte', description: 'Enough words', min: 100 }] },
      { name: 'summary', description: 'Summary section', criteria: [{ check: 'contains-heading', description: 'Has heading' }] },
    ],
  };

  it('renders header with title and layer', () => {
    const state: UIState = { ...initialUIState, title: 'Migration Report', layer: 'documentation', totalBoulders: 3 };
    const output = renderAndCapture(<ThanatosPanel state={state} spec={minSpec} elapsed={10} />);
    expect(output).toContain('Migration Report');
    expect(output).toContain('documentation');
  });

  it('renders completed boulders', () => {
    const state: UIState = {
      ...initialUIState, title: 'Migration Report', layer: 'documentation', totalBoulders: 3,
      completedBoulders: [{ name: 'intro', status: 'passed', attempts: 1, durationMs: 5000 }],
    };
    const output = renderAndCapture(<ThanatosPanel state={state} spec={minSpec} elapsed={15} />);
    expect(output).toContain('intro');
    expect(output).toContain('✓');
  });

  it('renders active boulder with dispatch log entries', () => {
    const activeBoulder: BoulderUIState = {
      name: 'risks', phase: 'produce', attempt: 0, maxAttempts: 4,
      startedAt: Date.now(), stackFiles: [], fileChanges: [], diffStat: null,
      climbFeedback: undefined, structuralResults: null, customResults: null, results: null,
      dispatchLog: [
        { timestamp: Date.now(), type: 'gathering', message: 'gathering 2 sources...' },
        { timestamp: Date.now(), type: 'gathered', message: '✓ gathered 2 files' },
      ],
    };
    const state: UIState = {
      ...initialUIState, title: 'Migration Report', layer: 'documentation', totalBoulders: 3,
      activeBoulder,
    };
    const output = renderAndCapture(<ThanatosPanel state={state} spec={minSpec} elapsed={20} />);
    expect(output).toContain('risks');
    expect(output).toContain('gathering 2 sources');
    expect(output).toContain('gathered 2 files');
  });

  it('renders pending boulders', () => {
    const state: UIState = { ...initialUIState, title: 'Migration Report', layer: 'documentation', totalBoulders: 3 };
    const output = renderAndCapture(<ThanatosPanel state={state} spec={minSpec} elapsed={5} />);
    expect(output).toContain('intro');
    expect(output).toContain('risks');
    expect(output).toContain('summary');
  });
});
