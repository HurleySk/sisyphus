import React from 'react';
import { Box, Text } from 'ink';
import type { AgentMode } from '../state.js';

interface AgentHeaderProps {
  agent: AgentMode;
  boulderName: string | null;
  attempt: number;
  maxAttempts: number;
  elapsed: number;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

const agentConfig: Record<AgentMode, { label: string; color: string }> = {
  idle: { label: '', color: 'dim' },
  gathering: { label: 'GATHERING', color: 'cyan' },
  sisyphus: { label: 'SISYPHUS', color: 'magenta' },
  hades: { label: 'HADES', color: 'red' },
  retry: { label: 'RETRY', color: 'yellow' },
  done: { label: 'DONE', color: 'green' },
};

export function AgentHeader({ agent, boulderName, attempt, maxAttempts, elapsed }: AgentHeaderProps) {
  const config = agentConfig[agent];
  if (agent === 'idle') return null;

  const showAttempt = agent === 'sisyphus' || agent === 'retry';
  const sublabel = agent === 'hades' ? ' · evaluating' : '';

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
