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
  columns?: number;
}

function BoulderSummary({ boulder, report }: { boulder: CompletedBoulder; report: RunReport }) {
  const icon = boulder.status === 'flagged' ? '✗' : '✓';
  const iconColor = boulder.status === 'flagged' ? 'red' : boulder.attempts > 1 ? 'yellow' : 'green';
  const attemptLabel = boulder.attempts === 1 ? '1 attempt' : `${boulder.attempts} attempts`;
  const reportBoulder = report.boulders.find(b => b.name === boulder.name);
  const wordCount = reportBoulder?.content?.split(/\s+/).filter(Boolean).length ?? 0;

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
      {wordCount > 0 && (
        <Text dimColor>      produced {wordCount} words</Text>
      )}
      {boulder.retryHistory?.map((retry, i) => (
        <Text key={i} color="yellow">
          {'      '}attempt {retry.attempt + 1}: ✗ {retry.failedChecks.join(', ')} → retried
        </Text>
      ))}
    </Box>
  );
}

export function CompletionSummary({ report, completedBoulders, artifactPath, reportPath, elapsed, columns }: CompletionSummaryProps) {
  const passed = report.passedClean + report.passedAfterClimb;
  const flagged = report.flagged;
  const separatorWidth = columns ?? 54;

  const sortedBoulders = [...completedBoulders].sort((a, b) => {
    if (a.status === 'flagged' && b.status !== 'flagged') return -1;
    if (a.status !== 'flagged' && b.status === 'flagged') return 1;
    return 0;
  });

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="green" bold>DONE</Text>
        {' · '}{passed} passed{flagged > 0 ? <Text color="red"> · {flagged} flagged</Text> : ''}
        {' · '}{formatElapsed(elapsed)}
      </Text>
      <Text dimColor>{'━'.repeat(separatorWidth)}</Text>
      {sortedBoulders.map((b, i) => (
        <React.Fragment key={b.name}>
          {i > 0 && <Text />}
          <BoulderSummary boulder={b} report={report} />
        </React.Fragment>
      ))}
      <Text />
      <Text dimColor>  artifact → {artifactPath}</Text>
      <Text dimColor>  report   → {reportPath}</Text>
    </Box>
  );
}
