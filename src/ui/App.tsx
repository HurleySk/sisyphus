import React from 'react';
import { Box, Static, Text, useWindowSize, useInput, useApp } from 'ink';
import type { TypedEmitter, SisyphusEvents } from '../events.js';
import type { Spec } from '../types.js';
import { useEngine } from './hooks/useEngine.js';
import { useTick, elapsedSeconds } from './hooks/useElapsed.js';
import { AgentPanel } from './components/AgentPanel.js';
import { agentConfig } from './components/AgentHeader.js';
import { CompletionSummary } from './components/CompletionSummary.js';
import { StatusBar } from './components/StatusBar.js';
import type { AgentMode } from './state.js';

export const MAX_VISIBLE_PHASES = 6;

function agentColor(agent: AgentMode): string {
  return agentConfig[agent].color;
}

export interface AppProps {
  emitter: TypedEmitter<SisyphusEvents>;
  spec: Spec;
  startTime: number;
  artifactPath: string;
  reportPath: string;
}

export function App({ emitter, spec, startTime, artifactPath, reportPath }: AppProps) {
  const state = useEngine(emitter);
  useTick(); // single 1s interval drives all elapsed values
  const elapsed = startTime ? elapsedSeconds(startTime) : 0;
  const agentElapsed = state.agentPanel.startedAt ? elapsedSeconds(state.agentPanel.startedAt) : 0;
  const boulderElapsed = state.activeBoulder?.startedAt ? elapsedSeconds(state.activeBoulder.startedAt) : 0;
  const { columns, rows } = useWindowSize();
  const { exit } = useApp();
  const STATUS_BAR_HEIGHT = 3;
  const KEY_HINT_HEIGHT = 1;

  const evictedRef = React.useRef(0);
  const [expanded, setExpanded] = React.useState(false);

  useInput((input, _key) => {
    if (input === 'v') {
      setExpanded(prev => !prev);
    }
    if (input === 'q') {
      exit();
    }
  });

  // Synchronous eviction — no useEffect, no two-phase render flicker
  if (!expanded) {
    const surplus = state.phaseHistory.length - MAX_VISIBLE_PHASES;
    if (surplus > evictedRef.current) {
      evictedRef.current = surplus;
    }
  }
  const evictedCount = evictedRef.current;

  const evicted = state.phaseHistory.slice(0, evictedCount);
  const recentStart = expanded ? 0 : evictedCount;
  const recent = state.phaseHistory.slice(recentStart);

  const visibleHistoryLines = recent.length + (!expanded && evictedCount > 0 ? 1 : 0);
  const headerLines = state.title ? 2 : 0;
  const mainHeight = Math.max(rows - STATUS_BAR_HEIGHT - KEY_HINT_HEIGHT - visibleHistoryLines - headerLines, 5);

  const pendingNames = spec.boulders
    .filter(b =>
      !state.completedBoulders.some(c => c.name === b.name) &&
      state.activeBoulder?.name !== b.name,
    )
    .map(b => b.name);

  const isComplete = state.report !== null;

  const activePhase = (() => {
    if (state.agentPanel.agent === 'gathering') return 'gathering';
    if (state.agentPanel.agent === 'hades') return 'evaluating';
    if (state.agentPanel.agent === 'retry') return 'retrying';
    if (state.agentPanel.agent === 'sisyphus') {
      if (state.agentPanel.producerStatus === 'thinking') return 'reasoning';
      if (state.agentPanel.producerStatus === 'streaming') return 'writing';
      return 'starting';
    }
    return null;
  })();

  const headerSeparator = '╌'.repeat(columns ?? 54);

  return (
    <Box flexDirection="column">
      {state.title && (
        <>
          <Text>
            <Text bold color="white">{state.title}</Text>
            <Text dimColor> · {state.layer} · {state.totalBoulders} boulder{state.totalBoulders !== 1 ? 's' : ''}</Text>
          </Text>
          <Text dimColor>{headerSeparator}</Text>
        </>
      )}
      <Static items={evicted}>
        {(entry, i) => (
          <Text key={i} dimColor>
            <Text color={agentColor(entry.agent)}>{entry.agent.toUpperCase()}</Text>
            {' \u00b7 '}{entry.boulderName}{' \u00b7 '}{entry.summary}
          </Text>
        )}
      </Static>
      {!expanded && recent.length > 0 && evictedCount > 0 && (
        <Text dimColor>  ↑ {evictedCount} earlier phases</Text>
      )}
      {recent.map((entry, i) => (
        <Text key={evictedCount + i} dimColor>
          <Text color={agentColor(entry.agent)}>{entry.agent.toUpperCase()}</Text>
          {' · '}{entry.boulderName}{' · '}{entry.summary}
        </Text>
      ))}
      <Box flexDirection="column" flexGrow={1}>
        {isComplete ? (
          <CompletionSummary
            report={state.report!}
            completedBoulders={state.completedBoulders}
            artifactPath={artifactPath}
            reportPath={reportPath}
            elapsed={elapsed}
            columns={columns}
          />
        ) : (
          <AgentPanel panel={state.agentPanel} elapsed={agentElapsed} mainHeight={mainHeight} columns={columns} />
        )}
      </Box>
      <StatusBar
        completed={state.completedBoulders}
        activeBoulderName={state.activeBoulder?.name ?? null}
        boulderElapsed={boulderElapsed}
        pendingNames={pendingNames}
        total={state.totalBoulders || spec.boulders.length}
        elapsed={elapsed}
        columns={columns}
        activePhase={activePhase}
      />
      <Text dimColor>  v: {expanded ? 'collapse' : 'expand'} history · q: quit</Text>
    </Box>
  );
}
