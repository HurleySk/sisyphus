# Sisyphus — Spec-Driven Document & Task Orchestrator

## Context

We're joining a large data migration project (legacy SQL → Azure SQL → Dataverse) mid-flight and need to rapidly produce analysis artifacts: migration status reports, entity schema mappings, QA coverage docs. We also need an automated loop for deploying and testing pipeline/SP changes on a remote work PC via Boomerang's task system.

The problem: producing these artifacts manually is slow and error-prone. An agent can gather the data and draft documents, but without structured acceptance criteria, it tends to declare victory prematurely. We need a system that **defines requirements up front, executes autonomously, and verifies honestly**.

Inspired by the [agentic-loop](https://github.com/allierays/agentic-loop) pattern (PRD → autonomous executor → verification loop), Sisyphus applies the same discipline to documentation production and task execution.

## Overview

Sisyphus is a unified orchestrator with three phases:

1. **Converse** — Brainstorm with the user to produce a structured spec with verifiable criteria
2. **Execute** — Gather data and produce output, dispatching to pluggable backends
3. **Evaluate** — Check output against spec criteria; retry with failure context on failure

The core (spec builder + loop + evaluator) is project-agnostic and publishable as a Claude Code skill plugin. Boomerang-specific task dispatch is a backend plugin.

## Architecture

### The Loop

```
CONVERSE ──▶ EXECUTE ──▶ EVALUATE
               ▲            │
               │  failure    │
               │  context    │
               └─────────────┘
```

- Each **section** in the spec is processed independently
- Retries carry forward: the evaluator's specific feedback + the original criteria
- Max retries: configurable per-section (default 3)
- After max retries: section flagged as incomplete with evaluator notes; loop continues

### Spec Format

A spec is a JSON file with sections, data sources, and acceptance criteria:

```json
{
  "title": "ALM Entity Migration Status",
  "description": "Status report for all alm_ prefixed entities",
  "output": "output/reports/alm-migration-status.md",
  "maxRetries": 3,
  "sections": [
    {
      "name": "Entity Inventory",
      "description": "List all alm_ entities with migration status",
      "gather": [
        {
          "type": "analysis",
          "source": "dataverse-schema/_index.json",
          "instruction": "Extract all entities with alm_ prefix"
        },
        {
          "type": "ado-search",
          "query": "migration entity",
          "filters": { "type": "User Story", "state": "Active" }
        }
      ],
      "criteria": [
        {
          "check": "contains-table",
          "columns": ["Entity", "Status", "ADO Item", "Notes"],
          "description": "Table with required columns"
        },
        {
          "check": "row-count-gte",
          "source": "gather[0]",
          "min": 1,
          "description": "At least as many rows as entities in schema"
        },
        {
          "check": "custom",
          "description": "Each entity has a status from: Complete, In Progress, Not Started, Blocked"
        }
      ]
    }
  ]
}
```

**Gather types:**
- `analysis` — Read local files, dispatch Claude agents for synthesis
- `ado-search` — Run `ado-search search`/`show` commands
- `task` — Write Boomerang task file, wait for results (backend plugin)

**Criteria types:**
- `contains-table` — Verify markdown table with specified columns exists (deterministic)
- `row-count-gte` / `row-count-lte` — Row count bounds (deterministic)
- `contains-heading` — Verify heading exists (deterministic)
- `word-count-gte` / `word-count-lte` — Section length bounds (deterministic)
- `custom` — LLM-evaluated with evidence requirement (see Evaluator)

**Section templates:**
- `foreach` field allows templated sections (one per entity, pipeline, etc.)
- Template variables reference gather results: `{entity}`, `{pipeline}`

### The Evaluator

Separate agent from the producer. Its only job is to find failures.

**Pass 1 — Structural checks** (code, no LLM):
- Parse markdown, verify tables, count rows, check headings
- Binary pass/fail, no judgment involved

**Pass 2 — Custom criteria** (adversarial LLM):
- Receives: criterion text + produced section + gathered source data
- Does NOT receive: the original goal description (prevents rationalization)
- Must respond with: `{ "pass": bool, "evidence": "quoted text", "reason": "specific explanation" }`
- Prompted to be adversarial — find the failure, don't confirm success
- A pass requires citing the specific text that satisfies the criterion

**Anti-short-circuit measures:**
1. Structural checks are deterministic code — can't be faked
2. Custom checks require evidence — can't just say "looks good"
3. Evaluator is blind to goal context — can only check specific criteria
4. Failed criteria produce actionable feedback for retry

### Backends

**Analysis backend** (built-in):
- File reads, Grep/Glob, Claude agent dispatch for synthesis
- Available in all projects

**ADO Search backend** (built-in, requires `ado-search`):
- Wraps `ado-search search` and `ado-search show`
- Feeds work item content into sections

**Boomerang Task backend** (plugin):
- Writes task JSON to `tasks/`, commits, pushes
- Polls `tasks/results/` via git pull for completion
- Parses result JSON, feeds into loop
- **Wait mode** (v1): Polls until results appear
- **Checkpoint mode** (future): Persist loop state, resume when results available
- Loop state is already structured (spec + section index + retry count + gathered data), so serializing to checkpoint JSON is a natural extension

### The Spec Builder (Conversational Phase)

A guided conversation that produces the spec JSON:

1. User describes what they want in natural language
2. Spec builder asks clarifying questions (one at a time, multiple choice preferred)
3. For each section, it proposes data sources and acceptance criteria
4. It pushes toward **specific, falsifiable criteria** — rejects vague requirements
5. Outputs the spec JSON for user approval before execution begins

This is the "converse" phase — it runs once, produces the contract, and hands off to the autonomous loop.

### Task Loop Mode

A simplified invocation for deploy-test-fix cycles:

```
/sisyphus:task Deploy p_SecurityModelConfig to dev, run the pipeline, verify no errors
```

The spec builder generates a linear step sequence with success/failure criteria:
1. Deploy SP → check result status
2. Run pipeline → check for activity errors
3. If errors → analyze, fix SP, retry from step 1

Same loop, evaluator, and retry mechanics. Just a simpler spec shape.

## Project Structure

```
sisyphus/                         # Standalone repo / skill plugin
├── skills/
│   └── sisyphus/
│       ├── sisyphus.md           # Main skill: /sisyphus (doc orchestrator)
│       ├── task.md               # Task loop mode: /sisyphus:task
│       ├── spec-builder.md       # Conversational spec builder prompt
│       └── evaluator.md          # Evaluator agent prompt
├── lib/
│   ├── spec-schema.json          # JSON Schema for spec validation
│   └── structural-checks.md     # Deterministic check implementations
├── backends/
│   ├── analysis.md               # Built-in: local file analysis
│   ├── ado-search.md             # Built-in: ADO integration
│   └── boomerang-tasks.md        # Plugin: Boomerang task dispatch
└── examples/
    ├── migration-status.json     # Example spec
    ├── entity-mapping.json       # Example spec
    └── deploy-and-test.json      # Example task loop spec
```

The core (`skills/`, `lib/`) is project-agnostic. Backends in `backends/` are pluggable — the Boomerang backend is included but only activates when task infrastructure is detected.

## Scope for v1

**In scope:**
- Spec builder (conversational → structured JSON spec)
- Execution loop with retry and failure context
- Evaluator (structural checks + adversarial custom checks)
- Analysis backend (local files + agent synthesis)
- ADO Search backend
- Boomerang Task backend (wait mode only)
- Task loop mode (`/sisyphus:task`)
- Example specs for migration status and entity mapping

**Out of scope (future):**
- Checkpoint mode (persist loop state for async resume)
- Parallel section execution
- Spec versioning / diff
- Web UI for spec editing
- Other backend plugins (GitHub Issues, Jira, etc.)

## Verification

1. **Spec builder**: Invoke `/sisyphus`, walk through a conversation, verify the output spec JSON has valid structure and sensible criteria
2. **Structural checks**: Write a test markdown doc, run structural checks, verify pass/fail behavior
3. **Evaluator**: Give it a doc with a known deficiency + criteria that should catch it, verify it fails with correct feedback
4. **Full loop**: Run a complete migration status report on a small entity set (2-3 alm_ entities), verify the loop produces, evaluates, retries, and outputs correctly
5. **Task loop**: Run `/sisyphus:task` for a simple SQL query task, verify it builds the task file, waits for results, and evaluates
