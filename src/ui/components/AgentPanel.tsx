import React from 'react';
import { Box, Text } from 'ink';
import type { AgentPanelState } from '../state.js';
import { AgentHeader } from './AgentHeader.js';
import { GatheringBody, SisyphusBody, HadesBody, RetryBody } from './agent-bodies/index.js';

interface AgentPanelProps {
  panel: AgentPanelState;
  elapsed: number;
  mainHeight?: number;
  columns?: number;
}

export function AgentPanel({ panel, elapsed, mainHeight, columns }: AgentPanelProps) {
  const separatorWidth = columns ?? 54;
  const bodyHeight = (mainHeight ?? 20) - 2; // subtract header (1 line) + separator (1 line)

  if (panel.agent === 'idle') {
    return <Text dimColor>waiting for dispatch...</Text>;
  }

  if (panel.agent === 'done') {
    return null;
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
