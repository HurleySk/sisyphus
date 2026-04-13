# Sisyphus Ink CLI UI Design

**Date:** 2026-04-13
**Status:** Draft

## Problem

Sisyphus currently outputs plain `console.log` text with no colors, spinners, progress indicators, or structure. Users watching a multi-boulder run see nothing during API calls and get a minimal text dump at the end. The experience is disconnected from the work the engine is doing.

## Goal

A Claude Code-inspired live progress UI that shows the full lifecycle of each boulder as it runs — stacking, producing, evaluating, climbing — so users watching the terminal feel the engine working. Built with Ink (React for CLI).

## Design Principles

1. **Engine-agnostic events** — the engine emits lifecycle events via an optional typed EventEmitter. The UI subscribes. Without a subscriber, behavior is unchanged.
2. **Progressive disclosure** — the active boulder is expanded with full phase detail. Completed boulders collapse to one line. Pending boulders are dimmed.
3. **Graceful degradation** — TTY gets the Ink UI, non-TTY (CI/pipes) falls back to existing text output, `--verbose` preserves raw logging.

## Event System

### `src/events.ts`

A typed wrapper around Node's `EventEmitter`. The engine receives it as `options.emitter?: TypedEmitter<SisyphusEvents>` and calls `emitter?.emit(...)` at each lifecycle point. Optional chaining means zero cost when no emitter is provided.

### Event Map

| Event | Payload | Fires at |
|-------|---------|----------|
| `run:start` | `{ title, layer, totalBoulders, maxRetries }` | Before boulder loop |
| `run:end` | `{ report: RunReport }` | After assembly + report |
| `boulder:start` | `{ name, index, total, maxAttempts }` | Top of boulder loop |
| `boulder:end` | `{ name, status, attempts, durationMs, failures? }` | After pass or flag |
| `stack:start` | `{ boulderName, sourceCount }` | Before stacking |
| `stack:file` | `{ boulderName, filePath, lineCount, summarized }` | Per source file |
| `stack:end` | `{ boulderName, resultCount }` | After stacking |
| `produce:start` | `{ boulderName, attempt, maxAttempts, climbFeedback? }` | Before `start()` call |
| `produce:end` | `{ boulderName, attempt, outputLength }` | After `start()` returns |
| `evaluate:start` | `{ boulderName, attempt, structuralCount, customCount }` | Before checks |
| `evaluate:structural` | `{ boulderName, results: CheckResult[] }` | After structural checks |
| `evaluate:custom` | `{ boulderName, results: CheckResult[] }` | After Hades returns |
| `evaluate:end` | `{ boulderName, attempt, passed, failures }` | After all checks |
| `climb` | `{ boulderName, attempt, failures }` | Before retry |

### Engine Changes

~15 `emitter?.emit(...)` calls at existing boundaries in `engine.ts` (lines 50, 59-61, 64, 68, 72, 79, 108-113, 120-124, 128) and `stack.ts` (per-file emission). No logic changes. No new control flow.

## Rendering Modes

```typescript
// bin/sisyphus.ts — run command action
const useInkUI = !opts.verbose && process.stdout.isTTY;

if (useInkUI) {
  const { renderUI } = await import('../src/ui/render.js');
  const report = await renderUI(spec, { baseDir });
} else {
  // Existing verbose/CI path — unchanged
  const report = await runSpec(spec, { baseDir, verbose: opts.verbose });
}
```

Three modes:
- **Default (TTY)**: Ink UI with live progress
- **`--verbose`**: Raw text output (existing behavior)
- **Non-TTY (piped/CI)**: Falls back to verbose-style text

## Component Architecture

### Component Tree

```
<App emitter={emitter}>
  <Header title layer elapsed />
  <Static items={completedBoulders}>
    <BoulderCompleted name status attempts duration firstAttemptFailures />
  </Static>
  {activeBoulder &&
    <BoulderActive name attempt maxAttempts>
      <PhaseStack files />
      <PhaseProduce elapsed feedback />
      <PhaseEvaluate structural custom />
      <FailureDetail results />
    </BoulderActive>
  }
  {pendingBoulders.map(b => <BoulderPending name />)}
  <Footer completed total elapsed />
</App>
```

