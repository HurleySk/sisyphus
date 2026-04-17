import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentPanelState } from '../../state.js';
import type { CheckResult } from '../../../types.js';
import { sliceViewport } from '../../format.js';

function ResultLine({ result }: { result: CheckResult }) {
  return (
    <Text>
      {'  '}<Text color={result.pass ? 'green' : 'red'}>{result.pass ? '✓' : '✗'}</Text>
      {' '}{result.criterion}
      <Text dimColor>    {result.message}</Text>
    </Text>
  );
}

export function HadesBody({ panel, viewportHeight }: { panel: AgentPanelState; viewportHeight: number }) {
  const structural = panel.structuralResults ?? [];
  const custom = panel.customResults ?? [];
  const allResults = [...structural, ...custom];
  const totalReceived = allResults.length;
  const allDone = panel.checkCount > 0 && totalReceived >= panel.checkCount;
  const showSpinner = !allDone;
  const { visible: visibleResults, overflowCount } = sliceViewport(allResults, viewportHeight, showSpinner ? 1 : 0);

  return (
    <Box flexDirection="column">
      {overflowCount > 0 && <Text dimColor>  ↑ {overflowCount} more checks</Text>}
      {visibleResults.map((r, i) => <ResultLine key={i} result={r} />)}
      {showSpinner && (
        <Text>  <Spinner type="dots" /> {structural.length > 0 ? 'evaluating custom criteria...' : 'evaluating...'}</Text>
      )}
    </Box>
  );
}
