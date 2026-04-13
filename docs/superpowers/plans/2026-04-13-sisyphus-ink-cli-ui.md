# Sisyphus Ink CLI UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude Code-inspired live progress UI to Sisyphus using Ink (React for CLI), with an event-driven architecture that keeps the engine decoupled from the UI.

**Architecture:** The engine emits typed lifecycle events via an optional EventEmitter. An Ink-based UI subscribes and renders a progressive disclosure view: active boulder expanded with full phase detail, completed boulders collapsed, pending boulders dimmed. A file watcher tracks filesystem changes during production. Graceful degradation for CI/non-TTY environments.

**Tech Stack:** Ink 5, React 18, ink-spinner, Node.js fs.watch, vitest

**Spec:** `docs/superpowers/specs/2026-04-13-sisyphus-ink-cli-ui-design.md`

---

## File Structure

```
src/
  events.ts              # NEW — TypedEmitter class, SisyphusEvents interface, event payload types
  watcher.ts             # NEW — fs.watch wrapper: start/stop, ignore patterns, change type detection
  engine.ts              # MODIFY — accept optional emitter, add ~15 emit calls
  stack.ts               # MODIFY — accept optional emitter, emit stack:file per source
  ui/
    state.ts             # NEW — Phase enum, BoulderUIState, CompletedBoulder, UIState types
    render.ts            # NEW — Entry point: creates emitter, renders Ink app, prints summary
    App.tsx              # NEW — Root Ink component, composes all children from useEngine state
    hooks/
      useElapsed.ts      # NEW — setInterval-based elapsed seconds counter
      useEngine.ts       # NEW — Subscribes to emitter events, returns UIState via reducer
    components/
      Header.tsx         # NEW — Spec title (cyan bold), layer, elapsed time
      BoulderActive.tsx  # NEW — Bordered box, attempt counter, contains phase child
      BoulderCompleted.tsx # NEW — Single-line ✓/✗ summary
      BoulderPending.tsx # NEW — Dimmed circle + name
      PhaseStack.tsx     # NEW — Source file list with haiku indicators
      PhaseProduce.tsx   # NEW — Spinner + writing status + file changes + climb feedback
      PhaseEvaluate.tsx  # NEW — Structural results + Hades spinner + custom results
      FailureDetail.tsx  # NEW — Full pass/fail criteria table
      Footer.tsx         # NEW — Progress count + elapsed time
      SummaryTable.ts    # NEW — Plain function (not Ink), prints after unmount

bin/sisyphus.ts          # MODIFY — wire Ink UI vs verbose mode based on TTY detection
tsconfig.json            # MODIFY — add jsx: react-jsx
package.json             # MODIFY — add ink, react, ink-spinner, @types/react

tests/
  events.test.ts         # NEW — TypedEmitter tests
  watcher.test.ts        # NEW — File watcher tests
  engine.test.ts         # MODIFY — verify emit calls with mock emitter
  ui/
    state.test.ts        # NEW — State reducer tests
    useEngine.test.ts    # NEW — Hook integration tests
    components.test.ts   # NEW — Component render tests
    summary-table.test.ts # NEW — Summary table output tests
```

---

## Task 1: TypedEmitter and Event Definitions

**Files:**
- Create: `src/events.ts`
- Test: `tests/events.test.ts`

- [ ] **Step 1: Write the failing test for TypedEmitter**

```typescript
// tests/events.test.ts
import { describe, it, expect, vi } from 'vitest';
import { TypedEmitter } from '../src/events.js';
import type { SisyphusEvents } from '../src/events.js';

describe('TypedEmitter', () => {
  it('emits and receives typed events', () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const handler = vi.fn();

    emitter.on('run:start', handler);
    emitter.emit('run:start', {
      title: 'Test Run',
      layer: 'documentation',
      totalBoulders: 3,
      maxRetries: 3,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      title: 'Test Run',
      layer: 'documentation',
      totalBoulders: 3,
      maxRetries: 3,
    });
  });

  it('supports multiple listeners on the same event', () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('boulder:start', handler1);
    emitter.on('boulder:start', handler2);
    emitter.emit('boulder:start', { name: 'test', index: 0, total: 1, maxAttempts: 4 });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('removes listeners with off()', () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const handler = vi.fn();

    emitter.on('run:end', handler);
    emitter.off('run:end', handler);
    emitter.emit('run:end', { report: {} as any });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when emitting with no listeners', () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    expect(() => {
      emitter.emit('run:start', { title: 'T', layer: 'l', totalBoulders: 1, maxRetries: 3 });
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/events.test.ts`
Expected: FAIL — cannot resolve `../src/events.js`

- [ ] **Step 3: Implement TypedEmitter and event type definitions**

```typescript
// src/events.ts
import { EventEmitter } from 'events';
import type { CheckResult, RunReport } from './types.js';

// --- Event payload types ---

export interface RunStartPayload {
  title: string;
  layer: string;
  totalBoulders: number;
  maxRetries: number;
}

export interface RunEndPayload {
  report: RunReport;
}

export interface BoulderStartPayload {
  name: string;
  index: number;
  total: number;
  maxAttempts: number;
}

export interface BoulderEndPayload {
  name: string;
  status: 'passed' | 'flagged';
  attempts: number;
  durationMs: number;
  failures?: CheckResult[];
}

export interface StackStartPayload {
  boulderName: string;
  sourceCount: number;
}

export interface StackFilePayload {
  boulderName: string;
  filePath: string;
  lineCount: number;
  summarized: boolean;
}

export interface StackEndPayload {
  boulderName: string;
  resultCount: number;
}

export interface ProduceStartPayload {
  boulderName: string;
  attempt: number;
  maxAttempts: number;
  climbFeedback?: string;
}

export interface ProduceFileChangePayload {
  boulderName: string;
  filePath: string;
  changeType: 'A' | 'M';
}

export interface ProduceDiffPayload {
  boulderName: string;
  attempt: number;
  diff: string;
}

export interface ProduceEndPayload {
  boulderName: string;
  attempt: number;
  outputLength: number;
}

export interface EvaluateStartPayload {
  boulderName: string;
  attempt: number;
  structuralCount: number;
  customCount: number;
}

export interface EvaluateResultsPayload {
  boulderName: string;
  results: CheckResult[];
}

export interface EvaluateEndPayload {
  boulderName: string;
  attempt: number;
  passed: boolean;
  failures: CheckResult[];
}

export interface ClimbPayload {
  boulderName: string;
  attempt: number;
  failures: CheckResult[];
}

// --- Event map ---

export interface SisyphusEvents {
  'run:start': RunStartPayload;
  'run:end': RunEndPayload;
  'boulder:start': BoulderStartPayload;
  'boulder:end': BoulderEndPayload;
  'stack:start': StackStartPayload;
  'stack:file': StackFilePayload;
  'stack:end': StackEndPayload;
  'produce:start': ProduceStartPayload;
  'produce:file-change': ProduceFileChangePayload;
  'produce:diff': ProduceDiffPayload;
  'produce:end': ProduceEndPayload;
  'evaluate:start': EvaluateStartPayload;
  'evaluate:structural': EvaluateResultsPayload;
  'evaluate:custom': EvaluateResultsPayload;
  'evaluate:end': EvaluateEndPayload;
  'climb': ClimbPayload;
}

// --- TypedEmitter ---

export class TypedEmitter<TEvents extends Record<string, unknown>> {
  private ee = new EventEmitter();

  on<K extends keyof TEvents & string>(event: K, handler: (payload: TEvents[K]) => void): this {
    this.ee.on(event, handler as (...args: any[]) => void);
    return this;
  }

  off<K extends keyof TEvents & string>(event: K, handler: (payload: TEvents[K]) => void): this {
    this.ee.off(event, handler as (...args: any[]) => void);
    return this;
  }

  emit<K extends keyof TEvents & string>(event: K, payload: TEvents[K]): boolean {
    return this.ee.emit(event, payload);
  }

  removeAllListeners(): this {
    this.ee.removeAllListeners();
    return this;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/events.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/events.ts tests/events.test.ts
git commit -m "feat(ui): add TypedEmitter and event payload definitions"
```

---

## Task 2: Wire Emitter into Engine

**Files:**
- Modify: `src/engine.ts:18` (add emitter to options type and emit calls throughout)
- Modify: `tests/engine.test.ts` (add emitter verification tests)

- [ ] **Step 1: Write failing test for engine event emission**

Add to `tests/engine.test.ts`:

