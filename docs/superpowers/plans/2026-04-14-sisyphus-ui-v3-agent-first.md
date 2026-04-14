# Sisyphus UI v3 — Agent-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Sisyphus run UI with an agent-first layout where streaming agent output dominates the screen, and the orchestrator (Thanatos) becomes a compact bottom status bar. Also add a new `produce:stream` event for raw content streaming.

**Architecture:** The current two-panel layout (ThanatosPanel top / WorkerPanel bottom) is flipped and simplified. The new layout has AgentPanel (top, ~80% of screen) streaming raw agent output, and StatusBar (bottom, 2-3 lines) showing compact boulder progress. State is simplified: dispatchLog and workerPanel are removed, replaced by a streamingLines buffer and a unified agent panel state.

**Tech Stack:** Ink 7 (React for CLI), TypeScript, Vitest, ink-testing-library

**Spec:** `docs/superpowers/specs/2026-04-14-sisyphus-ui-v3-agent-first-design.md`

**Scope note:** The spec covers Zeus (T1 skill) and the run UI. This plan covers only the run UI redesign. Zeus is a separate Claude Code skill that will be planned independently — it's prompt/conversation work, not Ink UI code.

---

## File Structure

### New Files
- `src/ui/components/AgentPanel.tsx` — Main agent output panel (gathering, producing, evaluating, retry, completion modes)
- `src/ui/components/StatusBar.tsx` — Compact 2-line Thanatos status bar with boulder badges and progress bar
- `src/ui/components/AgentHeader.tsx` — Color-coded header bar for the agent panel (agent name, boulder, attempt, elapsed)
- `tests/ui/agent-panel.test.tsx` — Tests for AgentPanel and its sub-modes
- `tests/ui/status-bar.test.tsx` — Tests for StatusBar component
- `tests/ui/state-v3.test.ts` — Tests for the new streamingLines state and simplified reducer

### Modified Files
- `src/events.ts` — Add `ProduceStreamPayload` and `produce:stream` event
- `src/ui/state.ts` — Replace dispatchLog/workerPanel with agentPanel state (agent, phase, streamingLines, checks). Keep CompletedBoulder but add `results` and `retryHistory`.
- `src/ui/hooks/useEngine.ts` — Subscribe to new `produce:stream` event
- `src/ui/App.tsx` — Replace ThanatosPanel + PanelSeparator + WorkerPanel with AgentPanel + separator + StatusBar
- `src/ui/render.ts` — Remove `printSummary` call (no more post-Ink duplication)
- `src/ui/components/CompletionSummary.tsx` — Rewrite with per-boulder production details, check results, retry history
- `src/ui/components/ProgressBar.tsx` — Keep as-is, used by StatusBar
- `src/commands/run.ts` — No changes needed (already delegates to renderUI)

### Deleted Files
- `src/ui/components/ThanatosPanel.tsx` — Replaced by StatusBar
- `src/ui/components/WorkerPanel.tsx` — Replaced by AgentPanel
- `src/ui/components/PanelSeparator.tsx` — Replaced by inline dim rule in App
- `src/ui/components/BoulderCompleted.tsx` — Replaced by StatusBar badges
- `src/ui/components/BoulderPending.tsx` — Replaced by StatusBar badges
- `src/ui/components/PhaseProduce.tsx` — Replaced by AgentPanel produce mode
- `src/ui/components/PhaseEvaluate.tsx` — Replaced by AgentPanel evaluate mode
- `src/ui/components/PhaseStack.tsx` — Replaced by AgentPanel gathering mode
- `src/ui/components/FailureDetail.tsx` — Already unused, remove
- `src/ui/components/Header.tsx` — Replaced by AgentHeader
- `src/ui/components/SummaryTable.ts` — Post-Ink duplication, remove entirely

---

## Task 1: Add `produce:stream` Event

**Files:**
- Modify: `src/events.ts:50-73` (add new payload and event)
- Test: `tests/ui/state-v3.test.ts` (new file, first test)

- [ ] **Step 1: Write the failing test for produce:stream action**

Create `tests/ui/state-v3.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState } from '../../src/ui/state.js';
import type { UIState, UIAction } from '../../src/ui/state.js';

function apply(state: UIState, action: UIAction): UIState {
  return uiReducer(state, action);
}

describe('produce:stream action', () => {
  it('appends a line to streamingLines', () => {
    let state = apply(initialUIState, {
      type: 'run:start',
      payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
    });
    state = apply(state, {
      type: 'boulder:start',
      payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: '# Welcome' },
    });
    expect(state.agentPanel.streamingLines).toContain('# Welcome');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/state-v3.test.ts`
Expected: FAIL — `produce:stream` is not a valid action type, `agentPanel` does not exist on UIState

- [ ] **Step 3: Add ProduceStreamPayload to events.ts**

In `src/events.ts`, after the `ProduceEndPayload` interface (line 73), add:

```typescript
export interface ProduceStreamPayload {
  boulderName: string;
  line: string;
}
```

In the `SisyphusEvents` interface (after `'produce:end'` on line 111), add:

```typescript
  'produce:stream': ProduceStreamPayload;
```

- [ ] **Step 4: Commit**

```bash
git add src/events.ts tests/ui/state-v3.test.ts
git commit -m "feat(events): add produce:stream event for raw content streaming"
```

---

## Task 2: Rewrite UIState for Agent-First Layout

**Files:**
- Modify: `src/ui/state.ts`
- Test: `tests/ui/state-v3.test.ts`

This is the biggest state change. We add `agentPanel` to UIState, add `produce:stream` to the action union and reducer, and add `retryHistory` to CompletedBoulder. The existing fields (`activeBoulder`, `workerPanel`, `dispatchLog`) stay for now — we'll remove them after the components are migrated.

- [ ] **Step 1: Write failing tests for new agentPanel state**

Append to `tests/ui/state-v3.test.ts`:

