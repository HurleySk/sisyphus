import React from 'react';
import { Box, Static, Text, useWindowSize, useInput } from 'ink';
import type { TypedEmitter, SisyphusEvents } from '../events.js';
import type { Spec } from '../types.js';
import type { AgentMode } from './state.js';
import { useEngine } from './hooks/useEngine.js';
import { useElapsed } from './hooks/useElapsed.js';
import { AgentPanel } from './components/AgentPanel.js';
import { CompletionSummary } from './components/CompletionSummary.js';
import { StatusBar } from './components/StatusBar.js';

export const MAX_VISIBLE_PHASES = 6;

function agentColor(agent: AgentMode): string {
  const colors: Record<AgentMode, string> = {
    idle: 'gray',
    gathering: 'cyan',
    sisyphus: 'magenta',
    hades: 'red',
    retry: 'yellow',
    done: 'green',
  };
  return colors[agent];
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
  const elapsed = useElapsed(startTime);
  const agentElapsed = useElapsed(state.agentPanel.startedAt);
  const boulderElapsed = useElapsed(state.activeBoulder?.startedAt ?? null);
  const { columns, rows } = useWindowSize();
  const STATUS_BAR_HEIGHT = 3;
  const KEY_HINT_HEIGHT = 1;

  const [evictedCount, setEvictedCount] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);

  useInput((input, _key) => {
    if (input === 'v') {
      setExpanded(prev => !prev);
    }
    if (input === 'q') {
      process.exit(0);
    }
  });

  React.useEffect(() => {
    if (expanded) return;
    const surplus = state.phaseHistory.length - MAX_VISIBLE_PHASES;
    if (surplus > evictedCount) {
      setEvictedCount(surplus);
    }
  }, [state.phaseHistory.length, evictedCount, expanded]);

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