```typescript
import { TypedEmitter } from '../src/events.js';
import type { SisyphusEvents } from '../src/events.js';

describe('engine event emission', () => {
  it('emits run:start and run:end events', async () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const events: string[] = [];

    emitter.on('run:start', () => events.push('run:start'));
    emitter.on('run:end', () => events.push('run:end'));

    mockStart.mockResolvedValue('# Heading\n\n| Col A | Col B |\n|---|---|\n| a | b |');

    const output = tmpOutput();
    const report = await runSpec(
      { ...baseSpec, output, boulders: [{
        name: 'test-boulder',
        description: 'Test',
        criteria: [{ check: 'contains-heading', description: 'Has heading', heading: 'Heading', level: 1 }],
      }] },
      { baseDir: import.meta.dirname, emitter },
    );

    expect(events).toEqual(['run:start', 'run:end']);
  });

  it('emits boulder lifecycle events in order', async () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const events: string[] = [];

    emitter.on('boulder:start', () => events.push('boulder:start'));
    emitter.on('stack:start', () => events.push('stack:start'));
    emitter.on('stack:end', () => events.push('stack:end'));
    emitter.on('produce:start', () => events.push('produce:start'));
    emitter.on('produce:end', () => events.push('produce:end'));
    emitter.on('evaluate:start', () => events.push('evaluate:start'));
    emitter.on('evaluate:structural', () => events.push('evaluate:structural'));
    emitter.on('evaluate:end', () => events.push('evaluate:end'));
    emitter.on('boulder:end', () => events.push('boulder:end'));

    mockStart.mockResolvedValue('# Heading\n\nSome content here.');

    const output = tmpOutput();
    await runSpec(
      { ...baseSpec, output, boulders: [{
        name: 'lifecycle-test',
        description: 'Test',
        criteria: [{ check: 'contains-heading', description: 'Has heading', heading: 'Heading', level: 1 }],
      }] },
      { baseDir: import.meta.dirname, emitter },
    );

    expect(events).toEqual([
      'boulder:start', 'stack:start', 'stack:end',
      'produce:start', 'produce:end',
      'evaluate:start', 'evaluate:structural', 'evaluate:end',
      'boulder:end',
    ]);
  });

  it('emits climb event on retry', async () => {
    const emitter = new TypedEmitter<SisyphusEvents>();
    const climbPayloads: any[] = [];

    emitter.on('climb', (p) => climbPayloads.push(p));

    // First attempt fails (no heading), second passes
    mockStart
      .mockResolvedValueOnce('No heading here')
      .mockResolvedValueOnce('# Heading\n\nContent');

    const output = tmpOutput();
    await runSpec(
      { ...baseSpec, output, boulders: [{
        name: 'climb-test',
        description: 'Test',
        criteria: [{ check: 'contains-heading', description: 'Has heading', heading: 'Heading', level: 1 }],
      }] },
      { baseDir: import.meta.dirname, emitter },
    );

    expect(climbPayloads).toHaveLength(1);
    expect(climbPayloads[0].boulderName).toBe('climb-test');
    expect(climbPayloads[0].attempt).toBe(0);
    expect(climbPayloads[0].failures.length).toBeGreaterThan(0);
  });

  it('works without emitter (backwards compatible)', async () => {
    mockStart.mockResolvedValue('# Heading\n\nContent');

    const output = tmpOutput();
    const report = await runSpec(
      { ...baseSpec, output, boulders: [{
        name: 'no-emitter',
        description: 'Test',
        criteria: [{ check: 'contains-heading', description: 'Has heading', heading: 'Heading', level: 1 }],
      }] },
      { baseDir: import.meta.dirname },
    );

    expect(report.passedClean).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine.test.ts`
Expected: FAIL — `emitter` not accepted in options type

- [ ] **Step 3: Add emitter to engine options and emit events**

Modify `src/engine.ts`:

1. Add import at top:
```typescript
import type { TypedEmitter, SisyphusEvents } from './events.js';
```

2. Change the options type on line 18:
```typescript
export async function runSpec(
  spec: Spec,
  options?: {
    baseDir?: string;
    lessonsDir?: string;
    verbose?: boolean;
    emitter?: TypedEmitter<SisyphusEvents>;
  },
): Promise<RunReport> {
```

3. Extract emitter after line 46:
```typescript
const emitter = options?.emitter;
```

4. Add emit calls at each lifecycle point (insert alongside existing `log()` calls):

Before the boulder loop (after `const log = ...`):
```typescript
emitter?.emit('run:start', {
  title: spec.title,
  layer: spec.layer,
  totalBoulders: spec.boulders.length,
  maxRetries: maxRetries,
});
```

At top of boulder loop (after `try {`):
```typescript
const boulderStart = Date.now();
emitter?.emit('boulder:start', {
  name: boulder.name,
  index: spec.boulders.indexOf(boulder),
  total: spec.boulders.length,
  maxAttempts: boulderMaxRetries + 1,
});
```

Before stacking:
```typescript
emitter?.emit('stack:start', { boulderName: boulder.name, sourceCount: boulder.stack?.length ?? 0 });
```

After stacking:
```typescript
emitter?.emit('stack:end', { boulderName: boulder.name, resultCount: stackResults.length });
```

Before `start()` (producer):
```typescript
emitter?.emit('produce:start', {
  boulderName: boulder.name,
  attempt: attempt,
  maxAttempts: boulderMaxRetries + 1,
  climbFeedback,
});
```

After `start()` returns:
```typescript
emitter?.emit('produce:end', {
  boulderName: boulder.name,
  attempt: attempt,
  outputLength: lastOutput.length,
});
```

Before structural checks:
```typescript
const structuralCriteria = boulder.criteria.filter(c => c.check !== 'custom');
const customCriteria = boulder.criteria.filter(c => c.check === 'custom');
emitter?.emit('evaluate:start', {
  boulderName: boulder.name,
  attempt: attempt,
  structuralCount: structuralCriteria.length,
  customCount: customCriteria.length,
});
```

After structural checks:
```typescript
emitter?.emit('evaluate:structural', { boulderName: boulder.name, results: structuralResults });
```

After custom criteria (inside `if (customCriteria.length > 0)`):
```typescript
emitter?.emit('evaluate:custom', { boulderName: boulder.name, results: customResults });
```

After all checks combined:
```typescript
emitter?.emit('evaluate:end', {
  boulderName: boulder.name,
  attempt: attempt,
  passed: failures.length === 0,
  failures,
});
```

On pass (before `break`):
```typescript
emitter?.emit('boulder:end', {
  name: boulder.name,
  status: 'passed',
  attempts: attempt + 1,
  durationMs: Date.now() - boulderStart,
});
```

On climb (before retry):
```typescript
emitter?.emit('climb', { boulderName: boulder.name, attempt, failures });
```

On flag:
```typescript
emitter?.emit('boulder:end', {
  name: boulder.name,
  status: 'flagged',
  attempts: boulderMaxRetries + 1,
  durationMs: Date.now() - boulderStart,
  failures: lastFailures,
});
```

On error (in catch block):
```typescript
emitter?.emit('boulder:end', {
  name: boulder.name,
  status: 'flagged',
  attempts: 1,
  durationMs: Date.now() - boulderStart,
  failures: [{ criterion: 'execution', pass: false, message: `Boulder failed with error: ${err.message}` }],
});
```

After assembly + report build (before `return report`):
```typescript
emitter?.emit('run:end', { report });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine.test.ts`
Expected: ALL PASS (existing tests + new emitter tests)

- [ ] **Step 5: Commit**

```bash
git add src/engine.ts tests/engine.test.ts
git commit -m "feat(ui): wire TypedEmitter into engine with lifecycle events"
```

---

## Task 3: Wire Emitter into Stack

**Files:**
- Modify: `src/stack.ts:9` (add optional emitter parameter, emit `stack:file` per source)
- Modify: `src/engine.ts` (pass emitter to `stack()` call)
- Modify: `tests/engine.test.ts` (verify stack:file events)

- [ ] **Step 1: Write failing test for stack:file events**

Add to the `engine event emission` describe block in `tests/engine.test.ts`:

```typescript
it('emits stack:file events per source file', async () => {
  const emitter = new TypedEmitter<SisyphusEvents>();
  const stackFiles: any[] = [];

  emitter.on('stack:file', (p) => stackFiles.push(p));

  mockStart.mockResolvedValue('# Heading\n\nContent');

  const output = tmpOutput();
  await runSpec(
    { ...baseSpec, output, boulders: [{
      name: 'stack-file-test',
      description: 'Test',
      stack: [{ type: 'analysis', source: path.join(import.meta.dirname, 'fixtures', 'sample-source.txt') }],
      criteria: [{ check: 'contains-heading', description: 'Has heading', heading: 'Heading', level: 1 }],
    }] },
    { baseDir: import.meta.dirname, emitter },
  );

  expect(stackFiles.length).toBeGreaterThan(0);
  expect(stackFiles[0].boulderName).toBe('stack-file-test');
  expect(stackFiles[0].filePath).toContain('sample-source.txt');
  expect(typeof stackFiles[0].lineCount).toBe('number');
  expect(typeof stackFiles[0].summarized).toBe('boolean');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine.test.ts`
Expected: FAIL — stack:file events not emitted