```typescript
describe('agentPanel state management', () => {
  function makeBoulder(): UIState {
    return apply(
      apply(initialUIState, {
        type: 'run:start',
        payload: { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 },
      }),
      { type: 'boulder:start', payload: { name: 'b1', index: 0, total: 1, maxAttempts: 3 } },
    );
  }

  it('produce:start sets agentPanel to sisyphus with empty streamingLines', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    expect(state.agentPanel.agent).toBe('sisyphus');
    expect(state.agentPanel.streamingLines).toEqual([]);
    expect(state.agentPanel.boulderName).toBe('b1');
    expect(state.agentPanel.attempt).toBe(0);
  });

  it('produce:stream appends lines', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: '# Hello' },
    });
    state = apply(state, {
      type: 'produce:stream',
      payload: { boulderName: 'b1', line: 'World' },
    });
    expect(state.agentPanel.streamingLines).toEqual(['# Hello', 'World']);
  });

  it('evaluate:start switches agentPanel to hades', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'evaluate:start',
      payload: { boulderName: 'b1', attempt: 0, structuralCount: 2, customCount: 1 },
    });
    expect(state.agentPanel.agent).toBe('hades');
    expect(state.agentPanel.streamingLines).toEqual([]);
  });

  it('climb sets agentPanel to retry mode with failure info', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'produce:start',
      payload: { boulderName: 'b1', attempt: 0, maxAttempts: 3 },
    });
    state = apply(state, {
      type: 'evaluate:start',
      payload: { boulderName: 'b1', attempt: 0, structuralCount: 0, customCount: 0 },
    });
    state = apply(state, {
      type: 'evaluate:end',
      payload: {
        boulderName: 'b1', attempt: 0, passed: false,
        failures: [{ criterion: 'word-count', pass: false, message: 'Too short' }],
      },
    });
    state = apply(state, {
      type: 'climb',
      payload: {
        boulderName: 'b1', attempt: 0,
        failures: [{ criterion: 'word-count', pass: false, message: 'Too short' }],
      },
    });
    expect(state.agentPanel.agent).toBe('retry');
    expect(state.agentPanel.climbFeedback).toContain('Too short');
  });

  it('stack:start sets agentPanel to gathering mode', () => {
    let state = makeBoulder();
    state = apply(state, {
      type: 'stack:start',
      payload: { boulderName: 'b1', sourceCount: 3 },
    });
    expect(state.agentPanel.agent).toBe('gathering');
    expect(state.agentPanel.boulderName).toBe('b1');
  });

  it('run:end sets agentPanel to done', () => {
    const mockReport = {
      title: 'T', startedAt: '', completedAt: '',
      boulders: [], totalBoulders: 0, passedClean: 0, passedAfterClimb: 0, flagged: 0,
    };
    let state = makeBoulder();
    state = apply(state, { type: 'run:end', payload: { report: mockReport } });
    expect(state.agentPanel.agent).toBe('done');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/state-v3.test.ts`
Expected: FAIL — `agentPanel` does not exist

- [ ] **Step 3: Add AgentPanelState and update UIState**

In `src/ui/state.ts`, after the `WorkerAgent` type (line 38), add:

```typescript
export type AgentMode = 'idle' | 'gathering' | 'sisyphus' | 'hades' | 'retry' | 'done';

export interface RetryRecord {
  attempt: number;
  failedChecks: string[];
}

export interface AgentPanelState {
  agent: AgentMode;
  boulderName: string | null;
  attempt: number;
  maxAttempts: number;
  startedAt: number | null;
  streamingLines: string[];
  stackFiles: StackFileEntry[];
  structuralResults: CheckResult[] | null;
  customResults: CheckResult[] | null;
  climbFeedback: string | undefined;
  retryHistory: RetryRecord[];
}
```

Add the default:

```typescript
export const defaultAgentPanel: AgentPanelState = {
  agent: 'idle',
  boulderName: null,
  attempt: 0,
  maxAttempts: 0,
  startedAt: null,
  streamingLines: [],
  stackFiles: [],
  structuralResults: null,
  customResults: null,
  climbFeedback: undefined,
  retryHistory: [],
};
```

Add `agentPanel` to `UIState`:

```typescript
export interface UIState {
  title: string;
  layer: string;
  totalBoulders: number;
  activeBoulder: BoulderUIState | null;
  completedBoulders: CompletedBoulder[];
  report: RunReport | null;
  workerPanel: WorkerPanelState;
  agentPanel: AgentPanelState;  // NEW
}
```

Update `initialUIState` to include `agentPanel: { ...defaultAgentPanel }`.

Add `produce:stream` to the `UIAction` union:

```typescript
  | { type: 'produce:stream'; payload: ProduceStreamPayload }
```

Import `ProduceStreamPayload` from `../events.js`.

- [ ] **Step 4: Add agentPanel logic to uiReducer**

In the reducer's `stack:start` case, after the existing logic, add:

```typescript
        agentPanel: {
          ...defaultAgentPanel,
          agent: 'gathering',
          boulderName: state.activeBoulder?.name ?? null,
          startedAt: Date.now(),
        },
```

In `stack:file`, also append to `agentPanel.stackFiles`:

```typescript
        agentPanel: {
          ...state.agentPanel,
          stackFiles: [...state.agentPanel.stackFiles, entry],
        },
```

In `produce:start`, set agentPanel:

```typescript
        agentPanel: {
          ...defaultAgentPanel,
          agent: 'sisyphus',
          boulderName: action.payload.boulderName ?? state.activeBoulder?.name ?? null,
          attempt: action.payload.attempt,
          maxAttempts: action.payload.maxAttempts,
          startedAt: Date.now(),
          climbFeedback: action.payload.climbFeedback,
          retryHistory: state.agentPanel.retryHistory,
        },
```

Add new case for `produce:stream`:

```typescript
    case 'produce:stream': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        agentPanel: {
          ...state.agentPanel,
          streamingLines: [...state.agentPanel.streamingLines, action.payload.line],
        },
      };
    }
```

In `evaluate:start`, set agentPanel:

```typescript
        agentPanel: {
          ...state.agentPanel,
          agent: 'hades',
          startedAt: Date.now(),
          streamingLines: [],
          structuralResults: null,
          customResults: null,
        },
```

In `evaluate:structural` and `evaluate:custom`, mirror to agentPanel:

```typescript
        agentPanel: {
          ...state.agentPanel,
          structuralResults: action.payload.results,  // or customResults
        },
```

In `climb`, set agentPanel to retry:

```typescript
        agentPanel: {
          ...state.agentPanel,
          agent: 'retry',
          climbFeedback: failureSummary,
          retryHistory: [
            ...state.agentPanel.retryHistory,
            {
              attempt: state.activeBoulder.attempt,
              failedChecks: (action.payload?.failures ?? []).map(f => f.criterion),
            },
          ],
        },
```

In `boulder:start`, reset agentPanel:

```typescript
        agentPanel: { ...defaultAgentPanel },
```

