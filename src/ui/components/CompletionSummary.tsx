import React from 'react';
import { Box, Text } from 'ink';
import type { RunReport } from '../../types.js';
import { formatElapsed } from './Header.js';

interface CompletionSummaryProps {
  report: RunReport;
  artifactPath: string;
  reportPath: string;
  elapsed: number;
}

export function CompletionSummary({ report, artifactPath, reportPath, elapsed }: CompletionSummaryProps) {
  const passed = report.passedClean + report.passedAfterClimb;
  const flagged = report.flagged;

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="green" bold>done</Text>
        {' · '}{passed} passed{flagged > 0 ? ` · ${flagged} flagged` : ''}
        {' · '}{formatElapsed(elapsed)}
      </Text>
      <Text dimColor>artifact → {artifactPath}</Text>
      <Text dimColor>report  → {reportPath}</Text>
    </Box>
  );
}
