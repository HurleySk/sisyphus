// src/ui/App.tsx
import React from 'react';
import { Box } from 'ink';
import type { TypedEmitter, SisyphusEvents } from '../events.js';
import type { Spec } from '../types.js';
import { useEngine } from './hooks/useEngine.js';
import { useElapsed } from './hooks/useElapsed.js';
import { ThanatosPanel } from './components/ThanatosPanel.js';
import { PanelSeparator } from './components/PanelSeparator.js';
import { WorkerPanel } from './components/WorkerPanel.js';

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

  return (
    <Box flexDirection="column">
      <ThanatosPanel state={state} spec={spec} elapsed={elapsed} />
      <PanelSeparator />
      <WorkerPanel
        workerPanel={state.workerPanel}
        activeBoulder={state.activeBoulder}
        report={state.report}
        artifactPath={artifactPath}
        reportPath={reportPath}
        elapsed={elapsed}
      />
    </Box>
  );
}