In `run:end`, set agentPanel to done:

```typescript
        agentPanel: {
          ...state.agentPanel,
          agent: 'done',
        },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/ui/state-v3.test.ts`
Expected: PASS

- [ ] **Step 6: Run existing state tests to verify no regressions**

Run: `npx vitest run tests/ui/state.test.ts`
Expected: PASS — all existing tests still work since we only added fields

- [ ] **Step 7: Commit**

```bash
git add src/ui/state.ts src/events.ts tests/ui/state-v3.test.ts
git commit -m "feat(state): add agentPanel state and produce:stream for v3 layout"
```

---

## Task 3: Subscribe to `produce:stream` in useEngine

**Files:**
- Modify: `src/ui/hooks/useEngine.ts`
- Test: `tests/ui/use-engine.test.ts` (add one test)

- [ ] **Step 1: Write failing test**

Append to `tests/ui/use-engine.test.ts`:

```typescript
it('produce:stream updates agentPanel.streamingLines', async () => {
  // Fire existing lifecycle events to get to produce phase
  emitter.emit('run:start', { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 1 });
  emitter.emit('boulder:start', { name: 'b1', index: 0, total: 1, maxAttempts: 2 });
  emitter.emit('produce:start', { boulderName: 'b1', attempt: 0, maxAttempts: 2 });
  emitter.emit('produce:stream', { boulderName: 'b1', line: '# Test' });
  await new Promise(r => setTimeout(r, 50));
  // Access state through the hook's return value in the test component
  expect(lastState.agentPanel.streamingLines).toContain('# Test');
});
```

Note: Adapt to the existing test pattern in `use-engine.test.ts` — the test file uses a test component with `useEngine` to capture state.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/use-engine.test.ts`
Expected: FAIL — `produce:stream` not in EVENT_NAMES

- [ ] **Step 3: Add produce:stream to EVENT_NAMES**

In `src/ui/hooks/useEngine.ts`, add `'produce:stream'` to the `EVENT_NAMES` array (after `'produce:end'`):

```typescript
const EVENT_NAMES: Array<keyof SisyphusEvents & string> = [
  'run:start',
  'run:end',
  'boulder:start',
  'boulder:end',
  'stack:start',
  'stack:file',
  'stack:end',
  'produce:start',
  'produce:file-change',
  'produce:diff',
  'produce:stream',   // NEW
  'produce:end',
  'evaluate:start',
  'evaluate:structural',
  'evaluate:custom',
  'evaluate:end',
  'climb',
];
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ui/use-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useEngine.ts tests/ui/use-engine.test.ts
git commit -m "feat(hooks): subscribe to produce:stream event in useEngine"
```

---

## Task 4: Build AgentHeader Component

**Files:**
- Create: `src/ui/components/AgentHeader.tsx`
- Test: `tests/ui/agent-panel.test.tsx` (new file)

- [ ] **Step 1: Write failing tests**

Create `tests/ui/agent-panel.test.tsx`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { AgentHeader } from '../../src/ui/components/AgentHeader.js';

afterEach(() => { cleanup(); });

function cap(el: React.ReactElement): string {
  const { lastFrame } = render(el);
  return lastFrame()!;
}

describe('AgentHeader', () => {
  it('renders SISYPHUS with boulder name and attempt', () => {
    const out = cap(<AgentHeader agent="sisyphus" boulderName="greeting" attempt={0} maxAttempts={3} elapsed={6} />);
    expect(out).toContain('SISYPHUS');
    expect(out).toContain('greeting');
    expect(out).toContain('attempt 1');
    expect(out).toContain('6s');
  });

  it('renders HADES with evaluating label', () => {
    const out = cap(<AgentHeader agent="hades" boulderName="features" attempt={0} maxAttempts={3} elapsed={3} />);
    expect(out).toContain('HADES');
    expect(out).toContain('features');
    expect(out).toContain('evaluating');
  });

  it('renders GATHERING with dim cyan style', () => {
    const out = cap(<AgentHeader agent="gathering" boulderName="intro" attempt={0} maxAttempts={3} elapsed={2} />);
    expect(out).toContain('GATHERING');
    expect(out).toContain('intro');
  });

  it('renders RETRY with attempt number', () => {
    const out = cap(<AgentHeader agent="retry" boulderName="features" attempt={1} maxAttempts={3} elapsed={0} />);
    expect(out).toContain('RETRY');
    expect(out).toContain('features');
    expect(out).toContain('attempt 2');
  });

  it('renders DONE header', () => {
    const out = cap(<AgentHeader agent="done" boulderName={null} attempt={0} maxAttempts={0} elapsed={28} />);
    expect(out).toContain('DONE');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/agent-panel.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement AgentHeader**

Create `src/ui/components/AgentHeader.tsx`:

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { AgentMode } from '../state.js';
import { formatElapsed } from './Header.js';

interface AgentHeaderProps {
  agent: AgentMode;
  boulderName: string | null;
  attempt: number;
  maxAttempts: number;
  elapsed: number;
}

const agentConfig: Record<AgentMode, { label: string; color: string; sublabel?: string }> = {
  idle: { label: '', color: 'dim' },
  gathering: { label: 'GATHERING', color: 'cyan' },
  sisyphus: { label: 'SISYPHUS', color: 'magenta' },
  hades: { label: 'HADES', color: 'red', sublabel: 'evaluating' },
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
      <Text>{' '.repeat(Math.max(1, 40 - (config.label.length + (boulderName?.length ?? 0))))}</Text>
      <Text dimColor>{formatElapsed(elapsed)}</Text>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ui/agent-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/AgentHeader.tsx tests/ui/agent-panel.test.tsx
git commit -m "feat(ui): add AgentHeader component with color-coded agent labels"
```

---

## Task 5: Build AgentPanel Component

**Files:**
- Create: `src/ui/components/AgentPanel.tsx`
- Test: `tests/ui/agent-panel.test.tsx` (append)

The AgentPanel renders differently based on `agentPanel.agent`:
- `gathering` → file list with line counts
- `sisyphus` → streaming lines + spinner
- `hades` → check results streaming in
- `retry` → failed checks + feedback + "restarting..."
- `done` → CompletionSummary (handled by parent, but AgentPanel shows it)

- [ ] **Step 1: Write failing tests**

Append to `tests/ui/agent-panel.test.tsx`:

