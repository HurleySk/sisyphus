import React from 'react';
import { Box, Text } from 'ink';
import type { RunReport } from '../../types.js';
import type { WorkerPanelState, BoulderUIState } from '../state.js';
import { useElapsed } from '../hooks/useElapsed.js';
import { PhaseProduce } from './PhaseProduce.js';
import { PhaseEvaluate } from './PhaseEvaluate.js';
import { CompletionSummary } from './CompletionSummary.js';

interface WorkerPanelProps {
  workerPanel: WorkerPanelState;
  activeBoulder: BoulderUIState | null;
  report: RunReport | null;
  artifactPath: string;
  reportPath: string;
  elapsed: number;
}

function SisyphusWorker({ workerPanel, activeBoulder }: { workerPanel: WorkerPanelState; activeBoulder: BoulderUIState | null }) {
  const workerElapsed = useElapsed(workerPanel.startedAt);
  const boulderName = workerPanel.boulderName ?? 'unknown';
  const attempt = activeBoulder ? activeBoulder.attempt + 1 : 1;

  return (
    <Box flexDirection="column">
      <Text bold color="magenta">SISYPHUS · producer · spawned by T2</Text>
      <Text dimColor>
        boulder: {boulderName} · attempt {attempt}
        {workerPanel.climbFeedback ? ` · climb: "${workerPanel.climbFeedback}"` : ''}
      </Text>
      <PhaseProduce
        elapsed={workerElapsed}
        climbFeedback={workerPanel.climbFeedback}
        fileChanges={workerPanel.fileChanges}
        diffStat={workerPanel.diffStat}
      />
    </Box>
  );
}

function HadesWorker({ workerPanel }: { workerPanel: WorkerPanelState }) {
  const boulderName = workerPanel.boulderName ?? 'unknown';

  return (
    <Box flexDirection="column">
      <Text bold color="red">HADES · evaluator · spawned by T2</Text>
      <Text dimColor>boulder: {boulderName} · sees: output, criteria</Text>
      <PhaseEvaluate
        structuralResults={workerPanel.structuralResults}
        customResults={workerPanel.customResults}
      />
    </Box>
  );
}

export function WorkerPanel({ workerPanel, activeBoulder, report, artifactPath, reportPath, elapsed }: WorkerPanelProps) {
  if (report) {
    return <CompletionSummary report={report} artifactPath={artifactPath} reportPath={reportPath} elapsed={elapsed} />;
  }

  if (workerPanel.agent === 'sisyphus') {
    return <SisyphusWorker workerPanel={workerPanel} activeBoulder={activeBoulder} />;
  }

  if (workerPanel.agent === 'hades') {
    return <HadesWorker workerPanel={workerPanel} />;
  }

  return <Text dimColor>waiting for dispatch...</Text>;
}
