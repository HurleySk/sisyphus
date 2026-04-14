# Sisyphus UI v3 — Agent-First Redesign

**Status:** Implemented
**Date:** 2026-04-14
**Scope:** Full UX flow from Zeus conversational spec design through Ink run UI

## Problem

The current v2 split-panel UI has several issues:

- **Layout/spacing:** Both panels compete for attention equally, but the bottom panel (worker) is nearly empty most of the time while the top panel (Thanatos) fills with low-value dispatch log entries
- **Visual hierarchy:** No clear delineation between orchestrator (T2) and worker (T3) activity. Text blends together with only indentation for structure.
- **Duplication:** Completion state shows the same information three times — Ink summary, plain-text table, and repeated artifact/report lines
- **Missing flow:** Zeus (T1 conversational architect) is not built. Users hand-write JSON spec files.

## Design Principles

1. **Agent activity is the star.** What the agents are doing right now gets the most screen space and visual prominence.
2. **Boulder/phase is the frame.** Which boulder is active and what phase it's in is always visible but doesn't compete with agent output.
3. **No duplication.** Every piece of information appears in exactly one place.
4. **Clear tier delineation.** T2 orchestration and T3 worker output are visually distinct zones.

## Architecture: Two-Part UX

The full flow has two distinct interaction modes:

1. **Zeus (T1)** — Conversational spec design inside Claude Code
2. **Run UI** — Live Ink TUI in a separate terminal

These are connected by a handoff: Zeus writes the spec, then launches the run in a new terminal.

---

## Part 1: Zeus — Claude Code Skill

Zeus is a Claude Code skill invoked as `/zeus`. It follows the superpowers brainstorming pattern.

### Flow

1. User runs `/zeus` with a rough description (e.g., `/zeus migration status report`)
2. Zeus explores project context — reads CLAUDE.md, checks available layers/stack backends, looks at prior specs
3. Asks clarifying questions one at a time, multiple choice preferred:
   - What layer? (documentation, etc.)
   - What data sources / stack backends?
   - Per boulder: purpose, criteria
   - Max retries, output path
4. Proposes the spec structure, gets approval
5. Writes the spec JSON to `specs/<name>.json` and commits

### Output

A validated spec file ready for `sisyphus run`.

### What Zeus Is NOT

Not a TUI. No Ink. Purely conversational within Claude Code. The spec file is the handoff artifact.

---

## Part 2: Zeus → Run Handoff

After Zeus writes the spec, it launches the run automatically.

### End of Zeus Conversation

```
Zeus: Spec written to specs/migration-status.json.

  2 boulders: overview, metrics-table
  layer: documentation
  output: output/migration-status.md
  max retries: 3

  Launching run...
```

Zeus invokes `sisyphus run specs/migration-status.json` in a new terminal. The user stays in Claude Code and watches the Ink TUI in the other terminal.

### Why a Separate Terminal

- Zeus is conversational (text back-and-forth). The run UI is a live-updating TUI. Different interaction modes.
- Keeps Claude Code free for other work during execution.
- If the run fails, the user is already in Claude Code where Zeus can help iterate.

### Post-Run

When the run completes, Zeus checks the report and summarizes results back in Claude Code:

```
Zeus: Run complete. 2/2 boulders passed in 28s.
  Artifact: output/migration-status.md
  
  Want me to open the artifact, adjust the spec, or re-run?
```

This creates an iterate loop: Zeus conversation → run → results → adjust → re-run.

---

## Part 3: Run UI — Layout Structure

The terminal is divided into two zones with flipped emphasis from v2.

### Agent Panel (top, ~80% of terminal height)

- Header bar: agent name, boulder name, attempt number, elapsed time
- Color-coded by active agent (see Color Palette below)
- Below the header: raw streaming output from the agent
- When agents switch (Sisyphus → Hades), the header changes and streaming area resets
- Completed agent output scrolls up into Ink `<Static>` for scrollback history

### Thanatos Status Bar (bottom, 2-3 lines, pinned)