### Component Responsibilities

**Header** — Spec title in cyan bold, layer name, elapsed time. Static across the run.

**BoulderCompleted** — Single line via `<Static>`. Green ✓ for passed, orange ✓ for climbed, red ✗ for flagged. Shows name, attempt count, duration. If climbed, appends dimmed first-attempt failure criteria names.

**BoulderPending** — Dimmed circle + name. Pure presentation.

**BoulderActive** — Bordered box with boulder name label. Shows `Attempt {n}/{max}` when retrying. Contains the active phase component:

- **PhaseStack** — Lists source files as they arrive. Each line: relative path, line count, "→ haiku extract (312→78 lines)" for summarized files.
- **PhaseProduce** — Spinner + "Sisyphus writing..." + elapsed seconds. When climbing (attempt > 1), shows yellow climb feedback: the specific failure messages from the prior attempt.
- **PhaseEvaluate** — Two stages: structural check results appear instantly (✓/✗ per criterion with details like "312/250 words"). Then "Hades evaluating..." spinner while custom criteria run. Custom results appear as Hades returns.
- **FailureDetail** — Full criteria table: all results (pass and fail), with criterion name, pass/fail indicator, and message/evidence. Visible between `evaluate:end` and the next `produce:start`, so the user sees exactly what failed before the climb begins.

**Footer** — Separator line, then `{completed}/{total} boulders · elapsed {time}`.

**SummaryTable** — NOT an Ink component. A plain function that prints to stdout after Ink unmounts. Formatted table with columns: Boulder, Status, Attempts, Time. Plus artifact/report paths.

### Run End Sequence

1. `run:end` event fires
2. App renders final state (all boulders completed)
3. Brief delay (one render tick)
4. `inkInstance.unmount()` — live view freezes in terminal scrollback
5. `printSummary(report)` — compact table prints below the frozen view

```
┌──────────────────┬─────────┬──────────┬───────┐
│ Boulder          │ Status  │ Attempts │ Time  │
├──────────────────┼─────────┼──────────┼───────┤
│ executive-summary│ ✓ pass  │ 1        │ 12s   │
│ entity-mapping   │ ✓ climb │ 2        │ 48s   │
│ risk-assessment  │ ✗ flag  │ 4        │ 2m 3s │
│ recommendations  │ ✓ pass  │ 1        │ 15s   │
└──────────────────┴─────────┴──────────┴───────┘
3 passed · 1 flagged · 3m 18s total
Artifact: output/report.md
Report:   output/report-report.json
```

## State Management

### `src/ui/hooks/useEngine.ts`

Single hook that subscribes to the emitter via `useEffect`. Maintains reducer-style state:

```typescript
type Phase = 'stack' | 'produce' | 'evaluate' | 'failed' | 'idle';

interface BoulderUIState {
  name: string;
  phase: Phase;
  attempt: number;
  maxAttempts: number;
  startTime: number;
  stackFiles: Array<{ path: string; lines: number; summarized: boolean }>;
  climbFeedback?: string;
  structuralResults: CheckResult[];
  customResults: CheckResult[];
  allResults: CheckResult[];
}

interface UIState {
  title: string;
  layer: string;
  totalBoulders: number;
  activeBoulder: BoulderUIState | null;
  completedBoulders: CompletedBoulder[];
  pendingBoulderNames: string[];
  report: RunReport | null;
}
```

Each event maps to a state transition. The hook returns `UIState` and the `App` component destructures it into child props.

### `src/ui/hooks/useElapsed.ts`

Simple `setInterval`-based counter that returns elapsed seconds. Used by Header, PhaseProduce, and Footer.

## UI Entry Point

### `src/ui/render.ts`

