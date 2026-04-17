import React from 'react';
import { Box, Text } from 'ink';
import type { AgentMode } from '../state.js';
import { formatElapsed } from '../format.js';
import { AGENT_CONFIG } from '../constants.js';

interface AgentHeaderProps {
  agent: AgentMode;
  boulderName: string | null;
  attempt: number;
  maxAttempts: number;
  elapsed: number;
  checkCount?: number;
  sourceCount?: number;
}

export function AgentHeader({ agent, boulderName, attempt, maxAttempts, elapsed, checkCount, sourceCount }: AgentHeaderProps) {
  const config = AGENT_CONFIG[agent];
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