- Line 1: Boulder progress strip — each boulder as a compact badge (icon + name + time)
- Line 2: Progress bar + overall stats (X/Y boulders, elapsed time)
- Separated from agent panel by a single dim horizontal rule

### Key Difference from v2

Thanatos does not get its own scrolling panel. It gets a compact, information-dense status bar. Dispatch log entries (gathered, dispatched, evaluated) are gone — the user can see the agent working in the panel above. The status bar tracks *where you are*, not *what's happening*.

---

## Part 4: Agent Panel — Phase Modes

The agent panel has four distinct visual modes.

### Gathering (Stack Phase)

```
GATHERING · greeting                              2s
──────────────────────────────────────────────────────
  reading src/data/overview.md              142 lines
  reading src/data/metrics.csv               89 lines
  ⠋ summarizing 2 sources...
```

- Dim cyan header
- Shows files being read with line counts
- Brief phase, transitions automatically

### Sisyphus (Produce Phase)

```
SISYPHUS · greeting · attempt 1                   6s
──────────────────────────────────────────────────────
  # Welcome

  Welcome to Sisyphus, the spec-driven artifact engine.
  It transforms structured specifications into polished
  documents through an adversarial produce-evaluate loop.

  ⠋ writing...
```

- Magenta header
- Streams the raw markdown/content Sisyphus is writing
- Primary view — the artifact taking shape in real time

### Hades (Evaluate Phase)

```
HADES · greeting · evaluating                     3s
──────────────────────────────────────────────────────
  ✓ contains-heading    "Welcome" h1 found
  ✓ word-count-gte      47 words (min 20)
  ⠋ evaluating custom criteria...
  ✓ tone-is-welcoming   approved
```

- Red header
- Structural checks appear instantly, custom checks stream in
- Each check shows name + short reason on one line

### Climb (Retry Interstitial)

```
RETRY · greeting · attempt 2                      
──────────────────────────────────────────────────────
  ✗ word-count-gte    12 words (min 20)
  feedback: "Section too short, expand to 3-4 sentences"
  
  restarting sisyphus...
```

- Yellow header
- Shows what failed and the feedback being passed to the next attempt
- Visible for ~2 seconds or until the next produce:start event, whichever comes first

---

## Part 5: Thanatos Status Bar — Detail

Pinned to the bottom, always visible. Two lines maximum.

```
──────────────────────────────────────────────────────
✓ greeting 9s    ● features 3s    ○ summary
██████████░░░░░░░░░░░░░░░░░░░░  1/3 · 14s
```

### Line 1 — Boulder Status Strip

Each boulder is a compact badge: icon + name + time.

| Icon | Color | Meaning |
|------|-------|---------|
| `✓` | green | passed on first attempt |
| `✓` | yellow | passed after retry |
| `✗` | red | flagged (failed all attempts) |
| `●` | cyan | active |
| `○` | dim | pending |

- Active boulder shows elapsed time ticking
- Completed boulders show final time
- Pending boulders show no time
- Overflow: if too many boulders for one line, show completed + active + next pending + `+N more`

### Line 2 — Progress Bar + Stats

- Visual progress bar (filled/empty blocks)
- `X/Y` boulder count
- Total elapsed time

---

## Part 6: Completion View

When the run finishes, the agent panel transitions to a summary. Single source of truth — no duplication.

```
DONE · 2 passed · 28s
──────────────────────────────────────────────────────
  ✓ greeting · 1 attempt · 9s
      produced 47 words
      ✓ contains-heading  ✓ word-count-gte

  ✓ features · 2 attempts · 19s
      produced 3-row table, 82 words
      ✓ contains-heading  ✓ contains-table  ✓ row-count-gte
      attempt 1: ✗ row-count-gte → retried

  artifact → output/ui-test.md
  report   → output/ui-test-report.json
──────────────────────────────────────────────────────
✓ greeting 9s    ✓ features 19s
████████████████████████████████  2/2 · 28s
```