```typescript
import { AgentPanel } from '../../src/ui/components/AgentPanel.js';
import type { AgentPanelState } from '../../src/ui/state.js';
import { defaultAgentPanel } from '../../src/ui/state.js';

describe('AgentPanel', () => {
  it('renders gathering mode with file list', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'gathering',
      boulderName: 'intro',
      startedAt: Date.now(),
      stackFiles: [
        { path: 'src/data.ts', lines: 42, summarized: false },
        { path: 'data/big.csv', lines: 500, summarized: true },
      ],
    };
    const out = cap(<AgentPanel panel={panel} elapsed={2} />);
    expect(out).toContain('src/data.ts');
    expect(out).toContain('42 lines');
    expect(out).toContain('data/big.csv');
    expect(out).toContain('summarized');
  });

  it('renders sisyphus mode with streaming lines', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'sisyphus',
      boulderName: 'greeting',
      attempt: 0,
      maxAttempts: 3,
      startedAt: Date.now(),
      streamingLines: ['# Welcome', '', 'Hello world.'],
    };
    const out = cap(<AgentPanel panel={panel} elapsed={6} />);
    expect(out).toContain('# Welcome');
    expect(out).toContain('Hello world.');
    expect(out).toContain('writing');
  });

  it('renders hades mode with check results', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'hades',
      boulderName: 'greeting',
      startedAt: Date.now(),
      structuralResults: [
        { criterion: 'contains-heading', pass: true, message: '"Welcome" h1 found' },
        { criterion: 'word-count-gte', pass: true, message: '47 words (min 20)' },
      ],
      customResults: null,
    };
    const out = cap(<AgentPanel panel={panel} elapsed={3} />);
    expect(out).toContain('✓');
    expect(out).toContain('contains-heading');
    expect(out).toContain('word-count-gte');
    expect(out).toContain('evaluating');
  });

  it('renders retry mode with failure feedback', () => {
    const panel: AgentPanelState = {
      ...defaultAgentPanel,
      agent: 'retry',
      boulderName: 'greeting',
      attempt: 1,
      maxAttempts: 3,
      climbFeedback: 'Too short, expand to 3-4 sentences',
      retryHistory: [{ attempt: 0, failedChecks: ['word-count-gte'] }],
    };
    const out = cap(<AgentPanel panel={panel} elapsed={0} />);
    expect(out).toContain('word-count-gte');
    expect(out).toContain('Too short');
    expect(out).toContain('restarting');
  });

  it('renders idle state as waiting message', () => {
    const out = cap(<AgentPanel panel={defaultAgentPanel} elapsed={0} />);
    expect(out).toContain('waiting');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/agent-panel.test.tsx`
Expected: FAIL — AgentPanel not found

- [ ] **Step 3: Implement AgentPanel**

Create `src/ui/components/AgentPanel.tsx`:

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentPanelState } from '../state.js';
import type { CheckResult } from '../../types.js';
import { AgentHeader } from './AgentHeader.js';

interface AgentPanelProps {
  panel: AgentPanelState;
  elapsed: number;
}

function GatheringBody({ panel }: { panel: AgentPanelState }) {
  const { stackFiles } = panel;
  return (
    <Box flexDirection="column">
      {stackFiles.map((f, i) => (
        <Text key={i}>
          {'  '}reading {f.path}
          <Text dimColor>{' '.repeat(Math.max(1, 40 - f.path.length))}{f.lines} lines</Text>
          {f.summarized && <Text dimColor> · summarized</Text>}
        </Text>
      ))}
      {stackFiles.length === 0 && (
        <Text>  <Spinner type="dots" /> gathering sources...</Text>
      )}
    </Box>
  );
}

function SisyphusBody({ panel }: { panel: AgentPanelState }) {
  return (
    <Box flexDirection="column">
      {panel.streamingLines.map((line, i) => (
        <Text key={i}>  {line}</Text>
      ))}
      <Text>
        {'  '}<Spinner type="dots" /> writing...
      </Text>
    </Box>
  );
}

function ResultLine({ result }: { result: CheckResult }) {
  return (
    <Text>
      {'  '}<Text color={result.pass ? 'green' : 'red'}>{result.pass ? '✓' : '✗'}</Text>
      {' '}{result.criterion}
      <Text dimColor>    {result.message}</Text>
    </Text>
  );
}

function HadesBody({ panel }: { panel: AgentPanelState }) {
  const structural = panel.structuralResults ?? [];
  const custom = panel.customResults ?? [];
  const waitingForCustom = structural.length > 0 && custom.length === 0;
  return (
    <Box flexDirection="column">
      {structural.map((r, i) => <ResultLine key={`s-${i}`} result={r} />)}
      {waitingForCustom && (
        <Text>  <Spinner type="dots" /> evaluating custom criteria...</Text>
      )}
      {custom.map((r, i) => <ResultLine key={`c-${i}`} result={r} />)}
    </Box>
  );
}

function RetryBody({ panel }: { panel: AgentPanelState }) {
  const lastRetry = panel.retryHistory[panel.retryHistory.length - 1];
  return (
    <Box flexDirection="column">
      {lastRetry?.failedChecks.map((check, i) => (
        <Text key={i} color="red">  ✗ {check}</Text>
      ))}
      {panel.climbFeedback && (
        <Text color="yellow">  feedback: &quot;{panel.climbFeedback}&quot;</Text>
      )}
      <Text />
      <Text dimColor>  restarting sisyphus...</Text>
    </Box>
  );
}

