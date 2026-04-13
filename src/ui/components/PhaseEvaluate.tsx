import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { CheckResult } from '../../types.js';

interface PhaseEvaluateProps {
  structuralResults: CheckResult[] | null;
  customResults: CheckResult[] | null;
}

function ResultLine({ result }: { result: CheckResult }) {
  return (
    <Text>
      {'  '}<Text color={result.pass ? 'green' : 'red'}>{result.pass ? '✓' : '✗'}</Text>
      {' '}{result.criterion} <Text dimColor>{result.message}</Text>
    </Text>
  );
}

export function PhaseEvaluate({ structuralResults, customResults }: PhaseEvaluateProps) {
  const structural = structuralResults ?? [];
  const custom = customResults ?? [];
  const waitingForCustom = structural.length > 0 && custom.length === 0;
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text dimColor>EVALUATE</Text>
      {structural.map((r, i) => <ResultLine key={`s-${i}`} result={r} />)}
      {waitingForCustom && (
        <Text>{'  '}<Text color="magenta"><Spinner type="dots" /></Text> Hades evaluating...</Text>
      )}
      {custom.map((r, i) => <ResultLine key={`c-${i}`} result={r} />)}
    </Box>
  );
}
