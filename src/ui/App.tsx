// src/ui/App.tsx
import React from 'react';
import { Static, Box } from 'ink';
import type { TypedEmitter, SisyphusEvents } from '../events.js';
import type { Spec } from '../types.js';
import { useEngine } from './hooks/useEngine.js';
import { useElapsed } from './hooks/useElapsed.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { BoulderActive } from './components/BoulderActive.js';
import { BoulderCompleted } from './components/BoulderCompleted.js';
import { BoulderPending } from './components/BoulderPending.js';

interface AppProps {
  emitter: TypedEmitter<SisyphusEvents>;
  spec: Spec;
  startTime: number;
}

export function App({ emitter, spec, startTime }: AppProps) {
  const state = useEngine(emitter);
  const elapsed = useElapsed(startTime);

  const title = state.title || spec.title;
  const layer = state.layer || spec.layer;
  const total = state.totalBoulders || spec.boulders.length;

  return (
    <Box flexDirection="column">
      <Header title={title} layer={layer} elapsed={elapsed} />
      <Static items={state.completedBoulders}>
        {(boulder) => (
          <BoulderCompleted
            key={boulder.name}
            name={boulder.name}
            status={boulder.status}
            attempts={boulder.attempts}
            durationMs={boulder.durationMs}
            failures={boulder.failures}
          />
        )}
      </Static>
      {state.activeBoulder && <BoulderActive boulder={state.activeBoulder} />}
      {spec.boulders
        .filter(b =>
          !state.completedBoulders.some(c => c.name === b.name) &&
          state.activeBoulder?.name !== b.name
        )
        .map(b => <BoulderPending key={b.name} name={b.name} />)
      }
      <Footer completed={state.completedBoulders.length} total={total} elapsed={elapsed} />
    </Box>
  );
}
