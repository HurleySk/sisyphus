import React from 'react';
import { Box, Text } from 'ink';
import type { AgentMode } from '../state.js';
import { formatElapsed } from '../format.js';

interface AgentHeaderProps {
  agent: AgentMode;
  boulderName: string | null;
  attempt: number;
  maxAttempts: number;
  elapsed: number;
  checkCount?: number;
  sourceCount?: number;
}

export const agentConfig: Record<AgentMode, { label: string; color: string }> = {
  idle: { label: '', color: 'dim' },
  gathering: { label: 'GATHERING', color: 'cyan' },
  sisyphus: { label: 'SISYPHUS', color: 'magenta' },
  hades: { label: 'HADES', color: 'red' },
  retry: { label: 'RETRY', color: 'yellow' },
  done: { label: 'DONE', color: 'green' },
};

export function AgentHeader({ agent, boulderName, attempt, maxAttempts, elapsed, checkCount, sourceCount }: AgentHeaderProps) {
  const config = agentConfig[agent];
  if (agent === 'idle') return null;

  const showAttempt = agent === 'sisyphus' || agent === 'retry';
  let sublabel = '';
  if (agent === 'hades' && checkCount) {
    sublabel = ` · evaluating ${checkCount} checks`;
  } else if (agent === 'hades') {
    sublabel = ' · evaluating';
  } else if (agent === 'gathering' && sourceCount) {
    sublabel = ` · ${sourceCount} sources`;
  }

  return (
    <Box>
      <Text bold color={config.color}>{config.label}</Text>
      {boulderName && <Text> · {boulderName}</Text>}
      {sublabel && <Text>{sublabel}</Text>}
      {showAttempt && <Text> · attempt {attempt + 1}</Text>}
      <Text>{'  '}</Text>
      <Text dimColor>{formatElapsed(elapsed)}</Text>
    </Box>
  );
}