```typescript
export async function renderUI(spec: Spec, options: RunOptions): Promise<RunReport> {
  const emitter = new TypedEmitter<SisyphusEvents>();
  const app = render(<App emitter={emitter} spec={spec} />);

  const report = await runSpec(spec, { ...options, emitter });

  await new Promise(r => setTimeout(r, 100)); // final render tick
  app.unmount();
  await app.waitUntilExit();

  printSummary(report);
  return report;
}
```

## File Structure

```
src/
  events.ts              # TypedEmitter class, SisyphusEvents interface, payload types
  engine.ts              # (modified) optional emitter param, ~15 emit calls
  stack.ts               # (modified) optional emitter, stack:file per source
  ui/
    App.tsx              # Root component
    render.ts            # Entry: creates emitter, renders Ink, prints summary
    state.ts             # UI state types (Phase, BoulderUIState, CompletedBoulder)
    hooks/
      useEngine.ts       # Subscribes to emitter → UIState
      useElapsed.ts      # Elapsed time counter
    components/
      Header.tsx         # Title, layer, elapsed
      BoulderActive.tsx  # Bordered box with phase child
      BoulderCompleted.tsx # Single-line summary (via Static)
      BoulderPending.tsx # Dimmed waiting state
      PhaseStack.tsx     # Source file list
      PhaseProduce.tsx   # Spinner + writing status + climb feedback
      PhaseEvaluate.tsx  # Criteria results (structural instant, custom streamed)
      FailureDetail.tsx  # Full pass/fail criteria table
      Footer.tsx         # Progress count + elapsed
      SummaryTable.ts    # Plain function, prints after Ink unmounts
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `ink` | ^5.x | React for CLI |
| `react` | ^18.x | Peer dep of Ink |
| `ink-spinner` | ^5.x | Spinner component |
| `@types/react` | ^18.x | Dev: type definitions |

## tsconfig Changes

Add to `compilerOptions`:
- `"jsx": "react-jsx"`

## Implementation Sequence

### Phase 1: Event System
1. Create `src/events.ts` with typed emitter and event interfaces
2. Modify `src/engine.ts` to accept optional emitter, add ~15 emit calls
3. Modify `src/stack.ts` to accept optional emitter, emit `stack:file` per source
4. Verify existing tests pass (emitter is optional, zero behavioral change)

### Phase 2: Ink Scaffolding
1. Install: `ink`, `react`, `ink-spinner`, `@types/react`
2. Update `tsconfig.json` with JSX support
3. Create `src/ui/state.ts` with type definitions
4. Create `src/ui/hooks/useElapsed.ts`
5. Create `src/ui/hooks/useEngine.ts`
6. Create `src/ui/render.ts` entry point

### Phase 3: Components (bottom-up)
1. `Footer.tsx`, `BoulderPending.tsx`, `Header.tsx` — pure presentation
2. `BoulderCompleted.tsx` — pure presentation
3. `PhaseStack.tsx`, `PhaseProduce.tsx`, `PhaseEvaluate.tsx` — event-driven
4. `FailureDetail.tsx` — renders CheckResult arrays
5. `BoulderActive.tsx` — composes phase components
6. `SummaryTable.ts` — plain text function
7. `App.tsx` — root composition

### Phase 4: Integration
1. Modify `bin/sisyphus.ts` to wire Ink vs verbose mode
2. End-to-end test with a real spec file
3. Handle edge cases: error boulders, empty stack, single-boulder specs

## Verification

1. **Unit**: Event emitter fires correct events at each lifecycle point
2. **Unit**: Each Ink component renders correct output given state
3. **Integration**: Run `npx sisyphus run examples/minimal.json` and verify live progress display
4. **Fallback**: Run with `--verbose` and verify existing text output unchanged
5. **Fallback**: Pipe output (`npx sisyphus run spec.json | cat`) and verify no ANSI codes
6. **Edge case**: Single boulder spec, all-pass spec, all-flag spec, error during stack
