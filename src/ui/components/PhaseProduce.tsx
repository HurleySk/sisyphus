import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { FileChangeEntry } from '../state.js';

interface PhaseProduceProps {
  elapsed: number;
  climbFeedback?: string;
  fileChanges: FileChangeEntry[];
  diffStat: string | null;
}

export function PhaseProduce({ elapsed, climbFeedback, fileChanges, diffStat }: PhaseProduceProps) {
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text dimColor>PRODUCE</Text>
      <Text>
        {'  '}<Text color="magenta"><Spinner type="dots" /></Text>
        {' '}Sisyphus writing... <Text dimColor>{elapsed}s</Text>
      </Text>
      {climbFeedback && (
        <Text color="yellow">    climbing: {climbFeedback}</Text>
      )}
      {diffStat ? (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Text dimColor>FILES CHANGED</Text>
          {diffStat.split('\n').map((line, i) => (
            <Text key={i} dimColor>  {line}</Text>
          ))}
        </Box>
      ) : fileChanges.length > 0 ? (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Text dimColor>FILES CHANGED</Text>
          {fileChanges.map((f, i) => (
            <Text key={i}>{'  '}<Text dimColor>{f.changeType}</Text> {f.filePath}</Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