export function AgentPanel({ panel, elapsed }: AgentPanelProps) {
  if (panel.agent === 'idle') {
    return <Text dimColor>waiting for dispatch...</Text>;
  }

  return (
    <Box flexDirection="column">
      <AgentHeader
        agent={panel.agent}
        boulderName={panel.boulderName}
        attempt={panel.attempt}
        maxAttempts={panel.maxAttempts}
        elapsed={elapsed}
      />
      <Text dimColor>{'─'.repeat(54)}</Text>
      {panel.agent === 'gathering' && <GatheringBody panel={panel} />}
      {panel.agent === 'sisyphus' && <SisyphusBody panel={panel} />}
      {panel.agent === 'hades' && <HadesBody panel={panel} />}
      {panel.agent === 'retry' && <RetryBody panel={panel} />}
    </Box>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ui/agent-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/AgentPanel.tsx tests/ui/agent-panel.test.tsx
git commit -m "feat(ui): add AgentPanel component with gathering/produce/evaluate/retry modes"
```

---

## Task 6: Build StatusBar Component

**Files:**
- Create: `src/ui/components/StatusBar.tsx`
- Create: `tests/ui/status-bar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/ui/status-bar.test.tsx`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { StatusBar } from '../../src/ui/components/StatusBar.js';
import type { CompletedBoulder } from '../../src/ui/state.js';

afterEach(() => { cleanup(); });

function cap(el: React.ReactElement): string {
  const { lastFrame } = render(el);
  return lastFrame()!;
}

describe('StatusBar', () => {
  it('renders completed boulder with green checkmark and time', () => {
    const completed: CompletedBoulder[] = [
      { name: 'greeting', status: 'passed', attempts: 1, durationMs: 9000 },
    ];
    const out = cap(<StatusBar completed={completed} activeBoulderName="features" pendingNames={['summary']} total={3} elapsed={14} />);
    expect(out).toContain('✓');
    expect(out).toContain('greeting');
    expect(out).toContain('9s');
  });

  it('renders active boulder with cyan bullet', () => {
    const out = cap(<StatusBar completed={[]} activeBoulderName="features" pendingNames={[]} total={2} elapsed={5} />);
    expect(out).toContain('●');
    expect(out).toContain('features');
  });

  it('renders pending boulder with dim circle', () => {
    const out = cap(<StatusBar completed={[]} activeBoulderName="greeting" pendingNames={['features', 'summary']} total={3} elapsed={2} />);
    expect(out).toContain('○');
    expect(out).toContain('features');
  });

  it('renders progress bar and count', () => {
    const completed: CompletedBoulder[] = [
      { name: 'greeting', status: 'passed', attempts: 1, durationMs: 9000 },
    ];
    const out = cap(<StatusBar completed={completed} activeBoulderName="features" pendingNames={[]} total={2} elapsed={14} />);
    expect(out).toContain('1/2');
    expect(out).toContain('14s');
  });

  it('shows yellow checkmark for climbed boulder', () => {
    const completed: CompletedBoulder[] = [
      { name: 'features', status: 'passed', attempts: 2, durationMs: 19000 },
    ];
    const out = cap(<StatusBar completed={completed} activeBoulderName={null} pendingNames={[]} total={1} elapsed={19} />);
    expect(out).toContain('✓');
    expect(out).toContain('features');
    expect(out).toContain('19s');
  });

  it('shows red X for flagged boulder', () => {
    const completed: CompletedBoulder[] = [
      { name: 'features', status: 'flagged', attempts: 3, durationMs: 30000 },
    ];
    const out = cap(<StatusBar completed={completed} activeBoulderName={null} pendingNames={[]} total={1} elapsed={30} />);
    expect(out).toContain('✗');
    expect(out).toContain('features');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/status-bar.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement StatusBar**

Create `src/ui/components/StatusBar.tsx`:

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { CompletedBoulder } from '../state.js';
import { ProgressBar } from './ProgressBar.js';
import { formatElapsed } from './Header.js';

interface StatusBarProps {
  completed: CompletedBoulder[];
  activeBoulderName: string | null;
  pendingNames: string[];
  total: number;
  elapsed: number;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function BoulderBadge({ name, icon, color, time }: { name: string; icon: string; color: string; time?: string }) {
  return (
    <Text>
      <Text color={color}>{icon}</Text> {name}{time ? ` ${time}` : ''}{'    '}
    </Text>
  );
}

export function StatusBar({ completed, activeBoulderName, pendingNames, total, elapsed }: StatusBarProps) {
  const completedCount = completed.length;

  return (
    <Box flexDirection="column">
      <Text dimColor>{'─'.repeat(54)}</Text>
      <Box>
        {completed.map((b) => {
          const icon = b.status === 'flagged' ? '✗' : '✓';
          const color = b.status === 'flagged' ? 'red' : b.attempts > 1 ? 'yellow' : 'green';
          return <BoulderBadge key={b.name} name={b.name} icon={icon} color={color} time={formatDuration(b.durationMs)} />;
        })}
        {activeBoulderName && (
          <BoulderBadge name={activeBoulderName} icon="●" color="cyan" />
        )}
        {pendingNames.map((name) => (
          <BoulderBadge key={name} name={name} icon="○" color="gray" />
        ))}
      </Box>
      <Box>
        <ProgressBar completed={completedCount} total={total} width={30} />
        <Text>  {completedCount}/{total} · {formatElapsed(elapsed)}</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ui/status-bar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/StatusBar.tsx tests/ui/status-bar.test.tsx
git commit -m "feat(ui): add StatusBar component with boulder badges and progress bar"
```

---

## Task 7: Rewrite CompletionSummary

**Files:**
- Modify: `src/ui/components/CompletionSummary.tsx`
- Test: `tests/ui/agent-panel.test.tsx` (append)

The new completion shows per-boulder production details, check results, and retry history.

- [ ] **Step 1: Write failing tests**

Append to `tests/ui/agent-panel.test.tsx`:

```typescript
import { CompletionSummary } from '../../src/ui/components/CompletionSummary.js';
import type { RunReport } from '../../src/types.js';
import type { CompletedBoulder } from '../../src/ui/state.js';

describe('CompletionSummary (v3)', () => {
  it('renders per-boulder check results', () => {
    const report: RunReport = {
      title: 'Test', startedAt: '', completedAt: '',
      boulders: [
        { name: 'greeting', content: 'Hello world', attempts: 1, status: 'passed' },
      ],
      totalBoulders: 1, passedClean: 1, passedAfterClimb: 0, flagged: 0,
    };
    const completed: CompletedBoulder[] = [{
      name: 'greeting', status: 'passed', attempts: 1, durationMs: 9000,
      results: [
        { criterion: 'contains-heading', pass: true, message: 'found' },
        { criterion: 'word-count-gte', pass: true, message: '47 words' },
      ],
    }];
    const out = cap(
      <CompletionSummary report={report} completedBoulders={completed}
        artifactPath="output/test.md" reportPath="output/test-report.json" elapsed={9} />
    );
    expect(out).toContain('DONE');
    expect(out).toContain('1 passed');
    expect(out).toContain('greeting');
    expect(out).toContain('contains-heading');
    expect(out).toContain('word-count-gte');
    expect(out).toContain('output/test.md');
  });

  it('shows retry history for climbed boulders', () => {
    const report: RunReport = {
      title: 'Test', startedAt: '', completedAt: '',
      boulders: [
        { name: 'features', content: 'table', attempts: 2, status: 'passed' },
      ],
      totalBoulders: 1, passedClean: 0, passedAfterClimb: 1, flagged: 0,
    };
    const completed: CompletedBoulder[] = [{
      name: 'features', status: 'passed', attempts: 2, durationMs: 19000,
      results: [
        { criterion: 'contains-heading', pass: true, message: 'found' },
        { criterion: 'row-count-gte', pass: true, message: '3 rows' },
      ],
      failures: [{ criterion: 'row-count-gte', pass: false, message: '2 rows (min 3)' }],
    }];
    const out = cap(
      <CompletionSummary report={report} completedBoulders={completed}
        artifactPath="output/test.md" reportPath="output/test-report.json" elapsed={19} />
    );
    expect(out).toContain('2 attempts');
    expect(out).toContain('row-count-gte');
  });

  it('shows flagged boulders with failing checks', () => {
    const report: RunReport = {
      title: 'Test', startedAt: '', completedAt: '',
      boulders: [
        { name: 'broken', content: '', attempts: 3, status: 'flagged',
          failures: [{ criterion: 'word-count-gte', pass: false, message: '5 words (min 50)' }] },
      ],
      totalBoulders: 1, passedClean: 0, passedAfterClimb: 0, flagged: 1,
    };
    const completed: CompletedBoulder[] = [{
      name: 'broken', status: 'flagged', attempts: 3, durationMs: 30000,
      failures: [{ criterion: 'word-count-gte', pass: false, message: '5 words (min 50)' }],
    }];
    const out = cap(
      <CompletionSummary report={report} completedBoulders={completed}
        artifactPath="output/test.md" reportPath="output/test-report.json" elapsed={30} />
    );
    expect(out).toContain('✗');
    expect(out).toContain('broken');
    expect(out).toContain('1 flagged');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/agent-panel.test.tsx`
Expected: FAIL — CompletionSummary doesn't accept `completedBoulders` prop

- [ ] **Step 3: Rewrite CompletionSummary**

Replace `src/ui/components/CompletionSummary.tsx` with:

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { RunReport } from '../../types.js';
import type { CompletedBoulder } from '../state.js';
import { formatElapsed } from './Header.js';

interface CompletionSummaryProps {
  report: RunReport;
  completedBoulders: CompletedBoulder[];
  artifactPath: string;
  reportPath: string;
  elapsed: number;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function BoulderSummary({ boulder }: { boulder: CompletedBoulder }) {
  const icon = boulder.status === 'flagged' ? '✗' : '✓';
  const iconColor = boulder.status === 'flagged' ? 'red' : boulder.attempts > 1 ? 'yellow' : 'green';
  const attemptLabel = boulder.attempts === 1 ? '1 attempt' : `${boulder.attempts} attempts`;

  return (
    <Box flexDirection="column">
      <Text>
        {'  '}<Text color={iconColor}>{icon}</Text> {boulder.name} · {attemptLabel} · {formatDuration(boulder.durationMs)}
      </Text>
      {boulder.results && boulder.results.length > 0 && (
        <Text>
          {'      '}
          {boulder.results.map((r, i) => (
            <Text key={i}>
              <Text color={r.pass ? 'green' : 'red'}>{r.pass ? '✓' : '✗'}</Text>
              {' '}{r.criterion}
              {i < boulder.results!.length - 1 ? '  ' : ''}
            </Text>
          ))}
        </Text>
      )}
      {boulder.status === 'flagged' && boulder.failures && boulder.failures.length > 0 && (
        <Box flexDirection="column">
          {boulder.failures.map((f, i) => (
            <Text key={i} color="red">      ✗ {f.criterion}  {f.message}</Text>
          ))}
        </Box>
      )}
      {boulder.attempts > 1 && boulder.failures && boulder.failures.length > 0 && boulder.status === 'passed' && (
        <Text dimColor>      attempt {boulder.attempts - 1}: ✗ {boulder.failures.map(f => f.criterion).join(', ')} → retried</Text>
      )}
    </Box>
  );
}

export function CompletionSummary({ report, completedBoulders, artifactPath, reportPath, elapsed }: CompletionSummaryProps) {
  const passed = report.passedClean + report.passedAfterClimb;
  const flagged = report.flagged;

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="green" bold>DONE</Text>
        {' · '}{passed} passed{flagged > 0 ? <Text color="red"> · {flagged} flagged</Text> : ''}
        {' · '}{formatElapsed(elapsed)}
      </Text>
      <Text dimColor>{'─'.repeat(54)}</Text>
      {completedBoulders.map((b) => (
        <BoulderSummary key={b.name} boulder={b} />
      ))}
      <Text />
      <Text dimColor>  artifact → {artifactPath}</Text>
      <Text dimColor>  report   → {reportPath}</Text>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ui/agent-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/CompletionSummary.tsx tests/ui/agent-panel.test.tsx
git commit -m "feat(ui): rewrite CompletionSummary with per-boulder details and retry history"
```

---

## Task 8: Rewire App.tsx and render.ts

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/render.ts`

- [ ] **Step 1: Rewrite App.tsx**

Replace `src/ui/App.tsx` with:

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { TypedEmitter, SisyphusEvents } from '../events.js';
import type { Spec } from '../types.js';
import { useEngine } from './hooks/useEngine.js';
import { useElapsed } from './hooks/useElapsed.js';
import { AgentPanel } from './components/AgentPanel.js';
import { CompletionSummary } from './components/CompletionSummary.js';
import { StatusBar } from './components/StatusBar.js';

export interface AppProps {
  emitter: TypedEmitter<SisyphusEvents>;
  spec: Spec;
  startTime: number;
  artifactPath: string;
  reportPath: string;
}

export function App({ emitter, spec, startTime, artifactPath, reportPath }: AppProps) {
  const state = useEngine(emitter);
  const elapsed = useElapsed(startTime);

  const pendingNames = spec.boulders
    .filter(b =>
      !state.completedBoulders.some(c => c.name === b.name) &&
      state.activeBoulder?.name !== b.name,
    )
    .map(b => b.name);

  const isComplete = state.report !== null;

  return (
    <Box flexDirection="column">
      {isComplete ? (
        <CompletionSummary
          report={state.report!}
          completedBoulders={state.completedBoulders}
          artifactPath={artifactPath}
          reportPath={reportPath}
          elapsed={elapsed}
        />
      ) : (
        <AgentPanel panel={state.agentPanel} elapsed={elapsed} />
      )}
      <StatusBar
        completed={state.completedBoulders}
        activeBoulderName={state.activeBoulder?.name ?? null}
        pendingNames={pendingNames}
        total={state.totalBoulders || spec.boulders.length}
        elapsed={elapsed}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Remove printSummary from render.ts**

In `src/ui/render.ts`, remove the import of `printSummary` (line 9) and remove the `printSummary(report, artifactPath, reportPath);` call (line 28). The file becomes:

```typescript
import React from 'react';
import { render } from 'ink';
import { TypedEmitter } from '../events.js';
import type { SisyphusEvents } from '../events.js';
import type { Spec, RunReport } from '../types.js';
import { runSpec } from '../engine.js';
import { App } from './App.js';

export async function renderUI(
  spec: Spec,
  options: { baseDir?: string; lessonsDir?: string },
  artifactPath: string,
  reportPath: string,
): Promise<RunReport> {
  const emitter = new TypedEmitter<SisyphusEvents>();
  const startTime = Date.now();

  const app = render(React.createElement(App, { emitter, spec, startTime, artifactPath, reportPath }));

  const report = await runSpec(spec, { ...options, emitter });

  await new Promise(r => setTimeout(r, 100));
  app.unmount();
  await app.waitUntilExit();

  return report;
}
```

- [ ] **Step 3: Build and check for type errors**

Run: `npx tsc --noEmit`
Expected: May have errors from old component imports in test files — that's expected and will be cleaned up in next task.

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.tsx src/ui/render.ts
git commit -m "feat(ui): rewire App to use AgentPanel + StatusBar, remove post-Ink summary"
```

---

## Task 9: Delete Old Components and Update Tests

**Files:**
- Delete: `src/ui/components/ThanatosPanel.tsx`
- Delete: `src/ui/components/WorkerPanel.tsx`
- Delete: `src/ui/components/PanelSeparator.tsx`
- Delete: `src/ui/components/BoulderCompleted.tsx`
- Delete: `src/ui/components/BoulderPending.tsx`
- Delete: `src/ui/components/PhaseProduce.tsx`
- Delete: `src/ui/components/PhaseEvaluate.tsx`
- Delete: `src/ui/components/PhaseStack.tsx`
- Delete: `src/ui/components/FailureDetail.tsx`
- Delete: `src/ui/components/Header.tsx` — **Wait, keep this.** `formatElapsed` is imported by AgentHeader and StatusBar. Either keep Header.tsx or move `formatElapsed` to a utility.
- Delete: `src/ui/components/SummaryTable.ts`
- Modify: `tests/ui/components.test.tsx` — Rewrite to test new components

- [ ] **Step 1: Move formatElapsed to a utility**

The `formatElapsed` function in `Header.tsx` is used by `AgentHeader.tsx`, `StatusBar.tsx`, and `CompletionSummary.tsx`. Before deleting `Header.tsx`, move it.

Create utility by adding to the top of `src/ui/components/AgentHeader.tsx` (since it already imports it):

Actually, simpler: keep `formatElapsed` as a standalone export. Add it to `src/ui/components/StatusBar.tsx` as a local function, and update imports in `AgentHeader.tsx` and `CompletionSummary.tsx` to use their own local copies or import from StatusBar.

Even simpler: create `src/ui/format.ts`:

```typescript
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function formatDuration(ms: number): string {
  return formatElapsed(Math.floor(ms / 1000));
}
```

Update imports in `AgentHeader.tsx`, `StatusBar.tsx`, and `CompletionSummary.tsx` to import from `../format.js` instead of `./Header.js`.

- [ ] **Step 2: Delete old component files**

```bash
git rm src/ui/components/ThanatosPanel.tsx
git rm src/ui/components/WorkerPanel.tsx
git rm src/ui/components/PanelSeparator.tsx
git rm src/ui/components/BoulderCompleted.tsx
git rm src/ui/components/BoulderPending.tsx
git rm src/ui/components/PhaseProduce.tsx
git rm src/ui/components/PhaseEvaluate.tsx
git rm src/ui/components/PhaseStack.tsx
git rm src/ui/components/FailureDetail.tsx
git rm src/ui/components/Header.tsx
git rm src/ui/components/SummaryTable.ts
```

- [ ] **Step 3: Rewrite tests/ui/components.test.tsx**

Replace the entire file. The old tests tested the deleted components. The new tests test the new components in integration:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { AgentHeader } from '../../src/ui/components/AgentHeader.js';
import { AgentPanel } from '../../src/ui/components/AgentPanel.js';
import { StatusBar } from '../../src/ui/components/StatusBar.js';
import { CompletionSummary } from '../../src/ui/components/CompletionSummary.js';
import { ProgressBar } from '../../src/ui/components/ProgressBar.js';
import { defaultAgentPanel } from '../../src/ui/state.js';
import type { RunReport } from '../../src/types.js';

afterEach(() => { cleanup(); });

function cap(el: React.ReactElement): string {
  const { lastFrame } = render(el);
  return lastFrame()!;
}

describe('ProgressBar', () => {
  it('renders filled and empty sections', () => {
    const out = cap(<ProgressBar completed={1} total={2} width={10} />);
    expect(out).toContain('━');
  });
});

describe('AgentHeader', () => {
  it('renders agent name and boulder', () => {
    const out = cap(<AgentHeader agent="sisyphus" boulderName="intro" attempt={0} maxAttempts={3} elapsed={5} />);
    expect(out).toContain('SISYPHUS');
    expect(out).toContain('intro');
  });
});

describe('AgentPanel integration', () => {
  it('shows waiting when idle', () => {
    const out = cap(<AgentPanel panel={defaultAgentPanel} elapsed={0} />);
    expect(out).toContain('waiting');
  });
});

describe('StatusBar integration', () => {
  it('renders boulder badges and progress', () => {
    const out = cap(
      <StatusBar
        completed={[{ name: 'done', status: 'passed', attempts: 1, durationMs: 5000 }]}
        activeBoulderName="active"
        pendingNames={['next']}
        total={3}
        elapsed={10}
      />
    );
    expect(out).toContain('done');
    expect(out).toContain('active');
    expect(out).toContain('next');
    expect(out).toContain('1/3');
  });
});

describe('CompletionSummary integration', () => {
  it('renders done with boulder details', () => {
    const report: RunReport = {
      title: 'T', startedAt: '', completedAt: '',
      boulders: [{ name: 'b1', content: '', attempts: 1, status: 'passed' }],
      totalBoulders: 1, passedClean: 1, passedAfterClimb: 0, flagged: 0,
    };
    const out = cap(
      <CompletionSummary
        report={report}
        completedBoulders={[{ name: 'b1', status: 'passed', attempts: 1, durationMs: 5000 }]}
        artifactPath="/out/a.md"
        reportPath="/out/r.json"
        elapsed={5}
      />
    );
    expect(out).toContain('DONE');
    expect(out).toContain('b1');
    expect(out).toContain('/out/a.md');
  });
});
```

- [ ] **Step 4: Delete summary-table test**

```bash
git rm tests/ui/summary-table.test.ts
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass. If any old tests reference deleted components, fix the imports.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(ui): delete v2 components, migrate tests to v3 components"
```

---

## Task 10: Clean Up Legacy State Fields

**Files:**
- Modify: `src/ui/state.ts` — Remove `DispatchEntry`, `dispatchLog` from BoulderUIState, eventually remove `workerPanel` once all consumers are gone
- Modify: `tests/ui/state.test.ts` — Remove dispatchLog and workerPanel test sections

This task removes the dead code paths from state that were only used by the deleted v2 components.

- [ ] **Step 1: Remove DispatchEntry type and addDispatch helper**

In `src/ui/state.ts`:
- Delete the `DispatchEntry` interface (lines 56-60)
- Delete the `addDispatch` helper function (lines 149-156)
- Remove `dispatchLog: DispatchEntry[]` from `BoulderUIState`
- Remove all `addDispatch(...)` calls in the reducer — replace with just returning the boulder state without dispatch entries
- Remove `WorkerPanelState` interface and `defaultWorkerPanel` constant
- Remove `workerPanel` from `UIState` and `initialUIState`
- Remove all `workerPanel` updates from the reducer

- [ ] **Step 2: Update reducer produce:start, stack:start, etc.**

Each reducer case that previously called `addDispatch(...)` should just set `agentPanel` without touching dispatch. Each case that set `workerPanel` should be removed or simplified.

For example, `produce:start` becomes:

```typescript
    case 'produce:start': {
      if (!state.activeBoulder) return state;
      const { attempt, climbFeedback, boulderName } = action.payload;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          phase: 'produce',
          attempt,
          climbFeedback,
          fileChanges: [],
          diffStat: null,
        },
        agentPanel: {
          ...defaultAgentPanel,
          agent: 'sisyphus',
          boulderName: boulderName ?? state.activeBoulder.name,
          attempt,
          maxAttempts: action.payload.maxAttempts,
          startedAt: Date.now(),
          climbFeedback,
          retryHistory: state.agentPanel.retryHistory,
        },
      };
    }
```

- [ ] **Step 3: Update tests/ui/state.test.ts**

Remove the entire `describe('dispatchLog', ...)` block (lines 289-453) and the entire `describe('workerPanel', ...)` block (lines 455-648). These tested dead code paths.

Keep the remaining tests (run:start, boulder:start, produce:start, boulder:end, evaluate:end, run:end) but update them to not reference `dispatchLog` or `workerPanel`.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/state.ts tests/ui/state.test.ts
git commit -m "refactor(state): remove dispatchLog, workerPanel, and addDispatch — v3 uses agentPanel only"
```

---

## Task 11: Build and Smoke Test

**Files:**
- No new files — verify the build and run

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: Clean build with no errors

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Smoke test with MCP**

Launch the app with the can-see MCP tool and take screenshots to verify the new layout:

```
node ./dist/bin/sisyphus.js run examples/ui-test.json
```

Verify:
- Agent panel is the dominant element (top)
- Header shows agent name + boulder + attempt in color
- Streaming lines appear during produce phase
- Check results appear during evaluate phase
- Status bar at bottom shows boulder badges and progress bar
- Completion shows DONE with per-boulder details
- No post-Ink summary table printed after exit

- [ ] **Step 4: Commit any fixups discovered during smoke test**

```bash
git add -A
git commit -m "fix(ui): smoke test fixups for v3 agent-first layout"
```

---

## Task 12: Wire `produce:stream` in the Engine

**Files:**
- Modify: `src/engine.ts`

The engine currently emits `produce:file-change` but not `produce:stream`. To stream raw content, we need to read the output file after the producer finishes and emit its lines. This is a pragmatic first pass — true streaming would require piping the producer's stdout, which is a larger change.

- [ ] **Step 1: After produce:end, read the output and emit produce:stream lines**

In `src/engine.ts`, after the producer finishes and before `produce:end` is emitted, read the output file and emit each line:

```typescript
// After the producer writes, read the file and stream lines to the UI
if (emitter) {
  try {
    const content = await fs.readFile(outputPath, 'utf-8');
    for (const line of content.split('\n')) {
      emitter.emit('produce:stream', { boulderName: boulder.name, line });
    }
  } catch {
    // File might not exist yet if producer failed — that's fine
  }
}
```

This happens between the watcher stopping and `produce:end` being emitted. Lines arrive in a burst rather than truly streaming, but they populate the agent panel with the actual content produced.

- [ ] **Step 2: Run smoke test**

Run: `node ./dist/bin/sisyphus.js run examples/ui-test.json`
Verify streaming lines appear in the agent panel during the produce phase.

- [ ] **Step 3: Commit**

```bash
git add src/engine.ts
git commit -m "feat(engine): emit produce:stream lines after producer writes output"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Add `produce:stream` event | events.ts, state-v3.test.ts |
| 2 | Rewrite UIState with agentPanel | state.ts, state-v3.test.ts |
| 3 | Subscribe to produce:stream in useEngine | useEngine.ts, use-engine.test.ts |
| 4 | Build AgentHeader component | AgentHeader.tsx, agent-panel.test.tsx |
| 5 | Build AgentPanel component | AgentPanel.tsx, agent-panel.test.tsx |
| 6 | Build StatusBar component | StatusBar.tsx, status-bar.test.tsx |
| 7 | Rewrite CompletionSummary | CompletionSummary.tsx, agent-panel.test.tsx |
| 8 | Rewire App.tsx and render.ts | App.tsx, render.ts |
| 9 | Delete old components, migrate tests | 11 deleted files, components.test.tsx |
| 10 | Clean up legacy state fields | state.ts, state.test.ts |
| 11 | Build and smoke test | — |
| 12 | Wire produce:stream in engine | engine.ts |
