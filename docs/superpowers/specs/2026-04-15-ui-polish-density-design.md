# UI Polish & Information Density — Design Spec

**Date:** 2026-04-15
**Scope:** 7 surgical fixes across bug fixes, information density, and one engine fix. No data model changes, no structural redesign.

## Context

Visual assessment of the Sisyphus terminal UI using can-see MCP revealed several issues visible during real spec runs (both `ui-test.json` and `codebase-overview.json`). The layout model is sound — these are targeted fixes to what's already there.

## Changes

### 1. Bug Fixes

#### 1a. Pin title outside eviction

**Problem:** The title (`"Codebase Overview · documentation · 2 boulders"`) is rendered as a normal `<Text>` above the `<Static>` block in `App.tsx`. When phase history grows and Ink's `<Static>` pushes content upward, the title gets displaced into the scrollback buffer, appearing mid-stream among phase history entries with no visual distinction.

**Fix:** Make the title the first item inside `<Static>` (using a dedicated key like `"__title__"`), so it's always at the top of the scrollback buffer rather than floating above it. This way it scrolls off naturally as the first evicted item, rather than getting sandwiched between phase entries.

**File:** `src/ui/App.tsx`

#### 1b. Truncate Hades parse error in completion summary

**Problem:** When Hades returns markdown-fenced JSON (`` ```json ... ``` ``), the `parseEvaluatorResponse` in `engine.ts` produces a failure message containing the raw response. This is rendered verbatim in `CompletionSummary.tsx`, dumping multi-line raw JSON into the summary and breaking the visual layout.

**Fix:** In `CompletionSummary.tsx`, truncate failure messages to ~120 characters with an `...` ellipsis. The full error details are available in the report JSON file — the terminal UI just needs to signal that parsing failed and where to look.

**File:** `src/ui/components/CompletionSummary.tsx`

#### 1c. Fix "waiting for dispatch..." flash at completion

**Problem:** When the run ends, the reducer sets `agent: 'done'` but `AgentPanel.tsx` has no handler for the `'done'` state. It falls through to the `agent === 'idle'` branch, briefly flashing "waiting for dispatch..." before the `isComplete` check in `App.tsx` swaps in the `CompletionSummary`.

**Fix:** Add `panel.agent === 'done'` as an early return (`return null`) in `AgentPanel`. The completion summary in `App.tsx` handles that state.

**File:** `src/ui/components/AgentPanel.tsx`

### 2. Information Density

#### 2a. Relative paths in gathering

**Problem:** `GatheringBody` renders full absolute paths (e.g., `C:\Users\shurley\source\repos\HurleySk\sisyphus\src\engine.ts`) which consume ~70 characters per line, leaving little room for line counts and the "summarized" indicator.

**Fix:** Strip the `baseDir` prefix from file paths at the event boundary. Thread `baseDir` into the UI state:
- Add `baseDir` field to `UIState` (set from `run:start` payload — the engine already has this value)
- In the `stack:file` reducer case, compute the relative path by stripping the stored `baseDir` prefix from `filePath`
- Store the relative path in `StackFileEntry.path`

This requires:
- Adding `baseDir` to `RunStartPayload` in `src/events.ts`
- Emitting `baseDir` in the `run:start` call in `src/engine.ts`
- Adding `baseDir` to `UIState` and handling it in the `run:start` reducer case in `src/ui/state.ts`
- Stripping the prefix in the `stack:file` reducer case

**Files:** `src/events.ts`, `src/engine.ts`, `src/ui/state.ts`

#### 2b. Compress retry phase history entries

**Problem:** Each attempt generates two phase history lines (SISYPHUS + HADES), so 4 attempts produce 8 lines that dominate the scrollback:
```
SISYPHUS · Architecture Summary · attempt 2 · 69 lines
HADES · Architecture Summary · 1/3 checks failed -> retrying
```

**Fix:** In the `climb` reducer case, instead of appending a separate HADES entry for failed evaluations, merge the result into the preceding SISYPHUS entry to produce a single combined line per retried attempt:
```
SISYPHUS · Architecture Summary · attempt 2 · 69 lines -> 1/3 failed
```

The final successful/failed attempt keeps the existing two-line format (SISYPHUS line + HADES "N/N checks passed" line) since that's the terminal state worth preserving.

Implementation: in the `climb` case of `uiReducer`, instead of pushing a new `climbHadesEntry`, pop or replace the last SISYPHUS entry in `phaseHistory` with a combined summary.

**File:** `src/ui/state.ts`

#### 2c. Suppress "no sources" gathering phase history

**Problem:** `"GATHERING · greeting · no sources"` takes a phase history line for zero information. This happens for every boulder without stack sources.

**Fix:** In the `produce:start` reducer case, skip the gathering history entry when `fileCount === 0`. The SISYPHUS entry that immediately follows provides sufficient context.

**File:** `src/ui/state.ts`

### 3. Engine Fix

#### 3a. Fix `codebase-overview.json` contains-heading criterion

**Problem:** The spec uses `"text": "Architecture"` but the `containsHeading` check reads `criterion.heading`. The JSON schema allows `additionalProperties: true`, so `"text"` passes validation silently but is never read. The check searches for `""` (empty string) and matches any heading, reporting `Heading "" found.`

**Fix:** Change `"text"` to `"heading"` in `examples/codebase-overview.json`.

**File:** `examples/codebase-overview.json`

## Files Summary

| Change | Files |
|---|---|
| 1a. Pin title | `src/ui/App.tsx` |
| 1b. Truncate error | `src/ui/components/CompletionSummary.tsx` |
| 1c. Done state | `src/ui/components/AgentPanel.tsx` |
| 2a. Relative paths | `src/events.ts`, `src/engine.ts`, `src/ui/state.ts` |
| 2b. Compress retries | `src/ui/state.ts` |
| 2c. No sources | `src/ui/state.ts` |
| 3a. Spec field | `examples/codebase-overview.json` |

## Out of Scope

- Separator style unification (intentional visual hierarchy)
- Status bar transformation post-completion (functional, not broken)
- Phase history data model redesign (overkill for these fixes)
- Completion summary scrolling/collapsibility
