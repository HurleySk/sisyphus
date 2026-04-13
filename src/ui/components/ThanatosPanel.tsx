import React from 'react';
import { Static, Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { Spec } from '../../types.js';
import type { UIState, DispatchEntry } from '../state.js';
import { Header } from './Header.js';
import { BoulderCompleted } from './BoulderCompleted.js';
import { BoulderPending } from './BoulderPending.js';

interface ThanatosPanelProps {
  state: UIState;
  spec: Spec;
  elapsed: number;
}

function renderDispatchMessage(entry: DispatchEntry): React.ReactNode {
  const { message, type } = entry;
  if (type === 'dispatched-sisyphus' || type === 'produced') {
    const parts = message.split('sisyphus');
    if (parts.length > 1) {
      return (
        <>
          {parts[0]}<Text color="magenta">sisyphus</Text>{parts.slice(1).join('sisyphus')}
        </>
      );
    }
  }
  if (type === 'dispatched-hades') {
    const parts = message.split('hades');
    return (
      <>
        {parts[0]}<Text color="red">hades</Text>{parts.slice(1).join('hades')}
      </>
    );
  }
  return message;
}

function DispatchLogEntry({ entry }: { entry: DispatchEntry }) {
  const prefixMap: Record<string, string> = {
    'gathering': '⋯',
    'gathered': '✓',
    'dispatched-sisyphus': '→',
    'produced': '✓',
    'dispatched-hades': '→',
    'retry': '↻',
    'evaluated-pass': '✓',
    'evaluated-fail': '✗',
  };
  const colorMap: Record<string, string | undefined> = {
    'gathering': undefined,
    'gathered': undefined,
    'dispatched-sisyphus': undefined,
    'produced': undefined,
    'dispatched-hades': undefined,
    'retry': 'yellow',
    'evaluated-pass': 'green',
    'evaluated-fail': 'red',
  };

  const prefix = prefixMap[entry.type] ?? '·';
  const color = colorMap[entry.type];
  const isDim = ['gathering', 'gathered', 'produced', 'dispatched-sisyphus', 'dispatched-hades'].includes(entry.type);

  if (isDim) {
    return (
      <Text dimColor>    {prefix} {renderDispatchMessage(entry)}</Text>
    );
  }

  return (
    <Text color={color}>    {prefix} {renderDispatchMessage(entry)}</Text>
  );
}

export function ThanatosPanel({ state, spec, elapsed }: ThanatosPanelProps) {
  const title = state.title || spec.title;
  const layer = state.layer || spec.layer;
  const total = state.totalBoulders || spec.boulders.length;
  const completed = state.completedBoulders.length;
  const active = state.activeBoulder;

  // Determine which boulders are still pending
  const pendingBoulders = spec.boulders.filter(
    b =>
      !state.completedBoulders.some(c => c.name === b.name) &&
      active?.name !== b.name,
  );

  // Determine if the active boulder is waiting for its current action
  // (no dispatch log entry yet that matches the current phase)
  const showSpinner = active && active.phase !== 'idle' && active.phase !== 'failed';

  return (
    <Box flexDirection="column">
      <Header title={title} layer={layer} elapsed={elapsed} completed={completed} total={total} />

      <Static items={state.completedBoulders}>
        {(boulder) => (
          <BoulderCompleted
            key={boulder.name}
            name={boulder.name}
            status={boulder.status}
            attempts={boulder.attempts}
            durationMs={boulder.durationMs}
            failures={boulder.failures}
            results={boulder.results}
          />
        )}
      </Static>

      {active && (
        <Box flexDirection="column">
          <Text>
            <Text color="blue">●</Text>{' '}<Text bold>{active.name}</Text>{' '}
            <Text dimColor>attempt {active.attempt + 1}/{active.maxAttempts}</Text>
          </Text>
          {active.dispatchLog.map((entry, i) => (
            <DispatchLogEntry key={i} entry={entry} />
          ))}
          {showSpinner && (
            <Text dimColor>    <Spinner type="dots" />{' '}working...</Text>
          )}
        </Box>
      )}

      {pendingBoulders.map((b, i) => (
        <BoulderPending key={b.name} name={b.name} />
      ))}
    </Box>
  );
}
