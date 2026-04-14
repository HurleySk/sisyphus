import React from 'react';
import { Box, Text } from 'ink';
import type { RunReport } from '../../types.js';
import type { CompletedBoulder } from '../state.js';
import { formatElapsed, formatDuration } from '../format.js';

interface CompletionSummaryProps {
  report: RunReport;
  completedBoulders: CompletedBoulder[];
  artifactPath: string;
  reportPath: string;
  elapsed: number;
}

function BoulderSummary({ boulder }: { boulder: CompletedBoulder }) {
  const icon = boulder.status === 'flagged' ? '✗' : '✓';
  const iconColor = boulder.status === 'flagged' ? 'red' : boulder.attempts > 1 ? 'yellow' : 'green';
  const attemptLabel = boulder.attempts === 1 ? '1 attempt' : `${boulder.attempts} attempts`;

  return (
    <Box flexDirection="column">
      <Text>
        {'  '}<Text color={iconColor}>{icon}</Text> {boulder.name} · {attemptLabel} · {formatDuration(boulder.durationMs)}
      </Text>
      {boulder.results && boulder.results.length > 0 && (
        <Text>
          {'      '}
          {boulder.results.map((r, i) => (
            <Text key={i}>
              <Text color={r.pass ? 'green' : 'red'}>{r.pass ? '✓' : '✗'}</Text>
              {' '}{r.criterion}
              {i < boulder.results!.length - 1 ? '  ' : ''}
            </Text>
          ))}
        </Text>
      )}
      {boulder.status === 'flagged' && boulder.failures && boulder.failures.length > 0 && (
        <Box flexDirection="column">
          {boulder.failures.map((f, i) => (
            <Text key={i} color="red">      ✗ {f.criterion}  {f.message}</Text>
          ))}
        </Box>
      )}
      {boulder.attempts > 1 && boulder.failures && boulder.failures.length > 0 && boulder.status === 'passed' && (
        <Text dimColor>      attempt {boulder.attempts - 1}: ✗ {boulder.failures.map(f => f.criterion).join(', ')} → retried</Text>
      )}
    </Box>
  );
}

export function CompletionSummary({ report, completedBoulders, artifactPath, reportPath, elapsed }: CompletionSummaryProps) {
  const passed = report.passedClean + report.passedAfterClimb;
  const flagged = report.flagged;

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="green" bold>DONE</Text>
        {' · '}{passed} passed{flagged > 0 ? <Text color="red"> · {flagged} flagged</Text> : ''}
        {' · '}{formatElapsed(elapsed)}
      </Text>
      <Text dimColor>{'─'.repeat(54)}</Text>
      {completedBoulders.map((b) => (
        <BoulderSummary key={b.name} boulder={b} />
      ))}
      <Text />
      <Text dimColor>  artifact → {artifactPath}</Text>
      <Text dimColor>  report   → {reportPath}</Text>
    </Box>
  );
}
