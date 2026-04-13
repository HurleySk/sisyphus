import React from 'react';
import { Box, Text } from 'ink';
import type { CheckResult } from '../../types.js';

interface FailureDetailProps { results: CheckResult[]; }

export function FailureDetail({ results }: FailureDetailProps) {
  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1}>
      <Text dimColor>EVALUATION RESULTS</Text>
      {results.map((r, i) => (
        <Text key={i}>
          {'  '}<Text color={r.pass ? 'green' : 'red'}>{r.pass ? '✓' : '✗'}</Text>
          {' '}<Text bold={!r.pass}>{r.criterion}</Text> <Text dimColor>{r.message}</Text>
        </Text>
      ))}
    </Box>
  );
}
