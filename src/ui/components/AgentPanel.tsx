import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentPanelState } from '../state.js';
import type { CheckResult } from '../../types.js';
import { AgentHeader } from './AgentHeader.js';
import { elapsedSeconds } from '../hooks/useElapsed.js';
import { formatElapsed } from '../format.js';

interface AgentPanelProps {
  panel: AgentPanelState;
  elapsed: number;
  mainHeight?: number;
  columns?: number;
}

function GatheringBody({ panel, viewportHeight }: { panel: AgentPanelState; viewportHeight: number }) {
  const totalLines = panel.stackFiles.reduce((sum, f) => sum + f.lines, 0);
  const budget = Math.max(viewportHeight - 2, 3); // reserve for spinner + summary
  const hasMore = panel.stackFiles.length > budget;
  const maxItems = hasMore ? budget - 1 : budget;
  const visibleFiles = panel.stackFiles.slice(-maxItems);

  return (
    <Box flexDirection="column">
      {hasMore && <Text dimColor>  ↑ {panel.stackFiles.length - maxItems} more files</Text>}
      {visibleFiles.map((f, i) => (
        <Text key={i}>
          {'  '}<Text color="green">✓</Text> {f.path}
          <Text dimColor>{' '.repeat(Math.max(1, 40 - f.path.length))}{f.lines} lines</Text>
          {f.summarized && <Text color="yellow"> · summarized</Text>}
        </Text>
      ))}
      <Text>  <Spinner type="dots" /> gathering sources...</Text>
      {panel.stackFiles.length > 0 && (
        <Text dimColor>  {panel.stackFiles.length} files · {totalLines} lines total</Text>
      )}
    </Box>
  );
}

function SisyphusBody({ panel, viewportHeight }: { panel: AgentPanelState; viewportHeight: number }) {
  // No useElapsed here — parent App ticks once/sec via useTick(), which re-renders this component
  const statusElapsed = panel.producerStatusStartedAt !== null ? elapsedSeconds(panel.producerStatusStartedAt) : 0;
  const elapsedLabel = panel.producerStatusStartedAt !== null ? ` ${formatElapsed(statusElapsed)}` : '';

  if (panel.producerStatus === 'idle' || panel.producerStatus === 'thinking') {
    const label = panel.producerStatus === 'idle' ? 'starting' : 'reasoning';
    return (
      <Box flexDirection="column">
        <Text>  <Spinner type="dots" /> {label}...{elapsedLabel}</Text>
        {panel.boulderDescription && (
          <>
            <Text />
            <Text dimColor>  {panel.boulderDescription}</Text>
          </>
        )}
        {panel.criteriaDescriptions.length > 0 && (
          <>
            <Text />
            <Text dimColor>  criteria:</Text>
            {panel.criteriaDescriptions.map((desc, i) => (
              <Text key={i} dimColor>    ○ {desc}</Text>
            ))}
          </>
        )}
        {panel.climbFeedback && (
          <>
            <Text />
            <Text color="yellow">  feedback from last attempt:</Text>
            <Text color="yellow">    {panel.climbFeedback}</Text>
          </>
        )}
      </Box>
    );
  }

  // Streaming — show lines with viewport windowing
  const budget = Math.max(viewportHeight - 2, 3);
  const hasMore = panel.streamingLines.length > budget;
  const maxLines = hasMore ? budget - 1 : budget;
  const visibleLines = panel.streamingLines.slice(-maxLines);

  return (
    <Box flexDirection="column">
      {hasMore && <Text dimColor>  ↑ {panel.streamingLines.length - maxLines} more lines</Text>}
      {visibleLines.map((line, i) => (
        <Text key={i}>  {line}</Text>
      ))}
      <Text>
        {'  '}<Spinner type="dots" /> writing...{elapsedLabel}
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

function HadesBody({ panel, viewportHeight }: { panel: AgentPanelState; viewportHeight: number }) {
  const structural = panel.structuralResults ?? [];
  const custom = panel.customResults ?? [];
  const allResults = [...structural, ...custom];
  const totalReceived = allResults.length;
  const allDone = panel.checkCount > 0 && totalReceived >= panel.checkCount;
  const showSpinner = !allDone;
  const budget = Math.max(viewportHeight - (showSpinner ? 1 : 0), 3); // reserve for spinner if showing
  const hasMore = allResults.length > budget;
  const maxItems = hasMore ? budget - 1 : budget; // reserve 1 line for indicator when overflowing
  const visibleResults = allResults.slice(-maxItems);

  return (
    <Box flexDirection="column">
      {hasMore && <Text dimColor>  ↑ {allResults.length - maxItems} more checks</Text>}
      {visibleResults.map((r, i) => <ResultLine key={i} result={r} />)}
      {showSpinner && (
        <Text>  <Spinner type="dots" /> {structural.length > 0 ? 'evaluating custom criteria...' : 'evaluating...'}</Text>
      )}
    </Box>
  );
}

function RetryBody({ panel, viewportHeight }: { panel: AgentPanelState; viewportHeight: number }) {
  const lastRetry = panel.retryHistory[panel.retryHistory.length - 1];
  const checks = lastRetry?.failedChecks ?? [];
  const budget = Math.max(viewportHeight - 3, 2); // reserve for feedback, blank, restarting lines
  const hasMore = checks.length > budget;
  const maxItems = hasMore ? budget - 1 : budget; // reserve 1 line for indicator when overflowing
  const visibleChecks = checks.slice(-maxItems);

  return (
    <Box flexDirection="column">
      {hasMore && <Text dimColor>  ↑ {checks.length - maxItems} more checks</Text>}
      {visibleChecks.map((check, i) => (
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

export function AgentPanel({ panel, elapsed, mainHeight, columns }: AgentPanelProps) {
  const separatorWidth = columns ?? 54;
  const bodyHeight = (mainHeight ?? 20) - 2; // subtract header (1 line) + separator (1 line)

  if (panel.agent === 'idle') {
    return <Text dimColor>waiting for dispatch...</Text>;
  }

  return (
    <Box flexDirection="column" height={mainHeight}>
      <AgentHeader
        agent={panel.agent}
        boulderName={panel.boulderName}
        attempt={panel.attempt}
        maxAttempts={panel.maxAttempts}
        elapsed={elapsed}
        checkCount={panel.checkCount}
        sourceCount={panel.sourceCount}
      />
      <Text dimColor>{'─'.repeat(separatorWidth)}</Text>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {panel.agent === 'gathering' && <GatheringBody panel={panel} viewportHeight={bodyHeight} />}
        {panel.agent === 'sisyphus' && <SisyphusBody panel={panel} viewportHeight={bodyHeight} />}
        {panel.agent === 'hades' && <HadesBody panel={panel} viewportHeight={bodyHeight} />}
        {panel.agent === 'retry' && <RetryBody panel={panel} viewportHeight={bodyHeight} />}
      </Box>
    </Box>
  );
}