- [ ] **Step 3: Add emitter to stack function**

Modify `src/stack.ts`:

1. Add import:
```typescript
import type { TypedEmitter, SisyphusEvents } from './events.js';
```

2. Add emitter parameter and boulderName:
```typescript
export async function stack(
  sources: StackSource[] | undefined,
  baseDir: string,
  emitter?: TypedEmitter<SisyphusEvents>,
  boulderName?: string,
): Promise<StackResult[]> {
```

3. Inside the file loop (after `const lineCount = content.split('\n').length;` on line 30), add:
```typescript
const summarized = lineCount > LARGE_FILE_THRESHOLD;
emitter?.emit('stack:file', {
  boulderName: boulderName ?? 'unknown',
  filePath,
  lineCount,
  summarized,
});
```

4. In `src/engine.ts`, update the `stack()` call (line 60) to pass emitter and boulder name:
```typescript
const stackResults = await stack(boulder.stack, baseDir, emitter, boulder.name);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine.test.ts`
Expected: ALL PASS

Also run full suite to verify no regressions:

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/stack.ts src/engine.ts tests/engine.test.ts
git commit -m "feat(ui): emit stack:file events per source file"
```

---

## Task 4: File Watcher

**Files:**
- Create: `src/watcher.ts`
- Test: `tests/watcher.test.ts`

- [ ] **Step 1: Write failing test for FileWatcher**

```typescript
// tests/watcher.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileWatcher } from '../src/watcher.js';

