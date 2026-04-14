import React from 'react';
import { Box } from 'ink';
import type { TypedEmitter, SisyphusEvents } from '../events.js';
import type { Spec } from '../types.js';
import { useEngine } from './hooks/useEngine.js';
import { useElapsed } from './hooks/useElapsed.js';
import { AgentPanel } from './components/AgentPanel.js';
import { CompletionSummary } from './components/CompletionSummary.js';
import { StatusBar } from './components/StatusBar.js';

export interface AppProps {
  emitter: TypedEmitter<SisyphusEvents>;
  spec: Spec;
  startTime: number;
  artifactPath: string;
  reportPath: string;
}

export function App({ emitter, spec, startTime, artifactPath, reportPath }: AppProps) {
  const state = useEngine(emitter);
  const elapsed = useElapsed(startTime);

  const pendingNames = spec.boulders
    .filter(b =>
      !state.completedBoulders.some(c => c.name === b.name) &&
      state.activeBoulder?.name !== b.name,
    )
    .map(b => b.name);

  const isComplete = state.report !== null;

  return (
    <Box flexDirection="column">
      {isComplete ? (
        <CompletionSummary
          report={state.report!}
          completedBoulders={state.completedBoulders}
          artifactPath={artifactPath}
          reportPath={reportPath}
          elapsed={elapsed}
        />
      ) : (
        <AgentPanel panel={state.agentPanel} elapsed={elapsed} />
      )}
      <StatusBar
        completed={state.completedBoulders}
        activeBoulderName={state.activeBoulder?.name ?? null}
        pendingNames={pendingNames}
        total={state.totalBoulders || spec.boulders.length}
        elapsed={elapsed}
      />
    </Box>
  );
}