Per boulder:
- **What was produced** — word count, table dimensions, whatever structural checks can derive
- **All checks** on one line, compact
- **Retry history** (if any) — which check failed on which attempt

### Flagged Boulders

```
  ✗ features · 2 attempts · 19s
      ✗ row-count-gte  2 rows (min 3)
```

### Removed from v2

- Post-Ink plain-text `SummaryTable.ts` output — deleted entirely
- Duplicate `N passed` / `Artifact:` / `Report:` lines below the table — gone
- If machine-readable results are needed, that's what the report JSON is for

---

## Color Palette

| Element | Color | Purpose |
|---------|-------|---------|
| GATHERING header | dim cyan | Low-key, transient phase |
| SISYPHUS header | magenta | Primary producer identity |
| HADES header | red | Adversarial evaluator identity |
| RETRY header | yellow | Warning, attention needed |
| DONE header | green | Success |
| Thanatos status bar | dim/default | Background context, not competing |
| Pass icons | green | Universal success |
| Fail icons | red | Universal failure |
| Retry pass icons | yellow | Success with caveats |
| Active boulder | cyan | Current focus |
| Pending boulder | dim | Not yet relevant |

---

## Component Changes from v2

### New/Rewritten Components

- **AgentPanel** — replaces both ThanatosPanel and WorkerPanel as the primary view. Renders the active agent's streaming output with a phase-appropriate header.
- **StatusBar** — replaces the bottom half of the old layout. Compact 2-line Thanatos summary.
- **StreamingOutput** — new component that pipes raw agent output into the terminal area. Renders plain text lines as they arrive — no markdown parsing or formatting, just raw content with line wrapping.
- **RetryInterstitial** — brief transition card between failed evaluation and next attempt.

### Modified Components

- **Header** — simplified, now just the agent panel header bar (agent name, boulder, attempt, time)
- **CompletionSummary** — expanded to include per-boulder production details and check results
- **ProgressBar** — moved from header into status bar

### Removed Components

- **ThanatosPanel** — replaced by StatusBar
- **WorkerPanel** — replaced by AgentPanel
- **PanelSeparator** — replaced by a dim horizontal rule above the status bar
- **SummaryTable.ts** — post-Ink plain text output, removed entirely
- **BoulderPending** / **BoulderCompleted** — replaced by compact badge rendering in StatusBar
- **FailureDetail** — already unused, remove
- **PhaseProduce** / **PhaseEvaluate** / **PhaseStack** — replaced by AgentPanel phase modes

### State Changes

- **dispatchLog** in UIState — removed. No longer tracking dispatch events for display.
- **workerPanel** state — merged into the main agent panel state since there's only one panel now.
- New state: **streamingContent** — buffer for raw agent output being piped to AgentPanel.

---

## Event System Changes

The existing 14-event TypedEmitter stays. What changes is how the UI consumes them:

- `stack:file` → drives the GATHERING view (file list with line counts)
- `produce:file-change` → replaced by streaming output (raw content, not just file names)
- `evaluate:structural` / `evaluate:custom` → drive the HADES check list
- `climb` → triggers the RETRY interstitial

New requirement: **produce:stream** event — the engine needs to emit raw producer output as it's written, not just file-change notifications. This is the core of the "show what the agent is writing" feature.

---

## Graceful Degradation

- **Non-TTY / piped output:** Skip Ink entirely, use existing verbose text mode
- **Narrow terminals (<80 cols):** Status bar truncates boulder names, progress bar shrinks
- **No color support:** Falls back to plain text icons and no color (Ink handles this via `FORCE_COLOR=0`)

---

## Scope Boundary

This spec covers:
- Zeus Claude Code skill (conversational spec design)
- Zeus → Run handoff (terminal launch)
- Run UI redesign (agent-first layout, streaming output, status bar, completion)

This spec does NOT cover:
- Zeus implementation details (prompt engineering, question selection logic)
- Foreach boulder support
- Parallel boulder execution
- Cost tracking display
- Watch mode
