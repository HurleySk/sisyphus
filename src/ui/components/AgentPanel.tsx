import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentPanelState } from '../state.js';
import type { CheckResult } from '../../types.js';
import { AgentHeader } from './AgentHeader.js';

interface AgentPanelProps {
  panel: AgentPanelState;
  elapsed: number;
}

function GatheringBody({ panel }: { panel: AgentPanelState }) {
  return (
    <Box flexDirection="column">
      {panel.stackFiles.map((f, i) => (
        <Text key={i}>
          {'  '}reading {f.path}
          <Text dimColor>{' '.repeat(Math.max(1, 40 - f.path.length))}{f.lines} lines</Text>
          {f.summarized && <Text dimColor> · summarized</Text>}
        </Text>
      ))}
      {panel.stackFiles.length === 0 && (
        <Text>  <Spinner type="dots" /> gathering sources...</Text>
      )}
    </Box>
  );
}

function SisyphusBody({ panel }: { panel: AgentPanelState }) {
  return (
    <Box flexDirection="column">
      {panel.streamingLines.map((line, i) => (
        <Text key={i}>  {line}</Text>
      ))}
      <Text>
        {'  '}<Spinner type="dots" /> writing...
      </Text>
    </Box>
  );
}

function ResultLine({ result }: { result: CheckResult }) {
  return (
    <Text>
      {'  '}<Text color={result.pass ? 'green' : 'red'}>{result.pass ? '✓' : '✗'}</Text>
      {' '}{result.criterion}
      <Text dimColor>    {result.message}</Text>
    </Text>
  );
}

function HadesBody({ panel }: { panel: AgentPanelState }) {
  const structural = panel.structuralResults ?? [];
  const custom = panel.customResults ?? [];
  const waitingForCustom = structural.length > 0 && custom.length === 0;
  return (
    <Box flexDirection="column">
      {structural.map((r, i) => <ResultLine key={`s-${i}`} result={r} />)}
      {waitingForCustom && (
        <Text>  <Spinner type="dots" /> evaluating custom criteria...</Text>
      )}
      {custom.map((r, i) => <ResultLine key={`c-${i}`} result={r} />)}
    </Box>
  );
}

function RetryBody({ panel }: { panel: AgentPanelState }) {
  const lastRetry = panel.retryHistory[panel.retryHistory.length - 1];
  return (
    <Box flexDirection="column">
      {lastRetry?.failedChecks.map((check, i) => (
        <Text key={i} color="red">  ✗ {check}</Text>
      ))}
      {panel.climbFeedback && (
        <Text color="yellow">  feedback: &quot;{panel.climbFeedback}&quot;</Text>
      )}
      <Text />
      <Text dimColor>  restarting sisyphus...</Text>
    </Box>
  );
}

export function AgentPanel({ panel, elapsed }: AgentPanelProps) {
  if (panel.agent === 'idle') {
    return <Text dimColor>waiting for dispatch...</Text>;
  }

  return (
    <Box flexDirection="column">
      <AgentHeader
        agent={panel.agent}
        boulderName={panel.boulderName}
        attempt={panel.attempt}
        maxAttempts={panel.maxAttempts}
        elapsed={elapsed}
      />
      <Text dimColor>{'─'.repeat(54)}</Text>
      {panel.agent === 'gathering' && <GatheringBody panel={panel} />}
      {panel.agent === 'sisyphus' && <SisyphusBody panel={panel} />}
      {panel.agent === 'hades' && <HadesBody panel={panel} />}
      {panel.agent === 'retry' && <RetryBody panel={panel} />}
    </Box>
  );
}
