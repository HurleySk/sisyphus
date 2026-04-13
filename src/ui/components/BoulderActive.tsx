import React from 'react';
import { Box, Text } from 'ink';
import type { BoulderUIState } from '../state.js';
import { PhaseStack } from './PhaseStack.js';
import { PhaseProduce } from './PhaseProduce.js';
import { PhaseEvaluate } from './PhaseEvaluate.js';
import { FailureDetail } from './FailureDetail.js';
import { useElapsed } from '../hooks/useElapsed.js';

interface BoulderActiveProps { boulder: BoulderUIState; }

export function BoulderActive({ boulder }: BoulderActiveProps) {
  const elapsed = useElapsed(boulder.startedAt);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1}>
      <Box>
        <Text bold>{boulder.name}</Text>
        <Text dimColor> — attempt {boulder.attempt + 1}/{boulder.maxAttempts}</Text>
      </Box>
      {boulder.phase === 'stack' && <PhaseStack files={boulder.stackFiles} />}
      {boulder.phase === 'produce' && (
        <PhaseProduce elapsed={elapsed} climbFeedback={boulder.climbFeedback}
          fileChanges={boulder.fileChanges} diffStat={boulder.diffStat} />
      )}
      {boulder.phase === 'evaluate' && (
        <PhaseEvaluate structuralResults={boulder.structuralResults} customResults={boulder.customResults} />
      )}
      {boulder.phase === 'failed' && <FailureDetail results={boulder.results ?? []} />}
    </Box>
  );
}
