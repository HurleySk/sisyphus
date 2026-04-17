import React from 'react';
import { Box, Text } from 'ink';
import type { AgentPanelState } from '../../state.js';
import { sliceViewport } from '../../format.js';

export function RetryBody({ panel, viewportHeight }: { panel: AgentPanelState; viewportHeight: number }) {
  const lastRetry = panel.retryHistory[panel.retryHistory.length - 1];
  const checks = lastRetry?.failedChecks ?? [];
  const { visible: visibleChecks, overflowCount } = sliceViewport(checks, viewportHeight, 3);

  return (
    <Box flexDirection="column">
      {overflowCount > 0 && <Text dimColor>  ↑ {overflowCount} more checks</Text>}
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