describe('FileWatcher', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects new file creation', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-watcher-'));
    const watcher = new FileWatcher(tmpDir);
    const changes: any[] = [];

    watcher.on('change', (event) => changes.push(event));
    watcher.start();

    // Write a file
    const testFile = path.join(tmpDir, 'test.txt');
    await fs.writeFile(testFile, 'hello');

    // Give fs.watch time to fire
    await new Promise(r => setTimeout(r, 300));

    watcher.stop();

    expect(changes.length).toBeGreaterThan(0);
    expect(changes.some(c => c.filePath.includes('test.txt'))).toBe(true);
  });

  it('ignores files matching ignore patterns', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-watcher-'));
    const gitDir = path.join(tmpDir, '.git');
    await fs.mkdir(gitDir);

    const watcher = new FileWatcher(tmpDir, { ignore: ['.git'] });
    const changes: any[] = [];

    watcher.on('change', (event) => changes.push(event));
    watcher.start();

    await fs.writeFile(path.join(gitDir, 'index'), 'data');
    await fs.writeFile(path.join(tmpDir, 'real.txt'), 'data');

    await new Promise(r => setTimeout(r, 300));

    watcher.stop();

    const gitChanges = changes.filter(c => c.filePath.includes('.git'));
    expect(gitChanges).toHaveLength(0);
  });

  it('stop() prevents further events', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-watcher-'));
    const watcher = new FileWatcher(tmpDir);
    const changes: any[] = [];

    watcher.on('change', (event) => changes.push(event));
    watcher.start();
    watcher.stop();

    await fs.writeFile(path.join(tmpDir, 'after-stop.txt'), 'data');
    await new Promise(r => setTimeout(r, 300));

    const afterStopChanges = changes.filter(c => c.filePath.includes('after-stop'));
    expect(afterStopChanges).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/watcher.test.ts`
Expected: FAIL — cannot resolve `../src/watcher.js`

- [ ] **Step 3: Implement FileWatcher**

```typescript
// src/watcher.ts
import { watch, type FSWatcher } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface FileChangeEvent {
  filePath: string;
  changeType: 'A' | 'M';
}

export interface WatcherOptions {
  ignore?: string[];
}

const DEFAULT_IGNORE = ['.git', 'node_modules', 'dist', '.superpowers'];

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private ee = new EventEmitter();
  private baseDir: string;
  private ignorePatterns: string[];
  private knownFiles = new Set<string>();

  constructor(baseDir: string, options?: WatcherOptions) {
    this.baseDir = baseDir;
    this.ignorePatterns = options?.ignore ?? DEFAULT_IGNORE;
  }

  on(event: 'change', handler: (payload: FileChangeEvent) => void): this {
    this.ee.on(event, handler);
    return this;
  }

  start(): void {
    try {
      this.watcher = watch(this.baseDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        // Normalize to forward slashes for cross-platform consistency
        const normalized = filename.split(path.sep).join('/');

        // Check ignore patterns
        for (const pattern of this.ignorePatterns) {
          if (normalized.startsWith(pattern + '/') || normalized === pattern) return;
        }

        const fullPath = path.join(this.baseDir, filename);
        const changeType = this.knownFiles.has(fullPath) ? 'M' as const : 'A' as const;
        this.knownFiles.add(fullPath);

        this.ee.emit('change', { filePath: normalized, changeType });
      });
    } catch {
      // fs.watch may not support recursive on all platforms — degrade silently
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/watcher.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/watcher.ts tests/watcher.test.ts
git commit -m "feat(ui): add FileWatcher for real-time filesystem change detection"
```

---

## Task 5: Git Diff Utility

**Files:**
- Modify: `src/watcher.ts` (add `gitDiffStat` function)
- Modify: `tests/watcher.test.ts` (add diff test)

- [ ] **Step 1: Write failing test for gitDiffStat**

Add to `tests/watcher.test.ts`:

```typescript
import { gitDiffStat } from '../src/watcher.js';

describe('gitDiffStat', () => {
  it('returns empty string when no changes', async () => {
    // Run in the actual repo (which should have a clean working tree at this point in tests)
    const result = await gitDiffStat(import.meta.dirname);
    // Just verify it returns a string and doesn't throw
    expect(typeof result).toBe('string');
  });

  it('returns diff stat output for changed files', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-diff-'));

    // Initialize a git repo
    const { execSync } = await import('child_process');
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

    // Create initial commit
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'line 1\n');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

    // Modify file
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'line 1\nline 2\n');

    const result = await gitDiffStat(tmpDir);
    expect(result).toContain('file.txt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/watcher.test.ts`
Expected: FAIL — `gitDiffStat` not exported

- [ ] **Step 3: Implement gitDiffStat**

Add to `src/watcher.ts`:

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function gitDiffStat(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--stat'], { cwd, timeout: 5000 });
    return stdout.trim();
  } catch {
    return '';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/watcher.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/watcher.ts tests/watcher.test.ts
git commit -m "feat(ui): add gitDiffStat utility for post-production diff summary"
```

---

## Task 6: Install Ink Dependencies and Configure TSX

**Files:**
- Modify: `package.json` (add dependencies)
- Modify: `tsconfig.json` (add jsx support)

- [ ] **Step 1: Install Ink, React, and ink-spinner**

```bash
npm install ink react ink-spinner
npm install --save-dev @types/react
```

- [ ] **Step 2: Update tsconfig.json for JSX support**

Add `"jsx": "react-jsx"` to `compilerOptions` in `tsconfig.json`.

Add `"src/ui/**/*"` to the `include` array (though `"src/**/*"` already covers this).

The full compilerOptions should look like:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"],
    "jsx": "react-jsx"
  },
  "include": ["src/**/*", "bin/**/*", "layers/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Clean compilation with no errors

- [ ] **Step 4: Verify tests still pass**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: add ink, react, ink-spinner dependencies and JSX support"
```

---

## Task 7: UI State Types

**Files:**
- Create: `src/ui/state.ts`
- Test: `tests/ui/state.test.ts`

- [ ] **Step 1: Write failing test for state reducer**

```typescript
// tests/ui/state.test.ts
import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState } from '../../src/ui/state.js';
import type { UIState } from '../../src/ui/state.js';

describe('uiReducer', () => {
  it('handles run:start by setting title and pending boulders', () => {
    const state = uiReducer(initialUIState, {
      type: 'run:start',
      payload: { title: 'Test', layer: 'documentation', totalBoulders: 3, maxRetries: 3 },
    });

    expect(state.title).toBe('Test');
    expect(state.layer).toBe('documentation');
    expect(state.totalBoulders).toBe(3);
  });

  it('handles boulder:start by creating active boulder', () => {
    let state = uiReducer(initialUIState, {
      type: 'run:start',
      payload: { title: 'Test', layer: 'documentation', totalBoulders: 2, maxRetries: 3 },
    });
    state = uiReducer(state, {
      type: 'boulder:start',
      payload: { name: 'intro', index: 0, total: 2, maxAttempts: 4 },
    });

    expect(state.activeBoulder).not.toBeNull();
    expect(state.activeBoulder!.name).toBe('intro');
    expect(state.activeBoulder!.phase).toBe('idle');
  });

  it('handles produce:start by setting phase to produce', () => {
    let state = uiReducer(initialUIState, {
      type: 'run:start',
      payload: { title: 'Test', layer: 'documentation', totalBoulders: 1, maxRetries: 3 },
    });
    state = uiReducer(state, {
      type: 'boulder:start',
      payload: { name: 'intro', index: 0, total: 1, maxAttempts: 4 },
    });
    state = uiReducer(state, {
      type: 'produce:start',
      payload: { boulderName: 'intro', attempt: 0, maxAttempts: 4 },
    });

    expect(state.activeBoulder!.phase).toBe('produce');
    expect(state.activeBoulder!.attempt).toBe(0);
  });

  it('handles boulder:end by moving active to completed', () => {
    let state = uiReducer(initialUIState, {
      type: 'run:start',
      payload: { title: 'Test', layer: 'documentation', totalBoulders: 1, maxRetries: 3 },
    });
    state = uiReducer(state, {
      type: 'boulder:start',
      payload: { name: 'intro', index: 0, total: 1, maxAttempts: 4 },
    });
    state = uiReducer(state, {
      type: 'boulder:end',
      payload: { name: 'intro', status: 'passed', attempts: 1, durationMs: 5000 },
    });

    expect(state.activeBoulder).toBeNull();
    expect(state.completedBoulders).toHaveLength(1);
    expect(state.completedBoulders[0].name).toBe('intro');
    expect(state.completedBoulders[0].status).toBe('passed');
  });

  it('handles evaluate:end with failures by setting phase to failed', () => {
    let state = uiReducer(initialUIState, {
      type: 'run:start',
      payload: { title: 'Test', layer: 'documentation', totalBoulders: 1, maxRetries: 3 },
    });
    state = uiReducer(state, {
      type: 'boulder:start',
      payload: { name: 'intro', index: 0, total: 1, maxAttempts: 4 },
    });
    state = uiReducer(state, {
      type: 'evaluate:end',
      payload: {
        boulderName: 'intro', attempt: 0, passed: false,
        failures: [{ criterion: 'word-count', pass: false, message: 'Too short' }],
      },
    });

    expect(state.activeBoulder!.phase).toBe('failed');
    expect(state.activeBoulder!.allResults).toHaveLength(1);
  });

  it('handles run:end by storing report', () => {
    const state = uiReducer(initialUIState, {
      type: 'run:end',
      payload: { report: { title: 'T', startedAt: '', completedAt: '', boulders: [], totalBoulders: 0, passedClean: 0, passedAfterClimb: 0, flagged: 0 } },
    });

    expect(state.report).not.toBeNull();
    expect(state.report!.title).toBe('T');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/state.test.ts`
Expected: FAIL — cannot resolve `../../src/ui/state.js`

- [ ] **Step 3: Implement UI state types and reducer**

```typescript
// src/ui/state.ts
import type { CheckResult, RunReport } from '../types.js';
import type {
  RunStartPayload, RunEndPayload, BoulderStartPayload, BoulderEndPayload,
  StackStartPayload, StackFilePayload, StackEndPayload,
  ProduceStartPayload, ProduceFileChangePayload, ProduceDiffPayload, ProduceEndPayload,
  EvaluateStartPayload, EvaluateResultsPayload, EvaluateEndPayload, ClimbPayload,
} from '../events.js';

export type Phase = 'idle' | 'stack' | 'produce' | 'evaluate' | 'failed';

export interface StackFileEntry {
  path: string;
  lines: number;
  summarized: boolean;
}

export interface FileChangeEntry {
  filePath: string;
  changeType: 'A' | 'M';
}

export interface BoulderUIState {
  name: string;
  phase: Phase;
  attempt: number;
  maxAttempts: number;
  startTime: number;
  stackFiles: StackFileEntry[];
  fileChanges: FileChangeEntry[];
  diffStat: string;
  climbFeedback?: string;
  structuralResults: CheckResult[];
  customResults: CheckResult[];
  allResults: CheckResult[];
}

export interface CompletedBoulder {
  name: string;
  status: 'passed' | 'flagged';
  attempts: number;
  durationMs: number;
  failures?: CheckResult[];
}

export interface UIState {
  title: string;
  layer: string;
  totalBoulders: number;
  activeBoulder: BoulderUIState | null;
  completedBoulders: CompletedBoulder[];
  pendingBoulderNames: string[];
  report: RunReport | null;
}

export const initialUIState: UIState = {
  title: '',
  layer: '',
  totalBoulders: 0,
  activeBoulder: null,
  completedBoulders: [],
  pendingBoulderNames: [],
  report: null,
};

export type UIAction =
  | { type: 'run:start'; payload: RunStartPayload }
  | { type: 'run:end'; payload: RunEndPayload }
  | { type: 'boulder:start'; payload: BoulderStartPayload }
  | { type: 'boulder:end'; payload: BoulderEndPayload }
  | { type: 'stack:start'; payload: StackStartPayload }
  | { type: 'stack:file'; payload: StackFilePayload }
  | { type: 'stack:end'; payload: StackEndPayload }
  | { type: 'produce:start'; payload: ProduceStartPayload }
  | { type: 'produce:file-change'; payload: ProduceFileChangePayload }
  | { type: 'produce:diff'; payload: ProduceDiffPayload }
  | { type: 'produce:end'; payload: ProduceEndPayload }
  | { type: 'evaluate:start'; payload: EvaluateStartPayload }
  | { type: 'evaluate:structural'; payload: EvaluateResultsPayload }
  | { type: 'evaluate:custom'; payload: EvaluateResultsPayload }
  | { type: 'evaluate:end'; payload: EvaluateEndPayload }
  | { type: 'climb'; payload: ClimbPayload };

function freshBoulder(name: string, maxAttempts: number): BoulderUIState {
  return {
    name,
    phase: 'idle',
    attempt: 0,
    maxAttempts,
    startTime: Date.now(),
    stackFiles: [],
    fileChanges: [],
    diffStat: '',
    structuralResults: [],
    customResults: [],
    allResults: [],
  };
}

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'run:start':
      return {
        ...state,
        title: action.payload.title,
        layer: action.payload.layer,
        totalBoulders: action.payload.totalBoulders,
      };

    case 'run:end':
      return { ...state, report: action.payload.report };

    case 'boulder:start':
      return {
        ...state,
        activeBoulder: freshBoulder(action.payload.name, action.payload.maxAttempts),
        pendingBoulderNames: state.pendingBoulderNames.filter(n => n !== action.payload.name),
      };

    case 'boulder:end': {
      const completed: CompletedBoulder = {
        name: action.payload.name,
        status: action.payload.status,
        attempts: action.payload.attempts,
        durationMs: action.payload.durationMs,
        failures: action.payload.failures,
      };
      return {
        ...state,
        activeBoulder: null,
        completedBoulders: [...state.completedBoulders, completed],
      };
    }

    case 'stack:start':
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: { ...state.activeBoulder, phase: 'stack', stackFiles: [] },
      };

    case 'stack:file':
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          stackFiles: [
            ...state.activeBoulder.stackFiles,
            { path: action.payload.filePath, lines: action.payload.lineCount, summarized: action.payload.summarized },
          ],
        },
      };

    case 'stack:end':
      return state; // Phase transitions on next event

    case 'produce:start':
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          phase: 'produce',
          attempt: action.payload.attempt,
          climbFeedback: action.payload.climbFeedback,
          fileChanges: [],
          diffStat: '',
        },
      };

    case 'produce:file-change':
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          fileChanges: [
            ...state.activeBoulder.fileChanges,
            { filePath: action.payload.filePath, changeType: action.payload.changeType },
          ],
        },
      };

    case 'produce:diff':
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: { ...state.activeBoulder, diffStat: action.payload.diff },
      };

    case 'produce:end':
      return state; // Phase transitions on next event

    case 'evaluate:start':
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          phase: 'evaluate',
          structuralResults: [],
          customResults: [],
          allResults: [],
        },
      };

    case 'evaluate:structural':
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: { ...state.activeBoulder, structuralResults: action.payload.results },
      };

    case 'evaluate:custom':
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: { ...state.activeBoulder, customResults: action.payload.results },
      };

    case 'evaluate:end': {
      if (!state.activeBoulder) return state;
      const allResults = [...state.activeBoulder.structuralResults, ...state.activeBoulder.customResults];
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          phase: action.payload.passed ? state.activeBoulder.phase : 'failed',
          allResults,
        },
      };
    }

    case 'climb':
      return state; // Climb feedback arrives via next produce:start

    default:
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/state.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ui/state.ts tests/ui/state.test.ts
git commit -m "feat(ui): add UI state types and reducer"
```

---

## Task 8: useElapsed Hook

**Files:**
- Create: `src/ui/hooks/useElapsed.ts`
- Test: `tests/ui/use-elapsed.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/ui/use-elapsed.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Note: @testing-library/react is needed for hook testing.
// If not already installed, install it: npm install --save-dev @testing-library/react
// Alternative: test via a minimal Ink component render.

// For simplicity, test useElapsed via a direct unit test of its logic:
import { elapsedSeconds } from '../../src/ui/hooks/useElapsed.js';

describe('elapsedSeconds', () => {
  it('returns 0 when startTime is now', () => {
    expect(elapsedSeconds(Date.now())).toBe(0);
  });

  it('returns correct seconds for past startTime', () => {
    const fiveSecondsAgo = Date.now() - 5000;
    const result = elapsedSeconds(fiveSecondsAgo);
    expect(result).toBeGreaterThanOrEqual(4);
    expect(result).toBeLessThanOrEqual(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/use-elapsed.test.ts`
Expected: FAIL — cannot resolve module

- [ ] **Step 3: Implement useElapsed**

```typescript
// src/ui/hooks/useElapsed.ts
import { useState, useEffect } from 'react';

export function elapsedSeconds(startTime: number): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

export function useElapsed(startTime: number | null): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (startTime === null) return;

    setSeconds(elapsedSeconds(startTime));

    const interval = setInterval(() => {
      setSeconds(elapsedSeconds(startTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return seconds;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/use-elapsed.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useElapsed.ts tests/ui/use-elapsed.test.ts
git commit -m "feat(ui): add useElapsed hook and elapsedSeconds utility"
```

---

## Task 9: Presentation Components (Header, Footer, BoulderPending, BoulderCompleted)

**Files:**
- Create: `src/ui/components/Header.tsx`
- Create: `src/ui/components/Footer.tsx`
- Create: `src/ui/components/BoulderPending.tsx`
- Create: `src/ui/components/BoulderCompleted.tsx`
- Test: `tests/ui/components.test.tsx`

- [ ] **Step 1: Write failing tests for presentation components**

```tsx
// tests/ui/components.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Header } from '../../src/ui/components/Header.js';
import { Footer } from '../../src/ui/components/Footer.js';
import { BoulderPending } from '../../src/ui/components/BoulderPending.js';
import { BoulderCompleted } from '../../src/ui/components/BoulderCompleted.js';

describe('Header', () => {
  it('renders title and layer', () => {
    const { lastFrame } = render(<Header title="Migration Report" layer="documentation" elapsed={42} />);
    const output = lastFrame()!;
    expect(output).toContain('Migration Report');
    expect(output).toContain('documentation');
    expect(output).toContain('42s');
  });
});

describe('Footer', () => {
  it('renders progress count and elapsed time', () => {
    const { lastFrame } = render(<Footer completed={2} total={4} elapsed={30} />);
    const output = lastFrame()!;
    expect(output).toContain('2/4');
    expect(output).toContain('30s');
  });
});

describe('BoulderPending', () => {
  it('renders dimmed boulder name', () => {
    const { lastFrame } = render(<BoulderPending name="recommendations" />);
    const output = lastFrame()!;
    expect(output).toContain('recommendations');
  });
});

describe('BoulderCompleted', () => {
  it('renders passed boulder with check mark', () => {
    const { lastFrame } = render(
      <BoulderCompleted name="intro" status="passed" attempts={1} durationMs={12000} />
    );
    const output = lastFrame()!;
    expect(output).toContain('✓');
    expect(output).toContain('intro');
    expect(output).toContain('12s');
  });

  it('renders flagged boulder with x mark', () => {
    const { lastFrame } = render(
      <BoulderCompleted name="broken" status="flagged" attempts={4} durationMs={120000} />
    );
    const output = lastFrame()!;
    expect(output).toContain('✗');
    expect(output).toContain('broken');
  });

  it('shows climb info when attempts > 1 and passed', () => {
    const { lastFrame } = render(
      <BoulderCompleted
        name="entity-map"
        status="passed"
        attempts={2}
        durationMs={48000}
        failures={[{ criterion: 'word-count-gte', pass: false, message: '187/250 words' }]}
      />
    );
    const output = lastFrame()!;
    expect(output).toContain('entity-map');
    expect(output).toContain('2');
    expect(output).toContain('word-count-gte');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/components.test.tsx`
Expected: FAIL — cannot resolve components

Note: You may need to install `ink-testing-library`:
```bash
npm install --save-dev ink-testing-library
```

- [ ] **Step 3: Implement Header component**

```tsx
// src/ui/components/Header.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  title: string;
  layer: string;
  elapsed: number;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function Header({ title, layer, elapsed }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">⚡ Sisyphus — {title}</Text>
      <Text dimColor>{layer} · {formatElapsed(elapsed)}</Text>
    </Box>
  );
}
```

- [ ] **Step 4: Implement Footer component**

```tsx
// src/ui/components/Footer.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface FooterProps {
  completed: number;
  total: number;
  elapsed: number;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function Footer({ completed, total, elapsed }: FooterProps) {
  return (
    <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
      <Text dimColor>{completed}/{total} boulders · {formatElapsed(elapsed)}</Text>
    </Box>
  );
}
```

- [ ] **Step 5: Implement BoulderPending component**

```tsx
// src/ui/components/BoulderPending.tsx
import React from 'react';
import { Text } from 'ink';

interface BoulderPendingProps {
  name: string;
}

export function BoulderPending({ name }: BoulderPendingProps) {
  return <Text dimColor>  ◦ {name}</Text>;
}
```

- [ ] **Step 6: Implement BoulderCompleted component**

```tsx
// src/ui/components/BoulderCompleted.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { CheckResult } from '../../types.js';

interface BoulderCompletedProps {
  name: string;
  status: 'passed' | 'flagged';
  attempts: number;
  durationMs: number;
  failures?: CheckResult[];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function BoulderCompleted({ name, status, attempts, durationMs, failures }: BoulderCompletedProps) {
  const icon = status === 'flagged' ? '✗' : '✓';
  const iconColor = status === 'flagged' ? 'red' : attempts > 1 ? 'yellow' : 'green';
  const statusLabel = status === 'flagged'
    ? 'flagged'
    : attempts > 1
      ? `passed after ${attempts} attempts`
      : 'passed';

  return (
    <Box flexDirection="column">
      <Text>
        <Text color={iconColor}>{icon}</Text>
        {' '}
        <Text bold>{name}</Text>
        {' '}
        <Text dimColor>— {statusLabel} · {formatDuration(durationMs)}</Text>
      </Text>
      {attempts > 1 && failures && failures.length > 0 && (
        <Text dimColor>    attempt 1: {failures.map(f => f.criterion).join(', ')}</Text>
      )}
    </Box>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/ui/components.test.tsx`
Expected: PASS (all 6 tests)

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/Header.tsx src/ui/components/Footer.tsx src/ui/components/BoulderPending.tsx src/ui/components/BoulderCompleted.tsx tests/ui/components.test.tsx
git commit -m "feat(ui): add Header, Footer, BoulderPending, BoulderCompleted components"
```

---

## Task 10: Phase Components (PhaseStack, PhaseProduce, PhaseEvaluate, FailureDetail)

**Files:**
- Create: `src/ui/components/PhaseStack.tsx`
- Create: `src/ui/components/PhaseProduce.tsx`
- Create: `src/ui/components/PhaseEvaluate.tsx`
- Create: `src/ui/components/FailureDetail.tsx`
- Modify: `tests/ui/components.test.tsx` (add phase component tests)

- [ ] **Step 1: Write failing tests for phase components**

Add to `tests/ui/components.test.tsx`:

```tsx
import { PhaseStack } from '../../src/ui/components/PhaseStack.js';
import { PhaseProduce } from '../../src/ui/components/PhaseProduce.js';
import { PhaseEvaluate } from '../../src/ui/components/PhaseEvaluate.js';
import { FailureDetail } from '../../src/ui/components/FailureDetail.js';

describe('PhaseStack', () => {
  it('renders file list', () => {
    const files = [
      { path: 'src/data.ts', lines: 42, summarized: false },
      { path: 'data/big.csv', lines: 500, summarized: true },
    ];
    const { lastFrame } = render(<PhaseStack files={files} />);
    const output = lastFrame()!;
    expect(output).toContain('src/data.ts');
    expect(output).toContain('42');
    expect(output).toContain('data/big.csv');
    expect(output).toContain('summarized');
  });
});

describe('PhaseProduce', () => {
  it('renders spinner and writing status', () => {
    const { lastFrame } = render(<PhaseProduce elapsed={12} fileChanges={[]} diffStat="" />);
    const output = lastFrame()!;
    expect(output).toContain('writing');
    expect(output).toContain('12s');
  });

  it('renders climb feedback when provided', () => {
    const { lastFrame } = render(
      <PhaseProduce elapsed={18} climbFeedback="FAIL: word-count — 187/250 words" fileChanges={[]} diffStat="" />
    );
    const output = lastFrame()!;
    expect(output).toContain('climbing');
    expect(output).toContain('word-count');
  });

  it('renders file changes when present', () => {
    const fileChanges = [
      { filePath: 'src/risks.ts', changeType: 'M' as const },
      { filePath: 'src/new-file.ts', changeType: 'A' as const },
    ];
    const { lastFrame } = render(<PhaseProduce elapsed={5} fileChanges={fileChanges} diffStat="" />);
    const output = lastFrame()!;
    expect(output).toContain('src/risks.ts');
    expect(output).toContain('src/new-file.ts');
  });

  it('renders diff stat when available', () => {
    const { lastFrame } = render(
      <PhaseProduce elapsed={20} fileChanges={[]} diffStat=" src/risks.ts | 15 ++++---\n 1 file changed" />
    );
    const output = lastFrame()!;
    expect(output).toContain('src/risks.ts');
  });
});

describe('PhaseEvaluate', () => {
  it('renders structural results', () => {
    const structural = [
      { criterion: 'contains-heading', pass: true, message: 'Found heading' },
      { criterion: 'word-count-gte', pass: false, message: '187/250 words' },
    ];
    const { lastFrame } = render(<PhaseEvaluate structuralResults={structural} customResults={[]} />);
    const output = lastFrame()!;
    expect(output).toContain('✓');
    expect(output).toContain('contains-heading');
    expect(output).toContain('✗');
    expect(output).toContain('word-count-gte');
  });

  it('renders custom results after structural', () => {
    const structural = [{ criterion: 'contains-heading', pass: true, message: 'ok' }];
    const custom = [{ criterion: 'custom: has mitigation', pass: true, message: 'Found' }];
    const { lastFrame } = render(<PhaseEvaluate structuralResults={structural} customResults={custom} />);
    const output = lastFrame()!;
    expect(output).toContain('has mitigation');
  });
});

describe('FailureDetail', () => {
  it('renders all criteria results with pass/fail indicators', () => {
    const results = [
      { criterion: 'contains-heading', pass: true, message: 'Found' },
      { criterion: 'word-count-gte', pass: false, message: '187/250 words' },
      { criterion: 'custom: accuracy', pass: false, message: 'Data does not match source' },
    ];
    const { lastFrame } = render(<FailureDetail results={results} />);
    const output = lastFrame()!;
    expect(output).toContain('contains-heading');
    expect(output).toContain('word-count-gte');
    expect(output).toContain('187/250');
    expect(output).toContain('accuracy');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/components.test.tsx`
Expected: FAIL — cannot resolve phase components

- [ ] **Step 3: Implement PhaseStack**

```tsx
// src/ui/components/PhaseStack.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { StackFileEntry } from '../state.js';

interface PhaseStackProps {
  files: StackFileEntry[];
}

export function PhaseStack({ files }: PhaseStackProps) {
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text dimColor>STACK</Text>
      {files.map((f, i) => (
        <Text key={i}>
          <Text color="green">  ✓</Text>
          {' '}
          <Text dimColor>{f.path}</Text>
          {' '}
          <Text dimColor>({f.lines} lines{f.summarized ? ' · summarized' : ''})</Text>
        </Text>
      ))}
      {files.length === 0 && <Text dimColor>  gathering sources...</Text>}
    </Box>
  );
}
```

- [ ] **Step 4: Implement PhaseProduce**

```tsx
// src/ui/components/PhaseProduce.tsx
import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { FileChangeEntry } from '../state.js';

interface PhaseProduceProps {
  elapsed: number;
  climbFeedback?: string;
  fileChanges: FileChangeEntry[];
  diffStat: string;
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
            <Text key={i}>
              {'  '}<Text dimColor>{f.changeType}</Text> {f.filePath}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
```

- [ ] **Step 5: Implement PhaseEvaluate**

```tsx
// src/ui/components/PhaseEvaluate.tsx
import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { CheckResult } from '../../types.js';

interface PhaseEvaluateProps {
  structuralResults: CheckResult[];
  customResults: CheckResult[];
}

function ResultLine({ result }: { result: CheckResult }) {
  return (
    <Text>
      {'  '}<Text color={result.pass ? 'green' : 'red'}>{result.pass ? '✓' : '✗'}</Text>
      {' '}{result.criterion}
      {' '}<Text dimColor>{result.message}</Text>
    </Text>
  );
}

export function PhaseEvaluate({ structuralResults, customResults }: PhaseEvaluateProps) {
  const hasCustom = customResults.length > 0;
  const waitingForCustom = structuralResults.length > 0 && !hasCustom;

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text dimColor>EVALUATE</Text>
      {structuralResults.map((r, i) => (
        <ResultLine key={`s-${i}`} result={r} />
      ))}
      {waitingForCustom && (
        <Text>
          {'  '}<Text color="magenta"><Spinner type="dots" /></Text>
          {' '}Hades evaluating...
        </Text>
      )}
      {customResults.map((r, i) => (
        <ResultLine key={`c-${i}`} result={r} />
      ))}
    </Box>
  );
}
```

- [ ] **Step 6: Implement FailureDetail**

```tsx
// src/ui/components/FailureDetail.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { CheckResult } from '../../types.js';

interface FailureDetailProps {
  results: CheckResult[];
}

export function FailureDetail({ results }: FailureDetailProps) {
  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1}>
      <Text dimColor>EVALUATION RESULTS</Text>
      {results.map((r, i) => (
        <Text key={i}>
          {'  '}<Text color={r.pass ? 'green' : 'red'}>{r.pass ? '✓' : '✗'}</Text>
          {' '}<Text bold={!r.pass}>{r.criterion}</Text>
          {' '}<Text dimColor>{r.message}</Text>
        </Text>
      ))}
    </Box>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/ui/components.test.tsx`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/PhaseStack.tsx src/ui/components/PhaseProduce.tsx src/ui/components/PhaseEvaluate.tsx src/ui/components/FailureDetail.tsx tests/ui/components.test.tsx
git commit -m "feat(ui): add phase components (Stack, Produce, Evaluate, FailureDetail)"
```

---

## Task 11: BoulderActive Component

**Files:**
- Create: `src/ui/components/BoulderActive.tsx`
- Modify: `tests/ui/components.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `tests/ui/components.test.tsx`:

```tsx
import { BoulderActive } from '../../src/ui/components/BoulderActive.js';
import type { BoulderUIState } from '../../src/ui/state.js';

describe('BoulderActive', () => {
  it('renders bordered box with boulder name and attempt', () => {
    const boulder: BoulderUIState = {
      name: 'risk-assessment',
      phase: 'produce',
      attempt: 1,
      maxAttempts: 4,
      startTime: Date.now() - 18000,
      stackFiles: [],
      fileChanges: [],
      diffStat: '',
      structuralResults: [],
      customResults: [],
      allResults: [],
    };
    const { lastFrame } = render(<BoulderActive boulder={boulder} />);
    const output = lastFrame()!;
    expect(output).toContain('risk-assessment');
    expect(output).toContain('attempt 2/4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/components.test.tsx`
Expected: FAIL — cannot resolve BoulderActive

- [ ] **Step 3: Implement BoulderActive**

```tsx
// src/ui/components/BoulderActive.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { BoulderUIState } from '../state.js';
import { PhaseStack } from './PhaseStack.js';
import { PhaseProduce } from './PhaseProduce.js';
import { PhaseEvaluate } from './PhaseEvaluate.js';
import { FailureDetail } from './FailureDetail.js';
import { useElapsed } from '../hooks/useElapsed.js';

interface BoulderActiveProps {
  boulder: BoulderUIState;
}

export function BoulderActive({ boulder }: BoulderActiveProps) {
  const elapsed = useElapsed(boulder.startTime);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1}>
      <Box>
        <Text bold>{boulder.name}</Text>
        <Text dimColor> — attempt {boulder.attempt + 1}/{boulder.maxAttempts}</Text>
      </Box>

      {boulder.phase === 'stack' && (
        <PhaseStack files={boulder.stackFiles} />
      )}

      {boulder.phase === 'produce' && (
        <PhaseProduce
          elapsed={elapsed}
          climbFeedback={boulder.climbFeedback}
          fileChanges={boulder.fileChanges}
          diffStat={boulder.diffStat}
        />
      )}

      {boulder.phase === 'evaluate' && (
        <PhaseEvaluate
          structuralResults={boulder.structuralResults}
          customResults={boulder.customResults}
        />
      )}

      {boulder.phase === 'failed' && (
        <FailureDetail results={boulder.allResults} />
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/BoulderActive.tsx tests/ui/components.test.tsx
git commit -m "feat(ui): add BoulderActive component with phase routing"
```

---

## Task 12: SummaryTable

**Files:**
- Create: `src/ui/components/SummaryTable.ts`
- Test: `tests/ui/summary-table.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/ui/summary-table.test.ts
import { describe, it, expect } from 'vitest';
import { formatSummary } from '../../src/ui/components/SummaryTable.js';
import type { RunReport } from '../../src/types.js';

describe('formatSummary', () => {
  it('formats a run report as a table string', () => {
    const report: RunReport = {
      title: 'Test Run',
      startedAt: '2026-04-13T10:00:00Z',
      completedAt: '2026-04-13T10:03:18Z',
      totalBoulders: 3,
      passedClean: 1,
      passedAfterClimb: 1,
      flagged: 1,
      boulders: [
        { name: 'intro', content: '', attempts: 1, status: 'passed' },
        { name: 'mapping', content: '', attempts: 2, status: 'passed' },
        { name: 'risks', content: '', attempts: 4, status: 'flagged',
          failures: [{ criterion: 'word-count', pass: false, message: 'too short' }] },
      ],
    };

    const output = formatSummary(report, 'output/report.md', 'output/report-report.json');
    expect(output).toContain('intro');
    expect(output).toContain('mapping');
    expect(output).toContain('risks');
    expect(output).toContain('pass');
    expect(output).toContain('flag');
    expect(output).toContain('output/report.md');
    expect(output).toContain('output/report-report.json');
  });

  it('handles all-pass report', () => {
    const report: RunReport = {
      title: 'Clean Run',
      startedAt: '2026-04-13T10:00:00Z',
      completedAt: '2026-04-13T10:00:30Z',
      totalBoulders: 1,
      passedClean: 1,
      passedAfterClimb: 0,
      flagged: 0,
      boulders: [
        { name: 'only-one', content: '', attempts: 1, status: 'passed' },
      ],
    };

    const output = formatSummary(report, 'out.md', 'out-report.json');
    expect(output).toContain('1 passed');
    expect(output).not.toContain('flagged');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/summary-table.test.ts`
Expected: FAIL — cannot resolve module

- [ ] **Step 3: Implement SummaryTable**

```typescript
// src/ui/components/SummaryTable.ts
import type { RunReport } from '../../types.js';

function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

export function formatSummary(report: RunReport, artifactPath: string, reportPath: string): string {
  const lines: string[] = [];

  // Calculate column widths
  const nameWidth = Math.max(7, ...report.boulders.map(b => b.name.length));
  const statusWidth = 7;
  const attemptsWidth = 8;

  // Header
  lines.push(`┌${'─'.repeat(nameWidth + 2)}┬${'─'.repeat(statusWidth + 2)}┬${'─'.repeat(attemptsWidth + 2)}┐`);
  lines.push(`│ ${pad('Boulder', nameWidth)} │ ${pad('Status', statusWidth)} │ ${pad('Attempts', attemptsWidth)} │`);
  lines.push(`├${'─'.repeat(nameWidth + 2)}┼${'─'.repeat(statusWidth + 2)}┼${'─'.repeat(attemptsWidth + 2)}┤`);

  // Rows
  for (const b of report.boulders) {
    const statusIcon = b.status === 'flagged' ? '✗ flag' : b.attempts > 1 ? '✓ climb' : '✓ pass';
    lines.push(`│ ${pad(b.name, nameWidth)} │ ${pad(statusIcon, statusWidth)} │ ${pad(String(b.attempts), attemptsWidth)} │`);
  }

  // Footer
  lines.push(`└${'─'.repeat(nameWidth + 2)}┴${'─'.repeat(statusWidth + 2)}┴${'─'.repeat(attemptsWidth + 2)}┘`);

  // Summary line
  const parts: string[] = [];
  const totalPassed = report.passedClean + report.passedAfterClimb;
  if (totalPassed > 0) parts.push(`${totalPassed} passed`);
  if (report.flagged > 0) parts.push(`${report.flagged} flagged`);
  lines.push(parts.join(' · '));

  // Paths
  lines.push(`Artifact: ${artifactPath}`);
  lines.push(`Report:   ${reportPath}`);

  return lines.join('\n');
}

export function printSummary(report: RunReport, artifactPath: string, reportPath: string): void {
  console.log('\n' + formatSummary(report, artifactPath, reportPath));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/summary-table.test.ts`
Expected: PASS (both tests)

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SummaryTable.ts tests/ui/summary-table.test.ts
git commit -m "feat(ui): add SummaryTable formatter for end-of-run output"
```

---

## Task 13: useEngine Hook

**Files:**
- Create: `src/ui/hooks/useEngine.ts`
- Test: `tests/ui/use-engine.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/ui/use-engine.test.ts
import { describe, it, expect } from 'vitest';
import { TypedEmitter } from '../../src/events.js';
import type { SisyphusEvents } from '../../src/events.js';
import { uiReducer, initialUIState } from '../../src/ui/state.js';
import type { UIState, UIAction } from '../../src/ui/state.js';

// Test the event-to-action mapping logic directly (without React hooks)
// The useEngine hook is a thin wrapper: subscribe to emitter → dispatch UIAction
// We test the integration by simulating event sequences through the reducer

describe('event-to-state integration', () => {
  it('processes a full successful boulder lifecycle', () => {
    const actions: UIAction[] = [
      { type: 'run:start', payload: { title: 'Test', layer: 'documentation', totalBoulders: 1, maxRetries: 3 } },
      { type: 'boulder:start', payload: { name: 'intro', index: 0, total: 1, maxAttempts: 4 } },
      { type: 'stack:start', payload: { boulderName: 'intro', sourceCount: 1 } },
      { type: 'stack:file', payload: { boulderName: 'intro', filePath: 'src/data.ts', lineCount: 42, summarized: false } },
      { type: 'stack:end', payload: { boulderName: 'intro', resultCount: 1 } },
      { type: 'produce:start', payload: { boulderName: 'intro', attempt: 0, maxAttempts: 4 } },
      { type: 'produce:end', payload: { boulderName: 'intro', attempt: 0, outputLength: 500 } },
      { type: 'evaluate:start', payload: { boulderName: 'intro', attempt: 0, structuralCount: 1, customCount: 0 } },
      { type: 'evaluate:structural', payload: { boulderName: 'intro', results: [{ criterion: 'heading', pass: true, message: 'ok' }] } },
      { type: 'evaluate:end', payload: { boulderName: 'intro', attempt: 0, passed: true, failures: [] } },
      { type: 'boulder:end', payload: { name: 'intro', status: 'passed', attempts: 1, durationMs: 12000 } },
      { type: 'run:end', payload: { report: { title: 'Test', startedAt: '', completedAt: '', boulders: [], totalBoulders: 1, passedClean: 1, passedAfterClimb: 0, flagged: 0 } } },
    ];

    let state: UIState = initialUIState;
    for (const action of actions) {
      state = uiReducer(state, action);
    }

    expect(state.title).toBe('Test');
    expect(state.completedBoulders).toHaveLength(1);
    expect(state.completedBoulders[0].status).toBe('passed');
    expect(state.activeBoulder).toBeNull();
    expect(state.report).not.toBeNull();
  });

  it('processes a climb retry sequence', () => {
    const actions: UIAction[] = [
      { type: 'run:start', payload: { title: 'Test', layer: 'documentation', totalBoulders: 1, maxRetries: 3 } },
      { type: 'boulder:start', payload: { name: 'mapping', index: 0, total: 1, maxAttempts: 4 } },
      { type: 'stack:start', payload: { boulderName: 'mapping', sourceCount: 0 } },
      { type: 'stack:end', payload: { boulderName: 'mapping', resultCount: 0 } },
      // Attempt 1 — fails
      { type: 'produce:start', payload: { boulderName: 'mapping', attempt: 0, maxAttempts: 4 } },
      { type: 'produce:end', payload: { boulderName: 'mapping', attempt: 0, outputLength: 200 } },
      { type: 'evaluate:start', payload: { boulderName: 'mapping', attempt: 0, structuralCount: 1, customCount: 0 } },
      { type: 'evaluate:structural', payload: { boulderName: 'mapping', results: [{ criterion: 'word-count', pass: false, message: '100/250' }] } },
      { type: 'evaluate:end', payload: { boulderName: 'mapping', attempt: 0, passed: false, failures: [{ criterion: 'word-count', pass: false, message: '100/250' }] } },
      { type: 'climb', payload: { boulderName: 'mapping', attempt: 0, failures: [{ criterion: 'word-count', pass: false, message: '100/250' }] } },
      // Attempt 2 — passes
      { type: 'produce:start', payload: { boulderName: 'mapping', attempt: 1, maxAttempts: 4, climbFeedback: 'FAIL: word-count — 100/250' } },
      { type: 'produce:end', payload: { boulderName: 'mapping', attempt: 1, outputLength: 400 } },
      { type: 'evaluate:start', payload: { boulderName: 'mapping', attempt: 1, structuralCount: 1, customCount: 0 } },
      { type: 'evaluate:structural', payload: { boulderName: 'mapping', results: [{ criterion: 'word-count', pass: true, message: '280/250' }] } },
      { type: 'evaluate:end', payload: { boulderName: 'mapping', attempt: 1, passed: true, failures: [] } },
      { type: 'boulder:end', payload: { name: 'mapping', status: 'passed', attempts: 2, durationMs: 48000 } },
    ];

    let state: UIState = initialUIState;
    for (const action of actions) {
      state = uiReducer(state, action);
    }

    expect(state.completedBoulders).toHaveLength(1);
    expect(state.completedBoulders[0].attempts).toBe(2);
    expect(state.completedBoulders[0].status).toBe('passed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes — this tests the reducer)**

Run: `npx vitest run tests/ui/use-engine.test.ts`
Expected: PASS (since this tests the already-implemented reducer with event sequences)

- [ ] **Step 3: Implement useEngine hook**

```typescript
// src/ui/hooks/useEngine.ts
import { useReducer, useEffect } from 'react';
import type { TypedEmitter, SisyphusEvents } from '../../events.js';
import { uiReducer, initialUIState } from '../state.js';
import type { UIState, UIAction } from '../state.js';

const EVENT_NAMES: (keyof SisyphusEvents)[] = [
  'run:start', 'run:end',
  'boulder:start', 'boulder:end',
  'stack:start', 'stack:file', 'stack:end',
  'produce:start', 'produce:file-change', 'produce:diff', 'produce:end',
  'evaluate:start', 'evaluate:structural', 'evaluate:custom', 'evaluate:end',
  'climb',
];

export function useEngine(emitter: TypedEmitter<SisyphusEvents>): UIState {
  const [state, dispatch] = useReducer(uiReducer, initialUIState);

  useEffect(() => {
    const handlers = EVENT_NAMES.map(eventName => {
      const handler = (payload: any) => {
        dispatch({ type: eventName, payload } as UIAction);
      };
      emitter.on(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      for (const { eventName, handler } of handlers) {
        emitter.off(eventName, handler);
      }
    };
  }, [emitter]);

  return state;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/use-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useEngine.ts tests/ui/use-engine.test.ts
git commit -m "feat(ui): add useEngine hook for event-to-state bridging"
```

---

## Task 14: App Component and Render Entry Point

**Files:**
- Create: `src/ui/App.tsx`
- Create: `src/ui/render.ts`

- [ ] **Step 1: Implement App component**

```tsx
// src/ui/App.tsx
import React from 'react';
import { Static, Box } from 'ink';
import type { TypedEmitter, SisyphusEvents } from '../events.js';
import type { Spec } from '../types.js';
import { useEngine } from './hooks/useEngine.js';
import { useElapsed } from './hooks/useElapsed.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { BoulderActive } from './components/BoulderActive.js';
import { BoulderCompleted } from './components/BoulderCompleted.js';
import { BoulderPending } from './components/BoulderPending.js';

interface AppProps {
  emitter: TypedEmitter<SisyphusEvents>;
  spec: Spec;
  startTime: number;
}

export function App({ emitter, spec, startTime }: AppProps) {
  const state = useEngine(emitter);
  const elapsed = useElapsed(startTime);

  const title = state.title || spec.title;
  const layer = state.layer || spec.layer;
  const total = state.totalBoulders || spec.boulders.length;

  return (
    <Box flexDirection="column">
      <Header title={title} layer={layer} elapsed={elapsed} />

      <Static items={state.completedBoulders}>
        {(boulder) => (
          <BoulderCompleted
            key={boulder.name}
            name={boulder.name}
            status={boulder.status}
            attempts={boulder.attempts}
            durationMs={boulder.durationMs}
            failures={boulder.failures}
          />
        )}
      </Static>

      {state.activeBoulder && (
        <BoulderActive boulder={state.activeBoulder} />
      )}

      {spec.boulders
        .filter(b =>
          !state.completedBoulders.some(c => c.name === b.name) &&
          state.activeBoulder?.name !== b.name
        )
        .map(b => (
          <BoulderPending key={b.name} name={b.name} />
        ))
      }

      <Footer completed={state.completedBoulders.length} total={total} elapsed={elapsed} />
    </Box>
  );
}
```

- [ ] **Step 2: Implement render entry point**

```typescript
// src/ui/render.ts
import React from 'react';
import { render } from 'ink';
import { TypedEmitter } from '../events.js';
import type { SisyphusEvents } from '../events.js';
import type { Spec, RunReport } from '../types.js';
import { runSpec } from '../engine.js';
import { App } from './App.js';
import { printSummary } from './components/SummaryTable.js';

export async function renderUI(
  spec: Spec,
  options: { baseDir?: string; lessonsDir?: string },
  artifactPath: string,
  reportPath: string,
): Promise<RunReport> {
  const emitter = new TypedEmitter<SisyphusEvents>();
  const startTime = Date.now();

  const app = render(
    React.createElement(App, { emitter, spec, startTime }),
  );

  const report = await runSpec(spec, { ...options, emitter });

  // Give Ink one final render tick to show completed state
  await new Promise(r => setTimeout(r, 100));
  app.unmount();
  await app.waitUntilExit();

  printSummary(report, artifactPath, reportPath);
  return report;
}
```

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.tsx src/ui/render.ts
git commit -m "feat(ui): add App component and renderUI entry point"
```

---

## Task 15: Wire CLI to Ink UI

**Files:**
- Modify: `bin/sisyphus.ts:40-101` (add TTY detection and Ink UI path)

- [ ] **Step 1: Modify the run command in bin/sisyphus.ts**

Replace the run command action (lines 40-101) with:

```typescript
  .action(async (specFile: string, opts: any) => {
    try {
      const spec = await loadSpec(specFile);
      if (opts.output) spec.output = opts.output;
      if (opts.section) {
        spec.boulders = spec.boulders.filter(b => b.name === opts.section);
        if (spec.boulders.length === 0) {
          console.error(`No boulder named "${opts.section}" found in spec`);
          process.exit(1);
        }
      }

      // Resolve baseDir: spec.baseDir (relative to spec file) → cwd fallback
      const specDir = path.dirname(path.resolve(specFile));
      const baseDir = spec.baseDir
        ? path.resolve(specDir, spec.baseDir)
        : process.cwd();

      const reportPath = spec.output.replace(/\.[^.]+$/, '') + '-report.json';

      if (opts.dryRun) {
        console.log(`Spec: ${spec.title}`);
        console.log(`Layer: ${spec.layer}`);
        console.log(`Output: ${spec.output}`);
        console.log(`Max retries: ${spec.maxRetries ?? 3}`);
        console.log(`\nBoulders:`);
        for (const b of spec.boulders) {
          console.log(`  - ${b.name}: ${b.criteria.length} criteria, ${b.stack?.length ?? 0} stack sources`);
        }
        return;
      }

      // Choose rendering mode
      const useInkUI = !opts.verbose && process.stdout.isTTY;
      let report;

      if (useInkUI) {
        const { renderUI } = await import('../src/ui/render.js');
        report = await renderUI(spec, { baseDir }, spec.output, reportPath);
      } else {
        console.log(`Starting: ${spec.title}`);
        console.log(`Layer: ${spec.layer} | Boulders: ${spec.boulders.length}\n`);

        report = await runSpec(spec, { baseDir, verbose: opts.verbose });

        console.log(`\n--- Run Complete ---`);
        console.log(`Passed clean:       ${report.passedClean}`);
        console.log(`Passed after climb: ${report.passedAfterClimb}`);
        console.log(`Flagged:            ${report.flagged}`);
        console.log(`\nArtifact: ${spec.output}`);
        console.log(`Report:   ${reportPath}`);

        if (report.flagged > 0) {
          console.log(`\nFlagged boulders:`);
          report.boulders
            .filter(b => b.status === 'flagged')
            .forEach(b => {
              console.log(`  - ${b.name}: ${b.failures?.map(f => f.message).join('; ')}`);
            });
        }
      }

      await writeReport(report, reportPath);

      if (report.flagged > 0) process.exit(1);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });
```

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 3: Test with --verbose (existing behavior)**

Run: `npx sisyphus run examples/minimal.json --verbose --dry-run`
Expected: Existing text output, unchanged

- [ ] **Step 4: Test dry-run still works**

Run: `npx sisyphus run examples/minimal.json --dry-run`
Expected: Spec summary printed, no Ink UI

- [ ] **Step 5: Commit**

```bash
git add bin/sisyphus.ts
git commit -m "feat(ui): wire Ink UI into CLI with TTY detection fallback"
```

---

## Task 16: Integration Testing

**Files:**
- No new files — manual end-to-end verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS (existing + new tests)

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 3: Test Ink UI with a real spec (if Claude CLI is available)**

Run: `npx sisyphus run examples/minimal.json`
Expected: Live Ink progress UI with boulder lifecycle phases visible

- [ ] **Step 4: Test verbose fallback**

Run: `npx sisyphus run examples/minimal.json --verbose`
Expected: Raw text output (existing behavior, unchanged)

- [ ] **Step 5: Test piped output fallback**

Run: `npx sisyphus run examples/minimal.json 2>&1 | cat`
Expected: No ANSI escape codes in output (falls back to verbose mode)

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(ui): integration test fixes"
```

(Only if fixes were needed — skip if everything passes cleanly)
